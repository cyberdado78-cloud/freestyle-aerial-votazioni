"""Configuration-only smoke: isolated QA tenant, no email delivery or provider calls."""
import json,sys,urllib.request,urllib.error
from pathlib import Path
session=json.loads(Path(sys.argv[1]).read_text())
assert session['tenantKey'].startswith('qa-registration-')
origin='https://scoreflow.dynamiczen.it';route='/api/tenants/'+session['tenantKey']+'/email-settings'
results=[]
def request(method,path=route,body=None,secret=session['secret'],headers=None):
 h={'Content-Type':'application/json',**(headers or {})}
 if secret:h['X-ScoreFlow-Key']=secret
 req=urllib.request.Request(origin+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
 try:r=urllib.request.urlopen(req,timeout=35)
 except urllib.error.HTTPError as e:r=e
 return r.status,json.loads(r.read())
def check(name,ok):
 results.append({'test':name,'passed':bool(ok)});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
config={'mode':'custom','senderName':'COLLAUDO TECNICO','senderEmail':'sender@example.invalid','replyTo':'reply@example.invalid','apiKey':'re_QA_ONLY_NOT_A_REAL_KEY','enabled':False}
try:
 status,data=request('GET',secret='');check('Settings require organization administrator',status==401)
 status,data=request('GET',secret='wrong-organization-secret-qa-only');check('Another secret cannot read settings',status in (403,404))
 status,data=request('GET');check('Owner reads settings',status==200 and data['settings']['hasKey']==False)
 status,data=request('PUT',body=config);check('Owner saves disabled synthetic configuration',status==200 and data['settings']['hasKey'] and not data['settings']['configured'] and config['apiKey'] not in json.dumps(data))
 status,data=request('GET');check('Saved configuration persists without returning API key',status==200 and data['settings']['senderEmail']==config['senderEmail'] and data['settings']['hasKey'] and config['apiKey'] not in json.dumps(data))
 status,data=request('PUT',body={**config,'apiKey':'','enabled':True});check('Enable uses previously saved encrypted key',status==200 and data['settings']['configured'])
 status,data=request('GET',secret='',headers={'X-ScoreFlow-Access':session['staffToken']});check('Staff device cannot read email settings',status==401)
 status,data=request('PUT',body={**config,'apiKey':'','senderName':'QA MODIFICA','enabled':False});check('Blank key preserves credential when editing',status==200 and data['settings']['hasKey'] and not data['settings']['enabled'])
 status,data=request('PUT',body={'mode':'managed','senderName':'EVENTO QA','replyTo':'contact@example.invalid','enabled':True});check('Managed email saves name and contact without new provider credentials',status==200 and data['settings']['mode']=='managed' and data['settings']['replyTo']=='contact@example.invalid')
 status,data=request('GET');check('Managed preferences persist without claiming unavailable sending',status==200 and data['settings']['replyTo']=='contact@example.invalid' and (data['settings']['managedReady'] or not data['settings']['configured']))
 if not data['settings']['managedReady']:
  status,data=request('POST',path=route+'/test',body={'to':'qa@example.invalid'});check('Unavailable managed service reports pending activation without sending',status==409 and 'attivazione' in data.get('message',''))
 status,data=request('PUT',body={'mode':'managed','senderName':'EVENTO QA','replyTo':'not-an-email','enabled':True});check('Invalid managed contact rejected',status==400)

finally:
 status,data=request('PUT',body={'mode':'managed','senderName':'','senderEmail':'','replyTo':'','apiKey':'','clearKey':True,'enabled':False})
 check('QA key removed and sending disabled after tests',status==200 and not data['settings']['hasKey'] and not data['settings']['enabled'])
report={'origin':origin,'tenantKey':session['tenantKey'],'emailDeliveryAttempted':False,'results':results,'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results)}
Path(sys.argv[2]).write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'failed':report['failed']}),flush=True)
sys.exit(1 if report['failed'] else 0)
