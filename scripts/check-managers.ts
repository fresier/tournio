import './load-env.mjs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/database/client';
import { configurationSchema } from '../src/lib/tournaments/contracts';
import { assertIsolatedTestDatabase } from './test-database';
import { createPilot } from './test-pilot';
import { login, request } from './test-http';

assertIsolatedTestDatabase();
const db = getPrisma();
const fixtures: string[] = [];
let pendingUserId: string | undefined;
try {
  const owner = await login('TEST_OWNER');
  const other = await login('TEST_OTHER');
  const otherEmail = process.env.TEST_OTHER_EMAIL!.trim().toLowerCase();
  const ownerEmail = process.env.TEST_OWNER_EMAIL!.trim().toLowerCase();
  let data = await createPilot(owner, 'Partage de gestion', { poolSizes: [2, 2] });
  fixtures.push(data.tournament.id);
  const endpoint = `/api/v1/admin/tournaments/${data.tournament.id}`;
  const access = `${endpoint}/managers`;
  const email = { email: otherEmail };

  assert.equal((await request(endpoint, { cookie: other })).status, 404);
  assert.equal((await request(access)).status, 401);
  assert.equal((await request(access, { cookie: other })).status, 404);
  assert.equal((await request(access, { method: 'POST', cookie: other, body: email })).status, 404);
  assert.equal((await request(access, { method: 'POST', cookie: owner, requestOrigin: 'https://example.invalid', body: email })).status, 403);
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: { email: 'invalide' } })).status, 422);
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: { email: ownerEmail } })).status, 422);
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: { email: `  ${otherEmail.toUpperCase()}  ` } })).status, 200);
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: email })).status, 409);
  const ownerAccess = await (await request(access, { cookie: owner })).json();
  assert.equal(ownerAccess.access.role, 'owner');
  assert.deepEqual(ownerAccess.access.managers.map((m: { email: string }) => m.email), [otherEmail]);
  const managerAccess = await (await request(access, { cookie: other })).json();
  assert.deepEqual(managerAccess.access, { role: 'manager', managers: [] }, 'Les adresses des autres gestionnaires restent privées.');
  const ownerUser = await db.user.findUniqueOrThrow({ where: { email: ownerEmail }, select: { id: true } });
  const unshared = await db.tournament.findFirstOrThrow({ where: { owner_id: ownerUser.id, id: { not: data.tournament.id } }, select: { id: true } });
  assert.equal((await request(`/api/v1/admin/tournaments/${unshared.id}`, { cookie: other })).status, 404, 'L’accès reste limité au seul tournoi partagé.');
  assert.equal((await request(access, { method: 'POST', cookie: other, body: { email: 'third@example.test' } })).status, 404);
  assert.equal((await request(access, { method: 'DELETE', cookie: other, body: email })).status, 404);
  const shared = (await (await request('/api/v1/admin/tournaments', { cookie: other })).json()).tournaments;
  assert.equal(shared.find((t: { id: string }) => t.id === data.tournament.id)?.access_role, 'manager');
  assert.equal((await request(`/dashboard/tournaments/${data.tournament.id}`, { cookie: other })).status, 200);

  // Une invitation peut précéder la création du compte ; seule une adresse vérifiée donne accès.
  const pendingEmail = `pending-${crypto.randomUUID()}@example.test`;
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: { email: pendingEmail } })).status, 200);
  const password = randomBytes(32).toString('base64url');
  const pendingId = crypto.randomUUID();
  const pending = await db.user.create({ data: { id: pendingId, name: 'Gestionnaire de test', email: pendingEmail, emailVerified: false,
    accounts: { create: { accountId: pendingId, providerId: 'credential', password: await hashPassword(password) } } } });
  pendingUserId = pending.id;
  const signedIn = await request('/api/auth', { method: 'POST', body: { email: pendingEmail, password } });
  assert.equal(signedIn.status, 200);
  const pendingCookie = signedIn.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.equal((await request(endpoint, { cookie: pendingCookie })).status, 404, 'Une adresse non vérifiée ne donne aucun accès.');
  await db.user.update({ where: { id: pending.id }, data: { emailVerified: true } });
  assert.equal((await request(endpoint, { cookie: pendingCookie })).status, 200, 'L’accès apparaît après vérification du compte.');
  await assert.rejects(db.tournamentManager.create({ data: { tournament_id: data.tournament.id, email: 'UPPER@example.test' } }), 'La base impose des adresses normalisées.');

  // Le gestionnaire peut modifier la configuration, publier et saisir un résultat.
  let response = await request(endpoint, { method: 'PATCH', cookie: other, body: { operation: 'update_pool', expected_version: data.tournament.version, payload: { id: data.pools[0].id, name: 'Poule partagée' } } });
  assert.equal(response.status, 200);
  data = configurationSchema.parse((await response.json()).configuration);
  assert.equal(data.pools[0].name, 'Poule partagée');
  assert.equal((await request(`${endpoint}/schedule`, { cookie: other })).status, 200);
  for (const [operation, payload] of [['generate', { replace: false }], ['publish', {}]] as const) {
    response = await request(`${endpoint}/schedule`, { method: 'POST', cookie: other, body: { operation, payload, expected_version: data.tournament.version } });
    assert.equal(response.status, 200, operation);
    data = configurationSchema.parse((await response.json()).configuration);
  }
  let match = data.matches[0];
  response = await request(`${endpoint}/matches`, { method: 'POST', cookie: other, body: { matches: [{ id: match.id, expected_version: match.version }] } });
  assert.equal(response.status, 200, 'Le gestionnaire peut lancer un créneau.');
  data = configurationSchema.parse((await response.json()).configuration);
  match = data.matches.find((m) => m.id === match.id)!;
  response = await request(`${endpoint}/matches/${match.id}`, { method: 'POST', cookie: other, body: { operation: 'record_result', expected_version: match.version, payload: { home_score: 3, away_score: 1 } } });
  assert.equal(response.status, 200);
  data = configurationSchema.parse((await response.json()).configuration);
  const ownerConfig = configurationSchema.parse((await (await request(endpoint, { cookie: owner })).json()).configuration);
  assert.equal(ownerConfig.matches.find((m) => m.id === match.id)?.home_score, 3);
  const publicText = await (await request(`/api/v1/tournaments/${data.tournament.slug}`)).text();
  assert(!publicText.includes(otherEmail) && !publicText.includes(pendingEmail) && !publicText.includes('managers'), 'Les adresses ne sont jamais publiques.');

  assert.equal((await request(access, { method: 'DELETE', cookie: owner, body: email })).status, 200);
  assert.equal((await request(endpoint, { cookie: other })).status, 404);
  assert.equal((await request(`${endpoint}/schedule`, { cookie: other })).status, 404);
  assert.equal((await request(`${endpoint}/matches`, { method: 'POST', cookie: other, body: { matches: [{ id: match.id, expected_version: match.version }] } })).status, 404);
  assert.equal((await request(`${endpoint}/matches/${match.id}`, { method: 'POST', cookie: other, body: { operation: 'record_result', expected_version: data.matches.find((m) => m.id === match.id)!.version, payload: { home_score: 9, away_score: 0 } } })).status, 404);
  assert.equal((await request(endpoint, { cookie: pendingCookie })).status, 200, 'Retirer un accès ne retire pas les autres.');
  assert(!(await (await request('/api/v1/admin/tournaments', { cookie: other })).json()).tournaments.some((t: { id: string }) => t.id === data.tournament.id));

  // Une écriture commencée pendant une révocation attend le verrou, puis doit revérifier l’accès.
  assert.equal((await request(access, { method: 'POST', cookie: owner, body: email })).status, 200);
  let release!: () => void;
  let acquired!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { acquired = resolve; });
  const revoke = db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM tournio.tournaments WHERE id = ${data.tournament.id}::uuid FOR UPDATE`;
    await tx.tournamentManager.deleteMany({ where: { tournament_id: data.tournament.id, email: otherEmail } });
    acquired();
    await gate;
  }, { timeout: 15000 });
  await ready;
  const waitingWrite = request(endpoint, { method: 'PATCH', cookie: other, body: { operation: 'update_pool', expected_version: data.tournament.version, payload: { id: data.pools[0].id, name: 'Après révocation' } } });
  try {
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const rows = await db.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%tournament_managers%'`;
      waiting = rows[0].count > 0;
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(waiting, 'L’écriture concurrente doit attendre le verrou de révocation.');
  } finally { release(); }
  await revoke;
  assert.equal((await waitingWrite).status, 404, 'Une révocation validée empêche l’écriture en attente.');
  assert.equal((await db.pool.findUniqueOrThrow({ where: { id: data.pools[0].id } })).name, 'Poule partagée');

  // L’archivage fige le tournoi mais le propriétaire garde la gestion de ses accès.
  response = await request(`${endpoint}/schedule`, { method: 'POST', cookie: owner, body: { operation: 'archive', expected_version: data.tournament.version, payload: {} } });
  assert.equal(response.status, 200);
  data = configurationSchema.parse((await response.json()).configuration);
  assert.equal((await request(endpoint, { cookie: pendingCookie })).status, 200);
  assert.equal((await request(endpoint, { method: 'PATCH', cookie: pendingCookie, body: { operation: 'update_pool', expected_version: data.tournament.version, payload: { id: data.pools[0].id, name: 'Tournoi archivé' } } })).status, 409);
  assert.equal((await request(access, { method: 'DELETE', cookie: owner, body: { email: pendingEmail } })).status, 200);
  assert.equal((await request(endpoint, { cookie: pendingCookie })).status, 404);
  console.log('OK — Gestion partagée : accès vérifié, invitation anticipée, droits du propriétaire, scores, confidentialité et révocation concurrente.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  try {
    await db.match.deleteMany({ where: { tournament_id: { in: fixtures } } });
    await db.tournament.deleteMany({ where: { id: { in: fixtures } } });
    if (pendingUserId) await db.user.deleteMany({ where: { id: pendingUserId } });
  } catch { console.error('Nettoyage des fixtures de partage impossible.'); process.exitCode = 1; }
  await db.$disconnect();
}
