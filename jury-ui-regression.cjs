'use strict';
const fs=require('fs'),assert=require('assert/strict'),{JSDOM}=require('jsdom');
const org=require('./jury-test-fixture.cjs'),dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
const observers=[];const OriginalObserver=w.MutationObserver;w.MutationObserver=class extends OriginalObserver{constructor(cb){super(cb);observers.push(this);}};
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.setTimeout=()=>0;w.setInterval=()=>0;w.confirm=()=>true;
const downloads=[];w.fetch=async(url,o)=>{downloads.push({url,body:JSON.parse(o.body||'{}')});return{ok:true,json:async()=>({url:'/entry-test.mp4'})}};
for(const file of ['jury-workflow','competition-rules','i18n'])w.eval(fs.readFileSync('scripts/'+file+'.js','utf8'));
w.eval(fs.readFileSync('app.js','utf8').replace('  initializeApplication();','  window.qa={renderJudgeStation,renderControl,participantResult,ensureEventData,set(o){platform.organizations=[o];editingOrganizationId=o.id;organizerAccount={email:"qa@example.invalid"};ensureEventData(o.events[0]);}};'));
const $=s=>w.document.querySelector(s),change=(s,value)=>{$(s).value=value;$(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
(async()=>{try{
w.qa.set(org);w.qa.renderJudgeStation(org,'j1');
change('#judgeArchiveAthlete','p1');assert($('.judge-entry-video'));assert.equal(org.events[0].control.currentParticipantId,'p2');
$('.judge-entry-video').click();await new Promise(r=>setImmediate(r));assert($('.media-modal video'));assert.equal(downloads[0].body.path,'qa/entry/p1.mp4');$('.media-modal button').click();
$('#judgeReviewReason').value='Video entry: livello superiore';$('#judgeReviewRequest').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(org.events[0].juryRequests[0].status,'pending');
w.qa.renderControl(org);assert.equal($('.jury-count').textContent,'1');$('[data-jury-action=approved]').click();assert.equal(org.events[0].juryRequests[0].status,'approved');
w.qa.renderJudgeStation(org,'j1');assert($('#judgeScoreForm'));assert.equal($('.score-value').value,'8');change('#scorePenaltyScope','final');$('#scorePenalty').value='30';$('#scoreNote').value='Livello non conforme';$('#judgeScoreForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(org.events[0].scores.length,6);assert.equal(w.qa.participantResult(org.events[0],'p1').total,18);assert.equal(org.events[0].juryRequests[0].status,'consumed');assert.equal(org.events[0].control.currentParticipantId,'p2');assert.equal(org.events[0].participants[0].status,'completed');assert.equal(org.events[0].scoreHistory[0].originalScore.id,'p1-j1');
w.qa.renderControl(org);$('[data-jury-category]').value='advanced';$('[data-jury-reason]').value='Video conferma il livello Avanzato';$('[data-jury-action=reclassified]').click();assert.equal(org.events[0].participants[0].categoryId,'advanced');assert.equal(w.qa.participantResult(org.events[0],'p1').total,18);
// Previous-round sheets remain browsable; selecting them cannot move the live athlete.
org.cloud.pending=false;org.events[0].participants[0].round='final';w.qa.renderJudgeStation(org,'j1');change('#judgeArchiveScore',org.events[0].scores.find(s=>s.participantId==='p1'&&s.judgeId==='j1').id);assert($('#judgeReviewRequest'));assert($('.judge-entry-video'));assert.equal(org.events[0].control.currentParticipantId,'p2');
for(const language of ['en','fr','es','it']){org.cloud.pending=false;change('#judgeUiLanguage',language);assert($('#judgeArchiveAthlete'));assert($('.judge-entry-video'));assert($('.jury-request-card'));}
console.log('PASS jury DOM UI: historical video, notifications, specific approval, prefilled re-vote, 48−30=18, category decision, older-round browsing and 4 languages');
}finally{await new Promise(r=>setImmediate(r));observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
