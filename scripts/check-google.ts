import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { origin } from './test-http';

const db = getPrisma();
const states: string[] = [];
const origins = [origin];
if (process.argv.includes('--local-aliases')) {
  const alias = new URL(origin);
  alias.hostname = alias.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  origins.push(alias.origin);
}
const send = async (base: string, path: string, { method = 'GET', body, cookie = '', requestOrigin = base }: {
  method?: string; body?: unknown; cookie?: string; requestOrigin?: string;
} = {}) => {
  const request = () => fetch(`${base}${path}`, { method, redirect: 'manual', headers: {
    Origin: requestOrigin, 'Sec-Fetch-Site': 'same-origin', ...(cookie ? { Cookie: cookie } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
  let response = await request();
  if (response.status === 429) {
    const seconds = Number(response.headers.get('retry-after') ?? response.headers.get('x-retry-after'));
    if (Number.isInteger(seconds) && seconds > 0 && seconds < 60) {
      await response.body?.cancel();
      console.log(`Limitation de débit OAuth : reprise du test dans ${seconds} secondes.`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 100));
      response = await request();
    }
  }
  return response;
};
const input = { provider: 'google', callbackURL: '/dashboard', errorCallbackURL: '/login' };

try {
  assert(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET, 'Configurer les deux variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.');
  for (const base of origins) {
    const page = await send(base, '/login');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert(html.includes('Continuer avec Google'));
    assert(!html.includes('La connexion Google n’est pas encore disponible.'));
    assert(!html.includes(process.env.GOOGLE_CLIENT_SECRET!), 'Le secret Google doit rester côté serveur.');
    const started = await send(base, '/api/auth/sign-in/social', { method: 'POST', body: input });
    assert.equal(started.status, 200, `Démarrage OAuth ${base}`);
    const data = await started.json();
    assert.equal(data.redirect, true);
    const authorization = new URL(data.url);
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert(authorization.searchParams.get('client_id') === process.env.GOOGLE_CLIENT_ID);
    assert.equal(authorization.searchParams.get('redirect_uri'), `${base}/api/auth/callback/google`);
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert(authorization.searchParams.get('code_challenge'));
    assert.deepEqual(authorization.searchParams.get('scope')?.split(' ').sort(), ['email', 'openid', 'profile']);
    const state = authorization.searchParams.get('state');
    assert(state); states.push(state);
    const cookies = started.headers.getSetCookie();
    assert(cookies.some((value) => /httponly/i.test(value)), 'Cookie d’état OAuth HTTP-only.');
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
    const cancelled = await send(base, `/api/auth/callback/google?${new URLSearchParams({ state, error: 'access_denied' })}`, { cookie });
    assert([302, 303].includes(cancelled.status));
    const returned = new URL(cancelled.headers.get('location')!, base);
    assert.equal(returned.origin, base);
    assert.equal(returned.pathname, '/login');
    assert.equal(returned.searchParams.get('error'), 'access_denied');
    const errorPage = await send(base, returned.pathname + returned.search);
    assert((await errorPage.text()).includes('La connexion Google a été annulée.'));
    assert.equal((await (await send(base, '/api/auth', { cookie })).json()).user, null);
    const forged = await send(base, `/api/auth/callback/google?${new URLSearchParams({ code: 'invalid-code', state: crypto.randomUUID() })}`);
    assert([302, 303].includes(forged.status));
    const refused = new URL(forged.headers.get('location')!, base);
    assert.equal(refused.pathname, '/login');
    assert(refused.searchParams.has('error'));
    assert(!forged.headers.getSetCookie().some((value) => /tournio\.session_token=/.test(value)));
    assert.equal((await send(base, '/api/auth/sign-in/social', { method: 'POST', body: input, requestOrigin: 'https://example.invalid' })).status, 403, 'Origine OAuth étrangère');
    assert.equal((await send(base, '/api/auth/sign-in/social', { method: 'POST', body: { ...input, callbackURL: 'https://example.invalid/dashboard' } })).status, 403, 'Callback OAuth étranger');
    console.log(`OK — ${base} : bouton, redirection Google, PKCE, annulation et refus des états/origines/retours invalides.`);
  }
  console.log('Succès : démarrage OAuth vérifié. Le consentement avec un compte Google réel se teste dans le navigateur.');
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Échec du test OAuth Google : vérifier la configuration et le serveur local.');
  process.exitCode = 1;
} finally {
  await db.verification.deleteMany({ where: { identifier: { in: states.map((state) => `auth-state:${state}`) } } }).catch(() => { console.error('Nettoyage des états de test impossible.'); process.exitCode = 1; });
  await db.$disconnect();
}
