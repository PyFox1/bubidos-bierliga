// Der Weg über die API: Was geht raus, was kommt an, was steht danach da.
// Die Antwort ist gefälscht – geprüft wird die Mechanik, nicht das Modell.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8966);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:2});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
p.on('console', m => {
  if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text()))
    fehler.push('FANGNETZ: ' + m.text());
});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* So sieht eine echte Antwort mit Websuche aus: Vorrede, Suchanfrage, Suchergebnis,
   und erst ganz zuletzt die eigentliche Antwort. */
const antwort = (kopf, text) => ({
  id:'msg_test', type:'message', role:'assistant', stop_reason:'end_turn',
  content:[
    {type:'text', text:'Ich schaue kurz, was heute in den Nachrichten steht.'},
    {type:'server_tool_use', id:'srvtoolu_1', name:'web_search',
     input:{query:'Nachrichten Deutschland heute'}},
    {type:'web_search_tool_result', tool_use_id:'srvtoolu_1', content:[
      {type:'web_search_result', title:'Tagesschau', url:'https://example.invalid/x',
       encrypted_content:'…'}]},
    {type:'text', text:JSON.stringify(kopf ? {kopf, text} : {text})}
  ]
});

let letzterLeib = null;
const kiMock = (kopf, text) => p.route('**/api.anthropic.com/**', r => {
  letzterLeib = JSON.parse(r.request().postData() || '{}');
  r.fulfill({status:200, contentType:'application/json',
    body:JSON.stringify(antwort(kopf, text))});
});

await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));

const KOPF10 = 'Korbi zappt sich zweistellig';
const TEXT10 = 'Zehn Biereinheiten. Während anderswo noch über die Abschaffung der '
  + 'Zeitumstellung gestritten wird, hat Korbi seine eigene längst vollzogen — '
  + 'ordnungspetergemäß dokumentiert und ohne jede Debatte.';
const TEXT25 = 'Fünfundzwanzig Biereinheiten. Der Wetterdienst meldete heute den wärmsten '
  + 'Septembertag seit Beginn der Aufzeichnungen; Korbi hat seinen Rekord unabhängig davon '
  + 'und bei Zimmertemperatur aufgestellt. Was er weggezappt hat, wird in dieser Runde noch '
  + 'in Jahren als Maßeinheit herhalten müssen.';

await kiMock(KOPF10, TEXT10);
await p.goto('http://localhost:8966/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(700);

const aufbau = v => p.evaluate(v => {
  localStorage.removeItem('bubidos-urkunden');
  const bier = k => Array(k).fill('normal:05');
  const g = {}; Object.keys(v.be).forEach(id => g[id] = bier(v.be[id]));
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:10, name:'Zum Ochsen', getraenke:{'1':[], '2':[], '3':[]}, log:[]},
      {id:11, name:'Augustiner', getraenke:g, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  state.einst = {k:40, kiSchluessel:'sk-ant-test'};   // Schlüssel liegt vor
  ansicht = null; nachfrage = null; pinLoeschen(); zeichnen();
}, v);

const marke = s => p.evaluate(s =>
  (state.we[0].tage[0].marken || []).find(m => m.stufe === s), s);

console.log('\n══ Was rausgeht ══');

await aufbau({be:{'1':9, '2':2, '3':1}});
await p.waitForTimeout(200);
await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
await p.waitForTimeout(600);

await schritt('Die Websuche ist als Werkzeug mitgeschickt', async () => {
  const t = (letzterLeib.tools || [])[0];
  if(!t) throw new Error('gar kein Werkzeug im Aufruf');
  if(!/web_search/.test(t.type)) throw new Error('Werkzeug: ' + t.type);
  return t.type;
});

await schritt('Die Anweisung verlangt den Nachrichtenbezug', async () => {
  const t = letzterLeib.messages[0].content;
  ['Nachricht', 'nicht von heute sein', 'letzten', 'weder Quelle noch Schlagzeile']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
  if(t.indexOf('Bierpetereinheiten') < 0) throw new Error('Slang-Beispiele fehlen');
  return 'Bezug, Zeitfenster und Slang stehen drin';
});

console.log('\n══ Was ankommt ══');

await schritt('Der Text von der API ersetzt den Ersatztext', async () => {
  const m = await marke(10);
  if(m.quelle !== 'ki') throw new Error('Quelle ' + m.quelle);
  if(m.text !== TEXT10) throw new Error('Text: ' + m.text.slice(0,70));
  if(m.kopf !== KOPF10) throw new Error('Kopf: ' + m.kopf);
  return 'quelle: ki';
});

await schritt('Vorrede und Suchblöcke stören das Auslesen nicht', async () => {
  const m = await marke(10);
  if(/Ich schaue kurz/.test(m.text)) throw new Error('die Vorrede ist im Text gelandet');
  if(/web_search|tagesschau/i.test(m.text)) throw new Error('Suchblock im Text');
});

await schritt('Er steht auch in der Eilmeldung auf dem Bildschirm', async () => {
  const t = await p.evaluate(() => {
    const e = document.querySelector('.u-blende'); return e ? e.innerText : null; });
  if(!t) throw new Error('keine Blende');
  if(t.indexOf('Zeitumstellung') < 0) throw new Error('Text fehlt: ' + t.slice(0,120));
  await p.screenshot({path: ORDNER + 'ki-stufe10.png'});
});

console.log('\n══ Auf dem Bild zum Aufheben ══');

await kiMock(null, TEXT25);
await aufbau({be:{'1':24, '2':2, '3':1}});
await p.waitForTimeout(200);
await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
await p.waitForTimeout(900);

await schritt('Auch die Ehrenurkunde bekommt den Text', async () => {
  const m = await marke(25);
  if(m.quelle !== 'ki') throw new Error('Quelle ' + m.quelle);
  if(m.text.indexOf('Septembertag') < 0) throw new Error('Text: ' + m.text.slice(0,70));
  return 'quelle: ki';
});

await p.evaluate(async () => {
  const tg = state.we[0].tage[0];
  const c = await urkundeBild(tg.marken.find(x => x.stufe === 25), tg, '1');
  document.body.innerHTML = '<img id="ub" style="width:540px;display:block" src="'
    + c.toDataURL('image/png') + '">';
});
await p.waitForTimeout(400);
await p.locator('#ub').screenshot({path: ORDNER + 'ki-bild-25.png'});

console.log('\n══ Wenn die API nicht liefert ══');

await p.reload(); await p.waitForTimeout(600);

await schritt('Bei einem Fehler bleibt der Ersatztext stehen', async () => {
  await p.route('**/api.anthropic.com/**', r => r.fulfill({status:500, body:'{}'}));
  await aufbau({be:{'1':9, '2':2, '3':1}});
  await p.waitForTimeout(200);
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(700);
  const m = await marke(10);
  if(m.quelle !== 'ersatz') throw new Error('Quelle ' + m.quelle);
  if(!m.text || m.text.length < 30) throw new Error('kein Text');
  return 'quelle: ersatz';
});

await schritt('Bei Unsinn statt JSON ebenso', async () => {
  await p.route('**/api.anthropic.com/**', r => r.fulfill({status:200,
    contentType:'application/json',
    body:JSON.stringify({content:[{type:'text', text:'Tut mir leid, das geht nicht.'}]})}));
  await aufbau({be:{'1':17, '2':2, '3':1}});
  await p.waitForTimeout(200);
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(700);
  const m = await marke(18);
  if(m.quelle !== 'ersatz') throw new Error('Quelle ' + m.quelle);
  return 'quelle: ersatz';
});

await schritt('Und wenn gar kein Schlüssel hinterlegt ist, wird nicht gefragt', async () => {
  let gefragt = false;
  await p.route('**/api.anthropic.com/**', r => { gefragt = true; r.abort(); });
  await p.evaluate(() => { state.einst.kiSchluessel = ''; });
  await aufbau({be:{'1':9, '2':2, '3':1}});
  await p.evaluate(() => { state.einst.kiSchluessel = ''; });
  await p.waitForTimeout(200);
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(600);
  if(gefragt) throw new Error('es wurde trotzdem angefragt');
  const m = await marke(10);
  if(m.quelle !== 'ersatz') throw new Error('Quelle ' + m.quelle);
  return 'kein Aufruf';
});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
