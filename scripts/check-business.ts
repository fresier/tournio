import './load-env.mjs';
import assert from 'node:assert/strict';
import { getPrisma } from '../src/lib/database/client';
import { configurationSchema } from '../src/lib/tournaments/contracts';
import { request, login } from './test-http';
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
  await mutate('update_team',{id:teamA.id,name:'Les Renards',slug:'les-renards'});
  await mutate('update_pool',{id:pool.id,name:'Poule principale'});
  await mutate('create_court',{name:'Terrain 1'});
  const court=data.courts[0];
  await mutate('update_court',{id:court.id,name:'Terrain principal'});
  await mutate('create_availability',{court_id:court.id,starts_at:'2026-11-14T08:00:00Z',ends_at:'2026-11-14T10:00:00Z'});
  await mutate('create_availability',{court_id:court.id,starts_at:'2026-11-14T09:00:00Z',ends_at:'2026-11-14T11:00:00Z'},422);
  await mutate('create_availability',{court_id:court.id,starts_at:'2026-11-14T10:00:00Z',ends_at:'2026-11-14T11:00:00Z'});
  await mutate('create_availability',{court_id:court.id,starts_at:'2026-11-14T07:00:00Z',ends_at:'2026-11-14T08:00:00Z'},422);
  await mutate('update_tournament',{...input(data.tournament.slug),name:'Tournoi renommé',ends_at:'2026-11-14T09:00:00Z'},422);
  await mutate('save_rules',{match_duration_minutes:25,transition_minutes:5,minimum_rest_minutes:10,allow_draw:false,points_win:3,points_draw:1,points_loss:0});
  assert.equal(data.rules.allow_draw,false);
  console.log('OK — Équipes, poules, terrains, disponibilités et règles configurables.');

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
  console.log('Succès : socle métier Prisma et dashboard Better Auth.');
} catch(error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Échec du test métier : vérifier la connexion, les certificats TLS et les migrations.');
  process.exitCode=1;
} finally {
  try { await db.match.deleteMany({where:{tournament_id:{in:fixtures}}}); await db.tournament.deleteMany({where:{id:{in:fixtures}}}); }
  catch { console.error('Nettoyage des fixtures métier impossible.'); process.exitCode=1; }
  await db.$disconnect();
}
