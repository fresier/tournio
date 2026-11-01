type TestEnvironment = { DATABASE_URL?: string; TOURNIO_ISOLATED_TEST?: string };

export function assertIsolatedTestDatabase(env: TestEnvironment = { DATABASE_URL: process.env.DATABASE_URL, TOURNIO_ISOLATED_TEST: process.env.TOURNIO_ISOLATED_TEST }) {
  const message = 'Les comptes de test sont réservés à la base jetable. Utiliser npm run test:local.';
  if (env.TOURNIO_ISOLATED_TEST !== '1' || !env.DATABASE_URL) throw new Error(message);
  let url: URL;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error(message); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/tournio_test' || url.searchParams.has('host')) throw new Error(message);
}
