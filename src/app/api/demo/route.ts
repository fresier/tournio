import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { json, validOrigin } from '@/lib/http';
import { createDemoMatch, publicDemoMatches } from '@/lib/demo-store';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (id && !z.uuid().safeParse(id).success) return json({ error: 'Identifiant invalide.' }, 422);
  try { return json({ matches: await publicDemoMatches(id || undefined) }); }
  catch { return json({ error: 'Impossible de joindre PostgreSQL.' }, 503); }
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return json({ error: 'Origine refusée.' }, 403);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return json({ error: 'Connexion organisateur requise.' }, 401);
    return json({ match: await createDemoMatch(session.user.id) }, 201);
  } catch { return json({ error: 'Création indisponible.' }, 503); }
}
