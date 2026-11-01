export type OriginEnvironment = {
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
};

const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];

export function trustedOrigins(env: OriginEnvironment = process.env) {
  const origins = new Set<string>();
  if (!env.BETTER_AUTH_URL) return [];
  const url = new URL(env.BETTER_AUTH_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('BETTER_AUTH_URL doit utiliser HTTP ou HTTPS.');
  origins.add(url.origin);
  if (env.NODE_ENV === 'development' && loopbackHosts.includes(url.hostname)) {
    for (const host of loopbackHosts) {
      const alias = new URL(url);
      alias.hostname = host;
      origins.add(alias.origin);
    }
  }
  return [...origins];
}

export function isTrustedOrigin(origin: string | null, env: OriginEnvironment = process.env) {
  return origin !== null && trustedOrigins(env).includes(origin);
}
