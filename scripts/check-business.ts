import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { configurationSchema, schedulePreviewSchema } from '../src/lib/tournaments/contracts';
import { request, login, origin } from './test-http';
import { publicTournamentSchema } from '../src/lib/public/contracts';
import { assertIsolatedTestDatabase } from './test-database';

assertIsolatedTestDatabase();
const db = getPrisma();
const fixtures: string[] = [];
const input = (slug: string) => ({ name:'Tournoi de vérification', slug, sport:'Multisport', location:'Bruxelles', timezone:'Europe/Brussels', starts_at:'2026-11-14T08:00:00Z', ends_at:'2026-11-14T17:00:00Z' });
try {
  const anonymous = await request('/dashboard', { redirect: 'manual' });
  assert([303,307].includes(anonymous.status)); assert(anonymous.headers.get('location')?.includes('/login'));
  assert.equal((await request('/api/v1/admin/tournaments')).status,401);
  const owner = await login('TEST_OWNER');
  const other = await login('TEST_OTHER');
  const dashboard = await request('/dashboard', { cookie: owner });
  assert.equal(dashboard.status,200); assert((await dashboard.text()).includes('Tournoi de démonstration'));
  assert.equal((await request('/dashboard/tournaments/new', { cookie: owner })).status,200);
  const create = async (cookie: string) => {
    const response = await request('/api/v1/admin/tournaments', { method:'POST', cookie, body:input(`test-${crypto.randomUUID()}`) });
    assert.equal(response.status,201);
    const value = configurationSchema.parse((await response.json()).configuration); fixtures.push(value.tournament.id); return value;
  };
  let data = await create(owner);
  const foreign = await create(other);
  const endpoint = `/api/v1/admin/tournaments/${data.tournament.id}`;
  assert.equal((await request(endpoint, {cookie:other})).status,404);
  const otherList = (await (await request('/api/v1/admin/tournaments',{cookie:other})).json()).tournaments;
  assert(!otherList.some((t: {id:string})=>t.id===data.tournament.id));
  const parentConfig = await request(`/dashboard/tournaments/${data.tournament.id}`,{cookie:owner});
  assert.equal(parentConfig.status,200); assert((await parentConfig.text()).includes('Informations du tournoi'));
  assert.equal((await request('/api/v1/admin/tournaments',{method:'POST',cookie:owner,body:{...input(`bad-${crypto.randomUUID()}`),owner_id:crypto.randomUUID()}})).status,422);
  assert.equal((await request('/api/v1/admin/tournaments',{method:'POST',cookie:owner,body:input(data.tournament.slug)})).status,409);
  console.log('OK — Dashboard protégé, création et isolation de deux organisateurs.');

  async function mutate(operation: string, payload: unknown, status=200) {
    const response = await request(endpoint,{method:'PATCH',cookie:owner,body:{operation,payload,expected_version:data.tournament.version}});
    assert.equal(response.status,status,`Mutation ${operation}`);
    if(response.ok) data=configurationSchema.parse((await response.json()).configuration);
  }
  await mutate('create_team',{name:'Équipe A',slug:'equipe-a'});
  await mutate('create_team',{name:'Équipe B',slug:'equipe-b'});
  await mutate('create_pool',{name:'Poule A'});
  const teamA=data.teams[0]; const teamB=data.teams[1]; const pool=data.pools[0];
  await mutate('assign_team',{team_id:teamA.id,pool_id:pool.id});
  await mutate('assign_team',{team_id:teamB.id,pool_id:pool.id});
  assert.equal(data.pool_teams.length,2);
  // Tirage au sort : équilibré, puis seulement les équipes sans poule ; ensuite, retour à la poule unique.
  await mutate('create_pool',{name:'Poule tirage'});
  await mutate('draw_pools',{mode:'all'});
  assert.deepEqual(data.pools.map((p)=>data.pool_teams.filter((row)=>row.pool_id===p.id).length),[1,1],'deux équipes, deux poules : une chacune');
  await mutate('draw_pools',{mode:'unassigned'},422);
  await mutate('assign_team',{team_id:teamB.id,pool_id:null});
  const lonely=data.pools.find((p)=>!data.pool_teams.some((row)=>row.pool_id===p.id))!;
  await mutate('draw_pools',{mode:'unassigned'});
  assert.equal(data.pool_teams.find((row)=>row.team_id===teamB.id)?.pool_id,lonely.id,'l’équipe sans poule rejoint la poule vide');
  await mutate('delete_pool',{id:data.pools.find((p)=>p.name==='Poule tirage')!.id});
  for (const team of [teamA,teamB]) await mutate('assign_team',{team_id:team.id,pool_id:pool.id});
  assert.equal(data.pool_teams.length,2);
  await mutate('update_team',{id:teamA.id,name:'Les Renards',slug:'les-renards'});
  await mutate('update_pool',{id:pool.id,name:'Poule principale'});
  await mutate('create_court',{name:'Terrain 1'});
  const court=data.courts[0];
  await mutate('update_court',{id:court.id,name:'Terrain principal'});
  // Un terrain est disponible pendant tout le tournoi ; l’organisateur n’indique que les indisponibilités.
  const windows = () => data.availabilities.filter((row) => row.court_id === court.id).map((row) => `${row.starts_at.slice(11, 16)}-${row.ends_at.slice(11, 16)}`).sort();
  assert.deepEqual(windows(), ['08:00-17:00']);
  const off = (starts: string, ends: string, status = 200, operation = 'add_unavailability') => mutate(operation, { court_id: court.id, starts_at: `2026-11-14T${starts}:00Z`, ends_at: `2026-11-14T${ends}:00Z` }, status);
  await off('10:00', '11:00');
  await off('09:30', '10:30'); // chevauche la précédente : cumul
  assert.deepEqual(windows(), ['08:00-09:30', '11:00-17:00']);
  await off('06:00', '07:30', 422); // hors du tournoi
  await mutate('create_availability', { court_id: court.id, starts_at: '2026-11-14T12:00:00Z', ends_at: '2026-11-14T13:00:00Z' }, 422); // déjà disponible
  await off('09:30', '11:00', 200, 'remove_unavailability');
  assert.deepEqual(windows(), ['08:00-17:00']);
  await off('12:00', '13:00');
  // Nouvelles dates : les indisponibilités sont conservées, le reste suit la période.
  await mutate('update_tournament', { ...input(data.tournament.slug), name: 'Tournoi renommé', starts_at: '2026-11-14T09:00:00Z', ends_at: '2026-11-14T18:00:00Z' });
  assert.deepEqual(windows(), ['09:00-12:00', '13:00-18:00']);
  await mutate('update_tournament', { ...input(data.tournament.slug), name: 'Tournoi renommé' });
  assert.deepEqual(windows(), ['08:00-12:00', '13:00-17:00']);
  await mutate('save_rules',{match_duration_minutes:25,transition_minutes:5,minimum_rest_minutes:10,allow_draw:false,points_win:3,points_draw:1,points_loss:0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id']});
  assert.equal(data.rules.allow_draw,false);
  console.log('OK — Équipes, poules (tirage au sort compris), terrains (disponibles par défaut, indisponibilités, changement de dates) et règles configurables.');

  const foreignResponse=await request(`/api/v1/admin/tournaments/${foreign.tournament.id}`,{method:'PATCH',cookie:other,body:{operation:'create_pool',payload:{name:'Poule étrangère'},expected_version:foreign.tournament.version}});
  assert.equal(foreignResponse.status,200);
  const foreignData=configurationSchema.parse((await foreignResponse.json()).configuration);
  await mutate('assign_team',{team_id:teamA.id,pool_id:foreignData.pools[0].id},404);
  assert.equal((await request(endpoint,{method:'PATCH',cookie:other,body:{operation:'delete_team',payload:{id:teamA.id},expected_version:data.tournament.version}})).status,404);
  assert.equal((await request(endpoint,{method:'PATCH',cookie:owner,requestOrigin:'https://example.invalid',body:{operation:'delete_team',payload:{id:teamA.id},expected_version:data.tournament.version}})).status,403);
  await assert.rejects(db.poolTeam.create({data:{tournament_id:data.tournament.id,team_id:teamA.id,pool_id:foreignData.pools[0].id}}));
  const version=data.tournament.version;
  const concurrent=await Promise.all(['Concurrent A','Concurrent B'].map((name)=>request(endpoint,{method:'PATCH',cookie:owner,body:{operation:'create_team',payload:{name,slug:name.toLowerCase().replace(' ','-')},expected_version:version}})));
  assert.deepEqual(concurrent.map((response)=>response.status).sort(),[200,409]);
  data=configurationSchema.parse((await (await request(endpoint,{cookie:owner})).json()).configuration);
  assert.equal(data.tournament.version,version+1);
  assert.equal(data.teams.length,3);
  console.log('OK — Références étrangères, CSRF et écritures concurrentes protégées.');

  await assert.rejects(db.match.create({data:{tournament_id:data.tournament.id,pool_id:pool.id,home_team_id:teamA.id,away_team_id:teamA.id}}));
  const match=await db.match.create({data:{tournament_id:data.tournament.id,pool_id:pool.id,home_team_id:teamA.id,away_team_id:teamB.id}});
  await assert.rejects(db.match.create({data:{tournament_id:data.tournament.id,pool_id:pool.id,home_team_id:teamB.id,away_team_id:teamA.id}}));
  await assert.rejects(db.match.update({where:{id:match.id},data:{status:'COMPLETED',home_score:0,away_score:0,result_validated_at:new Date()}}));
  await mutate('create_team',{name:'Interdit après calendrier',slug:'interdit'},409);
  await db.match.delete({where:{id:match.id}});
  await mutate('delete_availability',{id:data.availabilities[0].id});
  await mutate('delete_court',{id:court.id}); assert.equal(data.availabilities.length,0);
  await mutate('delete_pool',{id:pool.id}); assert.equal(data.pool_teams.length,0);
  await mutate('delete_team',{id:teamA.id}); assert.equal(data.teams.length,2);
  const demoUser=await db.user.findUniqueOrThrow({where:{email:process.env.TEST_OWNER_EMAIL!}});
  const demo=await db.tournament.findFirstOrThrow({where:{owner_id:demoUser.id,slug:`demo-${demoUser.id.replaceAll('-','').slice(0,12)}`},include:{_count:{select:{teams:true,pools:true,courts:true,pool_teams:true}}}});
  assert.deepEqual(demo._count,{teams:12,pools:3,courts:3,pool_teams:12});
  console.log('OK — Intégrité des matchs, suppressions cohérentes et seed 12 équipes / 3 poules / 3 terrains.');

  // Lot E : prévisualisation, enregistrement, déplacements, publication et archivage du calendrier.
  let plan = await create(owner);
  const planEndpoint = `/api/v1/admin/tournaments/${plan.tournament.id}`;
  const scheduleEndpoint = `${planEndpoint}/schedule`;
  const configure = async (operation: string, payload: unknown, status = 200) => {
    const response = await request(planEndpoint, { method: 'PATCH', cookie: owner, body: { operation, payload, expected_version: plan.tournament.version } });
    assert.equal(response.status, status, `Configuration ${operation}`);
    if (response.ok) plan = configurationSchema.parse((await response.json()).configuration);
  };
  const schedule = async (operation: string, payload: unknown, status = 200, expected_version = plan.tournament.version, cookie = owner) => {
    const response = await request(scheduleEndpoint, { method: 'POST', cookie, body: { operation, payload, expected_version } });
    assert.equal(response.status, status, `Calendrier ${operation}`);
    if (response.ok) plan = configurationSchema.parse((await response.json()).configuration);
  };
  const preview = async () => {
    const response = await request(scheduleEndpoint, { cookie: owner });
    assert.equal(response.status, 200);
    return schedulePreviewSchema.parse((await response.json()).preview);
  };
  assert.equal((await preview()).status, 'blocked');
  for (let p = 0; p < 3; p++) {
    await configure('create_pool', { name: `Poule ${p + 1}` });
    await configure('create_court', { name: `Terrain ${p + 1}` });
    for (let t = 0; t < 4; t++) {
      await configure('create_team', { name: `Équipe ${p * 4 + t + 1}`, slug: `equipe-${p * 4 + t + 1}` });
      await configure('assign_team', { team_id: plan.teams.at(-1)!.id, pool_id: plan.pools[p].id });
    }
  }
  const first = await preview();
  assert.equal(first.status, 'ready'); assert.equal(first.matches.length, 18); assert.deepEqual(first.save_blockers, []);
  assert.equal(await db.match.count({ where: { tournament_id: plan.tournament.id } }), 0, 'la prévisualisation n’écrit rien');
  assert.equal((await request(scheduleEndpoint, { cookie: other })).status, 404);
  await schedule('generate', { replace: false }, 404, plan.tournament.version, other);
  // Horaires alignés : prévisualisation sur une grille de 30 min (20 de jeu + 10 de repos) ancrée à 08:00.
  await configure('save_rules', { match_duration_minutes: 20, transition_minutes: 5, minimum_rest_minutes: 10, allow_draw: true, aligned_slots: true, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id'] });
  const aligned = await preview();
  assert.equal(aligned.status, 'ready');
  assert(aligned.matches.every((match) => (Date.parse(match.starts_at) - Date.parse('2026-11-14T08:00:00Z')) % (30 * 60_000) === 0), 'départs alignés');
  await configure('save_rules', { match_duration_minutes: 20, transition_minutes: 5, minimum_rest_minutes: 10, allow_draw: true, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id'] });
  await schedule('generate', { replace: false }, 409, first.version);
  const fresh = await preview();
  await schedule('generate', { replace: false }, 200, fresh.version);
  assert.equal(plan.matches.length, 18);
  const signature = (rows: { home_team_id: string; away_team_id: string; court_id: string | null; starts_at: string | null }[]) => rows.map((m) => `${m.home_team_id}|${m.away_team_id}|${m.court_id}|${new Date(m.starts_at!).toISOString()}`).sort();
  assert.deepEqual(signature(plan.matches), signature(fresh.matches), 'le calendrier enregistré est celui prévisualisé');
  await configure('create_team', { name: 'Après calendrier', slug: 'apres-calendrier' }, 409);
  await schedule('generate', { replace: false }, 409);
  await schedule('generate', { replace: true });
  assert.equal(await db.match.count({ where: { tournament_id: plan.tournament.id } }), 18);
  const [m0, m1] = plan.matches;
  await schedule('move_match', { match_id: m1.id, court_id: m0.court_id, starts_at: m0.starts_at }, 422);
  await schedule('move_match', { match_id: m1.id, court_id: m0.court_id, starts_at: '2026-11-14T16:00:00Z' });
  assert.equal(plan.matches.find((m) => m.id === m1.id)!.starts_at?.startsWith('2026-11-14T16:00:00'), true);
  await schedule('move_match', { match_id: m1.id, court_id: m0.court_id, starts_at: '2026-11-14T16:50:00Z' }, 422, plan.tournament.version);
  // Lot F : un brouillon est invisible, même avec un calendrier enregistré.
  assert.equal((await request(`/api/v1/tournaments/${plan.tournament.slug}`)).status, 404);
  assert.equal((await request(`/t/${plan.tournament.slug}`)).status, 404);
  assert.equal((await request(`/t/${plan.tournament.slug}/tv`)).status, 404, 'écran TV d’un brouillon');
  assert.equal((await request(`/api/v1/tournaments/${plan.tournament.slug}/events`)).status, 404);
  await schedule('publish', {});
  assert.equal(plan.tournament.status, 'PUBLISHED');
  assert(plan.tournament.published_at);
  const publicApi = `/api/v1/tournaments/${plan.tournament.slug}`;
  const publicResponse = await request(publicApi);
  assert.equal(publicResponse.status, 200);
  const publicText = await publicResponse.text();
  for (const secret of ['owner_id', 'email', 'availabilities', 'result_validated_at', plan.tournament.id]) assert(!publicText.includes(secret), `donnée privée exposée : ${secret}`);
  let snapshot = publicTournamentSchema.parse(JSON.parse(publicText).tournament);
  assert.equal(snapshot.matches.length, 18); assert.equal(snapshot.teams.length, 12); assert.equal(snapshot.standings.length, 3);
  const publicPage = await request(`/t/${plan.tournament.slug}`);
  assert.equal((await request(`/t/${plan.tournament.slug}/tv`)).status, 200, 'écran TV publié');
  assert.equal(publicPage.status, 200); assert((await publicPage.text()).includes('Quelle est votre équipe'));
  const teamPage = await request(`/t/${plan.tournament.slug}/teams/${plan.teams[0].slug}`);
  assert.equal(teamPage.status, 200); assert((await teamPage.text()).includes('Prochain match'));
  assert.equal((await request(`/t/${plan.tournament.slug}/teams/equipe-inconnue`)).status, 404);
  assert.equal((await request('/t/tournoi-inexistant')).status, 404);
  assert.equal((await request(`/api/v1/tournaments/${data.tournament.slug}`)).status, 404, 'brouillon invisible');

  const sseAbort = new AbortController();
  const sse = await fetch(`${origin}${publicApi}/events`, { signal: sseAbort.signal });
  assert.equal(sse.status, 200); assert(sse.headers.get('content-type')?.includes('text/event-stream'));
  const sseReader = sse.body!.getReader(); const sseDecoder = new TextDecoder(); let sseBuffer = '';
  const nextEvent = async (wanted: string) => {
    const timer = setTimeout(() => sseAbort.abort(), 15000);
    try {
      while (true) {
        for (let index = sseBuffer.indexOf('\n\n'); index >= 0; index = sseBuffer.indexOf('\n\n')) {
          const block = sseBuffer.slice(0, index); sseBuffer = sseBuffer.slice(index + 2);
          if (block.split('\n').find((line) => line.startsWith('event: '))?.slice(7) === wanted) return JSON.parse(block.split('\n').find((line) => line.startsWith('data: '))?.slice(6) || '{}');
        }
        const chunk = await sseReader.read();
        if (chunk.done) throw new Error('Flux SSE public fermé.');
        sseBuffer += sseDecoder.decode(chunk.value, { stream: true });
      }
    } finally { clearTimeout(timer); }
  };
  try {
    await nextEvent('ready');
    await schedule('move_match', { match_id: m1.id, court_id: m0.court_id!, starts_at: '2026-11-14T16:30:00Z' });
    const signal = await nextEvent('tournament.updated') as { version: number };
    assert.equal(signal.version, plan.tournament.version, 'le signal public porte la nouvelle version');
    assert.deepEqual(Object.keys(signal), ['version'], 'le signal ne transporte aucune donnée');
  } finally { sseAbort.abort(); }
  snapshot = publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament);
  assert.equal(snapshot.tournament.version, plan.tournament.version);
  assert(snapshot.matches.find((m) => m.id === m1.id)!.starts_at!.startsWith('2026-11-14T16:30:00'));
  console.log('OK — Pages publiques : brouillon invisible, instantané sans donnée privée, équipe et SSE après déplacement.');
  await schedule('generate', { replace: true }, 409);
  await schedule('clear', {}, 409);
  await schedule('publish', {}, 409);
  assert.equal((await request(scheduleEndpoint, { method: 'POST', cookie: owner, requestOrigin: 'https://example.invalid', body: { operation: 'archive', payload: {}, expected_version: plan.tournament.version } })).status, 403);
  await db.match.update({ where: { id: m0.id }, data: { status: 'COMPLETED', home_score: 2, away_score: 1, result_validated_at: new Date() } });
  await schedule('move_match', { match_id: m0.id, court_id: m0.court_id!, starts_at: '2026-11-14T15:00:00Z' }, 409);
  const scored = publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament);
  assert.equal(scored.matches.find((m) => m.id === m0.id)!.home_score, 2);
  assert.equal(scored.standings.flatMap((pool) => pool.rows).find((row) => row.team_id === m0.home_team_id)!.points, 3, 'classement public recalculé');
  // Lot G : résultats et états des matchs.
  const matchUrl = (matchId: string) => `${planEndpoint}/matches/${matchId}`;
  const matchNow = (matchId: string) => plan.matches.find((m) => m.id === matchId)!;
  const act = async (matchId: string, operation: string, payload: unknown, status = 200, cookie = owner, version = matchNow(matchId).version) => {
    const response = await request(matchUrl(matchId), { method: 'POST', cookie, body: { operation, payload, expected_version: version } });
    assert.equal(response.status, status, `Match ${operation}`);
    if (response.ok) plan = configurationSchema.parse((await response.json()).configuration);
    return response;
  };
  const [, , g2, g3, g4] = plan.matches.filter((m) => m.status === 'SCHEDULED');
  assert.equal((await request(matchUrl(g2.id), { method: 'POST', body: { operation: 'start', payload: {}, expected_version: g2.version } })).status, 401);
  await act(g2.id, 'start', {}, 404, other);
  assert.equal((await request(matchUrl(g2.id), { method: 'POST', cookie: owner, requestOrigin: 'https://example.invalid', body: { operation: 'start', payload: {}, expected_version: g2.version } })).status, 403);
  await act(g2.id, 'start', {});
  assert.equal(matchNow(g2.id).status, 'IN_PROGRESS');
  const doubled = await Promise.all([0, 1].map(() => request(matchUrl(g2.id), { method: 'POST', cookie: owner, body: { operation: 'record_result', payload: { home_score: 3, away_score: 0 }, expected_version: matchNow(g2.id).version } })));
  assert.deepEqual(doubled.map((r) => r.status).sort(), [200, 409], 'double soumission : une seule acceptée');
  plan = configurationSchema.parse((await (await request(planEndpoint, { cookie: owner })).json()).configuration);
  assert.deepEqual([matchNow(g2.id).status, matchNow(g2.id).home_score, matchNow(g2.id).away_score], ['COMPLETED', 3, 0]);
  await act(g2.id, 'record_result', { home_score: -1, away_score: 0 }, 422);
  const staleVersion = matchNow(g2.id).version;
  await act(g2.id, 'record_result', { home_score: 1, away_score: 0 });
  assert.deepEqual([matchNow(g2.id).status, matchNow(g2.id).home_score], ['COMPLETED', 1], 'une correction garde le match terminé');
  await act(g2.id, 'record_result', { home_score: 5, away_score: 0 }, 409, owner, staleVersion);
  await act(g2.id, 'reset', {}, 409);
  const corrected = publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament);
  assert.equal(corrected.matches.find((m) => m.id === g2.id)!.home_score, 1, 'correction visible publiquement');
  assert.equal(corrected.tournament.version, plan.tournament.version);

  await act(g3.id, 'postpone', {});
  assert.deepEqual([matchNow(g3.id).status, matchNow(g3.id).starts_at, matchNow(g3.id).court_id], ['POSTPONED', null, null]);
  await act(g3.id, 'start', {}, 409);
  await schedule('move_match', { match_id: g3.id, court_id: plan.courts[2].id, starts_at: '2026-11-14T15:00:00Z' });
  assert.equal(matchNow(g3.id).status, 'SCHEDULED');
  await act(g4.id, 'cancel', {});
  assert.equal(matchNow(g4.id).status, 'CANCELLED');
  await act(g4.id, 'reinstate', {});
  assert.equal(matchNow(g4.id).status, 'SCHEDULED');
  await schedule('complete', {}, 409);
  for (const m of plan.matches.filter((row) => row.status !== 'COMPLETED')) {
    if (m.id === g4.id) await act(m.id, 'cancel', {});
    else await act(m.id, 'record_result', { home_score: 2, away_score: 0 });
  }
  await schedule('complete', {});
  assert.equal(plan.tournament.status, 'COMPLETED');
  await act(g4.id, 'reinstate', {}, 409);
  await act(g2.id, 'record_result', { home_score: 4, away_score: 0 });
  assert.equal(publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament).tournament.status, 'COMPLETED');
  console.log('OK — Résultats : saisie, double soumission refusée, correction et concurrence, report/replanification, annulation/rétablissement, fin du tournoi.');
  // Apparence : modifiable après publication (cosmétique), visible publiquement, format strict, figée à l’archivage.
  await configure('update_appearance', { theme: 'nuit', primary_color: '#0F766E', accent_color: null });
  assert.equal(plan.tournament.theme, 'nuit');
  assert.equal(plan.tournament.primary_color, '#0f766e');
  assert.equal(publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament).tournament.primary_color, '#0f766e');
  await configure('update_appearance', { theme: 'nuit', primary_color: 'red;background:url(x)', accent_color: null }, 422);
  await configure('update_appearance', { theme: 'disco', primary_color: null, accent_color: null }, 422);
  await assert.rejects(db.tournament.update({ where: { id: plan.tournament.id }, data: { theme: 'x;y' } }), 'contrainte SQL du thème');
  await configure('save_rules', { match_duration_minutes: 30, transition_minutes: 5, minimum_rest_minutes: 10, allow_draw: false, points_win: 3, points_draw: 1, points_loss: 0, tie_break_order: ['points', 'score_difference', 'scores_for', 'team_id'] }, 409);
  await assert.rejects(db.tournament.update({ where: { id: plan.tournament.id }, data: { accent_color: 'blue' } }), 'contrainte SQL du format');
  console.log('OK — Apparence : thème et couleurs modifiables après publication, publics, format contrôlé.');
  await schedule('archive', {});
  await configure('update_appearance', { theme: 'tournio', primary_color: null, accent_color: null }, 409);
  await act(g2.id, 'record_result', { home_score: 0, away_score: 1 }, 409);
  assert.equal(publicTournamentSchema.parse((await (await request(publicApi)).json()).tournament).tournament.status, 'ARCHIVED', 'un tournoi archivé reste consultable');
  assert.equal(plan.tournament.status, 'ARCHIVED');
  await schedule('move_match', { match_id: m1.id, court_id: m0.court_id!, starts_at: '2026-11-14T15:00:00Z' }, 409);
  const page = await request(`/dashboard/tournaments/${plan.tournament.id}`, { cookie: owner });
  assert.equal(page.status, 200);
  console.log('OK — Calendrier : prévisualisation sans écriture, version périmée refusée, 18 matchs enregistrés, déplacements revalidés, publication et archivage.');
  console.log('Succès : socle métier Prisma et dashboard Better Auth.');
} catch(error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Échec du test métier : vérifier la connexion, les certificats TLS et les migrations.');
  process.exitCode=1;
} finally {
  try { await db.match.deleteMany({where:{tournament_id:{in:fixtures}}}); await db.tournament.deleteMany({where:{id:{in:fixtures}}}); }
  catch { console.error('Nettoyage des fixtures métier impossible.'); process.exitCode=1; }
  await db.$disconnect();
}
