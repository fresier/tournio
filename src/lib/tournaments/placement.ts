import { blockSize, extraMatches, fairnessWarning, finalRanking, firstRound, formatProblems, nextRound, overallSeeding, type FinalFormat, type PlacementPairing, type PlayedPairing } from '@/lib/domain/placement';
import { placeMatches } from '@/lib/domain/schedule';
import { standings, type StandingRow } from '@/lib/domain/standings';
import { poolsInOrder, scheduleCourts, scheduleRules } from './schedule';
import type { TournamentConfiguration } from './contracts';

/**
 * Pont entre la configuration enregistrée et le moteur de phase de classement (`@/lib/domain/placement`).
 * Lecture seule : l’état affiché et l’écriture reposent sur les mêmes calculs.
 */

type Match = TournamentConfiguration['matches'][number];
const closed = (match: Match) => match.status === 'COMPLETED' || match.status === 'CANCELLED';

/** Classement de chaque poule avec les règles du tournoi (résultats validés uniquement). */
export function poolTables(configuration: TournamentConfiguration): StandingRow[][] {
  const { rules } = configuration;
  return poolsInOrder(configuration).map((pool) => standings(pool.teams, configuration.matches.filter((match) => match.pool_id === pool.id).map((match) => ({
    id: match.id, home: match.home_team_id, away: match.away_team_id, status: match.status,
    homeScore: match.home_score, awayScore: match.away_score, validatedAt: match.status === 'COMPLETED' ? 'validé' : null,
  })), { allowDraw: rules.allow_draw, pointsWin: rules.points_win, pointsDraw: rules.points_draw, pointsLoss: rules.points_loss, tieBreakOrder: rules.tie_break_order }).table);
}

const played = (matches: Match[]): PlayedPairing[] => matches.filter((match) => match.status === 'COMPLETED' && match.home_score !== null && match.away_score !== null).map((match) => {
  const homeWins = match.home_score! > match.away_score!;
  return { round: match.final_round!, placeFrom: match.place_from!, placeTo: match.place_to!, slot: match.slot!,
    home: match.home_team_id, away: match.away_team_id, winner: homeWins ? match.home_team_id : match.away_team_id, loser: homeWins ? match.away_team_id : match.home_team_id };
});

export type PlacementState = {
  format: FinalFormat;
  /** Le format ne s’applique pas à ces poules. */
  problems: string[];
  warning: string | null;
  teamCount: number;
  totalRounds: number;
  /** Dernier tour généré (0 : phase non commencée). */
  round: number;
  started: boolean;
  finished: boolean;
  /** Raisons d’attendre avant de générer le tour suivant (vide = possible). */
  waiting: string[];
  ranking: string[] | null;
};

export function placementState(configuration: TournamentConfiguration): PlacementState {
  const format = configuration.rules.final_format;
  const pools = poolsInOrder(configuration);
  const sizes = pools.map((pool) => pool.teams.length);
  const teamCount = sizes.reduce((sum, size) => sum + size, 0);
  const finals = configuration.matches.filter((match) => match.phase === 'FINAL');
  const round = finals.reduce((max, match) => Math.max(max, match.final_round ?? 0), 0);
  const totalRounds = extraMatches(format, teamCount);
  const ranking = format === 'none' ? null : finalRanking(played(finals), teamCount);
  const waiting: string[] = [];
  const status = configuration.tournament.status;
  if (status === 'DRAFT') waiting.push('Publiez le tournoi et jouez les poules d’abord.');
  else if (status !== 'PUBLISHED') waiting.push('Le tournoi est terminé.');
  if (!round) {
    const open = configuration.matches.filter((match) => match.phase === 'POOL' && !closed(match)).length;
    if (open) waiting.push(`${open} match${open > 1 ? 's' : ''} de poule ${open > 1 ? 'restent' : 'reste'} à jouer.`);
  } else {
    const current = finals.filter((match) => match.final_round === round);
    const open = current.filter((match) => match.status !== 'COMPLETED').length;
    if (round >= totalRounds) waiting.push('Tous les tours de classement ont été générés.');
    else if (open) waiting.push(`${open} match${open > 1 ? 's' : ''} du tour ${round} ${open > 1 ? 'restent' : 'reste'} à jouer.`);
  }
  return { format, problems: formatProblems(format, sizes), warning: format === 'none' ? null : fairnessWarning(sizes), teamCount, totalRounds, round, started: round > 0, finished: Boolean(ranking), waiting, ranking };
}

export type PlannedFinalMatch = PlacementPairing & { courtId: string; start: number; end: number };

/**
 * Prochain tour de classement, placé sur les terrains après la fin de tous les matchs déjà planifiés
 * (repos et transition compris). Le résultat est déterministe à configuration égale.
 */
export function planFinalRound(configuration: TournamentConfiguration): { status: 'ready'; matches: PlannedFinalMatch[] } | { status: 'refused'; reasons: string[] } {
  const state = placementState(configuration);
  if (state.format === 'none') return { status: 'refused', reasons: ['Aucune phase de classement n’est prévue dans les règles du tournoi.'] };
  if (state.problems.length) return { status: 'refused', reasons: state.problems };
  if (state.waiting.length) return { status: 'refused', reasons: state.waiting };

  const finals = configuration.matches.filter((match) => match.phase === 'FINAL');
  const pairings = state.round === 0
    ? firstRound(overallSeeding(poolTables(configuration)), blockSize(state.format, state.teamCount))
    : nextRound(played(finals.filter((match) => match.final_round === state.round)));

  const rules = scheduleRules(configuration);
  const ends = configuration.matches.filter((match) => match.status !== 'CANCELLED' && match.ends_at).map((match) => Date.parse(match.ends_at!));
  // Pause entre les tours : aucun match avant sa fin (le repos minimal et la transition restent des minimums).
  const notBefore = (ends.length ? Math.max(...ends) : 0) + Math.max(rules.transitionMinutes, rules.restMinutes, configuration.rules.round_break_minutes) * 60_000;
  // Disponibilités rognées : le tour commence après la fin des matchs déjà planifiés.
  const courts = scheduleCourts(configuration).map((court) => ({ ...court, availabilities: court.availabilities
    .map((window) => ({ start: Math.max(window.start, notBefore), end: window.end })).filter((window) => window.end > window.start) }));
  const result = placeMatches({ matches: pairings.map((pairing, index) => ({ key: String(index), poolId: 'final', round: pairing.round, home: pairing.home, away: pairing.away })), courts, rules });
  if (result.status !== 'scheduled') return { status: 'refused', reasons: [
    `Plus assez de créneaux après les matchs déjà planifiés pour ce tour (${pairings.length} match${pairings.length > 1 ? 's' : ''}).`,
    'Levez une indisponibilité de terrain (section Terrains) ou libérez des créneaux depuis le calendrier, puis réessayez.',
  ] };
  return { status: 'ready', matches: result.matches.map((match) => ({ ...pairings[Number(match.key)], courtId: match.courtId, start: match.start, end: match.end })) };
}
