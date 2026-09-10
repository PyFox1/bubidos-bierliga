import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const AUS = ORDNER + '';
const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8905);

// 2026-09-11 ist ein Freitag – damit sind Tag 1/2/3 = Fr/Sa/So.
const leute = (ids) => { const g = {}; ids.forEach(i => g[i] = []); return g; };
const stand = (ueber) => ({
  spieler: [{id:'1',name:'Korbi'},{id:'2',name:'Fifu'},{id:'3',name:'Sperry'}],
  we: [Object.assign({
    id:'we1', titel:'Berlin', datum:'2026-09-11', zu:false, dabei:['1','2','3'],
    tage:[{id:'t1', label:'1. Tag', orte:[
      {id:'o1', name:'Location 1', getraenke:{'1':['normal:05'],'2':[],'3':[]}},
      {id:'o2', name:'Location 2', getraenke:{'1':['normal:05','normal:05'],'2':['normal:05'],'3':[]}}]},
      {id:'t2', label:'2. Tag', orte:[{id:'o3', name:'Location 1', getraenke:leute(['1','2','3'])}]},
      {id:'t3', label:'3. Tag', orte:[{id:'o4', name:'Location 1', getraenke:leute(['1','2','3'])}]}]
  }, ueber)],
  aktivWe:'we1', aktivTag:'t1', aktivOrt:'o2', einst:{}
});

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const seite = async (breite, daten) => {
  const p = await b.newPage({viewport:{width:breite, height:820}, deviceScaleFactor:2});
  await p.route('**/api.github.com/**', r => {
    if(!r.request().url().includes('/contents/stand.json'))
      return r.fulfill({status:200, contentType:'application/json',
        body: JSON.stringify([{path:'stand.json', sha:'abc', type:'file'}])});
    r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({sha:'abc', content: Buffer.from(JSON.stringify(daten)).toString('base64')})});
  });
  await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
  await p.goto('http://localhost:8905/');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  return p;
};
const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

console.log('\n== Wochentag aus Startdatum plus Tagesnummer ==');
const p = await seite(390, stand());

await schritt('Freitag, Samstag, Sonntag für Tag 1 bis 3', async () => {
  const r = await p.evaluate(() => {
    const we = state.we[0];
    return we.tage.map(t => tagKurz(we, t));
  });
  const soll = ['Fr','Sa','So'];
  if(JSON.stringify(r) !== JSON.stringify(soll))
    throw new Error('bekommen ' + JSON.stringify(r) + ', erwartet ' + JSON.stringify(soll));
  return r.join(', ');
});

await schritt('Ohne Datum bleibt es beim Label', async () => {
  const r = await p.evaluate(() => {
    const we = JSON.parse(JSON.stringify(state.we[0])); delete we.datum;
    return tagKurz(we, we.tage[1]);
  });
  if(r !== '2. Tag') throw new Error('bekommen "' + r + '"');
  return r;
});

await schritt('Unbrauchbares Datum bleibt beim Label', async () => {
  const r = await p.evaluate(() => {
    const we = JSON.parse(JSON.stringify(state.we[0])); we.datum = 'kaputt';
    return tagKurz(we, we.tage[0]);
  });
  if(r !== '1. Tag') throw new Error('bekommen "' + r + '"');
  return r;
});

console.log('\n== Die Kopfzeile selbst ==');
await schritt('Groß steht die Location, klein der Rest', async () => {
  const t = await p.evaluate(() => document.querySelector('.kz-titel').textContent);
  const w = await p.evaluate(() => document.querySelector('.kz-wo').textContent);
  if(t !== 'Location 2') throw new Error('groß: "' + t + '"');
  if(w !== 'Berlin · Fr · 2/2') throw new Error('klein: "' + w + '"');
  return t + '  |  ' + w;
});

await schritt('Nichts wird abgeschnitten bei 390 px', async () => {
  const m = await p.evaluate(() => {
    const f = (s) => { const e = document.querySelector(s);
      return {knapp: e.scrollWidth > e.clientWidth + 1, noetig: Math.round(e.scrollWidth), da: Math.round(e.clientWidth)}; };
    return {gross: f('.kz-titel'), klein: f('.kz-wo')};
  });
  if(m.gross.knapp || m.klein.knapp) throw new Error(JSON.stringify(m));
  return 'klein braucht ' + m.klein.noetig + ' von ' + m.klein.da + ' px';
});
await p.screenshot({path: AUS + 'neu-390.png', clip:{x:0, y:0, width:390, height:150}});
await p.close();

console.log('\n== Der enge Fall: 320 px und langer Name ==');
const eng = stand();
eng.we[0].titel = 'München';
eng.we[0].tage[0].orte[1].name = 'Zum Goldenen Hirschen';
const p2 = await seite(320, eng);
await schritt('Der lange Ortsname bricht ab – das darf er', async () => {
  const g = await p2.evaluate(() => { const e = document.querySelector('.kz-titel');
    return e.scrollWidth > e.clientWidth + 1; });
  if(!g) throw new Error('erwartet war ein Abbruch beim Ortsnamen');
  return 'wie beabsichtigt';
});
await schritt('Das ⌄ bleibt trotzdem sichtbar', async () => {
  const m = await p2.evaluate(() => {
    const e = document.querySelector('.kz-pfeil');
    const r = e.getBoundingClientRect();
    const k = document.querySelector('.kopf-ort').getBoundingClientRect();
    return {text: e.textContent, breit: Math.round(r.width),
            drin: r.right <= k.right + 1 && r.width > 4};
  });
  if(!m.drin) throw new Error(JSON.stringify(m));
  return m.text + ', ' + m.breit + ' px breit';
});
await p2.screenshot({path: AUS + 'neu-320.png', clip:{x:0, y:0, width:320, height:150}});
await p2.close();

console.log('\n== data-tu ohne Handler ==');
const p3 = await seite(390, stand());
await schritt('Jede data-tu-Aktion hat einen Handler', async () => {
  const offen = await p3.evaluate(() => {
    const n = new Set(); document.querySelectorAll('[data-tu]').forEach(e => n.add(e.dataset.tu));
    return [...n].filter(x => typeof tu[x] !== 'function');
  });
  if(offen.length) throw new Error('ohne Handler: ' + offen.join(', '));
});
await p3.close();

await b.close(); srv.close();
