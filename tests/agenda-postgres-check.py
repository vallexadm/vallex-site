"""Teste isolado PostgreSQL real; nao usa rede, credenciais ou dados de producao."""
import subprocess,time,concurrent.futures,json
from pathlib import Path
container='vallex-agenda-check-20261027'
def sql(text,db='agenda_verify',ok=True):
 r=subprocess.run(['docker','exec',container,'psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-Atc',text],capture_output=True,text=True)
 if ok and r.returncode:raise AssertionError(r.stderr)
 return r
def file(name,db):
 subprocess.run(['docker','cp',str(Path(name).resolve()),container+':/tmp/input.sql'],check=True,capture_output=True)
 r=subprocess.run(['docker','exec',container,'psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-f','/tmp/input.sql'],capture_output=True,text=True)
 return r
u1='11111111-1111-4111-8111-111111111111';u2='22222222-2222-4222-8222-222222222222';u3='33333333-3333-4333-8333-333333333333'
org='44444444-4444-4444-8444-444444444444';org2='55555555-5555-4555-8555-555555555555';customer='66666666-6666-4666-8666-666666666666'
def setup(db):
 sql(f'CREATE DATABASE {db} TEMPLATE template0;',db='postgres')
 sql(f"CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE organizations(id uuid primary key); CREATE TABLE customers(id uuid primary key); INSERT INTO auth.users VALUES ('{u1}'),('{u2}'),('{u3}'); INSERT INTO organizations VALUES ('{org}'),('{org2}'); INSERT INTO customers VALUES ('{customer}');",db=db)
 r=file('supabase/agenda_colaboradores.sql',db);assert not r.returncode,r.stderr
def insert(start,end,user=u1,organization=org,status='scheduled',buffer=0):
 return f"INSERT INTO organization_appointments(organization_id,customer_id,assigned_to,created_by,title,starts_at,ends_at,status,buffer_minutes) VALUES('{organization}','{customer}','{user}','{u1}','Teste','2026-11-01 {start}+00',"+(f"'2026-11-01 {end}+00'" if end else 'NULL')+f",'{status}',{buffer}) RETURNING id;"
setup('agenda_verify');r=file('supabase/agenda_acompanhamento_conflitos.sql','agenda_verify');assert not r.returncode,r.stderr
first=sql(insert('10:00','11:00',buffer=15)).stdout.splitlines()[0]
assert sql(insert('11:00','11:30'),ok=False).returncode!=0
sql(insert('11:15','12:00'));sql(insert('10:00','11:00',user=u2))
assert sql(insert('10:30','10:45',organization=org2),ok=False).returncode!=0
assert sql(f"UPDATE organization_appointments SET starts_at='2026-11-01 11:30+00',ends_at='2026-11-01 12:30+00' WHERE id='{first}';",ok=False).returncode!=0
sql(f"UPDATE organization_appointments SET status='cancelled',updated_by='{u1}' WHERE id='{first}';")
sql(insert('10:00','11:00'))
assert sql(f"SELECT revision FROM organization_appointments WHERE id='{first}'").stdout.strip()=='1'
assert int(sql(f"SELECT count(*) FROM organization_appointment_history WHERE appointment_id='{first}'").stdout.strip())==2
sql(insert('14:00',None));assert sql(insert('14:30','15:00'),ok=False).returncode!=0
for status in ['completed','no_show','cancelled']:sql(insert('10:00','11:00',status=status))
def race(delay):
 return sql('BEGIN;'+insert('16:00','17:00',user=u3)+f'SELECT pg_sleep({delay}); COMMIT;',ok=False)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 a=pool.submit(race,0.7);time.sleep(.15);b=pool.submit(race,0);results=[a.result(),b.result()]
assert sorted(r.returncode==0 for r in results)==[False,True]
assert int(sql(f"SELECT count(*) FROM organization_appointments WHERE assigned_to='{u3}'").stdout.strip())==1
assert sql("SET ROLE authenticated; SELECT * FROM organization_appointment_tracking;",ok=False).returncode!=0
assert sql("SET ROLE anon; SELECT * FROM organization_appointment_history;",ok=False).returncode!=0
r=file('supabase/agenda_acompanhamento_conflitos.sql','agenda_verify');assert not r.returncode,r.stderr
setup('agenda_legacy')
legacy=insert('10:00','11:00').replace(',buffer_minutes', '').replace(",'scheduled',0)",",'scheduled')")
sql(legacy,db='agenda_legacy');sql(legacy,db='agenda_legacy')
r=file('supabase/agenda_acompanhamento_conflitos.sql','agenda_legacy');assert r.returncode!=0 and 'AGENDA_EXISTING_CONFLICTS' in r.stderr
assert sql("SELECT count(*) FROM information_schema.columns WHERE table_name='organization_appointments' AND column_name='buffer_minutes';",db='agenda_legacy').stdout.strip()=='0'
print(json.dumps({'passed':True,'checks':['overlap','buffer','adjacent','different_assignee','cross_organization_assignee','reschedule_conflict','cancel_releases','history_revision','legacy_null_end','terminal_status','two_connections_race','private_tables','repeat_migration','legacy_conflict_rollback']}))
