/* Einmal-Skript: der echte Aufruf gegen die Anthropic-API, kein Mock.
   Alle anderen Tests fälschen die Antwort und prüfen nur die Mechanik. Dieser hier
   beantwortet die Fragen, die ein Mock nicht beantworten kann:
     - Lässt die API einen Aufruf direkt aus dem Browser durch
       (`anthropic-dangerous-direct-browser-access`)?
     - Funktioniert die Websuche auf diesem Weg?
     - Wie sieht ein echter Nachrichtenbezug aus, und hält er sich an die Verbote?

   Läuft absichtlich nicht in der normalen Runde mit: kostet Geld und braucht Netz.

   Aufruf:   ANTHROPIC_API_KEY=sk-ant-… node tests/echt-ki.mjs        (25 – drei Aufrufe)
             ANTHROPIC_API_KEY=sk-ant-… node tests/echt-ki.mjs 10     (nur einer)
   Ergebnis: tests/bilder/echt-*.png und der Wortlaut auf der Konsole.

   Der Schlüssel wird nur an die API geschickt, nirgends geloggt und nirgends abgelegt.

   Braucht eine Umgebung, in der **der Browser** TLS zu api.anthropic.com aufbauen kann.
   Hinter einem abfangenden Proxy (manche Agenten-Sandbox) scheitert der Aufruf nach
   ein bis zwei Sekunden mit ERR_CERT_AUTHORITY_INVALID, `urkundeHolen()` schluckt das,
   und oben steht dann „ERSATZTEXT“ — was wie ein Fehler der App aussieht und keiner ist.
   Gegenprobe in so einem Fall: denselben Rumpf per curl schicken. Geht das durch, liegt
   es an der Umgebung. Am Handy über GitHub Pages stellt sich die Frage nicht. */
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const SCHLUESSEL = process.env.ANTHROPIC_API_KEY || '';
if(!SCHLUESSEL){
  console.error('\nKein Schlüssel. So geht es:\n'
    + '  ANTHROPIC_API_KEY=sk-ant-… node tests/echt-ki.mjs\n');
  process.exit(2);
}

const STUFE = Number(process.argv[2]) || 25;
const html  = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8964);

const b = await chromium.launch({executablePath:
  process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:2});
p.on('pageerror', e => console.error('PAGEERROR:', e.message));
p.on('console', m => {
  if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text()))
    console.error('FANGNETZ:', m.text());
});
/* Nur GitHub wird abgefangen – die Anthropic-Aufrufe gehen wirklich raus. */
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8964/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(900);

await p.evaluate(v => {
  localStorage.removeItem('bubidos-urkunden');
  const bier = k => Array(k).fill('normal:05');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.we = [{id:900, titel:'Nockherberg', datum:new Date().toISOString().slice(0,10),
    zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:10, name:'Zum Ochsen', getraenke:{'1':[], '2':[], '3':[]}, log:[]},
      {id:11, name:'Augustiner',
       getraenke:{'1':bier(v.stufe - 1), '2':bier(6), '3':bier(4)}, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  state.einst = {k:40, kiSchluessel:v.k};
  ansicht = null; nachfrage = null; pinLoeschen(); zeichnen();
}, {k:SCHLUESSEL, stufe:STUFE});
await p.waitForTimeout(300);

console.log('\n════ Was an die API geht ════\n');
console.log(await p.evaluate(s => urkundeAnweisung(state.we[0].tage[0],
  {id:'901:' + s + ':1', stufe:s, pid:'1', be:s, ort:'Augustiner'}), STUFE));

/* Ein Strich auf Stufe 25 reißt auch die 10 und die 18 – seit jeder seine eigene Urkunde
   bekommt, sind das drei Marken und drei Aufrufe. Das kostet dreimal, zeigt dafür aber
   genau das, worauf es ankommt: drei Texte, drei verschiedene Nachrichtenbezüge. Wer nur
   einen zahlen will, ruft mit `10` auf. */
const erwartet = [10, 18, 25].filter(s => s <= STUFE);
console.log('\n════ Aufruf läuft (' + erwartet.length + ' Urkunde'
  + (erwartet.length > 1 ? 'n, also ' + erwartet.length + ' Aufrufe' : '') + ') ════');
const start = Date.now();
await p.evaluate(() => tu.strich({dataset:{id:'1'}}));

let alle = [];
for(let i = 0; i < 60; i++){
  await p.waitForTimeout(1500);
  alle = await p.evaluate(() => (state.we[0].tage[0].marken || [])
    .slice().sort((a,b) => a.stufe - b.stufe)
    .map(x => ({stufe:x.stufe, quelle:x.quelle, text:x.text, kopf:x.kopf,
                laeuft:urkundeLaeuft.has(x.id)})));
  if(alle.length >= erwartet.length && alle.every(x => !x.laeuft)) break;
  process.stdout.write('.');
}
const dauer = Math.round((Date.now() - start)/100)/10;

console.log('\n\n════ Was zurückkam (nach ' + dauer + ' s) ════');
if(!alle.length){ console.log('\nGar keine Marke – da stimmt etwas anderes nicht.'); }
const wetter = /wetter|hitze|regen|unwetter|grad celsius|temperatur|sonnensch|schnee|sturm/i;
alle.forEach(m => {
  console.log('\n──── Stufe ' + m.stufe + ' ────');
  console.log('Quelle:  ' + m.quelle + (m.quelle === 'ki'
    ? '   (von der API)' : '   ← ERSATZTEXT, der Aufruf ist nicht durchgekommen'));
  if(m.kopf) console.log('\nÜberschrift:\n  ' + m.kopf);
  console.log('\nText:');
  console.log('  ' + (m.text || '').replace(/(.{78} )/g, '$1\n  '));
  const alles = (m.text || '') + ' ' + (m.kopf || '');
  console.log(wetter.test(alles) ? '\n  WETTER: Das Verbot hat nicht gehalten.'
                                 : '\n  Kein Wetter. Gut.');
  const slang = ['zappt','zappen','gezappt','peter'].filter(w =>
    new RegExp(w, 'i').test(alles));
  console.log('  Slang:  ' + (slang.length ? slang.join(', ') : 'keiner benutzt'));
  /* Die Frage, für die es dieses Skript gibt: Steht wirklich eine Nachricht im Text?
     Das Modell muss sie in `bezug` benennen — fehlt der, hat es sie weggelassen, und
     genau das ist am Tisch aufgefallen, obwohl der Wortschatz saß. */
  console.log('  Bezug:  ' + (m.bezug || '← KEINER, die halbe Pointe fehlt'));
});

/* Der eigentliche Zweck des Skripts: Kam überhaupt etwas von der API, oder hat sich der
   Ersatztext nur gut getarnt? */
console.log('\n════ Fazit ════');
const ki = alle.filter(x => x.quelle === 'ki').length;
console.log(ki === alle.length && ki
  ? '  Alle ' + ki + ' Texte kamen von der API. Websuche und Browser-Zugriff gehen.'
  : '  Nur ' + ki + ' von ' + alle.length + ' kamen durch – oben steht, welche.');
const mitBezug = alle.filter(x => x.bezug).length;
console.log(mitBezug === alle.length && mitBezug
  ? '  Alle ' + mitBezug + ' haben einen Nachrichtenbezug.'
  : '  Nur ' + mitBezug + ' von ' + alle.length + ' haben einen Nachrichtenbezug.');

const datei = ORDNER + 'echt-' + STUFE + '.png';
await p.evaluate(async s => {
  const tg = state.we[0].tage[0];
  const c = await urkundeBild(tg.marken.find(x => x.stufe === s), tg, '1');
  document.body.innerHTML = '<img id="ub" style="width:540px;display:block" src="'
    + c.toDataURL('image/png') + '">';
}, STUFE);
await p.waitForTimeout(500);
await p.locator('#ub').screenshot({path: datei});
console.log('\nBild: ' + datei + '\n');

await b.close(); srv.close();
