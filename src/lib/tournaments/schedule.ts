import { poolMatches } from '@/lib/domain/round-robin';
import { alignedStep, placeMatches, validateSchedule, type CourtInput, type ScheduleRules, type ScheduledMatch, type Violation } from '@/lib/domain/schedule';
import type { TournamentConfiguration } from './contracts';

/**
 * Pont entre la configuration enregistrée et le moteur pur (`@/lib/domain`).
 * Aucune écriture ici : la prévisualisation et l’enregistrement appellent la même fonction,
 * ce qui garantit que le calendrier enregistré est exactement celui prévisualisé à version égale.
 */

export type PlannedMatch = { pool_id: string; round: number; home_team_id: string; away_team_id: string; court_id: string; starts_at: string; ends_at: string };
export type SchedulePlan =
  | { status: 'ready'; matches: PlannedMatch[] }
  /** La configuration est incomplète : rien n’est tenté. */
  | { status: 'blocked'; reasons: string[] }
  | { status: 'impossible'; reasons: string[] }
  | { status: 'not_found'; reasons: string[]; unplaced: number; placed: number };

export function scheduleRules(configuration: TournamentConfiguration): ScheduleRules {
  const { rules } = configuration;
  const base = { matchMinutes: rules.match_duration_minutes, transitionMinutes: rules.transition_minutes, restMinutes: rules.minimum_rest_minutes };
  // Horaires alignés : grille commune à tous les terrains, ancrée sur le début du tournoi.
  return rules.aligned_slots ? { ...base, grid: { anchor: Date.parse(configuration.tournament.starts_at), stepMinutes: alignedStep(base) } } : base;
}

export function scheduleCourts(configuration: TournamentConfiguration): CourtInput[] {
  return configuration.courts.map((court) => ({
    id: court.id,
    availabilities: configuration.availabilities.filter((row) => row.court_id === court.id).map((row) => ({ start: Date.parse(row.starts_at), end: Date.parse(row.ends_at) })),
  }));
}

/** Ordre canonique des poules (ordre d’affichage) et des équipes (ordre d’inscription). */
export function poolsInOrder(configuration: TournamentConfiguration) {
  return configuration.pools.map((pool) => ({
    id: pool.id, name: pool.name,
    teams: configuration.teams.filter((team) => configuration.pool_teams.some((row) => row.pool_id === pool.id && row.team_id === team.id)).map((team) => team.id),
  }));
}

export function planSchedule(configuration: TournamentConfiguration): SchedulePlan {
  const pools = poolsInOrder(configuration);
  const reasons: string[] = [];
  if (!pools.length) reasons.push('Créez au moins une poule.');
  for (const pool of pools) if (pool.teams.length < 2) reasons.push(`${pool.name} doit compter au moins deux équipes.`);
  const unassigned = configuration.teams.filter((team) => !configuration.pool_teams.some((row) => row.team_id === team.id));
  if (unassigned.length) reasons.push(`${unassigned.length} équipe${unassigned.length > 1 ? 's ne sont' : ' n’est'} dans aucune poule : ${unassigned.map((team) => team.name).join(', ')}.`);
  if (!configuration.courts.length) reasons.push('Ajoutez au moins un terrain.');
  // Le format conditionne la suite du tournoi (et sa durée) : il doit être choisi avant le calendrier.
  if (!configuration.rules.final_format) reasons.push('Choisissez le format du tournoi dans l’onglet Format et règles.');
  else if (!configuration.availabilities.length) reasons.push('Définissez les disponibilités des terrains.');
  if (reasons.length) return { status: 'blocked', reasons };

  const result = placeMatches({ matches: poolMatches(pools), courts: scheduleCourts(configuration), rules: scheduleRules(configuration) });
  if (result.status === 'impossible') return { status: 'impossible', reasons: result.reasons };
  if (result.status === 'not_found') {
    return { status: 'not_found', unplaced: result.unplaced.length, placed: result.placed.length, reasons: [
      `${result.unplaced.length} match${result.unplaced.length > 1 ? 's' : ''} sur ${result.unplaced.length + result.placed.length} n’ont pas pu être placés.`,
      'Ajoutez des plages de disponibilité ou des terrains, ou réduisez la durée, la transition ou le repos minimal.',
    ] };
  }
  return { status: 'ready', matches: result.matches.map((match) => ({
    pool_id: match.poolId, round: match.round, home_team_id: match.home, away_team_id: match.away,
    court_id: match.courtId, starts_at: new Date(match.start).toISOString(), ends_at: new Date(match.end).toISOString(),
  })) };
}

type StoredMatch = TournamentConfiguration['matches'][number];

export function storedSchedule(matches: readonly StoredMatch[]): ScheduledMatch[] {
  return matches.map((match) => ({
    // Un match de classement peut rejouer une affiche de poule : la règle « une seule rencontre » vaut par poule.
    key: match.id, home: match.home_team_id, away: match.away_team_id, group: match.pool_id ?? `final:${match.id}`, courtId: match.court_id,
    start: match.starts_at ? Date.parse(match.starts_at) : null, end: match.ends_at ? Date.parse(match.ends_at) : null,
    cancelled: match.status === 'CANCELLED',
  }));
}

/** Toutes les violations du calendrier enregistré. Un match reporté attend un nouvel horaire : il n’est pas compté comme « non placé ». */
export function scheduleViolations(configuration: TournamentConfiguration): Violation[] {
  const postponed = new Set(configuration.matches.filter((match) => match.status === 'POSTPONED').map((match) => match.id));
  return validateSchedule(storedSchedule(configuration.matches), scheduleCourts(configuration), scheduleRules(configuration))
    .filter((violation) => !(violation.code === 'unplaced' && violation.matches.every((key) => postponed.has(key))));
}
