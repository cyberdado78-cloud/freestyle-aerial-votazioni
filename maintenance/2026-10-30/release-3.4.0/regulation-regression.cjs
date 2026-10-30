const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const R=require('./scripts/regulation-import');
const Rules=require('./scripts/competition-rules');
const event={id:'e',scoring:{criteria:[{id:'old',name:'Old',min:1,max:10,weight:1,decimals:1}],aggregation:'average',minimumJudges:3},categories:[{id:'a',name:'Open'}],disciplines:['Danza'],participants:[],scores:[],rules:{}};
const text='Discipline: Danza; Acro\nCategorie: Open; Junior\nCriterio: Tecnica; 1-10; peso 2\nCriterio: Arte; 1-10\nSomma dei criteri\nMedia dei giudici\nGiudici: 3\nPenalità 0,5-10';
const d=R.propose(text,event);assert.equal(d.criteria.length,2);assert.equal(d.criteria[0].weight,2);assert.equal(d.criteriaMode,'sum');assert.equal(d.aggregation,'average');assert.equal(d.penaltyMin,.5);assert.deepEqual(R.validate(d),[]);assert.equal(d.findings.find(f=>f.field==='criterion').line,3);
assert(R.propose(text+'\nMedia dei criteri',event).unresolved.some(x=>x.includes('discordanti')));
assert.throws(()=>R.apply(event,d,{text}),/conferma/);assert.throws(()=>R.apply(event,d,{text:text+'x',confirmed:true}),/cambiato/);
d.categories[0].minAge=12;d.categories[0].maxAge=17;d.categories[0].minSeconds=90;d.categories[0].maxSeconds=180;
const next=R.apply(event,d,{text,confirmed:true,now:'2026-10-27T12:00:00Z'});assert.equal(event.scoring.criteria[0].name,'Old');assert.equal(next.rules.activeVersion,1);assert.equal(next.competitionRules.profile,'custom');assert.equal(next.rules.versions[0].text,text);
const score={values:{'rule-0':8,'rule-1':7},penalty:.5,note:'Penalty'};assert.equal(Rules.judgeScore(next,score),22.5);assert.deepEqual(Rules.scoreErrors(next,score),[]);
assert.deepEqual(Rules.issues(next,{categoryId:'a',discipline:'Danza',birthDate:'2011-01-01',rulesAccepted:true,performanceDuration:120},'2026-01-01'),[]);
assert(Rules.issues(next,{categoryId:'a',discipline:'Danza',birthDate:'2019-01-01',rulesAccepted:true,performanceDuration:200},'2026-01-01').length===2);
assert.throws(()=>R.apply({...event,scores:[score]},d,{text,confirmed:true}),/già votata/);
assert.throws(()=>R.apply({...event,participants:[{categoryId:'missing',discipline:'Danza'}]},d,{text,confirmed:true}),/Conserva/);
assert.equal(R.apply(next,d,{text,confirmed:true}).rules.versions.length,2);
const voted={...next,scores:[score]},changed=structuredClone(voted);changed.rules.text='changed';assert.throws(()=>Rules.validateState({events:[voted]},{events:[changed]}),/bloccato/);
// A JSON database round-trip may reorder every object without changing its data.
const reorderKeys=value=>Array.isArray(value)?value.map(reorderKeys):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reorderKeys(value[key])])):value;
const persisted=reorderKeys(voted);
const secondVote=structuredClone(voted);secondVote.scores.push({...score,id:'second'});
assert.doesNotThrow(()=>Rules.validateState({events:[persisted]},{events:[secondVote]}));
const mixed=structuredClone(next);mixed.scoring.criteria=reorderKeys(mixed.scoring.criteria);
mixed.rules.file={name:'test.pdf',size:123};mixed.rules.versions[0].file={size:123,name:'test.pdf'};
assert.deepEqual(Rules.scoreErrors(mixed,score),[]);
for(const mutate of [e=>e.rules.text+=' changed',e=>e.scoring.criteria[0].max=9,
  e=>e.competitionRules.penaltyMin=1,e=>e.categories[0].name='Changed',
  e=>e.disciplines.reverse(),e=>e.scoring.criteria.reverse()]){
 const altered=structuredClone(secondVote);mutate(altered);
 assert.throws(()=>Rules.validateState({events:[persisted]},{events:[altered]}),/bloccat/);
}
const invalidVote=structuredClone(secondVote);invalidVote.scores[1].values={'rule-0':11,'rule-1':7};
assert.throws(()=>Rules.validateState({events:[persisted]},{events:[invalidVote]}),/Voto non valido/);
assert(R.validate({...d,minimumJudges:0}).length);assert(R.validate({...d,tieBreakIds:['unknown']}).length);assert(R.validate({...d,categories:[{...d.categories[0],maxAge:2}]}).length);
const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('scripts/regulation-import.js')>=0);assert(html.indexOf('scripts/regulation-import.js')<html.indexOf('./app.js'));
const dom=new JSDOM(html,{url:'https://example.invalid',runScripts:'outside-only'}),w=dom.window;w.scrollTo=()=>{};
w.eval(fs.readFileSync('scripts/competition-rules.js','utf8'));w.eval(fs.readFileSync('scripts/regulation-import.js','utf8'));w.eval(fs.readFileSync('app.js','utf8').replace('  initializeApplication();','  window.regTest={renderRegulationAssistant};'));
const uiEvent=structuredClone(event);uiEvent.rules.proposal=structuredClone(d);uiEvent.rules.proposal.findings.push({field:'criterion',quote:'<img src=x onerror=alert(1)>',line:1});
w.regTest.renderRegulationAssistant({events:[uiEvent]});assert(w.document.querySelector('#regReview'));assert.equal(w.document.querySelectorAll('[data-reg-criterion]').length,2);assert.equal(w.document.querySelectorAll('.regulation-assistant img').length,0);assert(w.document.querySelector('#regReviewed').required);
w.document.querySelector('#moduleContent').innerHTML='';uiEvent.scores=[score];w.regTest.renderRegulationAssistant({events:[uiEvent]});assert(w.document.querySelector('#regPropose').disabled);dom.window.close();
(async()=>{const extract=require('./scripts/extract-regulation.cjs');for(const ext of ['pdf','docx']){const result=await extract(fs.readFileSync('test-fixtures/regulation.'+ext),'rules.'+ext);assert(result.includes('Tecnica'));assert(result.includes('Media dei giudici'));}assert.throws(()=>extract(Buffer.from('not pdf'),'rules.pdf'),/formato/);console.log('Regulation import: PDF/DOCX extraction, evidence, conflicts, confirmation, scoring, admission, versions, locks, reuse schema and UI OK');})().catch(e=>{console.error(e);process.exitCode=1;});

