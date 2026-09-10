// Prüft, ob +Tag (tagNeu) unbemerkt alle we.dabei einträgt, auch wer an dem
// neuen Tag noch gar nicht da ist.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8919);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8919/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

await p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Kammy'}];
  state.we = [{id:900, titel:'Berlin', datum:'2026-09-11', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[{id:1, name:'L1',
      getraenke:{'1':['normal:05','normal:05'],'2':['normal:05','normal:05'],
                 '3':['normal:05','normal:05']}}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.einst = {k:40};
  zeichnen();
});

console.log('\n== +Tag am nächsten Morgen: Kammy ist noch gar nicht wach ==');
await schritt('tagNeu() trägt Kammy als Schlüssel ein, ohne zu fragen', async () => {
  await p.evaluate(() => tu.tagNeu());
  const g = await p.evaluate(() => aktuell().ort.getraenke);
  if(!('3' in g)) throw new Error('Kammy fehlt – kein Problem?');
  if(g['3'].length !== 0) throw new Error('Kammy hat schon Bier: ' + JSON.stringify(g['3']));
  return 'Kammy steht als Schlüssel mit leerem Array, ohne dass gefragt wurde';
});

await schritt('Kein "Wer ist heute dabei?"-Schritt wie bei +Location', async () => {
  const hatMit = await p.evaluate(() => !!(benennen && benennen.mit));
  if(hatMit) throw new Error('es gibt doch eine Auswahl – dann ist das schon entschärft');
  return 'benennen.mit ist nicht gesetzt, keine Auswahlmöglichkeit im Blatt';
});

await schritt('"Runde für alle" trägt auch bei Kammy ein, der noch schläft', async () => {
  await p.evaluate(() => { document.getElementById('ortNameNeu').value = 'Frühstück';
    tu.benennenFertig(); });
  await p.evaluate(() => tu.runde());
  const kammy = await p.evaluate(() => aktuell().ort.getraenke['3']);
  if(kammy.length === 0) throw new Error('kein Bier – doch kein Problem?');
  return 'Kammy hat ' + kammy.length + ' Bier zum Frühstück, ohne anwesend zu sein';
});

console.log('\n== Bliebe es dabei, den ganzen Tag ==');
await schritt('Ohne Korrektur zählt er als "anwesend mit 0 Bier" und verliert Punkte', async () => {
  // zurücksetzen: Kammy hat den Tag über nichts getrunken (Runde-Eintrag entfernt)
  await p.evaluate(() => { aktuell().ort.getraenke['3'] = []; });
  const be = await p.evaluate(() => {
    const R = berechnen().log[1].nachher;   // Tag 2 ist der neue, index 1 falls Feb sortiert
    return R;
  }).catch(() => null);
  const echt = await p.evaluate(() => {
    const r = berechnen();
    const letzterTag = r.log[0].tagLog[r.log[0].tagLog.length - 1];
    return letzterTag.erg['3'] ? letzterTag.erg['3'].nachher : null;
  });
  if(echt === null) throw new Error('Kammy fehlt in der Wertung – dann wäre nichts falsch');
  return 'Kammy landet nach diesem Tag bei ' + echt.toFixed(1)
    + ' – als wäre er wirklich anwesend gewesen und hätte nichts getrunken';
});

await b.close(); srv.close();
