(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreFlowRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const catalog = [];
  const add = (key, name, minAge, maxAge, minSeconds, maxSeconds, duo = false) => catalog.push({key, name, minAge, maxAge, minSeconds, maxSeconds, duo});
  add('junior-a', 'Junior A', 7, 9, 150, 240);
  [['junior-b','Junior B',10,12],['teen','Teen',13,17],['adulti','Adulti',18,29],['senior','Senior',30,null]].forEach(([key,name,min,max]) => {
    ['Base','Intermedio','Avanzato'].forEach((level,i) => add(`${key}-${level.toLowerCase()}`, `${name} ${level}`, min,max,i ? 180 : 150,i ? 300 : 240));
  });
  add('istruttori','Istruttori / Allenatori',18,null,120,300);
  add('professional','Professional',18,null,210,300);
  add('duo-amatoriali','Duo Amatoriali',8,null,180,360,true);
  add('duo-professional','Duo Professional',null,null,210,360,true);
  add('elite','Elite',6,null,210,360);
  const criterionNames = ['Coreografia','Tecnica','Tricks','Immagine','Presenza scenica','Performance generale'];
  function preset() {
    return { enabled:true, source:'FAC 2026', categories:{}, criteriaMode:'average', penaltyMin:1, penaltyMax:10,
      minimumEntries:3, singleFee:60, duoFee:100, coachRatio:3, videoMinSeconds:90,
      tieBreakIds:['fac-5','fac-1','fac-0'], decisionsConfirmed:false };
  }
  function criteria() { return criterionNames.map((name,i) => ({id:`fac-${i}`,name,min:1,max:10,weight:1,decimals:1})); }
  function ageAt(birth, at) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || '') || !/^\d{4}-\d{2}-\d{2}$/.test(at || '')) return null;
    const b = new Date(birth+'T00:00:00Z'), a = new Date(at+'T00:00:00Z');
    if (!Number.isFinite(+b) || !Number.isFinite(+a) || b.toISOString().slice(0,10)!==birth || a.toISOString().slice(0,10)!==at || b>a) return null;
    return a.getUTCFullYear()-b.getUTCFullYear() - (at.slice(5)<birth.slice(5) ? 1:0);
  }
  function issues(event, profile, registrationDate) {
    const rules = event.competitionRules;
    if (!rules?.enabled) return [];
    const errors=[];
    const spec = catalog.find(x=>x.key===rules.categories?.[profile.categoryId]);
    if (!spec) return ['Associa la categoria a un profilo del regolamento.'];
    if (!(event.disciplines || []).includes(profile.discipline)) errors.push('Disciplina non prevista per questo evento.');
    const age=ageAt(profile.birthDate, String(profile.registeredAt || registrationDate || '').slice(0,10));
    if (spec.minAge !== null && (age===null || age<spec.minAge || (spec.maxAge!==null && age>spec.maxAge))) errors.push(`Età non valida alla data di iscrizione (${spec.minAge}–${spec.maxAge ?? '∞'} anni).`);
    const music=profile.attachments?.music;
    const duration=Number(music?.durationSeconds || profile.performanceDuration);
    if (!Number.isFinite(duration) || duration<spec.minSeconds || duration>spec.maxSeconds) errors.push(`Durata musica richiesta: ${spec.minSeconds}–${spec.maxSeconds} secondi.`);
    if (!music || !(/\.mp3$/i.test(music.name || '') && /^(audio\/mpeg|audio\/mp3)$/i.test(music.type || ''))) errors.push('Serve una traccia MP3.');
    if (!profile.rulesAccepted) errors.push('Accettazione del regolamento mancante.');
    const review=profile.review?.facChecks || {};
    if (!review.video) errors.push(`Conferma video continuo di almeno ${rules.videoMinSeconds} secondi, figura intera, attrezzo e livello corretti.`);
    if (!review.eligibility) errors.push('Verifica precedenti vittorie, passaggio di fascia e requisiti della categoria.');
    if (spec.duo && !review.duo) errors.push('Verifica identità, età e requisiti di entrambi i componenti del duo.');
    return errors;
  }
  function scoreErrors(event, score) {
    if (!event.competitionRules?.enabled) return [];
    const errors=[];
    if (!event.competitionRules.decisionsConfirmed) errors.push("Conferma il metodo di calcolo nella sezione Evento e regolamento.");
    for(const c of event.scoring.criteria) {
      const raw=score.values?.[c.id], n=Number(raw), scale=10**Number(c.decimals || 0);
      if (raw===null || raw==='' || raw===undefined || !Number.isFinite(n) || n<c.min || n>c.max || Math.abs(n*scale-Math.round(n*scale))>1e-7) errors.push(`Voto non valido: ${c.name}`);
    }
    const p=Number(score.penalty || 0), r=event.competitionRules;
    if (!Number.isFinite(p) || p<0 || (p>0 && (p<r.penaltyMin || p>r.penaltyMax))) errors.push(`Penalità: zero oppure ${r.penaltyMin}–${r.penaltyMax}.`);
    if (p>0 && !(score.penaltyNote || score.note || '').trim()) errors.push('Motivazione della penalità obbligatoria.');
    return errors;
  }
  function judgeScore(event, score) {
    const sum=event.scoring.criteria.reduce((s,c)=>s+Number(score.values?.[c.id] || 0)*Number(c.weight || 1),0);
    const weight=event.scoring.criteria.reduce((s,c)=>s+Number(c.weight || 1),0) || 1;
    return Math.max(0,(event.competitionRules?.enabled && event.competitionRules.criteriaMode==='sum' ? sum : sum/weight)-Number(score.penalty || 0));
  }
  function compare(event,a,b) {
    if (a.result.total===null || b.result.total===null) return a.result.total===b.result.total ? 0 : a.result.total===null ? 1:-1;
    const delta=b.result.total-a.result.total;
    if (Math.abs(delta)>1e-9) return delta;
    if(event.competitionRules?.enabled) for(const id of event.competitionRules.tieBreakIds || []) {
      const d=(b.result.criterionMeans?.[id] || 0)-(a.result.criterionMeans?.[id] || 0);
      if(Math.abs(d)>1e-9) return d;
    }
    return 0;
  }
  function rank(event, rows) {
    const sorted=[...rows].sort((a,b)=>compare(event,a,b));
    let last=null, rank=0, counted=0;
    return sorted.map(row=>{
      if (!row.result.complete || row.result.total===null || ['dns','disqualified'].includes(row.participant.status)) return {...row,rank:null};
      counted++;
      if (!last || compare(event,last,row)!==0) rank=counted;
      last=row; return {...row,rank};
    });
  }
  function groups(event) {
    return event.categories.flatMap(category => event.competitionRules?.enabled
      ? [...new Set([...(event.disciplines || []),...(event.participants || []).filter(p=>p.categoryId===category.id).map(p=>p.discipline || '')])].map(discipline=>({...category,discipline,name:`${discipline || 'Disciplina mancante'} · ${category.name}`}))
      : [category]);
  }
  function inGroup(p,g) { return p.categoryId===g.id && (g.discipline===undefined || (p.discipline || '')===g.discipline); }
  function validateState(previous, incoming) {
    for (const event of incoming.events || []) {
      const old=(previous.events || []).find(e=>e.id===event.id);
      if (old?.competitionRules?.enabled && old.scores?.length &&
        (JSON.stringify(old.competitionRules)!==JSON.stringify(event.competitionRules) || JSON.stringify(old.scoring)!==JSON.stringify(event.scoring) || JSON.stringify(old.categories)!==JSON.stringify(event.categories) || JSON.stringify(old.disciplines)!==JSON.stringify(event.disciplines)))
        throw Object.assign(new Error('Regole, criteri, categorie e discipline bloccati dopo il primo voto.'),{statusCode:409});
      if (event.competitionRules?.enabled) {
        const originals=new Map((old?.scores || []).map(s=>[s.id,JSON.stringify(s)]));
        for (const score of event.scores || []) if (originals.get(score.id)!==JSON.stringify(score)) {
          const errors=scoreErrors(event,score);
          if(errors.length) throw Object.assign(new Error(errors.join(' ')),{statusCode:400});
        }
      }
    }
  }
  return {catalog,preset,criteria,ageAt,issues,scoreErrors,judgeScore,compare,rank,groups,inGroup,validateState};
});
