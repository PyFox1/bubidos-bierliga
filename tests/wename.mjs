// Braucht das Anlegen eines neuen Wochenendes einen Namen?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8971);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8971/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

await p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'}];
  state.we = []; state.aktivWe = null; vorwahl = null;
  ansicht = 'neu'; zeichnen();
});
await p.waitForTimeout(200);

console.log('\n== Ohne Namen ==');
await schritt('Der Knopf ist zunächst gesperrt', async () => {
  const disabled = await p.evaluate(() => document.querySelector('[data-tu="weStart"]').disabled);
  if(!disabled) throw new Error('nicht gesperrt');
  return 'gesperrt';
});

await schritt('Der Hinweis steht da', async () => {
  const t = await p.locator('#app').innerText();
  if(!/Ohne Namen kein Start/.test(t)) throw new Error('kein Hinweis: ' + t.slice(0,200));
});

await schritt('Ein Klick auf den gesperrten Knopf legt nichts an', async () => {
  await p.evaluate(() => tu.weStart());
  const n = await p.evaluate(() => state.we.length);
  if(n !== 0) throw new Error('trotzdem ' + n + ' Wochenende(n) angelegt');
  return 'nichts angelegt';
});

console.log('\n== Beim Tippen ==');
await schritt('Der Knopf schaltet frei, sobald ein Name steht', async () => {
  await p.fill('#weTitel', 'Nockherberg');
  const disabled = await p.evaluate(() => document.querySelector('[data-tu="weStart"]').disabled);
  if(disabled) throw new Error('immer noch gesperrt');
  return 'frei';
});

await schritt('Der Hinweis verschwindet live', async () => {
  const versteckt = await p.evaluate(() => document.getElementById('weTitelHinweis').hidden);
  if(!versteckt) throw new Error('steht noch da');
  return 'weg';
});

await schritt('Nur Leerzeichen zählen nicht als Name', async () => {
  await p.fill('#weTitel', '   ');
  const disabled = await p.evaluate(() => document.querySelector('[data-tu="weStart"]').disabled);
  if(!disabled) throw new Error('mit Leerzeichen freigeschaltet');
  await p.fill('#weTitel', 'Nockherberg');
  return 'wieder gesperrt bei Leerzeichen';
});

console.log('\n== Anlegen ==');
await schritt('Mit Namen legt „Los geht’s“ das Wochenende an', async () => {
  await p.evaluate(() => tu.weStart());
  const we = await p.evaluate(() => state.we[0]);
  if(!we || we.titel !== 'Nockherberg') throw new Error('Titel: ' + JSON.stringify(we));
  return 'Titel: ' + we.titel;
});

console.log('\n== Die Location bleibt frei ==');
await p.evaluate(() => {
  state.we = []; state.aktivWe = null; vorwahl = null;
  ansicht = 'neu'; zeichnen();
});
await p.waitForTimeout(200);
await schritt('Ohne Location-Namen wird trotzdem angelegt, mit Fallback', async () => {
  await p.fill('#weTitel', 'Sommerfest');
  await p.evaluate(() => tu.weStart());
  const we = await p.evaluate(() => state.we[0]);
  const ort = we.tage[0].orte[0].name;
  if(ort !== 'Location 1') throw new Error('Location heißt: ' + ort);
  return 'Location 1 als Fallback';
});

console.log('\n== Beim Nachbessern (Passt) bleibt es wie gehabt ==');
await p.evaluate(() => { vorwahl = {weId: state.we[0].id, ids:[1,2], titel:'', ort:'', datum:'2026-09-10', offen:false};
  ansicht = 'neu'; zeichnen(); });
await p.waitForTimeout(200);
await schritt('Der Passt-Knopf ist nicht an den Titel gekoppelt', async () => {
  const disabled = await p.evaluate(() => document.querySelector('[data-tu="weKopfPasst"]').disabled);
  if(disabled) throw new Error('gesperrt, obwohl Titel schon existiert');
  return 'frei';
});

console.log('\n== Jede data-tu-Aktion hat einen Handler ==');
await schritt('geprüft', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log('');
await b.close(); srv.close();
