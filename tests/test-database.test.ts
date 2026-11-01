import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolatedTestDatabase } from '../scripts/test-database';

test('les fixtures de comptes sont autorisées uniquement dans le scénario isolé', () => {
  assert.doesNotThrow(() => assertIsolatedTestDatabase({ TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'postgresql://localhost:5432/tournio_test' }));
  for (const env of [
    { DATABASE_URL: 'postgresql://localhost/tournio_test' },
    { TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'postgresql://db.example.com/tournio_test' },
    { TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'postgresql://localhost/tournio_test?host=db.example.com' },
    { TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'postgresql://localhost/tournio' },
    { TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'https://localhost/tournio_test' },
    { TOURNIO_ISOLATED_TEST: '1', DATABASE_URL: 'invalid' },
  ]) assert.throws(() => assertIsolatedTestDatabase(env), /base jetable/);
});
