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
vm.runInContext(source+'\nthis.api={server,resolvePublicFile,deliverNotification};',context);
let origin;
async function api(method,path,body,cookie='',headers={}) {
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json(),cookies:response.headers.getSetCookie()};
}
const cookie='sf_access=qa-access-token; sf_refresh=qa-refresh-token';
const owner=()=>tables.get('scoreflow_organization_accounts')[0];
const cases=[
 ['signup accepts an eight-character password and rejects seven characters',async()=>{const before=providerCalls.length;assert.equal((await api('POST','/api/account/signup',{email:'eight@example.invalid',password:'qa-pass8'})).status,200);assert.equal((await api('POST','/api/account/signup',{email:'seven@example.invalid',password:'1234567'})).status,400);assert.equal(providerCalls.length,before+1);providerCalls.length=0;authCalls.length=0;}],
 ['reset accepts eight characters and rejects seven before consuming a recovery token',async()=>{const before=authCalls.length;assert.equal((await api('POST','/api/account/reset',{token:'a'.repeat(64),password:'1234567'})).status,400);assert.equal(authCalls.length,before);assert.equal((await api('POST','/api/account/reset',{token:'a'.repeat(64),password:'qa-pass8'})).status,200);authCalls.length=0;}],

 ['signup rejects passwords shorter than eight characters before generating any link',async()=>{const r=await api('POST','/api/account/signup',{email:user.email,password:'short'});assert.equal(r.status,400);assert.equal(authCalls.length,0);}],
 ['signup sends confirmation through managed provider without exposing token',async()=>{const r=await api('POST','/api/account/signup',{email:user.email,password:'valid-qa-password'});assert.equal(r.status,200);assert.ok(!JSON.stringify(r).includes('a'.repeat(64)));assert.equal(providerCalls.length,1);const mail=JSON.parse(providerCalls[0].options.body);assert.ok(mail.text.includes('/#account=signup&token='));assert.ok(mail.html.includes('<a href='));assert.equal(r.cookies.length,0);}],
 ['wrong login and unconfirmed user cannot establish a session',async()=>{assert.equal((await api('POST','/api/account/login',{email:user.email,password:'wrong'})).status,401);const previous=user.email_confirmed_at;user.email_confirmed_at=null;assert.equal((await api('POST','/api/account/login',{email:user.email,password:'valid-qa-password'})).status,401);user.email_confirmed_at=previous;}],
 ['login sets protected cookies without returning auth tokens in JSON',async()=>{const r=await api('POST','/api/account/login',{email:user.email,password:'valid-qa-password'});assert.equal(r.status,200);assert.equal(r.cookies.length,2);for(const c of r.cookies){assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Lax/);assert.match(c,/Secure/);}assert.ok(!JSON.stringify(r.body).includes(session.access_token));}],
 ['cross-site login and writes are rejected',async()=>{assert.equal((await api('POST','/api/account/login',{email:user.email,password:'valid-qa-password'},'',{Origin:'https://attacker.invalid'})).status,403);assert.equal((await api('POST','/api/tenants',{},cookie,{'Sec-Fetch-Site':'cross-site'})).status,403);}],
 ['confirmation only accepts valid one-time hash',async()=>{assert.equal((await api('POST','/api/account/verify',{token:'bad'})).status,400);const r=await api('POST','/api/account/verify',{token:'a'.repeat(64)});assert.equal(r.status,200);assert.equal(r.cookies.length,2);}],
 ['recovery response does not disclose unknown account',async()=>{const known=await api('POST','/api/account/recover',{email:user.email});const unknown=await api('POST','/api/account/recover',{email:'missing@example.invalid'});assert.equal(known.status,unknown.status);assert.deepEqual(known.body,unknown.body);}],
 ['password reset verifies recovery hash, updates password and revokes other sessions',async()=>{const r=await api('POST','/api/account/reset',{token:'a'.repeat(64),password:'replacement-qa-password'});assert.equal(r.status,200);assert.ok(authCalls.some(x=>x[0]==='verify'&&x[1].type==='recovery'));assert.ok(authCalls.some(x=>x[0]==='update'));assert.ok(authCalls.some(x=>x[0]==='signOut'&&x[1].scope==='others'));}],
 ['session returns no account while signed out and refreshes expired access',async()=>{assert.equal((await api('GET','/api/account/session')).body.user,null);const r=await api('GET','/api/account/session',null,'sf_refresh=qa-refresh-token');assert.equal(r.status,200);assert.equal(r.body.user.email,user.email);assert.equal(r.cookies.length,2);}],
 ['new organization requires an account rather than a local key',async()=>{const r=await api('POST','/api/tenants',{tenantKey:'qa-new',secret:'b'.repeat(48),state:{events:[]}});assert.equal(r.status,401);}],
 ['owner can restore organization; local key cannot open account-owned data',async()=>{
 tables.set('scoreflow_tenants',[{tenant_key:'qa-owner',secret_hash:'not-a-browser-key',revision:1,state_json:{id:'qa',events:[{id:'event-qa'}]}}]);
 tables.set('scoreflow_organization_accounts',[{tenant_key:'qa-owner',owner_id:user.id,trial_started_at:new Date().toISOString(),trial_ends_at:new Date(Date.now()+86400000).toISOString(),email_attempts:0}]);
 const r=await api('GET','/api/account/session',null,cookie);assert.equal(r.body.organization.tenantKey,'qa-owner');assert.equal(r.body.organization.entitlements.limits.athletes,6);assert.ok(!JSON.stringify(r).includes('not-a-browser-key'));
 assert.equal((await api('GET','/api/tenants/qa-owner/state',null,'',{'X-ScoreFlow-Key':'b'.repeat(48)})).status,401);
 assert.equal((await api('GET','/api/tenants/qa-owner/state',null,cookie)).status,200);
 }],
 ['another organizer cannot read or change owner data',async()=>{const id=user.id;user.id='other-organizer';assert.equal((await api('GET','/api/tenants/qa-owner/state',null,cookie)).status,401);user.id=id;}],
 ['expired trial permits reads but blocks updates and test sends',async()=>{owner().trial_ends_at=new Date(Date.now()-10000).toISOString();assert.equal((await api('GET','/api/tenants/qa-owner/state',null,cookie)).status,200);assert.equal((await api('PUT','/api/tenants/qa-owner/state',{state:{},revision:1},cookie)).status,403);assert.equal((await api('POST','/api/tenants/qa-owner/email-settings/test',{to:'qa@example.invalid'},cookie)).status,403);}],
 ['expired owner can still request a signed download link',async()=>{objects.set('scoreflow-files/qa-owner/file.pdf',Buffer.from('qa'));const r=await api('POST','/api/tenants/qa-owner/files/sign',{path:'qa-owner/file.pdf'},cookie);assert.equal(r.status,200);}],
 ['trial quota caps concurrent delivery attempts before provider calls',async()=>{owner().trial_ends_at=new Date(Date.now()+86400000).toISOString();const before=providerCalls.length;const result=await Promise.all(Array.from({length:15},(_,i)=>context.api.deliverNotification('qa@example.invalid',{id:'quota-'+i,subject:'QA',message:'QA'},{},{trial:true,tenantKey:'qa-owner',apiKey:'re_MOCK_ONLY',from:'sender@example.invalid'})));assert.equal(result.filter(x=>x.deliveryStatus==='sent').length,10);assert.equal(providerCalls.length-before,10);}],
 ['server files and encoded traversal cannot be downloaded',async()=>{for(const path of ['/server.js','/db.js','/package.json','/trial-schema.sql','/assets/../server.js','/assets/%2e%2e/server.js'])assert.equal(context.api.resolvePublicFile(path),null);assert.ok(context.api.resolvePublicFile('/app.js'));}],
 ['logout clears both session cookies',async()=>{const r=await api('POST','/api/account/logout',{},cookie);assert.equal(r.status,200);assert.ok(r.cookies.every(x=>x.includes('Max-Age=0')));}],
 ['repeated login attempts are rate limited',async()=>{for(let i=0;i<7;i++)await api('POST','/api/account/login',{email:'rate@example.invalid',password:'wrong'});assert.equal((await api('POST','/api/account/login',{email:'rate@example.invalid',password:'wrong'})).status,429);}]
];
(async()=>{const server=context.api.server;try{if(!server.listening)await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;let failed=0;for(const[name,run]of cases){try{await run();console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.stack);}}console.log(JSON.stringify({passed:cases.length-failed,failed}));process.exitCode=failed?1:0;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

