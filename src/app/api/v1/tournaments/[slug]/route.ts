import { json } from '@/lib/http';
import { slugSchema } from '@/lib/tournaments/contracts';
import { publicTournamentBySlug } from '@/lib/public/store';

export const dynamic = 'force-dynamic';

/** Instantané public d’un tournoi publié, en lecture seule et sans authentification. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) return json({ error: { code: 'NOT_FOUND', message: 'Tournoi introuvable ou pas encore publié.' } }, 404);
  try {
    const found = await publicTournamentBySlug(slug);
    if (!found) return json({ error: { code: 'NOT_FOUND', message: 'Tournoi introuvable ou pas encore publié.' } }, 404);
    return json({ tournament: found.snapshot });
  } catch {
    return json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Tournoi momentanément indisponible.' } }, 503);
  }
}
