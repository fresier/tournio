/**
 * Estimation de la durée d’un tournoi selon le format, les poules et le nombre de terrains.
 * Les poules sont placées par le vrai moteur de calendrier (terrains disponibles en continu) ;
 * chaque tour de classement fait jouer toutes les équipes et commence après le précédent,
 * comme lors de la génération réelle. Code pur.
 */
import { alignedStep, onGrid, placeMatches, type ScheduleRules } from './schedule';
import { poolMatches } from './round-robin';
import { formatProblems, roundMatchCounts, type FinalFormat } from './placement';

const MINUTE = 60_000;

export type DurationEstimate = { poolMinutes: number; placementMinutes: number; totalMinutes: number; poolMatches: number; placementMatches: number };


export function estimateDuration(pools: { id: string; teams: string[] }[], courts: number, baseRules: ScheduleRules, format: FinalFormat, breakMinutes = 0, aligned = false, allowIncomplete = false): DurationEstimate | null {
  const teams = pools.reduce((sum, pool) => sum + pool.teams.length, 0);
  if (!courts || teams < 2 || pools.some((pool) => pool.teams.length < 2) || baseRules.matchMinutes < 1) return null;
  // Horaires alignés : grille commune depuis le début du tournoi (instant 0 de la simulation).
  const plain = { matchMinutes: baseRules.matchMinutes, transitionMinutes: baseRules.transitionMinutes, restMinutes: baseRules.restMinutes };
  const rules: ScheduleRules = aligned ? { ...plain, grid: { anchor: 0, stepMinutes: alignedStep(plain) } } : plain;
  const matches = poolMatches(pools);
  const horizon = 30 * 24 * 60 * MINUTE;
  const placed = placeMatches({ matches, rules, courts: Array.from({ length: courts }, (_, index) => ({ id: String(index), availabilities: [{ start: 0, end: horizon }] })) });
  if (placed.status !== 'scheduled') return null;
  const poolEnd = Math.max(0, ...placed.matches.map((match) => match.end));

  // Matchs de chaque tour de classement (un groupe incomplet en compte moins).
  const counts = format === 'none' || formatProblems(format, pools.map((pool) => pool.teams.length), allowIncomplete).length ? [] : roundMatchCounts(format, teams);
  // Avant chaque tour : la pause choisie, au moins le repos minimal et la transition ; les vagues d’un tour s’enchaînent sur chaque terrain.
  const gap = Math.max(rules.transitionMinutes, rules.restMinutes, breakMinutes) * MINUTE;
  const wave = (aligned ? alignedStep(rules) : rules.matchMinutes + rules.transitionMinutes) * MINUTE;
  let end = poolEnd;
  for (const count of counts) {
    const waves = Math.ceil(count / courts);
    if (!waves) continue;
    const start = onGrid(end + gap, rules.grid);
    end = start + (waves - 1) * wave + rules.matchMinutes * MINUTE;
  }
  return { poolMinutes: poolEnd / MINUTE, placementMinutes: (end - poolEnd) / MINUTE, totalMinutes: end / MINUTE, poolMatches: matches.length, placementMatches: counts.reduce((sum, count) => sum + count, 0) };
}

/** « 45 min », « 3 h », « 3 h 10 ». */
export function formatDuration(minutes: number) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60); const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}
