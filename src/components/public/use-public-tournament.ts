'use client';
import { useEffect, useRef, useState } from 'react';
import { publicTournamentSchema, type PublicTournament } from '@/lib/public/contracts';
import { useNow } from './client-stores';

export type Connection = 'connecting' | 'live' | 'fallback' | 'removed';

/** Le serveur envoie `ping` toutes les 15 s : au-delà de ce délai sans rien recevoir, le flux est tenu pour coupé. */
const SILENCE_MS = 40_000;
const POLL_MS = 20_000;

/**
 * Instantané public tenu à jour : SSE quand il est disponible, sinon polling toutes les 20 s.
 * Les événements ne servent que de signal : on recharge toujours l’instantané complet,
 * et une réponse plus ancienne que celle affichée est ignorée.
 * Un téléphone qui change de réseau ne ferme pas toujours le flux : l’événement `offline`
 * et l’absence de `ping` basculent sur le polling, puis le flux est rouvert.
 */
const RELOAD_KEY = 'tournio:rechargement';
/** Recharge au plus une fois par minute (évite une boucle si l’instantané restait illisible). */
function reloadForNewVersion() {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { return; /* Sans stockage, pas de garde-fou : on ne recharge pas automatiquement. */ }
  window.location.reload();
}

export function usePublicTournament(initial: PublicTournament) {
  const [snapshot, setSnapshot] = useState(initial);
  const [connection, setConnection] = useState<Connection>('connecting');
  const now = useNow();
  const live = useRef(false);
  const slug = initial.tournament.slug;

  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    let again = false;
    let removed = false;
    let source: EventSource | undefined;
    let lastSignal = Date.now();
    const controller = new AbortController();

    const refresh = async () => {
      if (disposed || document.visibilityState === 'hidden') return;
      // Un signal reçu pendant un rechargement en relance un seul après coup : aucun changement n’est perdu.
      if (refreshing) { again = true; return; }
      refreshing = true;
      try {
        const response = await fetch(`/api/v1/tournaments/${slug}`, { cache: 'no-store', signal: controller.signal });
        if (response.status === 404) { if (!disposed) { removed = true; setConnection('removed'); } return; }
        if (!response.ok) return;
        const parsed = publicTournamentSchema.safeParse((await response.json()).tournament);
        if (!disposed && parsed.success) setSnapshot((current) => parsed.data.tournament.version >= current.tournament.version ? parsed.data : current);
        // Instantané d’une version plus récente de Tournio (déploiement pendant que la page est ouverte) :
        // le code de la page ne sait plus le lire, on recharge pour obtenir le nouveau code.
        else if (!disposed) reloadForNewVersion();
      } catch { /* L’état de connexion vient du flux ; le polling réessaiera. */ }
      finally { refreshing = false; if (again && !disposed) { again = false; void refresh(); } }
    };

    const fallback = () => {
      if (disposed) return;
      live.current = false;
      setConnection((current) => current === 'removed' ? current : 'fallback');
    };
    const signal = () => { lastSignal = Date.now(); };

    const open = () => {
      source?.close();
      if (disposed || removed) return;
      signal();
      const stream = new EventSource(`/api/v1/tournaments/${slug}/events`);
      source = stream;
      // « ready » arrive aussi après chaque reconnexion : on recharge alors un instantané complet.
      stream.addEventListener('ready', () => { if (disposed) return; signal(); live.current = true; setConnection('live'); void refresh(); });
      stream.addEventListener('tournament.updated', () => { if (disposed) return; signal(); void refresh(); });
      stream.addEventListener('ping', signal);
      stream.onerror = fallback;
      stream.addEventListener('retry', fallback);
      stream.addEventListener('unavailable', fallback);
      stream.addEventListener('removed', () => { if (disposed) return; removed = true; setConnection('removed'); stream.close(); });
    };
    open();

    let lastPoll = Date.now();
    const interval = window.setInterval(() => {
      if (!live.current && Date.now() - lastPoll >= POLL_MS) { lastPoll = Date.now(); void refresh(); }
      // Flux muet : coupé sans que le navigateur le signale (changement de réseau, veille…).
      if (Date.now() - lastSignal > SILENCE_MS) { fallback(); open(); }
    }, 5_000);
    const onOffline = () => fallback();
    const onOnline = () => { open(); void refresh(); };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSignal > SILENCE_MS) open();
      void refresh();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      controller.abort();
      source?.close();
      window.clearInterval(interval);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug]);

  return { snapshot, connection, now };
}
