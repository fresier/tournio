/**
 * Placement des matchs sur les terrains et validation d’un calendrier.
 *
 * Conventions (tous les instants sont des millisecondes UTC) :
 * - un match occupe l’intervalle semi-ouvert [début, début + durée) ;
 * - il doit tenir entièrement dans une disponibilité du terrain ;
 * - le terrain reste occupé pendant la transition : [début, fin + transition) ;
 * - le repos d’une équipe se compte depuis la fin de son match précédent ;
 * - un match annulé ne bloque ni terrain ni équipe.
 */

const MINUTE = 60_000;

export type Window = { start: number; end: number };
export type CourtInput = { id: string; availabilities: Window[] };
export type ScheduleRules = {
  matchMinutes: number; transitionMinutes: number; restMinutes: number;
  /** Horaires alignés : les matchs ne commencent que sur une grille commune (instant d’origine + k × pas). */
  grid?: { anchor: number; stepMinutes: number };
};

/** Pas de la grille des horaires alignés : un match et le plus long des délais (transition ou repos). */
export function alignedStep(rules: Pick<ScheduleRules, 'matchMinutes' | 'transitionMinutes' | 'restMinutes'>) {
  return rules.matchMinutes + Math.max(rules.transitionMinutes, rules.restMinutes);
}

/** Premier instant de la grille à partir de `time` (inchangé sans grille). */
export function onGrid(time: number, grid: ScheduleRules['grid']) {
  if (!grid) return time;
  const step = grid.stepMinutes * MINUTE;
  return grid.anchor + Math.ceil((time - grid.anchor) / step) * step;
}
export type MatchToPlace = { key: string; poolId: string; round: number; home: string; away: string };
export type PlacedMatch = MatchToPlace & { courtId: string; start: number; end: number };
export type ScheduleInput = { matches: MatchToPlace[]; courts: CourtInput[]; rules: ScheduleRules };

export type ScheduleResult =
  | { status: 'scheduled'; matches: PlacedMatch[] }
  /** Les paramètres rendent tout calendrier impossible : changer les paramètres est nécessaire. */
  | { status: 'impossible'; reasons: string[] }
  /** Aucune impossibilité démontrée, mais le placement n’a pas trouvé de solution pour ces matchs. */
  | { status: 'not_found'; unplaced: MatchToPlace[]; placed: PlacedMatch[] };

function sortedWindows(windows: Window[]) {
  return [...windows].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Bornes simples qui prouvent qu’aucun calendrier ne peut exister. */
export function impossibilities({ matches, courts, rules }: ScheduleInput): string[] {
  const reasons: string[] = [];
  const duration = rules.matchMinutes * MINUTE;
  const transition = rules.transitionMinutes * MINUTE;
  const rest = rules.restMinutes * MINUTE;
  if (!matches.length) return reasons;
  if (!courts.length) return ['Aucun terrain n’est configuré.'];

  const windows = courts.flatMap((court) => court.availabilities);
  if (!windows.some((w) => w.end - w.start >= duration)) {
    reasons.push(`Aucune disponibilité de terrain ne dure au moins ${rules.matchMinutes} minutes, la durée d’un match.`);
  }
  // Capacité maximale : nombre de matchs qui tiennent dans chaque disponibilité, transitions comprises.
  const capacity = windows.reduce((total, w) => total + Math.max(0, Math.floor((w.end - w.start + transition) / (duration + transition))), 0);
  if (capacity < matches.length) {
    reasons.push(`Les terrains peuvent accueillir au plus ${capacity} matchs, alors que ${matches.length} sont à placer.`);
  }
  // Une équipe qui joue k matchs a besoin d’au moins k durées et k − 1 repos entre le premier début et la dernière fin.
  const horizon = Math.max(...windows.map((w) => w.end)) - Math.min(...windows.map((w) => w.start));
  const perTeam = new Map<string, number>();
  for (const match of matches) for (const team of [match.home, match.away]) perTeam.set(team, (perTeam.get(team) ?? 0) + 1);
  const busiest = Math.max(...perTeam.values());
  if (busiest * duration + (busiest - 1) * rest > horizon) {
    reasons.push(`Une équipe doit jouer ${busiest} matchs : avec ${rules.restMinutes} minutes de repos, cela dépasse la plage horaire des terrains.`);
  }
  return reasons;
}

/** Ordre de priorité : tour, puis poule (ordre d’apparition), puis ordre de génération. */
function priorityOrder(matches: MatchToPlace[]) {
  const poolRank = new Map<string, number>();
  for (const match of matches) if (!poolRank.has(match.poolId)) poolRank.set(match.poolId, poolRank.size);
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => a.match.round - b.match.round || poolRank.get(a.match.poolId)! - poolRank.get(b.match.poolId)! || a.index - b.index)
    .map(({ match }) => match);
}

/**
 * Placement glouton déterministe et borné (au plus matchs² × terrains évaluations) :
 * à chaque étape, on place le match qui peut commencer le plus tôt, la priorité départageant les égalités,
 * puis sur le premier terrain (ordre fourni) qui l’accueille à cet instant.
 */
export function placeMatches(input: ScheduleInput): ScheduleResult {
  const reasons = impossibilities(input);
  if (reasons.length) return { status: 'impossible', reasons };

  const duration = input.rules.matchMinutes * MINUTE;
  const transition = input.rules.transitionMinutes * MINUTE;
  const rest = input.rules.restMinutes * MINUTE;
  const courts = input.courts.map((court) => ({ id: court.id, windows: sortedWindows(court.availabilities) }));
  const courtFree = new Map(courts.map((court) => [court.id, -Infinity]));
  const teamReady = new Map<string, number>();
  const remaining = priorityOrder(input.matches);
  const placed: PlacedMatch[] = [];

  const earliestOn = (court: (typeof courts)[number], notBefore: number) => {
    for (const w of court.windows) {
      const start = onGrid(Math.max(w.start, notBefore), input.rules.grid);
      if (start + duration <= w.end) return start;
    }
    return undefined;
  };

  while (remaining.length) {
    let best: { index: number; courtId: string; start: number } | undefined;
    for (let index = 0; index < remaining.length; index++) {
      const match = remaining[index];
      const ready = Math.max(teamReady.get(match.home) ?? -Infinity, teamReady.get(match.away) ?? -Infinity);
      for (const court of courts) {
        const start = earliestOn(court, Math.max(ready, courtFree.get(court.id)!));
        if (start !== undefined && (!best || start < best.start)) best = { index, courtId: court.id, start };
      }
    }
    if (!best) return { status: 'not_found', unplaced: remaining, placed };
    const [match] = remaining.splice(best.index, 1);
    const end = best.start + duration;
    placed.push({ ...match, courtId: best.courtId, start: best.start, end });
    courtFree.set(best.courtId, end + transition);
    teamReady.set(match.home, end + rest);
    teamReady.set(match.away, end + rest);
  }
  return { status: 'scheduled', matches: placed };
}

export type ScheduledMatch = {
  key: string; home: string; away: string;
  /** Groupe dans lequel une paire ne peut se rencontrer qu’une fois (la poule) ; absent = toutes les rencontres. */
  group?: string;
  courtId: string | null; start: number | null; end: number | null;
  cancelled?: boolean;
};

export type Violation = { code: 'unplaced' | 'unknown_court' | 'duration' | 'outside_availability' | 'court_overlap' | 'team_rest' | 'same_team' | 'duplicate_pair'; matches: string[]; message: string };

/**
 * Validateur indépendant du placement : il contrôle n’importe quel calendrier,
 * y compris après une modification manuelle.
 */
export function validateSchedule(matches: ScheduledMatch[], courts: CourtInput[], rules: ScheduleRules): Violation[] {
  const violations: Violation[] = [];
  const duration = rules.matchMinutes * MINUTE;
  const transition = rules.transitionMinutes * MINUTE;
  const rest = rules.restMinutes * MINUTE;
  const courtById = new Map(courts.map((court) => [court.id, court]));
  const pairs = new Map<string, string>();
  const active: (ScheduledMatch & { courtId: string; start: number; end: number })[] = [];

  for (const match of matches) {
    if (match.home === match.away) violations.push({ code: 'same_team', matches: [match.key], message: 'Une équipe ne peut pas se rencontrer elle-même.' });
    const pair = `${match.group ?? ''}|${[match.home, match.away].sort().join('|')}`;
    const twin = pairs.get(pair);
    if (twin) violations.push({ code: 'duplicate_pair', matches: [twin, match.key], message: 'Ces deux équipes se rencontrent deux fois.' });
    else pairs.set(pair, match.key);

    if (match.cancelled) continue;
    if (match.courtId === null || match.start === null || match.end === null) {
      violations.push({ code: 'unplaced', matches: [match.key], message: 'Ce match n’a pas de terrain ou d’horaire.' });
      continue;
    }
    const court = courtById.get(match.courtId);
    if (!court) { violations.push({ code: 'unknown_court', matches: [match.key], message: 'Ce terrain n’existe pas.' }); continue; }
    if (match.end - match.start !== duration) violations.push({ code: 'duration', matches: [match.key], message: `Un match doit durer ${rules.matchMinutes} minutes.` });
    const { start, end } = match;
    if (!court.availabilities.some((w) => w.start <= start && end <= w.end)) {
      violations.push({ code: 'outside_availability', matches: [match.key], message: 'Ce match est hors des disponibilités du terrain.' });
    }
    active.push(match as (typeof active)[number]);
  }

  const byStart = [...active].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
  for (let i = 0; i < byStart.length; i++) {
    const a = byStart[i];
    for (let j = i + 1; j < byStart.length; j++) {
      const b = byStart[j];
      // Au-delà de la plus longue occupation possible, plus aucun conflit avec a.
      if (b.start >= a.end + Math.max(transition, rest)) break;
      if (a.courtId === b.courtId && b.start < a.end + transition) {
        violations.push({ code: 'court_overlap', matches: [a.key, b.key], message: 'Deux matchs occupent le même terrain en même temps ou sans transition.' });
      }
      if ([a.home, a.away].some((team) => team === b.home || team === b.away) && b.start < a.end + rest) {
        violations.push({ code: 'team_rest', matches: [a.key, b.key], message: `Une équipe joue deux matchs sans ${rules.restMinutes} minutes de repos.` });
      }
    }
  }
  return violations;
}
