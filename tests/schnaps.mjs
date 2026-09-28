// Longdrink und Kurzer (G58): wie sie zählen, wie man sie einträgt, die Runde Kurze –
// und was an ihnen hängt: Abtrünnig, Kurzer Prozess, der Kurze in der Arschloch-Strecke.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8963);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => {
  localStorage.setItem('bubidos-token', 'github_pat_test');
  const echt = Date.now.bind(Date);
  window.__versatz = 0;
  Date.now = () => echt() + window.__versatz;
});
await p.goto('http://localhost:8963/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};
const spulen = min => p.evaluate(m => { window.__versatz += m * 60000; zeichnen(); }, min);
const marken = art => p.evaluate(a => JSON.parse(JSON.stringify(
  (state.we[0].marken || []).filter(m => m.art === a))), art);
const weg = () => p.evaluate(() => { let n = 0; while(offeneUrkunde() && n++ < 40) tu.urkundeWeg(); });

const aufbau = g => p.evaluate(g => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Gerry'}];
  state.einst = {k:40};
  state.we = [{id:900, titel:'Berlin', datum:'2026-09-26', zu:false, dabei:[1,2,3,4], marken:[], tage:[
    {id:901, label:'1. Tag', orte:[{id:1, name:'Hofbräu', getraenke:JSON.parse(JSON.stringify(g)), log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.wahlS = 'normal'; state.wahlG = '05'; state.wahlOffen = false;
  ansicht = null; blatt = null; nachfrage = null; letzteRunde = null; neuKombi = {s:'normal', g:'05'};
  localStorage.removeItem('bubidos-urkunden');
  zeichnen();
}, g);
const h = n => Array(n).fill('normal:05');

console.log('\n== Wie sie zählen ==');
await schritt('Longdrink 0,64 BE, Kurzer 0,32 BE – gerechnet wird der Schnaps', async () => {
  const r = await p.evaluate(() => ({l:beVon('lang:04'), k:beVon('kurz:02'),
    ll:literVon('lang:04'), kl:literVon('kurz:02'), n:[nameVon('lang:04'), nameVon('kurz:02')]}));
  if(Math.abs(r.l - 0.64) > 1e-9 || Math.abs(r.k - 0.32) > 1e-9) throw new Error(r.l + ' / ' + r.k);
  if(r.ll !== 0.3 || r.kl !== 0.02) throw new Error('Liter ' + r.ll + ' / ' + r.kl);
  if(r.n.join() !== 'Longdrink,Kurzer') throw new Error(r.n.join());
});
await schritt('Sie stehen in der Wertung wie jedes andere Getränk', async () => {
  await aufbau({'1':['lang:04','kurz:02','kurz:02'], '2':h(1)});
  const r = await p.evaluate(() => { const t = berechnen().log[0].tagLog[0];
    return {be:t.erg['1'].be, anzahl:t.erg['1'].anzahl, lang:t.erg['1'].sorten['lang:04']}; });
  if(Math.abs(r.be - 1.28) > 1e-9) throw new Error('BE ' + r.be);
  if(r.anzahl !== 3 || r.lang !== 1) throw new Error(JSON.stringify(r));
  return '1,28 BE aus drei Gläsern';
});

console.log('\n== Eintragen ==');
await schritt('Die Pille bietet sie unter „Kein Bier“, ohne Größe', async () => {
  await aufbau({'1':[], '2':[]});
  await p.evaluate(() => { tu.wahlAuf(); });
  await p.click('.wahl-auf [data-tu="wahlS"][data-k="kurz"]');
  const r = await p.evaluate(() => ({key:wahlKey(), text:document.querySelector('.wahl').textContent,
    groesse:!!document.querySelector('.wahl-auf [data-tu="wahlG"]')}));
  if(r.key !== 'kurz:02') throw new Error(r.key);
  if(!/Kein Bier/.test(r.text) || !/Kurzer/.test(r.text)) throw new Error(r.text);
  if(r.groesse) throw new Error('die Größe steht noch da');
  await p.click('.wahl-auf [data-tu="wahlS"][data-k="normal"]');
  const k = await p.evaluate(() => wahlKey());
  if(k !== 'normal:05') throw new Error('zurück zum Bier: ' + k);
});
await schritt('Die Sammel-Eingabe kann sie auch', async () => {
  await p.evaluate(() => { tu.blattAuf({dataset:{id:'1'}}); });
  await p.click('.blende [data-tu="nkS"][data-k="lang"]');
  await p.click('.blende [data-tu="blattHinzu"]');
  await p.click('.blende [data-tu="blattSpeichern"]');
  const g = await p.evaluate(() => state.we[0].tage[0].orte[0].getraenke['1']);
  if(g.join() !== 'lang:04') throw new Error(g.join());
});

console.log('\n== Runde Kurze ==');
await aufbau({'1':h(2), '2':h(2), '3':h(2)});
await schritt('Ein eigener Knopf gibt jedem am Tisch einen Kurzen – die Pille bleibt auf Halbe', async () => {
  const k = await p.$('[data-tu="rundeKurze"]');
  if(!k) throw new Error('kein Knopf');
  await p.click('[data-tu="rundeKurze"]');
  const r = await p.evaluate(() => ({g:state.we[0].tage[0].orte[0].getraenke, pille:wahlKey()}));
  if(Object.values(r.g).some(x => x[x.length - 1] !== 'kurz:02')) throw new Error(JSON.stringify(r.g));
  if(r.pille !== 'normal:05') throw new Error('Pille: ' + r.pille);
});
await schritt('Wer heim ist, bekommt keinen', async () => {
  await p.evaluate(() => { state.we[0].tage[0].heim = {'3': Date.now()}; });
  await spulen(4); await weg();
  await p.click('[data-tu="rundeKurze"]');
  const g = await p.evaluate(() => state.we[0].tage[0].orte[0].getraenke['3']);
  if(g.filter(x => x === 'kurz:02').length !== 1) throw new Error(g.join());
  await p.evaluate(() => { state.we[0].tage[0].heim = {}; });
});
await schritt('Gleich danach eine Runde Bier fragt nicht nach', async () => {
  await weg();
  await p.evaluate(() => { nachfrage = null; tu.runde(); });
  const r = await p.evaluate(() => ({nachfrage, n:state.we[0].tage[0].orte[0].getraenke['1'].length}));
  if(r.nachfrage) throw new Error('fragt: ' + r.nachfrage);
  return 'Kurze und Bier sind zwei Sorten Runde';
});
await schritt('Eine zweite Runde Kurze binnen Minuten fragt nach', async () => {
  await weg();
  const vor = await p.evaluate(() => state.we[0].tage[0].orte[0].getraenke['1'].length);
  await p.evaluate(() => { nachfrage = null; tu.rundeKurze(); });
  const r = await p.evaluate(() => ({nachfrage, n:state.we[0].tage[0].orte[0].getraenke['1'].length,
    knopf:document.querySelector('[data-tu="rundeKurze"]').textContent}));
  if(r.nachfrage !== 'rundeKurze' || r.n !== vor) throw new Error(JSON.stringify(r));
  if(!/schon Kurze/.test(r.knopf)) throw new Error(r.knopf);
});
await schritt('„Runde zurücknehmen“ nimmt auch die Kurzen zurück', async () => {
  await aufbau({'1':h(2), '2':h(2)});
  await p.evaluate(() => { tu.rundeKurze(); tu.rundeZurueck(); });
  const g = await p.evaluate(() => state.we[0].tage[0].orte[0].getraenke);
  if(Object.values(g).some(x => x.includes('kurz:02'))) throw new Error(JSON.stringify(g));
});

console.log('\n== Kurzer Prozess ==');
await schritt('Die erste Runde Kurze des Abends ist eine Meldung für den Tisch', async () => {
  await aufbau({'1':h(2), '2':h(2), '3':h(2)});
  await p.evaluate(() => tu.rundeKurze());
  const m = await marken('kurz');
  if(m.length !== 1 || m[0].pids.length !== 3) throw new Error(JSON.stringify(m.map(x => x.pids)));
  const o = await p.evaluate(() => { const u = offeneUrkunde(); return u ? ansichtUrkunde(u) : ''; });
  if(!/Kurzer Prozess/.test(o) || !/3× Kurzer/.test(o)) throw new Error('nicht offen');
  await weg();
});
await schritt('Eine zweite Runde Kurze meldet nichts mehr', async () => {
  await spulen(10); await p.evaluate(() => { nachfrage = null; tu.rundeKurze(); });
  const m = await marken('kurz');
  if(m.length !== 1) throw new Error(m.length);
});
await schritt('Einzeln eingetragene Kurze sind keine Runde', async () => {
  await aufbau({'1':h(2), '2':h(2)});
  await p.evaluate(() => { state.wahlS = 'kurz'; tu.strich({dataset:{id:'1'}}); state.wahlS = 'normal'; });
  const m = await marken('kurz');
  if(m.length) throw new Error('es kam eine');
});
await schritt('Zurückgenommen ist er wieder weg', async () => {
  await aufbau({'1':h(2), '2':h(2)});
  await p.evaluate(() => { tu.rundeKurze(); tu.rundeZurueck(); });
  const m = await marken('kurz');
  if(m.length) throw new Error('bleibt');
});

console.log('\n== Abtrünnig ==');
await schritt('Fünf Bier, dann der erste Longdrink – nach dem Fenster geht sie auf', async () => {
  await aufbau({'1':h(5), '2':h(2)});
  await p.evaluate(() => { state.wahlS = 'lang'; tu.strich({dataset:{id:'1'}}); state.wahlS = 'normal'; });
  const m = await marken('abtruennig');
  if(m.length !== 1 || m[0].pid !== '1' || m[0].bier !== 5) throw new Error(JSON.stringify(m));
  await spulen(2.2);
  const o = await p.evaluate(() => { const u = offeneUrkunde(); return u ? u.m.art + '|' + ansichtUrkunde(u) : ''; });
  if(!o.startsWith('abtruennig') || !/5 Bier, dann Longdrink/.test(o)) throw new Error(o.slice(0, 80));
  await weg();
});
await schritt('Vier Bier reichen nicht', async () => {
  await aufbau({'1':[...h(4), 'lang:04'], '2':h(2)});
  await p.evaluate(() => markenPruefen());
  if((await marken('abtruennig')).length) throw new Error('kam doch');
});
await schritt('Kurze dazwischen stören nicht, zählen aber auch nicht als Bier', async () => {
  const r = await p.evaluate(() => ({
    mit:bierVorLongdrink({orte:[{getraenke:{'1':['normal:05','kurz:02','normal:05','normal:05','kurz:02',
      'normal:05','normal:05','lang:04']}}]}, '1'),
    ohne:bierVorLongdrink({orte:[{getraenke:{'1':Array(6).fill('normal:05')}}]}, '1')}));
  if(r.mit !== 5) throw new Error('mit Kurzen: ' + r.mit);
  if(r.ohne !== null) throw new Error('ohne Longdrink: ' + r.ohne);
});
await schritt('Der zweite Longdrink meldet nichts Neues', async () => {
  await aufbau({'1':[...h(5), 'lang:04'], '2':h(2)});
  await p.evaluate(() => { markenPruefen(); state.wahlS = 'lang'; tu.strich({dataset:{id:'1'}}); state.wahlS = 'normal'; });
  if((await marken('abtruennig')).length !== 1) throw new Error('doppelt');
});
await schritt('Hat er den Arschloch, erfährt die Anweisung davon', async () => {
  await aufbau({'1':[...h(8)], '2':['normal:033'], '3':['stark:05']});
  await p.evaluate(() => { markenPruefen(); state.wahlS = 'lang'; tu.strich({dataset:{id:'1'}}); state.wahlS = 'normal'; });
  const m = (await marken('abtruennig'))[0];
  if(!m || !m.stur) throw new Error(JSON.stringify(m));
  const t = await p.evaluate(m => urkundeAnweisung(state.we[0], m), m);
  if(!/Ich bleib beim Arschloch/.test(t)) throw new Error('kein Bezug auf die Sturheit');
  if(/echte Nachricht/.test(t)) throw new Error('mit Nachricht');
});

console.log('\n== Der Kurze in der Arschloch-Strecke ==');
await schritt('Ein Kurzer zwischendurch unterbricht die acht', async () => {
  const k = await p.evaluate(() => {
    const w = {tage:[{orte:[{getraenke:{'1':[...Array(4).fill('normal:05'), 'kurz:02', ...Array(4).fill('normal:05')],
      '2':['normal:033'], '3':['stark:05']}}]}]};
    return sorteTreu(w, '1'); });
  if(k) throw new Error(k);
});
await schritt('Und wer Kurze trinkt, hat etwas anderes getrunken', async () => {
  const k = await p.evaluate(() => {
    const w = {tage:[{orte:[{getraenke:{'1':Array(8).fill('normal:05'),
      '2':['normal:05','kurz:02'], '3':['normal:05','lang:04']}}]}]};
    return sorteTreu(w, '1'); });
  if(k !== 'normal:05') throw new Error(String(k));
});

await schritt('Kein Zeichnen ist fehlgeschlagen', async () => {
  if(fehler.length) throw new Error(fehler.join(' | '));
});
await schritt('Alle data-tu-Aktionen haben einen Handler', async () => {
  const namen = [...new Set([...html.matchAll(/data-tu="([A-Za-z]+)"/g)].map(m => m[1]))];
  const fehlt = await p.evaluate(n => n.filter(x => typeof tu[x] !== 'function'), namen);
  if(fehlt.length) throw new Error(fehlt.join(', '));
});

console.log('');
await b.close(); srv.close();
