import { getAuth } from '@/lib/auth';
import { json, readJson, validOrigin } from '@/lib/http';
import { tournamentInputSchema } from '@/lib/tournaments/contracts';
import { apiError, databaseError, validationError } from '@/lib/tournaments/api';
import { createTournamentForUser, tournamentsForUser } from '@/lib/tournaments/store';

export async function GET(request: Request) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    return json({ tournaments: await tournamentsForUser(session.user.id) });
  } catch (error) { return databaseError(error); }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return apiError('ORIGIN_REFUSED', 'Origine refusée.', 403);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    let body: unknown;
    try { body = await readJson(request); } catch { return apiError('INVALID_JSON', 'Requête JSON invalide.', 400); }
    const parsed = tournamentInputSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return json({ configuration: await createTournamentForUser(session.user.id, parsed.data) }, 201);
  } catch (error) { return databaseError(error); }
}
