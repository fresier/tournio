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
