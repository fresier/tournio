import type { Prisma, Tournament } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/database/client';
import { configurationSchema, schedulePreviewSchema, tournamentSummarySchema, type ConfigurationCommand, type MatchCommand, type ScheduleCommand, type StartMatches, type TournamentInput, type TournamentConfiguration } from './contracts';
import { planSchedule, scheduleViolations } from './schedule';
import { planFinalRound, placementState } from './placement';
import { formatProblems } from '@/lib/domain/placement';
import { remap, restore, subtract, type Interval } from '@/lib/domain/availability';
import { drawPools } from '@/lib/domain/draw';
import { randomInt } from 'node:crypto';
import { regenerationBlockers, transitionError, type MatchStatus } from '@/lib/domain/match-status';

export class DomainError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
const missing = () => new DomainError('NOT_FOUND', 'Ressource introuvable ou accès refusé.', 404);
const jsonValue = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const matchFields = { id: true, pool_id: true, home_team_id: true, away_team_id: true, court_id: true, starts_at: true, ends_at: true, status: true, home_score: true, away_score: true, version: true, phase: true, final_round: true, place_from: true, place_to: true, slot: true } as const;

function publicTournament(t: Tournament) {
  return { id: t.id, name: t.name, slug: t.slug, sport: t.sport, location: t.location, timezone: t.timezone,
    starts_at: t.starts_at, ends_at: t.ends_at, status: t.status, published_at: t.published_at,
    theme: t.theme, primary_color: t.primary_color, accent_color: t.accent_color,
    version: t.version, created_at: t.created_at, updated_at: t.updated_at };
}

export async function configurationForUser(userId: string, id: string, database?: Prisma.TransactionClient): Promise<TournamentConfiguration> {
  if (!database) return getPrisma().$transaction((tx) => configurationForUser(userId, id, tx), { isolationLevel: 'RepeatableRead', timeout: 15000 });
  const row = await database.tournament.findFirst({ where: { id, owner_id: userId }, include: {
    rules: true, teams: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }] },
    pools: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] },
    pool_teams: { orderBy: [{ pool_id: 'asc' }, { team_id: 'asc' }] },
    courts: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] },
    availabilities: { orderBy: [{ starts_at: 'asc' }, { id: 'asc' }] }, _count: { select: { matches: true } },
    matches: { orderBy: [{ starts_at: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], select: matchFields },
  } });
  if (!row) throw missing();
  return configurationSchema.parse(jsonValue({ tournament: publicTournament(row), rules: row.rules, teams: row.teams,
    pools: row.pools, pool_teams: row.pool_teams, courts: row.courts, availabilities: row.availabilities, matches: row.matches, match_count: row._count.matches }));
}

export async function tournamentsForUser(userId: string) {
  const rows = await getPrisma().tournament.findMany({ where: { owner_id: userId }, orderBy: [{ created_at: 'desc' }, { id: 'asc' }], include: { _count: { select: { teams: true, pools: true, courts: true } } } });
  return rows.map((row) => tournamentSummarySchema.parse(jsonValue({ ...publicTournament(row), team_count: row._count.teams, pool_count: row._count.pools, court_count: row._count.courts })));
}

export async function createTournamentForUser(userId: string, input: TournamentInput) {
  return getPrisma().$transaction(async (tx) => {
    const tournament = await tx.tournament.create({ data: { ...input, owner_id: userId, rules: { create: {} } } });
    return configurationForUser(userId, tournament.id, tx);
  });
}

export async function configureTournamentForUser(userId: string, id: string, command: ConfigurationCommand) {
  return getPrisma().$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<Pick<Tournament, 'id' | 'version' | 'status' | 'starts_at' | 'ends_at'>[]>`
      SELECT id, version, status, starts_at, ends_at FROM tournio.tournaments
      WHERE id = ${id}::uuid AND owner_id = ${userId}::uuid FOR UPDATE`;
    if (!current) throw missing();
    if (current.version !== command.expected_version) throw new DomainError('STALE_VERSION', 'Ce tournoi a changé dans un autre onglet. Rechargez sa dernière version.', 409);
    // Exceptions au verrou de configuration, sans effet sur les matchs déjà joués :
    // l’apparence (visuelle), le format de classement (tant qu’il n’a pas commencé) et l’ajout de créneaux (capacité en plus).
    if (command.operation === 'update_appearance') {
      if (current.status === 'ARCHIVED') throw new DomainError('TOURNAMENT_LOCKED', 'Un tournoi archivé n’est plus modifiable.', 409);
    } else if (command.operation === 'set_final_format') {
      if (current.status !== 'DRAFT' && current.status !== 'PUBLISHED') throw new DomainError('TOURNAMENT_LOCKED', 'Le format ne peut plus être modifié : le tournoi est terminé.', 409);
      if (await tx.match.count({ where: { tournament_id: id, phase: 'FINAL' } })) throw new DomainError('PLACEMENT_STARTED', 'La phase de classement a commencé : annulez ses tours pour changer de format.', 409);
    } else if (command.operation === 'update_pool' || command.operation === 'update_court' || (command.operation === 'update_team' && await tx.team.count({ where: { id: command.payload.id, tournament_id: id, slug: command.payload.slug } }))) {
      // Renommer une équipe, une poule ou un terrain ne change que l’affichage (ni matchs, ni lien) : permis jusqu’à l’archivage.
      if (current.status === 'ARCHIVED') throw new DomainError('TOURNAMENT_LOCKED', 'Un tournoi archivé n’est plus modifiable.', 409);
    } else if ((command.operation === 'create_availability' || command.operation === 'remove_unavailability') && current.status === 'PUBLISHED') {
      // Ajouter une plage ne déplace aucun match ; utile si la phase de classement manque de créneaux.
    } else if (current.status !== 'DRAFT' || await tx.match.count({ where: { tournament_id: id } })) throw new DomainError('CONFIGURATION_LOCKED', 'La configuration est verrouillée après publication ou création des matchs.', 409);
    const check = (count: number) => { if (!count) throw missing(); };
    switch (command.operation) {
      case 'update_tournament': {
        const input = command.payload;
        // Les terrains sont disponibles sur toute la période : leurs indisponibilités sont conservées, le reste suit les nouvelles dates.
        // Ordre imposé par le trigger des dates : plages retirées, dates changées, puis nouvelles plages.
        const from = { start: current.starts_at.getTime(), end: current.ends_at.getTime() };
        const to = { start: Date.parse(input.starts_at), end: Date.parse(input.ends_at) };
        const moved = from.start !== to.start || from.end !== to.end;
        const courts = moved ? await tx.court.findMany({ where: { tournament_id: id }, select: { id: true } }) : [];
        // Lectures séquentielles : une transaction n’utilise qu’une connexion.
        const remapped: { id: string; windows: Interval[] }[] = [];
        for (const court of courts) remapped.push({ id: court.id, windows: remap(await courtWindows(tx, court.id), from, to) });
        if (moved) await tx.courtAvailability.deleteMany({ where: { tournament_id: id } });
        await tx.tournament.update({ where: { id }, data: input });
        for (const court of remapped) await replaceWindows(tx, id, court.id, court.windows);
        break;
      }
      case 'update_appearance': await tx.tournament.update({ where: { id }, data: command.payload }); break;
      case 'set_final_format': {
        const sizes = await tx.pool.findMany({ where: { tournament_id: id }, select: { _count: { select: { members: true } } } });
        const problems = formatProblems(command.payload.final_format, sizes.map((pool) => pool._count.members), command.payload.allow_incomplete);
        if (problems.length) throw new DomainError('FORMAT_IMPOSSIBLE', `Ce format ne convient pas à vos poules : ${problems.join(' ')}`, 422);
        await tx.tournamentRules.update({ where: { tournament_id: id }, data: command.payload });
        break;
      }
      case 'save_rules': await tx.tournamentRules.update({ where: { tournament_id: id }, data: command.payload }); break;
      case 'create_team': await tx.team.create({ data: { tournament_id: id, ...command.payload } }); break;
      case 'create_teams': {
        // Équipes de test ou de démonstration, créées d’un coup (une seule version, une seule mise à jour).
        const slugs = command.payload.teams.map((team) => team.slug);
        if (new Set(slugs).size !== slugs.length || await tx.team.count({ where: { tournament_id: id, slug: { in: slugs } } })) throw new DomainError('SLUG_TAKEN', 'Un identifiant d’équipe est déjà utilisé.', 409);
        await tx.team.createMany({ data: command.payload.teams.map((team) => ({ tournament_id: id, ...team })) });
        break;
      }
      case 'update_team': {
        const { id: teamId, ...input } = command.payload;
        check((await tx.team.updateMany({ where: { tournament_id: id, id: teamId }, data: input })).count); break;
      }
      case 'delete_team': check((await tx.team.deleteMany({ where: { tournament_id: id, id: command.payload.id } })).count); break;
      case 'create_pool': {
        const order = await tx.pool.aggregate({ where: { tournament_id: id }, _max: { sort_order: true } });
        await tx.pool.create({ data: { tournament_id: id, ...command.payload, sort_order: (order._max.sort_order ?? -1) + 1 } }); break;
      }
      case 'update_pool': check((await tx.pool.updateMany({ where: { tournament_id: id, id: command.payload.id }, data: { name: command.payload.name } })).count); break;
      case 'delete_pool': check((await tx.pool.deleteMany({ where: { tournament_id: id, id: command.payload.id } })).count); break;
      case 'assign_team': {
        const { team_id, pool_id } = command.payload;
        if (!await tx.team.findFirst({ where: { id: team_id, tournament_id: id }, select: { id: true } })) throw missing();
        if (pool_id && !await tx.pool.findFirst({ where: { id: pool_id, tournament_id: id }, select: { id: true } })) throw missing();
        await tx.poolTeam.deleteMany({ where: { tournament_id: id, team_id } });
        if (pool_id) await tx.poolTeam.create({ data: { tournament_id: id, team_id, pool_id } }); break;
      }
      case 'draw_pools': {
        const pools = await tx.pool.findMany({ where: { tournament_id: id }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], select: { id: true } });
        if (!pools.length) throw new DomainError('NO_POOL', 'Créez au moins une poule avant le tirage au sort.', 422);
        const teams = await tx.team.findMany({ where: { tournament_id: id }, orderBy: { id: 'asc' }, select: { id: true } });
        const memberships = command.payload.mode === 'all' ? [] : await tx.poolTeam.findMany({ where: { tournament_id: id }, select: { team_id: true, pool_id: true } });
        const placed = new Set(memberships.map((row) => row.team_id));
        const candidates = teams.map((team) => team.id).filter((team) => !placed.has(team));
        if (!candidates.length) throw new DomainError('NOTHING_TO_DRAW', teams.length ? 'Toutes les équipes ont déjà une poule.' : 'Ajoutez des équipes avant le tirage au sort.', 422);
        // Hasard cryptographique : le tirage ne peut pas être prédit ni rejoué.
        const assignment = drawPools(candidates, pools.map((pool) => ({ id: pool.id, members: memberships.filter((row) => row.pool_id === pool.id).map((row) => row.team_id) })), (n) => randomInt(n));
        if (command.payload.mode === 'all') await tx.poolTeam.deleteMany({ where: { tournament_id: id } });
        await tx.poolTeam.createMany({ data: [...assignment].map(([team_id, pool_id]) => ({ tournament_id: id, team_id, pool_id })) });
        break;
      }
      case 'create_court': {
        const order = await tx.court.aggregate({ where: { tournament_id: id }, _max: { sort_order: true } });
        const court = await tx.court.create({ data: { tournament_id: id, ...command.payload, sort_order: (order._max.sort_order ?? -1) + 1 } });
        // Par défaut, un terrain est disponible pendant toute la durée du tournoi.
        await tx.courtAvailability.create({ data: { tournament_id: id, court_id: court.id, starts_at: current.starts_at, ends_at: current.ends_at } });
        break;
      }
      case 'add_unavailability':
      case 'remove_unavailability': {
        const input = command.payload;
        if (!await tx.court.findFirst({ where: { id: input.court_id, tournament_id: id }, select: { id: true } })) throw missing();
        const period = { start: current.starts_at.getTime(), end: current.ends_at.getTime() };
        const slot = { start: Date.parse(input.starts_at), end: Date.parse(input.ends_at) };
        if (slot.end <= period.start || slot.start >= period.end) throw new DomainError('OUTSIDE_TOURNAMENT', 'Cette période est en dehors des dates du tournoi.', 422);
        const windows = await courtWindows(tx, input.court_id);
        await replaceWindows(tx, id, input.court_id, command.operation === 'add_unavailability' ? subtract(windows, slot) : restore(windows, slot, period));
        break;
      }
      case 'update_court': check((await tx.court.updateMany({ where: { tournament_id: id, id: command.payload.id }, data: { name: command.payload.name } })).count); break;
      case 'delete_court': check((await tx.court.deleteMany({ where: { tournament_id: id, id: command.payload.id } })).count); break;
      case 'create_availability': {
        const input = command.payload;
        if (!await tx.court.findFirst({ where: { id: input.court_id, tournament_id: id }, select: { id: true } })) throw missing();
        if (new Date(input.starts_at) < current.starts_at || new Date(input.ends_at) > current.ends_at) throw new DomainError('AVAILABILITY_OUTSIDE_TOURNAMENT', 'Les disponibilités doivent rester dans les dates du tournoi.', 422);
        const overlap = await tx.courtAvailability.findFirst({ where: { court_id: input.court_id, starts_at: { lt: new Date(input.ends_at) }, ends_at: { gt: new Date(input.starts_at) } }, select: { id: true } });
        if (overlap) throw new DomainError('AVAILABILITY_OVERLAP', 'Cette plage chevauche une disponibilité existante du terrain.', 422);
        await tx.courtAvailability.create({ data: { tournament_id: id, ...input } }); break;
      }
      case 'delete_availability': check((await tx.courtAvailability.deleteMany({ where: { tournament_id: id, id: command.payload.id } })).count); break;
    }
    await tx.tournament.update({ where: { id }, data: { version: { increment: 1 } } });
    return configurationForUser(userId, id, tx);
  }, { timeout: 15000, maxWait: 10000 });
}

async function courtWindows(tx: Prisma.TransactionClient, courtId: string): Promise<Interval[]> {
  const rows = await tx.courtAvailability.findMany({ where: { court_id: courtId }, select: { starts_at: true, ends_at: true } });
  return rows.map((row) => ({ start: row.starts_at.getTime(), end: row.ends_at.getTime() }));
}

/** Remplace les plages disponibles d’un terrain (les triggers revérifient dates et chevauchements). */
async function replaceWindows(tx: Prisma.TransactionClient, tournamentId: string, courtId: string, windows: Interval[]) {
  await tx.courtAvailability.deleteMany({ where: { court_id: courtId } });
  if (windows.length) await tx.courtAvailability.createMany({ data: windows.map((window) => ({ tournament_id: tournamentId, court_id: courtId, starts_at: new Date(window.start), ends_at: new Date(window.end) })) });
}

function lockedTournament(tx: Prisma.TransactionClient, userId: string, id: string) {
  return tx.$queryRaw<Pick<Tournament, 'id' | 'version' | 'status'>[]>`
    SELECT id, version, status FROM tournio.tournaments
    WHERE id = ${id}::uuid AND owner_id = ${userId}::uuid FOR UPDATE`.then((rows) => rows[0]);
}

/** Raisons d’empêcher l’enregistrement d’un nouveau calendrier, communes à la prévisualisation et à l’écriture. */
function saveBlockers(configuration: TournamentConfiguration) {
  if (configuration.tournament.status !== 'DRAFT') return ['Le calendrier ne peut plus être régénéré après publication.'];
  return regenerationBlockers(configuration.matches.map((match) => ({ status: match.status, homeScore: match.home_score, awayScore: match.away_score })));
}

/** Prévisualisation : lecture seule, aucune écriture métier. */
export async function schedulePreviewForUser(userId: string, id: string) {
  const configuration = await configurationForUser(userId, id);
  const plan = planSchedule(configuration);
  return schedulePreviewSchema.parse({
    version: configuration.tournament.version, status: plan.status,
    reasons: plan.status === 'ready' ? [] : plan.reasons, matches: plan.status === 'ready' ? plan.matches : [],
    save_blockers: saveBlockers(configuration),
  });
}

export async function scheduleTournamentForUser(userId: string, id: string, command: ScheduleCommand) {
  return getPrisma().$transaction(async (tx) => {
    const current = await lockedTournament(tx, userId, id);
    if (!current) throw missing();
    if (current.version !== command.expected_version) throw new DomainError('STALE_VERSION', 'Ce tournoi a changé depuis votre prévisualisation. Rechargez sa dernière version.', 409);
    if (current.status === 'ARCHIVED') throw new DomainError('TOURNAMENT_ARCHIVED', 'Un tournoi archivé ne peut plus être modifié.', 409);
    // Configuration relue sous le verrou : c’est elle, et non le navigateur, qui fait foi.
    const configuration = await configurationForUser(userId, id, tx);

    switch (command.operation) {
      case 'generate': {
        const blockers = saveBlockers(configuration);
        if (blockers.length) throw new DomainError('REGENERATION_BLOCKED', blockers.join(' '), 409);
        if (configuration.matches.length && !command.payload.replace) throw new DomainError('SCHEDULE_EXISTS', 'Un calendrier existe déjà. Confirmez son remplacement.', 409);
        const plan = planSchedule(configuration);
        if (plan.status !== 'ready') throw new DomainError('SCHEDULE_UNAVAILABLE', plan.reasons.join(' '), 422);
        await tx.match.deleteMany({ where: { tournament_id: id } });
        await tx.match.createMany({ data: plan.matches.map((match) => ({
          tournament_id: id, pool_id: match.pool_id, home_team_id: match.home_team_id, away_team_id: match.away_team_id,
          court_id: match.court_id, starts_at: new Date(match.starts_at), ends_at: new Date(match.ends_at),
        })) });
        break;
      }
      case 'clear': {
        const blockers = saveBlockers(configuration);
        if (blockers.length) throw new DomainError('REGENERATION_BLOCKED', blockers.join(' '), 409);
        await tx.match.deleteMany({ where: { tournament_id: id } });
        break;
      }
      case 'move_match': {
        if (current.status !== 'DRAFT' && current.status !== 'PUBLISHED') throw new DomainError('TOURNAMENT_LOCKED', 'Le calendrier n’est plus modifiable.', 409);
        const { match_id, court_id, starts_at } = command.payload;
        const match = configuration.matches.find((row) => row.id === match_id);
        if (!match || !configuration.courts.some((court) => court.id === court_id)) throw missing();
        if (match.status !== 'SCHEDULED' && match.status !== 'POSTPONED') throw new DomainError('MATCH_LOCKED', 'Seul un match prévu ou reporté peut être déplacé.', 409);
        const start = Date.parse(starts_at);
        const end = start + configuration.rules.match_duration_minutes * 60_000;
        const moved = { ...match, court_id, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), status: 'SCHEDULED' as const };
        const violations = scheduleViolations({ ...configuration, matches: configuration.matches.map((row) => row.id === match_id ? moved : row) })
          .filter((violation) => violation.matches.includes(match_id));
        if (violations.length) throw new DomainError('SCHEDULE_CONFLICT', [...new Set(violations.map((violation) => violation.message))].join(' '), 422);
        await tx.match.update({ where: { id: match_id }, data: { court_id, starts_at: new Date(start), ends_at: new Date(end), status: 'SCHEDULED', version: { increment: 1 } } });
        break;
      }
      case 'publish': {
        if (current.status !== 'DRAFT') throw new DomainError('ALREADY_PUBLISHED', 'Ce tournoi est déjà publié.', 409);
        if (!configuration.matches.length) throw new DomainError('SCHEDULE_MISSING', 'Générez et enregistrez le calendrier avant de publier.', 422);
        const violations = scheduleViolations(configuration);
        if (violations.length) throw new DomainError('SCHEDULE_CONFLICT', `Le calendrier contient ${violations.length} conflit${violations.length > 1 ? 's' : ''} : ${[...new Set(violations.map((violation) => violation.message))].join(' ')}`, 422);
        await tx.tournament.update({ where: { id }, data: { status: 'PUBLISHED', published_at: new Date() } });
        break;
      }
      case 'generate_final_round': {
        const plan = planFinalRound(configuration);
        if (plan.status !== 'ready') throw new DomainError('PLACEMENT_UNAVAILABLE', plan.reasons.join(' '), plan.reasons.some((reason) => reason.includes('créneaux')) ? 422 : 409);
        await tx.match.createMany({ data: plan.matches.map((match) => ({
          tournament_id: id, pool_id: null, phase: 'FINAL', final_round: match.round, place_from: match.placeFrom, place_to: match.placeTo, slot: match.slot,
          home_team_id: match.home, away_team_id: match.away, court_id: match.courtId, starts_at: new Date(match.start), ends_at: new Date(match.end),
        })) });
        break;
      }
      case 'cancel_final_round': {
        if (current.status !== 'PUBLISHED') throw new DomainError('TOURNAMENT_LOCKED', 'Le tournoi n’est plus en cours.', 409);
        const round = placementState(configuration).round;
        if (!round) throw new DomainError('PLACEMENT_NOT_STARTED', 'Aucun tour de classement à annuler.', 409);
        const last = configuration.matches.filter((match) => match.phase === 'FINAL' && match.final_round === round);
        if (last.some((match) => match.status !== 'SCHEDULED' && match.status !== 'POSTPONED')) throw new DomainError('ROUND_STARTED', `Le tour ${round} a déjà commencé : il ne peut plus être annulé.`, 409);
        await tx.match.deleteMany({ where: { tournament_id: id, phase: 'FINAL', final_round: round } });
        break;
      }
      case 'complete': {
        if (current.status !== 'PUBLISHED') throw new DomainError('NOT_PUBLISHED', 'Seul un tournoi publié peut être terminé.', 409);
        const placement = placementState(configuration);
        if (placement.format !== 'none' && !placement.finished) throw new DomainError('PLACEMENT_UNFINISHED', 'La phase de classement n’est pas terminée : jouez tous ses tours, ou choisissez « Poules uniquement » dans l’onglet Format et règles si elle n’a pas commencé.', 409);
        const open = configuration.matches.filter((match) => match.status !== 'COMPLETED' && match.status !== 'CANCELLED').length;
        if (open) throw new DomainError('MATCHES_OPEN', `${open} match${open > 1 ? 's n’ont' : ' n’a'} pas encore de résultat. Saisissez-le${open > 1 ? 's' : ''} ou annulez-le${open > 1 ? 's' : ''} avant de terminer le tournoi.`, 409);
        await tx.tournament.update({ where: { id }, data: { status: 'COMPLETED' } });
        break;
      }
      case 'archive': {
        if (current.status === 'DRAFT') throw new DomainError('NOT_PUBLISHED', 'Seul un tournoi publié peut être archivé.', 409);
        await tx.tournament.update({ where: { id }, data: { status: 'ARCHIVED' } });
        break;
      }
    }
    await tx.tournament.update({ where: { id }, data: { version: { increment: 1 } } });
    return configurationForUser(userId, id, tx);
  }, { timeout: 15000, maxWait: 10000 });
}

const nextStatus: Record<MatchCommand['operation'], MatchStatus> = {
  start: 'IN_PROGRESS', reset: 'SCHEDULED', record_result: 'COMPLETED', postpone: 'POSTPONED', cancel: 'CANCELLED', reinstate: 'SCHEDULED',
};

/**
 * Changement d’état ou résultat d’un match, en une transaction :
 * verrou du tournoi (sérialise avec le calendrier), contrôle propriétaire, version du match, état et nuls.
 * La version du tournoi est incrémentée pour l’ordre des instantanés publics ;
 * la notification PostgreSQL n’est délivrée qu’au commit.
 */
export async function matchCommandForUser(userId: string, id: string, matchId: string, command: MatchCommand) {
  return getPrisma().$transaction(async (tx) => {
    const current = await lockedTournament(tx, userId, id);
    if (!current) throw missing();
    const configuration = await configurationForUser(userId, id, tx);
    const match = configuration.matches.find((row) => row.id === matchId);
    if (!match) throw missing();
    if (match.version !== command.expected_version) throw new DomainError('STALE_VERSION', 'Ce match a déjà été modifié (autre onglet ou double envoi). Rechargez pour voir son état actuel.', 409);
    const correction = command.operation === 'record_result' && match.status === 'COMPLETED';
    if (current.status === 'DRAFT') throw new DomainError('NOT_PUBLISHED', 'Publiez le tournoi avant de saisir des résultats.', 409);
    if (current.status === 'ARCHIVED') throw new DomainError('TOURNAMENT_ARCHIVED', 'Un tournoi archivé ne peut plus être modifié.', 409);
    if (current.status === 'COMPLETED' && !correction) throw new DomainError('TOURNAMENT_COMPLETED', 'Le tournoi est terminé : seule la correction d’un résultat reste possible.', 409);

    // Phase de classement : les poules sont figées dès qu’elle commence ; un tour est figé dès que le suivant existe.
    const finalRound = configuration.matches.reduce((max, row) => Math.max(max, row.final_round ?? 0), 0);
    if (match.phase === 'POOL' && finalRound) throw new DomainError('POOLS_FROZEN', 'La phase de classement a commencé à partir de ces résultats : les matchs de poule sont figés. Annulez les tours de classement pour corriger une poule.', 409);
    if (match.phase === 'FINAL') {
      if (command.operation === 'cancel' || command.operation === 'reinstate') throw new DomainError('PLACEMENT_MATCH', 'Un match de classement ne peut pas être annulé : toutes les places doivent être jouées. Reportez-le si nécessaire.', 409);
      if (match.final_round! < finalRound) throw new DomainError('ROUND_FROZEN', `Le tour ${match.final_round! + 1} a été généré à partir de ce résultat : annulez-le d’abord pour corriger ce match.`, 409);
    }

    const to = nextStatus[command.operation];
    const result = command.operation === 'record_result' ? { homeScore: command.payload.home_score, awayScore: command.payload.away_score } : { homeScore: null, awayScore: null };
    if (match.phase === 'FINAL' && command.operation === 'record_result' && result.homeScore === result.awayScore) throw new DomainError('DRAW_NOT_ALLOWED', 'Un match de classement doit désigner un vainqueur : saisissez le score qui départage les équipes.', 422);
    const refused = transitionError(match.status, to, result, configuration.rules.allow_draw);
    if (refused) throw new DomainError(refused.includes('nuls') ? 'DRAW_NOT_ALLOWED' : 'INVALID_TRANSITION', refused, refused.includes('nuls') ? 422 : 409);

    let data: Prisma.MatchUncheckedUpdateInput;
    switch (command.operation) {
      case 'record_result':
        // Une correction garde le match terminé ; le classement est recalculé à la lecture.
        data = { status: 'COMPLETED', home_score: command.payload.home_score, away_score: command.payload.away_score, result_validated_at: new Date() };
        break;
      case 'postpone':
        // Un match reporté n’affiche plus d’horaire : il sera replanifié depuis le calendrier.
        data = { status: 'POSTPONED', court_id: null, starts_at: null, ends_at: null };
        break;
      case 'reinstate': {
        if (match.starts_at) {
          const restored = { ...match, status: 'SCHEDULED' as const };
          const violations = scheduleViolations({ ...configuration, matches: configuration.matches.map((row) => row.id === matchId ? restored : row) })
            .filter((violation) => violation.matches.includes(matchId));
          if (violations.length) throw new DomainError('SCHEDULE_CONFLICT', `Son ancien créneau est désormais pris : ${[...new Set(violations.map((v) => v.message))].join(' ')} Rétablissez-le puis déplacez-le, ou libérez le créneau.`, 422);
          data = { status: 'SCHEDULED' };
        } else data = { status: 'POSTPONED' };
        break;
      }
      default: data = { status: to };
    }
    await tx.match.update({ where: { id: matchId }, data: { ...data, version: { increment: 1 } } });
    await tx.tournament.update({ where: { id }, data: { version: { increment: 1 } } });
    return configurationForUser(userId, id, tx);
  }, { timeout: 15000, maxWait: 10000 });
}

/**
 * Lance plusieurs matchs en une transaction (typiquement tous ceux d’un même créneau) :
 * chacun doit être prévu et à jour, sinon rien n’est modifié. Une seule version de tournoi,
 * donc une seule mise à jour des pages publiques.
 */
export async function startMatchesForUser(userId: string, id: string, command: StartMatches) {
  return getPrisma().$transaction(async (tx) => {
    const current = await lockedTournament(tx, userId, id);
    if (!current) throw missing();
    if (current.status !== 'PUBLISHED') throw new DomainError('NOT_PUBLISHED', 'Les matchs se lancent pendant le tournoi publié.', 409);
    const configuration = await configurationForUser(userId, id, tx);
    for (const item of command.matches) {
      const match = configuration.matches.find((row) => row.id === item.id);
      if (!match) throw missing();
      if (match.version !== item.expected_version) throw new DomainError('STALE_VERSION', 'Un de ces matchs a déjà été modifié (autre onglet ou autre organisateur). Rechargez pour voir leur état actuel.', 409);
      if (match.status !== 'SCHEDULED') throw new DomainError('INVALID_TRANSITION', 'Seuls des matchs prévus peuvent être lancés.', 409);
    }
    // Mises à jour séquentielles : une transaction n’utilise qu’une connexion.
    for (const item of command.matches) await tx.match.update({ where: { id: item.id }, data: { status: 'IN_PROGRESS', version: { increment: 1 } } });
    await tx.tournament.update({ where: { id }, data: { version: { increment: 1 } } });
    return configurationForUser(userId, id, tx);
  }, { timeout: 15000, maxWait: 10000 });
}
