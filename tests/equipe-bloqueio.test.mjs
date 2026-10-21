import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
const { PGlite } = await import(pathToFileURL(process.env.VALLEX_PGLITE_MODULE).href);
const db = new PGlite();
after(()=>db.close());
const owner='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const org='33333333-3333-4333-8333-333333333333';
const other='44444444-4444-4444-8444-444444444444';
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE organizations(id uuid PRIMARY KEY, owner_id uuid);
 CREATE TABLE organization_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,permissions jsonb DEFAULT '{}');
 INSERT INTO organizations VALUES ('${org}','${owner}');
 INSERT INTO organization_members(organization_id,user_id,role) VALUES ('${org}','${member}','member'),('${org}','${owner}','owner');
 ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
 CREATE POLICY self_select ON organization_members FOR SELECT TO authenticated USING(user_id=auth.uid());
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 GRANT SELECT ON organization_members TO authenticated;
 CREATE TABLE customer_history(id integer, member_id uuid, detail text);
 INSERT INTO customer_history VALUES(1,'${member}','Servico executado');`);
const migration=await readFile(new URL('../supabase/equipe_bloqueio_acesso.sql',import.meta.url),'utf8');
await db.exec(migration);
const sql='SELECT set_organization_member_access($1,$2,$3,$4)';
test('somente proprietario altera membro da propria organizacao',async()=>{
 await assert.rejects(db.query(sql,[org,member,member,false]),/OWNER_ONLY/);
 await assert.rejects(db.query(sql,[other,owner,member,false]),/OWNER_ONLY/);
 await assert.rejects(db.query(sql,[org,owner,other,false]),/MEMBER_NOT_FOUND/);
 await assert.rejects(db.query(sql,[org,owner,owner,false]),/OWNER_PROTECTED/);
});
test('desativacao preserva vinculo, permissoes e historico e registra autor',async()=>{
 await db.query(sql,[org,owner,member,false]);
 const row=(await db.query('SELECT * FROM organization_members WHERE user_id=$1',[member])).rows[0];
 assert.equal(row.is_active,false);assert.deepEqual(row.permissions,{});
 assert.equal((await db.query('SELECT * FROM customer_history')).rows.length,1);
 const log=(await db.query('SELECT * FROM organization_member_access_logs')).rows[0];
 assert.equal(log.actor_id,owner);assert.equal(log.was_active,true);assert.equal(log.is_active,false);
 await db.query(sql,[org,owner,member,false]);
 assert.equal((await db.query('SELECT * FROM organization_member_access_logs')).rows.length,1);
});
test('RLS oculta vinculo desativado mesmo com sessao autenticada existente',async()=>{
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${member}',false)`);
 try { assert.equal((await db.query('SELECT * FROM organization_members')).rows.length,0); }
 finally { await db.exec('RESET ROLE'); }
});
test('reativar restaura visibilidade e produz novo registro de auditoria',async()=>{
 await db.query(sql,[org,owner,member,true]);
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${member}',false)`);
 try {assert.equal((await db.query('SELECT * FROM organization_members')).rows.length,1);}
 finally {await db.exec('RESET ROLE');}
 assert.equal((await db.query('SELECT * FROM organization_member_access_logs')).rows.length,2);
 await db.exec(migration);
 assert.equal((await db.query('SELECT * FROM organization_member_access_logs')).rows.length,2);
});
test('funcao nao pode ser chamada diretamente por colaborador autenticado',async()=>{
 await db.exec('SET ROLE authenticated');
 try {await assert.rejects(db.query(sql,[org,owner,member,false]),/permission denied/);}
 finally {await db.exec('RESET ROLE');}
});

test('API usa proprietario autenticado e nao aceita organizacao ou autor enviados no corpo',async()=>{
 const { createRequire }=await import('node:module');
 const require=createRequire(new URL('../package.json',import.meta.url));
 const ts=require('typescript');
 const source=await readFile(new URL('../app/api/sistema/equipe/route.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='POST');
 const code=ts.transpileModule(fn.getText(ast).replace('export async','async'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const env={SUPABASE_URL:'https://example.invalid',SUPABASE_SECRET_KEY:'fake',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fake'};
 let actor=owner, organization={id:org}, recorded;
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
 from:()=>({select:()=>({eq:(field,value)=>{assert.equal(field,'owner_id');assert.equal(value,actor);return {maybeSingle:async()=>({data:organization,error:null})};}})}),
 rpc:async(name,args)=>{recorded={name,args};return {error:null};}};
 const post=new Function('createClient','NextResponse','process',`${code};return POST;`)(()=>client,{json:Response.json},{env});
 const request=()=>new Request('https://example.invalid/api/sistema/equipe',{method:'POST',headers:{authorization:'Bearer fake'},body:JSON.stringify({user_id:member,is_active:false,organization_id:other,actor_id:other})});
 assert.equal((await post(request())).status,200);
 assert.equal(recorded.args.p_organization_id,org);assert.equal(recorded.args.p_actor_id,owner);
 recorded=null;actor=member;organization=null;
 assert.equal((await post(request())).status,403);assert.equal(recorded,null);
});

test('excluir da equipe arquiva vinculo, preserva historico e impede reativacao sem novo convite',async()=>{
 await db.exec(await readFile(new URL('../supabase/equipe_exclusao_vinculo.sql',import.meta.url),'utf8'));
 const sql='SELECT remove_organization_member($1,$2,$3)';
 await assert.rejects(db.query(sql,[org,member,member]),/OWNER_ONLY/);
 await assert.rejects(db.query(sql,[org,owner,owner]),/OWNER_PROTECTED/);
 await assert.rejects(db.query(sql,[other,owner,member]),/OWNER_ONLY/);
 await db.query(sql,[org,owner,member]);
 assert.equal((await db.query('SELECT * FROM organization_members WHERE user_id=$1',[member])).rows.length,0);
 assert.equal((await db.query('SELECT * FROM customer_history')).rows.length,1);
 const log=(await db.query('SELECT * FROM organization_member_departures')).rows[0];
 assert.equal(log.actor_id,owner);assert.equal(log.member_snapshot.user_id,member);
 assert.equal(log.member_snapshot.role,'member');
 await assert.rejects(db.query('SELECT set_organization_member_access($1,$2,$3,true)',[org,owner,member]),/MEMBER_NOT_FOUND/);
 await db.exec('SET ROLE authenticated');
 try {await assert.rejects(db.query(sql,[org,owner,member]),/permission denied/);}
 finally {await db.exec('RESET ROLE');}
});
