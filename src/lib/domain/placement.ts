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
export function formatProblems(format: FinalFormat, poolSizes: number[], allowIncomplete = false): string[] {
  if (format === 'none') return [];
  const teams = poolSizes.reduce((sum, size) => sum + size, 0);
  if (poolSizes.length < 2) return ['Il faut au moins deux poules pour croiser les équipes.'];
  if (teams < 2) return ['Il faut au moins deux équipes.'];
  // Groupe incomplet autorisé : les dernières équipes du classement général jouent un match de moins.
  if (format === 'rank' && teams % 2 && !allowIncomplete) return [`Nombre d’équipes pair requis (${teams} actuellement), ou autorisez un groupe incomplet.`];
  if (format === 'cross' && teams % 4 && !allowIncomplete) return [`Nombre d’équipes multiple de 4 requis (${teams} actuellement), ou autorisez un groupe incomplet.`];
  if (format === 'bracket' && !powerOfTwo(teams)) return [`Nombre d’équipes égal à 4, 8, 16 ou 32 requis (${teams} actuellement).`];
  return [];
}

/**
 * Découpage des équipes (dans l’ordre du classement général) en groupes de la phase de classement.
 * Objectif : chaque équipe joue le même nombre de matchs. Les groupes de 3 jouent un mini-championnat
 * (2 matchs chacune, comme un groupe de 4 en deux tours) ; une paire en « aller-retour » joue 2 fois.
 * - 4 places (tableau croisé), 2 places (un match par rang), ou toutes (tableau complet) ;
 * - reste du croisé : 3 → un groupe de 3 ; 2 → les 6 dernières en 2 groupes de 3 ; 1 → les 9 dernières en 3 groupes de 3
 *   (5 équipes : un groupe de 3 et un aller-retour ; 2 équipes : un aller-retour) ;
 * - nombre impair en « un match par rang » : les 3 dernières en mini-championnat (2 matchs au lieu de 1 : personne ne joue moins).
 */
export type PlacementGroup = { from: number; size: number; kind: 'block' | 'triangle' | 'double' | 'single' };
export function placementGroups(format: FinalFormat, teams: number): PlacementGroup[] {
  const groups: PlacementGroup[] = [];
  const push = (size: number, kind: PlacementGroup['kind']) => groups.push({ from: groups.reduce((sum, group) => sum + group.size, 0) + 1, size, kind });
  if (format === 'bracket') { push(teams, 'block'); return groups; }
  if (format === 'rank') {
    const triangle = teams % 2 && teams >= 3;
    for (let i = 0; i < Math.floor((teams - (triangle ? 3 : 0)) / 2); i++) push(2, 'single');
    if (triangle) push(3, 'triangle');
    return groups;
  }
  if (format !== 'cross') return groups;
  const rest = teams % 4;
  const tail = rest === 0 ? [] : rest === 3 ? [3] : rest === 2 ? (teams >= 6 ? [3, 3] : [2]) : (teams >= 9 ? [3, 3, 3] : teams === 5 ? [3, 2] : []);
  const fours = (teams - tail.reduce((sum, size) => sum + size, 0)) / 4;
  for (let i = 0; i < fours; i++) push(4, 'block');
  for (const size of tail) push(size, size === 3 ? 'triangle' : 'double');
  return groups;
}

/** Annonce d’organisation quand tous les groupes ne sont pas des groupes complets, ou null. */
export function incompleteNote(format: FinalFormat, teams: number): string | null {
  const groups = placementGroups(format, teams).filter((group) => group.kind === 'triangle' || group.kind === 'double');
  if (!groups.length) return null;
  const first = groups[0].from;
  const triangles = groups.filter((group) => group.kind === 'triangle').length;
  const double = groups.some((group) => group.kind === 'double');
  const parts = [triangles ? `${triangles > 1 ? `${triangles} groupes` : '1 groupe'} de 3 en mini-championnat` : '', double ? 'les 2 dernières en aller-retour' : ''].filter(Boolean).join(' et ');
  return format === 'rank'
    ? `Les 3 dernières (places ${first} à ${teams}) jouent un mini-championnat : 2 matchs au lieu de 1, personne ne joue moins.`
    : `Places ${first} à ${teams} : ${parts}. Chaque équipe joue 2 matchs, comme les autres.`;
}

/** Nombre de matchs de chaque tour de classement. */
export function roundMatchCounts(format: FinalFormat, teams: number): number[] {
  if (format === 'bracket') return Array.from({ length: extraMatches(format, teams) }, () => teams / 2);
  const groups = placementGroups(format, teams);
  if (!groups.length) return [];
  const first = groups.reduce((sum, group) => sum + (group.kind === 'block' ? group.size / 2 : group.kind === 'triangle' ? 3 : group.kind === 'double' ? 2 : 1), 0);
  return format === 'cross' ? [first, groups.filter((group) => group.kind === 'block').length * 2] : [first];
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
  const format: FinalFormat = size === 2 ? 'rank' : size === 4 && seeds.length !== 4 ? 'cross' : size === seeds.length ? 'bracket' : 'cross';
  const pairings: PlacementPairing[] = [];
  for (const group of placementGroups(format, seeds.length)) {
    const start = group.from - 1;
    const team = (index: number) => seeds[start + index];
    if (group.kind === 'block') {
      const positions = bracketPositions(group.size);
      for (let slot = 0; slot < group.size / 2; slot++) pairings.push({ round: 1, placeFrom: group.from, placeTo: group.from + group.size - 1, slot, home: team(positions[slot * 2] - 1), away: team(positions[slot * 2 + 1] - 1) });
    } else if (group.kind === 'single') {
      pairings.push({ round: 1, placeFrom: group.from, placeTo: group.from + 1, slot: 0, home: team(0), away: team(1) });
    } else if (group.kind === 'triangle') {
      // Mini-championnat : les 3 matchs dès le tour 1 (aucun ne dépend d’un résultat).
      [[1, 2], [0, 2], [0, 1]].forEach(([a, b], slot) => pairings.push({ round: 1, placeFrom: group.from, placeTo: group.from + 2, slot, home: team(a), away: team(b) }));
    } else {
      // Aller-retour : deux matchs entre les deux mêmes équipes, chacune reçoit une fois.
      pairings.push({ round: 1, placeFrom: group.from, placeTo: group.from + 1, slot: 0, home: team(0), away: team(1) });
      pairings.push({ round: 1, placeFrom: group.from, placeTo: group.from + 1, slot: 1, home: team(1), away: team(0) });
    }
  }
  return pairings;
}export type PlayedPairing = PlacementPairing & { winner: string; loser: string; homeScore?: number; awayScore?: number };

/**
 * Mini-championnat (groupe de 3, ou aller-retour à 2) : classement du groupe une fois tous ses matchs joués
 * (victoires, puis différence de points, puis points marqués, enfin classement général), sinon null.
 */
export function miniOrder(group: PlayedPairing[], seeds: string[]): string[] | null {
  if (!group.length) return null;
  const teams = seeds.slice(group[0].placeFrom - 1, group[0].placeTo);
  const expected = teams.length === 3 ? 3 : 2;
  if (group.length < expected) return null;
  const stats = new Map(teams.map((team) => [team, { wins: 0, diff: 0, scored: 0 }]));
  for (const match of group) {
    const home = stats.get(match.home); const away = stats.get(match.away);
    if (!home || !away) return null;
    stats.get(match.winner)!.wins++;
    const hs = match.homeScore ?? 0; const as = match.awayScore ?? 0;
    home.diff += hs - as; away.diff += as - hs; home.scored += hs; away.scored += as;
  }
  const rank = new Map(seeds.map((team, index) => [team, index]));
  return [...teams].sort((x, y) => {
    const a = stats.get(x)!; const b = stats.get(y)!;
    return b.wins - a.wins || b.diff - a.diff || b.scored - a.scored || rank.get(x)! - rank.get(y)!;
  });
}
/** Compatibilité : mini-championnat à 3. */
export const triangularOrder = miniOrder;
/**
 * Tour suivant : dans chaque bloc de plus de deux places, les gagnants (dans l’ordre des matchs) se disputent
 * la moitié haute, les perdants la moitié basse ; le gagnant du match i rencontre celui du match i+1.
 */
export function nextRound(played: PlayedPairing[]): PlacementPairing[] {
  const pairings: PlacementPairing[] = [];
  const blocks = new Map<number, PlayedPairing[]>();
  const span = (match: PlacementPairing) => match.placeTo - match.placeFrom + 1;
  for (const match of played) if (span(match) > 2 && powerOfTwo(span(match))) (blocks.get(match.placeFrom) ?? blocks.set(match.placeFrom, []).get(match.placeFrom)!).push(match);
  for (const matches of [...blocks.values()].sort((a, b) => a[0].placeFrom - b[0].placeFrom)) {
    const ordered = [...matches].sort((a, b) => a.slot - b.slot);
    const { placeFrom, placeTo, round } = ordered[0];
    const half = (placeTo - placeFrom + 1) / 2;
    for (const [teams, from] of [[ordered.map((m) => m.winner), placeFrom], [ordered.map((m) => m.loser), placeFrom + half]] as const) {
      for (let slot = 0; slot < teams.length / 2; slot++) pairings.push({ round: round + 1, placeFrom: from, placeTo: from + half - 1, slot, home: teams[slot * 2], away: teams[slot * 2 + 1] });
    }
  }
  return pairings.sort((a, b) => a.placeFrom - b.placeFrom || a.slot - b.slot);
}
/** Classement final, disponible quand chaque place est fixée par un match à deux équipes joué. */
export function finalRanking(played: PlayedPairing[], teamCount: number, seeds: string[] = [], size = 0): string[] | null {
  const places: string[] = [];
  const minis = miniGroups(played, size);
  for (const match of [...played].sort((a, b) => a.round - b.round)) {
    if (match.placeTo - match.placeFrom === 1 && !minis.has(match.placeFrom)) { places[match.placeFrom - 1] = match.winner; places[match.placeTo - 1] = match.loser; }
  }
  // Mini-championnats (groupes de 3, aller-retour) : places fixées une fois tous leurs matchs joués.
  for (const group of minis.values()) miniOrder(group, seeds)?.forEach((team, index) => { places[group[0].placeFrom - 1 + index] = team; });
  return places.filter(Boolean).length === teamCount ? places : null;
}/** Libellé d’un match de classement : « Finale », « Places 3 et 4 », « Places 1 à 4 · tour 1 ». */
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
  const format: FinalFormat = size === 2 ? 'rank' : size === seeds.length && size !== 4 ? 'bracket' : 'cross';
  const rows = new Map<string, ProvisionalRow>();
  for (const group of placementGroups(format, seeds.length)) for (let i = 0; i < group.size; i++) {
    const team = seeds[group.from - 1 + i];
    rows.set(team, { team, placeFrom: group.from, placeTo: group.from + group.size - 1 });
  }
  const minis = miniGroups(played, size);
  for (const match of [...played].sort((a, b) => a.round - b.round)) {
    if (minis.has(match.placeFrom) && match.round === 1) continue; // mini-championnat : plage inchangée jusqu’à son dernier match
    const half = (match.placeTo - match.placeFrom + 1) / 2;
    rows.set(match.winner, { team: match.winner, placeFrom: match.placeFrom, placeTo: match.placeFrom + half - 1 });
    rows.set(match.loser, { team: match.loser, placeFrom: match.placeFrom + half, placeTo: match.placeTo });
  }
  for (const group of minis.values()) miniOrder(group, seeds)?.forEach((team, index) => { const place = group[0].placeFrom + index; rows.set(team, { team, placeFrom: place, placeTo: place }); });
  const seedOrder = new Map(seeds.map((team, index) => [team, index]));
  return [...rows.values()].sort((a, b) => a.placeFrom - b.placeFrom || seedOrder.get(a.team)! - seedOrder.get(b.team)!);
}/**
 * Matchs joués des mini-championnats, par groupe : les groupes de 3 (3 places), et les aller-retour
 * (2 places au tour 1 du tableau croisé, où les groupes complets ont 4 places).
 */
function miniGroups(played: PlayedPairing[], size: number) {
  const groups = new Map<number, PlayedPairing[]>();
  for (const match of played) {
    const span = match.placeTo - match.placeFrom + 1;
    if (span === 3 || (span === 2 && size === 4 && match.round === 1)) (groups.get(match.placeFrom) ?? groups.set(match.placeFrom, []).get(match.placeFrom)!).push(match);
  }
  return groups;
}
