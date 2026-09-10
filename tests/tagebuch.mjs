import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8915);

const heute = new Date().toISOString().slice(0,10);
const log = (n) => Array.from({length:n}, (_,i) =>
  ({t:1789000000000+i*60000, gid:'gA', art:'einzel', key:'normal:05', pid:'1'}));

// Ein laufendes und ein längst abgeschlossenes Wochenende, beide mit Tagebuch.
const stand = () => ({
  spieler: [{id:1,name:'Korbi'},{id:2,name:'Fifu'}],
  we: [
    {id:800, titel:'München', datum:'2026-05-01', zu:true, dabei:[1,2],
      tage:[{id:801, label:'1. Tag', orte:[
        {id:802, name:'Hofbräu', getraenke:{'1':['normal:05','stark:05'],'2':['normal:05']},
         log: log(40)}]}]},
    {id:900, titel:'Berlin', datum:heute, zu:false, dabei:[1,2],
      tage:[{id:901, label:'1. Tag', orte:[
        {id:902, name:'Alte Bar', getraenke:{'1':['normal:05'],'2':[]}, log: log(12)}]}]}
  ],
  aktivWe:900, aktivTag:901, aktivOrt:902, einst:{k:40}, geraete:{}, stand:1000
});

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
let geschrieben = null;
await p.route('**/api.github.com/**', r => {
  const q = r.request();
  if(q.method() === 'PUT'){
    geschrieben = JSON.parse(Buffer.from(JSON.parse(q.postData()).content, 'base64').toString());
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({content:{sha:'s2'}})});
  }
  if(!q.url().includes('/contents/stand.json'))          // Ordner: nur der sha
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify([{path:'stand.json', sha:'s1', type:'file'}])});
  r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha:'s1',
      content: Buffer.from(JSON.stringify(stand())).toString('base64')})});
});
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8915/');
await p.waitForTimeout(900);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};
const weVon = (id) => p.evaluate((x) => {
  const w = state.we.find(y => y.id === x);
  const o = w.tage[0].orte[0];
  return {zu:w.zu, log:(o.log || []).length, getraenke:o.getraenke, name:o.name};
}, id);

console.log('\n== Altlast: beim Laden aufgeräumt ==');
await schritt('Das abgeschlossene Wochenende hat sein Tagebuch verloren', async () => {
  const w = await weVon(800);
  if(w.log !== 0) throw new Error(w.log + ' Einträge übrig');
  return 'Tagebuch weg';
});

await schritt('Seine Getränke sind unangetastet', async () => {
  const w = await weVon(800);
  if(w.getraenke['1'].length !== 2 || w.getraenke['2'].length !== 1)
    throw new Error(JSON.stringify(w.getraenke));
  if(w.name !== 'Hofbräu') throw new Error('Name: ' + w.name);
  return 'Korbi 2, Fifu 1, Location heißt weiter Hofbräu';
});

await schritt('Das laufende Wochenende behält seines', async () => {
  const w = await weVon(900);
  if(w.log !== 12) throw new Error(w.log + ' statt 12 Einträge');
  return '12 Einträge';
});

console.log('\n== Beim Abschließen ==');
await schritt('Abschließen räumt das Tagebuch des Wochenendes weg', async () => {
  await p.evaluate(() => tu.weSchliessen());
  const w = await weVon(900);
  if(!w.zu) throw new Error('nicht geschlossen');
  if(w.log !== 0) throw new Error(w.log + ' Einträge übrig');
  return 'zu, Tagebuch weg';
});

await schritt('Die Getränke des Abends bleiben vollständig', async () => {
  const w = await weVon(900);
  if(w.getraenke['1'].length !== 1) throw new Error(JSON.stringify(w.getraenke));
  // München: normal:05 (1,00) + stark:05 (1,40), Berlin: normal:05 (1,00) = 3,40
  const be = await p.evaluate(() => berechnen().beSumme['1']);
  if(Math.abs(be - 3.4) > 0.001) throw new Error(be + ' BE statt 3,40');
  return 'Korbis Gesamt-BE unverändert bei ' + be;
});

await schritt('So wird es auch geschrieben', async () => {
  await p.evaluate(() => sichern({sofort:true}));
  await p.waitForTimeout(400);
  if(!geschrieben) throw new Error('nichts geschrieben');
  const mit = geschrieben.we.filter(w => w.tage.some(t => t.orte.some(o => o.log && o.log.length)));
  if(mit.length) throw new Error('Tagebuch in: ' + mit.map(w => w.titel).join(', '));
  return 'keine Tagebücher mehr in der Datei';
});

console.log('\n== Der Abgleich holt nichts zurück ==');
await schritt('Ein Gerät, das den Abschluss nicht kennt, bringt das Tagebuch nicht wieder', async () => {
  const n = await p.evaluate(() => {
    const basis = JSON.parse(JSON.stringify(standDaten()));
    const meins = JSON.parse(JSON.stringify(standDaten()));      // hier: zu, ohne Tagebuch
    const fremd = JSON.parse(JSON.stringify(standDaten()));
    // Das andere Gerät hat den Abschluss noch nicht gesehen und führt Buch weiter
    const o = fremd.we.find(w => w.id === 900).tage[0].orte[0];
    o.log = [{t:1, gid:'gB', art:'einzel', key:'normal:05', pid:'2'}];
    const r = zusammenfuehren(basis, meins, fremd);
    const oo = r.we.find(w => w.id === 900).tage[0].orte[0];
    return (oo.log || []).length;
  });
  if(n !== 0) throw new Error(n + ' Einträge zurückgeholt');
  return 'bleibt leer';
});

await schritt('Beim laufenden Wochenende führt der Abgleich weiter zusammen', async () => {
  const n = await p.evaluate(() => {
    const basis = JSON.parse(JSON.stringify(standDaten()));
    basis.we.find(w => w.id === 900).zu = false;
    const meins = JSON.parse(JSON.stringify(basis));
    const fremd = JSON.parse(JSON.stringify(basis));
    meins.we.find(w => w.id === 900).tage[0].orte[0].log = [{t:1, gid:'gA', art:'einzel'}];
    fremd.we.find(w => w.id === 900).tage[0].orte[0].log = [{t:2, gid:'gB', art:'einzel'}];
    const r = zusammenfuehren(basis, meins, fremd);
    return r.we.find(w => w.id === 900).tage[0].orte[0].log.length;
  });
  if(n !== 2) throw new Error(n + ' statt 2 Einträge');
  return '2 Einträge von beiden Geräten';
});

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
