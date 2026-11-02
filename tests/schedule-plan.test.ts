import test from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule, scheduleViolations } from '../src/lib/tournaments/schedule';
import type { TournamentConfiguration } from '../src/lib/tournaments/contracts';

const T = '00000000-0000-4000-8000-000000000000';
const uuid = (prefix: number, n: number) => `00000000-0000-4000-8000-${String(prefix).padStart(4, '0')}${String(n).padStart(8, '0')}`;

function configuration(pools: number, teamsPerPool: number, courts: number, overrides: Partial<TournamentConfiguration> = {}): TournamentConfiguration {
  const teams = Array.from({ length: pools * teamsPerPool }, (_, i) => ({ id: uuid(1, i), tournament_id: T, name: `Équipe ${i + 1}`, slug: `equipe-${i + 1}`, created_at: '', updated_at: '' }));
  const poolRows = Array.from({ length: pools }, (_, i) => ({ id: uuid(2, i), tournament_id: T, name: `Poule ${i + 1}`, sort_order: i }));
  const courtRows = Array.from({ length: courts }, (_, i) => ({ id: uuid(3, i), tournament_id: T, name: `Terrain ${i + 1}`, sort_order: i }));
  return {
    tournament: { id: T, name: 'Test', slug: 'test', sport: 'Volley', location: '', timezone: 'Europe/Brussels', starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z', status: 'DRAFT', published_at: null, theme: 'tournio', primary_color: null, accent_color: null, version: 1, created_at: '', updated_at: '' },
    rules: { tournament_id: T, match_duration_minutes: 20, transition_minutes: 5, minimum_rest_minutes: 10, allow_draw: true, aligned_slots: false, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: [], final_format: 'none', round_break_minutes: 0, allow_incomplete: false },
    teams, pools: poolRows, courts: courtRows,
    pool_teams: teams.map((team, i) => ({ tournament_id: T, team_id: team.id, pool_id: poolRows[Math.floor(i / teamsPerPool)].id })),
    availabilities: courtRows.map((court, i) => ({ id: uuid(4, i), tournament_id: T, court_id: court.id, starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z' })),
    matches: [], match_count: 0, ...overrides,
  };
}

test('pilote 12 équipes / 3 poules / 3 terrains : 18 matchs prêts', () => {
  const plan = planSchedule(configuration(3, 4, 3));
  assert.equal(plan.status, 'ready');
  if (plan.status === 'ready') {
    assert.equal(plan.matches.length, 18);
    assert.deepEqual(planSchedule(configuration(3, 4, 3)), plan, 'déterministe');
  }
});

test('configuration incomplète : raisons explicites, aucun placement tenté', () => {
  const base = configuration(2, 3, 1);
  const lonely = planSchedule({ ...base, pool_teams: base.pool_teams.slice(0, 4) });
  assert.equal(lonely.status, 'blocked');
  if (lonely.status === 'blocked') {
    assert(lonely.reasons.some((r) => r.includes('Poule 2 doit compter au moins deux équipes')));
    assert(lonely.reasons.some((r) => r.includes('dans aucune poule')));
  }
  const noAvailability = planSchedule({ ...base, availabilities: [] });
  assert.equal(noAvailability.status, 'blocked');
  assert.equal(planSchedule({ ...base, pools: [], pool_teams: [] }).status, 'blocked');
});

test('paramètres impossibles : signalés sans calendrier partiel', () => {
  const base = configuration(3, 4, 1);
  const short = planSchedule({ ...base, availabilities: [{ ...base.availabilities[0], ends_at: '2026-11-14T09:00:00Z' }] });
  assert.equal(short.status, 'impossible');
});

test('validation du calendrier enregistré : un match reporté n’est pas un conflit', () => {
  const base = configuration(1, 2, 1);
  const plan = planSchedule(base);
  assert.equal(plan.status, 'ready');
  if (plan.status !== 'ready') return;
  const stored = plan.matches.map((m, i) => ({ ...m, id: uuid(5, i), phase: 'POOL' as const, final_round: null, place_from: null, place_to: null, slot: null, status: 'SCHEDULED' as const, home_score: null, away_score: null, version: 1 }));
  assert.deepEqual(scheduleViolations({ ...base, matches: stored }), []);
  const postponed = stored.map((m) => ({ ...m, status: 'POSTPONED' as const, court_id: null, starts_at: null, ends_at: null }));
  assert.deepEqual(scheduleViolations({ ...base, matches: postponed }), []);
  const unplaced = stored.map((m) => ({ ...m, court_id: null, starts_at: null, ends_at: null }));
  assert.deepEqual(scheduleViolations({ ...base, matches: unplaced }).map((v) => v.code), ['unplaced']);
});

test('horaires alignés : calendrier du pilote sur une grille ancrée au début du tournoi', () => {
  const base = configuration(3, 4, 3);
  const plan = planSchedule({ ...base, rules: { ...base.rules, aligned_slots: true } });
  assert.equal(plan.status, 'ready');
  if (plan.status !== 'ready') return;
  const step = (20 + 10) * 60_000; // match + repos (plus long que la transition)
  assert(plan.matches.every((match) => (Date.parse(match.starts_at) - Date.parse('2026-11-14T08:00:00Z')) % step === 0));
  assert.equal(new Set(plan.matches.map((match) => match.starts_at)).size <= plan.matches.length / 3 + 1, true, 'les terrains démarrent ensemble');
});

test('phase de classement prévisionnelle : affiches indicatives, tours numérotés, horaires après les poules et la pause', async () => {
  const { placementForecast } = await import('../src/lib/tournaments/placement');
  const base = configuration(3, 4, 3);
  const withFormat = { ...base, rules: { ...base.rules, final_format: 'cross' as const, round_break_minutes: 30 } };
  const plan = planSchedule(withFormat);
  assert.equal(plan.status, 'ready');
  if (plan.status !== 'ready') return;
  const poolEnd = Math.max(...plan.matches.map((match) => Date.parse(match.ends_at)));
  const forecast = placementForecast(withFormat, plan.matches.map((match) => Date.parse(match.ends_at)));
  assert.deepEqual([forecast.filter((m) => m.round === 1).length, forecast.filter((m) => m.round === 2).length], [6, 6]);
  assert.deepEqual(forecast.map((m) => m.number), Array.from({ length: 12 }, (_, i) => i + 1));
  assert(forecast.filter((m) => m.round === 1).every((m) => /^\d+(er|e) Poule \d$/.test(m.home) && m.start >= poolEnd + 30 * 60_000), 'tour 1 : affiches par rang, après la pause');
  const round1End = Math.max(...forecast.filter((m) => m.round === 1).map((m) => m.end));
  assert(forecast.filter((m) => m.round === 2).every((m) => /^(Vainqueur|Perdant) du match \d+$/.test(m.home) && m.start >= round1End + 30 * 60_000));
  assert.deepEqual(placementForecast(base, plan.matches.map((match) => Date.parse(match.ends_at))), [], 'poules uniquement : rien à prévoir');
});

test('calendrier bloqué tant que le format du tournoi n’est pas choisi', () => {
  const base = configuration(3, 4, 3);
  const plan = planSchedule({ ...base, rules: { ...base.rules, final_format: null } });
  assert.equal(plan.status, 'blocked');
  if (plan.status === 'blocked') assert(plan.reasons.some((reason) => reason.includes('format du tournoi')));
});
