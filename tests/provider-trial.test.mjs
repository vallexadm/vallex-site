import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root=process.env.VALLEX_CHECKOUT ?? process.cwd();
let subscription={plan_id:'basic-plan',status:'trialing',current_period_end:'2099-11-20T13:45:00Z'};
let existingOrganization=false;
let calls=[];
const uid='11111111-1111-4111-8111-111111111111';
const organization={id:'22222222-2222-4222-8222-222222222222',name:'Teste local',owner_id:uid,business_type:'Manutenção'};
const basicPlan={id:'basic-plan',code:'basic',name:'Basic'};
globalThis.trialClient=()=>({
  auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
  from(table){
    const call={table,op:'read',payload:null,filters:[]};calls.push(call);const q={};
    for(const method of ['select','eq','in','order','limit','is'])q[method]=(...args)=>{call.filters.push([method,...args]);return q;};
    for(const method of ['insert','update','delete'])q[method]=payload=>{call.op=method;call.payload=payload;return q;};
    const result=()=>{
      if(table==='organizations')return {data:call.op==='insert'||existingOrganization?organization:null,error:null};
      if(table==='organization_members')return {data:null,error:null};
      if(table==='organization_subscriptions')return {data:call.op==='read'?subscription:null,error:null};
      if(table==='organization_public_profiles')return {data:null,error:null};
      if(table==='plans'){
        const free=call.filters.some(([method,key,value])=>method==='eq'&&key==='code'&&value==='free');
        const pro=call.filters.some(([method,key,value])=>method==='eq'&&key==='id'&&value==='pro-plan');
        return {data:free?{id:'free-plan',code:'free',name:'Free'}:pro?{id:'pro-plan',code:'professional',name:'Professional'}:basicPlan,error:null};
      }
      throw new Error('Acesso inesperado à tabela '+table);
    };
    q.maybeSingle=async()=>result();q.single=async()=>result();q.then=(resolve,reject)=>Promise.resolve(table === "plans" ? {data:[basicPlan],error:null} : result()).then(resolve,reject);return q;
  }
});
registerHooks({
  resolve(specifier,context,next){
    if(specifier==='@supabase/supabase-js')return {url:'trial:db',shortCircuit:true};
    if(specifier==='next/server')return next(pathToFileURL(path.join(root,'node_modules/next/server.js')).href,context);
    if(specifier.startsWith('@/'))return next(pathToFileURL(path.join(root,specifier.slice(2)+'.ts')).href,context);
    return next(specifier,context);
  },
  load(url,context,next){if(url==='trial:db')return {format:'module',source:'export const createClient = (...args) => globalThis.trialClient(...args);',shortCircuit:true};return next(url,context);}
});
const moduleAt=file=>import(pathToFileURL(path.join(root,file)).href);
const {BASIC_TRIAL_DAYS,createBasicTrialPeriod,isProviderTrialExpired}=await moduleAt('lib/provider-trial.ts');
const {getPlanEntitlements}=await moduleAt('lib/server/plan-entitlements.ts');
const {requireProviderPanelAccess}=await moduleAt('lib/server/provider-panel-access.ts');
const {POST:createOrganization}=await moduleAt('app/api/sistema/organizacao/route.ts');
const {GET:getPlans}=await moduleAt('app/api/sistema/asaas/plans/route.ts');
const start=new Date('2026-10-21T13:45:00Z');
const end='2026-11-20T13:45:00.000Z';
for(const name of ['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL'])process.env[name]='https://trial.invalid';
for(const name of ['SUPABASE_SECRET_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY'])process.env[name]='fixture-only';
function request(method='GET',payload){return new Request('https://trial.invalid/api',{method,headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});}

test('Basic começa com exatamente 30 dias corridos',()=>{
  assert.equal(BASIC_TRIAL_DAYS,30);assert.equal(createBasicTrialPeriod(start).endsAt.toISOString(),end);
  assert.equal(createBasicTrialPeriod(start).startedAt.toISOString(),start.toISOString());
});
test('teste expira no instante do vencimento, sem estender até o fim do dia',()=>{
  assert.equal(isProviderTrialExpired(end,new Date('2026-11-20T13:44:59.999Z')),false);
  assert.equal(isProviderTrialExpired(end,new Date(end)),true);
  assert.equal(isProviderTrialExpired(end,new Date('2026-11-20T13:45:00.001Z')),true);
});
test('teste sem data ou com data inválida não libera recursos',()=>{
  for(const value of [null,undefined,'','invalid'])assert.equal(isProviderTrialExpired(value,start),true);
});
test('Basic em teste libera gestão antes do vencimento e aplica Free depois',async()=>{
  subscription={plan_id:'basic-plan',status:'trialing',current_period_end:end};
  const before=await getPlanEntitlements(globalThis.trialClient(),organization.id,start);
  assert.equal(before.entitlements.code,'basic');assert.equal(before.entitlements.canAccessPanel,true);assert.equal(before.entitlements.maxServices,5);
  const expired=await getPlanEntitlements(globalThis.trialClient(),organization.id,new Date(end));
  assert.equal(expired.entitlements.code,'free');assert.equal(expired.entitlements.canAccessPanel,false);
  assert.equal(expired.entitlements.canViewRequests,true);assert.equal(expired.entitlements.maxServices,1);
});
test('Basic pago e Professional pago continuam ativos sem alteração de duração',async()=>{
  for(const planId of ['basic-plan','pro-plan']){
    subscription={plan_id:planId,status:'active',current_period_end:'2099-11-20T03:00:00Z'};
    const result=await getPlanEntitlements(globalThis.trialClient(),organization.id,start);
    assert.equal(result.entitlements.canAccessPanel,true);
    assert.equal(result.entitlements.code,planId==='basic-plan'?'basic':'professional');
  }
});
test('novo negócio recebe Basic trialing de 30 dias, sem contratar cobrança',async()=>{
  existingOrganization=false;calls=[];
  const response=await createOrganization(request('POST',{name:'Negócio de teste',business_type:'Manutenção'}));
  assert.equal(response.status,201);
  const saved=calls.find(c=>c.table==='organization_subscriptions'&&c.op==='insert').payload;
  assert.equal(saved.plan_id,'basic-plan');assert.equal(saved.status,'trialing');assert.equal(saved.billing_provider,'manual');
  assert.equal(new Date(saved.current_period_end)-new Date(saved.current_period_start),30*24*60*60*1000);
});
test('repetir configuração não reinicia nem renova o teste',async()=>{
  existingOrganization=true;calls=[];
  const response=await createOrganization(request('POST',{name:'Negócio de teste',business_type:'Manutenção'}));
  assert.equal(response.status,200);assert.equal((await response.json()).alreadyConfigured,true);
  assert.equal(calls.some(c=>c.op!=='read'),false);
});
test('lista de planos apresenta Free quando o teste venceu',async()=>{
  existingOrganization=true;subscription={plan_id:'basic-plan',status:'trialing',current_period_end:'2020-01-01T13:45:00Z'};
  const response=await getPlans(request());assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.current.code,'free');assert.equal(body.current.currentPeriodEnd,null);
});
test('bloqueio central nega gestão após expiração e não altera registros',async()=>{
  subscription={plan_id:'basic-plan',status:'trialing',current_period_end:'2020-01-01T13:45:00Z'};calls=[];
  const response=await requireProviderPanelAccess(globalThis.trialClient(),organization.id);assert.equal(response.status,402);
  assert.equal(calls.some(c=>c.op!=='read'),false);
});
for(const route of ['agenda','financeiro','clientes','orcamentos']){
  test(`API de ${route} rejeita consulta e gravação com teste vencido`,async()=>{
    existingOrganization=true;subscription={plan_id:'basic-plan',status:'trialing',current_period_end:'2020-01-01T13:45:00Z'};calls=[];
    const api=await moduleAt(`app/api/sistema/${route}/route.ts`);
    assert.equal((await api.GET(request())).status,402);
    assert.equal((await api.POST(request('POST',{}))).status,402);
    assert.equal(calls.some(c=>c.op!=='read'),false);
  });
}
test('mensagens de adesão informam 30 dias e não prometem cinco',async()=>{
  for(const file of ['app/sistema/page.tsx','app/sistema/planos/page.tsx','app/solucoes/page.tsx','app/termos/page.tsx']){
    const source=await readFile(path.join(root,file),'utf8');assert.match(source,/30 dias/);assert.doesNotMatch(source,/(?:5|cinco) dias (?:de teste|grátis)/);
  }
});
