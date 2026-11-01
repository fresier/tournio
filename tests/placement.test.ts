import test from 'node:test';
import assert from 'node:assert/strict';
import { bracketPositions, extraMatches, finalRanking, firstRound, formatProblems, nextRound, overallSeeding, placementLabel, type PlacementPairing, type PlayedPairing } from '../src/lib/domain/placement';
import type { StandingRow } from '../src/lib/domain/standings';

const row = (team: string, position: number, points: number, played = 3, diff = 0, scoresFor = 0): StandingRow =>
  ({ team, position, played, won: 0, drawn: 0, lost: 0, scoresFor, scoresAgainst: 0, scoreDifference: diff, points });
// Deux poules de 4 : A meilleure que B à chaque rang (points), sauf au rang 2 départagé par la différence.
const poolA = [row('A1', 1, 9), row('A2', 2, 6, 3, 5), row('A3', 3, 3), row('A4', 4, 0)];
const poolB = [row('B1', 1, 7), row('B2', 2, 6, 3, 2), row('B3', 3, 1), row('B4', 4, 0, 3, -9)];
const seeds = overallSeeding([poolA, poolB]);
/** Joue un tour en faisant gagner l’équipe à domicile (la mieux classée). */
const play = (pairings: PlacementPairing[]): PlayedPairing[] => pairings.map((p) => ({ ...p, winner: p.home, loser: p.away }));

test('classement général : par rang de poule, puis performance par match', () => {
  assert.deepEqual(seeds, ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']);
  // Poules inégales : la moyenne par match compte, pas le total.
  assert.deepEqual(overallSeeding([[row('X', 1, 9, 3)], [row('Y', 1, 10, 4)]]), ['X', 'Y']);
});

test('formats possibles selon le nombre d’équipes et de poules', () => {
  assert.deepEqual(formatProblems('rank', [4, 4]), []);
  assert.deepEqual(formatProblems('cross', [4, 4, 4]), []);
  assert.match(formatProblems('bracket', [4, 4, 4])[0], /4, 8, 16/);
  assert.match(formatProblems('rank', [3, 4])[0], /pair/);
  assert.match(formatProblems('cross', [6])[0], /deux poules/);
  assert.deepEqual([extraMatches('rank', 8), extraMatches('cross', 8), extraMatches('bracket', 8), extraMatches('none', 8)], [1, 2, 3, 0]);
  assert.deepEqual(bracketPositions(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('un match par rang : 1A–1B, 2A–2B… chaque équipe joue une fois, toutes les places fixées', () => {
  const round = firstRound(seeds, 2);
  assert.deepEqual(round.map((p) => [p.home, p.away, p.placeFrom]), [['A1', 'B1', 1], ['A2', 'B2', 3], ['A3', 'B3', 5], ['A4', 'B4', 7]]);
  assert.deepEqual(nextRound(play(round)), []);
  assert.deepEqual(finalRanking(play(round), 8), ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']);
});

test('croisé en deux tours : 1A–2B et 1B–2A, puis finale et places 3-4 ; idem pour 5 à 8', () => {
  const round1 = firstRound(seeds, 4);
  assert.deepEqual(round1.map((p) => [p.home, p.away, `${p.placeFrom}-${p.placeTo}`]), [['A1', 'B2', '1-4'], ['B1', 'A2', '1-4'], ['A3', 'B4', '5-8'], ['B3', 'A4', '5-8']]);
  const played1 = play(round1).map((p) => p.home === 'B1' ? { ...p, winner: 'A2', loser: 'B1' } : p); // surprise : A2 bat B1
  const round2 = nextRound(played1);
  assert.deepEqual(round2.map((p) => [p.home, p.away, placementLabel(p.placeFrom, p.placeTo)]), [['A1', 'A2', 'Finale'], ['B2', 'B1', 'Places 3 et 4'], ['A3', 'B3', 'Places 5 et 6'], ['B4', 'A4', 'Places 7 et 8']]);
  assert.equal(finalRanking(played1, 8), null, 'pas de classement final avant le dernier tour');
  const final = finalRanking([...played1, ...play(round2)], 8);
  assert.deepEqual(final, ['A1', 'A2', 'B2', 'B1', 'A3', 'B3', 'B4', 'A4']);
  for (const team of seeds) assert.equal([...round1, ...round2].filter((p) => p.home === team || p.away === team).length, 2, `${team} joue deux matchs`);
});

test('tableau complet à 8 : trois tours, chaque équipe joue trois matchs, huit places', () => {
  const r1 = firstRound(seeds, 8);
  assert.deepEqual(r1.map((p) => [p.home, p.away]), [['A1', 'B4'], ['B2', 'A3'], ['B1', 'A4'], ['A2', 'B3']], 'têtes de série 1–8, 4–5, 2–7, 3–6');
  assert.equal(placementLabel(r1[0].placeFrom, r1[0].placeTo), 'Quart de finale');
  const r2 = nextRound(play(r1));
  assert.deepEqual(r2.map((p) => `${p.home}-${p.away} ${placementLabel(p.placeFrom, p.placeTo)}`), ['A1-B2 Demi-finale', 'B1-A2 Demi-finale', 'B4-A3 Places 5 à 8', 'A4-B3 Places 5 à 8']);
  const r3 = nextRound(play(r2));
  assert.equal(r3.length, 4);
  const ranking = finalRanking([...play(r1), ...play(r2), ...play(r3)], 8);
  assert.equal(ranking?.length, 8);
  assert.equal(new Set(ranking).size, 8);
  for (const team of seeds) assert.equal([...r1, ...r2, ...r3].filter((p) => p.home === team || p.away === team).length, 3);
});

test('classement du tournoi provisoire : plages de places qui se précisent à chaque tour', async () => {
  const { provisionalRanking } = await import('../src/lib/domain/placement');
  const round1 = firstRound(seeds, 4);
  const start = provisionalRanking(seeds, 4, []);
  assert.deepEqual(start.slice(0, 5).map((row) => `${row.team} ${row.placeFrom}-${row.placeTo}`), ['A1 1-4', 'B1 1-4', 'A2 1-4', 'B2 1-4', 'A3 5-8']);
  const played1 = play(round1);
  const after1 = provisionalRanking(seeds, 4, played1);
  assert.deepEqual(after1.slice(0, 4).map((row) => `${row.team} ${row.placeFrom}-${row.placeTo}`), ['A1 1-2', 'B1 1-2', 'A2 3-4', 'B2 3-4']);
  const done = provisionalRanking(seeds, 4, [...played1, ...play(nextRound(played1))]);
  assert(done.every((row) => row.placeFrom === row.placeTo), 'toutes les places définitives');
  assert.deepEqual(done.map((row) => row.team), finalRanking([...played1, ...play(nextRound(played1))], 8));
});
