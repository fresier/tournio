import test from 'node:test';
import assert from 'node:assert/strict';
import { authBaseURL, googleProvider } from '../src/lib/auth-config';

test('Google reste désactivé tant que les deux identifiants ne sont pas présents', () => {
  assert.equal(googleProvider({}), undefined);
  assert.equal(googleProvider({ GOOGLE_CLIENT_ID: 'example.apps.googleusercontent.com' }), undefined);
  assert.equal(googleProvider({ GOOGLE_CLIENT_ID: 'example.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: ' ' }), undefined);
  assert(googleProvider({ GOOGLE_CLIENT_ID: 'example.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'example-secret' }));
});

test('OAuth conserve le domaine local initial pour retrouver ses cookies au retour', () => {
  const baseURL = authBaseURL({ BETTER_AUTH_URL: 'http://127.0.0.1:3000', NODE_ENV: 'development' });
  assert.equal(typeof baseURL, 'object');
  if (typeof baseURL === 'string') return;
  assert(baseURL.allowedHosts.includes('localhost:3000'));
  assert(baseURL.allowedHosts.includes('127.0.0.1:3000'));
  assert(!baseURL.allowedHosts.includes('localhost:3001'));
  assert.equal(baseURL.protocol, 'http');
});

test('OAuth utilise une URL fixe en production et sur les domaines distants', () => {
  assert.equal(authBaseURL({ BETTER_AUTH_URL: 'https://tournio.example.com', NODE_ENV: 'production' }), 'https://tournio.example.com');
  assert.equal(authBaseURL({ BETTER_AUTH_URL: 'https://tournio.example.com', NODE_ENV: 'development' }), 'https://tournio.example.com');
  assert.equal(authBaseURL({ BETTER_AUTH_URL: 'http://127.0.0.1:3000', NODE_ENV: 'production' }), 'http://127.0.0.1:3000');
  assert.throws(() => authBaseURL({}));
  assert.throws(() => authBaseURL({ BETTER_AUTH_URL: 'file:///tmp/auth' }));
});
