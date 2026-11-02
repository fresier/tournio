import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSnapshot } from '../src/lib/public/snapshot';
import { courtStates, recentResults, standingPages } from '../src/lib/public/tv';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const teams = Array.from({ length: 8 }, (_, i) => ({ id: u(i + 1), name: `Équipe ${i + 1}`, slug: `e${i + 1}` }));
const [K1, K2, K3] = [u(21), u(22), u(23)];
const m = (n: number, court: string, hour: number, status = 'SCHEDULED', score: [number, number] | null = null) => ({
  id: u(100 + n), pool_id: n % 2 ? u(10) : u(11), home_team_id: teams[0].id, away_team_id: teams[1].id, court_id: court,
  starts_at: new Date(Date.UTC(2026, 10, 14, hour)), ends_at: new Date(Date.UTC(2026, 10, 14, hour, 30)), status,
  home_score: score?.[0] ?? null, away_score: score?.[1] ?? null, result_validated_at: score ? new Date() : null,
});
const snapshot = publicSnapshot({
  name: 'T', slug: 't', sport: 'Volley', location: '', timezone: 'Europe/Brussels', starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z', status: 'PUBLISHED', version: 1,
  rules: null, pools: [{ id: u(10), name: 'A' }, { id: u(11), name: 'B' }, { id: u(12), name: 'C' }],
  teams, pool_teams: teams.map((team, i) => ({ pool_id: i < 4 ? u(10) : i < 6 ? u(11) : u(12), team_id: team.id })),
  courts: [{ id: K1, name: 'Terrain 1' }, { id: K2, name: 'Terrain 2' }, { id: K3, name: 'Terrain 3' }],
  matches: [m(1, K1, 8, 'COMPLETED', [3, 1]), m(2, K1, 9, 'IN_PROGRESS'), m(3, K1, 10), m(4, K2, 9, 'COMPLETED', [0, 2]), m(5, K2, 11), m(6, K2, 12), m(7, K2, 13, 'CANCELLED')],
});

test('écran TV : chaque terrain conserve son match en cours et son prochain match', () => {
  assert.deepEqual(courtStates({ ...snapshot, matches: [...snapshot.matches].reverse() }).map((row) => [row.courtId, row.current?.id, row.next?.id]), [
    [K1, u(102), u(103)], [K2, undefined, u(105)], [K3, undefined, undefined],
  ]);
});

test('écran TV : le prochain match avance sur son terrain après un lancement', () => {
  const updated = { ...snapshot, matches: snapshot.matches.map((match) => match.id === u(105) ? { ...match, status: 'IN_PROGRESS' as const } : match) };
  assert.deepEqual(courtStates(updated).map((row) => [row.current?.id, row.next?.id]), [
    [u(102), u(103)], [u(105), u(106)], [undefined, undefined],
  ]);
});

test('écran TV : les matchs reportés ou sans horaire ne sont pas annoncés comme suivants', () => {
  const updated = { ...snapshot, matches: snapshot.matches.map((match) => match.id === u(105) ? { ...match, status: 'POSTPONED' as const } : match.id === u(106) ? { ...match, starts_at: null } : match) };
  assert.equal(courtStates(updated)[1].next, undefined);
});

test('écran TV : derniers résultats du plus récent au plus ancien', () => {
  assert.deepEqual(recentResults(snapshot, 5).map((row) => row.id), [u(104), u(101)]);
});

test('écran TV : classements paginés pour tenir à l’écran', () => {
  assert.deepEqual(standingPages(snapshot, 100), [[u(10), u(11), u(12)]]);
  assert.deepEqual(standingPages(snapshot, 10), [[u(10), u(11)], [u(12)]]);
  assert.deepEqual(standingPages(snapshot, 4), [[u(10)], [u(11)], [u(12)]], 'une poule trop grande reste seule sur sa page');
});
