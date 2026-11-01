import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { json, readJson, validOrigin } from '@/lib/http';
import { scheduleCommandSchema } from '@/lib/tournaments/contracts';
import { apiError, databaseError, validationError } from '@/lib/tournaments/api';
import { schedulePreviewForUser, scheduleTournamentForUser } from '@/lib/tournaments/store';

type Context = { params: Promise<{ id: string }> };

/** Prévisualisation du calendrier : lecture seule. */
export async function GET(request: Request, { params }: Context) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return apiError('INVALID_ID', 'Identifiant invalide.', 422);
    return json({ preview: await schedulePreviewForUser(session.user.id, id) });
  } catch (error) { return databaseError(error); }
}

/** Génération, suppression, déplacement, publication et archivage. */
export async function POST(request: Request, { params }: Context) {
  if (!validOrigin(request)) return apiError('ORIGIN_REFUSED', 'Origine refusée.', 403);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return apiError('INVALID_ID', 'Identifiant invalide.', 422);
    let body: unknown;
    try { body = await readJson(request); } catch { return apiError('INVALID_JSON', 'Requête JSON invalide.', 400); }
    const parsed = scheduleCommandSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return json({ configuration: await scheduleTournamentForUser(session.user.id, id, parsed.data) });
  } catch (error) { return databaseError(error); }
}
