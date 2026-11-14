'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const S=require('./scripts/shop-licenses'),L=require('./scripts/license-service');
const config={storeId:'store_QA',key:crypto.randomBytes(32),variants:{'variant-3':3,'variant-6':6,'variant-12':12}};
const order={id:'order',display_id:1,status:'pending',payment_status:'captured',total:9000,paid_total:9000,refunded_total:0,customer_email:'buyer@example.invalid',items:[{id:'line',variant_id:'variant-3',sku:'Anything',quantity:2,returned_quantity:0,total:9000}]};
assert.equal(S.configuration({}),null);
assert.equal(S.paidItems(order,config).length,2);
for(const patch of [{payment_status:'awaiting'},{payment_status:'authorized'},{paid_total:8999},{refunded_total:100},{status:'canceled'},{total:0},{customer_email:'invalid'}])assert.equal(S.paidItems({...order,...patch},config).length,0);
assert.equal(S.paidItems({...order,items:[{...order.items[0],variant_id:'unmapped',sku:'SCOREFLOW-12'}]},config).length,0);
assert.equal(S.paidItems({...order,items:[{...order.items[0],quantity:101}]},config).length,0);
const encrypted=S.encrypt('SF-TEST',config.key,'order');assert(!encrypted.includes('SF-TEST'));assert.equal(S.decrypt(encrypted,config.key,'order'),'SF-TEST');assert.throws(()=>S.decrypt(encrypted,config.key,'other'));assert.throws(()=>S.decrypt(encrypted,crypto.randomBytes(32),'order'));
const codes=Array.from({length:100},()=>L.createCode());assert.equal(new Set(codes).size,100);assert(codes.every(c=>/^SF-(?:[A-F0-9]{8}-){5}[A-F0-9]{8}$/.test(c)));assert.equal(L.hashCode(' sf-test '),L.hashCode('SF-TEST'));assert.deepEqual(L.MONTHS,[3,6,12]);
const ledger=new Map();let sent=0;
const db={rpc:async(name,body)=>{
 if(name==='scoreflow_issue_shop_license'){
  let row=ledger.get(body.p_order_key);if(!row){row={order_key:body.p_order_key,license_id:'license-'+ledger.size,buyer_email:body.p_email,code_cipher:body.p_cipher,duration_months:body.p_months};ledger.set(row.order_key,row);}return{data:{...row},error:null};
 }
 if(name==='scoreflow_claim_license_delivery'){const row=ledger.get(body.p_order_key);if(row.claimed||row.sent_at)return{data:null,error:null};row.claimed=true;return{data:{...row},error:null};}
 throw Error('unexpected rpc');
},from:()=>({update:value=>({eq:async(_,key)=>{Object.assign(ledger.get(key),value);return{error:null};}})})};
(async()=>{
 const w=S.worker({supabase:db,config,appOrigin:'https://scoreflow.example.invalid',deliver:async(email,n)=>{assert.equal(email,'buyer@example.invalid');assert(n.message.includes('SF-'));assert(!n.message.includes('?code='));sent++;return{deliveryStatus:'sent'};}});
 const item=S.paidItems(order,config)[0];await Promise.all([w.deliverItem(item),w.deliverItem(item)]);assert.equal(sent,1);assert.equal(ledger.size,1);await w.deliverItem(item);assert.equal(sent,1);
 let rpc=0;await assert.rejects(()=>L.redeem({rpc:()=>{rpc++;}},{code:'x',ownerId:'qa'}));assert.equal(rpc,0);
 console.log('PASS shop licensing: captured/full/unrefunded payment only, authoritative variant IDs, multiple units, encrypted delivery, context binding, duplicate suppression, high-entropy codes, safe URLs, fixed durations');
})().catch(e=>{console.error(e);process.exitCode=1;});
