import './load-env.mjs';
import { spawnSync } from 'node:child_process';
import { databaseURL } from '../src/lib/database/config.ts';
import pg from 'pg';

const args = process.argv.slice(2);
if (args[0] === 'migrate' && args[1] === 'reset') throw new Error('Le reset de base n’est pas une commande de ce projet.');
try {
  if (args[0] === 'migrate') {
    const client = new pg.Client({ connectionString: databaseURL(), connectionTimeoutMillis: 10000, query_timeout: 10000 });
    try {
      await client.connect();
      const { rows } = await client.query("SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='tournio' AND table_name <> '_prisma_migrations') AS tables, to_regclass('tournio._prisma_migrations') IS NOT NULL AS tracked");
      if (rows[0].tables && !rows[0].tracked) throw new Error('Le schéma tournio contient déjà des données sans historique Prisma. Une vérification de compatibilité est requise avant migration.');
    } finally { await client.end().catch(() => {}); }
  }
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, env: process.env });
  const redact = (text) => {
    let output = text || '';
    for (const key of ['DATABASE_URL','BETTER_AUTH_SECRET','DEMO_OWNER_PASSWORD','DEMO_OTHER_PASSWORD']) {
      const secret = process.env[key]; if (secret) output = output.split(secret).join('[REDACTED]');
    }
    return output.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DATABASE_URL REDACTED]');
  };
  process.stdout.write(redact(result.stdout)); process.stderr.write(redact(result.stderr));
  if (result.error) throw new Error('Impossible de lancer Prisma.');
  process.exitCode = result.status || 0;
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : null;
  console.error(code ? `Connexion PostgreSQL impossible (${code}). Vérifier DATABASE_URL et PG_SSL_CA_FILE.` : error.message);
  process.exitCode = 1;
}
