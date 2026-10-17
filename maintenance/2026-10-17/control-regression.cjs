'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const [appPath, htmlPath] = process.argv.slice(2);
if (!appPath || !htmlPath) throw new Error('Usage: node control-regression.cjs APP_JS INDEX_HTML');
const source = fs.readFileSync(appPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
function boot() {
  const dom = new JSDOM(html, { url: 'https://scoreflow.test/', runScripts: 'outside-only' });
  const w = dom.window;
  let serial = 0;
  const timers = new Map();
  w.setTimeout = (fn, ms) => { const id = ++serial; timers.set(id, { fn, ms }); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.setInterval = () => ++serial;
  w.clearInterval = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.alert = message => { throw new Error(`Unexpected alert: ${message}`); };
  w.confirm = () => true;
  w.prompt = () => 'RESET';
  w.fetch = async () => { throw new Error('Network forbidden during regression tests'); };
  const hooks = `window.__qa = {
    organization: () => platform.organizations[0],
    open: module => activateDashboardModule(module, platform.organizations[0]),
    render: module => renderDashboardModule(module, platform.organizations[0]),
    replace: organization => { platform.organizations[0] = organization; },
    participant: () => currentParticipant(ensureEventData(platform.organizations[0].events[0])),
    result: id => participantResult(platform.organizations[0].events[0], id)
  };`;
  w.eval(source.replace('  initializeApplication();', hooks));
  w.document.querySelector('#quickOrgName').value = 'QA-only';
  w.document.querySelector('#createDemoBtn').click();
  w.__qa.open('control');
  const $ = selector => w.document.querySelector(selector);
  const refresh = () => {
    const entry = [...timers.entries()].find(([, value]) => value.ms === 15000);
    assert.ok(entry, 'Expected a scheduled control refresh');
    timers.delete(entry[0]); entry[1].fn();
  };
  return { w, $, qa: w.__qa, timers, refresh, close: () => dom.window.close() };
}
function fillDraft(ctx) {
  const form = ctx.$('#scoreForm');
  form.querySelector('#scoreJudge').selectedIndex = 1;
  form.querySelectorAll('.score-value').forEach(input => { input.value = '9.3'; });
  form.querySelector('#scorePenalty').value = '0.5';
  form.querySelector('#scoreNote').value = 'QA penalty note';
}
const cases = [
  ['15-second refresh preserves scores, judge and penalty note', ctx => {
    fillDraft(ctx); const judge = ctx.$('#scoreJudge').value; ctx.refresh();
    assert.equal(ctx.$('.score-value').value, '9.3');
    assert.equal(ctx.$('#scoreJudge').value, judge);
    assert.equal(ctx.$('#scorePenalty').value, '0.5');
    assert.equal(ctx.$('#scoreNote').value, 'QA penalty note');
  }],
  ['manual refresh preserves unsaved inputs', ctx => {
    fillDraft(ctx); ctx.$('.refresh-control').click();
    assert.equal(ctx.$('.score-value').value, '9.3');
    assert.equal(ctx.$('#scoreNote').value, 'QA penalty note');
  }],
  ['navigating away cancels control timer and keeps results visible', ctx => {
    ctx.qa.open('results');
    for (const [id, timer] of [...ctx.timers]) if (timer.ms === 15000) { ctx.timers.delete(id); timer.fn(); }
    assert.ok(ctx.$('.results-category') || ctx.$('#moduleContent').textContent.includes('Classifiche'));
    assert.equal(ctx.$('#scoreForm'), null);
  }],
  ['cloud redraw preserves unsaved score for the same athlete', ctx => {
    fillDraft(ctx); ctx.qa.render('control');
    assert.equal(ctx.$('.score-value').value, '9.3');
    assert.equal(ctx.$('#scoreNote').value, 'QA penalty note');
  }],
  ['draft is not copied to the next athlete', ctx => {
    fillDraft(ctx); const event = ctx.qa.organization().events[0];
    event.control.currentParticipantId = event.participants[3].id;
    ctx.qa.render('control');
    assert.equal(ctx.$('.score-value').value, '0');
    assert.equal(ctx.$('#scoreNote').value, '');
  }],
  ['draft is not copied to a repeat attempt', ctx => {
    fillDraft(ctx); ctx.qa.participant().attempt += 1; ctx.qa.render('control');
    assert.equal(ctx.$('.score-value').value, '0');
  }],
  ['refresh uses latest cloud organization instead of obsolete object', ctx => {
    const latest = JSON.parse(JSON.stringify(ctx.qa.organization()));
    latest.events[0].participants[2].name = 'Updated in cloud';
    ctx.qa.replace(latest); ctx.refresh();
    assert.match(ctx.$('.current-athlete h2').textContent, /Updated in cloud/);
  }],
  ['removed judge does not inherit another judge draft', ctx => {
    fillDraft(ctx); const judgeId = ctx.$('#scoreJudge').value;
    const event = ctx.qa.organization().events[0];
    event.judges.find(judge => judge.id === judgeId).active = false;
    ctx.qa.render('control');
    assert.notEqual(ctx.$('#scoreJudge').value, judgeId);
    assert.equal(ctx.$('.score-value').value, '0');
  }],
  ['saving after automatic refresh records exact draft and clears it', ctx => {
    fillDraft(ctx); const participant = ctx.qa.participant(); ctx.refresh();
    ctx.$('#scoreForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
    const score = ctx.qa.organization().events[0].scores.find(item => item.participantId === participant.id);
    assert.ok(score); assert.equal(score.penalty, 0.5); assert.equal(score.penaltyNote, 'QA penalty note');
    assert.ok(Object.values(score.values).every(value => value === 9.3));
    assert.equal(ctx.$('.score-value').value, '0');
  }],
  ['all judges unlock advancement and weighted result includes penalty', ctx => {
    const participant = ctx.qa.participant(); const event = ctx.qa.organization().events[0];
    for (const [index, judge] of event.judges.entries()) {
      ctx.$('#scoreJudge').value = judge.id;
      ctx.$('#scoreForm').querySelectorAll('.score-value').forEach(input => { input.value = '8'; });
      ctx.$('#scorePenalty').value = index === 0 ? '1' : '0';
      ctx.$('#scoreNote').value = index === 0 ? 'QA penalty' : '';
      ctx.$('#scoreForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
      assert.equal(ctx.$('[data-status="completed"]').disabled, index < 3);
    }
    assert.equal(ctx.qa.result(participant.id).total, 7.75);
    ctx.$('[data-status="completed"]').click();
    assert.notEqual(ctx.qa.participant().id, participant.id);
    assert.equal(participant.status, 'completed');
  }],
  ['judge station accepts one final vote and then locks the sheet', ctx => {
    const event = ctx.qa.organization().events[0]; const participant = ctx.qa.participant();
    const judge = event.judges[0]; ctx.qa.open('judge');
    ctx.$('#judgeLoginCode').value = judge.code;
    ctx.$('#judgeLoginForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
    ctx.$('#judgeScoreForm').querySelectorAll('.score-value').forEach(input => { input.value = '7.5'; });
    ctx.$('#judgeScoreForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(ctx.$('#judgeScoreForm'), null);
    assert.match(ctx.$('.judge-score-card').textContent, /Voto inviato e bloccato/);
    assert.equal(event.scores.filter(item => item.participantId === participant.id && item.judgeId === judge.id).length, 1);
  }],
  ['public vote stays separate and blocks a second vote on the device', ctx => {
    const event = ctx.qa.organization().events[0]; event.publicVoting.enabled = true;
    const scores = JSON.stringify(event.scores); ctx.qa.open('public');
    ctx.$('[data-rating="10"]').click();
    ctx.$('#publicVoteForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(event.publicVotes.length, 1); assert.equal(JSON.stringify(event.scores), scores);
    assert.equal(ctx.$('#publicVoteForm'), null); assert.ok(ctx.$('.vote-thanks'));
  }],
  ['withdrawal advances the queue without removing the athlete', ctx => {
    const participant = ctx.qa.participant(); const count = ctx.qa.organization().events[0].participants.length;
    ctx.$('[data-status="dns"]').click();
    assert.equal(participant.status, 'dns'); assert.notEqual(ctx.qa.participant().id, participant.id);
    assert.equal(ctx.qa.organization().events[0].participants.length, count);
  }],
  ['repeat archives previous votes instead of counting them in new attempt', ctx => {
    const event = ctx.qa.organization().events[0]; event.control.currentParticipantId = event.participants[0].id;
    event.control.mode = 'manual'; ctx.qa.render('control'); const participant = ctx.qa.participant();
    const previous = event.scores.filter(score => score.participantId === participant.id).length;
    assert.equal(previous, 4); ctx.$('.repeat-athlete').click();
    assert.equal(participant.attempt, 2); assert.equal(event.scores.filter(score => score.participantId === participant.id).length, 0);
    assert.ok(event.scoreHistory.length > 0);
  }],
  ['final starts a separate round while qualification votes stay archived', ctx => {
    const event = ctx.qa.organization().events[0]; const previousScores = JSON.stringify(event.scores);
    event.rounds.enabled = true; ctx.qa.open('eliminations'); ctx.$('.generate-final').click();
    assert.equal(event.control.round, 'final'); assert.equal(JSON.stringify(event.scores), previousScores);
    assert.equal(event.participants.filter(participant => participant.round === 'final').length, 2);
    assert.equal(ctx.qa.result(ctx.qa.participant().id).total, null);
  }],
  ['complete 12-athlete qualification and final preserve separate rankings', ctx => {
    const event = ctx.qa.organization().events[0];
    function finishRound() {
      for (let guard = 0; guard < 12; guard++) {
        const participant = ctx.qa.participant();
        if (participant.status !== 'completed') {
          ctx.$('[data-status="competing"]').click();
          for (const judge of event.judges) {
            ctx.$('#scoreJudge').value = judge.id;
            ctx.$('#scoreForm').querySelectorAll('.score-value').forEach(input => { input.value = '8'; });
            ctx.$('#scoreForm').dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
          }
          ctx.$('[data-status="completed"]').click();
        }
        if (event.participants.filter(item => item.round === event.control.round).every(item => item.status === 'completed')) return;
      }
      throw new Error('Round did not finish within 12 athletes');
    }
    finishRound(); assert.equal(event.scores.length, 48);
    const qualification = JSON.stringify(event.scores);
    event.rounds.enabled = true; ctx.qa.open('eliminations'); ctx.$('.generate-final').click();
    assert.equal(event.control.round, 'final'); assert.equal(JSON.stringify(event.scores), qualification);
    ctx.qa.open('control'); finishRound();
    assert.equal(event.scores.filter(score => score.round === 'qualification').length, 48);
    assert.equal(event.scores.filter(score => score.round === 'final').length, 48);
    ctx.qa.open('results'); assert.equal(ctx.w.document.querySelectorAll('.results-category').length || ctx.w.document.querySelectorAll('#moduleContent table').length, 6);
  }],
  ['post-test reset preserves roster, judges and configuration', ctx => {
    const event = ctx.qa.organization().events[0]; const ids = event.participants.map(item => item.id).join();
    const judges = event.judges.map(item => item.id).join(); const criteria = JSON.stringify(event.scoring);
    ctx.qa.open('overview'); ctx.$('.reset-post-test').click();
    assert.equal(event.scores.length, 0); assert.equal(event.publicVotes.length, 0);
    assert.equal(event.participants.map(item => item.id).join(), ids);
    assert.equal(event.judges.map(item => item.id).join(), judges); assert.equal(JSON.stringify(event.scoring), criteria);
    assert.ok(event.participants.every(item => item.status === 'registered' && item.attempt === 1));
  }]
];
let failures = 0;
for (const [name, run] of cases) {
  const ctx = boot();
  try { run(ctx); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.log(`FAIL ${name}: ${error.message}`); }
  finally { ctx.close(); }
}
if (failures) process.exitCode = 1;
