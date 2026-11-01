/**
 * Génération des rencontres d’une poule par la méthode du cercle (aller simple).
 *
 * - L’ordre des équipes reçu est l’ordre canonique : le résultat ne dépend que de lui.
 * - Effectif impair : une équipe fictive « repos » est ajoutée ; l’équipe qui la rencontre est exempte du tour.
 * - Chaque paire n’apparaît qu’une fois, jamais dans les deux sens.
 * - Le domicile alterne d’un tour à l’autre pour équilibrer les rôles.
 */

export type Pairing = { round: number; home: string; away: string };
export type RoundRobin = { pairings: Pairing[]; byes: { round: number; team: string }[]; rounds: number };

const BYE = Symbol('repos');

export function roundRobin(teams: readonly string[]): RoundRobin {
  if (new Set(teams).size !== teams.length) throw new Error('Une équipe apparaît deux fois dans la poule.');
  if (teams.length < 2) return { pairings: [], byes: teams.map((team) => ({ round: 1, team })), rounds: teams.length ? 1 : 0 };

  const slots: (string | typeof BYE)[] = teams.length % 2 ? [...teams, BYE] : [...teams];
  const size = slots.length;
  const rounds = size - 1;
  const pairings: Pairing[] = [];
  const byes: { round: number; team: string }[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < size / 2; i++) {
      const a = slots[i];
      const b = slots[size - 1 - i];
      if (a === BYE || b === BYE) {
        byes.push({ round: round + 1, team: (a === BYE ? b : a) as string });
        continue;
      }
      // Le pivot (i = 0) alterne à chaque tour ; les autres paires alternent selon leur position.
      const swap = i === 0 ? round % 2 === 1 : i % 2 === 1;
      pairings.push({ round: round + 1, home: (swap ? b : a) as string, away: (swap ? a : b) as string });
    }
    // Rotation : le premier emplacement reste fixe, les autres tournent d’un cran.
    slots.splice(1, 0, slots.pop()!);
  }
  return { pairings, byes, rounds };
}

export function expectedMatchCount(teamCount: number) {
  return (teamCount * (teamCount - 1)) / 2;
}

/** Rencontres de toutes les poules, dans l’ordre des poules puis des tours, prêtes pour le placement. */
export function poolMatches(pools: readonly { id: string; teams: readonly string[] }[]) {
  return pools.flatMap((pool) => roundRobin(pool.teams).pairings.map((pairing, index) => ({
    key: `${pool.id}:${index + 1}`, poolId: pool.id, round: pairing.round, home: pairing.home, away: pairing.away,
  })));
}
