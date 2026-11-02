import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { configurationSchema, type TournamentConfiguration } from '../src/lib/tournaments/contracts';
import { publicTournamentSchema } from '../src/lib/public/contracts';
import { assertIsolatedTestDatabase } from './test-database';
import { login, origin, request } from './test-http';
import { createPilot } from './test-pilot';

/** Phase de classement de bout en bout : format, tours, verrous, classement final et fin du tournoi. */
assertIsolatedTestDatabase();
const db = getPrisma();
let fixture: string | undefined;
let extra: string | undefined;
try {
  const cookie = await login('TEST_OWNER');
  let data: TournamentConfiguration = await createPilot(cookie, 'Pilote classement', { publish: true });
  fixture = data.tournament.id;
  const endpoint = `/api/v1/admin/tournaments/${data.tournament.id}`;
  const send = async (path: string, method: string, operation: string, payload: unknown, status = 200, version = data.tournament.version) => {
    const response = await request(path, { method, cookie, body: { operation, payload, expected_version: version } });
    const body = await response.json();
    assert.equal(response.status, status, `${operation} : ${JSON.stringify(body.error?.message ?? '')}`);
    if (response.ok) data = configurationSchema.parse(body.configuration);
    return body;
  };
  const configure = (operation: string, payload: unknown, status = 200) => send(endpoint, 'PATCH', operation, payload, status);
  const schedule = (operation: string, status = 200) => send(`${endpoint}/schedule`, 'POST', operation, {}, status);
  const result = async (matchId: string, home: number, away: number, status = 200) => {
    const match = data.matches.find((row) => row.id === matchId)!;
    return send(`${endpoint}/matches/${matchId}`, 'POST', 'record_result', { home_score: home, away_score: away }, status, match.version);
  };
  const publicSnapshot = async () => publicTournamentSchema.parse((await (await request(`/api/v1/tournaments/${data.tournament.slug}`)).json()).tournament);

  // Format : choisi après publication, refusé s’il ne convient pas aux poules (12 équipes).
  await configure('set_final_format', { final_format: 'bracket', round_break_minutes: 0 }, 422);
  await configure('set_final_format', { final_format: 'cross', round_break_minutes: 601 }, 422);
  await configure('set_final_format', { final_format: 'cross', round_break_minutes: 20 });
  assert.deepEqual([data.rules.final_format, data.rules.round_break_minutes], ['cross', 20]);
  await configure('save_rules', { match_duration_minutes: 30, transition_minutes: 5, minimum_rest_minutes: 15, allow_draw: false, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'scores_for', 'score_difference', 'team_id'] }, 409);
  // Ajouter un créneau après publication est permis (capacité en plus), en supprimer non.
  const court = data.courts[0];
  // Après publication : lever une indisponibilité est permis (capacité en plus), en ajouter une non.
  const slot = { court_id: court.id, starts_at: '2026-11-14T16:30:00Z', ends_at: '2026-11-14T17:00:00Z' };
  await configure('add_unavailability', slot, 409);
  await configure('remove_unavailability', slot);
  await configure('delete_availability', { id: data.availabilities[0].id }, 409);
  console.log('OK — Format de classement choisi après publication ; format impossible refusé ; règles toujours verrouillées.');

  // Avant la fin des poules : ni tour de classement, ni fin du tournoi.
  await schedule('generate_final_round', 409);
  const pools = data.matches.filter((match) => match.phase === 'POOL');
  // Lancement simultané d’un créneau : tout ou rien, une seule version de tournoi.
  const firstSlot = pools.filter((match) => match.starts_at === pools[0].starts_at);
  assert(firstSlot.length > 1, 'plusieurs matchs au premier créneau');
  const batch = { matches: firstSlot.map((match) => ({ id: match.id, expected_version: match.version })) };
  const before = data.tournament.version;
  const started = await request(`${endpoint}/matches`, { method: 'POST', cookie, body: batch });
  assert.equal(started.status, 200);
  data = configurationSchema.parse((await started.json()).configuration);
  assert(firstSlot.every((match) => data.matches.find((row) => row.id === match.id)!.status === 'IN_PROGRESS'));
  assert.equal(data.tournament.version, before + 1, 'une seule mise à jour publique');
  assert.equal((await request(`${endpoint}/matches`, { method: 'POST', cookie, body: batch })).status, 409, 'renvoi périmé refusé');
  assert.equal((await request(`${endpoint}/matches`, { method: 'POST', cookie, body: { matches: [] } })).status, 422);
  assert.equal((await request(`${endpoint}/matches`, { method: 'POST', cookie, body: { matches: [batch.matches[0], batch.matches[0]] } })).status, 422);
  console.log(`OK — ${firstSlot.length} matchs du premier créneau lancés d’un coup ; renvoi et lot invalide refusés.`);
  for (const [index, match] of pools.entries()) await result(match.id, 10 + (index % 5), 5 + (index % 3));
  await schedule('complete', 409);
  // Le HTML serveur sépare les fragments de texte par des commentaires React : on les retire.
  const teamPage = async () => (await (await request(`/t/${data.tournament.slug}/teams/${data.teams[0].slug}`)).text()).replaceAll("<!-- -->", "");
  let page = await teamPage();
  assert(page.includes('Phase de classement à venir') && page.includes('Encore 2 matchs') && page.includes('à la fin des poules'), 'équipe prévenue après ses matchs de poule');
  assert(!page.includes('Plus aucun match prévu'));

  // Tour 1 : construit depuis le classement général, placé après les poules.
  await schedule('generate_final_round');
  const round1 = data.matches.filter((match) => match.phase === 'FINAL');
  assert.equal(round1.length, 6, '12 équipes : 6 matchs au tour 1');
  assert(round1.every((match) => match.pool_id === null && match.final_round === 1 && match.starts_at));
  const lastPoolEnd = Math.max(...pools.map((match) => Date.parse(data.matches.find((row) => row.id === match.id)!.ends_at!)));
  assert(round1.every((match) => Date.parse(match.starts_at!) >= lastPoolEnd + 20 * 60_000), 'le tour 1 commence après les poules et la pause de 20 min');
  assert(round1.some((match) => Date.parse(match.starts_at!) === lastPoolEnd + 20 * 60_000), 'le tour 1 commence dès la fin de la pause');
  assert.equal(new Set(round1.flatMap((match) => [match.home_team_id, match.away_team_id])).size, 12, 'chaque équipe joue une fois');
  assert.deepEqual([...new Set(round1.map((match) => match.place_from))].sort((a, b) => a! - b!), [1, 5, 9]);
  await schedule('generate_final_round', 409);
  // Les poules sont figées, un match de classement ne peut pas finir sur un nul ni être annulé.
  await result(pools[0].id, 0, 9, 409);
  await result(round1[0].id, 7, 7, 422);
  const cancel = await request(`${endpoint}/matches/${round1[0].id}`, { method: 'POST', cookie, body: { operation: 'cancel', payload: {}, expected_version: round1[0].version } });
  assert.equal(cancel.status, 409);
  // Un tour pas encore commencé peut être annulé puis régénéré à l’identique.
  await schedule('cancel_final_round');
  assert.equal(data.matches.filter((match) => match.phase === 'FINAL').length, 0);
  await schedule('generate_final_round');
  const fixtures = (matches: TournamentConfiguration['matches']) => matches.map((match) => `${match.place_from}:${match.home_team_id}-${match.away_team_id}@${match.court_id}${match.starts_at}`).sort();
  assert.deepEqual(fixtures(data.matches.filter((match) => match.phase === 'FINAL')), fixtures(round1), 'mêmes affiches, terrains et horaires');
  const tournamentPage = (await (await request(`/t/${data.tournament.slug}`)).text()).replaceAll('<!-- -->', '');
  // Pendant la phase de classement, le classement du tournoi (plages de places) remplace ceux des poules.
  for (const text of ['Classement du tournoi', 'En lice pour les places 1 à 4', 'En lice pour les places 9 à 12']) assert(tournamentPage.includes(text), `page publique : « ${text} »`);
  assert(!tournamentPage.includes('Classements</h2>') && !tournamentPage.includes('Phase de classement</h2>'), 'plus de classements de poule ni de résultats des autres tours');
  assert((await teamPage()).includes('Classement du tournoi'));
  const snapshotRound1 = await publicSnapshot();
  assert.equal(snapshotRound1.placement.standing?.length, 12);
  console.log('OK — Tour 1 croisé : 6 matchs après les poules, poules figées, nul et annulation refusés, tour annulable et reproductible.');

  // Tour 2 : gagnants entre eux, perdants entre eux ; le tour 1 devient figé.
  for (const match of data.matches.filter((row) => row.phase === 'FINAL')) await result(match.id, 15, 11);
  assert.equal((await publicSnapshot()).placement.ranking, null);
  page = await teamPage();
  assert(page.includes('Encore 1 match') && page.includes('à la fin du tour 1'), 'équipe prévenue entre deux tours');
  // La génération d’un tour est diffusée en direct aux pages publiques ouvertes (TV, téléphones).
  const sseAbort = new AbortController();
  const sse = await fetch(`${origin}/api/v1/tournaments/${data.tournament.slug}/events`, { signal: sseAbort.signal });
  const reader = sse.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  const waitFor = async (event: string) => {
    const timer = setTimeout(() => sseAbort.abort(), 15_000);
    try {
      for (;;) {
        const index = buffer.indexOf(`event: ${event}\n`);
        if (index >= 0) { const end = buffer.indexOf('\n\n', index); if (end >= 0) { const block = buffer.slice(index, end); buffer = buffer.slice(end + 2); return JSON.parse(block.split('\n').find((line) => line.startsWith('data: '))!.slice(6)); } }
        const { value, done } = await reader.read();
        if (done) throw new Error('Flux SSE fermé.');
        buffer += value;
      }
    } finally { clearTimeout(timer); }
  };
  await waitFor('ready');
  await schedule('generate_final_round');
  assert.equal((await waitFor('tournament.updated')).version, data.tournament.version, 'tour 2 signalé en direct');
  sseAbort.abort();
  const round2 = data.matches.filter((match) => match.final_round === 2);
  const round1End = Math.max(...data.matches.filter((match) => match.final_round === 1).map((match) => Date.parse(match.ends_at!)));
  assert.equal(Math.min(...round2.map((match) => Date.parse(match.starts_at!))), round1End + 20 * 60_000, 'pause de 20 min entre les tours');
  assert.equal(round2.length, 6);
  assert.deepEqual(round2.map((match) => `${match.place_from}-${match.place_to}`).sort(), ['1-2', '11-12', '3-4', '5-6', '7-8', '9-10']);
  const firstWinners = data.matches.filter((match) => match.final_round === 1).map((match) => match.home_team_id);
  const final = round2.find((match) => match.place_from === 1)!;
  assert(firstWinners.includes(final.home_team_id) && firstWinners.includes(final.away_team_id), 'la finale oppose deux gagnants du tour 1');
  await result(data.matches.find((match) => match.final_round === 1)!.id, 1, 20, 409);
  await schedule('complete', 409);
  for (const match of round2) await result(match.id, 21, 19);

  // Classement final public, tournoi terminé.
  const snapshot = await publicSnapshot();
  assert.equal(snapshot.placement.format, 'cross');
  assert.equal(snapshot.placement.rounds, 2);
  assert.equal(snapshot.placement.ranking?.length, 12);
  assert.equal(new Set(snapshot.placement.ranking).size, 12);
  assert.equal(snapshot.placement.ranking![0], final.home_team_id, 'le vainqueur de la finale est premier');
  assert(snapshot.matches.some((match) => match.phase === 'FINAL' && match.place_from === 1 && match.place_to === 2));
  assert(!(await teamPage()).includes('Phase de classement à venir'), 'plus rien à annoncer une fois le classement connu');
  await schedule('generate_final_round', 409);
  await configure('set_final_format', { final_format: 'rank', round_break_minutes: 0 }, 409);
  await schedule('complete');
  assert.equal(data.tournament.status, 'COMPLETED');
  for (const path of [`/t/${data.tournament.slug}`, `/t/${data.tournament.slug}/tv`]) assert((await (await request(path)).text()).includes('Classement final'), `${path} affiche le classement final`);
  console.log('OK — Tour 2 et classement final des 12 places, publié ; tour 1 figé ; tournoi terminé seulement après toutes les places.');

  // Groupe incomplet : 11 équipes (4 + 4 + 3) en « Croisé en deux tours », refusé sans l’option, accepté avec.
  let odd: TournamentConfiguration = await createPilot(cookie, 'Pilote incomplet', { publish: true, poolSizes: [4, 4, 3] });
  extra = odd.tournament.id;
  const oddEndpoint = `/api/v1/admin/tournaments/${odd.tournament.id}`;
  const oddSend = async (path: string, operation: string, payload: unknown, status = 200, version = odd.tournament.version) => {
    const response = await request(path, { method: path.endsWith('/schedule') ? 'POST' : path.includes('/matches/') ? 'POST' : 'PATCH', cookie, body: { operation, payload, expected_version: version } });
    const body = await response.json();
    assert.equal(response.status, status, `${operation} : ${JSON.stringify(body.error?.message ?? '')}`);
    if (response.ok) odd = configurationSchema.parse(body.configuration);
  };
  await oddSend(oddEndpoint, 'set_final_format', { final_format: 'cross', round_break_minutes: 0 }, 422);
  await oddSend(oddEndpoint, 'set_final_format', { final_format: 'cross', round_break_minutes: 0, allow_incomplete: true });
  for (const match of odd.matches.filter((row) => row.phase === 'POOL')) await oddSend(`${oddEndpoint}/matches/${match.id}`, 'record_result', { home_score: 15, away_score: 9 }, 200, match.version);
  await oddSend(`${oddEndpoint}/schedule`, 'generate_final_round', {});
  const oddRound1 = odd.matches.filter((row) => row.final_round === 1);
  assert.deepEqual(oddRound1.map((row) => `${row.place_from}-${row.place_to}`).sort(), ['1-4', '1-4', '5-8', '5-8', '9-11', '9-11', '9-11'], 'groupe de 3 : mini-championnat de 3 matchs dès le tour 1');
  for (const match of oddRound1) await oddSend(`${oddEndpoint}/matches/${match.id}`, 'record_result', { home_score: 15, away_score: 9 }, 200, match.version);
  await oddSend(`${oddEndpoint}/schedule`, 'generate_final_round', {});
  const oddRound2 = odd.matches.filter((row) => row.final_round === 2);
  assert.equal(oddRound2.length, 4, 'tour 2 : seulement les groupes complets');
  for (const match of oddRound2) await oddSend(`${oddEndpoint}/matches/${match.id}`, 'record_result', { home_score: 15, away_score: 9 }, 200, match.version);
  const oddSnapshot = publicTournamentSchema.parse((await (await request(`/api/v1/tournaments/${odd.tournament.slug}`)).json()).tournament);
  assert.equal(oddSnapshot.placement.ranking?.length, 11);
  assert.equal(new Set(oddSnapshot.placement.ranking).size, 11);
  const played = (team: string) => odd.matches.filter((row) => row.phase === 'FINAL' && (row.home_team_id === team || row.away_team_id === team)).length;
  assert(oddSnapshot.placement.ranking!.every((team) => played(team) === 2), 'chaque équipe joue 2 matchs de classement, groupe de 3 compris');
  await oddSend(`${oddEndpoint}/schedule`, 'complete', {});
  console.log('OK — Groupe incomplet (11 équipes, croisé) : mini-championnat à 3, 2 matchs pour chaque équipe, classement final des 11 places.');
} finally {
  if (extra) await db.tournament.delete({ where: { id: extra } }).catch(() => {});
  if (fixture) await db.tournament.delete({ where: { id: fixture } }).catch(() => {});
  await db.$disconnect();
}
