import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(new URL('../package.json',import.meta.url));
const ts=require('typescript');
const source=await readFile(new URL('../lib/server/invitation-email.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(base){const exports={};new Function('exports','process',code)(exports,{env:{NEXT_PUBLIC_SITE_URL:base}});return exports.sendInvitationEmail;}
test('envio usa destinatario e retorno do convite sem aceitar automaticamente o vinculo',async()=>{
 let args;
 const result=await load('http://localhost:3000')({auth:{signInWithOtp:async value=>{args=value;return {error:null};}}},'teste@example.invalid','a'.repeat(64));
 assert.equal(result.status,'accepted');assert.equal(args.email,'teste@example.invalid');
 const url=new URL(args.options.emailRedirectTo);
 assert.equal(url.pathname,'/sistema/convites/aceitar');assert.equal(url.searchParams.get('token'),'a'.repeat(64));
 assert.equal(args.options.shouldCreateUser,true);
});
test('falta de URL e protocolo inseguro impedem envio',async()=>{
 const auth={auth:{signInWithOtp:async()=>{throw Error('nao deve chamar');}}};
 assert.equal((await load(undefined)(auth,'a@b.invalid','token')).status,'not_sent');
 assert.equal((await load('http://public.example.invalid')(auth,'a@b.invalid','token')).status,'not_sent');
});
test('limite SMTP e falha de rede nao sao apresentados como envio confirmado',async()=>{
 const send=load('https://example.invalid');
 const limited=await send({auth:{signInWithOtp:async()=>({error:{status:429}})}},'a@b.invalid','token');
 assert.equal(limited.status,'not_sent');assert.match(limited.message,/limitou/);
 const failed=await send({auth:{signInWithOtp:async()=>{throw Error('segredo');}}},'a@b.invalid','token');
 assert.equal(failed.status,'not_sent');assert.doesNotMatch(failed.message,/segredo/);
});
