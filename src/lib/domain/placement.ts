/**
 * Phase de classement après les poules : personne n’est éliminé, chaque équipe joue le même nombre
 * de matchs supplémentaires et toutes les places sont disputées.
 *
 * Un seul moteur couvre tous les formats : un « tableau de classement » par blocs de 2^r équipes.
 * Dans un bloc, les gagnants d’un tour se disputent la moitié haute des places du bloc, les perdants la moitié basse,
 * jusqu’à des matchs à deux équipes qui fixent chaque place. Code pur, sans base de données.
 */
import type { StandingRow } from './standings';

export const FINAL_FORMATS = ['none', 'rank', 'cross', 'bracket'] as const;
export type FinalFormat = (typeof FINAL_FORMATS)[number];

/** Nombre d’équipes par bloc : 2 (un match par rang), 4 (croisé en deux tours), toutes (tableau complet). */
export function blockSize(format: FinalFormat, teamCount: number) {
  return format === 'rank' ? 2 : format === 'cross' ? 4 : format === 'bracket' ? teamCount : 0;
}

/** Matchs supplémentaires joués par chaque équipe. */
export function extraMatches(format: FinalFormat, teamCount: number) {
  const size = blockSize(format, teamCount);
  return size >= 2 ? Math.round(Math.log2(size)) : 0;
}

const powerOfTwo = (value: number) => value >= 2 && (value & (value - 1)) === 0;

/** Raisons pour lesquelles un format ne peut pas s’appliquer à ces poules (vide = possible). */
export function formatProblems(format: FinalFormat, poolSizes: number[]): string[] {
  if (format === 'none') return [];
  const teams = poolSizes.reduce((sum, size) => sum + size, 0);
  if (poolSizes.length < 2) return ['Il faut au moins deux poules pour croiser les équipes.'];
  if (format === 'rank' && teams % 2) return [`Nombre d’équipes pair requis (${teams} actuellement).`];
  if (format === 'cross' && teams % 4) return [`Nombre d’équipes multiple de 4 requis (${teams} actuellement).`];
  if (format === 'bracket' && !powerOfTwo(teams)) return [`Nombre d’équipes égal à 4, 8, 16 ou 32 requis (${teams} actuellement).`];
  return [];
}

/** Avertissement d’équité : avec des poules inégales, toutes les équipes ne jouent pas le même nombre de matchs. */
export function fairnessWarning(poolSizes: number[]) {
  return new Set(poolSizes).size > 1 ? 'Les poules n’ont pas toutes la même taille : certaines équipes joueront plus de matchs de poule que d’autres.' : null;
}

/**
 * Classement général à l’issue des poules : tous les premiers, puis tous les deuxièmes…
 * À rang égal, la meilleure performance passe devant, ramenée au nombre de matchs joués
 * (points, puis différence, puis scores marqués), enfin l’identifiant d’équipe pour un ordre stable.
 */
export function overallSeeding(tables: StandingRow[][]): string[] {
  const perMatch = (value: number, played: number) => played ? value / played : 0;
  return tables.flat().sort((a, b) => a.position - b.position
    || perMatch(b.points, b.played) - perMatch(a.points, a.played)
    || perMatch(b.scoreDifference, b.played) - perMatch(a.scoreDifference, a.played)
    || perMatch(b.scoresFor, b.played) - perMatch(a.scoresFor, a.played)
    || a.team.localeCompare(b.team)).map((row) => row.team);
}

/** Ordre des têtes de série dans un tableau : [1, 4, 2, 3] pour 4, [1, 8, 4, 5, 2, 7, 3, 6] pour 8. */
export function bracketPositions(size: number): number[] {
  let positions = [1];
  while (positions.length < size) {
    const next = positions.length * 2 + 1;
    positions = positions.flatMap((seed) => [seed, next - seed]);
  }
  return positions;
}

export type PlacementPairing = { round: number; placeFrom: number; placeTo: number; slot: number; home: string; away: string };

/** Premier tour : chaque bloc de têtes de série consécutives forme un tableau ; la meilleure tête de série reçoit. */
export function firstRound(seeds: string[], size: number): PlacementPairing[] {
  const pairings: PlacementPairing[] = [];
  const positions = bracketPositions(size);
  for (let start = 0; start < seeds.length; start += size) {
    const block = positions.map((seed) => seeds[start + seed - 1]);
    for (let slot = 0; slot < size / 2; slot++) pairings.push({ round: 1, placeFrom: start + 1, placeTo: start + size, slot, home: block[slot * 2], away: block[slot * 2 + 1] });
  }
  return pairings;
}

export type PlayedPairing = PlacementPairing & { winner: string; loser: string };

/**
 * Tour suivant : dans chaque bloc de plus de deux places, les gagnants (dans l’ordre des matchs) se disputent
 * la moitié haute, les perdants la moitié basse ; le gagnant du match i rencontre celui du match i+1.
 */
export function nextRound(played: PlayedPairing[]): PlacementPairing[] {
  const pairings: PlacementPairing[] = [];
  const blocks = new Map<number, PlayedPairing[]>();
  for (const match of played) if (match.placeTo - match.placeFrom > 1) (blocks.get(match.placeFrom) ?? blocks.set(match.placeFrom, []).get(match.placeFrom)!).push(match);
  for (const matches of [...blocks.values()].sort((a, b) => a[0].placeFrom - b[0].placeFrom)) {
    const ordered = [...matches].sort((a, b) => a.slot - b.slot);
    const { placeFrom, placeTo, round } = ordered[0];
    const half = (placeTo - placeFrom + 1) / 2;
    for (const [teams, from] of [[ordered.map((m) => m.winner), placeFrom], [ordered.map((m) => m.loser), placeFrom + half]] as const) {
      for (let slot = 0; slot < teams.length / 2; slot++) pairings.push({ round: round + 1, placeFrom: from, placeTo: from + half - 1, slot, home: teams[slot * 2], away: teams[slot * 2 + 1] });
    }
  }
  return pairings;
}

/** Classement final, disponible quand chaque place est fixée par un match à deux équipes joué. */
export function finalRanking(played: PlayedPairing[], teamCount: number): string[] | null {
  const places: string[] = [];
  for (const match of played) if (match.placeTo - match.placeFrom === 1) { places[match.placeFrom - 1] = match.winner; places[match.placeTo - 1] = match.loser; }
  return places.filter(Boolean).length === teamCount ? places : null;
}

/** Libellé d’un match de classement : « Finale », « Places 3 et 4 », « Places 1 à 4 · tour 1 ». */
export function placementLabel(placeFrom: number, placeTo: number) {
  if (placeTo - placeFrom === 1) return placeFrom === 1 ? 'Finale' : `Places ${placeFrom} et ${placeTo}`;
  if (placeFrom === 1 && placeTo === 4) return 'Demi-finale';
  if (placeFrom === 1 && placeTo === 8) return 'Quart de finale';
  return `Places ${placeFrom} à ${placeTo}`;
}

export type ProvisionalRow = { team: string; placeFrom: number; placeTo: number };

/**
 * Classement du tournoi pendant la phase de classement : chaque équipe connaît la plage de places
 * qu’elle dispute encore. Départ : les blocs du classement général ; à chaque match joué, le gagnant
 * garde la moitié haute du bloc, le perdant la moitié basse. À plage égale, l’ordre du classement général.
 */
export function provisionalRanking(seeds: string[], size: number, played: PlayedPairing[]): ProvisionalRow[] {
  const rows = new Map(seeds.map((team, index) => {
    const from = Math.floor(index / size) * size + 1;
    return [team, { team, placeFrom: from, placeTo: from + size - 1 }];
  }));
  for (const match of [...played].sort((a, b) => a.round - b.round)) {
    const half = (match.placeTo - match.placeFrom + 1) / 2;
    rows.set(match.winner, { team: match.winner, placeFrom: match.placeFrom, placeTo: match.placeFrom + half - 1 });
    rows.set(match.loser, { team: match.loser, placeFrom: match.placeFrom + half, placeTo: match.placeTo });
  }
  const seedOrder = new Map(seeds.map((team, index) => [team, index]));
  return [...rows.values()].sort((a, b) => a.placeFrom - b.placeFrom || seedOrder.get(a.team)! - seedOrder.get(b.team)!);
}
