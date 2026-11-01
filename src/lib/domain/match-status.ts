/**
 * États d’un match et transitions autorisées, à vérifier côté API.
 *
 * - Un organisateur peut saisir directement le résultat d’un match prévu (SCHEDULED → COMPLETED).
 * - Un match terminé reste terminé : une correction de score ne change pas son état.
 * - Un match reporté doit être replanifié (→ SCHEDULED) avant de pouvoir être joué.
 * - Un match annulé peut être rétabli (→ SCHEDULED) puis replacé dans le calendrier.
 */

export const MATCH_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

const transitions: Record<MatchStatus, readonly MatchStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED'],
  IN_PROGRESS: ['SCHEDULED', 'COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['SCHEDULED', 'CANCELLED'],
  CANCELLED: ['SCHEDULED'],
  COMPLETED: [],
};

export function canTransition(from: MatchStatus, to: MatchStatus) {
  return transitions[from].includes(to);
}

export type ResultCheck = { homeScore: number | null; awayScore: number | null };

/** Retourne la raison du refus, ou null si la transition est permise. */
export function transitionError(from: MatchStatus, to: MatchStatus, result: ResultCheck, allowDraw: boolean): string | null {
  if (from === to && to !== 'COMPLETED') return null;
  if (from !== to && !canTransition(from, to)) return `Un match ${label[from]} ne peut pas passer à l’état ${label[to]}.`;
  if (to === 'COMPLETED') {
    const { homeScore, awayScore } = result;
    if (homeScore === null || awayScore === null) return 'Un match terminé doit avoir un score pour chaque équipe.';
    if (![homeScore, awayScore].every((score) => Number.isInteger(score) && score >= 0)) return 'Les scores doivent être des entiers positifs ou nuls.';
    if (homeScore === awayScore && !allowDraw) return 'Les matchs nuls ne sont pas autorisés dans ce tournoi.';
  }
  return null;
}

const label: Record<MatchStatus, string> = {
  SCHEDULED: 'prévu', IN_PROGRESS: 'en cours', COMPLETED: 'terminé', POSTPONED: 'reporté', CANCELLED: 'annulé',
};

export type RegenerationMatch = { status: MatchStatus; homeScore: number | null; awayScore: number | null };

/**
 * Politique de régénération retenue : autorisée (après confirmation) tant qu’aucun match
 * n’a commencé ni reçu de score ; refusée ensuite, pour ne jamais écraser un résultat.
 */
export function regenerationBlockers(matches: readonly RegenerationMatch[]) {
  const started = matches.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'COMPLETED').length;
  const scored = matches.filter((m) => m.homeScore !== null || m.awayScore !== null).length;
  const reasons: string[] = [];
  if (started) reasons.push(`${started} match${started > 1 ? 's ont' : ' a'} déjà commencé.`);
  if (scored) reasons.push(`${scored} match${scored > 1 ? 's ont' : ' a'} déjà un score.`);
  return reasons;
}
