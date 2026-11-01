import { trustedOrigins, type OriginEnvironment } from './origins';

type AuthEnvironment = OriginEnvironment & {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function googleProvider(env: AuthEnvironment = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, prompt: 'select_account' as const, includeGrantedScopes: false };
}

export function authBaseURL(env: AuthEnvironment = process.env) {
  const configured = env.BETTER_AUTH_URL;
  if (!configured) throw new Error('BETTER_AUTH_URL est requise.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('BETTER_AUTH_URL doit utiliser HTTP ou HTTPS.');
  if (env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return configured;
  return {
    allowedHosts: trustedOrigins(env).map((origin) => new URL(origin)).filter((origin) => origin.protocol === url.protocol).map((origin) => origin.host),
    protocol: url.protocol === 'https:' ? 'https' as const : 'http' as const,
    fallback: url.origin,
  };
}
