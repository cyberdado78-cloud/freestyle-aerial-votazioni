'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const tables=new Map(),objects=new Map();
const clone=x=>JSON.parse(JSON.stringify(x));
class Query {
 constructor(table){this.table=table;this.filters=[];this.mode='select';}
 select(fields='*'){this.fields=fields;return this;}
 eq(field,value){this.filters.push(row=>row[field]===value);return this;}
 gt(field,value){this.filters.push(row=>row[field]>value);return this;}
 order(field,{ascending=true}={}){this.sort={field,ascending};return this;}
 limit(n){this.maximum=n;return this;}
 insert(rows){this.mode='insert';this.values=Array.isArray(rows)?rows:[rows];return this;}
 upsert(value){this.mode='upsert';this.value=value;return this;}
 or(expression){const cutoff=expression.split('last_test_at.lt.')[1];this.filters.push(row=>!row.last_test_at||row.last_test_at<cutoff);return this;}
 update(value){this.mode='update';this.value=value;return this;}
 delete(){this.mode='delete';return this;}
 async single(){const result=await this.run();return {...result,data:result.data?.[0]||null};}
 async maybeSingle(){return this.single();}
 then(resolve,reject){return this.run().then(resolve,reject);}
 async run(){
  let rows=tables.get(this.table)||[];tables.set(this.table,rows);
  let selected=rows.filter(row=>this.filters.every(match=>match(row)));
  if(this.mode==='upsert'){
   let existing=rows.find(row=>row.tenant_key===this.value.tenant_key);
   if(existing)Object.assign(existing,clone(this.value));else{existing=clone(this.value);rows.push(existing);}
   selected=[existing];
  }else if(this.mode==='insert'){
   if(this.table==='scoreflow_athlete_accounts'&&this.values.some(v=>rows.some(r=>r.tenant_key===v.tenant_key&&r.email===v.email)))return{data:null,error:{code:'23505'}};
   selected=this.values.map(value=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),...clone(value)}));rows.push(...selected);
  }else if(this.mode==='update')selected.forEach(row=>Object.assign(row,clone(this.value)));
  else if(this.mode==='delete')tables.set(this.table,rows.filter(row=>!selected.includes(row)));
  if(this.sort)selected.sort((a,b)=>String(a[this.sort.field]).localeCompare(String(b[this.sort.field]))*(this.sort.ascending?1:-1));
  if(this.maximum)selected=selected.slice(0,this.maximum);
  const fields=this.fields?.split(',');
  return{data:selected.map(row=>fields&&this.fields!=='*'?Object.fromEntries(fields.map(k=>[k,row[k]])):clone(row)),error:null};
 }
}
const supabase={from:table=>new Query(table),storage:{from:bucket=>({
 upload:async(path,data)=>{objects.set(bucket+'/'+path,Buffer.from(data));return{data:{path},error:null};},
 createSignedUrl:async(path)=>objects.has(bucket+'/'+path)?{data:{signedUrl:'https://storage.example.invalid/test-only'},error:null}:{data:null,error:{message:'not found'}}
})}};
const assert=require('node:assert/strict');const {once}=require('node:events');
let user={id:'organizer-qa',email:'owner@example.invalid',email_confirmed_at:new Date().toISOString()}, authCalls=[], providerCalls=[], claims=0;
const session={access_token:'qa-access-token',refresh_token:'qa-refresh-token'};
supabase.auth={
 getUser:async token=>({data:{user:token==='qa-access-token'?user:null},error:token==='qa-access-token'?null:{}}),
 refreshSession:async({refresh_token})=>({data:refresh_token==='qa-refresh-token'?{session,user}:{},error:refresh_token==='qa-refresh-token'?null:{}}),
 signInWithPassword:async body=>{authCalls.push(['login',body]);return body.password==='valid-qa-password'?{data:{session,user},error:null}:{data:{},error:{}};},
 verifyOtp:async body=>{authCalls.push(['verify',body]);return body.token_hash==='a'.repeat(64)?{data:{session,user},error:null}:{data:{},error:{}};},
 updateUser:async body=>{authCalls.push(['update',body]);return{data:{user},error:null};},
 signOut:async body=>{authCalls.push(['signOut',body]);return{error:null};},
 admin:{generateLink:async body=>{authCalls.push(['link',body]);return body.email==='missing@example.invalid'?{data:{},error:{}}:{data:{properties:{hashed_token:'a'.repeat(64)}},error:null};},signOut:async()=>({error:null})}
};
supabase.rpc=async(name,body)=>{authCalls.push(['rpc',name,body]);if(name==='scoreflow_claim_trial_email')return{data:++claims<=10,error:null};return{data:{tenantKey:body.p_tenant,revision:1},error:null};};
const context={require:name=>name==='./db'?{databaseConfigured:true,getSupabase:()=>supabase}:require(name),__dirname:'/qa',Buffer,URL,Date,Set,AbortSignal,console:{log(){},error(){}},process:{env:{SCOREFLOW_APP_ORIGIN:'https://scoreflow.dynamiczen.it',SCOREFLOW_MANAGED_EMAIL_ENABLED:'true',RESEND_API_KEY:'re_MOCK_ONLY',SCOREFLOW_EMAIL_FROM:'ScoreFlow <sender@example.invalid>'}},fetch:async(url,options)=>{providerCalls.push({url,options});return{ok:true,status:200,json:async()=>({id:'provider-mock'})};}};
vm.createContext(context);
const source=fs.readFileSync(process.argv[2],'utf8').replace('const port = Number(process.env.PORT) || 3000;','const port = 0;');
vm.runInContext(source+'\nthis.api={server,resolvePublicFile,deliverNotification,passwordHash,athleteRecoveryToken,newAthleteSessionToken,athleteSession,hashSecret};',context);
let origin;
async function api(method,path,body,cookie='',headers={}) {
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json(),cookies:response.headers.getSetCookie()};
}
const cookie='sf_access=qa-access-token; sf_refresh=qa-refresh-token';
const owner=()=>tables.get('scoreflow_organization_accounts')[0];

const {JSDOM}=require('jsdom');
const Rules=require('./scripts/competition-rules');
const checks=[];const windows=[];
function check(name,fn){try{fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',detail:e.message});}}
const judges=[1,2,3].map(i=>({id:'j'+i,name:'TEST Judge '+i,code:String(i).repeat(4),active:true,language:'it'}));
const participants=[1,2,3,4,5,6].map(i=>({id:'p'+i,name:'TEST Athlete '+i,categoryId:'open',discipline:'Tessuti',round:'qualification',attempt:1,status:i===6?'competing':'completed',order:i}));
function score(i,j,value){return{id:'s-'+i+'-'+j,participantId:'p'+i,judgeId:'j'+j,round:'qualification',attempt:1,values:Object.fromEntries(Array.from({length:6},(_,k)=>['fac-'+k,value])),penalty:0,note:'',submittedAt:'2026-11-10T12:00:00Z',locked:true};}
const historic=[1,2,3,4,5].flatMap(i=>[1,2,3].map(j=>score(i,j,6)));
const fixture={id:'test-org',name:'TEST isolated simulation',slug:'qa-multi',cloud:{tenantKey:'qa-multi'},updatedAt:'2026-11-10T11:00:00Z',events:[{id:'test-event',name:'TEST synthetic copy',competitionRules:Rules.preset(),scoring:{criteria:Rules.criteria(),aggregation:'average',minimumJudges:3,judgeCount:3,penalties:{enabled:true,noteRequired:true}},categories:[{id:'open',name:'Open'}],disciplines:['Tessuti'],participants,judges,scores:clone(historic),control:{currentParticipantId:'p6',status:'running',mode:'automatic',round:'qualification',repeatQueue:[]},rules:{reviewRequired:false},rounds:{enabled:false}}]};
const tokens=[1,2,3,4].map(i=>('test-token-'+i+'-').repeat(4));
function browserClient(i,state=fixture){
 const d=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://127.0.0.1/',runScripts:'outside-only'}),w=d.window;
 const connectivity={offline:false};w.scrollTo=()=>{};w.confirm=()=>true;w.fetch=(url,options)=>connectivity.offline?Promise.reject(new Error('TEST disconnected')):fetch(origin+url,options);w.console.warn=()=>{};
 w.eval(fs.readFileSync('scripts/competition-rules.js','utf8'));
 const script=fs.readFileSync('app.js','utf8').replace('  initializeApplication();','  window.multiQA={pushCloudState,mergeCloudOrganization,voteProgress,participantResult,archiveAndRepeat,ensureEventData,set(o){platform.organizations=[o];},get(){return platform.organizations[0];}};');
 w.eval(script);const o=clone(state);o.cloud={tenantKey:'qa-multi',revision:1,accessToken:tokens[i],role:i===3?'control':'judge'};w.multiQA.set(o);w.multiQA.ensureEventData(o.events[0]);w.multiQA.disconnect=()=>{connectivity.offline=true;};w.multiQA.reconnect=()=>{connectivity.offline=false;};windows.push(d);return w.multiQA;
}
(async()=>{
 try{
  if(!context.api.server.listening)await once(context.api.server,'listening');
  origin='http://127.0.0.1:'+context.api.server.address().port;
  tables.set('scoreflow_tenants',[{tenant_key:'qa-multi',revision:1,state_json:clone(fixture),updated_at:fixture.updatedAt}]);
  tables.set('scoreflow_access_tokens',tokens.map((token,i)=>({id:'access-'+i,tenant_key:'qa-multi',event_id:'test-event',role:i===3?'control':'judge',token_hash:context.api.hashSecret(token),active:true})));
  const clients=[0,1,2].map(i=>browserClient(i));
  for (let i=0;i<3;i++) {
   const auth=await api('POST','/api/tenants/qa-multi/judge-auth',{code:judges[i].code},'',{'X-ScoreFlow-Access':tokens[i]});
   assert.equal(auth.status,200,JSON.stringify(auth.body));clients[i].get().cloud.judgeTicket=auth.body.ticket;
  }
  clients.forEach((c,i)=>c.get().events[0].scores.push(score(6,i+1,6+i)));
  const control=browserClient(3);
  check('regia blocks advancement before three votes',()=>assert.equal(control.voteProgress(control.get().events[0],participants[5]).complete,false));
  await Promise.all(clients.map(c=>c.pushCloudState(c.get())));
  let row=tables.get('scoreflow_tenants')[0];
  check('simultaneous clients persist all three votes without manual retry',()=>assert.equal(row.state_json.events[0].scores.filter(s=>s.participantId==='p6').length,3));
  check('five completed performances and 15 synthetic baseline votes preserved',()=>assert.deepEqual(row.state_json.events[0].scores.filter(s=>s.participantId!=='p6'),historic));
  // A disconnected client keeps its pending state; reconnecting retries without duplicating votes.
  const revisionBeforeOffline=row.revision;
  clients[2].disconnect();await clients[2].pushCloudState(clients[2].get());
  check('disconnect preserves pending vote locally without a database write',()=>{assert.equal(clients[2].get().cloud.status,'offline');assert.equal(tables.get('scoreflow_tenants')[0].revision,revisionBeforeOffline);assert.equal(clients[2].get().events[0].scores.filter(s=>s.judgeId==='j3'&&s.participantId==='p6').length,1);});
  clients[2].reconnect();
  for(const c of clients)if(c.get().cloud.status==='offline')await c.pushCloudState(c.get());
  row=tables.get('scoreflow_tenants')[0];
  let controlState=clone(row.state_json);controlState.cloud={tenantKey:'qa-multi',revision:row.revision,accessToken:tokens[3],role:'control'};control.set(controlState);
  check('reconnection recovers all three votes',()=>assert.equal(controlState.events[0].scores.length,18));
  const event=controlState.events[0];
  check('regia unblocks after all active judges vote',()=>assert.equal(control.voteProgress(event,event.participants[5]).complete,true));
  check('final score uses mean of three judge totals',()=>assert.equal(control.participantResult(event,'p6').total,42));
  check('ranking places the TEST performance above the five completed fixtures',()=>{const sorted=event.participants.map(p=>({id:p.id,total:control.participantResult(event,p.id).total})).sort((a,b)=>b.total-a.total);assert.equal(sorted[0].id,'p6');assert.equal(sorted.length,6);});
  const twoVotes=clone(event);twoVotes.scores=twoVotes.scores.filter(s=>!(s.participantId==='p6'&&s.judgeId==='j3'));
  check('advancement remains blocked when only two judges have voted',()=>assert.equal(control.voteProgress(twoVotes,twoVotes.participants[5]).complete,false));
  const duplicate=clone(controlState);duplicate.events[0].scores.push({...score(6,1,6),id:'duplicate-resend'});
  const merged=control.mergeCloudOrganization(duplicate,controlState);
  check('duplicate resend merges into one vote for judge round and attempt',()=>assert.equal(merged.events[0].scores.length,18));
  control.archiveAndRepeat(event,event.participants[5],'open');
  check('repeat archives only the new TEST performance',()=>{assert.equal(event.scores.length,15);assert.equal(event.scoreHistory.length,3);assert.equal(event.participants[5].attempt,2);assert.deepEqual(event.scores,historic);});
  const summary={scope:'LOCAL ONLY: 3 independent JSDOM clients and real Node HTTP handlers; in-memory Supabase substitute; all data synthetic; no remote database accessed',checks,passed:checks.filter(x=>x.status==='PASS').length,failed:checks.filter(x=>x.status==='FAIL').length};
  if(process.env.SCOREFLOW_QA_REPORT)fs.writeFileSync(process.env.SCOREFLOW_QA_REPORT,JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
 }finally{windows.forEach(d=>d.window.close());context.api.server.closeAllConnections();await new Promise(r=>context.api.server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

