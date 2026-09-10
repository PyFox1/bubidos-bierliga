// Der Test, auf den es ankommt: zwei Handys, ein simulierter GitHub-Server.
// Gemessen wird die Zeit vom Tippen auf A bis zum Erscheinen auf B – ohne dass
// im Test irgendein Abgleich von Hand angestoßen wird. Alles läuft über die
// eigenen Timer der App.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8941);

/* ---- der nachgebaute Server ---- */
let inhalt = null, sha = 'sha-0', zaehler = 0;
let getOrdner = 0, getDatei = 0, puts = 0, kollisionen = 0, code304 = 0;
const NETZ = 120;                       // ms Laufzeit je Anfrage, wie im Wirtshaus
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const entb64 = s => Buffer.from(String(s).replace(/\s/g,''), 'base64').toString('utf8');

const koepfe = extra => Object.assign({
  'Access-Control-Expose-Headers':'ETag, X-RateLimit-Remaining',
  'X-RateLimit-Remaining':'4900'}, extra || {});

async function bedienen(route){
  const req = route.request(), u = req.url(), m = req.method();
  await new Promise(r => setTimeout(r, NETZ));
  if(m === 'PUT'){
    puts++;
    const koerper = JSON.parse(req.postData() || '{}');
    if(koerper.sha !== sha){          // jemand war schneller
      kollisionen++;
      return route.fulfill({status:409, contentType:'application/json',
        headers:koepfe(), body:JSON.stringify({message:'conflict'})});
    }
    inhalt = entb64(koerper.content);
    sha = 'sha-' + (++zaehler);
    return route.fulfill({status:200, contentType:'application/json',
      headers:koepfe(), body:JSON.stringify({content:{sha}})});
  }
  const istOrdner = /\/contents\/?(\?|$)/.test(u.split('api.github.com')[1] || '');
  if(istOrdner){
    getOrdner++;
    const etag = '"' + sha + '"';
    if(req.headers()['if-none-match'] === etag){
      code304++;
      return route.fulfill({status:304, headers:koepfe({'ETag':etag}), body:''});
    }
    return route.fulfill({status:200, contentType:'application/json',
      headers:koepfe({'ETag':etag}),
      body:JSON.stringify([{path:'stand.json', sha, type:'file'}])});
  }
  getDatei++;
  return route.fulfill({status:200, contentType:'application/json',
    headers:koepfe(), body:JSON.stringify({sha, content:b64(inhalt || '{}')})});
}

const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const geraet = async (name) => {
  const p = await browser.newPage({viewport:{width:390, height:820}});
  await p.route('**/api.github.com/**', bedienen);
  await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
  await p.goto('http://localhost:8941/');
  await p.waitForTimeout(900);
  return p;
};

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const A = await geraet('A');

/* A legt ein laufendes Wochenende an und schreibt es sofort raus. */
await A.evaluate(async () => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'}];
  state.we = [{id:900, titel:'Testabend', datum:'2026-09-10', zu:false, dabei:[1,2],
    tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'Alte Bar', getraenke:{'1':[],'2':[]}}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1; state.einst = {k:40};
  await sichern({sofort:true});
});
await A.waitForTimeout(400);

const B = await geraet('B');   // B startet und holt sich den Stand

console.log('\n══ Beide Geräte stehen am selben Abend ══');
await schritt('B hat das Wochenende von A übernommen', async () => {
  const t = await B.evaluate(() => state.aktivWe && aktuell() ? aktuell().ort.name : null);
  if(t !== 'Alte Bar') throw new Error('B steht bei: ' + t);
  return 'B ist in der Alten Bar';
});

/* Wartet, bis auf dem Zielgerät die erwartete Zahl Biere steht. Nichts wird
   angestoßen – nur beobachtet. */
/* Ein Bier eintragen, wie am Tisch getippt: Steht bei dem Namen schon eins aus den
   letzten drei Minuten, fragt die App nach – dann bestätigt der zweite Tipp. Ohne das
   bliebe hier nur eine offene Frage stehen und gar kein Bier. */
const strich = (seite, id) => seite.evaluate(id => {
  const n = () => (aktuell().ort.getraenke[id] || []).length;
  const vor = n();
  tu.strich({dataset:{id}});
  if(n() === vor) tu.strich({dataset:{id}});
}, String(id));

async function wartenBis(seite, id, anzahl, grenzeMs){
  const t0 = Date.now();
  for(;;){
    const n = await seite.evaluate((pid) => {
      try { const a = aktuell(); return a ? (a.ort.getraenke[pid] || []).length : -1; }
      catch(e){ return -1; }
    }, String(id));
    if(n >= anzahl) return Date.now() - t0;
    if(Date.now() - t0 > grenzeMs) return null;
    await new Promise(r => setTimeout(r, 100));
  }
}

console.log('\n══ Der Fall aus dem Wirtshaus: A trägt ein Bier ein ══');
await schritt('Es erscheint von selbst auf B', async () => {
  await strich(A, '1');
  const ms = await wartenBis(B, 1, 1, 30000);
  if(ms === null) throw new Error('nach 30 s immer noch nicht da');
  if(ms > 8000) throw new Error('hat ' + (ms/1000).toFixed(1) + ' s gedauert');
  return (ms/1000).toFixed(1) + ' s';
});

await schritt('Und das zweite genauso', async () => {
  await strich(A, '1');
  const ms = await wartenBis(B, 1, 2, 30000);
  if(ms === null) throw new Error('nach 30 s nicht da');
  if(ms > 8000) throw new Error('hat ' + (ms/1000).toFixed(1) + ' s gedauert');
  return (ms/1000).toFixed(1) + ' s';
});

console.log('\n══ Und in die Gegenrichtung ══');
await schritt('B trägt für Fifu ein, A sieht es', async () => {
  await strich(B, '2');
  const ms = await wartenBis(A, 2, 1, 30000);
  if(ms === null) throw new Error('nach 30 s nicht da');
  if(ms > 8000) throw new Error('hat ' + (ms/1000).toFixed(1) + ' s gedauert');
  return (ms/1000).toFixed(1) + ' s';
});

console.log('\n══ Beide tippen gleichzeitig ══');
await schritt('Niemandem geht ein Bier verloren', async () => {
  await Promise.all([
    strich(A, '1'),
    strich(B, '2')
  ]);
  await new Promise(r => setTimeout(r, 12000));
  const a = await A.evaluate(() => ({k:(aktuell().ort.getraenke['1']||[]).length,
                                     f:(aktuell().ort.getraenke['2']||[]).length}));
  const b = await B.evaluate(() => ({k:(aktuell().ort.getraenke['1']||[]).length,
                                     f:(aktuell().ort.getraenke['2']||[]).length}));
  if(a.k !== 3 || a.f !== 2) throw new Error('A sieht Korbi ' + a.k + ', Fifu ' + a.f + ' (erwartet 3/2)');
  if(b.k !== 3 || b.f !== 2) throw new Error('B sieht Korbi ' + b.k + ', Fifu ' + b.f + ' (erwartet 3/2)');
  return 'beide sehen Korbi 3, Fifu 2';
});

console.log('\n══ Eine ganze Runde in Folge ══');
await schritt('Fünf Striche auf A landen vollständig auf B', async () => {
  for(let i = 0; i < 5; i++){
    await strich(A, '1');
    await new Promise(r => setTimeout(r, 400));
  }
  const ms = await wartenBis(B, 1, 8, 30000);
  if(ms === null){
    const n = await B.evaluate(() => (aktuell().ort.getraenke['1']||[]).length);
    throw new Error('B steht bei ' + n + ' statt 8');
  }
  return 'alle acht auf B nach ' + (ms/1000).toFixed(1) + ' s';
});

console.log('\n══ Die Runde sitzt zwanzig Minuten und redet – dann bestellt einer ══');
await schritt('Auch nach langer Stille erscheint das Bier zügig', async () => {
  await new Promise(r => setTimeout(r, 25000));   // echte Stille, kein Tippen
  const takt = await B.evaluate(() => taktMs());
  await strich(A, '1');
  const ms = await wartenBis(B, 1, 9, 40000);
  if(ms === null) throw new Error('nach 40 s nicht da');
  if(ms > 8000) throw new Error('B taktete auf ' + takt + ' ms und brauchte '
    + (ms/1000).toFixed(1) + ' s – am Tisch zu lang');
  return (ms/1000).toFixed(1) + ' s, B taktet auf ' + takt + ' ms';
});

await schritt('Ohne laufendes Wochenende fällt der Takt zurück', async () => {
  const ruhig = await B.evaluate(() => { const merk = state.aktivWe; state.aktivWe = null;
    const t = taktMs(); state.aktivWe = merk; return t; });
  if(ruhig < 20000) throw new Error('auch im Archiv noch ' + ruhig + ' ms');
  return 'im Archiv ' + ruhig + ' ms';
});

console.log('\n══ Was das den Server kostet ══');
console.log('  Ordner-Abrufe: ' + getOrdner + '   davon 304 (kostenlos): ' + code304
  + '   Datei-Abrufe: ' + getDatei);
console.log('  Schreibvorgänge: ' + puts + '   davon Kollisionen: ' + kollisionen);
const proStunde = Math.round((getOrdner - code304) / ((getOrdner ? 1 : 1)));
await schritt('Der Löwenanteil der Abfragen ist kostenlos', async () => {
  if(getOrdner === 0) throw new Error('gar nicht abgefragt');
  const anteil = Math.round(code304 / getOrdner * 100);
  if(anteil < 40) throw new Error('nur ' + anteil + '% mit 304 beantwortet');
  return anteil + '% der Abfragen mit 304';
});

console.log('');
await browser.close(); srv.close();
