import test from 'node:test';
import assert from 'node:assert/strict';
import { localToInstant, instantToLocal } from '../src/lib/tournaments/dates';
import { tournamentInputSchema, configurationCommandSchema } from '../src/lib/tournaments/contracts';

test('les horaires sont convertis dans le fuseau du tournoi', () => {
  assert.equal(localToInstant('2026-11-14T09:00','Europe/Brussels'),'2026-11-14T08:00:00Z');
  assert.equal(instantToLocal('2026-11-14T08:00:00Z','Europe/Brussels'),'2026-11-14T09:00');
});
test('une heure inexistante ou ambiguë exige une correction explicite', () => {
  assert.throws(() => localToInstant('2026-03-29T02:30','Europe/Brussels'));
  assert.throws(() => localToInstant('2026-10-25T02:30','Europe/Brussels'));
  assert.equal(localToInstant('2026-10-25T02:30','Europe/Brussels','+02:00'),'2026-10-25T00:30:00Z');
  assert.equal(localToInstant('2026-10-25T02:30','Europe/Brussels','+01:00'),'2026-10-25T01:30:00Z');
  assert.throws(() => localToInstant('2026-07-14T09:00','Europe/Brussels','+01:00'));
});
test('le contrat refuse un propriétaire fourni par le navigateur et des dates inversées', () => {
  const input = { name:'Tournoi test',slug:'tournoi-test',sport:'Multisport',location:'Bruxelles',timezone:'Europe/Brussels',starts_at:'2026-11-14T08:00:00Z',ends_at:'2026-11-14T17:00:00Z' };
  assert(tournamentInputSchema.safeParse(input).success);
  assert(!tournamentInputSchema.safeParse({...input,owner_id:crypto.randomUUID()}).success);
  assert(!tournamentInputSchema.safeParse({...input,ends_at:'2026-11-14T07:00:00Z'}).success);
  assert(!tournamentInputSchema.safeParse({...input,timezone:'Invalid/Timezone'}).success);
});
test('toute commande doit préciser une version valide et un payload strict', () => {
  assert(configurationCommandSchema.safeParse({operation:'create_team',expected_version:1,payload:{name:'Les Renards',slug:'les-renards'}}).success);
  assert(!configurationCommandSchema.safeParse({operation:'create_team',payload:{name:'Les Renards',slug:'les-renards'}}).success);
  assert(!configurationCommandSchema.safeParse({operation:'create_team',expected_version:1,payload:{name:'Les Renards',slug:'les-renards',tournament_id:crypto.randomUUID()}}).success);
});
test('les dates affichées sont identiques côté serveur et navigateur', async () => {
  const { formatTournamentDate, formatMatchTime, spansSeveralDays } = await import('../src/lib/tournaments/dates');
  assert.equal(formatTournamentDate('2026-11-01T17:00:00Z', 'Europe/Brussels'), '1 nov. 2026 à 18:00');
  assert.equal(formatTournamentDate('2026-07-14T07:05:00Z', 'Europe/Brussels'), '14 juil. 2026 à 09:05');
  assert.equal(formatMatchTime('2026-11-14T08:00:00Z', 'Europe/Brussels'), '09:00');
  assert.equal(formatMatchTime('2026-11-15T08:00:00Z', 'Europe/Brussels', true), 'dim. 15 · 09:00');
  assert.equal(spansSeveralDays('2026-11-14T08:00:00Z', '2026-11-14T22:30:00Z', 'Europe/Brussels'), false);
  assert.equal(spansSeveralDays('2026-11-14T08:00:00Z', '2026-11-14T23:30:00Z', 'Europe/Brussels'), true);
});

test('identifiant d’équipe généré depuis le nom, rendu unique par un suffixe', async () => {
  const { slugify, uniqueSlug } = await import('../src/lib/tournaments/contracts');
  assert.equal(uniqueSlug(slugify('Les Lions'), []), 'les-lions');
  assert.equal(uniqueSlug(slugify('Les lions !'), ['les-lions']), 'les-lions-2');
  assert.equal(uniqueSlug('les-lions', ['les-lions', 'les-lions-2']), 'les-lions-3');
  const long = 'a'.repeat(100);
  assert.equal(uniqueSlug(long, [long]).length, 100);
  assert.match(uniqueSlug(long, [long]), /-2$/);
});

test('noms proposés : Poule A, B… et Terrain 1, 2…, en sautant les noms pris', async () => {
  const { nextPoolName, nextCourtName } = await import('../src/lib/tournaments/contracts');
  assert.equal(nextPoolName([]), 'Poule A');
  assert.equal(nextPoolName(['Poule A', 'Poule B']), 'Poule C');
  assert.equal(nextPoolName(['Poule A', 'poule c']), 'Poule B', 'un nom supprimé est reproposé');
  assert.equal(nextPoolName(Array.from({ length: 26 }, (_, i) => `Poule ${String.fromCharCode(65 + i)}`)), 'Poule AA');
  assert.equal(nextCourtName([]), 'Terrain 1');
  assert.equal(nextCourtName(['Terrain 1', 'Terrain 3']), 'Terrain 2');
  assert.equal(nextCourtName(['Central', 'Terrain 1']), 'Terrain 2');
});
