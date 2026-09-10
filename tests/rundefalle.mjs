// Prüft, ob "Runde für alle" jemandem ein Bier unterjubelt, der von Anfang an
// vorausgewählt wurde, aber real erst später am selben Tag dazustößt.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8918);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8918/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

// Kammy wurde beim Eröffnen vorausgewählt, kommt aber erst an L3.
await p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Kammy'}];
  const g1 = {'1':[],'2':[],'3':[]};   // Kammy schon als Schlüssel da, obwohl abwesend
  state.we = [{id:900, titel:'Berlin', datum:'2026-09-11', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'L1', getraenke:g1}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.einst = {k:40};
  zeichnen();
});

console.log('\n== Vorausgewählt, aber noch nicht da ==');
await schritt('"Runde für alle" an L1 trägt auch bei Kammy ein', async () => {
  await p.evaluate(() => tu.runde());
  const kammy = await p.evaluate(() => aktuell().ort.getraenke['3']);
  if(kammy.length === 0) throw new Error('kein Bier eingetragen – kein Fehler?');
  return 'Kammy hat ' + kammy.length + ' Bier, obwohl er nicht da war';
});

await schritt('Das schlägt sich auch in der Wertung nieder', async () => {
  const be = await p.evaluate(() => berechnen().log[0].tagLog[0].erg['3'].be);
  if(be === 0) throw new Error('0 BE trotz allem – seltsam');
  return 'Kammy steht mit ' + be + ' BE in der Wertung, obwohl abwesend';
});

console.log('\n== Zum Vergleich: über "dazugestoßen" ==');
await p.evaluate(() => {
  state.we[0].tage[0].orte[0].getraenke = {'1':[],'2':[]};   // Kammy raus, wie richtig
  zeichnen();
});
await schritt('Ohne Kammy als Schlüssel trägt "Runde für alle" bei ihm nichts ein', async () => {
  await p.evaluate(() => tu.runde());
  const kammy = await p.evaluate(() => aktuell().ort.getraenke['3']);
  if(kammy !== undefined) throw new Error('Kammy ist plötzlich Schlüssel: ' + JSON.stringify(kammy));
  return 'Kammy taucht nirgends auf – korrekt, er war nicht da';
});

await schritt('"Wer ist hier noch dazugestoßen?" fügt ihn sauber an L3 hinzu', async () => {
  await p.evaluate(() => {
    const {tg, ort} = aktuell();
    tg.orte.push({id:2, name:'L2', getraenke:{'1':[],'2':[]}});
    tg.orte.push({id:3, name:'L3', getraenke:{'1':[],'2':[]}});
    state.aktivOrt = 3;
    zeichnen();
    tu.ortRein({dataset:{id:'3'}});   // Kammy stößt hier dazu
  });
  const be3 = await p.evaluate(() => {
    const tl = berechnen().log[0].tagLog[0];
    return {kammy: tl.erg['3'] ? tl.erg['3'].be : null, orte: tl.erg['3'] ? tl.erg['3'].orte : null};
  });
  if(be3.kammy === null) throw new Error('Kammy fehlt in der Tageswertung');
  if(be3.orte !== 1) throw new Error('Kammy in ' + be3.orte + ' Locations statt 1');
  return 'Kammy korrekt mit ' + be3.kammy + ' BE, 1 Location';
});

await b.close(); srv.close();
