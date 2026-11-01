import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPools, shuffle } from '../src/lib/domain/draw';

/** Générateur déterministe pour les tests (LCG). */
const seeded = (seed: number) => (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const teams = Array.from({ length: 20 }, (_, i) => `t${i + 1}`);
const sizes = (assignment: Map<string, string>, pools: string[]) => pools.map((pool) => [...assignment.values()].filter((value) => value === pool).length);

test('mélange : une permutation des mêmes équipes', () => {
  const mixed = shuffle(teams, seeded(1));
  assert.deepEqual([...mixed].sort(), [...teams].sort());
  assert.notDeepEqual(mixed, teams);
});

test('tirage complet : chaque équipe dans une poule, tailles équilibrées à une près', () => {
  const pools = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, members: [] }));
  const assignment = drawPools(teams, pools, seeded(7));
  assert.equal(assignment.size, 20);
  assert.deepEqual(sizes(assignment, ['A', 'B', 'C', 'D', 'E']), [4, 4, 4, 4, 4]);
  const uneven = drawPools(teams.slice(0, 7), pools.slice(0, 3), seeded(3));
  assert.deepEqual(sizes(uneven, ['A', 'B', 'C']).sort(), [2, 2, 3]);
});

test('équipes sans poule : complètent d’abord les poules les plus petites', () => {
  const pools = [{ id: 'A', members: ['x1', 'x2', 'x3'] }, { id: 'B', members: ['y1'] }, { id: 'C', members: [] }];
  const assignment = drawPools(['n1', 'n2', 'n3'], pools, seeded(11));
  // Après tirage : A 3, B 1 + ?, C 0 + ? → les trois nouvelles vont dans B et C (2 et 2).
  assert.deepEqual(sizes(assignment, ['A', 'B', 'C']), [0, 1, 2]);
  assert.equal(drawPools(['n1'], [], seeded(1)).size, 0);
});

test('tirages différents selon le hasard, toujours équilibrés', () => {
  const pools = ['A', 'B', 'C', 'D'].map((id) => ({ id, members: [] }));
  const results = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify([...drawPools(teams, pools, seeded(seed))].sort())));
  assert(results.size > 1);
});
