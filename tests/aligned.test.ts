import test from 'node:test';
import assert from 'node:assert/strict';
import { alignedStep, onGrid, placeMatches, validateSchedule } from '../src/lib/domain/schedule';
import { poolMatches } from '../src/lib/domain/round-robin';
import { estimateDuration } from '../src/lib/domain/estimate';

const MINUTE = 60_000;
const rules = { matchMinutes: 30, transitionMinutes: 5, restMinutes: 15 };
const pools = [{ id: 'A', teams: ['a1', 'a2', 'a3', 'a4'] }, { id: 'B', teams: ['b1', 'b2', 'b3', 'b4'] }];
const courts = [0, 1, 2].map((index) => ({ id: `T${index}`, availabilities: [{ start: 0, end: 24 * 60 * MINUTE }] }));

test('grille : pas = match + plus long délai ; arrondi au créneau suivant', () => {
  assert.equal(alignedStep(rules), 45);
  const grid = { anchor: 0, stepMinutes: 45 };
  assert.deepEqual([onGrid(0, grid), onGrid(1, grid), onGrid(45 * MINUTE, grid), onGrid(50 * MINUTE, grid)], [0, 45 * MINUTE, 45 * MINUTE, 90 * MINUTE]);
  assert.equal(onGrid(7, undefined), 7);
});

test('horaires alignés : tous les matchs démarrent sur la grille, calendrier valide', () => {
  const grid = { anchor: 0, stepMinutes: alignedStep(rules) };
  const result = placeMatches({ matches: poolMatches(pools), courts, rules: { ...rules, grid } });
  assert.equal(result.status, 'scheduled');
  if (result.status !== 'scheduled') return;
  assert(result.matches.every((match) => match.start % (45 * MINUTE) === 0), 'départs toutes les 45 min');
  const starts = [...new Set(result.matches.map((match) => match.start / MINUTE))].sort((a, b) => a - b);
  assert.deepEqual(starts.slice(0, 3), [0, 45, 90]);
  const violations = validateSchedule(result.matches.map((match) => ({ key: match.key, home: match.home, away: match.away, group: match.poolId, courtId: match.courtId, start: match.start, end: match.end })), courts, rules);
  assert.deepEqual(violations, []);
  // Une équipe peut jouer deux créneaux consécutifs : 45 − 30 = 15 min de repos.
  const a1 = result.matches.filter((match) => match.home === 'a1' || match.away === 'a1').map((match) => match.start / MINUTE).sort((x, y) => x - y);
  assert(a1.some((start, index) => index > 0 && start - a1[index - 1] === 45), 'deux créneaux consécutifs possibles');
});

test('estimation : horaires alignés jamais plus courts, phase de classement sur la grille', () => {
  const free = estimateDuration(pools, 3, rules, 'cross')!;
  const aligned = estimateDuration(pools, 3, rules, 'cross', 0, true)!;
  assert(aligned.totalMinutes >= free.totalMinutes);
  assert.equal(aligned.poolMinutes % 45, 30, 'fin des poules : un départ de grille + 30 min');
  assert.equal(aligned.totalMinutes % 45, 30, 'fin du tournoi : un départ de grille + 30 min');
});
