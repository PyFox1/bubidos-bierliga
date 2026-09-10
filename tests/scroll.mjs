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
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8903);

const heute = new Date().toISOString().slice(0,10);
const stand = {
  spieler: [{id:'1',name:'Korbi'},{id:'2',name:'Fifu'},{id:'3',name:'Sperry'},
            {id:'4',name:'Gerry'},{id:'5',name:'Kammy'}],
  we: [{
    id:'we1', titel:'Berlin', start:heute, offen:true, dabei:['1','2','3','4','5'],
    tage:[{id:'t1', datum:heute, label:'1. Tag', orte:[{id:'o1', name:'Wirtshaus',
      getraenke:{'1':['normal:05'],'2':['normal:05'],'3':[],'4':[],'5':[]}}]}]
  }],
  aktivWe:'we1', aktivTag:'t1', aktivOrt:'o1', einst:{}
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:780}, deviceScaleFactor:2});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
p.on('console', m => { if(m.type() === 'error' && !RAUSCHEN.test(m.text())) fehler.push('CONSOLE: ' + m.text()); });

await p.route('**/api.github.com/**', r => {
  if(!r.request().url().includes('/contents/stand.json'))
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify([{path:'stand.json', sha:'abc', type:'file'}])});
  r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha:'abc', content: Buffer.from(JSON.stringify(stand)).toString('base64')})});
});
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8903/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(900);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

// Ein Ergebnis mit genug Zeilen, damit das Blatt wirklich scrollt.
const ergebnisAufbauen = () => p.evaluate(() => {
  tu.fotoStart();
  foto.phase = 'ergebnis';
  foto.sicherheit = 'mittel';
  foto.treffer = ['1','2','3','4','5'].map(id => ({name:'Zeile'+id, ziel:id,
    z:{'normal:05':3, 'stark:05':1}}));
  zeichnen();
});

console.log('\n== Scrollhöhe im Ergebnis-Blatt ==');
await ergebnisAufbauen();

await schritt('Das Blatt ist lang genug zum Scrollen', async () => {
  const m = await p.evaluate(() => { const b = document.querySelector('.blende .blatt');
    return {sicht:b.clientHeight, ganz:b.scrollHeight}; });
  if(m.ganz <= m.sicht + 40) throw new Error('zu kurz: ' + JSON.stringify(m));
  return m.ganz + 'px in ' + m.sicht + 'px';
});

await schritt('Ganz nach unten scrollen', async () => {
  const y = await p.evaluate(() => { const b = document.querySelector('.blende .blatt');
    b.scrollTop = b.scrollHeight; return b.scrollTop; });
  if(y < 50) throw new Error('kaum gescrollt: ' + y);
  return 'scrollTop ' + y;
});

await schritt('Stärke auf „stark“ umstellen hält die Höhe', async () => {
  const vor = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  await p.evaluate(() => tu.nkS({dataset:{k:'stark'}}));
  const nach = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(Math.abs(nach - vor) > 2) throw new Error('vorher ' + vor + ', nachher ' + nach);
  return vor + ' → ' + nach;
});

await schritt('Ein Getränk mehr hält die Höhe', async () => {
  const vor = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  await p.evaluate(() => tu.fotoPlus({dataset:{i:'4', k:'normal:05'}}));
  const nach = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(Math.abs(nach - vor) > 2) throw new Error('vorher ' + vor + ', nachher ' + nach);
  return vor + ' → ' + nach;
});

await schritt('Ein Getränk weniger hält die Höhe', async () => {
  const vor = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  await p.evaluate(() => tu.fotoMinus({dataset:{i:'4', k:'normal:05'}}));
  const nach = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(Math.abs(nach - vor) > 2) throw new Error('vorher ' + vor + ', nachher ' + nach);
  return vor + ' → ' + nach;
});

await schritt('Dazu/Ersetzen umstellen hält die Höhe', async () => {
  const vor = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  await p.evaluate(() => tu.fotoArt({dataset:{m:'ersetzen'}}));
  const nach = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(Math.abs(nach - vor) > 2) throw new Error('vorher ' + vor + ', nachher ' + nach);
  return vor + ' → ' + nach;
});

console.log('\n== Wo die Höhe zu Recht auf null geht ==');
await schritt('Ein anderes Blatt fängt oben an', async () => {
  await p.evaluate(() => { foto = null; erklaer = 'orden'; zeichnen(); });
  const y = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(y !== 0) throw new Error('scrollTop ' + y);
  return 'scrollTop 0';
});

await schritt('Ein Phasenwechsel fängt oben an', async () => {
  await p.evaluate(() => { erklaer = null; zeichnen(); });
  await ergebnisAufbauen();
  await p.evaluate(() => { document.querySelector('.blende .blatt').scrollTop = 400; });
  await p.evaluate(() => { foto.phase = 'start'; zeichnen(); });
  const y = await p.evaluate(() => document.querySelector('.blende .blatt').scrollTop);
  if(y !== 0) throw new Error('scrollTop ' + y);
  return 'scrollTop 0';
});

console.log('\n== data-tu ohne Handler ==');
await schritt('Jede data-tu-Aktion hat einen Handler', async () => {
  const offen = await p.evaluate(() => {
    const namen = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => namen.add(e.dataset.tu));
    return [...namen].filter(n => typeof tu[n] !== 'function');
  });
  if(offen.length) throw new Error('ohne Handler: ' + offen.join(', '));
});

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Konsolen-/Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
