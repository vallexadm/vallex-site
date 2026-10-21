import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(new URL('../package.json',import.meta.url));const ts=require('typescript');
const source=await readFile(new URL('../app/api/sistema/arquivos/route.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='DELETE');
const code=ts.transpileModule(fn.getText(ast).replace('export async','async'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function load(context){return new Function('contexto','respostaErro','NextResponse',`${code};return DELETE;`)(async()=>context,(message,status)=>Response.json({ok:false,message},{status}),{json:Response.json});}
const request=()=>new Request('https://example.invalid',{method:'DELETE',body:JSON.stringify({finalidade:'logo',organization_id:'outra'})});
test('remover imagem altera somente referencia da propria organizacao sem salvar outros campos',async()=>{
 let saved,filter;
 const admin={from:table=>{assert.equal(table,'organization_public_profiles');return {update:values=>{saved=values;return {eq:(...args)=>{filter=args;return {select:()=>({maybeSingle:async()=>({data:{id:'profile'},error:null})})};}};}};}};
 const response=await load({admin,organization:{id:'own'}})(request());
 assert.equal(response.status,200);assert.equal(saved.logo_url,null);assert.deepEqual(Object.keys(saved).sort(),['logo_url','updated_at']);assert.deepEqual(filter,['organization_id','own']);
});
test('remocao respeita recusa de autorizacao do contexto',async()=>{
 const response=await load({error:Response.json({ok:false},{status:403})})(request());assert.equal(response.status,403);
});
test('falha ou perfil inexistente nao informa sucesso',async()=>{
 const admin={from:()=>({update:()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:null,error:{message:'falha'}})})})})})};
 assert.equal((await load({admin,organization:{id:'own'}})(request())).status,409);
});
