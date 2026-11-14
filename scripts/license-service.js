'use strict';
const crypto = require('node:crypto');
const MONTHS = Object.freeze([3, 6, 12]);
function normalizeCode(value) { return String(value || '').trim().toUpperCase(); }
function hashCode(value) { return crypto.createHash('sha256').update(normalizeCode(value)).digest('hex'); }
function createCode() { return 'SF-' + crypto.randomBytes(24).toString('hex').toUpperCase().match(/.{1,8}/g).join('-'); }
function validMonths(value) { return Number.isInteger(value) && MONTHS.includes(value); }
function licenseError(message, statusCode=400) { return Object.assign(new Error(message), {statusCode,payload:{error:'invalid-license',message}}); }
async function redeem(supabase, {code, ownerId=null, tenantKey=null}) {
  const normalized=normalizeCode(code);
  if(normalized.length<8 || normalized.length>128 || !/^[A-Z0-9-]+$/.test(normalized)) throw licenseError('Codice non valido, scaduto o già utilizzato.');
  const {data,error}=await supabase.rpc('scoreflow_redeem_license',{p_hash:hashCode(normalized),p_owner:ownerId,p_tenant:tenantKey});
  if(error) {
    if(String(error.message).includes('scoreflow:permanent-license')) throw licenseError('Questo account dispone già di una licenza senza scadenza.');
    if(String(error.message).includes('scoreflow:invalid-license')) throw licenseError('Codice non valido, scaduto o già utilizzato.');
    throw licenseError('Attivazione non disponibile. Riprova più tardi.',503);
  }
  return data;
}
async function forOwner(supabase, ownerId) {
  const {data,error}=await supabase.from('scoreflow_license_codes').select('plan,expires_at,duration_months,activated_at,active').eq('owner_id',ownerId).limit(100);
  if(error) throw licenseError('Stato della licenza non disponibile.',503);
  const licenses=(data || []).filter(l=>l.active && l.activated_at && (!l.expires_at || Date.parse(l.expires_at)>Date.now()));
  licenses.sort((a,b)=>(b.expires_at?Date.parse(b.expires_at):Infinity)-(a.expires_at?Date.parse(a.expires_at):Infinity));
  const license=licenses[0];
  return license ? {plan:license.plan,status:'active',licenseExpiresAt:license.expires_at,expiresAt:license.expires_at,durationMonths:license.duration_months,readOnly:false,updatesIncluded:true,limits:null,serverTime:new Date().toISOString()} : (data || []).some(l=>l.activated_at) ? {status:'expired',readOnly:true,licenseExpiresAt:(data || []).filter(l=>l.expires_at).sort((a,b)=>Date.parse(b.expires_at)-Date.parse(a.expires_at))[0]?.expires_at || null} : null;
}
module.exports={MONTHS,normalizeCode,hashCode,createCode,validMonths,redeem,forOwner};
