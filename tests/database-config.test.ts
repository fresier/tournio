import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseURL } from '../src/lib/database/config';

test('la configuration isole les tables sans modifier DATABASE_URL', () => {
  const saved = { url: process.env.DATABASE_URL, ca: process.env.PG_SSL_CA_FILE };
  try {
    process.env.DATABASE_URL = 'postgresql://localhost/example?schema=public';
    process.env.PG_SSL_CA_FILE = '';
    assert.equal(new URL(databaseURL()).searchParams.get('schema'),'tournio');
    assert.equal(process.env.DATABASE_URL,'postgresql://localhost/example?schema=public');
    process.env.PG_SSL_CA_FILE = '/private/tmp/tournio-example-ca.pem';
    const configured = new URL(databaseURL());
    assert.equal(configured.searchParams.get('sslrootcert'),'/private/tmp/tournio-example-ca.pem');
    assert.equal(configured.searchParams.get('sslmode'),'verify-full');
    process.env.PG_SSL_CA_FILE = './relative.pem';
    assert.throws(() => databaseURL());
  } finally {
    if(saved.url === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=saved.url;
    if(saved.ca === undefined) delete process.env.PG_SSL_CA_FILE; else process.env.PG_SSL_CA_FILE=saved.ca;
  }
});
