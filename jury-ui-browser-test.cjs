'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SCOREFLOW_PLAYWRIGHT_MODULE||'playwright');
const root=__dirname,Rules=require('./scripts/competition-rules');
const judges=[1,2,3].map(i=>({id:'j'+i,name:'Giudice '+i,code:String(i).repeat(4),active:true,language:'it'}));
const p=(id,name,status)=>({id,name,status,categoryId:'base',discipline:'Tessuti',round:'qualification',attempt:1,order:id==='p1'?1:2,attachments:{entryVideo:{cloudPath:'qa/entry/'+id+'.mp4'}}});
const scores=['p1','p2'].flatMap(id=>judges.map(j=>({id:id+'-'+j.id,participantId:id,judgeId:j.id,round:'qualification',attempt:1,values:Object.fromEntries(Rules.criteria().map(c=>[c.id,8])),penalty:0,note:'',submittedAt:'2026-11-13T08:00:00Z',locked:true})));
const org={id:'qa-org',name:'TEST Freestyle Academy',slug:'qa',language:'it',brand:{primaryColor:'#c1121f',accentColor:'#d4af37'},cloud:{tenantKey:'qa',accountManaged:true,revision:1,status:'online'},subscription:{status:'active'},events:[{id:'qa-event',name:'TEST giuria — dati fittizi',categories:[{id:'base',name:'Base'},{id:'advanced',name:'Avanzato'}],disciplines:['Tessuti'],scoring:{criteria:Rules.criteria(),aggregation:'average',minimumJudges:3,judgeCount:3,penalties:{enabled:true,noteRequired:true}},competitionRules:Rules.preset(),participants:[p('p1','Anna TEST','completed'),p('p2','Elena TEST','competing')],judges,scores,control:{currentParticipantId:'p2',status:'running',mode:'automatic',round:'qualification',repeatQueue:[]},rules:{text:'Regolamento TEST'},publicVoting:{enabled:false},rounds:{enabled:false}}]};
const server=http.createServer((req,res)=>{
 let file=decodeURIComponent(req.url.split('?')[0]);if(file==='/')file='/index.html';
 if(file.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({url:'/qa-entry.mp4',revision:1}));return;}
 if(file==='/qa-entry.mp4'){res.writeHead(204);res.end();return;}
 const target=path.join(root,file);if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
 try{let data=fs.readFileSync(target);if(file==='/app.js')data=Buffer.from(data.toString().replace('  initializeApplication();','  window.juryQA={renderJudgeStation(o,id){currentDashboardModule="judge";renderJudgeStation(o,id);},renderControl(o){currentDashboardModule="control";renderControl(o);},participantResult,ensureEventData,set(o){platform.organizations=[o];editingOrganizationId=o.id;organizerAccount={email:"qa@example.invalid"};ensureEventData(o.events[0]);},get(){return platform.organizations[0];}};'));
 res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.SCOREFLOW_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.juryQA);await page.evaluate(()=>window.ScoreFlowI18n.setLanguage('it'));
await page.evaluate(o=>{window.juryQA.set(o);document.querySelector('#onboarding').classList.add('hidden');document.querySelector('main.layout').classList.add('hidden');document.querySelector('#dashboard').classList.remove('hidden');window.juryQA.renderJudgeStation(o,'j1');},org);
await page.locator('#judgeArchiveAthlete').selectOption('p1');assert.equal(await page.locator('.judge-entry-video').count(),1);assert.equal(await page.evaluate(()=>window.juryQA.get().events[0].control.currentParticipantId),'p2');
await page.locator('.judge-entry-video').click();await page.locator('.media-modal video').waitFor();assert.match(await page.locator('.media-modal video').getAttribute('src'),/qa-entry.mp4/);await page.locator('.media-modal button').click();
await page.locator('#judgeReviewReason').fill('Video entry: livello superiore rispetto alla categoria');await page.locator('#judgeReviewRequest button').click();
assert.equal(await page.evaluate(()=>window.juryQA.get().events[0].juryRequests[0].status),'pending');
await page.evaluate(()=>window.juryQA.renderControl(window.juryQA.get()));assert.equal(await page.locator('.jury-count').innerText(),'1');await page.screenshot({path:'jury-control-desktop.png',fullPage:true});
await page.locator('[data-jury-action="approved"]').click();await page.evaluate(()=>window.juryQA.renderJudgeStation(window.juryQA.get(),'j1'));await page.locator('#judgeScoreForm').waitFor();
await page.locator('#outsideCategory').click();assert.equal(await page.locator('#scorePenalty').inputValue(),'10');await page.locator('#scoreNote').fill('Livello della categoria non rispettato');
await page.screenshot({path:'jury-revote-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.dashboard-nav')).transform==='matrix(1, 0, 0, 1, -264, 0)');await page.screenshot({path:'jury-revote-mobile.png',fullPage:true});
console.log('Mobile overflow:',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,id:e.id,x:e.getBoundingClientRect().right})).filter(e=>e.x>innerWidth+1).slice(0,12)})));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile horizontal overflow');
await page.locator('#judgeScoreForm button[type=submit]').click();
const state=await page.evaluate(()=>({event:window.juryQA.get().events[0],result:window.juryQA.participantResult(window.juryQA.get().events[0],'p1')}));assert.equal(state.result.total,38);assert.equal(state.event.scores.length,6);assert.equal(state.event.control.currentParticipantId,'p2');assert.equal(state.event.juryRequests[0].status,'consumed');assert.equal(state.event.scoreHistory[0].originalScore.id,'p1-j1');assert.equal(state.event.participants[0].status,'completed');
await page.evaluate(()=>window.juryQA.renderControl(window.juryQA.get()));assert.equal(await page.locator('[data-jury-category]').count(),0);
assert.equal(await page.evaluate(()=>window.juryQA.get().events[0].participants[0].categoryId),'base');
assert.deepEqual(errors,[]);console.log('PASS actual Chromium UI: historical video, judge bell, control approval, prefilled re-vote, final penalty 48−10=38, category retained, mobile layout, no page errors');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
