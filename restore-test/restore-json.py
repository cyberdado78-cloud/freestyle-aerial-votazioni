"""Restore ScoreFlow JSON+ZIP backup in an isolated Supabase TEST instance.

Never accepts a remote endpoint. Does not contain production DDL or credentials.
Schema must already be provisioned privately by the operator.
"""
import json, pathlib, subprocess, urllib.request, urllib.parse, zipfile, hashlib, io

APPLICATION = ['scoreflow_tenants','scoreflow_organization_accounts','scoreflow_athlete_accounts','scoreflow_athlete_sessions','scoreflow_access_tokens','scoreflow_email_settings','scoreflow_license_codes','scoreflow_trial_email_claims']
ORDER = ['auth.users','auth.identities','auth.sessions','auth.refresh_tokens'] + ['public.'+t for t in APPLICATION]
ALLOWED = set(ORDER+['storage.buckets','storage.objects'])

def restore(backup, archive, manifest, env, sql):
    if env['API_URL'] not in ('http://127.0.0.1:54321','http://localhost:54321'):
        raise ValueError('Only isolated loopback Supabase is permitted')
    if backup.get('project') != 'TEST-isolated-restore':
        raise ValueError('This drill accepts only explicitly synthetic TEST backups')
    if set(backup['tables']) != ALLOWED:
        raise ValueError('Unexpected backup table set')
    for table in ORDER:
        if int(sql(f'SELECT count(*) FROM {table};').strip()) != 0:
            raise ValueError('Refuse to overwrite an existing target: '+table)
    # Validate every archive path and digest BEFORE importing database rows.
    expected={o['name'] for o in backup['tables']['storage.objects']}
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        actual=set(z.namelist())
        if expected != actual or len(actual)!=len(z.infolist()):
            raise ValueError('Attachment inventory mismatch')
        for name in actual:
            if pathlib.PurePosixPath(name).is_absolute() or '..' in pathlib.PurePosixPath(name).parts:
                raise ValueError('Unsafe attachment path')
            metadata=next(o for o in manifest if o['path']==name)
            data=z.read(name)
            if len(data)!=metadata['bytes'] or hashlib.sha256(data).hexdigest()!=metadata['sha256']:
                raise ValueError('Attachment hash mismatch')
    statements=['BEGIN;']
    for table in ORDER:
        text=json.dumps(backup['tables'][table],separators=(',',':'))
        # Hex encoding avoids SQL quoting/injection from JSON values.
        encoded=text.encode().hex()
        # Auth contains generated columns (for example confirmed_at): restore
        # source fields and let PostgreSQL regenerate computed values.
        columns=json.loads(sql(f"SELECT jsonb_agg(attname ORDER BY attnum)::text FROM pg_attribute WHERE attrelid='{table}'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='';"))
        selected=','.join('"'+column.replace('"','""')+'"' for column in columns)
        statements.append(f"INSERT INTO {table} ({selected}) OVERRIDING SYSTEM VALUE SELECT {selected} FROM jsonb_populate_recordset(NULL::{table},convert_from(decode('{encoded}','hex'),'UTF8')::jsonb);")
    statements.append("SELECT setval(pg_get_serial_sequence('auth.refresh_tokens','id'),coalesce((SELECT max(id) FROM auth.refresh_tokens),0)+1,false);")
    statements.append('COMMIT;')
    sql('\n'.join(statements))
    def request(path,method,body,ctype='application/json'):
        req=urllib.request.Request(env['API_URL']+path,data=body,method=method,headers={'apikey':env['SERVICE_ROLE_KEY'],'Authorization':'Bearer '+env['SERVICE_ROLE_KEY'],'Content-Type':ctype})
        with urllib.request.urlopen(req) as r:return r.read()
    for bucket in backup['tables']['storage.buckets']:
        config={k:bucket[k] for k in ['id','name','public','file_size_limit','allowed_mime_types'] if bucket.get(k) is not None}
        request('/storage/v1/bucket','POST',json.dumps(config).encode())
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        for obj in backup['tables']['storage.objects']:
            uri='/storage/v1/object/'+urllib.parse.quote(obj['bucket_id'],safe='')+'/'+urllib.parse.quote(obj['name'],safe='/')
            request(uri,'POST',z.read(obj['name']),obj.get('metadata',{}).get('mimetype','application/octet-stream'))
    return {'databaseTables':len(ORDER),'storageBuckets':len(backup['tables']['storage.buckets']),'attachments':len(expected),'storageObjectIdsRegenerated':True}

