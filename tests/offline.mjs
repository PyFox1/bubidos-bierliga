// Belegt den Start ohne Netz: Gerät A startet aus der lokalen Notfallkopie,
// bekommt danach wieder Empfang und schreibt. Was passiert mit B's Bieren?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(process.env.DATEI || APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8914);

const heute = new Date().toISOString().slice(0,10);
const basisStand = (beere) => ({
  spieler: [{id:1,name:'Korbi'},{id:2,name:'Fifu'}],
  we: [{id:900, titel:'Berlin', datum:heute, zu:false, dabei:[1,2],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:902, name:'Alte Bar', getraenke:{'1':[], '2':beere}, log:[]}]}]}],
  aktivWe:900, aktivTag:901, aktivOrt:902, einst:{k:40}, geraete:{}, stand:1000
});

// Auf dem Server stehen inzwischen drei Biere von Fifu, eingetragen von Gerät B.
let datei = JSON.stringify(Object.assign(basisStand(['normal:05','normal:05','normal:05']),
  {stand: 2000}));
let sha = 's1', n = 1;

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
let netz = false;   // Gerät A hat zunächst kein Netz

await p.route('**/api.github.com/**', async r => {
  if(!netz) return r.abort('connectionfailed');
  const q = r.request();
  if(q.method() === 'PUT'){
    const k = JSON.parse(q.postData());
    if(k.sha !== sha) return r.fulfill({status:409, contentType:'application/json', body:'{}'});
    datei = Buffer.from(k.content, 'base64').toString('utf8');
    sha = 's' + (++n);
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({content:{sha}})});
  }
  if(!q.url().includes('/contents/stand.json'))          // Ordner: nur der sha
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify([{path:'stand.json', sha, type:'file'}])});
  r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha, content: Buffer.from(datei).toString('base64')})});
});

/* Das Gerät lief gestern erfolgreich: Notfallkopie und Basis liegen lokal und
   stimmen überein – Fifu hatte da noch kein Bier. Beides ist älter als der
   Server, auf dem inzwischen Fifus drei Biere stehen. */
await p.addInitScript((alt) => {
  localStorage.setItem('bubidos-token', 'github_pat_test');
  localStorage.setItem('bubidos-spiegel', JSON.stringify({t: Date.now(), daten: alt}));
  localStorage.setItem('bubidos-basis', JSON.stringify(alt));
}, basisStand([]));

await p.goto('http://localhost:8914/');
await p.waitForTimeout(900);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};
const aufDemServer = () => JSON.parse(datei).we[0].tage[0].orte[0].getraenke;

console.log('\n== Start ohne Netz, danach wieder Empfang ==');
await schritt('A startet aus der Notfallkopie, mit der Basis von gestern', async () => {
  const s = await p.evaluate(() => ({sha: ghSha,
    basis: (typeof basisDaten === 'undefined' ? null : basisDaten),
    fifu: aktuell().ort.getraenke['2'].length}));
  if(s.sha !== null) throw new Error('ghSha ist gesetzt');
  if(!s.basis) throw new Error('die Basis von gestern fehlt');
  return 'ohne sha, aber mit Basis – Fifu steht lokal bei ' + s.fifu;
});

await schritt('Auf dem Server stehen zu dem Zeitpunkt drei Biere von Fifu', async () => {
  const g = aufDemServer();
  if(g['2'].length !== 3) throw new Error(g['2'].length + ' Biere');
  return '3 Biere';
});

await schritt('Empfang kehrt zurück, A trägt ein Bier für Korbi ein', async () => {
  netz = true;
  await p.evaluate(async () => { tu.strich({dataset:{id:'1'}}); await sichern({sofort:true}); });
  await p.waitForTimeout(600);
  const g = aufDemServer();
  if(g['1'].length !== 1) throw new Error('Korbis Bier fehlt: ' + g['1'].length);
  return 'Korbi steht auf dem Server';
});

await schritt('Fifus drei Biere stehen danach immer noch auf dem Server', async () => {
  const g = aufDemServer();
  if(g['2'].length !== 3)
    throw new Error('nur noch ' + g['2'].length + ' statt 3 – überschrieben');
  return '3 Biere erhalten';
});

await b.close(); srv.close();
