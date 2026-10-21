import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root=process.env.VALLEX_CHECKOUT ?? process.cwd();
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
const {chromium}=require(process.env.VALLEX_PLAYWRIGHT_MODULE ?? 'playwright');
let browser;
let source;
let style;
before(async()=>{
  const currency=await readFile(path.join(root,'lib/currency.ts'),'utf8');
  const validation=await readFile(path.join(root,'lib/form-validation.ts'),'utf8');
  source=ts.transpileModule((currency+'\n'+validation).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const css=await readFile(path.join(root,'app/globals.css'),'utf8');
  style=css.slice(css.indexOf('/* Campos invalidados'));
  browser=await chromium.launch({headless:true,channel:process.env.VALLEX_BROWSER_CHANNEL ?? 'msedge'});
});
after(async()=>{await browser?.close();});
async function fixture(){
  const page=await browser.newPage({viewport:{width:900,height:850}});
  await page.setContent(`<style>body{font-family:Arial;padding:24px}form{display:grid;grid-template-columns:1fr 1fr;gap:20px}label{display:block}input:not([type=checkbox],[type=radio]),select,textarea{display:block;width:90%;border:1px solid #aaa;padding:10px}button{padding:12px}${style}</style>
  <form id="form"><label>Nome<input id="name" required aria-describedby="name-hint"></label><label>Colaborador<select id="person" required><option value="">Selecione</option><option value="one">Pessoa teste</option></select></label>
  <label>Descrição<textarea id="description" required></textarea></label><label>E-mail opcional<input id="email" type="email"></label>
  <label>Valor<input id="money" required data-currency-input="true" data-currency-min="0.01" data-currency-max="500"></label>
  <label><input id="terms" type="checkbox" required>Aceitar termos</label><label>Opcional<input id="optional"></label>
  <label>Desabilitado<input id="disabled" required disabled></label><label>Somente consulta<input id="readonly" required readonly></label>
  <button id="send" type="submit">Salvar</button><button type="reset" id="reset">Limpar</button></form><p id="name-hint">Informe o nome do contato</p>`);
  await page.addScriptTag({content:source+'\nwindow.cleanupValidation=installFormValidation(document);window.submissions=0;document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();window.submissions++});'});
  return page;
}
test('envio vazio destaca todos os obrigatórios e mantém opcionais sem erro',async()=>{
  const page=await fixture();
  assert.equal(await page.locator('[data-validation-invalid]').count(),0);
  await page.locator('#send').click();
  for(const id of ['name','person','description','money','terms'])assert.equal(await page.locator('#'+id).getAttribute('aria-invalid'),'true');
  for(const id of ['email','optional','disabled','readonly'])assert.equal(await page.locator('#'+id).getAttribute('data-validation-invalid'),null);
  assert.equal(await page.locator('#person').evaluate(el=>getComputedStyle(el).borderColor),'rgb(185, 28, 28)');
  assert.equal(await page.evaluate(()=>window.submissions),0);
  await page.close();
});
test('corrigir valores remove erros e preserva a descrição de ajuda original',async()=>{
  const page=await fixture();await page.locator('#send').click();
  await page.locator('#name').fill('Pessoa');await page.locator('#person').selectOption('one');await page.locator('#description').fill('Serviço de teste');
  await page.locator('#money').fill('150,00');await page.locator('#terms').check();
  await page.locator('#send').click();
  assert.equal(await page.locator('[data-validation-invalid]').count(),0);
  assert.equal(await page.locator('#name').getAttribute('aria-describedby'),'name-hint');
  assert.equal(await page.evaluate(()=>window.submissions),1);await page.close();
});
test('sair de campo obrigatório vazio mostra mensagem sem envio',async()=>{
  const page=await fixture();await page.locator('#name').focus();await page.locator('#optional').focus();
  await page.waitForFunction(()=>document.querySelector('#name').getAttribute('aria-invalid')==='true');
  assert.match(await page.locator('label').first().textContent(),/Preencha este campo obrigatório/);await page.close();
});
test('campos dinâmicos e condicionais recebem e removem erros',async()=>{
  const page=await fixture();
  await page.evaluate(()=>{const node=document.createElement('label');node.innerHTML='Campo dinâmico<input id="dynamic" required>';document.querySelector('form').append(node);});
  await page.locator('#send').click();assert.equal(await page.locator('#dynamic').getAttribute('aria-invalid'),'true');
  await page.locator('#dynamic').evaluate(el=>el.required=false);
  await page.waitForFunction(()=>!document.querySelector('#dynamic').hasAttribute('data-validation-invalid'));
  await page.locator('#money').evaluate(el=>el.disabled=true);
  await page.waitForFunction(()=>!document.querySelector('#money').hasAttribute('data-validation-invalid'));await page.close();
});
test('valor monetário respeita mínimo máximo e formato antes de enviar',async()=>{
  const page=await fixture();
  for(const value of ['0','501,00','texto']){
    await page.locator('#money').fill(value);await page.locator('#send').click();
    assert.equal(await page.locator('#money').getAttribute('aria-invalid'),'true');
  }
  await page.locator('#money').fill('500,00');await page.locator('#optional').focus();
  await page.waitForFunction(()=>!document.querySelector('#money').hasAttribute('data-validation-invalid'));await page.close();
});
test('espaços em branco não cumprem obrigatório e mensagens não duplicam',async()=>{
  const page=await fixture();await page.locator('#name').fill('   ');await page.locator('#send').click();await page.locator('#send').click();
  assert.equal(await page.locator('#name').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('label').first().locator('.vallex-field-error').count(),1);
  await page.locator('#name').fill('Nome válido');await page.locator('#optional').focus();
  await page.waitForFunction(()=>!document.querySelector('#name').hasAttribute('data-validation-invalid'));await page.close();
});
test('erro de formato de e-mail opcional só aparece quando há valor inválido',async()=>{
  const page=await fixture();await page.locator('#email').fill('incorreto');await page.locator('#optional').focus();
  await page.waitForFunction(()=>document.querySelector('#email').getAttribute('aria-invalid')==='true');
  await page.locator('#email').fill('');await page.locator('#optional').focus();
  await page.waitForFunction(()=>!document.querySelector('#email').hasAttribute('data-validation-invalid'));await page.close();
});
test('desmontar a validação remove mensagens e atributos adicionados',async()=>{
  const page=await fixture();await page.locator('#send').click();await page.evaluate(()=>window.cleanupValidation());
  assert.equal(await page.locator('.vallex-field-error').count(),0);assert.equal(await page.locator('[data-validation-invalid]').count(),0);
  assert.equal(await page.locator('#name').getAttribute('aria-describedby'),'name-hint');await page.close();
});

test('limpar formulário remove erro monetário sem deixar validade antiga',async()=>{
  const page=await fixture();await page.locator('#money').fill('texto');await page.locator('#send').click();
  await page.locator('#reset').click();
  await page.waitForFunction(()=>document.querySelectorAll('.vallex-field-error').length===0);
  assert.equal(await page.locator('#money').evaluate(el=>el.validity.customError),false);await page.close();
});
test('selecionar uma opção limpa erros do grupo de rádio obrigatório',async()=>{
  const page=await fixture();await page.evaluate(()=>{
    const group=document.createElement('div');group.innerHTML='<label><input id="radio-a" type="radio" name="rating" required value="a">A</label><label><input id="radio-b" type="radio" name="rating" value="b">B</label>';
    document.querySelector('form').append(group);
  });
  await page.locator('#send').click();assert.equal(await page.locator('#radio-a').getAttribute('aria-invalid'),'true');
  await page.locator('#radio-b').check();await page.waitForFunction(()=>!document.querySelector('#radio-a').hasAttribute('data-validation-invalid'));await page.close();
});
