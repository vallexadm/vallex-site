import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import test from 'node:test';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=await readFile(new URL('../app/sistema/layout.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('layout.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fn;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='checkPanelAccess')fn=n;ts.forEachChild(n,visit);}visit(ast);
const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
async function check(status,body){let access,redirect;const deps={cancelled:false,pathname:'/sistema',supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},router:{replace:p=>redirect=p},setAccess:a=>access=a,fetch:async()=>Response.json(body,{status})};await new Function(...Object.keys(deps),`${js};return checkPanelAccess();`)(...Object.values(deps));return {access,redirect};}
test('sessao rejeitada encaminha ao login em vez de prender no erro do plano',async()=>{const r=await check(401,{ok:false});assert.equal(r.redirect,'/sistema/login?motivo=sessao-expirada');assert.equal(r.access,undefined);});
test('falha do servidor nao libera painel',async()=>{const r=await check(503,{ok:false});assert.equal(r.access.status,'error');assert.equal(r.redirect,undefined);});
test('acesso negado nao libera painel',async()=>{assert.equal((await check(403,{ok:false,code:'MEMBER_DISABLED'})).access.status,'error');});
test('plano Basic validado libera painel e Free mantem acesso limitado',async()=>{assert.equal((await check(200,{ok:true,plan:{canAccessPanel:true}})).access.status,'allowed');assert.equal((await check(200,{ok:true,plan:{code:'free',canViewRequests:true}})).redirect,'/sistema/solicitacoes');});
