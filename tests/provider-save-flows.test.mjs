import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

// Executa os handlers reais extraidos por AST, com rede/estado de interface isolados.
// Nao substitui teste visual no navegador.
const root=process.env.VALLEX_CHECKOUT ?? process.cwd();
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
async function handler(file,name,context){
  const source=await readFile(path.join(root,file),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let found;
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit);}
  visit(ast);assert.ok(found,`Handler ${name} encontrado`);
  const code=ts.transpileModule(found.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,jsx:ts.JsxEmit.React}}).outputText;
  return new Function(...Object.keys(context),`${code};return ${name};`)(...Object.values(context));
}
function quoteContext(fetch){
  const state={editingId:null,pending:[new File(['a'],'a.pdf'),new File(['b'],'b.pdf')],error:'',sending:false};
  const context={
    savingQuoteRef:{current:false},setError:v=>state.error=v,setMessage:()=>{},setSending:v=>state.sending=v,
    getAccessToken:async()=> 'fake-session',editingId:state.editingId,customerId:'customer',titulo:'Proposta',descricao:'Teste',
    valorOrcamentoTotal:1000,valor:'1000',custosInternos:[],validadeAte:'',observacoes:'',status:'rascunho',role:'owner',
    parseMoney:Number,fetch,arquivosSelecionados:state.pending,setEditingId:v=>state.editingId=v,
    setArquivosSelecionados:fn=>state.pending=fn(state.pending),setAnexos:()=>{},carregarAnexos:async()=>{},loadData:async()=>{},
  };
  return {context,state};
}
test('falha no segundo anexo retoma o mesmo orçamento e repete somente o arquivo pendente',async()=>{
  const requests=[];let fail=true;
  const {context,state}=quoteContext(async(url,options)=>{
    requests.push({url,method:options.method,file:options.body instanceof FormData?options.body.get('arquivo').name:null});
    if(url==='/api/sistema/orcamentos')return Response.json({ok:true,orcamento:{id:'quote-saved'}});
    if(options.body.get('arquivo').name==='b.pdf'&&fail){fail=false;return Response.json({message:'Falha de upload simulada'},{status:500});}
    return Response.json({arquivo:{path:options.body.get('arquivo').name}});
  });
  const first=await handler('app/sistema/orcamentos/page.tsx','handleSubmit',context);
  await first({preventDefault(){}});
  assert.equal(state.editingId,'quote-saved');assert.equal(state.sending,false);assert.equal(context.savingQuoteRef.current,false);
  assert.deepEqual(state.pending.map(f=>f.name),['b.pdf']);
  assert.match(state.error,/Falha de upload/);
  const retry=await handler('app/sistema/orcamentos/page.tsx','handleSubmit',{...context,editingId:state.editingId,arquivosSelecionados:state.pending});
  await retry({preventDefault(){}});
  assert.deepEqual(requests.filter(r=>r.url==='/api/sistema/orcamentos').map(r=>r.method),['POST','PATCH']);
  assert.deepEqual(requests.filter(r=>r.file).map(r=>r.file),['a.pdf','b.pdf','b.pdf']);
  assert.equal(state.pending.length,0);
});
test('dois envios antes do próximo render não criam dois orçamentos',async()=>{
  let calls=0;let release;
  const {context}=quoteContext(async()=>{calls++;return Response.json({orcamento:{id:'one'}});});
  context.arquivosSelecionados=[];
  context.getAccessToken=()=>new Promise(resolve=>release=resolve);
  const submit=await handler('app/sistema/orcamentos/page.tsx','handleSubmit',context);
  const first=submit({preventDefault(){}});await submit({preventDefault(){}});
  release('fake-session');await first;
  assert.equal(calls,1);assert.equal(context.savingQuoteRef.current,false);
});
test('sessão ausente libera bloqueio para uma nova tentativa de orçamento',async()=>{
  const {context}=quoteContext(async()=>{throw new Error('Não deveria acessar rede');});
  context.getAccessToken=async()=>null;
  const submit=await handler('app/sistema/orcamentos/page.tsx','handleSubmit',context);
  await submit({preventDefault(){}});assert.equal(context.savingQuoteRef.current,false);
});
function permissionContext(fetch){
  return {savingPermissionRef:{current:false},setError:()=>{},setNotice:()=>{},setSavingPermissionKey:()=>{},
    normalizeMemberPermissions:v=>v,getToken:async()=> 'fake-session',fetch,setMembers:()=>{}};
}
const member={user_id:'member',name:'Teste',permissions:{finance:{view:false,manage:false}}};
test('alterações simultâneas de permissões não enviam duas matrizes antigas',async()=>{
  let calls=0;let release;
  const context=permissionContext(async()=>{calls++;await new Promise(resolve=>release=resolve);return Response.json({ok:true,permissions:{finance:{view:true,manage:true}}});});
  const change=await handler('app/sistema/configuracoes/page.tsx','changePermission',context);
  const first=change(member,'finance','manage',true);
  await change(member,'finance','view',true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  release();await first;assert.equal(context.savingPermissionRef.current,false);
});
test('falha ao salvar permissão libera bloqueio e permite tentar novamente',async()=>{
  let calls=0;
  const context=permissionContext(async()=>{calls++;return Response.json({ok:false,message:'Falha simulada'},{status:500});});
  const change=await handler('app/sistema/configuracoes/page.tsx','changePermission',context);
  await change(member,'finance','manage',true);assert.equal(context.savingPermissionRef.current,false);
  await change(member,'finance','manage',true);assert.equal(calls,2);
});


function paymentService(received=0) {
  return {id:'service-test',amount_charged:1000,amount_received:received,installments_total:2,
    scheduled_installments:[{id:'second',installment_number:2,amount:500,due_date:'2026-12-19'},
      {id:'first',installment_number:1,amount:500,due_date:'2026-11-19'}],
    payments:received?[{id:'payment-1',installment_number:1,amount:received,payment_date:'2026-10-20',payment_method:'pix'}]:[]};
}
async function financeHandlers(context={}) {
  const getPaymentInstallments=await handler('app/sistema/financeiro/page.tsx','getPaymentInstallments',{});
  const state={error:'',message:'',saving:false};
  const ctx={completePaymentRequest:()=>{},getPaymentRequestId:()=> '11111111-1111-4111-8111-111111111111',getPaymentInstallments,paymentSavingRef:{current:false},paymentInstallment:'1',paymentAmount:'500,00',paymentInstallmentsTotal:'2',paymentMethod:'pix',paymentDate:'2026-10-20',
    parseCurrencyInput:value=>Number(String(value).replaceAll('.','').replace(',','.')),
    formatCurrency:value=>String(value),setError:value=>state.error=value,setMessage:value=>state.message=value,
    setSavingPayment:value=>state.saving=value,getToken:async()=>'fake-session',
    setPaymentServiceId:()=>{},setPaymentSource:()=>{},setPaymentAmount:()=>{},setPaymentInstallment:()=>{},
    loadData:async()=>{},periodRange:{from:'2026-10-01',to:'2026-10-31'},...context};
  return {submit:await handler('app/sistema/financeiro/page.tsx','submitPayment',ctx),ctx,state,getPaymentInstallments};
}
const paymentEvent=()=>({preventDefault(){},stopPropagation(){}});
test('uma baixa envia somente R$500 para a primeira parcela, mesmo com dois cliques',async()=>{
  const calls=[];let release;
  const {submit,ctx,state}=await financeHandlers({fetch:async(url,options)=>{
    calls.push(JSON.parse(options.body));await new Promise(resolve=>release=resolve);return Response.json({ok:true});
  }});
  const first=submit(paymentEvent(),paymentService());
  await submit(paymentEvent(),paymentService());
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);
  assert.equal(calls[0].installment_number,1);assert.equal(calls[0].amount,'500,00');
  release();await first;assert.equal(ctx.paymentSavingRef.current,false);assert.equal(state.saving,false);
  assert.match(state.message,/somente na 1ª parcela/);
});
test('rejeita parcela quitada e valor que excede o saldo da parcela antes de enviar',async()=>{
  let calls=0;
  const {submit,state}=await financeHandlers({fetch:async()=>{calls++;}});
  await submit(paymentEvent(),paymentService(500));assert.equal(calls,0);assert.match(state.error,/parcela pendente/);
  const excessive=await financeHandlers({paymentAmount:'1000,00',fetch:async()=>{calls++;}});
  await excessive.submit(paymentEvent(),paymentService());assert.equal(calls,0);
});
test('não recebe parcela sem escolha explícita e libera bloqueio após falha de rede',async()=>{
  const empty=await financeHandlers({paymentInstallment:'',fetch:async()=>{throw new Error('Não deveria chamar rede');}});
  await empty.submit(paymentEvent(),paymentService());assert.match(empty.state.error,/Selecione/);
  const failed=await financeHandlers({fetch:async()=>{throw new Error('Rede indisponível');}});
  await failed.submit(paymentEvent(),paymentService());assert.equal(failed.ctx.paymentSavingRef.current,false);
  assert.equal(failed.state.saving,false);assert.match(failed.state.error,/Rede indisponível/);
});
test('opções ordenam parcelas, mantêm a segunda pendente e calculam pagamento parcial',async()=>{
  const {getPaymentInstallments}=await financeHandlers();
  assert.deepEqual(getPaymentInstallments(paymentService(500)).map(i=>[i.number,i.balance]),[[1,0],[2,500]]);
  assert.deepEqual(getPaymentInstallments(paymentService(200)).map(i=>[i.number,i.balance]),[[1,300],[2,500]]);
});
test('resumo mostra uma linha por parcela sem repetir a baixa como outra parcela',async()=>{
  const React={createElement:(tag,props,...children)=>({tag,props,children})};
  const Summary=await handler('app/sistema/financeiro/page.tsx','ServiceInstallments',{
    React,formatDate:value=>value,formatCurrency:value=>String(value),paymentMethodLabels:{pix:'Pix'}});
  const tree=Summary({service:paymentService(500)});
  const flatten=node=>node==null||node===false?'':Array.isArray(node)?node.map(flatten).join(''):typeof node==='object'?flatten(node.children):String(node);
  const visible=flatten(tree);
  assert.equal((visible.match(/1ª parcela/g)||[]).length,1);assert.equal((visible.match(/2ª parcela/g)||[]).length,1);
  assert.match(visible,/Quitada/);assert.match(visible,/Pendente/);
});


test('atalho de cliente avulso seleciona o cadastro retornado e evita duplo envio',async()=>{
  const state={customers:[],selected:'',saving:false};let calls=0;let release;
  const context={walkInSavingRef:{current:false},setSavingWalkIn:v=>state.saving=v,setError:()=>{},setMessage:()=>{},
    getToken:async()=>'fake-session',fetch:async()=>{calls++;await new Promise(resolve=>release=resolve);return Response.json({customer:{id:'walk-in',name:'Cliente avulso'}});},
    setData:fn=>Object.assign(state,fn(state)),setCustomerId:v=>state.selected=v};
  const click=await handler('app/sistema/financeiro/page.tsx','handleWalkInCustomer',context);
  const first=click();await click();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);release();await first;
  assert.equal(state.selected,'walk-in');assert.equal(state.customers.length,1);assert.equal(context.walkInSavingRef.current,false);
});
function apiContext(admin){return {exports:{},getFinanceContext:async()=>({admin,user:{id:'actor'},organization:{id:'org-trusted'},permissions:{finance:{manage:true}}}),
  NextResponse:{json:(body,options)=>Response.json(body,options)},fail:(message,status)=>Response.json({ok:false,message},{status}),
  parseCurrencyInput:Number,validDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),paymentStatuses:['pago','pendente'],monthlyDueDate:value=>value,randomUUID:()=> 'recurrence-test'};}
test('API de cliente avulso usa organização autenticada e ignora organização enviada',async()=>{
  let parameters;
  const context=apiContext({rpc:async(name,args)=>{parameters=args;return {data:[{id:'walk',name:'Cliente avulso'}],error:null};}});
  const post=await handler('app/api/sistema/financeiro/route.ts','POST',context);
  const response=await post(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({type:'walk_in_customer',organization_id:'other-org'})}));
  assert.equal(response.status,200);assert.equal(parameters.p_organization_id,'org-trusted');
});
const collaboratorExpense={type:'expense',description:'Instalação',category:'Serviços de colaboradores',amount:150,payment_status:'pendente',expense_type:'avulsa',due_date:'2026-10-30',collaborator_user_id:'trusted-member'};
test('despesa valida vínculo e usa nome do colaborador consultado no servidor',async()=>{
  let saved;
  const context={...apiContext({from:()=>({insert:entries=>{saved=entries;return {select:async()=>({data:entries,error:null})};}})}),
    getFinanceCollaborators:async()=>[{id:'trusted-member',name:'Colaborador cadastrado'}]};
  const post=await handler('app/api/sistema/financeiro/route.ts','POST',context);
  const response=await post(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({...collaboratorExpense,collaborator_name:'Nome adulterado'})}));
  assert.equal(response.status,201);assert.equal(saved[0].collaborator_name,'Colaborador cadastrado');assert.equal(saved[0].organization_id,'org-trusted');
  assert.equal(saved[0].payment_status,'pendente');assert.match(saved[0].description,/Colaborador cadastrado/);
});
test('despesa rejeita colaborador de outra organização ou não selecionado',async()=>{
  let writes=0;const context={...apiContext({from:()=>{writes++;throw new Error('Não deve gravar');}}),getFinanceCollaborators:async()=>[]};
  const post=await handler('app/api/sistema/financeiro/route.ts','POST',context);
  for(const id of ['outsider','']){
    const response=await post(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({...collaboratorExpense,collaborator_user_id:id})}));
    assert.equal(response.status,400);
  }
  assert.equal(writes,0);
});
