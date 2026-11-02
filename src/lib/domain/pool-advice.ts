/**
 * Conseils sur le nombre de poules : pour un format donné, chaque nombre de poules possible est simulé
 * (équipes réparties au plus juste) avec le moteur d’estimation, puis comparé à la durée disponible.
 * Plus de poules : moins de matchs et un tournoi plus court ; moins de poules : l’inverse.
 */
import { estimateDuration } from './estimate';
import { extraMatches, formatProblems, type FinalFormat } from './placement';
import type { ScheduleRules } from './schedule';

export type PoolOption = { pools: number; smallest: number; largest: number; matchesPerTeam: [number, number]; totalMinutes: number; fits: boolean };

/** Équipes réparties au plus juste dans `pools` poules (tailles différant d’au plus une équipe). */
export function balancedSizes(teams: number, pools: number) {
  return Array.from({ length: pools }, (_, index) => Math.floor(teams / pools) + (index < teams % pools ? 1 : 0));
}

export function poolOptions({ teams, courts, rules, format, breakMinutes = 0, aligned = false, allowIncomplete = false, availableMinutes }: {
  teams: number; courts: number; rules: ScheduleRules; format: FinalFormat; breakMinutes?: number; aligned?: boolean; allowIncomplete?: boolean; availableMinutes: number;
}): PoolOption[] {
  const options: PoolOption[] = [];
  for (let count = format === 'none' ? 1 : 2; count <= Math.min(16, Math.floor(teams / 2)); count++) {
    const sizes = balancedSizes(teams, count);
    if (formatProblems(format, sizes, allowIncomplete).length) continue;
    const pools = sizes.map((size, pool) => ({ id: `P${pool}`, teams: Array.from({ length: size }, (_, index) => `P${pool}T${index}`) }));
    const estimate = estimateDuration(pools, courts, rules, format, breakMinutes, aligned, allowIncomplete);
    if (!estimate) continue;
    const extra = format === 'none' ? 0 : extraMatches(format, teams);
    const smallest = Math.min(...sizes); const largest = Math.max(...sizes);
    options.push({ pools: count, smallest, largest, matchesPerTeam: [smallest - 1 + extra, largest - 1 + extra], totalMinutes: estimate.totalMinutes, fits: estimate.totalMinutes <= availableMinutes });
  }
  return options;
}

export type PoolAdvice =
  | { kind: 'add'; option: PoolOption }
  | { kind: 'remove'; option: PoolOption }
  | { kind: 'impossible'; option: PoolOption }
  | { kind: 'ok' };

/**
 * Conseil pour le nombre de poules actuel : si le tournoi dépasse, le plus petit ajout de poules qui le fait tenir
 * (le plus de matchs possible) ; s’il reste de la marge, le plus grand retrait qui tient encore.
 */
export function poolAdvice(options: PoolOption[], currentPools: number, currentMinutes: number, availableMinutes: number): PoolAdvice {
  if (!options.length || !currentPools) return { kind: 'ok' };
  const fits = (option: PoolOption) => option.totalMinutes <= availableMinutes;
  if (currentMinutes > availableMinutes) {
    const fitting = options.filter((option) => option.pools > currentPools && fits(option));
    if (fitting.length) return { kind: 'add', option: fitting[0] };
    const fastest = options.reduce((best, option) => option.totalMinutes < best.totalMinutes ? option : best);
    return { kind: 'impossible', option: fastest };
  }
  const fewer = options.filter((option) => option.pools < currentPools && fits(option) && option.smallest >= 3);
  return fewer.length ? { kind: 'remove', option: fewer[0] } : { kind: 'ok' };
}
