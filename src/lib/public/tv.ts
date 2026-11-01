import type { PublicMatch, PublicTournament } from './contracts';

/**
 * Contenu de l’écran TV, calculé depuis l’instantané public. Code pur : les listes sont bornées
 * pour tenir dans un écran 16:9 sans défilement.
 */

const byStart = (a: PublicMatch, b: PublicMatch) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? '') || a.id.localeCompare(b.id);

export type CourtState = { courtId: string; match: PublicMatch | undefined; state: 'live' | 'next' | 'idle' };

/** Un terrain par ligne : le match en cours, sinon le prochain prévu, sinon libre. */
export function courtStates(snapshot: PublicTournament): CourtState[] {
  return snapshot.courts.map((court) => {
    const onCourt = snapshot.matches.filter((match) => match.court_id === court.id);
    const live = onCourt.filter((match) => match.status === 'IN_PROGRESS').sort(byStart)[0];
    if (live) return { courtId: court.id, match: live, state: 'live' };
    const next = onCourt.filter((match) => match.status === 'SCHEDULED' && match.starts_at).sort(byStart)[0];
    return { courtId: court.id, match: next, state: next ? 'next' : 'idle' };
  });
}

/** Matchs prévus suivants, hors ceux déjà annoncés sur leur terrain. */
export function upcomingMatches(snapshot: PublicTournament, limit: number) {
  const announced = new Set(courtStates(snapshot).flatMap((row) => row.match ? [row.match.id] : []));
  return snapshot.matches.filter((match) => match.status === 'SCHEDULED' && match.starts_at && !announced.has(match.id)).sort(byStart).slice(0, limit);
}

/** Derniers résultats validés, du plus récent au plus ancien (ordre du calendrier). */
export function recentResults(snapshot: PublicTournament, limit: number) {
  return snapshot.matches.filter((match) => match.status === 'COMPLETED' && match.home_score !== null && match.away_score !== null)
    .sort((a, b) => byStart(b, a)).slice(0, limit);
}

/** Pages de classements : poules regroupées tant qu’elles tiennent dans `rows` lignes (en-têtes compris). */
export function standingPages(snapshot: PublicTournament, rows: number): string[][] {
  const pages: string[][] = [];
  let current: string[] = []; let used = 0;
  for (const pool of snapshot.pools) {
    const size = (snapshot.standings.find((row) => row.pool_id === pool.id)?.rows.length ?? 0) + 2;
    if (current.length && used + size > rows) { pages.push(current); current = []; used = 0; }
    current.push(pool.id); used += size;
  }
  if (current.length) pages.push(current);
  return pages;
}
