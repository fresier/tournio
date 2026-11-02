import type { PublicMatch, PublicTournament } from './contracts';

/**
 * Règles d’affichage public, sans dépendance au navigateur.
 * `now` est optionnel : le rendu serveur n’en a pas (pas de compte à rebours ni de retard),
 * ce qui garantit un HTML identique au premier rendu client.
 */

export type MatchTone = 'scheduled' | 'late' | 'live' | 'done' | 'postponed' | 'cancelled';

export function matchState(match: PublicMatch, now?: number): { label: string; tone: MatchTone } {
  switch (match.status) {
    case 'IN_PROGRESS': return { label: 'En cours', tone: 'live' };
    case 'COMPLETED': return { label: 'Terminé', tone: 'done' };
    case 'POSTPONED': return { label: 'Reporté · nouvel horaire à venir', tone: 'postponed' };
    case 'CANCELLED': return { label: 'Annulé', tone: 'cancelled' };
    default:
      if (now !== undefined && match.starts_at && Date.parse(match.starts_at) + 60_000 <= now) return { label: 'En attente du coup d’envoi', tone: 'late' };
      return { label: 'Prévu', tone: 'scheduled' };
  }
}

export function teamMatches(snapshot: PublicTournament, teamId: string) {
  return snapshot.matches.filter((match) => match.home_team_id === teamId || match.away_team_id === teamId);
}

/** Prochain match : celui en cours, sinon le prochain prévu (même si son heure est passée), sinon un match reporté. */
export function nextMatch(snapshot: PublicTournament, teamId: string): PublicMatch | undefined {
  const matches = teamMatches(snapshot, teamId);
  const byStart = (a: PublicMatch, b: PublicMatch) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? '');
  return matches.find((match) => match.status === 'IN_PROGRESS')
    ?? matches.filter((match) => match.status === 'SCHEDULED' && match.starts_at).sort(byStart)[0]
    ?? matches.find((match) => match.status === 'POSTPONED');
}

export function opponentOf(match: PublicMatch, teamId: string) {
  return match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
}

/** Délai indicatif avant un match : « dans 25 min », « dans 1 h 05 », « dans 2 jours ». */
export function countdown(startsAt: string, now: number) {
  const minutes = Math.round((Date.parse(startsAt) - now) / 60_000);
  if (minutes <= 0) return minutes > -2 ? 'maintenant' : `prévu il y a ${formatDuration(-minutes)}`;
  return `dans ${formatDuration(minutes)}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  return `${Math.round(minutes / (24 * 60))} jours`;
}

/** Score « 3 – 1 » du point de vue de l’équipe, ou null s’il n’est pas encore public. */
export function scoreFor(match: PublicMatch, teamId?: string) {
  if (match.home_score === null || match.away_score === null) return null;
  const [own, other] = teamId === match.away_team_id ? [match.away_score, match.home_score] : [match.home_score, match.away_score];
  return { text: `${own} – ${other}`, outcome: teamId ? (own > other ? 'Victoire' : own < other ? 'Défaite' : 'Nul') : null };
}

export const teamPreferenceKey = (slug: string) => `tournio:equipe:${slug}`;

/**
 * Matchs de classement qui attendent encore une équipe sans match programmé : leurs adversaires dépendent
 * des résultats en cours (fin des poules, ou fin du tour précédent). Null si l’équipe n’a plus rien à jouer.
 */
export function pendingPlacement(snapshot: PublicTournament, teamId: string): { remaining: number; waitingFor: 'pools' | number } | null {
  const { placement } = snapshot;
  if (placement.format === 'none' || placement.ranking || !placement.rounds) return null;
  if (!snapshot.teams.some((team) => team.id === teamId && team.pool_id)) return null;
  if (snapshot.tournament.status !== 'PUBLISHED') return null;
  const finals = snapshot.matches.filter((match) => match.phase === 'FINAL');
  const generated = finals.reduce((max, match) => Math.max(max, match.final_round ?? 0), 0);
  // Dès le tour 1, la plage de places encore disputée donne le nombre exact de matchs restants
  // (une équipe d’un groupe incomplet en joue moins) ; avant, le nombre de tours du format.
  const row = placement.standing?.find((standing) => standing.team_id === teamId);
  const remaining = row ? Math.ceil(Math.log2(row.place_to - row.place_from + 1)) : placement.rounds - generated;
  if (remaining <= 0) return null;
  return { remaining, waitingFor: generated === 0 ? 'pools' : generated };
}
