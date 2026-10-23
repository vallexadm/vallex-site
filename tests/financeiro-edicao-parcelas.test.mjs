import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.VALLEX_PGLITE_MODULE
  ? pathToFileURL(process.env.VALLEX_PGLITE_MODULE).href
  : '@electric-sql/pglite');

// PostgreSQL isolado em memoria. Sem Supabase, contas ou transacoes reais.
const original = new URL('../supabase/', import.meta.url);
const revised = process.env.VALLEX_FINANCE_MIGRATION_DIR
  ? pathToFileURL(process.env.VALLEX_FINANCE_MIGRATION_DIR.replace(/[\\/]?$/, '/'))
  : new URL('../supabase/', import.meta.url);
const db = new PGlite();
after(async () => { await db.close(); });
const uid = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
const customer = '33333333-3333-4333-8333-333333333333';
const service = '44444444-4444-4444-8444-444444444444';
const otherOrg = '55555555-5555-4555-8555-555555555555';
const otherCustomer = '66666666-6666-4666-8666-666666666666';
const signature = 'public.update_organization_service_record(uuid,uuid,uuid,text,date,text,numeric,text,jsonb,uuid)';
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
  CREATE TABLE public.organizations(id uuid PRIMARY KEY);
  CREATE TABLE public.customers(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, organization_id uuid, name text, status text DEFAULT 'ativo', notes text);
  INSERT INTO auth.users VALUES ('${uid}', 'teste@example.invalid');
  INSERT INTO organizations VALUES ('${org}'), ('${otherOrg}');
  INSERT INTO customers(id,organization_id,name) VALUES ('${customer}', '${org}', 'Cliente teste'),
    ('${otherCustomer}', '${otherOrg}', 'Outro negocio');
`);
for (const file of ['financeiro_prestador.sql', 'financeiro_recebimentos_parcelados.sql', 'financeiro_detalhamento.sql', 'financeiro_edicao_historico.sql']) {
  await db.exec(await readFile(file === 'financeiro_edicao_historico.sql'
    ? new URL('./fixtures/financeiro_edicao_historico_antes.sql', import.meta.url)
    : new URL(file, original), 'utf8'));
}
const migration = await readFile(new URL('financeiro_correcao_edicao_parcelas_recebidas.sql', revised), 'utf8');
function installments(amounts = [500, 500]) {
  return amounts.map((amount, i) => ({ installment_number: i + 1, amount, due_date: `2026-${String(10 + i).padStart(2,'0')}-25` }));
}
async function seed({ amounts = [500, 500], payments = [], charged = 1000 } = {}) {
  await db.exec('TRUNCATE organization_finance_audit_logs, organization_service_payments, organization_service_cost_items, organization_service_installments, organization_service_records CASCADE');
  await db.query(`INSERT INTO organization_service_records
    (id, organization_id, customer_id, service_name, service_date, source, amount_charged, created_by, installments_total)
    VALUES ($1,$2,$3,'Servico original','2026-10-20','outros',$4,$5,$6)`, [service,org,customer,charged,uid,Math.max(1,amounts.length)]);
  for (const item of installments(amounts)) {
    await db.query(`INSERT INTO organization_service_installments(organization_id,service_record_id,installment_number,due_date,amount) VALUES ($1,$2,$3,$4,$5)`,[org,service,item.installment_number,item.due_date,item.amount]);
  }
  for (const [number,amount] of payments) {
    await db.query('SELECT record_organization_service_payment($1,$2,$3,$4,$5,$6,$7,$8)',[org,service,number,Math.max(1,amounts.length),'pix','2026-10-20',amount,uid]);
  }
}
async function edit({ amount = 1000, schedule = installments(), organization = org, customerId = customer } = {}) {
  return db.query('SELECT update_organization_service_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[organization,service,customerId,'Servico revisado','2026-10-20','outros',amount,'Observacao revisada',JSON.stringify(schedule),uid]);
}
async function snapshot() {
  return (await db.query('SELECT installment_number, amount, payment_method, payment_date, created_by FROM organization_service_payments ORDER BY installment_number,id')).rows;
}

test('reproduz o defeito antigo e corrige o mesmo registro sem alterar recebimentos', async () => {
  await seed({payments:[[1,500]]});
  const before = await snapshot();
  await assert.rejects(edit(), /INVALID_INSTALLMENTS/);
  await db.exec(migration);
  await edit();
  assert.deepEqual(await snapshot(),before);
  const row=(await db.query('SELECT service_name,amount_charged,amount_received FROM organization_service_records')).rows[0];
  assert.equal(row.service_name,'Servico revisado');
  assert.equal(Number(row.amount_received),500);
  assert.equal(Number(row.amount_charged),1000);
});

test('edita cobranca sem recebimentos',async()=>{await seed();await edit();});
test('edita apos recebimento parcial de parcela',async()=>{await seed({payments:[[1,100]]});await edit();});
test('edita apos varias baixas parciais na mesma parcela',async()=>{await seed({payments:[[1,100],[1,200]]});await edit();});
test('edita cobranca totalmente quitada',async()=>{await seed({payments:[[1,500],[2,500]]});await edit();});
test('considera entrada fora das parcelas sem duplicar baixas de parcelas',async()=>{
  await seed({amounts:[400,400],payments:[[0,200],[1,400]]});
  await edit({schedule:installments([400,400])});
});
test('impede aumentar parcelas alem do total incluindo entrada',async()=>{
  await seed({amounts:[400,400],payments:[[0,200],[1,100]]});
  await assert.rejects(edit({schedule:installments([450,450])}),/INVALID_INSTALLMENTS/);
});
test('impede reduzir valor total abaixo do recebido',async()=>{
  await seed({payments:[[1,500]]});await assert.rejects(edit({amount:400}),/CHARGE_BELOW_RECEIVED/);
});
test('impede reduzir parcela abaixo do que ela ja recebeu',async()=>{
  await seed({payments:[[1,500]]});await assert.rejects(edit({schedule:installments([400,600])}),/INVALID_INSTALLMENTS/);
});
test('permite redistribuir apenas valores ainda nao recebidos',async()=>{
  await seed({payments:[[1,200]]});await edit({schedule:installments([300,700])});
});
test('permite editar cobranca avista sem parcelas cadastradas',async()=>{
  await seed({amounts:[],payments:[[0,1000]]});await edit({schedule:[]});
});
test('recusa alteracao da quantidade de parcelas',async()=>{
  await seed();await assert.rejects(edit({schedule:installments([1000])}),/INSTALLMENT_COUNT_CHANGE_NOT_SUPPORTED/);
});
test('recusa parcelas com numeros repetidos',async()=>{
  await seed();const schedule=installments();schedule[1].installment_number=1;
  await assert.rejects(edit({schedule}),/INVALID_INSTALLMENTS/);
});
test('recusa acesso com outra organizacao',async()=>{
  await seed();await assert.rejects(edit({organization:otherOrg}),/SERVICE_NOT_FOUND/);
});
test('recusa cliente pertencente a outra organizacao',async()=>{
  await seed();await assert.rejects(edit({customerId:otherCustomer}),/CUSTOMER_NOT_FOUND/);
});
test('recusa edicao de cobranca arquivada',async()=>{
  await seed();await db.exec('UPDATE organization_service_records SET deleted_at=now()');
  await assert.rejects(edit(),/SERVICE_NOT_FOUND/);
});
test('preserva trilha de auditoria com autor e dados anteriores',async()=>{
  await seed({payments:[[1,500]]});await edit();
  const row=(await db.query("SELECT actor_user_id,details FROM organization_finance_audit_logs WHERE action='updated' ORDER BY created_at DESC LIMIT 1")).rows[0];
  assert.equal(row.actor_user_id,uid);assert.equal(row.details.before.service_name,'Servico original');assert.equal(row.details.after.service_name,'Servico revisado');
});
test('migracao pode ser reaplicada sem mudar registros e restringe execucao',async()=>{
  const before=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),before);
  for(const role of ['anon','authenticated']) {
    const row=(await db.query('SELECT has_function_privilege($1,$2,$3) AS permitted',[role,signature,'EXECUTE'])).rows[0];
    assert.equal(row.permitted,false);
  }
  assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) AS permitted',['service_role',signature,'EXECUTE'])).rows[0].permitted,true);
});

test('uma baixa de R$500 na primeira parcela mantém R$500 em aberto e o calendário intacto',async()=>{
  await seed();
  const before=(await db.query('SELECT installment_number,due_date,amount FROM organization_service_installments ORDER BY installment_number')).rows;
  await db.query('SELECT record_organization_service_payment($1,$2,$3,$4,$5,$6,$7,$8)',[org,service,1,2,'pix','2026-10-20',500,uid]);
  const record=(await db.query('SELECT amount_charged,amount_received FROM organization_service_records WHERE id=$1',[service])).rows[0];
  assert.equal(Number(record.amount_received),500);
  assert.equal(Number(record.amount_charged)-Number(record.amount_received),500);
  const payments=await snapshot();assert.equal(payments.length,1);assert.equal(payments[0].installment_number,1);
  assert.deepEqual((await db.query('SELECT installment_number,due_date,amount FROM organization_service_installments ORDER BY installment_number')).rows,before);
});
test('somente uma baixa explícita da segunda parcela quita o saldo restante',async()=>{
  await seed({payments:[[1,500]]});
  await db.query('SELECT record_organization_service_payment($1,$2,$3,$4,$5,$6,$7,$8)',[org,service,2,2,'pix','2026-10-20',500,uid]);
  assert.equal(Number((await db.query('SELECT amount_received FROM organization_service_records WHERE id=$1',[service])).rows[0].amount_received),1000);
  assert.equal((await snapshot()).length,2);
});

test('migração cria cliente avulso único e preserva clientes existentes',async()=>{
  const before=(await db.query('SELECT id,name FROM customers ORDER BY id')).rows;
  await db.exec(await readFile(new URL('financeiro_cliente_avulso_colaborador.sql',revised),'utf8'));
  const first=(await db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[org])).rows[0];
  const again=(await db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[org])).rows[0];
  assert.equal(first.id,again.id);assert.equal(first.name,'Cliente avulso');assert.equal(first.is_walk_in,true);
  assert.deepEqual((await db.query('SELECT id,name FROM customers WHERE NOT is_walk_in ORDER BY id')).rows,before);
});
test('cliente avulso é separado por organização e pode ser reativado',async()=>{
  const one=(await db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[org])).rows[0];
  const other=(await db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[otherOrg])).rows[0];
  assert.notEqual(one.id,other.id);
  await db.query("UPDATE customers SET status='inativo' WHERE id=$1",[one.id]);
  const active=(await db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[org])).rows[0];
  assert.equal(active.id,one.id);assert.equal(active.status,'ativo');
});
test('requisições repetidas de cliente avulso retornam o mesmo cadastro',async()=>{
  const results=await Promise.all(Array.from({length:5},()=>db.query('SELECT * FROM get_or_create_walk_in_customer($1)',[org])));
  assert.equal(new Set(results.map(result=>result.rows[0].id)).size,1);
});
test('despesa preserva nome histórico quando o usuário colaborador é removido',async()=>{
  await seed();const collaborator='77777777-7777-4777-8777-777777777777';
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[collaborator,'colaborador@example.invalid']);
  await db.query(`INSERT INTO organization_business_expenses(organization_id,description,category,amount,created_by,collaborator_user_id,collaborator_name)
    VALUES($1,'Servico de teste','Serviços de colaboradores',150,$2,$3,'Nome histórico')`,[org,uid,collaborator]);
  await db.query('DELETE FROM auth.users WHERE id=$1',[collaborator]);
  const expense=(await db.query("SELECT collaborator_user_id,collaborator_name FROM organization_business_expenses WHERE description='Servico de teste'")).rows[0];
  assert.equal(expense.collaborator_user_id,null);assert.equal(expense.collaborator_name,'Nome histórico');
});
test('migração de avulso e colaborador é reaplicável e protege a função de criação',async()=>{
  await db.exec(await readFile(new URL('financeiro_cliente_avulso_colaborador.sql',revised),'utf8'));
  for(const role of ['anon','authenticated'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) AS permitted',[role,'public.get_or_create_walk_in_customer(uuid)','EXECUTE'])).rows[0].permitted,false);
});

test('recebimento idempotente retorna o mesmo ID e rejeita reutilizacao com outros dados', async () => {
  await db.exec(await readFile(new URL('financeiro_recebimentos_idempotentes.sql', revised), 'utf8'));
  await seed();
  const key='99999999-9999-4999-8999-999999999999';
  const args=[key,org,service,1,2,'pix','2026-10-20',100,uid];
  const sql='SELECT record_organization_service_payment_once($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id';
  const first=await db.query(sql,args);
  const retry=await db.query(sql,args);
  assert.equal(first.rows[0].id,retry.rows[0].id);
  assert.equal((await snapshot()).length,1);
  await assert.rejects(db.query(sql,[...args.slice(0,7),200,uid]),/REQUEST_PAYLOAD_CONFLICT/);
  const failedKey='88888888-8888-4888-8888-888888888888';
  await assert.rejects(db.query(sql,[failedKey,...args.slice(1,7),900,uid]),/PAYMENT_EXCEEDS_INSTALLMENT/);
  assert.equal((await db.query('SELECT * FROM organization_payment_requests WHERE request_id=$1',[failedKey])).rows.length,0);
  await db.query(sql,[failedKey,...args.slice(1,7),100,uid]);
  assert.equal((await snapshot()).length,2);
});
