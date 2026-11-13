(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScoreFlowJury=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const key=s=>`${s.participantId}:${s.judgeId}:${s.round||'qualification'}:${Number(s.attempt||1)}`;
  const fail=message=>{throw Object.assign(new Error(message),{statusCode:409,error:'jury-review-conflict'});};
  const stamp=()=>new Date().toISOString();
  function ensure(event){event.juryRequests=Array.isArray(event.juryRequests)?event.juryRequests:[];event.scoreHistory=event.scoreHistory||[];return event;}
  function approval(event,score,original,now=Date.now()){
    return (event.juryRequests||[]).find(r=>r.kind==='score-review'&&r.id===score.reviewRequestId&&r.status==='approved'&&r.sourceScoreId===original.id&&r.judgeId===score.judgeId&&r.participantId===score.participantId&&r.round===(score.round||'qualification')&&Number(r.attempt)===Number(score.attempt||1)&&Date.parse(r.expiresAt)>now);
  }
  function addRequest(event,input,judgeId){
    ensure(event);
    if(!input||typeof input.id!=='string'||!input.id||input.id.length>100||!['score-review','category-review'].includes(input.kind))fail('Richiesta non valida.');
    const original=(event.scores||[]).find(s=>s.id===input.sourceScoreId&&s.judgeId===judgeId);
    if(!original)fail('Puoi richiedere la revisione soltanto di un tuo voto registrato.');
    const reason=String(input.reason||'').trim();if(!reason||reason.length>1200)fail('Inserisci una motivazione entro 1200 caratteri.');
    const same=event.juryRequests.find(r=>r.id===input.id);
    if(same)return same;
    const pending=event.juryRequests.find(r=>r.kind===input.kind&&r.sourceScoreId===original.id&&(r.status==='pending'||(r.status==='approved'&&Date.parse(r.expiresAt)>Date.now())));
    if(pending)return pending;
    if(event.juryRequests.length>=2000)fail('Troppe richieste: contatta la regia.');
    const categoryId=event.categories?.some(c=>c.id===input.suggestedCategoryId)?input.suggestedCategoryId:null;
    const request={id:input.id,kind:input.kind,sourceScoreId:original.id,participantId:original.participantId,judgeId,round:original.round||'qualification',attempt:Number(original.attempt||1),reason,suggestedCategoryId:categoryId,status:'pending',requestedAt:stamp(),updatedAt:stamp()};
    event.juryRequests.push(request);return request;
  }
  function receiveRequests(event,incoming,judgeId){
    ensure(event);
    for(const input of incoming.juryRequests||[])if(input.kind==='score-review'&&!event.juryRequests.some(r=>r.id===input.id))addRequest(event,input,judgeId);
  }
  function consume(event,request,original,replacement,actor={role:'judge'}){
    ensure(event);
    if(!approval(event,replacement,original))fail('La regia deve autorizzare questa ri-votazione.');
    const now=stamp();for(const r of event.juryRequests)if(r.kind==='category-review'&&r.sourceScoreId===original.id&&r.status==='pending'){r.status='superseded';r.updatedAt=now;}request.status='consumed';request.updatedAt=now;request.consumedAt=now;request.replacementScoreId=replacement.id;
    event.scoreHistory.push({id:'review-audit-'+request.id,type:'judge-revote',requestId:request.id,participantId:original.participantId,judgeId:original.judgeId,round:original.round||'qualification',attempt:Number(original.attempt||1),originalScoreId:original.id,replacementScoreId:replacement.id,originalScore:copy(original),replacementScore:copy(replacement),actor,approvedBy:request.decidedBy,reason:request.reason,createdAt:now});
    event.resultsValidated={};
  }
  function categoryRequest(event,score){
    if(score.penaltyScope!=='final'||!Number(score.penalty))return;
    if((event.juryRequests||[]).some(r=>r.kind==='category-review'&&r.participantId===score.participantId&&r.round===(score.round||'qualification')&&Number(r.attempt)===Number(score.attempt||1)&&r.status==='pending'))return;
    addRequest(event,{id:'category-'+score.id,kind:'category-review',sourceScoreId:score.id,reason:score.penaltyNote||score.note},score.judgeId);
  }
  function decide(event,id,status,{reason='',categoryId=null,actor={role:'control'}}={}){
    ensure(event);const request=event.juryRequests.find(r=>r.id===id);if(!request)fail('Richiesta non trovata.');
    if(!['pending','approved'].includes(request.status))return request;
    const original=event.scores?.find(s=>s.id===request.sourceScoreId&&s.judgeId===request.judgeId);
    if(!original)fail('Il voto è cambiato: richiedi una nuova revisione.');
    const now=stamp();
    if(request.kind==='score-review'){
      if(!['approved','rejected'].includes(status))fail('Decisione non valida.');
      if(status==='approved'&&request.status==='approved')return request;
      request.status=status;request.expiresAt=status==='approved'?new Date(Date.now()+30*60000).toISOString():null;
    }else{
      if(!['kept','reclassified'].includes(status))fail('Decisione categoria non valida.');
      const p=event.participants?.find(p=>p.id===request.participantId);if(!p)fail('Atleta non trovato.');
      if(status==='reclassified'){
        if(!event.categories?.some(c=>c.id===categoryId)||categoryId===p.categoryId)fail('Seleziona una nuova categoria valida.');
        if(!String(reason).trim())fail('Motiva il cambio categoria.');
        const from=p.categoryId;p.categoryId=categoryId;p.updatedAt=now;
        event.scoreHistory.push({id:'category-audit-'+id,type:'category-change',participantId:p.id,fromCategoryId:from,toCategoryId:categoryId,reason:String(reason).trim().slice(0,1200),actor,createdAt:now});
        event.resultsValidated={};
      }
      request.status=status;request.categoryId=p.categoryId;
    }
    request.decisionReason=String(reason).trim().slice(0,1200);request.decidedBy=actor;request.decidedAt=now;request.updatedAt=now;return request;
  }
  function receiveDecisions(event,incoming,actor){
    ensure(event);
    for(const requested of incoming.juryRequests||[]){const r=event.juryRequests.find(r=>r.id===requested.id);if(r&&r.status!==requested.status&&['approved','rejected','kept','reclassified'].includes(requested.status))decide(event,r.id,requested.status,{reason:requested.decisionReason,categoryId:requested.categoryId,actor});}
  }
  function expireMissingSources(event){ensure(event);for(const r of event.juryRequests)if(['pending','approved'].includes(r.status)&&!event.scores?.some(s=>s.id===r.sourceScoreId)){r.status='superseded';r.updatedAt=stamp();}}
  function finalPenalty(scores){return Math.max(0,...scores.filter(s=>s.penaltyScope==='final').map(s=>Number(s.penalty)||0));}
  return {key,ensure,expireMissingSources,approval,addRequest,receiveRequests,consume,categoryRequest,decide,receiveDecisions,finalPenalty};
});
