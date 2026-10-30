'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const Regulations = require('./scripts/regulation-import');
const Rules = require('./scripts/competition-rules');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const dom = new JSDOM(html, { url: 'https://scoreflow.dynamiczen.it/', runScripts: 'outside-only' });
const { window } = dom;
window.eval(fs.readFileSync('scripts/i18n.js', 'utf8'));

const firstLanguage = window.document.querySelector('#firstSetupLanguage');
assert(firstLanguage, 'first-run language selector is missing');
assert(firstLanguage.matches('[data-scoreflow-language]'));
assert.deepEqual([...firstLanguage.options].map(option => option.value), ['it', 'en', 'fr', 'es']);
assert(window.document.querySelector('#quickRulesFile'));
assert(window.document.querySelector('#setupRulesFile'));
assert(window.document.querySelector('#setupRulesText'));
assert(html.indexOf('firstSetupLanguage') < html.indexOf('data-demo-profile'));

window.ScoreFlowI18n.setLanguage('fr');
assert.equal(firstLanguage.value, 'fr');
assert.equal(window.document.documentElement.lang, 'fr');
assert.match(window.document.querySelector('.first-setup-language p').textContent, /configuration/i);
window.ScoreFlowI18n.setLanguage('es');
assert.equal(firstLanguage.value, 'es');

const event = {
  id: 'event-first-run',
  scoring: { criteria: [{ id: 'old', name: 'Old', min: 0, max: 10, weight: 1, decimals: 1 }], aggregation: 'average', minimumJudges: 3 },
  categories: [{ id: 'open', name: 'Open' }], disciplines: ['Danza'], participants: [], scores: [],
  rules: { text: '', file: null, reviewRequired: true }
};
const french = 'Disciplines: Danse\nCatégories: Open\nCritère: Technique; 0-10; poids 2\nSomme des critères\nMoyenne des juges\nJuges: 3\nPénalités 0,5-5';
const spanish = 'Disciplinas: Danza\nCategorías: Open\nCriterio: Técnica; 0-10; peso 2\nSuma de criterios\nPromedio de jueces\nJueces: 3\nPenalización 0,5-5';
for (const text of [french, spanish]) {
  const proposal = Regulations.propose(text, event);
  assert.equal(proposal.criteria.length, 1);
  assert.equal(proposal.criteriaMode, 'sum');
  assert.equal(proposal.aggregation, 'average');
  assert.equal(proposal.minimumJudges, 3);
  assert.equal(proposal.penaltyMin, 0.5);
}

assert.match(Rules.scoreErrors(event, { values: { old: 8 }, penalty: 0 })[0], /Approva/);
assert.match(Rules.issues(event, {}, '2026-10-30')[0], /attesa/);
assert.throws(() => Rules.validateState({ events: [{ ...event, scores: [] }] }, { events: [{ ...event, scores: [{ id: 'score-1', values: { old: 8 } }] }] }), /Approva/);

const proposal = Regulations.propose(spanish, event);
const approved = Regulations.apply({ ...event, rules: { ...event.rules, text: spanish } }, proposal, { text: spanish, confirmed: true, now: '2026-10-30T12:00:00Z' });
assert.equal(approved.rules.reviewRequired, false);
assert.equal(approved.rules.activeVersion, 1);
assert.equal(approved.language, undefined);

assert.match(app, /selectedRulesFile/);
assert.match(app, /rules\.reviewRequired=true/);
assert.match(app, /const initialModule = roleModules\[role\] \|\| \(event\.rules\?\.reviewRequired \? "event" : "overview"\)/);

dom.window.close();
console.log('ScoreFlow 3.4 first-run language and regulation-led setup: OK');
