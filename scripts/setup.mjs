import './load-env.mjs';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';

const defaults = {
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
  BETTER_AUTH_URL: 'http://localhost:3000',
};
const lines = Object.entries(defaults).filter(([key]) => !process.env[key]).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
if (!existsSync('.env.local')) writeFileSync('.env.local', '', { mode: 0o600 });
if (lines.length) appendFileSync('.env.local', '\n' + lines.join('\n') + '\n');
chmodSync('.env.local', 0o600);
console.log('Configuration Better Auth prête ; secrets existants conservés et nouvelles valeurs stockées dans .env.local.');
if (!process.env.DATABASE_URL) console.log('Ajouter DATABASE_URL dans .env.local avant les migrations.');
