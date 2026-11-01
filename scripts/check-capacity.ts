import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { configurationSchema } from '../src/lib/tournaments/contracts';
import { assertIsolatedTestDatabase } from './test-database';
import { login, origin, request } from './test-http';
import { createPilot } from './test-pilot';

/**
 * Mesure de capacité (lot H) sur l’instance locale de production.
 * N spectateurs gardent un flux SSE ouvert et, comme le navigateur, rechargent l’instantané public
 * à chaque `tournament.updated`. On mesure le délai entre la validation d’un score et la réception
 * du nouvel instantané par tous les spectateurs, puis le débit brut de l’instantané public.
 * Paramètres : CAPACITY_CLIENTS (300), CAPACITY_ROUNDS (5), CAPACITY_MIN_CLIENTS (seuil exigé, 200).
 */
assertIsolatedTestDatabase();
const clients = Number(process.env.CAPACITY_CLIENTS || 300);
const rounds = Number(process.env.CAPACITY_ROUNDS || 5);
const db = getPrisma();
let fixture: string | undefined;
const percentile = (values: number[], p: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? NaN; };
const ms = (value: number) => `${Math.round(value)} ms`;

type Spectator = { version: number; seen: Map<number, number>; errors: number; close: () => void; ready: Promise<void> };

function spectator(slug: string, version: number): Spectator {
  const controller = new AbortController();
  const state: Spectator = { version, seen: new Map(), errors: 0, close: () => controller.abort(), ready: Promise.resolve() };
  let refreshing = false; let again = false;
  const refresh = async (): Promise<void> => {
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      const response = await fetch(`${origin}/api/v1/tournaments/${slug}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) { state.errors++; return; }
      const body = await response.json() as { tournament: { tournament: { version: number } } };
      const next = body.tournament.tournament.version;
      if (next > state.version) { state.version = next; state.seen.set(next, performance.now()); }
    } catch { if (!controller.signal.aborted) state.errors++; }
    finally { refreshing = false; if (again) { again = false; void refresh(); } }
  };
  state.ready = (async () => {
    const response = await fetch(`${origin}/api/v1/tournaments/${slug}/events`, { signal: controller.signal });
    assert.equal(response.status, 200, 'Flux SSE public');
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = ''; let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let index;
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const event = /^event: (.+)$/m.exec(buffer.slice(0, index))?.[1];
            buffer = buffer.slice(index + 2);
            if (event === 'ready') resolveReady();
            else if (event === 'tournament.updated') void refresh();
            else if (event === 'retry' || event === 'unavailable') state.errors++;
          }
        }
      } catch { /* Flux fermé à la fin de la mesure. */ }
    })();
    await ready;
  })();
  return state;
}

try {
  const cookie = await login('TEST_OWNER');
  let data = await createPilot(cookie, 'Pilote capacité', { publish: true });
  fixture = data.tournament.id;
  const slug = data.tournament.slug;

  const started = performance.now();
  const audience: Spectator[] = [];
  for (let i = 0; i < clients; i += 50) {
    const batch = Array.from({ length: Math.min(50, clients - i) }, () => spectator(slug, data.tournament.version));
    audience.push(...batch);
    await Promise.all(batch.map((row) => row.ready));
  }
  console.log(`Capacité — ${clients} flux SSE ouverts en ${ms(performance.now() - started)}.`);

  const delays: number[] = [];
  const writes: number[] = [];
  for (let round = 0; round < rounds; round++) {
    const match = data.matches.find((row) => row.status === 'SCHEDULED')!;
    const sent = performance.now();
    const response = await request(`/api/v1/admin/tournaments/${data.tournament.id}/matches/${match.id}`, { method: 'POST', cookie, body: { operation: 'record_result', payload: { home_score: 2, away_score: 1 }, expected_version: match.version } });
    writes.push(performance.now() - sent);
    assert.equal(response.status, 200, 'Saisie du score sous charge');
    data = configurationSchema.parse((await response.json()).configuration);
    const target = data.tournament.version;
    const deadline = performance.now() + 30_000;
    while (audience.some((row) => row.version < target) && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const late = audience.filter((row) => row.version < target).length;
    assert.equal(late, 0, `${late} spectateurs n’ont pas reçu la version ${target} en 30 s`);
    const roundDelays = audience.map((row) => row.seen.get(target)! - sent);
    delays.push(...roundDelays);
    console.log(`  manche ${round + 1} : saisie ${ms(writes.at(-1)!)}, diffusion p50 ${ms(percentile(roundDelays, 0.5))}, p95 ${ms(percentile(roundDelays, 0.95))}, max ${ms(Math.max(...roundDelays))}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const errors = audience.reduce((sum, row) => sum + row.errors, 0);
  for (const row of audience) row.close();
  console.log(`Capacité — diffusion à ${clients} spectateurs sur ${rounds} scores : p50 ${ms(percentile(delays, 0.5))}, p95 ${ms(percentile(delays, 0.95))}, max ${ms(Math.max(...delays))} ; saisie p95 ${ms(percentile(writes, 0.95))} ; erreurs ${errors}.`);
  assert.equal(errors, 0, 'Aucune erreur côté spectateurs');
  assert(percentile(delays, 0.95) < 5000, 'p95 de diffusion sous 5 s');

  // Débit brut de l’instantané public (rafale d’ouvertures de page après l’affichage d’un QR code).
  const burst = Number(process.env.CAPACITY_BURST || 500);
  const timings: number[] = []; let failed = 0;
  const burstStart = performance.now();
  await Promise.all(Array.from({ length: burst }, async () => {
    const begin = performance.now();
    const response = await fetch(`${origin}/api/v1/tournaments/${slug}`, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) failed++; else await response.arrayBuffer();
    timings.push(performance.now() - begin);
  }));
  const seconds = (performance.now() - burstStart) / 1000;
  console.log(`Capacité — rafale de ${burst} instantanés : ${Math.round(burst / seconds)} req/s, p95 ${ms(percentile(timings, 0.95))}, échecs ${failed}.`);
  assert.equal(failed, 0, 'Rafale sans échec');
  console.log('OK — Capacité mesurée.');
} finally {
  if (fixture) await db.tournament.delete({ where: { id: fixture } }).catch(() => {});
  await db.$disconnect();
}
