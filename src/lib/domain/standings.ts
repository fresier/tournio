/**
 * Classement d’une poule, recalculé à chaque appel depuis les seuls résultats validés
 * de matchs terminés (aucune seconde vérité stockée).
 *
 * Départage dans l’ordre de `tieBreakOrder` (par défaut : points, différence, scores marqués, identifiant).
 * L’identifiant d’équipe sert d’ordre stable final : deux équipes ne sont jamais à égalité parfaite.
 */

export type TieBreak = 'points' | 'score_difference' | 'scores_for' | 'team_id';
export const DEFAULT_TIE_BREAK: TieBreak[] = ['points', 'score_difference', 'scores_for', 'team_id'];

export type StandingsRules = { allowDraw: boolean; pointsWin: number; pointsDraw: number; pointsLoss: number; tieBreakOrder?: readonly string[] };
export type ResultInput = {
  id: string; home: string; away: string;
  status: string; homeScore: number | null; awayScore: number | null; validatedAt: Date | string | null;
};
export type StandingRow = {
  position: number; team: string;
  played: number; won: number; drawn: number; lost: number;
  scoresFor: number; scoresAgainst: number; scoreDifference: number; points: number;
};

export function standings(teams: readonly string[], matches: readonly ResultInput[], rules: StandingsRules) {
  const rows = new Map<string, Omit<StandingRow, 'position'>>(teams.map((team) => [team, {
    team, played: 0, won: 0, drawn: 0, lost: 0, scoresFor: 0, scoresAgainst: 0, scoreDifference: 0, points: 0,
  }]));
  /** Matchs terminés et validés mais inutilisables (équipe hors poule, nul interdit…), signalés plutôt qu’ignorés en silence. */
  const ignored: { id: string; reason: string }[] = [];

  for (const match of matches) {
    if (match.status !== 'COMPLETED' || match.validatedAt === null || match.homeScore === null || match.awayScore === null) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) { ignored.push({ id: match.id, reason: 'Une des équipes n’appartient pas à cette poule.' }); continue; }
    if (match.homeScore === match.awayScore && !rules.allowDraw) { ignored.push({ id: match.id, reason: 'Match nul alors que les nuls ne sont pas autorisés.' }); continue; }

    for (const [row, own, other] of [[home, match.homeScore, match.awayScore], [away, match.awayScore, match.homeScore]] as const) {
      row.played++;
      row.scoresFor += own;
      row.scoresAgainst += other;
      row.scoreDifference = row.scoresFor - row.scoresAgainst;
      if (own > other) { row.won++; row.points += rules.pointsWin; }
      else if (own === other) { row.drawn++; row.points += rules.pointsDraw; }
      else { row.lost++; row.points += rules.pointsLoss; }
    }
  }

  const order = (rules.tieBreakOrder?.length ? rules.tieBreakOrder : DEFAULT_TIE_BREAK).filter((key): key is TieBreak => (DEFAULT_TIE_BREAK as string[]).includes(key));
  if (!order.includes('team_id')) order.push('team_id');
  const compare = (a: Omit<StandingRow, 'position'>, b: Omit<StandingRow, 'position'>) => {
    for (const key of order) {
      const diff = key === 'points' ? b.points - a.points
        : key === 'score_difference' ? b.scoreDifference - a.scoreDifference
          : key === 'scores_for' ? b.scoresFor - a.scoresFor
            : a.team < b.team ? -1 : a.team > b.team ? 1 : 0;
      if (diff) return diff;
    }
    return 0;
  };
  const table = [...rows.values()].sort(compare).map((row, index): StandingRow => ({ position: index + 1, ...row }));
  return { table, ignored };
}
