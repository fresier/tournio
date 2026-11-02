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

test('groupe incomplet : chaque équipe joue le même nombre de matchs, quel que soit le nombre d’équipes', async () => {
  const { formatProblems, incompleteNote, roundMatchCounts, provisionalRanking, placementGroups, miniOrder } = await import('../src/lib/domain/placement');
  assert.match(formatProblems('cross', [4, 3])[0], /multiple de 4/);
  assert.deepEqual(formatProblems('cross', [4, 3], true), []);
  assert.deepEqual(formatProblems('rank', [3, 2], true), []);
  assert.match(formatProblems('bracket', [4, 3], true)[0], /4, 8, 16/, 'jamais pour le tableau complet');
  assert.equal(incompleteNote('cross', 8), null);
  assert.match(incompleteNote('cross', 34)!, /Places 29 à 34 : 2 groupes de 3/);
  assert.match(incompleteNote('cross', 33)!, /Places 25 à 33 : 3 groupes de 3/);
  assert.match(incompleteNote('cross', 5)!, /1 groupe de 3 en mini-championnat et les 2 dernières en aller-retour/);
  assert.match(incompleteNote('rank', 7)!, /places 5 à 7/);
  assert.deepEqual(placementGroups('cross', 34).map((g) => `${g.kind}:${g.size}`).slice(-3), ['block:4', 'triangle:3', 'triangle:3']);

  /** Phase de classement jouée en entier (l’équipe qui reçoit gagne), sur `n` équipes. */
  const run = (n: number, format: 'rank' | 'cross') => {
    const seedsN = Array.from({ length: n }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
    const size = format === 'rank' ? 2 : 4;
    const scored = (pairings: PlacementPairing[]) => play(pairings).map((m) => ({ ...m, homeScore: 21, awayScore: 15 }));
    const p1 = scored(firstRound(seedsN, size));
    const p2 = format === 'cross' ? scored(nextRound(p1)) : [];
    const all = [...p1, ...p2];
    const count = (team: string) => all.filter((m) => m.home === team || m.away === team).length;
    assert.deepEqual(roundMatchCounts(format, n), format === 'cross' ? [p1.length, p2.length] : [p1.length], `${n} : matchs par tour`);
    return { ranking: finalRanking(all, n, seedsN, size), count, seedsN, after1: provisionalRanking(seedsN, size, p1) };
  };
  for (let n = 2; n <= 40; n++) {
    if (n === 3) continue;
    const { ranking, count, seedsN } = run(n, 'cross');
    assert.equal(ranking?.length, n, `${n} équipes : classement complet`);
    assert.equal(new Set(ranking).size, n, `${n} équipes : chaque place une seule fois`);
    assert(seedsN.every((team) => count(team) === 2), `${n} équipes : chacune joue 2 matchs (${seedsN.map(count).join(',')})`);
  }
  for (const n of [5, 7, 9, 13]) {
    const { ranking, count, seedsN } = run(n, 'rank');
    assert.equal(new Set(ranking).size, n);
    assert(seedsN.every((team) => count(team) >= 1), `${n} : personne ne joue moins de 1 match`);
    assert.deepEqual(seedsN.slice(-3).map(count), [2, 2, 2], `${n} : les 3 dernières en mini-championnat`);
  }
  // Pendant le mini-championnat, la plage reste ouverte ; à la fin, places exactes.
  const seven = run(7, 'cross');
  assert.deepEqual(seven.after1.slice(4).map((row) => `${row.team} ${row.placeFrom}-${row.placeTo}`), ['S05 5-5', 'S06 6-6', 'S07 7-7']);
  // Départage d’un mini-championnat : victoires, puis différence de points.
  const tri = (home: string, away: string, hs: number, as: number) => ({ round: 1, placeFrom: 1, placeTo: 3, slot: 0, home, away, homeScore: hs, awayScore: as, winner: hs > as ? home : away, loser: hs > as ? away : home });
  assert.deepEqual(miniOrder([tri('A', 'B', 21, 10), tri('B', 'C', 21, 19), tri('C', 'A', 21, 15)], ['A', 'B', 'C']), ['A', 'C', 'B'], 'une victoire chacune : A (+5), C (+4), B (−9)');
  assert.equal(miniOrder([tri('A', 'B', 21, 10)], ['A', 'B', 'C']), null, 'pas de classement avant les 3 matchs');
  // Aller-retour (5 équipes en croisé) : une victoire chacun, départage à la différence.
  const leg = (home: string, away: string, hs: number, as: number) => ({ ...tri(home, away, hs, as), placeFrom: 4, placeTo: 5 });
  assert.deepEqual(miniOrder([leg('D', 'E', 21, 19), leg('E', 'D', 21, 12)], ['A', 'B', 'C', 'D', 'E']), ['E', 'D']);
  assert.equal(miniOrder([leg('D', 'E', 21, 19)], ['A', 'B', 'C', 'D', 'E']), null, 'attend le match retour');
});
