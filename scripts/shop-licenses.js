'use strict';
const crypto=require('node:crypto');
const Licenses=require('./license-service');
function configuration(env=process.env) {
  let variants;try{variants=JSON.parse(env.SCOREFLOW_SHOP_LICENSE_VARIANTS || '{}');}catch{return null;}
  if(!env.HOSTINGER_API_TOKEN || !/^store_[A-Za-z0-9]+$/.test(env.SCOREFLOW_SHOP_STORE_ID || '') || !/^[a-f0-9]{64}$/i.test(env.SCOREFLOW_LICENSE_DELIVERY_KEY || '') || !/^\d{4}-\d{2}-\d{2}$/.test(env.SCOREFLOW_SHOP_ORDERS_FROM || '') || !Object.keys(variants).length || Object.values(variants).some(v=>!Licenses.validMonths(v))) return null;
  return {token:env.HOSTINGER_API_TOKEN,storeId:env.SCOREFLOW_SHOP_STORE_ID,key:Buffer.from(env.SCOREFLOW_LICENSE_DELIVERY_KEY,'hex'),variants,from:env.SCOREFLOW_SHOP_ORDERS_FROM};
}
function encrypt(code,key,orderKey) {
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(orderKey));
  const data=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);
  return ['v1',iv.toString('hex'),cipher.getAuthTag().toString('hex'),data.toString('hex')].join('.');
}
function decrypt(value,key,orderKey) {
  const [version,iv,tag,data]=String(value).split('.');if(version!=='v1')throw Error('Invalid delivery envelope');
  const cipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'hex'));cipher.setAAD(Buffer.from(orderKey));cipher.setAuthTag(Buffer.from(tag,'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data,'hex')),cipher.final()]).toString('utf8');
}
function paidItems(order,config) {
  if(order?.payment_status!=='captured' || ['canceled','cancelled'].includes(order.status) || !Number.isInteger(order.total) || order.total<=0 || !Number.isInteger(order.paid_total) || order.paid_total<order.total || Number(order.refunded_total)!==0 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(order.customer_email || '') || !order.id || !Array.isArray(order.items)) return [];
  const items=[];
  for(const line of order.items) {
    const months=config.variants[line.variant_id];
    if(!Licenses.validMonths(months) || !line.id || !Number.isInteger(line.quantity) || line.quantity<1 || line.quantity>100 || Number(line.returned_quantity)!==0 || !Number.isInteger(line.total) || line.total<=0) continue;
    for(let unit=1;unit<=line.quantity;unit++)items.push({orderKey:`${config.storeId}:${order.id}:${line.id}:${unit}`,orderId:order.id,lineId:line.id,unit,months,email:order.customer_email.trim().toLowerCase(),displayId:order.display_id});
  }
  return items;
}
async function request(config,path,fetcher) {
  const response=await fetcher(`https://developers.hostinger.com/api/ecommerce/v1/stores/${encodeURIComponent(config.storeId)}/${path}`,{headers:{Authorization:`Bearer ${config.token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Hostinger order verification unavailable');
  return response.json();
}
function worker({supabase,config,deliver,fetcher=fetch,appOrigin}) {
  let busy=false,nextPage=1,queue=[];
  async function deliverItem(item) {
    const code=Licenses.createCode();
    const {data,error}=await supabase.rpc('scoreflow_issue_shop_license',{p_order_key:item.orderKey,p_months:item.months,p_hash:Licenses.hashCode(code),p_cipher:encrypt(code,config.key,item.orderKey),p_email:item.email,p_store:config.storeId,p_order:item.orderId,p_line:item.lineId,p_unit:item.unit});
    if(error || !data)throw Error('License issue unavailable');
    const claim=await supabase.rpc('scoreflow_claim_license_delivery',{p_order_key:item.orderKey});
    if(claim.error)throw Error('License delivery unavailable');
    if(!claim.data)return 'skipped';
    const row=claim.data,issuedCode=decrypt(row.code_cipher,config.key,item.orderKey);
    const link=new URL('/?inizia=1',appOrigin).toString();
    const result=await deliver(row.buyer_email,{id:`license-${row.license_id}`,subject:`ScoreFlow: la tua licenza di ${row.duration_months} mesi`,message:`Grazie per l’acquisto.\n\nCodice licenza: ${issuedCode}\n\nApri ${link}\nScegli “Attiva licenza”, inserisci il codice e accedi oppure crea l’account della tua organizzazione.\n\nLa durata parte dall’attivazione. Se rinnovi, conserverai i giorni residui. Gli aggiornamenti dell’app web sono inclusi durante la validità.\n\nConserva questa email. Il codice è personale e si attiva su un solo account.`},{organizationName:'ScoreFlow',language:'it'});
    const sent=result?.deliveryStatus==='sent';
    const saved=await supabase.from('scoreflow_license_deliveries').update(sent?{sent_at:new Date().toISOString(),claim_until:null,last_error:null}:{claim_until:new Date(Date.now()+60000).toISOString(),last_error:'email-delivery-failed'}).eq('order_key',item.orderKey);
    if(saved.error || !sent)throw Error('License delivery requires retry');
    return 'sent';
  }
  async function run() {
    if(busy)return {busy:true};busy=true;
    let sent=0,checked=0;
    try {
      // At most 21 Hostinger requests per run, with a cursor so older orders cannot starve.
      if(!queue.length) {
        const list=await request(config,`orders?payment_status[]=captured&q=ScoreFlow&created_at_from=${config.from}&page=${nextPage}`,fetcher);
        if(!Array.isArray(list.data))throw Error('Unexpected Hostinger order response');
        queue=list.data.map(row=>row.id).filter(Boolean);
        nextPage=list.meta?.last_page && nextPage<list.meta.last_page?nextPage+1:1;
      }
      const pending=queue.splice(0,20);let failed=0;
      for(const id of pending) {
        checked++;
        const detail=await request(config,`orders/${encodeURIComponent(id)}`,fetcher);
        if(detail.data?.id!==id)throw Error('Order verification mismatch');
        for(const item of paidItems(detail.data,config)) {
          try {if(await deliverItem(item)==='sent')sent++;}catch{failed++;}
        }
      }
      return {checked,sent,failed};
    } finally {busy=false;}
  }
  return {run,deliverItem};
}
module.exports={configuration,encrypt,decrypt,paidItems,worker};
