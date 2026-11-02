import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { json, readJson, validOrigin } from '@/lib/http';
import { managerCommandSchema } from '@/lib/tournaments/contracts';
import { apiError, databaseError, validationError } from '@/lib/tournaments/api';
import { changeManagerForOwner, managersForUser } from '@/lib/tournaments/store';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return apiError('INVALID_ID', 'Identifiant invalide.', 422);
    return json({ access: await managersForUser(session.user.id, id) });
  } catch (error) { return databaseError(error); }
}

async function update(request: Request, { params }: Context, operation: 'add' | 'remove') {
  if (!validOrigin(request)) return apiError('ORIGIN_REFUSED', 'Origine refusée.', 403);
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) return apiError('UNAUTHENTICATED', 'Connexion organisateur requise.', 401);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return apiError('INVALID_ID', 'Identifiant invalide.', 422);
    let body: unknown;
    try { body = await readJson(request); } catch { return apiError('INVALID_JSON', 'Requête JSON invalide.', 400); }
    const parsed = managerCommandSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    return json({ access: await changeManagerForOwner(session.user.id, id, parsed.data.email, operation) });
  } catch (error) { return databaseError(error); }
}

export function POST(request: Request, context: Context) { return update(request, context, 'add'); }
export function DELETE(request: Request, context: Context) { return update(request, context, 'remove'); }
