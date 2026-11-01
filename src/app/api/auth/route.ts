import { getAuth } from '@/lib/auth';
import { json, readJson, validOrigin } from '@/lib/http';
import { loginSchema } from '@/lib/contracts';
import { passwordLoginEnabled } from '@/lib/auth-config';

export async function GET(request: Request) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return json({ user: session ? { email: session.user.email } : null });
  } catch {
    return json({ error: 'Authentification indisponible.' }, 503);
  }
}

export async function POST(request: Request) {
  if (!passwordLoginEnabled()) return json({ error: 'La connexion se fait uniquement avec Google.' }, 404);
  if (!validOrigin(request)) return json({ error: 'Origine refusée.' }, 403);
  try {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: 'Adresse e-mail et mot de passe requis.' }, 422);
    const response = await getAuth().api.signInEmail({ body: parsed.data, headers: request.headers, asResponse: true });
    if (!response.ok) return json({ error: 'Identifiants incorrects ou connexion indisponible.' }, response.status === 429 ? 429 : 401);
    const data = await response.json();
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
    return Response.json({ user: { email: data.user.email } }, { headers });
  } catch {
    return json({ error: 'Requête invalide ou authentification indisponible.' }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return json({ error: 'Origine refusée.' }, 403);
  try {
    const response = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
    if (!response.ok) return json({ error: 'Déconnexion indisponible.' }, 503);
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
    return Response.json({ user: null }, { headers });
  } catch {
    return json({ error: 'Déconnexion indisponible.' }, 503);
  }
}
