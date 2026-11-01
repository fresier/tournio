import assert from 'node:assert/strict';
import { configurationSchema, type TournamentConfiguration } from '../src/lib/tournaments/contracts';
import { request } from './test-http';

const names = ['Les Renards', 'Les Éclairs', 'Les Aigles', 'Les Lions', 'Les Loups', 'Les Faucons', 'Les Lynx', 'Les Panthères', 'Les Dragons', 'Les Tigres', 'Les Ours', 'Les Hiboux'];

/** Pilote 12 équipes / 3 poules / 3 terrains, créé par l’API comme le ferait l’organisateur. */
export async function createPilot(cookie: string, name: string, { publish = false, finalFormat = 'none' } = {}): Promise<TournamentConfiguration> {
  const created = await request('/api/v1/admin/tournaments', { method: 'POST', cookie, body: { name, slug: `pilote-${crypto.randomUUID().slice(0, 8)}`, sport: 'Volley', location: 'Bruxelles', timezone: 'Europe/Brussels', starts_at: '2026-11-14T08:00:00Z', ends_at: '2026-11-14T17:00:00Z' } });
  assert.equal(created.status, 201);
  let data = configurationSchema.parse((await created.json()).configuration);
  const endpoint = `/api/v1/admin/tournaments/${data.tournament.id}`;
  const send = async (path: string, method: string, operation: string, payload: unknown) => {
    const response = await request(path, { method, cookie, body: { operation, payload, expected_version: data.tournament.version } });
    assert.equal(response.status, 200, operation);
    data = configurationSchema.parse((await response.json()).configuration);
  };
  const mutate = (operation: string, payload: unknown) => send(endpoint, 'PATCH', operation, payload);
  for (let pool = 0; pool < 3; pool++) {
    await mutate('create_pool', { name: `Poule ${String.fromCharCode(65 + pool)}` });
    await mutate('create_court', { name: `Terrain ${pool + 1}` });
    for (let team = 0; team < 4; team++) {
      const index = pool * 4 + team;
      await mutate('create_team', { name: names[index], slug: `equipe-${index + 1}` });
      await mutate('assign_team', { team_id: data.teams.find((row) => row.slug === `equipe-${index + 1}`)!.id, pool_id: data.pools[pool].id });
    }
  }
  await mutate('save_rules', { match_duration_minutes: 30, transition_minutes: 5, minimum_rest_minutes: 15, allow_draw: false, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id'] });
  if (finalFormat !== 'none') await mutate('set_final_format', { final_format: finalFormat, round_break_minutes: 0 });
  if (publish) {
    await send(`${endpoint}/schedule`, 'POST', 'generate', { replace: false });
    await send(`${endpoint}/schedule`, 'POST', 'publish', {});
  }
  return data;
}
