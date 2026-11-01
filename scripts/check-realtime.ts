import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { request, login, origin } from './test-http';
import { assertIsolatedTestDatabase } from './test-database';

assertIsolatedTestDatabase();
const db = getPrisma();
const fixtures: string[] = [];
const streamController = new AbortController();
let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

try {
  const owner = await login('TEST_OWNER');
  const other = await login('TEST_OTHER');
  assert.equal((await request('/api/demo', { method: 'POST' })).status, 401);
  const created = await request('/api/demo', { method: 'POST', cookie: owner });
  assert.equal(created.status, 201);
  const { match } = await created.json(); fixtures.push(match.id);
  const path = `/api/demo/${match.id}`;
  const score = { home_score: 2, away_score: 1, expected_version: match.version };
  assert.equal((await request(path, { method: 'PATCH', body: score })).status, 401);
  assert.equal((await request(path, { method: 'PATCH', cookie: other, body: score })).status, 404);
  assert.equal((await request(path, { method: 'PATCH', cookie: owner, requestOrigin: 'https://example.invalid', body: score })).status, 403);
  assert.equal((await request(path, { method: 'PATCH', cookie: owner, body: { ...score, home_score: -1 } })).status, 422);
  console.log('OK — Better Auth, cookies HTTP-only et permissions du match.');

  const stream = await fetch(`${origin}${path}/events`, { signal: streamController.signal });
  assert.equal(stream.status, 200);
  assert(stream.headers.get('content-type')?.includes('text/event-stream'));
  reader = stream.body!.getReader();
  let buffer = '';
  const decoder = new TextDecoder();
  async function event(wanted: string): Promise<Record<string, unknown>> {
    const timeout = setTimeout(() => streamController.abort(), 15000);
    try {
      while (true) {
        let index = buffer.indexOf('\n\n');
        while (index >= 0) {
          const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
          const name = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
          const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
          if (name === wanted) return JSON.parse(data || '{}');
          index = buffer.indexOf('\n\n');
        }
        const next = await reader!.read();
        if (next.done) throw new Error('Flux SSE fermé avant réception.');
        buffer += decoder.decode(next.value, { stream: true });
      }
    } finally { clearTimeout(timeout); }
  }
  await event('ready');
  const start = Date.now();
  assert.equal((await request(path, { method: 'PATCH', cookie: owner, body: score })).status, 200);
  const update = await event('match.updated') as { match: typeof match };
  assert.equal(update.match.home_score, 2); assert.equal(update.match.away_score, 1); assert.equal(update.match.version, 2);
  console.log(`OK — PostgreSQL NOTIFY → SSE public reçu en ${Date.now() - start} ms, sans polling.`);
  assert.equal((await request(path, { method: 'PATCH', cookie: owner, body: score })).status, 409);
  const concurrent = await Promise.all([3,4].map((home_score) => request(path, { method: 'PATCH', cookie: owner, body: { home_score, away_score: 1, expected_version: 2 } })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200,409]);
  const saved = await db.demoMatch.findUniqueOrThrow({ where: { id: match.id } });
  assert.equal(saved.version, 3);
  if (process.env.TOURNIO_ISOLATED_TEST === '1') {
    await db.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'tournio-realtime' AND datname = current_database() AND pid <> pg_backend_pid()`;
    await event('retry'); await event('ready');
    assert.equal((await request(path, { method: 'PATCH', cookie: owner, body: { home_score: 5, away_score: 1, expected_version: saved.version } })).status, 200);
    const resumed = await event('match.updated') as { match: typeof match };
    assert.equal(resumed.match.version, 4);
    console.log('OK — Reconnexion PostgreSQL et reprise du flux SSE après interruption.');
  }
  const hidden = await db.demoMatch.create({ data: { owner_id: saved.owner_id, published: false } }); fixtures.push(hidden.id);
  assert.deepEqual((await (await request(`/api/demo?id=${hidden.id}`)).json()).matches, []);
  assert.equal((await request(`/api/demo/${hidden.id}/events`)).status, 404);
  await request('/api/auth', { method: 'DELETE', cookie: owner });
  assert.equal((await request(path, { method: 'PATCH', cookie: owner, body: { ...score, expected_version: 3 } })).status, 401);
  console.log('OK — Concurrence, confidentialité et révocation de session.');
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Échec du test temps réel : vérifier les services, certificats et migrations.');
  process.exitCode = 1;
} finally {
  streamController.abort(); await reader?.cancel().catch(() => {});
  await db.demoMatch.deleteMany({ where: { id: { in: fixtures } } }).catch(() => { process.exitCode = 1; });
  await db.$disconnect();
}
