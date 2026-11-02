import { standings } from '@/lib/domain/standings';
import { blockSize, extraMatches, finalRanking, overallSeeding, provisionalRanking, type FinalFormat } from '@/lib/domain/placement';
import type { StandingRow } from '@/lib/domain/standings';
import { publicTournamentSchema, type PublicTournament } from './contracts';

const iso = (value: Date | string) => new Date(value).toISOString();
const isoOrNull = (value: Date | string | null) => value === null ? null : iso(value);

export type SnapshotSource = {
  name: string; slug: string; sport: string; location: string; timezone: string;
  starts_at: Date | string; ends_at: Date | string; status: string; version: number;
  theme?: string; primary_color?: string | null; accent_color?: string | null;
  background_color?: string | null; surface_color?: string | null; text_color?: string | null;
  rules: { allow_draw: boolean; points_win: number; points_draw: number; points_loss: number; tie_break_order: string[]; final_format?: string | null } | null;
  pools: { id: string; name: string }[];
  teams: { id: string; name: string; slug: string }[];
  pool_teams: { pool_id: string; team_id: string }[];
  courts: { id: string; name: string }[];
  matches: {
    id: string; pool_id: string | null; home_team_id: string; away_team_id: string; court_id: string | null;
    starts_at: Date | string | null; ends_at: Date | string | null; status: string;
    home_score: number | null; away_score: number | null; result_validated_at: Date | string | null;
    phase?: string; final_round?: number | null; place_from?: number | null; place_to?: number | null; slot?: number | null;
  }[];
};

/** Construit l’instantané public (fonction pure, testée sans base). Les classements sont recalculés à chaque appel. */
export function publicSnapshot(source: SnapshotSource): PublicTournament {
  const rules = source.rules ?? { allow_draw: true, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: [] };
  const poolOf = new Map(source.pool_teams.map((row) => [row.team_id, row.pool_id]));
  const tables = source.pools.map((pool) => {
    const teams = source.teams.filter((team) => poolOf.get(team.id) === pool.id).map((team) => team.id);
    const { table } = standings(teams, source.matches.filter((match) => match.pool_id === pool.id).map((match) => ({
      id: match.id, home: match.home_team_id, away: match.away_team_id, status: match.status,
      homeScore: match.home_score, awayScore: match.away_score, validatedAt: match.result_validated_at,
    })), { allowDraw: rules.allow_draw, pointsWin: rules.points_win, pointsDraw: rules.points_draw, pointsLoss: rules.points_loss, tieBreakOrder: rules.tie_break_order });
    return { pool, table };
  });
  return publicTournamentSchema.parse({
    tournament: {
      name: source.name, slug: source.slug, sport: source.sport, location: source.location, timezone: source.timezone,
      starts_at: iso(source.starts_at), ends_at: iso(source.ends_at), status: source.status, version: source.version,
      theme: source.theme ?? 'tournio', primary_color: source.primary_color ?? null, accent_color: source.accent_color ?? null,
      background_color: source.background_color ?? null, surface_color: source.surface_color ?? null, text_color: source.text_color ?? null,
    },
    pools: source.pools.map(({ id, name }) => ({ id, name })),
    teams: source.teams.map(({ id, name, slug }) => ({ id, name, slug, pool_id: poolOf.get(id) ?? null })),
    courts: source.courts.map(({ id, name }) => ({ id, name })),
    matches: source.matches.map((match) => ({
      id: match.id, pool_id: match.pool_id, home_team_id: match.home_team_id, away_team_id: match.away_team_id, court_id: match.court_id,
      phase: match.phase === 'FINAL' ? 'FINAL' as const : 'POOL' as const, final_round: match.final_round ?? null, place_from: match.place_from ?? null, place_to: match.place_to ?? null,
      starts_at: isoOrNull(match.starts_at), ends_at: isoOrNull(match.ends_at), status: match.status,
      // Un score n’est public qu’une fois validé.
      home_score: match.result_validated_at ? match.home_score : null, away_score: match.result_validated_at ? match.away_score : null,
    })),
    standings: tables.map(({ pool, table }) => ({ pool_id: pool.id, rows: table.map((row) => ({
      position: row.position, team_id: row.team, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
      scores_for: row.scoresFor, scores_against: row.scoresAgainst, score_difference: row.scoreDifference, points: row.points,
    })) })),
    placement: placementSummary(source, poolOf.size, tables.map(({ table }) => table)),
  });
}

const FORMATS = ['none', 'rank', 'cross', 'bracket'] as const;

/**
 * Phase de classement : format, nombre de tours, classement du tournoi (plages de places encore disputées,
 * dès le tour 1) et classement final. Seuls les résultats validés comptent.
 */
function placementSummary(source: SnapshotSource, teamCount: number, tables: StandingRow[][]) {
  const format: FinalFormat = (FORMATS as readonly string[]).includes(source.rules?.final_format ?? '') ? source.rules!.final_format as FinalFormat : 'none';
  const finals = source.matches.filter((match) => match.phase === 'FINAL');
  const played = finals.filter((match) => match.status === 'COMPLETED' && match.result_validated_at && match.home_score !== null && match.away_score !== null)
    .map((match) => {
      const homeWins = match.home_score! > match.away_score!;
      return { round: match.final_round!, placeFrom: match.place_from!, placeTo: match.place_to!, slot: match.slot ?? 0, home: match.home_team_id, away: match.away_team_id,
        winner: homeWins ? match.home_team_id : match.away_team_id, loser: homeWins ? match.away_team_id : match.home_team_id,
        homeScore: match.home_score!, awayScore: match.away_score! };
    });
  const size = blockSize(format, teamCount);
  const seeds = finals.length && size >= 2 ? overallSeeding(tables) : [];
  const standing = format !== 'none' && finals.length && size >= 2
    ? provisionalRanking(seeds, size, played).map((row) => ({ team_id: row.team, place_from: row.placeFrom, place_to: row.placeTo }))
    : null;
  return { format, rounds: extraMatches(format, teamCount), ranking: format === 'none' ? null : finalRanking(played, teamCount, seeds, size), standing };
}
