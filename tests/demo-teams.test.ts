import test from 'node:test';
import assert from 'node:assert/strict';
import { demoTeamNames, demoTeams } from '../src/lib/tournaments/demo-teams';

const seeded = (seed: number) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

test('équipes de test : noms distincts, jamais pris, au besoin avec une couleur', () => {
  const names = demoTeamNames(40, ['Les Renards'], seeded(3));
  assert.equal(names.length, 40);
  assert.equal(new Set(names).size, 40);
  assert(!names.includes('Les Renards'));
  assert(names.slice(0, 31).every((name) => /^Les \S+$/.test(name)), 'd’abord les noms simples');
  assert(names.some((name) => / (rouges|bleus|verts|noirs|dorés|blancs|bleues|rouges)$/.test(name)));
  assert.notDeepEqual(demoTeamNames(8, [], seeded(1)), demoTeamNames(8, [], seeded(2)), 'tirage aléatoire');
});

test('équipes de test : identifiants de lien uniques face aux équipes existantes', () => {
  const teams = demoTeams(64, [{ name: 'Lions', slug: 'les-lions' }], seeded(5));
  assert.equal(teams.length, 64);
  assert.equal(new Set(teams.map((team) => team.slug)).size, 64);
  assert(!teams.some((team) => team.slug === 'les-lions'));
  assert(teams.every((team) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(team.slug)));
});
