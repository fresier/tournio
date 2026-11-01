import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedOrigin, trustedOrigins } from '../src/lib/origins';

test('les adresses de bouclage partagent le même port et protocole en développement', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const env = { BETTER_AUTH_URL: `http://${host}:3000`, NODE_ENV: 'development' };
    for (const alias of ['127.0.0.1', 'localhost', '[::1]']) {
      assert(isTrustedOrigin(`http://${alias}:3000`, env));
    }
    for (const origin of ['http://localhost:3001', 'https://localhost:3000', 'http://localhost.example.com:3000', 'http://127.0.0.1.example.com:3000', 'null', null]) {
      assert.equal(isTrustedOrigin(origin, env), false);
    }
  }
});

test('la production accepte uniquement les origines configurées', () => {
  const env = { BETTER_AUTH_URL: 'http://127.0.0.1:3000/', NODE_ENV: 'production' };
  assert(isTrustedOrigin('http://127.0.0.1:3000', env));
  assert.equal(isTrustedOrigin('http://localhost:3000', env), false);
  assert.equal(isTrustedOrigin('http://[::1]:3000', env), false);
  assert.deepEqual(trustedOrigins({ NODE_ENV: 'production' }), []);
});

test('les API et Better Auth utilisent la même origine déclarée', () => {
  const env = { BETTER_AUTH_URL: 'https://app.example.com/', NODE_ENV: 'development' };
  assert(isTrustedOrigin('https://app.example.com', env));
  assert.equal(isTrustedOrigin('https://foreign.example.com', env), false);
  assert.equal(isTrustedOrigin('http://localhost:3000', env), false);
  assert(isTrustedOrigin('http://localhost:3100', { BETTER_AUTH_URL: 'http://127.0.0.1:3100', NODE_ENV: 'development' }));
});
