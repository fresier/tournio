import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { scoreSchema } from '@/lib/contracts';
import { json, readJson, validOrigin } from '@/lib/http';
import { updateDemoScore } from '@/lib/demo-store';
import { DomainError } from '@/lib/tournaments/store';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validOrigin(request)) return json({ error: 'Origine refusée.' }, 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return json({ error: 'Identifiant invalide.' }, 422);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return json({ error: 'Connexion organisateur requise.' }, 401);
    const parsed = scoreSchema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: 'Scores entiers entre 0 et 999 et version positive requis.' }, 422);
    return json({ match: await updateDemoScore(session.user.id, id, parsed.data) });
  } catch (error) {
    if (error instanceof DomainError) return json({ error: error.message }, error.status);
    return json({ error: 'Enregistrement indisponible.' }, 503);
  }
}
