/**
 * Tirage au sort des poules. Code pur : le hasard est injecté (`random(n)` rend un entier dans [0, n[),
 * ce qui rend le tirage testable ; le serveur utilise un générateur cryptographique.
 */

export type Random = (n: number) => number;

/** Mélange de Fisher-Yates, sans biais. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Répartit `teams` dans les poules, en les ajoutant à celles qui comptent le moins d’équipes :
 * les tailles restent équilibrées à une équipe près. À taille égale, la poule est tirée au sort,
 * pour qu’aucune poule ne reçoive systématiquement l’équipe en plus.
 */
export function drawPools(teams: readonly string[], pools: readonly { id: string; members: readonly string[] }[], random: Random): Map<string, string> {
  const sizes = new Map(pools.map((pool) => [pool.id, pool.members.length]));
  const assignment = new Map<string, string>();
  if (!pools.length) return assignment;
  for (const team of shuffle(teams, random)) {
    const smallest = Math.min(...sizes.values());
    const candidates = pools.filter((pool) => sizes.get(pool.id) === smallest);
    const pool = candidates[random(candidates.length)];
    assignment.set(team, pool.id);
    sizes.set(pool.id, smallest + 1);
  }
  return assignment;
}
