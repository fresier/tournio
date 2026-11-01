import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDuration, formatDuration } from '../src/lib/domain/estimate';

const pools = [{ id: 'A', teams: ['a1', 'a2', 'a3', 'a4'] }, { id: 'B', teams: ['b1', 'b2', 'b3', 'b4'] }];
const rules = { matchMinutes: 20, transitionMinutes: 5, restMinutes: 10 };

test('poules : 3 tours de 4 matchs simultanés sur 4 terrains, repos compris', () => {
  // Tours de poule à 0, 30 (20 + 10 de repos) et 60 min : fin à 80 min.
  assert.equal(estimateDuration(pools, 4, rules, 'none')?.totalMinutes, 80);
});

test('phase de classement : chaque tour fait jouer toutes les équipes, après repos', () => {
  const tour = 10 + 20; // repos puis un match pour les 4 rencontres sur 4 terrains
  assert.deepEqual([estimateDuration(pools, 4, rules, 'rank')?.totalMinutes, estimateDuration(pools, 4, rules, 'cross')?.totalMinutes, estimateDuration(pools, 4, rules, 'bracket')?.totalMinutes],
    [80 + tour, 80 + 2 * tour, 80 + 3 * tour]);
  const twoCourts = estimateDuration(pools, 2, rules, 'cross')!;
  assert.equal(twoCourts.placementMinutes, 2 * (10 + 20 + 5 + 20), 'moins de terrains : deux vagues par tour');
  assert.equal(twoCourts.placementMatches, 8);
  assert(twoCourts.poolMinutes > 80);
});

test('estimation impossible sans terrain ni poule valide ; format impossible sans phase de classement', () => {
  assert.equal(estimateDuration(pools, 0, rules, 'none'), null);
  assert.equal(estimateDuration([{ id: 'A', teams: ['a1'] }], 2, rules, 'none'), null);
  assert.equal(estimateDuration([...pools, { id: 'C', teams: ['c1', 'c2', 'c3', 'c4'] }], 4, rules, 'bracket')?.placementMinutes, 0);
  assert.deepEqual([formatDuration(45), formatDuration(180), formatDuration(190)], ['45 min', '3 h', '3 h 10']);
});

test('pause entre les tours : remplace le repos quand elle est plus longue', () => {
  const tour = (gap: number) => gap + 20;
  assert.equal(estimateDuration(pools, 4, rules, 'cross', 30)?.placementMinutes, 2 * tour(30));
  assert.equal(estimateDuration(pools, 4, rules, 'cross', 5)?.placementMinutes, 2 * tour(10), 'plus courte que le repos minimal : le repos s’applique');
  assert.equal(estimateDuration(pools, 4, rules, 'none', 30)?.totalMinutes, 80, 'sans phase de classement, pas de pause');
});
