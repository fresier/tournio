import 'server-only';
import { getPrisma } from '@/lib/database/client';
import { publicSnapshot } from './snapshot';

export const PUBLIC_STATUSES = ['PUBLISHED', 'COMPLETED', 'ARCHIVED'] as const;

/** Tournoi publié par son slug, ou null : un brouillon est indiscernable d’un tournoi inexistant. */
export async function publicTournamentBySlug(slug: string) {
  const row = await getPrisma().tournament.findFirst({
    where: { slug, status: { in: [...PUBLIC_STATUSES] } },
    select: {
      id: true, name: true, slug: true, sport: true, location: true, timezone: true, starts_at: true, ends_at: true, status: true, version: true, theme: true, primary_color: true, accent_color: true, background_color: true, surface_color: true, text_color: true,
      rules: { select: { allow_draw: true, points_win: true, points_draw: true, points_loss: true, tie_break_order: true, final_format: true } },
      pools: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], select: { id: true, name: true } },
      teams: { orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, slug: true } },
      pool_teams: { select: { pool_id: true, team_id: true } },
      courts: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }], select: { id: true, name: true } },
      matches: {
        orderBy: [{ starts_at: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        select: { id: true, pool_id: true, home_team_id: true, away_team_id: true, court_id: true, starts_at: true, ends_at: true, status: true, home_score: true, away_score: true, result_validated_at: true, phase: true, final_round: true, place_from: true, place_to: true, slot: true },
      },
    },
  });
  if (!row) return null;
  return { id: row.id, snapshot: publicSnapshot(row) };
}

/** Identifiant interne d’un tournoi publié, pour filtrer les notifications temps réel. */
export async function publicTournamentId(slug: string) {
  const row = await getPrisma().tournament.findFirst({ where: { slug, status: { in: [...PUBLIC_STATUSES] } }, select: { id: true } });
  return row?.id ?? null;
}
