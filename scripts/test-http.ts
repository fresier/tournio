import './load-env.mjs';
import assert from 'node:assert/strict';
import { assertIsolatedTestDatabase } from './test-database';

export const origin = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname)) throw new Error('Les tests HTTP doivent cibler une instance locale de Tournio.');

export async function request(path: string, { cookie = '', method = 'GET', body, requestOrigin = origin, redirect = 'follow' }: {
  cookie?: string; method?: string; body?: unknown; requestOrigin?: string; redirect?: RequestRedirect;
} = {}) {
  return fetch(`${origin}${path}`, { method, redirect,
    headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
}

export async function login(prefix: 'TEST_OWNER' | 'TEST_OTHER') {
  assertIsolatedTestDatabase();
  const response = await request('/api/auth', { method: 'POST', body: { email: process.env[`${prefix}_EMAIL`], password: process.env[`${prefix}_PASSWORD`] } });
  assert.equal(response.status, 200, 'Connexion Better Auth');
  const values = response.headers.getSetCookie();
  assert(values.some((value) => /httponly/i.test(value)), 'Cookie HTTP-only requis');
  return values.map((value) => value.split(';')[0]).join('; ');
}
