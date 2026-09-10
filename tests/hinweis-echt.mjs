// Prüft die echte Umsetzung: Punkt am Zahnrad + leise Zeile im Archiv, nur solange
// die Namensfrage offen ist.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8993);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}, deviceScaleFactor:2});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8993/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufbau = (mitWe) => p.evaluate(mitWe => {
  localStorage.removeItem('bubidos-namensfrage');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:!mitWe, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'Augustiner',
      getraenke:{'1':[], '2':[], '3':[]}, log:[]}]}]}];
  state.aktivWe = mitWe ? 900 : null;
  state.aktivTag = mitWe ? 901 : null;
  state.aktivOrt = mitWe ? 11 : null;
  ansicht = null; pinLoeschen(); zeichnen();
}, mitWe);

console.log('\n== Archiv, Namensfrage offen ==');
await aufbau(false);
await p.waitForTimeout(250);

await schritt('Der Punkt sitzt am Zahnrad', async () => {
  const da = await p.evaluate(() => document.querySelector('[data-tu="geheEinst"]').classList.contains('hatpunkt'));
  if(!da) throw new Error('kein Punkt');
});

await schritt('Die leise Zeile steht über dem Start-Knopf', async () => {
  const t = await p.locator('#app').innerText();
  if(!/tipp hier, um deinen Namen festzulegen/.test(t)) throw new Error('keine Zeile: ' + t.slice(0,150));
  const reihenfolge = await p.evaluate(() => {
    const app = document.getElementById('app');
    const kinder = [...app.children].map(x => x.className);
    return kinder.slice(0,2).join(' · ');
  });
  return reihenfolge;
});

await schritt('Ein Tipp auf die Zeile springt in die Einstellungen', async () => {
  await p.evaluate(() => tu.geheEinst());
  await p.waitForTimeout(200);
  const m = await p.evaluate(() => ansicht);
  if(m !== 'einst') throw new Error('ansicht steht auf ' + m);
});

console.log('\n== Zählbildschirm, Namensfrage offen ==');
await aufbau(true);
await p.waitForTimeout(250);

await schritt('Der Punkt sitzt auch hier am Zahnrad', async () => {
  const da = await p.evaluate(() => document.querySelector('[data-tu="geheEinst"]').classList.contains('hatpunkt'));
  if(!da) throw new Error('kein Punkt');
});

await schritt('Die Zeile steht NICHT auf dem Zählbildschirm', async () => {
  const t = await p.locator('#app').innerText();
  if(/tipp hier, um deinen Namen festzulegen/.test(t)) throw new Error('die Zeile steht doch da');
});

console.log('\n== Nach Beantwortung ist beides weg ==');
await p.evaluate(() => { tu.ichBin({dataset:{name:'Korbi'}}); tu.geheZaehlen(); });
await p.waitForTimeout(250);

await schritt('Kein Punkt mehr am Zahnrad', async () => {
  const da = await p.evaluate(() => document.querySelector('[data-tu="geheEinst"]').classList.contains('hatpunkt'));
  if(da) throw new Error('Punkt steht noch da');
});

await p.evaluate(() => { ansicht = 'archiv'; zeichnen(); });
await p.waitForTimeout(200);
await schritt('Keine Zeile mehr im Archiv', async () => {
  const t = await p.locator('#app').innerText();
  if(/tipp hier, um deinen Namen festzulegen/.test(t)) throw new Error('die Zeile steht noch da');
});

console.log('\n== Jede data-tu-Aktion hat einen Handler ==');
await schritt('geprüft', async () => {
  await aufbau(false);
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

await p.screenshot({path:ORDNER + 'echt-archiv.png', fullPage:false});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
