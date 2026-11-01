import { databaseEvents } from '@/lib/database/events';
import { getPrisma } from '@/lib/database/client';
import { json } from '@/lib/http';
import { slugSchema } from '@/lib/tournaments/contracts';
import { PUBLIC_STATUSES, publicTournamentId } from '@/lib/public/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Flux SSE public d’un tournoi. Les événements ne portent que la version : le navigateur recharge
 * ensuite l’instantané public, qui reste la seule source de vérité.
 * Événements : ready, tournament.updated { version }, ping (toutes les 15 s), retry, unavailable, removed.
 */
/** Plafond de flux ouverts par processus (mesuré : 1000 flux diffusés en < 1 s au p95). Au-delà : 503, le navigateur passe au polling. */
const MAX_STREAMS = Number(process.env.TOURNIO_MAX_STREAMS || 2000);
let openStreams = 0;

/** Une seule lecture de version par changement, partagée par tous les flux du même tournoi. */
const pendingVersions = new Map<string, Promise<number | null>>();
function publicVersion(id: string) {
  let pending = pendingVersions.get(id);
  if (!pending) {
    pending = getPrisma().tournament.findFirst({ where: { id, status: { in: [...PUBLIC_STATUSES] } }, select: { version: true } })
      .then((row) => row?.version ?? null)
      .finally(() => pendingVersions.delete(id));
    pendingVersions.set(id, pending);
  }
  return pending;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) return json({ error: 'Tournoi introuvable.' }, 404);
  let id: string | null;
  try { id = await publicTournamentId(slug); }
  catch { return json({ error: 'Base de données indisponible.' }, 503); }
  if (!id) return json({ error: 'Tournoi introuvable.' }, 404);
  if (openStreams >= MAX_STREAMS) return json({ error: 'Trop de connexions en direct : actualisation périodique.' }, 503);
  const tournamentId = id;

  let cleanup = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let readySent = false;
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      openStreams++;
      cleanup = () => {
        if (closed) return;
        closed = true;
        openStreams--;
        clearInterval(heartbeat); unsubscribe?.();
        request.signal.removeEventListener('abort', cleanup);
        try { controller.close(); } catch { /* Flux déjà fermé par le navigateur. */ }
      };
      request.signal.addEventListener('abort', cleanup, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      try {
        const stop = await databaseEvents.subscribe((change) => {
          if (change.kind === 'ready') { readySent = true; send('ready', {}); }
          else if (change.kind === 'retry') send('retry', {});
          else if (change.kind === 'change' && change.channel === 'tournio_tournaments' && change.id === tournamentId) {
            void publicVersion(tournamentId)
              .then((version) => { if (version === null) { send('removed', {}); cleanup(); } else send('tournament.updated', { version }); })
              .catch(() => send('retry', {}));
          }
        });
        if (closed) { stop(); return; }
        unsubscribe = stop;
        if (!readySent) send('ready', {});
        // Événement nommé (et non commentaire) : le navigateur s’en sert pour détecter un flux silencieusement coupé.
        heartbeat = setInterval(() => send('ping', {}), 15000);
      } catch { send('unavailable', {}); cleanup(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
