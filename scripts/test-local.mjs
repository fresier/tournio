import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import pg from 'pg';

const docker=existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')?'/Applications/Docker.app/Contents/Resources/bin/docker':'docker';
const name=`tournio-prisma-test-${process.pid}`;
const password=randomBytes(24).toString('hex');
let server;
let container=false;
const run=(command,args,env=process.env)=>{
  const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.stdout) process.stdout.write(result.stdout.split(password).join('[REDACTED]'));
  if(result.stderr) process.stderr.write(result.stderr.split(password).join('[REDACTED]'));
  if(result.status!==0) throw new Error(`Échec de ${command} ${args.slice(0,2).join(' ')}.`);
  return result.stdout;
};
const pause=()=>new Promise(resolve=>setTimeout(resolve,500));
try {
  run(docker,['run','--rm','--name',name,'--env','POSTGRES_PASSWORD','--env','POSTGRES_DB=tournio_test','--publish','127.0.0.1::5432','--detach','postgres:17-alpine'],{...process.env,POSTGRES_PASSWORD:password});
  container=true;
  const output=run(docker,['port',name,'5432/tcp']);
  const port=output.match(/127\.0\.0\.1:(\d+)/)?.[1];
  if(!port) throw new Error('Port de la base isolée introuvable.');
  const url=`postgresql://postgres:${password}@127.0.0.1:${port}/tournio_test`;
  const env={...process.env,DATABASE_URL:url,PG_SSL_CA_FILE:'',BETTER_AUTH_SECRET:randomBytes(48).toString('base64url'),BETTER_AUTH_URL:'http://127.0.0.1:3100',APP_ORIGIN:'http://127.0.0.1:3100',GOOGLE_CLIENT_ID:'isolated-test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:randomBytes(24).toString('base64url'),NEXT_DIST_DIR:'.next-test',TOURNIO_ISOLATED_TEST:'1',DEMO_OWNER_EMAIL:'organisateur@tournio.test',DEMO_OWNER_PASSWORD:randomBytes(24).toString('base64url'),DEMO_OTHER_EMAIL:'autre@tournio.test',DEMO_OTHER_PASSWORD:randomBytes(24).toString('base64url')};
  let ready=false;
  for(let i=0;i<40;i++){
    const client=new pg.Client({connectionString:url,connectionTimeoutMillis:1000});
    try { await client.connect();ready=true; } catch {} finally {await client.end().catch(()=>{});}
    if(ready)break; await pause();
  }
  if(!ready)throw new Error('La base PostgreSQL isolée ne démarre pas.');
  run('npm',['run','db:migrate'],env);
  run('npm',['run','db:migrate'],env);
  run('npm',['run','db:seed'],env);
  run('npm',['run','db:seed'],env);
  run('npm',['run','build'],env);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',()=>{});
  server.stderr.on('data',()=>{});
  ready=false;
  for(let i=0;i<60;i++){
    try {const response=await fetch('http://127.0.0.1:3100/api/auth',{signal:AbortSignal.timeout(1000)}); if(response.ok){ready=true;break;}}catch{}
    if(server.exitCode!==null)break; await pause();
  }
  if(!ready)throw new Error('Le serveur Next.js de test ne démarre pas.');
  run('npm',['run','test:integration'],env);
  run('npm',['run','test:google'],env);
  run('npm',['run','test:realtime'],env);
  console.log('Succès : build de production, migrations et tests sur PostgreSQL isolé. DATABASE_URL privée inchangée.');
} catch(error){console.error(error.message);process.exitCode=1;}
finally {
  if(server){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
  if(container)spawnSync(docker,['stop','--time','5',name],{stdio:'ignore'});
}
