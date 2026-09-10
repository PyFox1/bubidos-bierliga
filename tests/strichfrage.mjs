// Fragt das + bei einer Person genauso nach wie „Runde für alle“?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8957);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8957/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufbau = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'Augustiner',
      getraenke:{'1':[], '2':[], '3':[]}, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  ansicht = null; vorwahl = null; stapel = []; letzteRunde = null; nachfrage = null;
  pinLoeschen(); zeichnen();
});

const tipp = id => p.evaluate(id => { tu.strich({dataset:{id}}); }, id);
const glaeser = id => p.evaluate(id => aktuell().ort.getraenke[id].length, id);
/* Am Knopf und am Text hängt es: eine Frage, die nur im Zustand steht, sieht am
   Tisch niemand. */
const zeile = id => p.evaluate(id => {
  const k = document.querySelector('.plus[data-id="' + id + '"]');
  const z = k ? k.closest('.pzeile') : null;
  return {knopf:k ? k.className : null, txt:z ? z.innerText.replace(/\n/g,' ') : null};
}, id);

console.log('\n══ Zwei Tipps hintereinander ══');

await aufbau();
await p.waitForTimeout(250);

await schritt('Der erste Tipp trägt sofort ein', async () => {
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' statt 1');
  return '1 Getränk';
});

await schritt('Der zweite Tipp trägt noch nichts ein, sondern fragt', async () => {
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' – es wurde eingetragen statt gefragt');
  const f = await p.evaluate(() => nachfrage);
  if(String(f) !== '1') throw new Error('nachfrage steht auf ' + JSON.stringify(f));
  return 'bleibt bei 1, Frage steht bei Korbi';
});

await schritt('Die Frage steht in Korbis Zeile und nennt die Zeitspanne', async () => {
  const z = await zeile('1');
  if(!/nochmal tippen/.test(z.txt)) throw new Error('in der Zeile steht: ' + z.txt);
  /* Vier Sekunden sind nicht „vor 1 Min“ – die Angabe muss dieselbe sein wie in der
     Zeile „Zuletzt …“ darüber, sonst widersprechen sich zwei Zahlen auf einem Blatt. */
  if(!/(Gerade eben|Vor \d+ (Min|Std))/.test(z.txt))
    throw new Error('ohne brauchbare Zeitangabe: ' + z.txt);
  if(/Vor 1 Min/.test(z.txt)) throw new Error('rundet Sekunden auf eine Minute hoch: ' + z.txt);
  if(!/\bwarnung2\b/.test(z.knopf)) throw new Error('der + ist nicht abgesetzt: ' + z.knopf);
  return z.txt;
});

await schritt('Die anderen Zeilen bleiben unberührt', async () => {
  const z = await zeile('2');
  if(/nochmal tippen/.test(z.txt)) throw new Error('Fifu fragt mit: ' + z.txt);
  if(/warnung2/.test(z.knopf)) throw new Error('Fifus + ist eingefärbt: ' + z.knopf);
  return 'nur Korbi fragt';
});

await schritt('Der dritte Tipp trägt dann ein', async () => {
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 2) throw new Error('Korbi hat ' + n + ' statt 2');
  const f = await p.evaluate(() => nachfrage);
  if(f !== null) throw new Error('die Frage steht noch: ' + JSON.stringify(f));
  return '2 Getränke, Frage weg';
});

await schritt('Und der vierte fragt wieder', async () => {
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 2) throw new Error('Korbi hat ' + n + ' – ohne Frage durchgelassen');
  return 'fragt erneut';
});

await schritt('Ein Tipp bei jemand anderem trägt sofort ein und nimmt die Frage weg', async () => {
  await tipp('2');
  const n = await glaeser('2');
  if(n !== 1) throw new Error('Fifu hat ' + n + ' statt 1');
  const z = await zeile('1');
  if(/nochmal tippen/.test(z.txt)) throw new Error('Korbis Frage steht noch da');
  return 'Fifu 1, Korbis Frage weg';
});

console.log('\n══ Was die Frage entkräftet ══');

await aufbau();
await p.waitForTimeout(200);

await schritt('Nach dem Zurücknehmen fragt der nächste Tipp nicht', async () => {
  await tipp('1');
  await p.evaluate(() => tu.minus({dataset:{id:'1'}}));
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' – die Korrektur wurde ausgebremst');
  return 'die Korrektur läuft durch';
});

await aufbau();
await p.waitForTimeout(200);

await schritt('Nach der Sammel-Eingabe ebenso wenig', async () => {
  await p.evaluate(() => {
    tu.blattAuf({dataset:{id:'1'}});
    blatt.z['normal:05'] = 3;
    tu.blattSpeichern();
  });
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 4) throw new Error('Korbi hat ' + n + ' statt 4');
  return 'von Hand gesetzt, dann +';
});

await aufbau();
await p.waitForTimeout(200);

/* Der häufigste Doppelfall am Tisch: einer tippt die Runde, der andere sieht es
   nicht und geht die Namen einzeln durch. */
await schritt('Kurz nach einer Runde fragt das + trotzdem', async () => {
  await p.evaluate(() => tu.runde());
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' – die Runde zählte nicht als Eintragung');
  return 'die Runde zählt mit';
});

await schritt('Die Frage lässt „Runde zurücknehmen“ stehen', async () => {
  const da = await p.evaluate(() =>
    !!document.querySelector('[data-tu="rundeZurueck"]') && !!letzteRunde);
  if(!da) throw new Error('der Rücknahme-Knopf ist mit der Frage verschwunden');
  return 'steht noch da';
});

await aufbau();
await p.waitForTimeout(200);

await schritt('Nach einer zurückgenommenen Runde fragt es nicht', async () => {
  await p.evaluate(() => { tu.runde(); tu.rundeZurueck(); });
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 1) throw new Error('Korbi hat ' + n + ' – gefragt wegen einer Runde, die es nicht gibt');
  return 'trägt ein';
});

await aufbau();
await p.waitForTimeout(200);

await schritt('Eine alte Eintragung fragt nicht mehr nach', async () => {
  await p.evaluate(() => {
    const {ort} = aktuell();
    ort.getraenke['1'] = ['normal:05'];
    ort.log = [{t:Date.now() - 200000, gid:'gA', art:'einzel', key:'normal:05', pid:'1'}];
    zeichnen();
  });
  await tipp('1');
  const n = await glaeser('1');
  if(n !== 2) throw new Error('Korbi hat ' + n + ' – nach über drei Minuten noch gefragt');
  return 'älter als das Fenster, trägt ein';
});

console.log('\n══ Die Frage steht nicht ewig ══');

await aufbau();
await p.waitForTimeout(200);

await schritt('Nach sechs Sekunden ist sie von selbst weg', async () => {
  await tipp('1');
  await tipp('1');
  const vorher = await p.evaluate(() => nachfrage);
  if(String(vorher) !== '1') throw new Error('sie stand gar nicht erst da');
  await p.waitForTimeout(6600);
  const f = await p.evaluate(() => nachfrage);
  if(f !== null) throw new Error('steht immer noch: ' + JSON.stringify(f));
  const z = await zeile('1');
  if(/nochmal tippen/.test(z.txt)) throw new Error('in der Zeile steht sie noch');
  return 'zurückgesetzt';
});

await aufbau();
await p.waitForTimeout(200);

await schritt('Ein Neuzeichnen dazwischen lässt sie stehen', async () => {
  await tipp('1');
  await tipp('1');
  await p.evaluate(() => zeichnen());
  await p.waitForTimeout(150);
  const z = await zeile('1');
  if(!/nochmal tippen/.test(z.txt))
    throw new Error('der Abgleich hat die Frage weggezeichnet: ' + z.txt);
  return 'übersteht den Abgleich';
});

await p.screenshot({path:ORDNER + 'strichfrage.png', fullPage:true});

console.log('\n══ Die Runde selbst ══');

await aufbau();
await p.waitForTimeout(200);

await schritt('Zweimal Runde fragt weiterhin nach', async () => {
  await p.evaluate(() => tu.runde());
  await p.evaluate(() => tu.runde());
  const n = await glaeser('2');
  if(n !== 1) throw new Error('Fifu hat ' + n + ' statt 1');
  const f = await p.evaluate(() => nachfrage);
  if(f !== 'runde') throw new Error('nachfrage steht auf ' + JSON.stringify(f));
  const t = await p.evaluate(() => document.body.innerText);
  if(!/gab es schon eine/.test(t)) throw new Error('kein Warnknopf');
  return 'unverändert';
});

await schritt('Und der dritte Tipp trägt sie ein', async () => {
  await p.evaluate(() => tu.runde());
  const n = await glaeser('2');
  if(n !== 2) throw new Error('Fifu hat ' + n + ' statt 2');
  return 'eingetragen';
});

console.log('\n══ Hängt jede data-tu-Aktion an einem Handler? ══');
await schritt('Auch mit offener Frage', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    const s = () => [...document.querySelectorAll('[data-tu]')]
      .forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    s();
    nachfrage = '1'; zeichnen(); s();
    nachfrage = 'runde'; zeichnen(); s();
    nachfrage = null; zeichnen(); s();
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log('');
await b.close(); srv.close();
