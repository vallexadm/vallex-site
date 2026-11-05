import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import test from 'node:test';
import {endCurrentSession} from '../lib/end-current-session.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
test('logout pede apenas a sessao local e confirma ausencia',async()=>{let options;await endCurrentSession({signOut:async value=>{options=value;return {error:null}},getSession:async()=>({data:{session:null},error:null})});assert.deepEqual(options,{scope:'local'});});
test('erro remoto com sessao local removida nao prende usuario na tela',async()=>{await endCurrentSession({signOut:async()=>({error:new Error('offline')}),getSession:async()=>({data:{session:null},error:null})});});
test('logout com excecao ainda verifica se sessao ja foi removida',async()=>{await endCurrentSession({signOut:async()=>{throw new Error('rede')},getSession:async()=>({data:{session:null},error:null})});});
test('sessao ainda ativa ou estado nao verificavel nao finge logout',async()=>{for(const result of [{data:{session:{access_token:'fixture'}},error:null},{data:{session:null},error:new Error('erro')}])await assert.rejects(endCurrentSession({signOut:async()=>({error:null}),getSession:async()=>result}),/Não foi possível encerrar/);});
const jsxRequire=name=>name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:null;
async function compile(file){return ts.transpileModule(await readFile(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;}
function find(node,predicate){if(!node)return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=typeof child==='object'?find(child,predicate):null;if(match)return match;}return null;}
test('olhinho nao envia formulario e preserva validacao e autocomplete ao alternar',async()=>{const source=await compile('components/PasswordInput.tsx');let visible=false;const exports={};new Function('exports','require',source)(exports,name=>jsxRequire(name)||{useId:()=>':id:',useState:()=>[visible,value=>visible=typeof value==='function'?value(visible):value]});const props={id:'senha',value:'fixture-only',onChange:()=>{},required:true,minLength:6,autoComplete:'current-password'};let tree=exports.default(props);let input=find(tree,n=>n.type==='input'),button=find(tree,n=>n.type==='button');assert.equal(input.props.type,'password');assert.equal(button.props.type,'button');assert.equal(button.props['aria-controls'],'senha');assert.equal(button.props['aria-label'],'Mostrar senha');button.props.onClick();tree=exports.default(props);input=find(tree,n=>n.type==='input');button=find(tree,n=>n.type==='button');assert.equal(input.props.type,'text');assert.equal(input.props.value,props.value);assert.equal(input.props.onChange,props.onChange);assert.equal(input.props.autoComplete,'current-password');assert.equal(input.props.minLength,6);assert.equal(input.props.required,true);assert.equal(button.props['aria-pressed'],true);assert.equal(button.props['aria-label'],'Ocultar senha');button.props.onClick();assert.equal(find(exports.default(props),n=>n.type==='input').props.type,'password');});
const sessionCode=await compile('components/SessionPanelLink.tsx');
function sessionHarness(response,{session={access_token:'fixture',user:{email:'conta@example.invalid',user_metadata:{isAdmin:true}}}}={}){
 const states=[],effects=[];let cursor=0,first=true,listener,unsubscribed=false;const exports={};let currentSession=session;
 const react={useState:initial=>{const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],value=>states[index]=typeof value==='function'?value(states[index]):value];},useEffect:effect=>{if(first)effects.push(effect);}};
 const auth={getSession:async()=>({data:{session:currentSession}}),onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe:()=>unsubscribed=true}}};}};
 new Function('exports','require','fetch',sessionCode)(exports,name=>jsxRequire(name)||(name==='react'?react:name==='next/link'?{default:'link'}:name.includes('supabase/client')?{supabase:{auth}}:{endCurrentSession:async()=>{}}),response);
 function render(){cursor=0;const tree=exports.default();first=false;return tree;}
 render();const cleanups=effects.map(effect=>effect());
 return {render,signOut:()=>{currentSession=null;listener('SIGNED_OUT',null);},dispose:()=>cleanups.forEach(fn=>fn?.()),unsubscribed:()=>unsubscribed};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
test('botao administrativo exige permissao confirmada pela API',async()=>{const h=sessionHarness(async()=>Response.json({ok:true,isAdmin:true,isStaff:false}));await flush();const tree=h.render();assert.ok(find(tree,n=>n.props?.href==='/admin'));h.dispose();assert.ok(h.unsubscribed());});
test('metadata local nao concede entrada administrativa a conta de prestador',async()=>{const h=sessionHarness(async()=>Response.json({ok:true,isAdmin:false,isStaff:false}));await flush();const tree=h.render();assert.equal(find(tree,n=>n.props?.href==='/admin'),null);assert.ok(find(tree,n=>n.props?.href==='/sistema'));h.dispose();});
test('usuario sem sessao nao recebe atalho de painel',async()=>{const h=sessionHarness(async()=>{throw new Error('nao consultar')},{session:null});await flush();assert.equal(h.render(),null);h.dispose();});
test('resposta atrasada de acesso nao restaura atalho depois do logout',async()=>{let release;const h=sessionHarness(()=>new Promise(resolve=>release=resolve));await flush();h.signOut();await flush();release(Response.json({ok:true,isAdmin:true}));await flush();assert.equal(h.render(),null);h.dispose();});

const adminSource=await readFile(new URL('../app/admin/page.tsx',import.meta.url),'utf8');const ast=ts.createSourceFile('admin.tsx',adminSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='loadData')callback=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);
const callbackCode=ts.transpileModule('const load = '+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
test('nova verificacao libera tela antes negada apenas apos autorizacao',async()=>{const result={};const setters=['setLoading','setError','setSessionEmail','setAccessDenied','setContacts','setProviders','setPermissions','setIsOwner','setMetricData','setTrafficSummary','setSalesSummary'];const deps={loadSequence:{current:0},checkedToken:{current:''},supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{email:'teste'}}}})}},fetch:async url=>Response.json(url==='/api/admin/access'?{ok:true,isAdmin:true,permissions:{}}:{ok:true})};for(const setter of setters)deps[setter]=value=>result[setter]=value;await new Function(...Object.keys(deps),callbackCode+';return load();')(...Object.values(deps));assert.equal(result.setAccessDenied,false);assert.equal(result.setIsOwner,true);assert.equal(result.setLoading,false);});
test('falha de consulta administrativa nao fica escondida em tela negada',async()=>{const result={};const setters=['setLoading','setError','setSessionEmail','setAccessDenied','setContacts','setProviders','setPermissions','setIsOwner','setMetricData','setTrafficSummary','setSalesSummary'];const deps={loadSequence:{current:0},checkedToken:{current:''},supabase:{auth:{getSession:async()=>{throw new Error('falha de rede')}}},fetch:async()=>{throw new Error('nao consultar')}};for(const setter of setters)deps[setter]=value=>result[setter]=value;await new Function(...Object.keys(deps),callbackCode+';return load();')(...Object.values(deps));assert.equal(result.setAccessDenied,true);assert.equal(result.setLoading,false);assert.match(result.setError,/falha de rede/);});
const accessRouteCode = await compile('app/api/admin/access/route.ts');
for (const status of [401,403,503]) test(`API administrativa preserva erro ${status} e motivo em vez de simular prestador`,async()=>{
 const expected=Response.json({ok:false,message:'Motivo verificável',code:'ACCESS_SCHEMA_REQUIRED'},{status});const exports={};
 new Function('exports','require',accessRouteCode)(exports,name=>name==='next/server'?{NextResponse:Response}:{resolvePlatformAdmin:async()=>({ok:false,response:expected})});
 const response=await exports.GET(new Request('https://example.invalid/api/admin/access'));
 assert.equal(response.status,status);assert.equal((await response.json()).message,'Motivo verificável');
});
test('API administrativa retorna privilegios conferidos pelo mesmo resolvedor dos modulos',async()=>{
 for(const isOwner of [true,false]){const exports={},permissions={providers:{view:true}};
 new Function('exports','require',accessRouteCode)(exports,name=>name==='next/server'?{NextResponse:Response}:{resolvePlatformAdmin:async()=>({ok:true,context:{isOwner,permissions}})});
 const response=await exports.GET(new Request('https://example.invalid/api/admin/access'));const result=await response.json();assert.deepEqual(result,{ok:true,isAdmin:isOwner,isStaff:!isOwner,permissions});assert.equal(response.headers.get('cache-control'),'private, no-store');}
});
test('tela negada exibe motivo da API junto a acao sem carregar dados administrativos',async()=>{
 const result={};let requests=0;const setters=['setLoading','setError','setSessionEmail','setAccessDenied','setContacts','setProviders','setPermissions','setIsOwner','setMetricData','setTrafficSummary','setSalesSummary'];
 const deps={loadSequence:{current:0},checkedToken:{current:''},supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{email:'teste'}}}})}},fetch:async()=>{requests++;return Response.json({ok:false,message:'Conta sem liberação no teste'},{status:403});}};
 for(const setter of setters)deps[setter]=value=>result[setter]=value;
 await new Function(...Object.keys(deps),callbackCode+';return load();')(...Object.values(deps));assert.equal(result.setAccessDenied,true);assert.equal(result.setError,'Conta sem liberação no teste');assert.equal(result.setIsOwner,false);assert.equal(requests,1);
});
