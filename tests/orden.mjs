// Abzeichen und Wanderpokale: Werden sie richtig vergeben, stimmen Fazit, Erklär-Blätter
// und § 6 überein, und zeigen Tabelle, Personenansicht und Ehrenhalle dasselbe?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8951);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8951/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Vier Wochenenden, drei abgeschlossen, eines läuft.
   W1: alle vier, Gerry geht früh.       Krone Korbi 6 · Rekord Korbi 6
       Fifu und Sperry kommen binnen einer Minute auf die Schlagzahl, Korbi eine Stunde
       später – Fifu und Sperry teilen den Schrittmacher.
   W2: ohne Gerry, zwei Tage.            Krone Fifu 9
       Tag 1: Sperry und Korbi gehen binnen fünf Minuten – geteilter Bettzipfel.
       Korbi allein auf der Schlagzahl – Schrittmacher.
   W3: alle vier.                        Krone Korbi 8 · Rekord Korbi 8
       Alle vier mit derselben Runde auf der Schlagzahl – keiner hat vorgelegt.
       Serien: Korbi, Fifu, Sperry je 3, Gerry 1 – Fifu blieb am öftesten bis zum Schluss.
   W4 läuft: Fifu 9 an einem Tag.        Rekord Fifu 9, noch mitten am Abend. */
const T0 = new Date('2025-05-01T22:00:00').getTime();
await p.evaluate(({T0}) => {
  const h = n => Array(n).fill('normal:05');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Gerry'}];
  state.einst = {k:40};
  state.we = [
    {id:100, titel:'Erstes', datum:'2025-05-01', zu:true, dabei:[1,2,3,4], tage:[
      {id:101, label:'1. Tag', heim:{'4':T0},
       schlag:{'2':T0 - 3*3600000, '3':T0 - 3*3600000 + 60000, '1':T0 - 2*3600000}, orte:[{id:11, name:'A',
        getraenke:{'1':h(6),'2':h(4),'3':h(3),'4':h(2)}}]}]},
    {id:200, titel:'Zweites', datum:'2025-09-01', zu:true, dabei:[1,2,3], tage:[
      {id:201, label:'1. Tag', heim:{'3':T0, '1':T0 + 5*60000}, schlag:{'1':T0 - 3600000},
       orte:[{id:21, name:'B',
        getraenke:{'1':h(3),'2':h(5),'3':h(4)}}]},
      {id:202, label:'2. Tag', orte:[{id:22, name:'C',
        getraenke:{'1':h(3),'2':h(4),'3':h(2)}}]}]},
    {id:300, titel:'Drittes', datum:'2026-05-01', zu:true, dabei:[1,2,3,4], tage:[
      {id:301, label:'1. Tag', schlag:{'1':T0, '2':T0, '3':T0, '4':T0}, orte:[{id:31, name:'D',
        getraenke:{'1':h(8),'2':h(5),'3':h(5),'4':h(5)}}]}]},
    {id:400, titel:'Läuft', datum:'2026-09-26', zu:false, dabei:[1,2,3], tage:[
      {id:401, label:'1. Tag', orte:[{id:41, name:'E',
        getraenke:{'1':h(2),'2':h(9),'3':h(1)}}]}]}];
  state.aktivWe = 400; state.aktivTag = 401; state.aktivOrt = 41;
  ansicht = 'archiv'; zeichnen();
}, {T0});

const eh = await p.evaluate(() => {
  const r = ehrungen();
  const n = ids => ids.map(id => state.spieler.find(x => String(x.id) === String(id)).name).sort().join('+');
  return {
    zahlen: r.zahlen,
    chronik: r.chronik.map(c => ({tag:c.tagId, sieger:n(c.a.sieger), fahrer:n(c.a.fahrer),
      schlag:n(c.a.schlag), zipfel:n(c.a.zipfel)})),
    halter: Object.fromEntries(Object.keys(r.halter).map(k => [k, {wer:n(r.halter[k].wer), wert:r.halter[k].wert}])),
    verlauf: Object.fromEntries(Object.keys(r.verlauf).map(k => [k, r.verlauf[k].map(v => n(v.wer) + '@' + v.weId)]))
  };
});

console.log('\n══ Abzeichen je Tag ══');
eh.chronik.forEach(c => console.log('  ' + c.tag + '  Sieger ' + (c.sieger || '—').padEnd(8)
  + ' Fahrer ' + (c.fahrer || '—').padEnd(18) + ' Schritt ' + (c.schlag || '—').padEnd(12)
  + ' Zipfel ' + (c.zipfel || '—')));

const tag = id => eh.chronik.find(c => c.tag === id);
await schritt('Tagessieger ist, wer an dem Tag die meisten BE hat', async () => {
  const soll = {101:'Korbi', 201:'Fifu', 202:'Fifu', 301:'Korbi', 401:'Fifu'};
  const falsch = Object.keys(soll).filter(k => tag(+k).sieger !== soll[k]);
  if(falsch.length) throw new Error(falsch.map(k => k + ': ' + tag(+k).sieger).join(', '));
  return '5 Tage';
});
await schritt('Fahrer des Abends: die wenigsten BE, bei Gleichstand alle', async () => {
  if(tag(101).fahrer !== 'Gerry') throw new Error('W1: ' + tag(101).fahrer);
  if(tag(201).fahrer !== 'Korbi') throw new Error('W2/1: ' + tag(201).fahrer);
  if(tag(301).fahrer !== 'Fifu+Gerry+Sperry') throw new Error('W3: ' + tag(301).fahrer);
  return 'Gerry · Korbi · drei gleichauf';
});
await schritt('Fahrer und Bettzipfel dürfen an denselben gehen', async () => {
  if(tag(101).fahrer !== 'Gerry' || tag(101).zipfel !== 'Gerry')
    throw new Error(tag(101).fahrer + ' / ' + tag(101).zipfel);
});
await schritt('Bettzipfel: binnen zehn Minuten geteilt, ohne Heim-Zeit keiner', async () => {
  if(tag(201).zipfel !== 'Korbi+Sperry') throw new Error('W2/1: ' + tag(201).zipfel);
  if(tag(202).zipfel !== '') throw new Error('W2/2: ' + tag(202).zipfel);
  return 'Sperry und Korbi fünf Minuten auseinander';
});

await schritt('Schrittmacher: der Erste, binnen zwei Minuten geteilt, alle zugleich keiner', async () => {
  if(tag(101).schlag !== 'Fifu+Sperry') throw new Error('W1: ' + tag(101).schlag);
  if(tag(201).schlag !== 'Korbi') throw new Error('W2/1: ' + tag(201).schlag);
  if(tag(202).schlag !== '') throw new Error('W2/2 ohne Zeiten: ' + tag(202).schlag);
  if(tag(301).schlag !== '') throw new Error('W3, alle mit derselben Runde: ' + tag(301).schlag);
  return 'Fifu und Sperry · Korbi · keiner';
});

console.log('\n══ Grenzfälle, einzeln gerechnet ══');
const grenz = await p.evaluate(() => {
  const t = (erg, heim) => ({tag:{id:9, heim}, erg:Object.fromEntries(Object.entries(erg).map(([k,v]) => [k,{be:v}]))});
  const n = a => a.slice().sort().join('+');
  const zwei = tagAbzeichen(t({1:3, 2:1}));
  const gleich = tagAbzeichen(t({1:2, 2:2, 3:2}));
  const alleZusammen = tagAbzeichen(t({1:3, 2:2, 3:1}, {1:1000, 2:1000 + 60000, 3:1000 + 120000}));
  const spaeter = tagAbzeichen(t({1:3, 2:2, 3:1}, {1:1000, 2:1000 + 20*60000}));
  const frueh = frueherGegangen({heim:{1:1000, 2:1000 + 60000, 3:1000 + 60*60000}}, ['1','2','3']);
  return {zweiFahrer:n(zwei.fahrer), gleichFahrer:n(gleich.fahrer), gleichSieger:n(gleich.sieger),
          alleZusammen:n(alleZusammen.zipfel), spaeter:n(spaeter.zipfel), frueh:n(frueh)};
});
await schritt('Zu zweit gibt es keinen Fahrer', async () => {
  if(grenz.zweiFahrer) throw new Error('Fahrer: ' + grenz.zweiFahrer);
});
await schritt('Liegen alle gleichauf, gibt es keinen Fahrer, aber lauter Sieger', async () => {
  if(grenz.gleichFahrer) throw new Error('Fahrer: ' + grenz.gleichFahrer);
  if(grenz.gleichSieger !== '1+2+3') throw new Error('Sieger: ' + grenz.gleichSieger);
});
await schritt('Gehen alle binnen zehn Minuten, geht keiner zuerst', async () => {
  if(grenz.alleZusammen) throw new Error('Zipfel: ' + grenz.alleZusammen);
});
await schritt('Wer zwanzig Minuten nach dem Ersten geht, teilt nicht mit', async () => {
  if(grenz.spaeter !== '1') throw new Error('Zipfel: ' + grenz.spaeter);
});
await schritt('Haben alle eine Heim-Zeit, ist früher gegangen, wer lange vor dem Letzten ging', async () => {
  if(grenz.frueh !== '1+2') throw new Error(grenz.frueh);
});

console.log('\n══ Wanderpokale ══');
Object.keys(eh.verlauf).forEach(k => console.log('  ' + k.padEnd(7) + eh.verlauf[k].join(' → ')));
await schritt('Deckelkrone wandert bei jedem Abschluss zum Meisten', async () => {
  const soll = 'Korbi@100 → Fifu@200 → Korbi@300';
  if(eh.verlauf.krone.join(' → ') !== soll) throw new Error(eh.verlauf.krone.join(' → '));
  if(eh.halter.krone.wer !== 'Korbi') throw new Error('Halter ' + eh.halter.krone.wer);
  return soll;
});
await schritt('Das laufende Wochenende vergibt die Krone noch nicht', async () => {
  if(eh.verlauf.krone.some(v => v.endsWith('@400'))) throw new Error('W4 schon vergeben');
});
await schritt('Rekord wechselt auch mitten am Abend, und Gleichziehen reicht nicht', async () => {
  const soll = 'Korbi@100 → Korbi@300 → Fifu@400';
  if(eh.verlauf.rekord.join(' → ') !== soll) throw new Error(eh.verlauf.rekord.join(' → '));
  if(eh.halter.rekord.wert !== 9) throw new Error('Wert ' + eh.halter.rekord.wert);
  return soll;
});
await schritt('Treuepokal erst ab drei in Folge, dann an den, der öfter bis zum Schluss blieb', async () => {
  if(eh.verlauf.treue.join(' → ') !== 'Fifu@300') throw new Error(eh.verlauf.treue.join(' → '));
  return 'nach W2 niemand, nach W3 Fifu';
});

const treueWeiter = await p.evaluate(() => {
  const merk = JSON.stringify(state.we);
  /* Ein fünftes, abgeschlossenes Wochenende ohne Fifu: Seine Serie reißt, Korbi und
     Sperry haben fünf, gleich viele Tage und gleich oft bis zum Schluss – sie teilen.
     Ein sechstes nur mit Gerry: Dann hat niemand mehr drei in Folge. */
  state.we[3].zu = true;
  state.we.push({id:500, titel:'Fünftes', datum:'2026-10-01', zu:true, dabei:[1,3], tage:[
    {id:501, label:'1. Tag', orte:[{id:51, name:'F', getraenke:{'1':['normal:05'],'3':['normal:05']}}]}]});
  const a = ehrungen().halter.treue.wer.map(String).sort();
  state.we.push({id:600, titel:'Sechstes', datum:'2026-11-01', zu:true, dabei:[4], tage:[
    {id:601, label:'1. Tag', orte:[{id:61, name:'G', getraenke:{'4':['normal:05']}}]}]});
  const r = ehrungen();
  const leer = r.halter.treue.wer.length;
  const letzter = r.wechsel.filter(w => w.k === 'treue').pop();
  state.we = JSON.parse(merk);
  return {a, leer, letzterVon:letzter.von.map(String).sort()};
});
await schritt('Reißt die Serie des Halters, wandert der Treuepokal weiter', async () => {
  if(treueWeiter.a.join() !== '1,3') throw new Error('Halter ' + treueWeiter.a.join());
  return 'Fifu fehlt, Korbi und Sperry gleichauf – geteilt';
});
await schritt('Hat niemand drei in Folge, steht der Treuepokal im Schrank', async () => {
  if(treueWeiter.leer) throw new Error(treueWeiter.leer + ' Halter');
  if(treueWeiter.letzterVon.join() !== '1,3') throw new Error('von ' + treueWeiter.letzterVon.join());
});

console.log('\n══ Fazit, Erklärung und § 6 sagen dasselbe ══');
const texte = await p.evaluate(() => {
  const e = berechnen().log.find(x => x.we.id === 300);
  return {
    fazit: fazitBlock(fazitVon(e), false),
    fazit2: fazitBlock(fazitVon(berechnen().log.find(x => x.we.id === 200)), false),
    abz: ERKLAERUNGEN.abzeichen.titel + ' :: ' + ERKLAERUNGEN.abzeichen.text.join(' '),
    pok: ERKLAERUNGEN.pokale.titel + ' :: ' + ERKLAERUNGEN.pokale.text.join(' '),
    abzTitel: ERKLAERUNGEN.abzeichen.titel, pokTitel: ERKLAERUNGEN.pokale.titel,
    info: ansichtInfo(),
    namenA: ABZEICHEN.map(z => z.name), namenP: POKALE.map(z => z.name)
  };
});
await schritt('Jedes Abzeichen steht im Erklär-Blatt und in § 6', async () => {
  const fehlt = texte.namenA.filter(n => !texte.abz.includes(n) || !texte.info.includes(n));
  if(fehlt.length) throw new Error(fehlt.join(', '));
  return texte.namenA.join(', ');
});
await schritt('Jeder Wanderpokal steht im Erklär-Blatt und in § 6', async () => {
  const fehlt = texte.namenP.filter(n => !texte.pok.includes(n) || !texte.info.includes(n));
  if(fehlt.length) throw new Error(fehlt.join(', '));
  return texte.namenP.join(', ');
});
await schritt('Die Titel der Blätter nennen die richtige Zahl', async () => {
  const w = {2:'zwei', 3:'drei', 4:'vier', 5:'fünf'};
  if(!texte.abzTitel.includes(w[texte.namenA.length])) throw new Error(texte.abzTitel);
  if(!texte.pokTitel.includes(w[texte.namenP.length])) throw new Error(texte.pokTitel);
});
await schritt('Die alten Orden stehen nirgends mehr', async () => {
  const alt = ['Deckelkönig','Gleichmaß','Durchhalter','Aufsteiger','Ordensverleihung'];
  const da = alt.filter(a => texte.info.includes(a) || texte.abz.includes(a) || texte.fazit.includes(a));
  if(da.length) throw new Error(da.join(', '));
});
await schritt('Das Fazit zeigt die Abzeichen mit begründendem Wert', async () => {
  for(const s of ['Tagessieger', 'Korbi', '8,00 BE', 'Fahrer des Abends', '5,00 BE'])
    if(!texte.fazit.includes(s)) throw new Error('fehlt: ' + s);
  if(!texte.fazit2.includes('Goldener Bettzipfel') || !/heim um \d\d:\d\d/.test(texte.fazit2))
    throw new Error('Bettzipfel ohne Uhrzeit');
  if(!texte.fazit2.includes('Schrittmacher') || !/das dritte um \d\d:\d\d/.test(texte.fazit2))
    throw new Error('Schrittmacher ohne Uhrzeit');
});
await schritt('Das Fazit zeigt, was mit den Pokalen passiert ist', async () => {
  for(const s of ['Deckelkrone', 'von Fifu', 'Treuepokal', 'Erstverleihung', 'Rekordhalter'])
    if(!texte.fazit.includes(s)) throw new Error('fehlt: ' + s);
});

console.log('\n══ Wo man es sieht ══');
await schritt('In der Tabelle stehen die Zeichen neben den Haltern', async () => {
  await p.evaluate(() => { ansicht = 'archiv'; zeichnen(); });
  const z = await p.evaluate(() => [...document.querySelectorAll('.rang')].map(r => ({
    name: r.querySelector('.rname').textContent,
    sym: [...r.querySelectorAll('.rname .psym')].map(s => s.getAttribute('aria-label')).join('+')})));
  const k = z.find(x => x.name.startsWith('Korbi')), f = z.find(x => x.name.startsWith('Fifu'));
  if(k.sym !== 'Deckelkrone') throw new Error('Korbi: ' + k.sym);
  if(f.sym !== 'Rekordhalter+Treuepokal') throw new Error('Fifu: ' + f.sym);
  if(z.find(x => x.name.startsWith('Gerry')).sym) throw new Error('Gerry hat eins');
  return 'Korbi Krone · Fifu Blitz und Anker';
});
await schritt('Das Archiv nennt die Deckelkrone je Wochenende', async () => {
  const t = await p.evaluate(() => document.querySelector('.weZeile .wzsieger').textContent);
  if(!/Deckelkrone Korbi/.test(t)) throw new Error(t);
});
await schritt('Die Ehrenhalle zeigt Halter, Verlauf, Abzeichen und Chronik', async () => {
  await p.evaluate(() => tu.geheRuhm());
  const t = await p.evaluate(() => ({kopf:document.getElementById('kopf').textContent,
    app:document.getElementById('app').textContent,
    zeilen:[...document.querySelectorAll('.abzzeile')].map(z => z.textContent)}));
  if(!t.kopf.includes('Ehrenhalle')) throw new Error('Kopf: ' + t.kopf);
  for(const s of ['Deckelkrone', 'Rekordhalter', 'Treuepokal', 'Erstes', 'Chronik', 'Goldener Bettzipfel'])
    if(!t.app.includes(s)) throw new Error('fehlt: ' + s);
  const korbi = t.zeilen.find(z => z.startsWith('Korbi'));
  if(korbi !== 'Korbi2111') throw new Error('Korbi-Zeile: ' + korbi);
  return 'Korbi: 2 Siege, 1 Fahrer, 1 Schrittmacher, 1 Zipfel';
});
await schritt('Der Zurück-Pfeil führt aus der Ehrenhalle zurück', async () => {
  await p.evaluate(() => tu.zurueckNavi());
  const m = await p.evaluate(() => modus());
  if(m !== 'archiv') throw new Error(m);
});
await schritt('Die Personenansicht zählt Abzeichen und Pokale', async () => {
  await p.evaluate(() => { tu.personAuf({dataset:{id:2}}); });
  const t = await p.evaluate(() => document.getElementById('app').textContent);
  for(const s of ['Tagessieger3×', 'Schrittmacher1×', 'Rekordhalter', 'hält ihn', 'Treuepokal',
                   'Dabei: 4 von 4 Wochenenden'])
    if(!t.includes(s)) throw new Error('fehlt: ' + s);
  if(t.includes('Orden')) throw new Error('„Orden“ steht noch da');
});

await schritt('Kein Zeichnen ist fehlgeschlagen', async () => {
  if(fehler.length) throw new Error(fehler.join(' | '));
});
await schritt('Alle data-tu-Aktionen haben einen Handler', async () => {
  /* Aus dem Quelltext, nicht nur aus dem, was gerade zu sehen ist – sonst fiele ein
     Knopf im Heim-Blatt erst auf, wenn es jemand öffnet. */
  const namen = [...new Set([...html.matchAll(/data-tu="([A-Za-z]+)"/g)].map(m => m[1]))];
  const fehlt = await p.evaluate(n => n.filter(x => typeof tu[x] !== 'function'), namen);
  if(fehlt.length) throw new Error(fehlt.join(', '));
});

console.log('');
await b.close(); srv.close();
