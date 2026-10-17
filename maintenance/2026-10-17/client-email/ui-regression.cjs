'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(process.argv[2],'utf8'),html=fs.readFileSync(process.argv[3],'utf8');
const dom=new JSDOM(html,{url:'https://scoreflow.test',runScripts:'outside-only'}),w=dom.window;
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.setInterval=()=>0;w.setTimeout=()=>0;
w.eval(source.replace('  initializeApplication();','  window.emailQA={organizationEmailPanel,bindOrganizationEmail};'));
const el=w.document.querySelector('#moduleContent');
const settings={enabled:false,hasKey:true,senderName:'QA',senderEmail:'sender@example.invalid',replyTo:'',configured:false};
let requests=[],pendingResponse={settings:{...settings,enabled:true,configured:true},message:'Email di prova accettata dal servizio. La consegna non è ancora confermata.'};
w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>pendingResponse};};
let form,testForm;
function setup(){el.innerHTML=w.emailQA.organizationEmailPanel(settings);w.emailQA.bindOrganizationEmail({slug:'qa-email',cloud:{tenantKey:'qa-email',secret:'qa-only-not-a-real-secret'}});form=el.querySelector('#organizationEmailSettings');testForm=el.querySelector('#organizationEmailTest');requests=[];}
const submit=async(f)=>{f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));};
const cases=[
 ['settings show saved key without exposing it',async()=>{setup();assert.equal(form.elements.apiKey.value,'');assert.match(form.elements.apiKey.placeholder,/lascia vuoto/);assert.equal(form.elements.apiKey.type,'password');}],
 ['saving clears typed API key and updates visible sending status',async()=>{setup();form.elements.apiKey.value='re_QA_ONLY_NOT_REAL_KEY';form.elements.enabled.checked=true;await submit(form);assert.equal(requests[0].options.method,'PUT');assert.equal(JSON.parse(requests[0].options.body).apiKey,'re_QA_ONLY_NOT_REAL_KEY');assert.equal(form.elements.apiKey.value,'');assert.equal(el.querySelector('#emailStatus').textContent,'Invio attivo');assert.ok(!w.localStorage.getItem('re_QA_ONLY_NOT_REAL_KEY'));}],
 ['unsaved changes block email test',async()=>{setup();form.elements.senderName.dispatchEvent(new w.Event('input',{bubbles:true}));await submit(testForm);assert.equal(requests.length,0);assert.match(el.querySelector('#emailFeedback').textContent,/Salva le modifiche/);}],
 ['test sends only recipient to saved configuration endpoint',async()=>{setup();testForm.elements.to.value='recipient@example.invalid';await submit(testForm);assert.ok(requests[0].url.endsWith('/email-settings/test'));assert.deepEqual(JSON.parse(requests[0].options.body),{to:'recipient@example.invalid'});assert.match(el.querySelector('#emailFeedback').textContent,/non è ancora confermata/);}],
 ['remove key disables automatic sending in the same request',async()=>{setup();form.elements.clearKey.checked=true;form.elements.enabled.checked=true;await submit(form);const body=JSON.parse(requests[0].options.body);assert.equal(body.enabled,false);assert.equal(body.clearKey,true);}],
 ['server errors appear as text and release busy button',async()=>{setup();w.fetch=async()=>({ok:false,json:async()=>({message:'<img src=x onerror=alert(1)>'})});await submit(form);assert.equal(el.querySelector('#emailFeedback').textContent,'<img src=x onerror=alert(1)>');assert.equal(el.querySelector('#emailFeedback img'),null);assert.equal(form.querySelector('button').disabled,false);}]
];
(async()=>{let failed=0;for(const[name,run]of cases){try{await run();console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}dom.window.close();console.log(JSON.stringify({passed:cases.length-failed,failed}));process.exitCode=failed?1:0;})();
