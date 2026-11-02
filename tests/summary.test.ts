import assert from 'node:assert/strict';
import test from 'node:test';
import { kpis } from '../src/components/tournaments/configuration-summary';
import type { TournamentConfiguration } from '../src/lib/tournaments/contracts';

const T = '00000000-0000-4000-8000-000000000000';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = (): TournamentConfiguration => ({
  tournament: { id: T, name: 'T', slug: 't', sport: 'Volley', location: '', timezone: 'Europe/Brussels', starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z', status: 'DRAFT', published_at: null, theme: 'tournio', primary_color: null, accent_color: null, version: 1, created_at: '', updated_at: '' },
  rules: { tournament_id: T, match_duration_minutes: 20, transition_minutes: 5, minimum_rest_minutes: 10, allow_draw: true, aligned_slots: false, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: [], final_format: 'none', round_break_minutes: 0, allow_incomplete: false },
  teams: [1, 2, 3].map((n) => ({ id: id(n), tournament_id: T, name: `É${n}`, slug: `e${n}`, created_at: '', updated_at: '' })),
  pools: [{ id: id(10), tournament_id: T, name: 'A', sort_order: 0 }],
  courts: [{ id: id(20), tournament_id: T, name: 'T1', sort_order: 0 }, { id: id(21), tournament_id: T, name: 'T2', sort_order: 1 }],
  pool_teams: [1, 2].map((n) => ({ tournament_id: T, pool_id: id(10), team_id: id(n) })),
  availabilities: [{ id: id(30), tournament_id: T, court_id: id(20), starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T10:30:00Z' }],
  matches: [], match_count: 0,
});

test('indicateurs : points à régler signalés et liés à leur section', () => {
  const [matches, teams, pools, courts] = kpis(base());
  assert.deepEqual([matches.detail, matches.target, matches.warn], ['Calendrier à générer', 'schedule', true]);
  assert.deepEqual([teams.value, teams.detail, teams.warn, Math.round(teams.progress!)], ['3', '1 sans poule', true, 67]);
  assert.deepEqual([pools.detail, pools.warn], ['2 équipes chacune', false]);
  assert.deepEqual([courts.detail, courts.warn], ['1 sans disponibilité', true]);
});

test('indicateurs : avancement des matchs et créneaux', () => {
  const data = base();
  data.availabilities.push({ id: id(31), tournament_id: T, court_id: id(21), starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T09:00:00Z' });
  const match = (n: number, status: TournamentConfiguration['matches'][number]['status']) => ({ id: id(40 + n), pool_id: id(10), phase: 'POOL' as const, final_round: null, place_from: null, place_to: null, slot: null,  home_team_id: id(1), away_team_id: id(2), court_id: id(20), starts_at: null, ends_at: null, status, home_score: null, away_score: null, version: 1 });
  data.matches = [match(1, 'COMPLETED'), match(2, 'IN_PROGRESS'), match(3, 'SCHEDULED'), match(4, 'CANCELLED')];
  const [matches, , , courts] = kpis(data);
  assert.deepEqual([matches.value, matches.detail, matches.progress, matches.target], ['2 / 4', '1 match en cours', 50, 'results']);
  assert.equal(courts.detail, '3 h 30 de créneaux');
});
