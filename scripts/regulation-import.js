(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScoreFlowRegulations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function propose(text,event){
 if(typeof text!=='string'||text.length>200000)throw Error('Testo non valido o troppo lungo (massimo 200.000 caratteri).');
 const lines=text.split(/\n/).map((text,i)=>({text:text.trim(),line:i+1})).filter(x=>x.text);
 const findings=[];
 const add=(field,value,l)=>findings.push({field,value,quote:l.text,line:l.line});
 for(const l of lines){
  let m;
  if((m=l.text.match(/^(?:criterio|criterion|critère|critere)\s*:\s*(.{1,80}?)\s*[;|]\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)(?:\s*[;|]\s*(?:peso|weight|poids)\s*[:=]?\s*(\d+(?:[.,]\d+)?))?\s*$/iu)))add('criterion',{name:m[1],min:Number(m[2].replace(',','.')),max:Number(m[3].replace(',','.')),weight:Number((m[4]||'1').replace(',','.')),decimals:1},l);
  if((m=l.text.match(/^(?:categorie|categories|catégories|categorías)\s*:\s*(.+)$/iu)))add('categories',m[1].split(/[;,]/).map(x=>x.trim()).filter(Boolean),l);
  if((m=l.text.match(/^(?:discipline|disciplines|disciplinas)\s*:\s*(.+)$/iu)))add('disciplines',m[1].split(/[;,]/).map(x=>x.trim()).filter(Boolean),l);
  if((m=l.text.match(/(?:giuria composta da|numero (?:di )?giudici|giudici|jury of|number of judges|judges|jury composé de|nombre de juges|juges|jurado de|número de jueces|jueces)\s*:?\s*(\d+)\b/iu)))add('minimumJudges',Number(m[1]),l);
  if(/(?:somma|sum|somme|suma).{0,35}(?:criteri|criteria|critères|criterios)/iu.test(l.text))add('criteriaMode','sum',l);
  if(/(?:media|average|moyenne|promedio).{0,35}(?:criteri|criteria|critères|criterios)/iu.test(l.text))add('criteriaMode','average',l);
  if(/(?:media|average|moyenne|promedio).{0,55}(?:giudici|judges|juges|jueces)/iu.test(l.text))add('aggregation','average',l);
  if(/(?:somma|sum|somme|suma).{0,55}(?:giudici|judges|juges|jueces)/iu.test(l.text))add('aggregation','sum',l);
  if((m=l.text.match(/(?:penalit[aày]|penalt(?:y|ies)|pénalit(?:é|és)|penalizaci(?:ó|o)n(?:es)?).{0,18}?(\d+(?:[.,]\d+)?)\s*(?:a|to|à|[-–])\s*(\d+(?:[.,]\d+)?)/iu)))add('penalties',{min:Number(m[1].replace(',','.')),max:Number(m[2].replace(',','.'))},l);
 }
 const draft={sourceText:text,name:event.competitionRules?.source||'Regolamento personalizzato',criteria:clone(event.scoring.criteria),criteriaMode:event.competitionRules?.criteriaMode||'average',aggregation:event.scoring.aggregation||'average',minimumJudges:event.scoring.minimumJudges||3,penaltyMin:event.competitionRules?.penaltyMin??0,penaltyMax:event.competitionRules?.penaltyMax??10,disciplines:clone(event.disciplines||[]),categories:(event.categories||[]).map(c=>({id:c.id,name:c.name,minAge:null,maxAge:null,minSeconds:null,maxSeconds:null,...(event.competitionRules?.customCatalog||[]).find(s=>s.key===event.competitionRules?.categories?.[c.id])})),tieBreakIds:clone(event.competitionRules?.tieBreakIds||[]),findings,unresolved:[]};
 const criteria=findings.filter(f=>f.field==='criterion');if(criteria.length){draft.criteria=criteria.map((f,i)=>({...f.value,id:'rule-'+i}));draft.tieBreakIds=[];}
 for(const field of ['criteriaMode','aggregation','minimumJudges','disciplines','categories','penalties']){
  const fs=findings.filter(f=>f.field===field),unique=[...new Set(fs.map(f=>JSON.stringify(f.value)))];
  if(unique.length>1){draft.unresolved.push('Indicazioni discordanti: '+field);continue;}
  if(!fs.length){draft.unresolved.push('Non riconosciuto nel testo: '+field);continue;}
  const value=fs[0].value;
  if(field==='categories')draft.categories=value.map((name,i)=>({id:event.categories.find(c=>c.name.toLowerCase()===name.toLowerCase())?.id||'reg-cat-'+i,name,minAge:null,maxAge:null,minSeconds:null,maxSeconds:null}));
  else if(field==='penalties'){draft.penaltyMin=value.min;draft.penaltyMax=value.max;}
  else draft[field]=value;
 }
 if(!criteria.length)draft.unresolved.push('Criteri non riconosciuti: sono mostrati quelli attuali, da verificare.');
 draft.unresolved.push('Verificare manualmente età, durate, spareggi, requisiti, documenti, quote e scadenze. Le impostazioni non riconosciute sono quelle attuali, non dedotte dal documento.');
 return draft;
}
function validate(d){
 const errors=[];const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!d||typeof d!=='object')return ['Modello non valido.'];
 if(!String(d.name||'').trim()||String(d.name).length>120)errors.push('Indica il nome del modello (massimo 120 caratteri).');
 if(!Array.isArray(d.criteria)||!d.criteria.length||d.criteria.length>30)errors.push('Inserisci da 1 a 30 criteri.');
 else {const ids=new Set();d.criteria.forEach(c=>{if(!c.id||ids.has(c.id)||!String(c.name||'').trim()||!number(c.min,0,1000)||!number(c.max,0,1000)||c.min>=c.max||!number(c.weight,0.01,100)||!Number.isInteger(c.decimals)||!number(c.decimals,0,2))errors.push('Controlla nomi, intervalli, pesi e decimali dei criteri.');ids.add(c.id);});}
 if(!['sum','average'].includes(d.criteriaMode)||!['sum','average','median'].includes(d.aggregation))errors.push('Metodo di calcolo non valido.');
 if(!Number.isInteger(d.minimumJudges)||!number(d.minimumJudges,1,30))errors.push('Numero giudici da 1 a 30.');
 if(!number(d.penaltyMin,0,1000)||!number(d.penaltyMax,d.penaltyMin,1000))errors.push('Intervallo penalità non valido.');
 if(!Array.isArray(d.disciplines)||!d.disciplines.length||d.disciplines.length>50||d.disciplines.some(x=>typeof x!=='string'||!x.trim()||x.length>100))errors.push('Inserisci almeno una disciplina.');
 if(!Array.isArray(d.categories)||!d.categories.length||d.categories.length>100)errors.push('Inserisci da 1 a 100 categorie.');
 else {const ids=new Set();for(const c of d.categories){if(!c.id||ids.has(c.id)||!String(c.name||'').trim())errors.push('Nomi e identificativi delle categorie devono essere validi e univoci.');ids.add(c.id);for(const k of ['minAge','maxAge','minSeconds','maxSeconds'])if(c[k]!==null&&!number(c[k],0,k.includes('Age')?120:7200))errors.push('Limiti di età o durata non validi.');if(c.minAge!==null&&c.maxAge!==null&&c.minAge>c.maxAge||c.minSeconds!==null&&c.maxSeconds!==null&&c.minSeconds>c.maxSeconds)errors.push('Il minimo non può superare il massimo.');}}
 if(!Array.isArray(d.tieBreakIds)||new Set(d.tieBreakIds).size!==d.tieBreakIds.length||d.tieBreakIds.some(id=>!d.criteria?.some(c=>c.id===id)))errors.push('Sequenza spareggi non valida.');
 return [...new Set(errors)];
}
function apply(event,d,{text='',file=null,confirmed=false,now=new Date().toISOString()}={}){
 if(event.scores?.length)throw Error('Gara già votata: crea una nuova edizione per cambiare le regole.');
 if(d.sourceText!==undefined && d.sourceText!==text)throw Error('Il testo è cambiato dopo l’analisi. Prepara nuovamente la configurazione.');
 if(!confirmed)throw Error('Verifica e conferma la configurazione prima di applicarla.');
 const errors=validate(d);if(errors.length)throw Error(errors.join(' '));
 if((event.participants||[]).some(p=>!d.categories.some(c=>c.id===p.categoryId)||!d.disciplines.includes(p.discipline)))throw Error('Conserva le categorie e le discipline degli atleti già iscritti.');
 const next=clone(event);next.scoring={...next.scoring,criteria:clone(d.criteria),aggregation:d.aggregation,minimumJudges:d.minimumJudges,judgeCount:d.minimumJudges,penalties:{enabled:true,noteRequired:true}};
 next.categories=d.categories.map(c=>({id:c.id,name:c.name}));next.disciplines=clone(d.disciplines);
 next.competitionRules={enabled:true,profile:'custom',source:d.name,criteriaMode:d.criteriaMode,penaltyMin:d.penaltyMin,penaltyMax:d.penaltyMax,categories:Object.fromEntries(d.categories.map(c=>[c.id,c.id])),customCatalog:d.categories.map(c=>({...c,key:c.id})),tieBreakIds:clone(d.tieBreakIds),decisionsConfirmed:true};
 const versions=clone(event.rules?.versions||[]);versions.push({number:versions.length+1,approvedAt:now,name:d.name,text,file:clone(file),configuration:clone({...d,sourceText:undefined})});
 next.rules={...next.rules,text,file:clone(file),versions,activeVersion:versions.length,proposal:null,reviewRequired:false,approvedAt:now};return next;
}
return {propose,validate,apply};
});

