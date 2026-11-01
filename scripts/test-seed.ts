import './load-env.mjs';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/database/client';
import { assertIsolatedTestDatabase } from './test-database';

assertIsolatedTestDatabase();
const db = getPrisma();
try {
  const users = [];
  for (const [prefix, name] of [['TEST_OWNER', 'Organisateur de test A'], ['TEST_OTHER', 'Organisateur de test B']]) {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password) throw new Error('Les identifiants de test sont fournis par npm run test:local.');
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      const hashed = await hashPassword(password);
      const id = crypto.randomUUID();
      user = await db.user.create({ data: { id, name, email, emailVerified: true, accounts: { create: { accountId: id, providerId: 'credential', password: hashed } } } });
    }
    users.push(user);
  }
  const owner = users[0];
  let demo = await db.demoMatch.findFirst({ where: { owner_id: owner.id }, orderBy: { updated_at: 'asc' } });
  if (!demo) demo = await db.demoMatch.create({ data: { owner_id: owner.id } });
  const slug = `demo-${owner.id.replaceAll('-', '').slice(0, 12)}`;
  let tournament = await db.tournament.findFirst({ where: { owner_id: owner.id, slug } });
  if (!tournament) tournament = await db.$transaction(async (tx) => {
    const created = await tx.tournament.create({ data: { owner_id: owner.id, name: 'Tournoi de démonstration', slug, sport: 'Multisport', location: 'Bruxelles', timezone: 'Europe/Brussels', starts_at: new Date('2026-11-14T08:00:00Z'), ends_at: new Date('2026-11-14T17:00:00Z'), rules: { create: {} } } });
    const names = ['Les Renards','Les Éclairs','Les Aigles','Les Lions','Les Loups','Les Faucons','Les Lynx','Les Panthers','Les Dragons','Les Tigres','Les Ours','Les Hiboux'];
    for (let i = 0; i < 3; i++) {
      const pool = await tx.pool.create({ data: { tournament_id: created.id, name: `Poule ${String.fromCharCode(65 + i)}`, sort_order: i } });
      for (let j = 0; j < 4; j++) {
        const team = await tx.team.create({ data: { tournament_id: created.id, name: names[i * 4 + j], slug: `equipe-${i * 4 + j + 1}` } });
        await tx.poolTeam.create({ data: { tournament_id: created.id, team_id: team.id, pool_id: pool.id } });
      }
      const court = await tx.court.create({ data: { tournament_id: created.id, name: `Terrain ${i + 1}`, sort_order: i } });
      await tx.courtAvailability.create({ data: { tournament_id: created.id, court_id: court.id, starts_at: created.starts_at, ends_at: created.ends_at } });
    }
    return created;
  }, { timeout: 60000 });
  const origin = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  console.log('Fixtures prêtes sur la base jetable ; données existantes conservées.');
  console.log(`Organisation : ${origin}/dashboard/tournaments/${tournament.id}`);
  console.log(`Match public : ${origin}/demo?match=${demo.id}`);
  console.log('Identifiants transmis dans l’environnement du test, aucun mot de passe affiché.');
} catch (error) {
  const problem = error as { name?: string; code?: string; errorCode?: string; meta?: { modelName?: string; table?: string }; message?: string };
  console.error('Seed impossible :', JSON.stringify({ name: problem.name, code: problem.code || problem.errorCode, model: problem.meta?.modelName, table: problem.meta?.table }));
  if (!problem.code && !problem.errorCode) {
    let message = problem.message || '';
    for (const key of ['DATABASE_URL','BETTER_AUTH_SECRET','TEST_OWNER_PASSWORD','TEST_OTHER_PASSWORD']) if (process.env[key]) message = message.split(process.env[key]!).join('[REDACTED]');
    console.error(message.split('\n').find((line) => line.trim())?.slice(0, 300) || 'Vérifier connexion et migrations.');
  }
  process.exitCode = 1;
} finally { await db.$disconnect(); }
