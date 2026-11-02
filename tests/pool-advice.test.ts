import test from 'node:test';
import assert from 'node:assert/strict';
import { balancedSizes, poolAdvice, poolOptions } from '../src/lib/domain/pool-advice';

const rules = { matchMinutes: 30, transitionMinutes: 5, restMinutes: 15 };

test('répartition au plus juste', () => {
  assert.deepEqual(balancedSizes(34, 4), [9, 9, 8, 8]);
  assert.deepEqual(balancedSizes(12, 3), [4, 4, 4]);
});

test('options : plus de poules, moins de matchs et un tournoi plus court', () => {
  const options = poolOptions({ teams: 34, courts: 4, rules, format: 'cross', allowIncomplete: true, availableMinutes: 9 * 60 });
  assert(options.length > 5);
  for (let i = 1; i < options.length; i++) {
    assert(options[i].matchesPerTeam[1] <= options[i - 1].matchesPerTeam[1], 'moins de matchs par équipe');
    assert(options[i].totalMinutes <= options[i - 1].totalMinutes + 30, 'durée qui baisse (à un créneau près)');
  }
  const eight = options.find((option) => option.pools === 8)!;
  assert.deepEqual([eight.smallest, eight.largest, ...eight.matchesPerTeam], [4, 5, 5, 6]);
});

test('conseil : ajouter des poules si ça dépasse, en enlever s’il reste de la marge', () => {
  const available = 12 * 60; // 34 équipes, 4 terrains, matchs de 30 min : 9 h ne suffisent jamais, 12 h oui à partir de 10 poules
  const options = poolOptions({ teams: 34, courts: 4, rules, format: 'cross', allowIncomplete: true, availableMinutes: available });
  const four = options.find((option) => option.pools === 4)!;
  const add = poolAdvice(options, 4, four.totalMinutes, available);
  assert.equal(add.kind, 'add');
  if (add.kind === 'add') { assert(add.option.pools > 4 && add.option.fits); assert(!options.some((o) => o.pools > 4 && o.pools < add.option.pools && o.fits), 'le plus petit ajout qui tient'); }
  const sixteen = options.at(-1)!;
  const remove = poolAdvice(options, sixteen.pools, sixteen.totalMinutes, available);
  assert.equal(remove.kind, 'remove');
  assert.equal(poolAdvice(options, 4, four.totalMinutes, 60).kind, 'impossible', 'une heure ne suffit jamais');
  if (add.kind === 'add') assert.equal(add.option.pools, 10, '10 poules tiennent en 715 min');
  if (remove.kind === 'remove') assert.equal(remove.option.pools, 10, 'enlever des poules tant que ça tient, sans descendre sous 3 équipes par poule');
});
