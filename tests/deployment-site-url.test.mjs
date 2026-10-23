import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
const require=createRequire(new URL('../package.json',import.meta.url));const ts=require('typescript');
const text=await readFile(new URL('../next.config.ts',import.meta.url),'utf8');
const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(env){const exports={};new Function('exports','process',code)(exports,{env});return exports.default;}
test('preview usa endereco proprio mesmo se houver URL de producao configurada',()=>{
 const config=load({CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:'https://deploy-preview-3--vallex.netlify.app',NEXT_PUBLIC_SITE_URL:'https://vallex.netlify.app'});
 assert.equal(config.env.NEXT_PUBLIC_SITE_URL,'https://deploy-preview-3--vallex.netlify.app');
 assert.deepEqual(Object.keys(config.env),['NEXT_PUBLIC_SITE_URL']);
});
test('producao e desenvolvimento preservam o endereco explicito',()=>{
 assert.equal(load({CONTEXT:'production',NEXT_PUBLIC_SITE_URL:'https://vallex.netlify.app'}).env.NEXT_PUBLIC_SITE_URL,'https://vallex.netlify.app');
 assert.equal(load({NODE_ENV:'development',NEXT_PUBLIC_SITE_URL:'http://localhost:3000'}).env.NEXT_PUBLIC_SITE_URL,'http://localhost:3000');
});
test('preview sem URL ou com endereco nao confiavel falha em vez de mandar convite para outra origem',()=>{
 assert.throws(()=>load({CONTEXT:'deploy-preview'}));
 assert.throws(()=>load({CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:'https://outro.example.invalid'}));
});
