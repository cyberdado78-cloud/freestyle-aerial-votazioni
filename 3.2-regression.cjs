const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const { JSDOM } = require('jsdom');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'migrations/20261023_trial_public_voting.sql'), 'utf8');

assert.match(html, /id="publicQr"/);
assert.match(html, /data-scoreflow-language/g);
assert.match(html, /scripts\/i18n\.js\?v=3\.3\.0/);
assert.match(app, /preferredLanguage/);
assert.match(app, /type: "manual-override"/);
assert.match(app, /originalScoreId: original\.id/);
assert.match(app, /replacementScoreId: score\.id/);
assert.match(app, /deviceId: publicDeviceId\(\)/);
assert.match(server, /deviceVotes\.has\(key\)/);
assert.match(server, /public-qr/);
assert.doesNotMatch(migration, /feature-public-voting/);
assert.match(migration, /scoreflow:limit-athletes/);
assert.match(migration, /scoreflow:limit-judges/);

const dom = new JSDOM('<!doctype html><html lang="it"><body><h1>Accedi alla tua società</h1><div id="dynamic"></div><select data-scoreflow-language><option value="it">Italiano</option><option value="en">English</option></select></body></html>', { url: 'https://scoreflow.dynamiczen.it/', runScripts: 'outside-only' });
dom.window.eval(fs.readFileSync(path.join(root, 'scripts/i18n.js'), 'utf8'));
dom.window.ScoreFlowI18n.setLanguage('en');
assert.equal(dom.window.document.querySelector('h1').textContent, 'Sign in to your organisation');
dom.window.document.querySelector('#dynamic').innerHTML = '<button>Genera QR</button>';
dom.window.ScoreFlowI18n.translateDOM(dom.window.document.querySelector('#dynamic'));
assert.equal(dom.window.document.querySelector('#dynamic button').textContent, 'Generate QR');
dom.window.ScoreFlowI18n.setLanguage('it');
assert.equal(dom.window.document.querySelector('h1').textContent, 'Accedi alla tua società');
dom.window.close();

(async () => {
  const svg = await QRCode.toString('https://scoreflow.dynamiczen.it/?tenant=demo&role=public&token=' + 'a'.repeat(64), { type: 'svg' });
  assert.match(svg, /<svg/);
  console.log('ScoreFlow 3.2 regression checks: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
