/**
 * Disponibilités d’un terrain vues comme « toute la période du tournoi, moins des indisponibilités ».
 * Le moteur de calendrier travaille sur des plages disponibles ; l’organisateur, lui, ne saisit que les
 * tranches où le terrain n’est pas utilisable. Ces fonctions pures passent d’une vue à l’autre.
 */

export type Interval = { start: number; end: number };

/** Plages triées, fusionnées si elles se touchent ou se chevauchent, vides retirées. */
export function normalize(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/** Plages disponibles après retrait d’une indisponibilité. */
export function subtract(windows: readonly Interval[], removed: Interval): Interval[] {
  return normalize(windows.flatMap((w) => removed.end <= w.start || removed.start >= w.end ? [w]
    : [{ start: w.start, end: removed.start }, { start: removed.end, end: w.end }]));
}

/** Plages disponibles après qu’une période redevient disponible (bornée à la période du tournoi). */
export function restore(windows: readonly Interval[], added: Interval, period: Interval): Interval[] {
  return normalize([...windows, { start: Math.max(added.start, period.start), end: Math.min(added.end, period.end) }]);
}

/** Indisponibilités : les trous de la période du tournoi non couverts par une plage disponible. */
export function gaps(period: Interval, windows: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  let cursor = period.start;
  for (const w of normalize(windows)) {
    if (w.start > cursor) result.push({ start: cursor, end: Math.min(w.start, period.end) });
    cursor = Math.max(cursor, w.end);
  }
  if (cursor < period.end) result.push({ start: cursor, end: period.end });
  return result.filter((gap) => gap.end > gap.start);
}

/** Nouvelles dates du tournoi : les indisponibilités sont conservées, le reste de la nouvelle période est disponible. */
export function remap(windows: readonly Interval[], from: Interval, to: Interval): Interval[] {
  return gaps(from, windows).reduce<Interval[]>((result, gap) => subtract(result, gap), [{ ...to }]);
}
