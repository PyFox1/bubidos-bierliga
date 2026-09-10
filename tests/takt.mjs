// Wie schnell kommt ein Bier vom einen Handy aufs andere?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8931);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});

let ordnerAbrufe = 0, dateiAbrufe = 0, schreibVorgaenge = 0;
let letzterEtagKopf = null, serverSha = 'sha-server', antworte304 = false;
let etagExponiert = true;
let fremderStand = null;

const istOrdner = u => /contents\/?(\?ref=|$)/.test(u.split('api.github.com')[1] || '');

await p.route('**/api.github.com/**', async r => {
  const u = r.request().url(), m = r.request().method();
  if(m === 'PUT'){
    schreibVorgaenge++;
    serverSha = 'sha-nach-' + schreibVorgaenge;
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({content:{sha:serverSha}})});
  }
  if(istOrdner(u)){
    ordnerAbrufe++;
    letzterEtagKopf = r.request().headers()['if-none-match'] || null;
    const koepfe = {'ETag':'"tag-1"', 'X-RateLimit-Remaining':'4900'};
    /* Ohne diese Zeile kann die Seite den ETag nicht lesen – sie liegt auf einer
       anderen Herkunft. Genau das ist der Fall, in den der Rückfall greifen muss. */
    if(etagExponiert) koepfe['Access-Control-Expose-Headers'] = 'ETag, X-RateLimit-Remaining';
    if(antworte304) return r.fulfill({status:304, headers:koepfe, body:''});
    return r.fulfill({status:200, contentType:'application/json', headers:koepfe,
      body: JSON.stringify([{path:'stand.json', sha:serverSha}])});
  }
  dateiAbrufe++;
  return r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha:serverSha, content: Buffer.from(
      JSON.stringify(fremderStand || {})).toString('base64')})});
});

await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8931/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufsetzen = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'}];
  state.we = [{id:900, titel:'Test', datum:'2026-09-10', zu:false, dabei:[1,2],
    tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'L1', getraenke:{'1':[],'2':[]}}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.einst = {k:40}; ghSha = 'sha-server';
  letztesSchreiben = 0;
  zeichnen();
});
await aufsetzen();

console.log('\n══ Der Sender: wie lange bis das Bier draußen ist? ══');
await schritt('Erster Strich geht sofort raus, nicht erst nach 2,5 s', async () => {
  schreibVorgaenge = 0;
  const t0 = Date.now();
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  for(let i = 0; i < 40 && schreibVorgaenge === 0; i++) await p.waitForTimeout(50);
  const ms = Date.now() - t0;
  if(schreibVorgaenge === 0) throw new Error('nach 2 s immer noch nichts geschrieben');
  if(ms > 800) throw new Error('hat ' + ms + ' ms gedauert');
  return ms + ' ms';
});

await schritt('Eine schnelle Serie wird trotzdem zu einem Commit gebündelt', async () => {
  schreibVorgaenge = 0;
  await p.evaluate(async () => {
    tu.strich({dataset:{id:'1'}}); tu.strich({dataset:{id:'1'}});
    tu.strich({dataset:{id:'2'}});
  });
  await p.waitForTimeout(3200);
  if(schreibVorgaenge === 0) throw new Error('gar nicht geschrieben');
  if(schreibVorgaenge > 1) throw new Error(schreibVorgaenge + ' Commits für drei Tipps');
  return '3 Tipps → ' + schreibVorgaenge + ' Commit';
});

console.log('\n══ Der Fehler von vorhin: bleibt der Abgleich am Leben? ══');
const zustand = await p.evaluate(() => ({timer: schreibTimer, gerade: schreibtGerade}));
await schritt('schreibTimer ist nach dem Feuern wieder null', async () => {
  if(zustand.timer !== null) throw new Error('steht auf ' + JSON.stringify(zustand.timer));
  return 'sauber';
});

await schritt('abgleichen() fragt den Server auch nach dem Eintragen', async () => {
  ordnerAbrufe = 0;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(250);
  if(ordnerAbrufe === 0) throw new Error('kein Abruf – wieder blockiert');
  return ordnerAbrufe + ' Abruf';
});

await schritt('Auch mit laufendem Schreibfenster wird abgeglichen', async () => {
  await p.evaluate(() => { tu.strich({dataset:{id:'1'}}); tu.strich({dataset:{id:'1'}}); });
  const offen = await p.evaluate(() => schreibTimer !== null);
  if(!offen) throw new Error('kein Fenster offen, Prüfung sagt nichts aus');
  ordnerAbrufe = 0;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(250);
  if(ordnerAbrufe === 0) throw new Error('Schreibfenster blockiert den Abgleich noch');
  await p.waitForTimeout(3000);
  return 'Abruf trotz offenem Fenster';
});

console.log('\n══ Der Empfänger: kommt das fremde Bier an? ══');
/* Am Tisch: Korbi trägt ein Bier ein, das geht sofort raus. Er tippt gleich noch
   eins – das liegt noch im Schreibfenster. Drüben hat Fifu inzwischen zwei
   eingetragen, auf Korbis erstem Bier aufbauend (anders kann es nicht sein: wer
   mit altem sha schreibt, bekommt 409 und führt selbst zusammen). */
await schritt('Fifus Biere von drüben tauchen auf', async () => {
  await aufsetzen();
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(600);                       // erstes Bier ist geschrieben
  /* Das zweite Bier binnen drei Minuten löst die Rückfrage aus – der zweite Tipp
     bestätigt sie, wie am Tisch auch. Erst dann liegt etwas im Schreibfenster. */
  await p.evaluate(() => { tu.strich({dataset:{id:'1'}}); tu.strich({dataset:{id:'1'}}); });
  const offen = await p.evaluate(() => schreibTimer !== null);
  if(!offen) throw new Error('kein Schreibfenster offen – Prüfung sagt nichts aus');
  fremderStand = {stand: Date.now() + 60000,
    spieler:[{id:1,name:'Korbi'},{id:2,name:'Fifu'}],
    we:[{id:900, titel:'Test', datum:'2026-09-10', zu:false, dabei:[1,2],
      tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'L1',
        getraenke:{'1':['normal:05'],'2':['normal:05','normal:05']}}]}]}],
    aktivWe:900, aktivTag:901, aktivOrt:1, einst:{k:40}};
  serverSha = 'sha-fremd';
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(400);
  const fifu = await p.evaluate(() => (aktuell().ort.getraenke['2'] || []).length);
  if(fifu !== 2) throw new Error('Fifu hat ' + fifu + ' statt 2');
  return 'Fifu hat 2 Bier';
});

await schritt('Der eigene, noch ungeschriebene Strich überlebt das', async () => {
  const korbi = await p.evaluate(() => (aktuell().ort.getraenke['1'] || []).length);
  if(korbi < 2) throw new Error('Korbi hat nur ' + korbi
    + ' Bier – der noch nicht geschriebene ist beim Übernehmen verlorengegangen');
  return 'Korbi hat ' + korbi + ' Bier, beide erhalten';
});
await p.waitForTimeout(3000);

console.log('\n══ Der Takt ══');
await schritt('Bei laufendem Wochenende wird flink gefragt (3 s)', async () => {
  await p.evaluate(() => abgleichPlanen());
  ordnerAbrufe = 0;
  await p.waitForTimeout(4000);
  if(ordnerAbrufe === 0) throw new Error('in 4 s gar nicht gefragt');
  return ordnerAbrufe + ' Abruf in 4 s';
});

await schritt('Ohne laufendes Wochenende wird der Takt ruhig', async () => {
  await p.evaluate(() => { state.aktivWe = null; abgleichPlanen(); });
  ordnerAbrufe = 0;
  await p.waitForTimeout(5000);
  if(ordnerAbrufe > 0) throw new Error(ordnerAbrufe + ' Abrufe – im Archiv immer noch flink');
  return 'in 5 s kein Abruf';
});

console.log('\n══ ETag: kostet das schnelle Fragen Kontingent? ══');
await schritt('Der ETag des letzten Abrufs wird mitgeschickt', async () => {
  await p.evaluate(() => { state.aktivWe = 900; });
  letzterEtagKopf = null;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(300);
  if(!letzterEtagKopf) throw new Error('kein If-None-Match im Kopf');
  return 'If-None-Match: ' + letzterEtagKopf;
});

await schritt('Auf 304 folgt kein Datei-Abruf', async () => {
  antworte304 = true;
  dateiAbrufe = 0;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(300);
  if(dateiAbrufe > 0) throw new Error('die ganze Datei wurde trotzdem geholt');
  antworte304 = false;
  return 'nur der billige Abruf';
});

await schritt('Ohne lesbaren ETag läuft es trotzdem – nur eben wie vorher', async () => {
  etagExponiert = false;
  await p.evaluate(() => { ordnerEtag = null; ghSha = "sha-alt"; state.aktivWe = 900; });
  serverSha = 'sha-ganz-neu';
  fremderStand = {stand: Date.now() + 90000,
    spieler:[{id:1,name:'Korbi'},{id:2,name:'Fifu'}],
    we:[{id:900, titel:'Test', datum:'2026-09-10', zu:false, dabei:[1,2],
      tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'L1',
        getraenke:{'1':['normal:05'],'2':['normal:05','normal:05','normal:05']}}]}]}],
    aktivWe:900, aktivTag:901, aktivOrt:1, einst:{k:40}};
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(400);
  const fifu = await p.evaluate(() => (aktuell().ort.getraenke['2'] || []).length);
  if(fifu !== 3) throw new Error('fremder Stand kam nicht an (Fifu: ' + fifu + ')');
  etagExponiert = true;
  return 'Abgleich funktioniert auch ohne ETag';
});

await schritt('Ohne ETag taktet die App sparsamer statt weiter teuer zu fragen', async () => {
  const t = await p.evaluate(() => taktMs());
  if(t !== 8000) throw new Error('taktet auf ' + t + ' ms statt 8000');
  return t + ' ms (statt 3000 mit ETag)';
});

await schritt('Mit ETag geht es wieder auf den flinken Takt', async () => {
  etagExponiert = true;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(400);
  const t = await p.evaluate(() => taktMs());
  if(t !== 3000) throw new Error('taktet auf ' + t + ' ms statt 3000');
  return t + ' ms';
});

console.log('\n══ Schlechtes Netz: ein hängender Abruf ══');
await schritt('Der Takt friert nicht ein, wenn eine Anfrage nicht zurückkommt', async () => {
  let haengt = true;
  await p.unroute('**/api.github.com/**');
  await p.route('**/api.github.com/**', async r => {
    if(haengt){ await new Promise(res => setTimeout(res, 60000)); }
    return r.fulfill({status:200, contentType:'application/json',
      headers:{'ETag':'"tag-2"','Access-Control-Expose-Headers':'ETag'},
      body: JSON.stringify([{path:'stand.json', sha:'sha-neu-nach-haenger'}])});
  });
  await p.evaluate(() => { ghSha = 'irgendwas'; abgleichen(); });
  await p.waitForTimeout(2000);
  const mittendrin = await p.evaluate(() => gleichtGerade);
  if(!mittendrin) throw new Error('der Abgleich hängt gar nicht – Prüfung sagt nichts aus');
  // Die Frist liegt bei 10 s; danach muss der Abgleich freigegeben sein.
  await p.waitForTimeout(10000);
  const frei = await p.evaluate(() => gleichtGerade === false);
  if(!frei) throw new Error('nach 12 s immer noch blockiert – der Takt steht');
  haengt = false;
  return 'nach der Frist wieder frei';
});

console.log('');
await b.close(); srv.close();
