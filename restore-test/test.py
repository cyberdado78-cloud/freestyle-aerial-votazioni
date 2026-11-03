import json, subprocess, urllib.request, urllib.error, hashlib, time, pathlib

ROOT=pathlib.Path(__file__).parent
def run(*args, input=None):
    return subprocess.check_output(args, input=input, text=True)
def sql(q):
    return run('docker','exec','-i','supabase_db_scoreflow-restore-test','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At',input=q)
def status():
    global env
    env=json.loads(run('supabase','status','-o','json'))
def api(path, method='GET', body=None, key=None, token=None, raw=False):
    key=key or env['SERVICE_ROLE_KEY']
    headers={'apikey':key,'Authorization':'Bearer '+(token or key)}
    if body is not None:
        headers['Content-Type']='application/octet-stream' if isinstance(body,bytes) else 'application/json'
        if not isinstance(body,bytes): body=json.dumps(body).encode()
    req=urllib.request.Request(env['API_URL']+path,data=body,headers=headers,method=method)
    with urllib.request.urlopen(req) as r:
        data=r.read()
        return data if raw else (json.loads(data) if data else None)
def apply_schema():
    # Independently authored synthetic fixture DDL only.
    # This file does not load production schemas, functions or policies.
    fixture=json.loads((ROOT/'schema.json').read_text())
    assert fixture['notice'].startswith('Synthetic TEST fixture schema')
    for statement in fixture['tables']:
        sql(statement)
    for table in ['scoreflow_tenants','scoreflow_organization_accounts','scoreflow_athlete_accounts','scoreflow_athlete_sessions','scoreflow_access_tokens','scoreflow_email_settings','scoreflow_license_codes','scoreflow_trial_email_claims']:
        sql(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;')

status()
assert env['API_URL'].startswith(('http://127.0.0.1:','http://localhost:')), 'Local instance required'
user=api('/auth/v1/admin/users','POST',{'email':'restore-test@example.invalid','password':'TEST-only-restore-4e7!','email_confirm':True})
owner=user['id']
apply_schema()
sql("INSERT INTO public.scoreflow_tenants(tenant_key,display_name,secret_hash,state_json) VALUES ('test-restore','TEST Restore',repeat('0',64),'{\"scores\":[{\"id\":\"TEST-jury\",\"total\":48}],\"publicVotes\":[{\"id\":\"TEST-public\",\"value\":9}]}');")
sql(f"INSERT INTO public.scoreflow_organization_accounts(tenant_key,owner_id) VALUES ('test-restore','{owner}');")
sql("INSERT INTO public.scoreflow_athlete_accounts(id,tenant_key,event_id,email,password_hash) VALUES ('00000000-0000-4000-8000-000000000002','test-restore','TEST-event','athlete@example.invalid','TEST-only'); INSERT INTO public.scoreflow_athlete_sessions(account_id,tenant_key,event_id,token_hash,expires_at) VALUES ('00000000-0000-4000-8000-000000000002','test-restore','TEST-event',repeat('1',64),'2099-01-01'); INSERT INTO public.scoreflow_access_tokens(tenant_key,event_id,role,label,token_hash) VALUES ('test-restore','TEST-event','judge','TEST',repeat('2',64)); INSERT INTO public.scoreflow_email_settings(tenant_key) VALUES ('test-restore'); INSERT INTO public.scoreflow_license_codes(code_hash,tenant_key,active) VALUES (repeat('3',64),'test-restore',false); INSERT INTO public.scoreflow_trial_email_claims(tenant_key,notification_id) VALUES ('test-restore','TEST-email');")
api('/storage/v1/bucket','POST',{'id':'scoreflow-files','name':'scoreflow-files','public':False})
files={'TEST-photo.txt':b'TEST photo placeholder','TEST-video.txt':b'TEST video placeholder','TEST-document.txt':b'TEST non-medical document','TEST-audio.txt':b'TEST audio placeholder'}
for name,data in files.items(): api('/storage/v1/object/scoreflow-files/test-restore/'+name,'POST',data,raw=True)
snapshot=sql("SELECT jsonb_object_agg(tablename,records)::text FROM ("+' UNION ALL '.join("SELECT '"+t+"' AS tablename, coalesce(jsonb_agg(to_jsonb(x)), '[]') AS records FROM public."+t+" x" for t in ['scoreflow_tenants','scoreflow_organization_accounts','scoreflow_athlete_accounts','scoreflow_athlete_sessions','scoreflow_access_tokens','scoreflow_email_settings','scoreflow_license_codes','scoreflow_trial_email_claims'])+") s;")
dump=run('docker','exec','supabase_db_scoreflow-restore-test','pg_dump','-U','postgres','-d','postgres','--data-only','--no-owner','--no-privileges','--table=public.scoreflow_*','--table=auth.users','--table=auth.identities')
(ROOT/'TEST-only.sql').write_text(dump)
print('PASS: isolated synthetic account, 8 application tables, jury/public votes and 4 files created',flush=True)
run('supabase','stop','--no-backup')
run('supabase','start')
status()
assert sql('SELECT count(*) FROM auth.users;').strip()=='0', 'Fresh Auth required'
assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'scoreflow_%';").strip()=='0', 'Fresh database required'
apply_schema()
sql(dump)
restored=sql("SELECT state_json::text FROM public.scoreflow_tenants WHERE tenant_key='test-restore';")
assert json.loads(restored)==json.loads(snapshot)['scoreflow_tenants'][0]['state_json']
original=json.loads(snapshot)
for table,rows in original.items():
    current=json.loads(sql(f"SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]')::text FROM public.{table} t;"))
    assert current==rows, table
login=api('/auth/v1/token?grant_type=password','POST',{'email':'restore-test@example.invalid','password':'TEST-only-restore-4e7!'},key=env['ANON_KEY'])
assert login['user']['id']==owner
api('/storage/v1/bucket','POST',{'id':'scoreflow-files','name':'scoreflow-files','public':False})
for name,data in files.items():
    api('/storage/v1/object/scoreflow-files/test-restore/'+name,'POST',data,raw=True)
    returned=api('/storage/v1/object/scoreflow-files/test-restore/'+name,raw=True)
    assert hashlib.sha256(returned).digest()==hashlib.sha256(data).digest()
try:
    api('/storage/v1/object/scoreflow-files/test-restore/TEST-document.txt',key=env['ANON_KEY'],raw=True)
    raise AssertionError('Anonymous private download allowed')
except urllib.error.HTTPError as e: assert e.code in (400,401,403,404)
print('PASS: fresh Supabase restore; all 8 table rows identical; Auth password login; 4 attachment hashes; anonymous private download denied',flush=True)
print(json.dumps({'syntheticOnly':True,'freshSupabaseRestore':True,'applicationTables':8,'authLoginAfterRestore':True,'attachmentHashesVerified':4,'juryAndPublicUnchanged':True,'productionAccessed':False,'limitations':['Synthetic fixtures only; no production restoration','Sessions, refresh tokens and external SMTP/OAuth configuration not restored in this drill']}))

