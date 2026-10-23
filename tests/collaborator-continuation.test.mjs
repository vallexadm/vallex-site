import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(new URL('../package.json',import.meta.url));const ts=require('typescript');
const text=await readFile(new URL('../app/sistema/convites/aceitar/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='continueAfterConfirmation')node=n;ts.forEachChild(n,visit);}visit(ast);
const code=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function load(session){const state={error:'',path:'',accepted:0};const context={setError:v=>state.error=v,setAccountEmail:()=>{},supabase:{auth:{getSession:async()=>({data:{session}})}},router:{push:p=>state.path=p},loginUrl:()=>'/sistema/login?next=convite',invitedEmail:'colaborador@example.invalid',acceptWithToken:async()=>state.accepted++};return {state,run:new Function(...Object.keys(context),`${code};return continueAfterConfirmation;`)(...Object.values(context))};}
test('sem sessao vai ao login mantendo retorno ao convite sem aceitar',async()=>{const {run,state}=load(null);await run();assert.equal(state.path,'/sistema/login?next=convite');assert.equal(state.accepted,0);});
test('sessao de outra conta nao aceita convite',async()=>{const {run,state}=load({user:{email:'outro@example.invalid'},access_token:'fake'});await run();assert.equal(state.accepted,0);assert.match(state.error,/e-mail convidado/);});
test('conta convidada autenticada prossegue pelo aceite validado',async()=>{const {run,state}=load({user:{email:'colaborador@example.invalid'},access_token:'fake'});await run();assert.equal(state.accepted,1);assert.equal(state.path,'');});
