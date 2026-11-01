import { isAbsolute } from 'node:path';

export function databaseURL() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL est requise pour se connecter à PostgreSQL.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL doit désigner une base PostgreSQL.');
  url.searchParams.set('schema', 'tournio');
  if (process.env.PG_SSL_CA_FILE) {
    const file = process.env.PG_SSL_CA_FILE;
    if (!isAbsolute(file)) throw new Error('PG_SSL_CA_FILE doit contenir un chemin absolu vers le certificat CA.');
    url.searchParams.set('sslrootcert', file);
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}
