'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app.js','utf8');
const dom=new JSDOM(html,{url:'https://scoreflow.example.invalid/',runScripts:'outside-only'}),w=dom.window;
w.scrollTo=()=>{};w.setInterval=()=>0;w.setTimeout=()=>0;w.HTMLElement.prototype.scrollIntoView=()=>{};
w.sessionStorage.setItem('scoreflow.entryIntent','license');w.sessionStorage.setItem('scoreflow.pendingLicense','SF-QA-LICENSE-CODE');
let active=false,invalid=false;const requests=[];
const entitlement={plan:'professional',status:'active',licenseExpiresAt:'2099-01-01T00:00:00Z',readOnly:false,limits:null,serverTime:new Date().toISOString()};
w.fetch=async(url,options={})=>{requests.push({url,options});if(url==='/api/account/session')return{ok:true,json:async()=>({user:{email:'qa@example.invalid'},organization:null,license:active?entitlement:null})};if(url==='/api/account/license'){if(invalid)return{ok:false,json:async()=>({message:'Codice non valido.'})};active=true;return{ok:true,json:async()=>({status:'active'})};}throw Error('Unexpected request '+url);};
w.eval(fs.readFileSync('scripts/jury-workflow.js','utf8'));
w.eval(app.replace('  initializeApplication();','  window.commercialQA={restoreOrganizerAccount,startGuidedConfiguration,trialReadOnly,showStartScreen};'));
const $=q=>w.document.querySelector(q);
(async()=>{
 await w.commercialQA.restoreOrganizerAccount();assert.equal(requests[0].url,'/api/account/session');assert.equal(requests[1].url,'/api/account/license');assert(!requests.some(r=>r.url==='/api/tenants'));assert.equal(w.sessionStorage.getItem('scoreflow.pendingLicense'),null);assert.equal($('#createDemoBtn').classList.contains('hidden'),true);assert.equal($('#quickOrgName').required,true);assert.equal($('#trialDays').closest('label').classList.contains('hidden'),true);
 $('#quickOrgName').value='QA organization';$('#quickEventName').value='QA competition';w.commercialQA.startGuidedConfiguration();assert.equal($('#eventFiles').disabled,false);assert.equal($('#judgeCount').hasAttribute('max'),false);assert.equal($('#minimumJudges').hasAttribute('max'),false);
 assert.equal(w.commercialQA.trialReadOnly({entitlements:{...entitlement,licenseExpiresAt:'2000-01-01T00:00:00Z'},cloud:{}}),true);
 assert.equal(w.commercialQA.trialReadOnly({entitlements:entitlement,cloud:{}}),false);
 console.log('PASS commercial account UI: activation before tenant creation, paid onboarding, no trial controls or demo data, full settings, local expiry guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
