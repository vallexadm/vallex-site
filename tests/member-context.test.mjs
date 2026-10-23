import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(new URL('../package.json',import.meta.url));
const ts=require('typescript');
const source=await readFile(new URL('../proxy.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function proxyFor(memberships,error=null){
 const client={auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},from:()=>({select:()=>({eq:()=>({eq:async()=>({data:memberships,error})})})})};
 const exports={};
 new Function('exports','require','process',code)(exports,name=>name==='next/server'?{NextResponse:{json:Response.json,next:()=>Response.json({next:true})}}:{createClient:()=>client},{env:{NEXT_PUBLIC_SUPABASE_URL:'fake',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fake',SUPABASE_SECRET_KEY:'fake',SUPABASE_URL:'fake'}});
 return exports.proxy;
}
function request(path='/api/sistema/organizacao',method='GET'){
 return {headers:new Headers({authorization:'Bearer fake'}),nextUrl:{pathname:path},method};
}
test('colaborador desativado nao acessa painel nem APIs mesmo que possua organizacao propria',async()=>{
 const proxy=proxyFor([{organization_id:'team',is_active:false}]);
 for(const path of ['/api/sistema/organizacao','/api/sistema/financeiro','/api/sistema/equipe']){
  const response=await proxy(request(path));assert.equal(response.status,403);assert.equal((await response.json()).code,'MEMBER_DISABLED');
 }
});
test('colaborador ativo nao usa rotas exclusivas de proprietario',async()=>{
 const proxy=proxyFor([{organization_id:'team',is_active:true}]);
 for(const path of ['/api/sistema/equipe','/api/sistema/arquivos','/api/sistema/asaas/checkout','/api/sistema/vitrine']) assert.equal((await proxy(request(path))).status,403);
 assert.equal((await proxy(request('/api/sistema/organizacao','POST'))).status,403);
 assert.equal((await proxy(request('/api/sistema/agenda'))).status,200);
});
test('proprietario sem vinculo de colaborador continua no fluxo existente',async()=>{
 assert.equal((await proxyFor([])(request('/api/sistema/equipe'))).status,200);
});
test('erro de verificacao e multiplos vinculos nao liberam acesso',async()=>{
 assert.equal((await proxyFor(null,{message:'falha'})(request())).status,503);
 assert.equal((await proxyFor([{is_active:true},{is_active:true}])(request())).status,409);
});
test('contexto real da agenda escolhe equipe e permissoes de membro acima de organizacao propria',async()=>{
 const source=await readFile(new URL('../app/api/sistema/agenda/route.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getContext');
 const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 let selection;
 const admin={from:table=>({select:()=>({eq:(field,value)=>{
  selection={table,field,value};
  return {eq:()=>({maybeSingle:async()=>({data:{organization_id:'team',role:'member',permissions:{agenda:{manage:false}}},error:null})}),maybeSingle:async()=>({data:{id:field==='owner_id'?'own':'team',owner_id:'owner'},error:null})};
 }})})};
 const deps={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})}}),createAdminClient:()=>admin,
 hasMemberAffiliation:async()=>true,requireProviderPanelAccess:async()=>null,normalizeMemberPermissions:p=>p,ownerPermissions:{agenda:{manage:true}},reply:(message,status)=>Response.json({message},{status}),process:{env:{NEXT_PUBLIC_SUPABASE_URL:'fake',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fake'}}};
 const getContext=new Function(...Object.keys(deps),`${js};return getContext;`)(...Object.values(deps));
 const result=await getContext({headers:new Headers({authorization:'Bearer fake'})});
 assert.equal(result.role,'member');assert.equal(result.organization.id,'team');assert.equal(result.permissions.agenda.manage,false);
});
