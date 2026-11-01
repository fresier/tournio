import type { Prisma, Tournament } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/database/client';
import { configurationSchema, tournamentSummarySchema, type ConfigurationCommand, type TournamentInput, type TournamentConfiguration } from './contracts';

export class DomainError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
const missing = () => new DomainError('NOT_FOUND', 'Ressource introuvable ou accès refusé.', 404);
const jsonValue = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function publicTournament(t: Tournament) {
  return { id: t.id, name: t.name, slug: t.slug, sport: t.sport, location: t.location, timezone: t.timezone,
    starts_at: t.starts_at, ends_at: t.ends_at, status: t.status, published_at: t.published_at,
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
  } });
  if (!row) throw missing();
  return configurationSchema.parse(jsonValue({ tournament: publicTournament(row), rules: row.rules, teams: row.teams,
    pools: row.pools, pool_teams: row.pool_teams, courts: row.courts, availabilities: row.availabilities, match_count: row._count.matches }));
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
    if (current.status !== 'DRAFT' || await tx.match.count({ where: { tournament_id: id } })) throw new DomainError('CONFIGURATION_LOCKED', 'La configuration est verrouillée après publication ou création des matchs.', 409);
    const check = (count: number) => { if (!count) throw missing(); };
    switch (command.operation) {
      case 'update_tournament': {
        const input = command.payload;
        const outside = await tx.courtAvailability.count({ where: { tournament_id: id, OR: [{ starts_at: { lt: new Date(input.starts_at) } }, { ends_at: { gt: new Date(input.ends_at) } }] } });
        if (outside) throw new DomainError('AVAILABILITY_OUTSIDE_TOURNAMENT', 'Les disponibilités doivent rester dans les dates du tournoi.', 422);
        await tx.tournament.update({ where: { id }, data: input }); break;
      }
      case 'save_rules': await tx.tournamentRules.update({ where: { tournament_id: id }, data: command.payload }); break;
      case 'create_team': await tx.team.create({ data: { tournament_id: id, ...command.payload } }); break;
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
      case 'create_court': {
        const order = await tx.court.aggregate({ where: { tournament_id: id }, _max: { sort_order: true } });
        await tx.court.create({ data: { tournament_id: id, ...command.payload, sort_order: (order._max.sort_order ?? -1) + 1 } }); break;
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
