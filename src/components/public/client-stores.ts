'use client';
import { useSyncExternalStore } from 'react';
import { teamPreferenceKey } from '@/lib/public/view';

/*
 * Sources externes lues sans setState dans un effet. Côté serveur (et pendant l’hydratation),
 * elles valent `undefined` / `null` : le HTML initial ne dépend ni de l’heure ni du stockage local.
 */

let clockNow: number | undefined;
function subscribeClock(onChange: () => void) {
  const tick = () => { clockNow = Date.now(); onChange(); };
  tick();
  const timer = window.setInterval(tick, 30_000);
  return () => window.clearInterval(timer);
}
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => clockNow, () => undefined);
}

const PREFERENCE_EVENT = 'tournio:preference';
function subscribePreference(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(PREFERENCE_EVENT, onChange); };
}
function readPreference(slug: string) {
  try { return window.localStorage.getItem(teamPreferenceKey(slug)); } catch { return null; }
}
export function useTeamPreference(slug: string) {
  return useSyncExternalStore(subscribePreference, () => readPreference(slug), () => null);
}
export function setTeamPreference(slug: string, teamSlug: string | null) {
  try {
    if (teamSlug) window.localStorage.setItem(teamPreferenceKey(slug), teamSlug);
    else window.localStorage.removeItem(teamPreferenceKey(slug));
  } catch { /* Stockage indisponible (navigation privée…) : la page fonctionne sans préférence. */ }
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}
