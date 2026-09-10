import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

/* Rauschen aus dem Prüfstand selbst: abgefangene Netzaufrufe, die absichtlich
   provozierten Fehlerantworten und die nicht erreichbaren Google Fonts. Echte
   Ausnahmen kommen als pageerror oder als „Zeichnen fehlgeschlagen“ durch. */
const RAUSCHEN = /fonts\.googleapis|gstatic|net::ERR_|status of (404|409|500)/;

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8907);

// Absichtlich mit altem deckel:8 im Bestand – der darf nichts mehr bewirken.
const stand = (ueber) => Object.assign({
  spieler: [{id:'1',name:'Korbi'},{id:'2',name:'Fifu'},{id:'3',name:'Sperry'}],
  we: [{id:'we1', titel:'Berlin', datum:'2026-09-11', zu:false, dabei:['1','2','3'],
    tage:[{id:'t1', label:'1. Tag', orte:[{id:'o1', name:'Wirtshaus', getraenke:{
      '1': Array(20).fill('normal:05'),   // 20 BE, weit über einem Deckel von 8
      '2': ['normal:05','normal:05'],
      '3': ['normal:05']}}]}]}],
  aktivWe:null, aktivTag:null, aktivOrt:null, stand:1000,
  einst:{k:40, deckel:8}
}, ueber);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const fehler = [];
let holen = 0;

const p = await b.newPage({viewport:{width:390, height:820}, deviceScaleFactor:2});
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
p.on('console', m => { if(m.type() === 'error' && !RAUSCHEN.test(m.text()) && !/fonts\.googleapis/.test(m.text())) fehler.push('CONSOLE: ' + m.text()); });
let ordnerAbrufe = 0, dateiAbrufe = 0;
await p.route('**/api.github.com/**', r => {
  holen++;
  if(!r.request().url().includes('/contents/stand.json')){   // Ordner: nur der sha
    ordnerAbrufe++;
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify([{path:'stand.json', sha:'abc', type:'file', size:123}])});
  }
  dateiAbrufe++;
  r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha:'abc', content: Buffer.from(JSON.stringify(stand())).toString('base64')})});
});
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8907/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1000);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

console.log('\n== Der Deckel wirkt nicht mehr ==');
await schritt('20 Halbe zählen voll, nicht auf 8 gedeckelt', async () => {
  const be = await p.evaluate(() => berechnen().beSumme['1']);
  if(Math.abs(be - 20) > 0.001) throw new Error('BE = ' + be + ', erwartet 20');
  return be + ' BE';
});

await schritt('Ein alter deckel-Wert im Bestand ändert nichts', async () => {
  const d = await p.evaluate(() => state.einst.deckel);
  const be = await p.evaluate(() => berechnen().log[0].tagLog[0].erg['1'].be);
  if(Math.abs(be - 20) > 0.001) throw new Error('BE = ' + be);
  return 'einst.deckel ist ' + d + ', wird aber nicht gelesen';
});

console.log('\n== Die Einstellungen ==');
/* Regler und K-Faktor liegen seit G34 im zugeklappten Verwaltungsblock. Ohne das Aufklappen
   liefe die Deckel-Prüfung unten ins Leere und meldete trotzdem Erfolg. */
await p.evaluate(() => { tu.geheEinst(); verwaltungOffen = true; zeichnen(); });
await p.waitForTimeout(300);

await schritt('Kein „Stand jetzt holen“ mehr', async () => {
  const t = await p.locator('#app').innerText();
  if(/holen/i.test(t)) throw new Error('steht noch da');
});

await schritt('Kein Deckel-Block mehr', async () => {
  const r = await p.evaluate(() => {
    const ab = [...document.querySelectorAll('#app .abschnitt')];
    const von = ab.find(e => /Regler/.test(e.textContent));
    let t = '', n = von && von.nextElementSibling;
    while(n && !n.classList.contains('abschnitt')){ t += ' ' + n.textContent; n = n.nextElementSibling; }
    return {regler: t, schalter: document.querySelectorAll('[data-tu=\"deckelAn\"]').length,
            feld: document.querySelectorAll('#deckelWert').length,
            frage: document.querySelectorAll('[data-was=\"deckel\"]').length};
  });
  if(/Deckel|Obergrenze/i.test(r.regler)) throw new Error('im Regler-Abschnitt: ' + r.regler.trim().slice(0,90));
  if(r.schalter || r.feld || r.frage) throw new Error('Reste: ' + JSON.stringify(r));
  return 'Regler-Abschnitt: ' + r.regler.replace(/\s+/g,' ').trim().slice(0,60);
});

await schritt('Der K-Faktor ist noch da und lässt sich übernehmen', async () => {
  await p.evaluate(() => { document.getElementById('kFaktor').value = '55'; tu.einstSichern(); });
  const k = await p.evaluate(() => state.einst.k);
  if(k !== 55) throw new Error('K = ' + k);
  return 'K = ' + k;
});

console.log('\n== Abgleich beim Zurückkehren ==');
await schritt('Sichtbarwerden stößt einen Abgleich an', async () => {
  await p.evaluate(() => { ghSha = 'veraltet'; clearTimeout(schreibTimer); schreibTimer = null; });
  const vor = holen;
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(600);
  if(holen <= vor) throw new Error('es wurde nichts geholt');
  return holen - vor + ' Abruf(e)';
});

await schritt('Bei unverändertem sha wird die Datei nicht geladen', async () => {
  await p.evaluate(() => { ghSha = 'abc'; clearTimeout(schreibTimer); schreibTimer = null; });
  const o = ordnerAbrufe, d = dateiAbrufe;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(400);
  if(ordnerAbrufe <= o) throw new Error('der Ordner wurde nicht gefragt');
  if(dateiAbrufe > d) throw new Error('die Datei wurde trotzdem geladen');
  return 'ein Ordner-Abruf, kein Datei-Abruf';
});

await schritt('Bei geändertem sha wird sie geladen', async () => {
  await p.evaluate(() => { ghSha = 'anders'; clearTimeout(schreibTimer); schreibTimer = null; });
  const d = dateiAbrufe;
  await p.evaluate(() => abgleichen());
  await p.waitForTimeout(400);
  if(dateiAbrufe <= d) throw new Error('die Datei wurde nicht geladen');
  return 'Datei nachgeladen';
});

await schritt('Der frisch-Handler bleibt für den Fehlerbildschirm', async () => {
  const da = await p.evaluate(() => typeof tu.frisch === 'function');
  if(!da) throw new Error('tu.frisch fehlt');
});

console.log('\n== Nichts hängt in der Luft ==');
await schritt('Kein Verweis mehr auf ein Deckel-Erklärblatt', async () => {
  const offen = await p.evaluate(() => {
    const n = [...document.querySelectorAll('[data-was]')].map(e => e.dataset.was);
    return n.filter(x => !ERKLAERUNGEN[x]);
  });
  if(offen.length) throw new Error('ohne Blatt: ' + offen.join(', '));
});

await schritt('Jede data-tu-Aktion hat einen Handler', async () => {
  await p.evaluate(() => { ansicht = 'info'; zeichnen(); });
  const offen = await p.evaluate(() => {
    const n = new Set(); document.querySelectorAll('[data-tu]').forEach(e => n.add(e.dataset.tu));
    return [...n].filter(x => typeof tu[x] !== 'function');
  });
  if(offen.length) throw new Error('ohne Handler: ' + offen.join(', '));
});

await schritt('Die Anleitung erwähnt keine Obergrenze mehr als Regler', async () => {
  const t = await p.locator('#app').innerText();
  if(/schaltet ihn|hinterm Zahnrad an|8 BE je Tag/i.test(t)) throw new Error('Verweis auf den Regler steht noch');
});

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Konsolen-/Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
