import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';
import { json, validOrigin } from '@/lib/http';

const handlers = toNextJsHandler((request: Request) => getAuth().handler(request));
export const GET = handlers.GET;

export async function POST(request: Request) {
  // Les retours du fournisseur sont protégés par l’état OAuth et peuvent venir de son domaine.
  const providerCallback = new URL(request.url).pathname.startsWith('/api/auth/callback/');
  if (!providerCallback && !validOrigin(request)) return json({ error: 'Origine refusée.' }, 403);
  return handlers.POST(request);
}
