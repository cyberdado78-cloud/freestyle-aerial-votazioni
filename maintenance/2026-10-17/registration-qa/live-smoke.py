"""Isolated live smoke test. Uses synthetic .invalid accounts; refuses configured email delivery."""
import base64, copy, datetime as dt, json, os, secrets, subprocess, sys, time
from pathlib import Path
import urllib.request, urllib.error

class requests:
 @staticmethod
 def request(method,url,**kwargs):
  data=kwargs.get('data');headers=dict(kwargs.get('headers') or {})
  if kwargs.get('json') is not None:
   data=json.dumps(kwargs['json']).encode();headers.setdefault('Content-Type','application/json')
  req=urllib.request.Request(url,data=data,headers=headers,method=method)
  try: response=urllib.request.urlopen(req,timeout=kwargs.get('timeout',20))
  except urllib.error.HTTPError as error: response=error
  class Result:
   status_code=response.code
   content=response.read()
   def json(self):return json.loads(self.content)
  return Result()
BASE=os.environ.get('SCOREFLOW_QA_ORIGIN','https://scoreflow.dynamiczen.it')
assert BASE.startswith('https://') or BASE.startswith('http://127.0.0.1:')
OUT=Path(os.environ.get('SCOREFLOW_QA_OUTPUT','/tmp/scoreflow-registration-qa'));OUT.mkdir(exist_ok=True,parents=True)
results=[]
def check(name,condition):
 results.append({'test':name,'passed':bool(condition)});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
def api(method,path,body=None,headers=None,data=None):
 r=requests.request(method,BASE+path,json=body if data is None else None,data=data,headers=headers,timeout=20)
 try: payload=r.json()
 except ValueError:payload={}
 return r.status_code,payload
status,health=api('GET','/health')
assert status==200 and health.get('email') is False,'Live reviews refused: email must be unconfigured to avoid external delivery.'
state=json.loads(Path(sys.argv[1]).read_text())
key='qa-registration-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')+'-'+secrets.token_hex(3)
secret=secrets.token_hex(32);password=secrets.token_urlsafe(24)
state.update(id='org-'+key,slug=key,name='COLLAUDO ISCRIZIONI — dati fittizi',cloud={'tenantKey':key})
event=state['events'][0];event['id']='event-'+key
now=dt.datetime.now(dt.timezone.utc)
iso=lambda d:d.isoformat().replace('+00:00','Z')
event['registration']={'enabled':True,'preRegistrationOpensAt':iso(now-dt.timedelta(hours=1)),'preRegistrationClosesAt':iso(now+dt.timedelta(hours=1)),'registrationClosesAt':iso(now+dt.timedelta(hours=2)),'instructions':'TEST TECNICO: dati e allegati fittizi.'}
headers={'X-ScoreFlow-Key':secret};regpath=f'/api/tenants/{key}/registrations'
creds={'tenantKey':key,'secret':secret,'password':password,'accounts':{}}
def checkpoint():
 p=OUT/'private-session.json';p.write_text(json.dumps(creds));p.chmod(0o600)
status,result=api('POST','/api/tenants',{'tenantKey':key,'name':state['name'],'secret':secret,'state':state});assert status==201
checkpoint();check('Create separate QA organization',status==201)
status,config=api('GET',f'/api/registration/config?tenant={key}');check('Public pre-registration window opens',status==200 and config.get('phase')=='pre-registration')
category=event['categories'][0]
def profile(label):return {'id':'qa-athlete-'+secrets.token_hex(5),'firstName':'TEST','lastName':label,'birthDate':'2000-01-01','phone':'0000000000','schoolName':'SCUOLA FITTIZIA','coachName':'COACH TEST','coachPhone':'0000000000','discipline':event['disciplines'][0],'categoryId':category['id'],'categoryName':category['name'],'privacyAccepted':True,'rulesAccepted':True}
email='individual-'+secrets.token_hex(4)+'@example.invalid'
status,_=api('POST','/api/athlete/enroll',{'tenantKey':key,'email':email,'password':password,'profile':{}});check('Incomplete application rejected',status==400)
status,individual=api('POST','/api/athlete/enroll',{'tenantKey':key,'email':email,'password':password,'profile':profile('INDIVIDUALE')});assert status==201
creds['accounts']['individual']={'email':email,**individual};checkpoint();check('Individual enrollment creates authenticated session',status==201 and bool(individual.get('token')))
status,_=api('POST','/api/athlete/enroll',{'tenantKey':key,'email':email,'password':password,'profile':profile('DUPLICATO')});check('Duplicate email rejected',status==409)
status,_=api('POST','/api/athlete/access',{'tenantKey':key,'email':email,'password':'incorrect-qa-password'});check('Incorrect password rejected',status==401)
status,login=api('POST','/api/athlete/access',{'tenantKey':key,'email':email,'password':password});check('Existing athlete can sign in again',status==200 and bool(login.get('token')))
auth={'Authorization':'Bearer '+individual['token']}
status,body=api('GET','/api/athlete/profile',headers=auth);check('Authenticated profile read',status==200 and body.get('account',{}).get('email')==email)
status,_=api('GET','/api/athlete/profile');check('Profile protected without session',status==401)
status,_=api('POST',regpath,{'registrationId':individual['account']['id'],'athleteId':individual['account']['profile']['id'],'action':'approve-roster'},headers=headers);check('Incomplete application cannot enter roster',status==409)
status,lists=api('GET',regpath+'?eventId='+event['id'],headers=headers);check('Application remains outside competition roster',status==200 and not event['participants'] and len(lists.get('registrations',[]))==1)
status,_=api('POST','/api/athlete/file?kind=music',headers={**auth,'Content-Type':'text/plain','X-File-Name':'invalid.txt'},data=b'TEST');check('Wrong attachment MIME rejected',status==415)
from reportlab.pdfgen import canvas
p=OUT/'documento-tecnico-test.pdf';c=canvas.Canvas(str(p));c.drawString(30,800,'TEST TECNICO - NON E UN CERTIFICATO MEDICO');c.save()
mp3=OUT/'silenzio-test.mp3';subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','2','-q:a','9',str(mp3)],check=True)
video=OUT/'video-test.mp4';subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=black:s=32x32:r=10','-t','1','-pix_fmt','yuv420p',str(video)],check=True)
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1cQAAAAASUVORK5CYII=')
# The API only accepts metadata for video duration; this test checks persistence of that metadata.
fixtures=[('photo','image/png','pixel-test.png',png,0),('medicalCertificate','application/pdf',p.name,p.read_bytes(),0),('music','audio/mpeg',mp3.name,mp3.read_bytes(),2),('entryVideo','video/mp4','video-test.mp4',video.read_bytes(),0)]
attachments={}
for kind,mime,name,data,duration in fixtures:
 status,body=api('POST','/api/athlete/file?kind='+kind,headers={**auth,'Content-Type':mime,'X-File-Name':name,'X-Media-Duration':str(duration)},data=data)
 check('Upload '+kind+' and associate with athlete',status==201 and bool(body.get('attachment',{}).get('cloudPath')))
 if status==201:attachments[kind]=body['attachment']
 else:print('BLOCKER '+kind+': '+str(body.get('error','unknown')),flush=True)
status,music=api('GET','/api/athlete/file?kind=music',headers=auth);check('Protected music download link issued',status==200 and bool(music.get('url')))
status,body=api('GET','/api/athlete/profile',headers=auth);check('Music duration retained in athlete profile',body.get('account',{}).get('profile',{}).get('performanceDuration')==2)
for action in ['approve-video','mark-paid','approve-roster']:
 status,body=api('POST',regpath,{'registrationId':individual['account']['id'],'athleteId':individual['account']['profile']['id'],'action':action},headers=headers)
 check('Regia '+action,status==200)
 if status==200: check('Communication '+action+' honestly remains pending',body.get('emailConfigured') is False and body['registration']['profile']['review']['notifications'][-1]['deliveryStatus']=='pending')
# A group with two athletes, each retaining school/coach details.
groupProfile={'accountType':'group','manager':{'name':'COACH TEST','schoolName':'GRUPPO FITTIZIO','phone':'0000000000','plannedAthletes':'5'},'athletes':[profile('GRUPPO UNO')]}
groupEmail='group-'+secrets.token_hex(4)+'@example.invalid'
status,group=api('POST','/api/athlete/enroll',{'tenantKey':key,'email':groupEmail,'password':password,'accountProfile':groupProfile});check('School/coach account created',status==201)
if status==201:
 creds['accounts']['group']={'email':groupEmail,**group};checkpoint();groupAuth={'Authorization':'Bearer '+group['token']}
 second=profile('GRUPPO DUE');second['schoolName']='SECONDA SCUOLA FITTIZIA';second['coachName']='SECONDO COACH TEST'
 status,body=api('PUT','/api/athlete/profile',{'action':'add','profile':second},headers=groupAuth);check('Group adds second athlete with separate school/coach',status==200 and len(body.get('account',{}).get('profile',{}).get('athletes',[]))==2)
 status,_=api('GET','/api/athlete/file?kind=photo&athleteId='+individual['account']['profile']['id'],headers=groupAuth);check('Other account cannot access individual athlete attachment',status==404)
# Server-owned fields must not be accepted from athlete submissions.
if os.environ.get('SCOREFLOW_QA_SECURITY') == '1':
 forged=profile('CAMPI NON ATTENDIBILI');forged['attachments']={'photo':{'cloudPath':'fake'},'medicalCertificate':{'cloudPath':'fake'},'music':{'cloudPath':'fake','durationSeconds':999}};forged['review']={'status':'roster-approved','videoStatus':'approved','paymentStatus':'received','rosterSyncedAt':iso(now),'notifications':[{'deliveryStatus':'sent'}]}
 forgedEmail='forged-'+secrets.token_hex(4)+'@example.invalid'
 status,body=api('POST','/api/athlete/enroll',{'tenantKey':key,'email':forgedEmail,'password':password,'profile':forged})
 fresh=body.get('account',{}).get('profile',{})
 check('Signup ignores athlete-supplied approvals and document references',status==201 and fresh.get('review',{}).get('videoStatus')=='pending' and fresh.get('review',{}).get('paymentStatus')=='pending' and not fresh.get('attachments') and not fresh.get('review',{}).get('notifications'))
 status,listed=api('GET',regpath+'?eventId='+event['id'],headers=headers)
 forgedEntries=[item for item in listed.get('registrations',[]) if item.get('email')==forgedEmail]
 check('Forged signup remains incomplete for regia',len(forgedEntries)==1 and not forgedEntries[0]['completeness']['complete'])
 if 'group' in creds['accounts']:
  status,body=api('PUT','/api/athlete/profile',{'action':'add','profile':forged},headers=groupAuth)
  fresh=body.get('account',{}).get('profile',{}).get('athletes',[{}])[-1]
  check('Group additions ignore athlete-supplied approvals and files',status==200 and fresh.get('review',{}).get('videoStatus')=='pending' and not fresh.get('attachments'))
 status,existing=api('GET','/api/athlete/profile',headers=auth)
 changed=existing['account']['profile'];changed['choreographyTitle']='AGGIORNAMENTO QA';changed['attachments']={};changed['review']={}
 status,body=api('PUT','/api/athlete/profile',{'profile':changed},headers=auth)
 kept=body.get('account',{}).get('profile',{})
 check('Profile edit preserves server-owned approvals, files and music duration',status==200 and kept.get('review',{}).get('status')=='roster-approved' and bool(kept.get('attachments',{}).get('music',{}).get('cloudPath')) and kept.get('performanceDuration')==2)

# Device synchronization: dedicated QA token, revision guard and role restrictions.
status,access=api('POST',f'/api/tenants/{key}/access',{'role':'staff','eventId':event['id'],'label':'QA isolated staff device'},headers=headers);check('Separate staff device access generated',status==201)
if status==201:
 creds['staffToken']=access['token'];checkpoint();deviceHeaders={'X-ScoreFlow-Access':access['token']}
 status,device=api('GET',f'/api/tenants/{key}/device-state',headers=deviceHeaders);check('Independent device sees same cloud event',status==200 and device.get('state',{}).get('events',[{}])[0].get('id')==event['id'])
 incoming=copy.deepcopy(device['state']);incoming['name']='UNAUTHORIZED QA CHANGE'
 status,_=api('PUT',f'/api/tenants/{key}/device-state',{'revision':device['revision'],'state':incoming},headers=deviceHeaders);check('Staff can synchronize allowed operational state',status==200)
 status,stateRead=api('GET',f'/api/tenants/{key}/state',headers=headers);check('Staff cannot alter organization identity',stateRead.get('state',{}).get('name')==state['name'])
 status,_=api('PUT',f'/api/tenants/{key}/device-state',{'revision':device['revision'],'state':incoming},headers=deviceHeaders);check('Stale device write rejected with revision conflict',status==409)
# Close QA public enrollment after use. Keep test records identifiable for inspection.
status,current=api('GET',f'/api/tenants/{key}/state',headers=headers)
current['state']['events'][0]['registration']['enabled']=False
status,_=api('PUT',f'/api/tenants/{key}/state',{'revision':current['revision'],'state':current['state']},headers=headers);check('QA enrollment closed after tests',status==200)
report={'origin':BASE,'tenantKey':key,'checkedAt':iso(dt.datetime.now(dt.timezone.utc)),'results':results,'passed':sum(t['passed'] for t in results),'failed':sum(not t['passed'] for t in results)}
(OUT/'results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps({'tenantKey':key,'passed':report['passed'],'failed':report['failed'],'report':str(OUT/'results.json')}),flush=True)
sys.exit(1 if report['failed'] else 0)
