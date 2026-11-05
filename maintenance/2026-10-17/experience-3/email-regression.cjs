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
const assert=require('node:assert/strict');
let mode='success',providerCalls=[];
const context={require:name=>name==='./db'?{databaseConfigured:true,getSupabase:()=>supabase}:require(name),__dirname:'/qa',Buffer,URL,Date,Set,AbortSignal,console:{log(){},error(){}},process:{env:{RESEND_API_KEY:'legacy-must-not-be-used',SCOREFLOW_EMAIL_FROM:'legacy@example.invalid'}},fetch:async(url,options)=>{
 providerCalls.push({url,options});
 if(mode==='network')throw Error('DO NOT LEAK SECRET');
 return {ok:mode==='success',status:mode==='rate'?429:403,json:async()=>mode==='success'?{id:'mock-provider-id'}:{message:'DO NOT LEAK SECRET'}};
}};
vm.createContext(context);
const source=fs.readFileSync(process.argv[2],'utf8').replace('const port = Number(process.env.PORT) || 3000;','const port = 0;');
vm.runInContext(source+'\nthis.api={server,encryptEmailKey,decryptEmailKey,emailTransport,organizationEmailTransport,deliverNotification};',context);
const secretA=crypto.randomBytes(32).toString('hex'),secretB=crypto.randomBytes(32).toString('hex');
tables.set('scoreflow_tenants',[{tenant_key:'qa-a',secret_hash:crypto.createHash('sha256').update(secretA).digest('hex')},{tenant_key:'qa-b',secret_hash:crypto.createHash('sha256').update(secretB).digest('hex')}]);
const settings=()=>tables.get('scoreflow_email_settings').find(r=>r.tenant_key==='qa-a');
let origin;
async function api(method,path,body,secret=secretA,extra={}){
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(secret?{'X-ScoreFlow-Key':secret}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};
}
const route='/api/tenants/qa-a/email-settings';
const config={mode:'custom',senderName:'Organizzazione QA',senderEmail:'sender@example.invalid',replyTo:'reply@example.invalid',apiKey:'re_QA_ONLY_NOT_A_REAL_KEY',enabled:false};
const cases=[
 ['unauthenticated access cannot read or save email settings',async()=>{assert.equal((await api('GET',route,null,'')).status,401);assert.equal((await api('PUT',route,config,'')).status,401);}],
 ['staff device token cannot configure email',async()=>assert.equal((await api('PUT',route,config,'',{'X-ScoreFlow-Access':'qa-staff-token-not-admin'})).status,401)],
 ['another organization cannot read or change settings',async()=>{assert.equal((await api('GET',route,null,secretB)).status,403);assert.equal((await api('PUT',route,config,secretB)).status,403);}],
 ['unconfigured organization returns disabled settings',async()=>{const r=await api('GET',route);assert.equal(r.status,200);assert.equal(r.body.settings.hasKey,false);assert.equal(r.body.settings.configured,false);}],
 ['cannot enable without sender and key',async()=>assert.equal((await api('PUT',route,{enabled:true})).status,400)],
 ['reject invalid sender, key, reply-to and header injection',async()=>{for(const change of [{senderEmail:'invalid'},{apiKey:'wrong'},{replyTo:'bad\n@example.invalid'},{senderName:'Name\r\nBcc: other@example.invalid'}])assert.equal((await api('PUT',route,{...config,...change})).status,400);}],
 ['save encrypted key and return metadata without secret',async()=>{const r=await api('PUT',route,config);assert.equal(r.status,200);assert.equal(r.body.settings.hasKey,true);assert.equal(r.body.settings.enabled,false);assert.ok(!JSON.stringify(r).includes(config.apiKey));assert.ok(!JSON.stringify(settings()).includes(config.apiKey));}],
 ['ciphertext uses random nonce and cannot cross tenants or be tampered',async()=>{const a=context.api.encryptEmailKey(config.apiKey,secretA,'qa-a'),b=context.api.encryptEmailKey(config.apiKey,secretA,'qa-a');assert.notEqual(a,b);assert.equal(context.api.decryptEmailKey(a,secretA,'qa-a'),config.apiKey);assert.throws(()=>context.api.decryptEmailKey(a,secretA,'qa-b'));assert.throws(()=>context.api.decryptEmailKey(a,secretB,'qa-a'));assert.throws(()=>context.api.decryptEmailKey(a.replace('v1.','v2.'),secretA,'qa-a'));}],
 ['blank key retains saved key while editing sender',async()=>{const before=settings().api_key_encrypted;const r=await api('PUT',route,{...config,apiKey:'',senderName:'QA Updated'});assert.equal(r.status,200);assert.equal(settings().api_key_encrypted,before);}],
 ['disabled organization does not use shared server credentials',async()=>{const n=await context.api.deliverNotification('qa@example.invalid',{id:'qa-n'},{});assert.equal(n.deliveryStatus,'pending');const t=context.api.emailTransport(settings(),{secret:secretA},'qa-a');assert.equal(t,null);assert.equal(providerCalls.length,0);}],
 ['test validates recipient before provider call',async()=>{assert.equal((await api('POST',route+'/test',{to:'invalid'})).status,400);assert.equal(providerCalls.length,0);}],
 ['test while disabled uses organization sender and key without leaking it',async()=>{const r=await api('POST',route+'/test',{to:'qa@example.invalid'});assert.equal(r.status,200);assert.equal(r.body.settings.lastTestStatus,'accepted');assert.equal(r.body.settings.enabled,false);assert.match(r.body.message,/non è ancora confermata/);const call=providerCalls.at(-1);assert.equal(call.options.headers.Authorization,'Bearer '+config.apiKey);assert.equal(call.url,'https://api.resend.com/emails');const body=JSON.parse(call.options.body);assert.equal(body.from,'QA Updated <sender@example.invalid>');assert.equal(body.reply_to,'reply@example.invalid');assert.deepEqual(body.to,['qa@example.invalid']);assert.ok(!JSON.stringify(r).includes(config.apiKey));}],
 ['test endpoint rate limits repeat requests',async()=>{const before=providerCalls.length;assert.equal((await api('POST',route+'/test',{to:'qa@example.invalid'})).status,429);assert.equal(providerCalls.length,before);}],
 ['provider failure has honest status and sanitized error',async()=>{settings().last_test_at=null;mode='failure';const r=await api('POST',route+'/test',{to:'qa@example.invalid'});assert.equal(r.status,422);assert.equal(r.body.settings.lastTestStatus,'failed');assert.ok(!JSON.stringify(r).includes('DO NOT LEAK'));}],
 ['network failure never exposes exception text',async()=>{settings().last_test_at=null;mode='network';const r=await api('POST',route+'/test',{to:'qa@example.invalid'});assert.equal(r.status,422);assert.ok(!JSON.stringify(r).includes('DO NOT LEAK'));mode='success';}],
 ['enable organization transport and preserve key across reads',async()=>{const r=await api('PUT',route,{...config,enabled:true,apiKey:''});assert.equal(r.body.settings.configured,true);const t=context.api.emailTransport(settings(),{secret:secretA},'qa-a');assert.equal(t.apiKey,config.apiKey);const read=await api('GET',route);assert.ok(!JSON.stringify(read).includes('api_key_encrypted'));assert.ok(!JSON.stringify(read).includes(config.apiKey));}],
 ['another organization has independent email settings',async()=>{const r=await api('GET','/api/tenants/qa-b/email-settings',null,secretB);assert.equal(r.body.settings.hasKey,false);assert.equal(r.body.settings.enabled,false);}],
 ['removing key requires disabling sending and actually removes it',async()=>{assert.equal((await api('PUT',route,{...config,apiKey:'',clearKey:true,enabled:true})).status,400);const r=await api('PUT',route,{...config,apiKey:'',clearKey:true,enabled:false});assert.equal(r.status,200);assert.equal(r.body.settings.hasKey,false);assert.equal(settings().api_key_encrypted,null);assert.equal((await api('POST',route+'/test',{to:'qa@example.invalid'})).status,409);}]
 ,['managed mode needs only organization name and contact address',async()=>{const r=await api('PUT',route,{mode:'managed',senderName:'Evento QA',replyTo:'contact@example.invalid',enabled:true});assert.equal(r.status,200);assert.equal(r.body.settings.mode,'managed');assert.equal(r.body.settings.hasKey,false);assert.equal(r.body.settings.configured,false);assert.equal(r.body.settings.managedReady,false);}],
 ['managed mode rejects incomplete contact details',async()=>assert.equal((await api('PUT',route,{mode:'managed',senderName:'',replyTo:'',enabled:true})).status,400)],
 ['unavailable central service cannot claim an email was sent',async()=>{const before=providerCalls.length;const r=await api('POST',route+'/test',{to:'qa@example.invalid'});assert.equal(r.status,409);assert.match(r.body.message,/in attivazione/);assert.equal(providerCalls.length,before);}],
 ['central delivery requires activated event license',async()=>{context.process.env.SCOREFLOW_MANAGED_EMAIL_ENABLED='true';context.process.env.RESEND_API_KEY='re_CENTRAL_QA_ONLY';context.process.env.SCOREFLOW_EMAIL_FROM='ScoreFlow <central@example.invalid>';let r=await api('GET',route);assert.equal(r.body.settings.managedReady,true);assert.equal(r.body.settings.configured,false);assert.equal((await api('POST',route+'/test',{to:'qa@example.invalid'})).status,409);}],
 ['licensed managed event uses central sender and client contact for replies',async()=>{tables.set('scoreflow_license_codes',[{id:'qa-license',tenant_key:'qa-a',active:true,expires_at:null}]);settings().last_test_at=null;mode='success';const r=await api('POST',route+'/test',{to:'qa@example.invalid'});assert.equal(r.status,200);const call=providerCalls.at(-1),body=JSON.parse(call.options.body);assert.equal(call.options.headers.Authorization,'Bearer re_CENTRAL_QA_ONLY');assert.equal(body.from,'"Evento QA · ScoreFlow" <central@example.invalid>');assert.equal(body.reply_to,'contact@example.invalid');assert.ok(!JSON.stringify(r).includes('re_CENTRAL'));assert.equal((await api('GET',route)).body.settings.configured,true);}],
 ['expired license stops central sending without deleting preferences',async()=>{tables.get('scoreflow_license_codes')[0].expires_at='2000-01-01T00:00:00Z';assert.equal(await context.api.organizationEmailTransport(settings(),{secret:secretA,supabase},'qa-a'),null);assert.equal((await api('GET',route)).body.settings.configured,false);assert.equal(settings().reply_to,'contact@example.invalid');}],
 ['custom mode never borrows central keys when missing its own key',async()=>{assert.equal(context.api.emailTransport({...settings(),delivery_mode:'custom',api_key_encrypted:null,sender_email:'own@example.invalid'},{secret:secretA},'qa-a'),null);}],
 ['managed mode cannot use an invalid central sender',async()=>{context.process.env.SCOREFLOW_EMAIL_FROM='not-an-email';assert.equal(context.api.emailTransport(settings(),{secret:secretA},'qa-a'),null);}],
 ['suspending managed sending retains contact and sends nothing',async()=>{const before=providerCalls.length;const r=await api('PUT',route,{mode:'managed',senderName:'Evento QA',replyTo:'contact@example.invalid',enabled:false});assert.equal(r.status,200);assert.equal(r.body.settings.enabled,false);assert.equal(providerCalls.length,before);}]

];
(async()=>{await new Promise(resolve=>context.api.server.on('listening',resolve));origin='http://127.0.0.1:'+context.api.server.address().port;let failed=0;for(const[name,run]of cases){try{await run();console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}await new Promise(resolve=>context.api.server.close(resolve));console.log(JSON.stringify({passed:cases.length-failed,failed}));process.exitCode=failed?1:0;})();
