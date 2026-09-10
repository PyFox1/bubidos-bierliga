// Runde für alle, dann stößt jemand dazu: sein erstes Bier darf nicht ausgebremst werden.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8995);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8995/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Kammy (4) ist im Wochenende, steht aber noch nicht an der Location – er ist der,
   der später dazustößt. */
const aufbau = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Kammy'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'Augustiner',
      getraenke:{'1':[], '2':[], '3':[]}, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  ansicht = null; vorwahl = null; stapel = []; letzteRunde = null; nachfrage = null;
  pinLoeschen(); zeichnen();
});

const glaeser = id => p.evaluate(id => (aktuell().ort.getraenke[id] || []).length, id);

console.log('\n══ Der gemeldete Fall ══');
await aufbau();
await p.waitForTimeout(250);

await schritt('Runde für alle drei', async () => {
  await p.evaluate(() => tu.runde());
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n);
  return 'Korbi/Fifu/Sperry je 1';
});

await schritt('Kammy stößt dazu', async () => {
  await p.evaluate(() => tu.ortRein({dataset:{id:'4'}}));
  const n = await glaeser('4');
  if(n !== 0) throw new Error('Kammy hat schon ' + n);
  return 'steht mit 0 da';
});

await schritt('Sein erstes Bier wird sofort eingetragen, nicht nachgefragt', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'4'}}));
  const n = await glaeser('4');
  const f = await p.evaluate(() => nachfrage);
  if(n !== 1) throw new Error('Kammy hat ' + n + ' – die fremde Runde hat ihn ausgebremst');
  if(f !== null) throw new Error('es wurde gefragt: ' + JSON.stringify(f));
  return 'trägt ein';
});

await schritt('Sein zweites Bier fragt dann sehr wohl nach', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'4'}}));
  const n = await glaeser('4');
  if(n !== 1) throw new Error('Kammy hat ' + n + ' – ohne Frage durchgelassen');
  const f = await p.evaluate(() => String(nachfrage));
  if(f !== '4') throw new Error('nachfrage steht auf ' + f);
  return 'fragt';
});

console.log('\n══ Für die, die dabeistanden, bleibt es beim Alten ══');
await aufbau();
await p.waitForTimeout(200);

await schritt('Kurz nach der Runde fragt das + bei einem Beteiligten', async () => {
  await p.evaluate(() => tu.runde());
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' – die Runde zählte nicht mehr');
  const f = await p.evaluate(() => String(nachfrage));
  if(f !== '1') throw new Error('nachfrage steht auf ' + f);
  return 'fragt weiterhin';
});

await schritt('Die Runde merkt sich, wen sie betraf', async () => {
  const e = await p.evaluate(() => {
    const l = aktuell().ort.log.filter(x => x.art === 'runde');
    return l[l.length-1];
  });
  if(!e.ids || e.ids.length !== 3) throw new Error('ids: ' + JSON.stringify(e.ids));
  return 'ids: ' + e.ids.join(', ');
});

console.log('\n══ Eine Runde von einer älteren Fassung (ohne ids) ══');
await aufbau();
await p.waitForTimeout(200);

await schritt('Ohne ids bleibt es beim bisherigen Verhalten', async () => {
  await p.evaluate(() => {
    const {ort} = aktuell();
    ort.getraenke['4'] = [];
    ort.log = [{t:Date.now(), gid:'gAlt', art:'runde', key:'normal:05', n:3}];
    zeichnen();
  });
  await p.evaluate(() => tu.strich({dataset:{id:'4'}}));
  const f = await p.evaluate(() => String(nachfrage));
  if(f !== '4') throw new Error('nachfrage steht auf ' + f);
  return 'fragt, wie vorher';
});

console.log('\n══ Zurückgenommene Runde ══');
await aufbau();
await p.waitForTimeout(200);

await schritt('Nach dem Zurücknehmen fragt es auch bei Beteiligten nicht', async () => {
  await p.evaluate(() => { tu.runde(); tu.rundeZurueck(); tu.strich({dataset:{id:'1'}}); });
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n);
  return 'trägt ein';
});

console.log('\n══ Jede data-tu-Aktion hat einen Handler ══');
await schritt('geprüft', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
