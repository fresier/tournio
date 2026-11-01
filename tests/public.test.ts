import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSnapshot, type SnapshotSource } from '../src/lib/public/snapshot';
import { countdown, matchState, nextMatch, scoreFor } from '../src/lib/public/view';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, P, K] = [u(1), u(2), u(3), u(10), u(20)];
const match = (n: number, home: string, away: string, start: string | null, status = 'SCHEDULED', score: [number, number] | null = null, validated = true) => ({
  id: u(100 + n), pool_id: P, home_team_id: home, away_team_id: away, court_id: start ? K : null,
  starts_at: start ? new Date(start) : null, ends_at: start ? new Date(Date.parse(start) + 20 * 60_000) : null, status,
  home_score: score?.[0] ?? null, away_score: score?.[1] ?? null, result_validated_at: score && validated ? new Date() : null,
});
const source = (matches: SnapshotSource['matches']): SnapshotSource & Record<string, unknown> => ({
  id: u(99), owner_id: u(98), created_at: new Date(), // champs privés : ne doivent jamais sortir
  name: 'Tournoi', slug: 'tournoi', sport: 'Volley', location: 'Bruxelles', timezone: 'Europe/Brussels',
  starts_at: new Date('2026-11-14T08:00:00Z'), ends_at: new Date('2026-11-14T17:00:00Z'), status: 'PUBLISHED', version: 4,
  rules: { allow_draw: true, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id'] },
  pools: [{ id: P, name: 'Poule A' }],
  teams: [{ id: A, name: 'Les Renards', slug: 'renards' }, { id: B, name: 'Les Éclairs', slug: 'eclairs' }, { id: C, name: 'Les Lynx', slug: 'lynx' }],
  pool_teams: [A, B, C].map((team_id) => ({ pool_id: P, team_id })),
  courts: [{ id: K, name: 'Terrain 1' }],
  matches,
});

test('instantané public : liste blanche, aucune donnée privée', () => {
  const snapshot = publicSnapshot(source([match(1, A, B, '2026-11-14T08:00:00Z')]));
  const text = JSON.stringify(snapshot);
  for (const secret of [u(98), u(99), 'owner_id', 'created_at', 'result_validated_at', 'rules']) assert(!text.includes(secret), secret);
  assert.deepEqual(Object.keys(snapshot.tournament).sort(), ['accent_color', 'ends_at', 'location', 'name', 'primary_color', 'slug', 'sport', 'starts_at', 'status', 'theme', 'timezone', 'version']);
});

test('instantané public : score visible seulement une fois validé, classement recalculé', () => {
  const snapshot = publicSnapshot(source([
    match(1, A, B, '2026-11-14T08:00:00Z', 'COMPLETED', [3, 1]),
    match(2, A, C, '2026-11-14T09:00:00Z', 'IN_PROGRESS'),
    match(3, B, C, '2026-11-14T10:00:00Z', 'COMPLETED', [2, 2], false),
  ]));
  assert.equal(snapshot.matches[0].home_score, 3);
  assert.equal(snapshot.matches[2].home_score, null, 'non validé : masqué');
  assert.deepEqual(snapshot.standings[0].rows.map((row) => [row.team_id, row.points]), [[A, 3], [C, 0], [B, 0]]);
});

test('prochain match : en cours, puis prévu le plus tôt, puis reporté', () => {
  const base = [match(1, A, B, '2026-11-14T08:00:00Z', 'COMPLETED', [1, 0]), match(2, C, A, '2026-11-14T10:00:00Z'), match(3, A, B, '2026-11-14T09:00:00Z')];
  assert.equal(nextMatch(publicSnapshot(source(base)), A)?.id, u(103));
  assert.equal(nextMatch(publicSnapshot(source([...base.slice(0, 2), match(3, A, B, '2026-11-14T09:00:00Z', 'IN_PROGRESS')])), A)?.id, u(103));
  assert.equal(nextMatch(publicSnapshot(source([match(4, A, B, null, 'POSTPONED')])), A)?.id, u(104));
  assert.equal(nextMatch(publicSnapshot(source([base[0]])), A), undefined, 'plus aucun match');
});

test('états affichés, retard et compte à rebours', () => {
  const snapshot = publicSnapshot(source([match(1, A, B, '2026-11-14T08:00:00Z')]));
  const m = snapshot.matches[0];
  assert.equal(matchState(m).tone, 'scheduled', 'sans horloge (rendu serveur) : jamais de retard');
  assert.equal(matchState(m, Date.parse('2026-11-14T07:50:00Z')).tone, 'scheduled');
  assert.equal(matchState(m, Date.parse('2026-11-14T08:05:00Z')).tone, 'late');
  assert.equal(countdown(m.starts_at!, Date.parse('2026-11-14T07:35:00Z')), 'dans 25 min');
  assert.equal(countdown(m.starts_at!, Date.parse('2026-11-14T06:55:00Z')), 'dans 1 h 05');
  assert.equal(countdown(m.starts_at!, Date.parse('2026-11-14T08:00:20Z')), 'maintenant');
  assert.equal(countdown(m.starts_at!, Date.parse('2026-11-14T08:10:00Z')), 'prévu il y a 10 min');
});

test('score du point de vue de l’équipe', () => {
  const snapshot = publicSnapshot(source([match(1, A, B, '2026-11-14T08:00:00Z', 'COMPLETED', [3, 1])]));
  assert.deepEqual(scoreFor(snapshot.matches[0], B), { text: '1 – 3', outcome: 'Défaite' });
  assert.deepEqual(scoreFor(snapshot.matches[0], A), { text: '3 – 1', outcome: 'Victoire' });
  assert.deepEqual(scoreFor(snapshot.matches[0]), { text: '3 – 1', outcome: null });
});

test('phase de classement à venir : l’équipe est prévenue de ses matchs restants', async () => {
  const { pendingPlacement } = await import('../src/lib/public/view');
  const base = publicSnapshot(source([match(1, A, B, '2026-11-14T08:00:00Z', 'COMPLETED', [3, 1])]));
  assert.equal(pendingPlacement(base, A), null, 'poules uniquement : rien à annoncer');
  const cross = { ...base, placement: { format: 'cross' as const, rounds: 2, ranking: null, standing: null } };
  assert.deepEqual(pendingPlacement(cross, A), { remaining: 2, waitingFor: 'pools' });
  const final = (round: number) => ({ ...base.matches[0], id: u(300 + round), pool_id: null, phase: 'FINAL' as const, final_round: round, place_from: 1, place_to: 4, status: 'COMPLETED' as const });
  assert.deepEqual(pendingPlacement({ ...cross, matches: [...cross.matches, final(1)] }, A), { remaining: 1, waitingFor: 1 });
  assert.equal(pendingPlacement({ ...cross, matches: [...cross.matches, final(1), final(2)] }, A), null, 'tous les tours générés');
  assert.equal(pendingPlacement({ ...cross, placement: { ...cross.placement, ranking: [A, B, C] } }, A), null, 'classement final connu');
});
