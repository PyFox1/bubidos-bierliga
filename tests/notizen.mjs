// Stehen die Änderungsnotizen in den Einstellungen, und holt der Knopf ältere dazu?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8953);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8953/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const einst = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'}];
  state.aktivWe = null; ansicht = 'einst'; notizenStufe = 0; zeichnen();
});
await einst();
await p.waitForTimeout(300);

const meta = await p.evaluate(() => ({
  fassung: FASSUNG, start: NOTIZ_START, anzahl: NOTIZ_ANZAHL,
  notizen: NOTIZEN.map(n => n.f), oben: NOTIZEN[0],
  alle: NOTIZEN.map(n => ({f:n.f, d:n.d, z:n.z, p:n.punkte}))
}));
/* So oft muss getippt werden, bis alles offen liegt: die erste steht schon da, der Rest
   kommt in Dreierschritten. Ohne Deckel richtet sich das allein danach, wie viele Notizen
   hinterlegt sind. */
const tipps = Math.ceil(Math.max(0, meta.notizen.length - meta.start) / meta.anzahl);

console.log('\n══ Was hinterlegt ist ══');
console.log('  Fassung : ' + meta.fassung);
console.log('  Stufen  : ' + meta.start + ' offen, je ' + meta.anzahl
  + ' nachholbar – ' + tipps + ' Tipps bis zur ältesten');
meta.alle.forEach(n => console.log('  ' + n.f + ' · ' + n.d + ' · ' + n.z));

/* Die oberste Notiz ersetzt die frühere Fußzeile. Läuft sie gegen FASSUNG aus dem
   Ruder, zeigt die App eine falsche Fassung an – und das fällt niemandem auf. */
await schritt('Die oberste Notiz trägt genau die laufende Fassung', async () => {
  const m = meta.fassung.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}) · (G\d+)/);
  if(!m) throw new Error('FASSUNG hat ein unerwartetes Format: ' + meta.fassung);
  const [, jahr, monat, tag, zeit, nr] = m;
  const soll = {f:nr, d:tag + '.' + monat + '.' + jahr, z:zeit};
  const ist = {f:meta.oben.f, d:meta.oben.d, z:meta.oben.z};
  if(JSON.stringify(ist) !== JSON.stringify(soll))
    throw new Error('FASSUNG sagt ' + JSON.stringify(soll)
      + ', die Notiz sagt ' + JSON.stringify(ist));
  return nr + ' · ' + soll.d + ' · ' + soll.z;
});

await schritt('Jede Notiz hat Datum und Uhrzeit', async () => {
  const kaputt = meta.alle.filter(n => !/^\d{2}\.\d{2}\.\d{4}$/.test(n.d || '')
    || !/^\d{2}:\d{2}$/.test(n.z || ''));
  if(kaputt.length) throw new Error('ohne saubere Zeitangabe: '
    + kaputt.map(n => n.f).join(', '));
  return meta.alle.length + ' Notizen';
});

/* Der Nutzer soll lesen, was er anders vorfindet – nicht, welche Funktion angefasst
   wurde. Quelltext-Vokabular und Floskeln haben in den Notizen nichts verloren. */
await schritt('Keine Quelltext-Begriffe und keine Floskeln in den Notizen', async () => {
  const verboten = /\b(Funktion|Klasse|Variable|Parameter|Timer|Commit|Regex|null|undefined|refactor|API|Endpunkt|Handler|Callback|State|Array|Objekt|zusammenfuehren|fazitVon|zeichnen|sha|ETag|diverse Verbesserungen|kleinere Fehler behoben|Bugfixes|Stabilität verbessert|Optimierungen)\b/i;
  const treffer = [];
  meta.alle.forEach(n => n.p.forEach(t => { if(verboten.test(t)) treffer.push(n.f + ': ' + t); }));
  if(treffer.length) throw new Error(treffer.join(' | '));
  return 'sauber';
});

await schritt('Keine Notiz ist eine leere Hülse', async () => {
  const duenn = meta.alle.filter(n => !n.p.length || n.p.some(t => t.length < 40));
  if(duenn.length) throw new Error('zu dünn: ' + duenn.map(n => n.f).join(', '));
  return 'alle mit Inhalt';
});

await schritt('Die alte Fassungs-Fußzeile steht nicht mehr doppelt darunter', async () => {
  const t = await p.evaluate(() => document.body.innerText);
  if(/Fassung\s+\d{4}-\d{2}-\d{2}/.test(t))
    throw new Error('die Fußzeile mit FASSUNG steht noch in den Einstellungen');
  return 'weg, die Notiz trägt die Kennung';
});

await schritt('Die laufende Fassung ist trotzdem ablesbar', async () => {
  const t = await p.evaluate(() => document.body.innerText);
  if(!t.includes(meta.oben.f) || !t.includes(meta.oben.z))
    throw new Error('weder Kennung noch Uhrzeit stehen da');
  return meta.oben.f + ' · ' + meta.oben.d + ' · ' + meta.oben.z;
});

console.log('\n══ Der Ausgangszustand ══');

/* Gezählt wird an den Fassungsköpfen, nicht am Fließtext: nur so fällt auf, wenn eine
   Notiz zwar im Text steht, aber ohne ihre Kennung gezeichnet wurde. */
const sichtbar = () => p.evaluate(() =>
  [...document.querySelectorAll('.notiz .fkopf')].map(x => x.textContent.split(' · ')[0]));

await schritt('Von Haus aus steht nur die laufende Fassung offen da', async () => {
  const s = await sichtbar();
  const soll = meta.notizen.slice(0, meta.start);
  if(JSON.stringify(s) !== JSON.stringify(soll))
    throw new Error('sichtbar: ' + s.join(', ') + ' statt ' + soll.join(', '));
  return s.join(', ');
});

await schritt('Die zweite ist noch nicht dabei', async () => {
  const s = await sichtbar();
  if(s.includes(meta.notizen[meta.start]))
    throw new Error(meta.notizen[meta.start] + ' steht da, obwohl noch nicht geholt');
  return meta.notizen[meta.start] + ' bleibt weg';
});

/* Ohne diesen Knopf käme man an die Historie nicht heran, und mit einem „einklappen"
   im Ausgangszustand stünde ein Knopf da, der nichts zu tun hat. */
const knoepfe = () => p.evaluate(() => [...document.querySelectorAll('[data-tu]')]
  .filter(x => x.dataset.tu.startsWith('notizen'))
  .map(x => x.dataset.tu + ':' + x.textContent.trim()));

await schritt('Es steht ein Hol-Knopf da und noch kein Einklappen', async () => {
  const k = await knoepfe();
  if(!k.some(x => x.startsWith('notizenMehr:'))) throw new Error('kein Hol-Knopf: ' + k.join(' | '));
  if(k.some(x => x.startsWith('notizenZu:')))
    throw new Error('„Wieder einklappen" steht da, obwohl nichts ausgeklappt ist');
  return k.join(' | ');
});

/* Die Beschriftung sagt nicht, wie viele noch kommen – sie soll auf jeder Stufe
   dieselbe sein, sonst rät man beim Tippen, wie weit es noch geht. */
await schritt('Der Hol-Knopf heißt schlicht „Ältere Fassungen"', async () => {
  const k = (await knoepfe()).find(x => x.startsWith('notizenMehr:'));
  const t = k.slice('notizenMehr:'.length);
  if(t !== 'Ältere Fassungen') throw new Error('heißt „' + t + '"');
  return t;
});

await p.screenshot({path:ORDNER + 'notizen-zu.png', fullPage:true});

console.log('\n══ Nachholen in Dreierschritten ══');

for(let i = 1; i <= tipps; i++){
  await schritt(i + '. Tipp holt drei weitere dazu', async () => {
    await p.evaluate(() => tu.notizenMehr());
    await p.waitForTimeout(200);
    const s = await sichtbar();
    const soll = Math.min(meta.start + meta.anzahl * i, meta.notizen.length);
    if(s.length !== soll) throw new Error('zeigt ' + s.length + ' statt ' + soll);
    return s.length + ' Fassungen: ' + s.join(', ');
  });
}

/* Ohne Deckel ist das Ende die Historie selbst – der Knopf darf genau dann gehen,
   wenn die älteste Notiz dasteht, und keinen Tipp früher. */
await schritt('Am Ende steht die ganze Historie da', async () => {
  const s = await sichtbar();
  if(JSON.stringify(s) !== JSON.stringify(meta.notizen))
    throw new Error('sichtbar: ' + s.join(', ') + ' statt aller ' + meta.notizen.length);
  return s.length + ' Fassungen bis ' + s[s.length - 1];
});

await schritt('Dann ist der Hol-Knopf weg, das Einklappen bleibt', async () => {
  const k = await knoepfe();
  if(k.some(x => x.startsWith('notizenMehr:')))
    throw new Error('holt weiter, obwohl nichts mehr kommt');
  if(!k.some(x => x.startsWith('notizenZu:'))) throw new Error('kein Einklappen: ' + k.join(' | '));
  return k.join(' | ');
});

await schritt('Ein Tipp zu viel ändert nichts mehr', async () => {
  const vorher = (await sichtbar()).length;
  await p.evaluate(() => { tu.notizenMehr(); tu.notizenMehr(); });
  await p.waitForTimeout(200);
  const s = await sichtbar();
  if(s.length !== vorher) throw new Error('zeigt plötzlich ' + s.length + ' statt ' + vorher);
  const st = await p.evaluate(() => notizenStufe);
  if(st !== tipps) throw new Error('die Stufe ist auf ' + st + ' weitergelaufen');
  return 'bleibt bei ' + s.length;
});

await p.screenshot({path:ORDNER + 'notizen-auf.png', fullPage:true});

await schritt('Ein Neuzeichnen klappt sie nicht wieder zu', async () => {
  const vorher = (await sichtbar()).length;
  await p.evaluate(() => zeichnen());
  await p.waitForTimeout(200);
  const nachher = (await sichtbar()).length;
  if(nachher !== vorher)
    throw new Error('nach dem Neuzeichnen ' + nachher + ' statt ' + vorher
      + ' – der Abgleich würde das dauernd tun');
  return 'bleibt bei ' + nachher;
});

await schritt('„Wieder einklappen" führt auf die laufende Fassung zurück', async () => {
  await p.evaluate(() => tu.notizenZu());
  await p.waitForTimeout(200);
  const s = await sichtbar();
  if(s.length !== meta.start) throw new Error('zeigt ' + s.length + ' statt ' + meta.start);
  return s.join(', ');
});

console.log('\n══ Hängt jede data-tu-Aktion an einem Handler? ══');
await schritt('Auf jeder Stufe', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    const sammeln = () => [...document.querySelectorAll('[data-tu]')]
      .forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    sammeln();
    for(let i = 0; NOTIZ_START + i * NOTIZ_ANZAHL <= NOTIZEN.length; i++){
      notizenStufe = i; zeichnen(); sammeln(); }
    notizenStufe = 0; zeichnen();
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log('');
await b.close(); srv.close();
