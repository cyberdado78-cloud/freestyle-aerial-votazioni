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
 update(value){this.mode='update';this.value=value;return this;}
 delete(){this.mode='delete';return this;}
 async single(){const result=await this.run();return {...result,data:result.data?.[0]||null};}
 async maybeSingle(){return this.single();}
 then(resolve,reject){return this.run().then(resolve,reject);}
 async run(){
  let rows=tables.get(this.table)||[];tables.set(this.table,rows);
  let selected=rows.filter(row=>this.filters.every(match=>match(row)));
  if(this.mode==='insert'){
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
const context={require:name=>name==='./db'?{databaseConfigured:true,getSupabase:()=>supabase}:require(name),__dirname:require('node:path').dirname(require('node:path').resolve(process.argv[2])),Buffer,URL,Date,Set,console,process:{env:{}},fetch:()=>{throw Error('Email/external network forbidden in isolated backend');}};
vm.createContext(context);
const source=fs.readFileSync(process.argv[2],'utf8').replace('const port = Number(process.env.PORT) || 3000;','const port = 0;');
vm.runInContext(source+'\nthis.testServer=server;',context);
context.testServer.on('listening',()=>{fs.writeFileSync('/tmp/scoreflow-local-qa-port',String(context.testServer.address().port));console.log('Local isolated backend ready');});
