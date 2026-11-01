import { z } from 'zod';
import { databaseEvents } from '@/lib/database/events';
import { publicDemoMatches } from '@/lib/demo-store';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return json({ error: 'Identifiant invalide.' }, 422);
  try { if (!(await publicDemoMatches(id))[0]) return json({ error: 'Match introuvable.' }, 404); }
  catch { return json({ error: 'Base de données indisponible.' }, 503); }
  let cleanup = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let readySent = false;
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat); unsubscribe?.();
        request.signal.removeEventListener('abort', cleanup);
        try { controller.close(); } catch { /* Le navigateur peut avoir déjà fermé le flux. */ }
      };
      request.signal.addEventListener('abort', cleanup, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      try {
        const stop = await databaseEvents.subscribe((change) => {
          if (change.kind === 'ready') { readySent = true; send('ready', {}); }
          else if (change.kind === 'retry') send('retry', {});
          else if (change.kind === 'change' && change.id === id) void publicDemoMatches(id).then((rows) => {
            if (!rows[0]) { send('removed', {}); cleanup(); }
            else send('match.updated', { match: rows[0] });
          }).catch(() => send('retry', {}));
        });
        if (closed) { stop(); return; }
        unsubscribe = stop;
        if (!readySent) send('ready', {});
        heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n')); }, 15000);
      } catch { send('unavailable', {}); cleanup(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
