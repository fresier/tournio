import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { json, readJson, validOrigin } from '@/lib/http';
import { matchCommandSchema } from '@/lib/tournaments/contracts';
import { apiError, databaseError, validationError } from '@/lib/tournaments/api';
import { matchCommandForUser } from '@/lib/tournaments/store';

type Context = { params: Promise<{ id: string; matchId: string }> };

/** Résultat et changements d’état d’un match : start, reset, record_result, postpone, cancel, reinstate. */
export async function POST(request: Request, { params }: Context) {
  if (!validOrigin(request)) return apiError('ORIGIN_REFUSED', 'Origine refusée.', 403);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    const { id, matchId } = await params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(matchId).success) return apiError('INVALID_ID', 'Identifiant invalide.', 422);
    let body: unknown;
    try { body = await readJson(request); } catch { return apiError('INVALID_JSON', 'Requête JSON invalide.', 400); }
    const parsed = matchCommandSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return json({ configuration: await matchCommandForUser(session.user.id, id, matchId, parsed.data) });
  } catch (error) { return databaseError(error); }
}
