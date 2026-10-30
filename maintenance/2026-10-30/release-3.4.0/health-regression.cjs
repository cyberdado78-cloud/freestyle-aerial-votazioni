'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{once}=require('node:events');
const source=fs.readFileSync(process.argv[2],'utf8').replace('const port = Number(process.env.PORT) || 3000;','const port = 0;');
(async()=>{
 const cases=[
  {name:'disabled service',db:true,env:{},ready:false},
  {name:'missing provider key',db:true,env:{SCOREFLOW_MANAGED_EMAIL_ENABLED:'true',SCOREFLOW_EMAIL_FROM:'sender@example.invalid'},ready:false},
  {name:'missing sender',db:true,env:{SCOREFLOW_MANAGED_EMAIL_ENABLED:'true',RESEND_API_KEY:'re_TEST_ONLY'},ready:false},
  {name:'configured service',db:true,env:{SCOREFLOW_MANAGED_EMAIL_ENABLED:'true',RESEND_API_KEY:'re_TEST_ONLY',SCOREFLOW_EMAIL_FROM:'sender@example.invalid'},ready:true},
  {name:'database absent',db:false,env:{SCOREFLOW_MANAGED_EMAIL_ENABLED:'true',RESEND_API_KEY:'re_TEST_ONLY',SCOREFLOW_EMAIL_FROM:'sender@example.invalid'},ready:false}
 ];
 for(const test of cases){
  const db={databaseConfigured:test.db,getSupabase:()=>({from:()=>({select:()=>({limit:async()=>({error:null})})})})};
  const context={require:n=>n==='./db'?db:require(n),__dirname:'/test',Buffer,URL,Date,Set,AbortSignal,console:{log(){},error(){}},process:{env:test.env}};
  vm.createContext(context);vm.runInContext(source+'\nthis.httpServer=server;',context);
  const server=context.httpServer;
  try{
   if(!server.listening)await once(server,'listening');
   for(const route of ['/health','/api/status']){
    const result=await fetch('http://127.0.0.1:'+server.address().port+route);const body=await result.text();const data=JSON.parse(body);
    assert.equal(data.email,test.ready);assert.equal(data.version,'3.4.0');assert.ok(!body.includes('re_TEST_ONLY'));assert.ok(!body.includes('sender@example.invalid'));
    console.log('PASS '+test.name+' '+route);
   }
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

