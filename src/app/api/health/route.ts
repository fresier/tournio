import { getPrisma } from '@/lib/database/client';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Sonde de santé pour l’hébergeur : 200 si l’application répond et joint PostgreSQL, 503 sinon. Aucune donnée exposée. */
export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'unavailable' }, 503);
  }
}
