import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

/* Rauschen aus dem Prüfstand selbst: abgefangene Netzaufrufe, die absichtlich
   provozierten Fehlerantworten und die nicht erreichbaren Google Fonts. Echte
   Ausnahmen kommen als pageerror oder als „Zeichnen fehlgeschlagen“ durch. */
const RAUSCHEN = /fonts\.googleapis|gstatic|net::ERR_|status of (404|409|500)/;

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html'}); s.end(html);
}).listen(8899);

const heute = new Date().toISOString().slice(0,10);
const stand = {
  spieler: [{id:'1',name:'Korbi'},{id:'2',name:'Fifu'},{id:'3',name:'Sperry'}],
  we: [{
    id:'we1', name:'Testrunde', start:heute, offen:true,
    tage:[{id:'t1', datum:heute, orte:[{id:'o1', name:'Wirtshaus',
      getraenke:{'1':['normal:05','normal:05'],'2':['normal:05'],'3':[]}}]}]
  }],
  aktivWe:'we1', aktivTag:'t1', aktivOrt:'o1', einst:{kiSchluessel:'sk-test', kiModell:'claude-opus-5'}
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage();
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
/* Getrennt gesammelt statt weggeworfen: Der Abbruch-Test weiter unten weist die
   abgebrochene Verbindung gerade an dieser Meldung nach. */
const geraeusche = [];
p.on('console', m => {
  if(m.type() !== 'error') return;
  (RAUSCHEN.test(m.text()) ? geraeusche : fehler).push('CONSOLE: ' + m.text());
});

let kiAufrufe = 0, kiAbgebrochen = false;
await p.route('**/api.github.com/**', r => r.fulfill({status:200,
  contentType:'application/json',
  body: JSON.stringify({sha:'abc', content: Buffer.from(JSON.stringify(stand)).toString('base64')})}));
// Anthropic-Aufruf hängt absichtlich – so lässt sich der Abbruch prüfen.
await p.route('**/api.anthropic.com/**', async r => {
  kiAufrufe++;
  try { await new Promise(res => setTimeout(res, 60000)); await r.fulfill({status:200, body:'{}'}); }
  catch(e){ kiAbgebrochen = true; }
});

await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8899/');
await p.waitForTimeout(1200);

const schritt = async (name, fn) => {
  try { await fn(); console.log('  OK   ' + name); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

console.log('\n== Zählbildschirm ==');
await schritt('App startet ohne Fehlerbildschirm', async () => {
  const t = await p.locator('body').innerText();
  if(/Fehler|kaputt/i.test(t.slice(0,200))) throw new Error(t.slice(0,200));
});

await schritt('Foto-Blende öffnet', async () => {
  await p.evaluate(() => tu.fotoStart());
  await p.waitForSelector('.blende', {timeout:3000});
});

console.log('\n== Abbruch während der Zählung ==');
await schritt('Foto auslösen führt in die Zählung', async () => {
  const jpg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
    'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
    'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
    'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEB' +
    'AAA/APn+iiigD//Z', 'base64');
  await p.setInputFiles('#kamera', {name:'deckel.jpg', mimeType:'image/jpeg', buffer:jpg});
  await p.waitForFunction(() => foto && foto.phase === 'laedt', {timeout:5000});
});

await schritt('Kreuz oben rechts ist da', async () => {
  const n = await p.locator('.kreuz[data-tu="fotoAbbrechen"]').count();
  if(n !== 1) throw new Error('Kreuze gefunden: ' + n);
});

await schritt('Kreuz bricht ab und führt zurück zum Auslöser', async () => {
  await p.locator('.kreuz[data-tu="fotoAbbrechen"]').click();
  await p.waitForFunction(() => foto && foto.phase === 'start', {timeout:3000});
});

await schritt('Abbruch zeigt keinen Fehlerbildschirm', async () => {
  await p.waitForTimeout(700);
  const ph = await p.evaluate(() => foto && foto.phase);
  if(ph !== 'start') throw new Error('Phase ist ' + ph);
});

await schritt('Die Anfrage wurde wirklich abgebrochen', async () => {
  const reset = [...fehler, ...geraeusche]
    .some(f => /ERR_CONNECTION_RESET|ERR_ABORTED|net::/.test(f));
  if(!reset && !kiAbgebrochen) throw new Error('die Verbindung lief weiter');
});

console.log('\n== Dazu / Ersetzen ==');
await schritt('Ab Werk steht die Wahl auf „kommt dazu“', async () => {
  await p.evaluate(() => tu.fotoStart());
  const e = await p.evaluate(() => foto.ersetzen);
  if(e !== false) throw new Error('ersetzen ist ' + e);
});

await schritt('Ergebnis zeigt Erklärung und beide Knöpfe', async () => {
  await p.evaluate(() => {
    foto.phase = 'ergebnis';
    foto.treffer = [{ziel:'1', z:{'normal:05':3}}];
    zeichnen();
  });
  const t = (await p.locator('.blende').innerText()).toLowerCase();
  for(const s of ['was mit dem bisherigen geschieht','kommt dazu','ersetzt den stand','deckel sammelt den ganzen abend'])
    if(!t.includes(s)) throw new Error('fehlt: ' + s);
});

await schritt('Ersetzen warnt vor dem, was wegfiele', async () => {
  await p.evaluate(() => { tu.fotoArt({dataset:{m:'ersetzen'}}); });
  const t = await p.locator('.blende').innerText();
  if(!/Hier stehen schon 2 Getränke/.test(t)) throw new Error('keine Warnung: ' + t.slice(-300));
});

await schritt('Zurück auf „dazu“ nimmt die Warnung weg', async () => {
  await p.evaluate(() => { tu.fotoArt({dataset:{m:'dazu'}}); });
  const t = await p.locator('.blende').innerText();
  if(/Hier stehen schon/.test(t)) throw new Error('Warnung blieb stehen');
});

console.log('\nKI-Aufrufe: ' + kiAufrufe);
console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Konsolen-/Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
