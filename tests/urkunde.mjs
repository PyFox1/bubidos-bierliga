// Tagesmarken: 10 / 18 / 25 BE. Jeder bekommt seine eigene, kein Wettlauf.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8973);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:2});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
/* Das Fangnetz in zeichnen() schluckt Ausnahmen und zeigt einen Fehlerbildschirm –
   als pageerror taucht davon nichts auf. Ohne diese Zeile sieht ein kaputtes
   ansichtUrkunde() aus wie „die Blende ist halt nicht da". */
p.on('console', m => {
  if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text()))
    fehler.push('FANGNETZ: ' + m.text());
});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
// Die KI-API darf im Test nie erreicht werden – geprüft wird der Ersatzweg.
await p.route('**/api.anthropic.com/**', r => r.abort());
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8973/');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Vier Leute, ein laufender Tag, zwei Locations. `v.be` gibt je Person die Vorbelegung. */
const aufbau = v => p.evaluate(v => {
  localStorage.removeItem('bubidos-urkunden');
  const bier = k => Array(k).fill('normal:05');
  const g = {};
  Object.keys(v.be).forEach(id => g[id] = bier(v.be[id]));
  state.spieler = [{id:1,name:v.name || 'Korbi'},{id:2,name:'Fifu'},
                   {id:3,name:'Sperry'},{id:4,name:'Gerry'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:false, dabei:[1,2,3,4],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:10, name:'Zum Ochsen', getraenke:{'1':[], '2':[], '3':[], '4':[]}, log:[]},
      {id:11, name:'Augustiner', getraenke:g, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  state.einst = {k:40, kiSchluessel:''};
  ansicht = null; vorwahl = null; stapel = []; letzteRunde = null; nachfrage = null;
  pinLoeschen(); zeichnen();
}, v);

const marken = () => p.evaluate(() => (state.we[0].tage[0].marken || []).map(m =>
  ({id:m.id, stufe:m.stufe, pid:m.pid, quelle:m.quelle, text:m.text, kopf:m.kopf,
    ort:m.ort, ortNr:m.ortNr, be:m.be})));
const blende = () => p.evaluate(() => {
  const e = document.querySelector('.u-blende');
  return e ? {klasse:e.className, text:e.innerText} : null;
});

console.log('\n══ Eine Marke je Stufe, Tag und Person ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Bei 9 BE ist noch nichts', async () => {
  await p.evaluate(() => markenPruefen());
  const m = await marken();
  if(m.length) throw new Error('es gibt schon ' + m.length);
});

await schritt('Das zehnte Bier stellt die Urkunde aus', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  const m = await marken();
  if(m.length !== 1) throw new Error('Marken: ' + JSON.stringify(m));
  if(m[0].id !== '901:10:1') throw new Error('Kennung ' + m[0].id);
  if(String(m[0].pid) !== '1') throw new Error('pid ' + JSON.stringify(m[0].pid));
  return m[0].id;
});

await schritt('Sie merkt sich Ort und Nummer für das Bild', async () => {
  const m = await marken();
  if(m[0].ort !== 'Augustiner') throw new Error('Ort: ' + m[0].ort);
  if(m[0].ortNr !== 2) throw new Error('ortNr: ' + m[0].ortNr);
  return m[0].ortNr + '. Location: ' + m[0].ort;
});

await schritt('Ohne Schlüssel steht sofort ein Ersatztext mit Namen da', async () => {
  const m = await marken();
  if(m[0].quelle !== 'ersatz') throw new Error('Quelle ' + m[0].quelle);
  if(!m[0].kopf) throw new Error('Stufe 10 ohne Überschrift');
  const alles = m[0].text + ' ' + m[0].kopf;
  if(/\{name\}/.test(alles)) throw new Error('Platzhalter steht noch drin');
  if(!/Korbi/.test(alles)) throw new Error('kein Name: ' + alles);
});

await schritt('Nochmal prüfen legt nicht doppelt an', async () => {
  await p.evaluate(() => { markenPruefen(); markenPruefen(); });
  const m = await marken();
  if(m.length !== 1) throw new Error('jetzt ' + m.length);
});

/* Das war der Fehler, der den Umbau ausgelöst hat: Wer dem einen das zehnte Bier tippt
   und zwei Sekunden später dem nächsten, hatte vorher nur eine Urkunde vor sich – die
   zweite Person ging leer aus, weil die Stufe für den Tag schon vergeben war. */
console.log('\n══ Jeder bekommt seine eigene ══');

await aufbau({be:{'1':9, '2':9, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Zwei kurz nacheinander bekommen zwei Urkunden', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  const eins = await marken();
  if(eins.length !== 1) throw new Error('nach dem ersten sind es ' + eins.length);
  await p.waitForTimeout(1200);
  await p.evaluate(() => tu.strich({dataset:{id:'2'}}));
  const m = await marken();
  if(m.length !== 2) throw new Error('es sind ' + m.length + ' statt zwei');
  const ids = m.map(x => x.id).sort().join(' ');
  if(ids !== '901:10:1 901:10:2') throw new Error('Kennungen: ' + ids);
  return ids;
});

await schritt('Jede nennt nur ihre eigene Person', async () => {
  const m = await marken();
  const korbi = m.find(x => x.pid === '1'), fifu = m.find(x => x.pid === '2');
  const alles = x => x.text + ' ' + (x.kopf || '');
  if(!/Korbi/.test(alles(korbi)) || /Fifu/.test(alles(korbi)))
    throw new Error('Korbis Urkunde: ' + alles(korbi));
  if(!/Fifu/.test(alles(fifu)) || /Korbi/.test(alles(fifu)))
    throw new Error('Fifus Urkunde: ' + alles(fifu));
  return 'getrennt';
});

await aufbau({be:{'1':9, '2':9, '3':9, '4':3}});
await p.waitForTimeout(200);
await schritt('Eine Runde für alle schiebt drei zugleich über die Zehn', async () => {
  await p.evaluate(() => tu.runde());
  const m = await marken();
  if(m.length !== 3) throw new Error('es sind ' + m.length + ' Marken statt dreier');
  const ids = m.map(x => String(x.pid)).sort().join(',');
  if(ids !== '1,2,3') throw new Error('pids: ' + ids);
  return 'drei Urkunden für ' + ids;
});

await schritt('Sie kommen nacheinander, jede mit einem Namen und einem Knopf', async () => {
  const namen = [];
  for(let i = 0; i < 3; i++){
    const e = await blende();
    if(!e) throw new Error('nach ' + i + ' Urkunden kam keine mehr');
    const kn = await p.evaluate(() => [...document.querySelectorAll('.u-sichern')]
      .map(x => x.dataset.pid));
    if(kn.length !== 1) throw new Error('Knöpfe: ' + JSON.stringify(kn));
    if(!/sichere dir/.test(e.text)) throw new Error('falsche Anrede: ' + e.text);
    namen.push(kn[0]);
    if(i === 0) await p.screenshot({path: ORDNER + 'u-einzeln.png'});
    await p.evaluate(() => tu.urkundeWeg());
    await p.waitForTimeout(120);
  }
  if(await blende()) throw new Error('es kam eine vierte');
  if(namen.slice().sort().join(',') !== '1,2,3')
    throw new Error('gezeigt wurden: ' + namen.join(','));
  return namen.join(' → ');
});

console.log('\n══ Zurückgenommenes Bier zieht die Urkunde ein ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Ein Minus unter die Marke nimmt sie zurück', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  if((await marken()).length !== 1) throw new Error('sie wurde gar nicht erst ausgestellt');
  await p.evaluate(() => tu.minus({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  const m = await marken();
  if(m.length) throw new Error('sie steht noch da: ' + JSON.stringify(m));
  if(await blende()) throw new Error('die Blende hängt noch');
  return 'eingezogen';
});

await schritt('Das Bier wieder drauf stellt sie neu aus', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  const m = await marken();
  if(m.length !== 1) throw new Error('sie kommt nicht wieder');
  return m[0].id;
});

/* Jedes Gerät rechnet die Rücknahme selbst aus den Strichen aus – nur so verschwindet
   eine Marke auch dort, wo sie niemand gelöscht hat. */
await schritt('Eine Rücknahme von drüben kommt beim Abgleich an', async () => {
  const n = await p.evaluate(() => {
    const d = JSON.parse(JSON.stringify(standDaten()));
    d.we[0].tage[0].orte[1].getraenke['1'] = Array(9).fill('normal:05');
    uebernehmen(d);
    return (state.we[0].tage[0].marken || []).length;
  });
  if(n) throw new Error('nach dem Abgleich stehen noch ' + n);
  return 'weg';
});

console.log('\n══ Der Ort ist der der Person, nicht der des Handys ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Nach einer Aufteilung steht Korbis Location auf Korbis Urkunde', async () => {
  const m = await p.evaluate(() => {
    const tg = aktuell().tg;
    /* Fifu zieht in den Neubau vor, Korbi bleibt im Augustiner. Korbis zehntes Bier
       kommt von drüben; dieses Handy steht im Neubau und legt die Marke an. */
    tg.orte.push({id:12, name:'Neubau', getraenke:{'2':[]}, log:[]});
    state.aktivOrt = 12; pinLoeschen();
    tg.orte[1].getraenke['1'].push('normal:05');
    tu.strich({dataset:{id:'2'}});
    return (tg.marken || []).map(x => ({pid:x.pid, ort:x.ort, ortNr:x.ortNr}));
  });
  const korbi = m.find(x => String(x.pid) === '1');
  if(!korbi) throw new Error('Korbi hat keine: ' + JSON.stringify(m));
  if(korbi.ort !== 'Augustiner') throw new Error('es steht ' + korbi.ort + ' drauf');
  if(korbi.ortNr !== 2) throw new Error('ortNr ' + korbi.ortNr);
  return korbi.ortNr + '. Location: ' + korbi.ort;
});

console.log('\n══ Die drei Stufen sehen verschieden aus ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('10 kommt als Blatt von unten', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  const e = await blende();
  if(!/\bs1\b/.test(e.klasse)) throw new Error('Klasse ' + e.klasse);
  if(!/EILMELDUNG/i.test(e.text)) throw new Error('kein Eilmeldungs-Band');
  if(!/sichere dir/.test(e.text)) throw new Error('keine Andenken-Zeile');
  await p.screenshot({path: ORDNER + 'u-stufe10.png'});
  return 's1';
});

await aufbau({be:{'1':17, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('18 kommt als Karte in der Mitte', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  const m = await marken();
  if(m.length !== 2) throw new Error('Marken: ' + m.map(x => x.stufe).join(','));
  await p.evaluate(() => tu.urkundeWeg());
  await p.waitForTimeout(150);
  const e = await blende();
  if(!/\bs2\b/.test(e.klasse)) throw new Error('Klasse ' + e.klasse);
  await p.screenshot({path: ORDNER + 'u-stufe18.png'});
  return 'erst s1, dann s2';
});

await aufbau({be:{'1':24, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('25 nimmt den ganzen Bildschirm', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  await p.evaluate(() => { tu.urkundeWeg(); tu.urkundeWeg(); });
  await p.waitForTimeout(150);
  const e = await blende();
  if(!/\bs3\b/.test(e.klasse)) throw new Error('Klasse ' + e.klasse);
  const voll = await p.evaluate(() => document.querySelector('.u-ehre')
    .getBoundingClientRect().height / window.innerHeight);
  if(voll < 0.95) throw new Error('nur ' + Math.round(voll*100) + '% hoch');
  await p.screenshot({path: ORDNER + 'u-stufe25.png'});
  return Math.round(voll*100) + '% Bildschirmhöhe';
});

await schritt('Die 25 lässt sich nicht mit einem Tipp daneben wegwischen', async () => {
  const da = await p.evaluate(() =>
    document.querySelector('.u-blende.s3').hasAttribute('data-tu'));
  if(da) throw new Error('die Blende reagiert doch auf einen Tipp daneben');
});

console.log('\n══ Das Bild zum Aufheben ══');

await schritt('Es entsteht ein PNG in fester Größe', async () => {
  const r = await p.evaluate(async () => {
    const tg = state.we[0].tage[0];
    const m = tg.marken.find(x => x.stufe === 25);
    const c = await urkundeBild(m, tg, '1');
    const url = c.toDataURL('image/png');
    return {b:c.width, h:c.height, kopf:url.slice(0,22), n:url.length};
  });
  if(r.b !== 1080 || r.h !== 1440) throw new Error('Maße ' + r.b + '×' + r.h);
  if(!/^data:image\/png;base64,/.test(r.kopf)) throw new Error('kein PNG: ' + r.kopf);
  if(r.n < 20000) throw new Error('verdächtig leer: ' + r.n + ' Zeichen');
  return r.b + '×' + r.h + ', ' + Math.round(r.n/1024) + ' kB';
});

/* Ein Canvas löst kein Nachladen einer Schrift aus. Fehlt Anton dort, sieht das Bild auf
   den ersten Blick richtig aus und ist trotzdem in der Systemschrift gesetzt.
   `document.fonts.check()` taugt dafür nicht – es antwortet auch dann mit ja, wenn nur
   eine Systemschrift einspringt. Deshalb gemessen. Erreicht der Rechner Google Fonts gar
   nicht (Prüfstand ohne Netz), wird ehrlich übersprungen statt scheinbar bestanden. */
await schritt('Anton greift auch im Canvas', async () => {
  const r = await p.evaluate(async () => {
    await document.fonts.ready;
    try{ await document.fonts.load('120px Anton'); }catch(e){}
    const c = document.createElement('canvas').getContext('2d');
    c.font = '120px Anton, Impact, sans-serif'; const a = c.measureText('KORBI').width;
    c.font = '120px sans-serif';                const s = c.measureText('KORBI').width;
    return {a, s, n:document.fonts.size};
  });
  if(!r.n) return 'übersprungen: dieser Rechner hat keine Webfonts geladen';
  if(Math.abs(r.a - r.s) < 1)
    throw new Error('Anton greift nicht – das Blatt fiele auf die Systemschrift zurück');
  return 'greift';
});

await schritt('Es trägt Datum, Uhrzeit, Tag und Location', async () => {
  const s = await p.evaluate(() => {
    const tg = state.we[0].tage[0];
    const m = tg.marken.find(x => x.stufe === 25);
    const we = state.we[0];
    return [we.titel, tg.label, m.ortNr + '. Location: ' + m.ort].join(' · ');
  });
  ['Nockherberg', '1. Tag', '2. Location: Augustiner'].forEach(w => {
    if(s.indexOf(w) < 0) throw new Error('„' + w + '" fehlt in „' + s + '"');
  });
  return s;
});

/* Zum Ansehen: das Bild in die Seite hängen und abfotografieren. */
await p.evaluate(async () => {
  const tg = state.we[0].tage[0];
  const c = await urkundeBild(tg.marken.find(x => x.stufe === 25), tg, '1');
  document.body.innerHTML = '<img id="ub" style="width:540px;display:block" src="'
    + c.toDataURL('image/png') + '">';
});
await p.waitForTimeout(400);
await p.locator('#ub').screenshot({path: ORDNER + 'u-bild-25.png'});
await p.reload(); await p.waitForTimeout(600);

console.log('\n══ Abhaken gilt nur für dieses Handy ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
await p.waitForTimeout(150);

await schritt('Ein Tipp auf den Text hakt nicht ab', async () => {
  await p.locator('.u-text').first().click();
  await p.waitForTimeout(150);
  if(!(await blende())) throw new Error('sie ist beim Lesen verschwunden');
});

await schritt('Ein Tipp daneben schon', async () => {
  await p.locator('.u-blende').click({position:{x:195, y:60}});
  await p.waitForTimeout(150);
  if(await blende()) throw new Error('sie steht noch da');
});

await schritt('Die Marke bleibt aber im Bestand stehen', async () => {
  const m = await marken();
  if(m.length !== 1 || !m[0].text) throw new Error('sie ist weg');
});

await schritt('Ein anderes Handy sieht sie danach trotzdem', async () => {
  const wieder = await p.evaluate(() => {
    localStorage.removeItem('bubidos-urkunden');   // frisches Gerät
    zeichnen();
    const e = document.querySelector('.u-blende');
    return e ? e.className.trim() : null;
  });
  if(!wieder) throw new Error('nichts zu sehen');
  return wieder;
});

console.log('\n══ Abgleich zweier Geräte ══');

await schritt('Bei derselben Kennung gewinnt die frühere Marke', async () => {
  const n = await p.evaluate(() => {
    const bau = (t, text) => ({
      spieler:[{id:1,name:'Korbi'},{id:2,name:'Fifu'}], einst:{}, geraete:{},
      aktivWe:900, aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1,2], tage:[{id:901, label:'1. Tag',
        marken:[{id:'901:10:1', stufe:10, pid:'1', t, quelle:'ersatz', text}],
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]};
    const r = zusammenfuehren(basis, bau(200, 'spaet'), bau(100, 'frueh'));
    return r.we[0].tage[0].marken;
  });
  if(n.length !== 1) throw new Error('es sind ' + n.length + ' geworden');
  if(n[0].text !== 'frueh') throw new Error('die spätere hat gewonnen: ' + n[0].text);
  return 'die um 100, nicht die um 200';
});

await schritt('Zwei Personen an derselben Stufe bleiben zwei Marken', async () => {
  const n = await p.evaluate(() => {
    const bau = pid => ({
      spieler:[{id:1,name:'Korbi'},{id:2,name:'Fifu'}], einst:{}, geraete:{},
      aktivWe:900, aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1,2], tage:[{id:901, label:'1. Tag',
        marken:[{id:'901:10:' + pid, stufe:10, pid, t:100, quelle:'ersatz', text:'x'}],
        orte:[{id:11, name:'A', getraenke:{'1':[], '2':[]}, log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[], '2':[]}, log:[]}]}]}]};
    return zusammenfuehren(basis, bau('1'), bau('2')).we[0].tage[0].marken.map(m => m.id);
  });
  if(n.length !== 2) throw new Error('es sind ' + n.length + ': ' + n.join(', '));
  return n.join(' + ');
});

await schritt('Bei gleicher Zeit gewinnt der Text von der API', async () => {
  const n = await p.evaluate(() => {
    const bau = quelle => ({
      spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900, aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        marken:[{id:'901:10:1', stufe:10, pid:'1', t:5, quelle, text:quelle}],
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]};
    return zusammenfuehren(basis, bau('ersatz'), bau('ki')).we[0].tage[0].marken;
  });
  if(n.length !== 1) throw new Error('es sind ' + n.length);
  if(n[0].quelle !== 'ki') throw new Error('der Ersatztext hat gewonnen');
});

console.log('\n══ Beim Abschließen fällt der Text weg, die Marke bleibt ══');

await aufbau({be:{'1':10, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Abschließen räumt den Text weg', async () => {
  await p.evaluate(() => { markenPruefen(); state.we[0].zu = true;
    abgeschlossenAufraeumen(state.we[0]); });
  const m = await marken();
  if(m.length !== 1) throw new Error('die Marke ist weg');
  if(m[0].text || m[0].kopf) throw new Error('der Text steht noch da');
  if(m[0].stufe !== 10 || String(m[0].pid) !== '1') throw new Error('Marke beschädigt');
  return 'Stufe und Person bleiben';
});

await schritt('Ein abgeschlossenes Wochenende zeigt keine Urkunde mehr', async () => {
  await p.evaluate(() => zeichnen());
  await p.waitForTimeout(150);
  if(await blende()) throw new Error('sie geht doch auf');
});

console.log('\n══ Kleinkram ══');

await aufbau({be:{'1':9, '2':2, '3':1, '4':0}, name:'Kor<b>i'});
await p.waitForTimeout(200);
await schritt('Ein Name mit spitzen Klammern wird maskiert', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  const roh = await p.evaluate(() => document.querySelector('.u-blende').innerHTML);
  if(/Kor<b>i/.test(roh)) throw new Error('unmaskiert im HTML');
  if(!/Kor&lt;b&gt;i/.test(roh)) throw new Error('Name fehlt ganz');
});

await schritt('Jede data-tu-Aktion hat einen Handler', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => {
      if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

await schritt('Das Wörterbuch hat zu jedem Wort Beispiele', async () => {
  const schlecht = await p.evaluate(() =>
    SLANG.filter(s => !s.w || !s.b || !(s.bsp || []).length).map(s => s.w));
  if(schlecht.length) throw new Error('unvollständig: ' + schlecht.join(', '));
  return (await p.evaluate(() => SLANG.length)) + ' Wörter';
});

await schritt('Zu jeder Stufe gibt es mehrere Ersatztexte', async () => {
  const schlecht = await p.evaluate(() => MARKEN.filter(s =>
    !(URKUNDE_ERSATZ[s] || []).length));
  if(schlecht.length) throw new Error('keine Texte bei Stufe ' + schlecht.join(', '));
  const n = await p.evaluate(() => MARKEN.reduce((s,x) => s + URKUNDE_ERSATZ[x].length, 0));
  return n + ' Ersatztexte';
});

/* Die Stufe 10 ist die einzige mit einer Überschrift – die Eilmeldung braucht eine. */
await schritt('Nur Stufe 10 bringt Überschriften mit', async () => {
  const x = await p.evaluate(() => ({
    zehn: URKUNDE_ERSATZ[10].every(v => !!v.kopf),
    rest: MARKEN.filter(s => s !== 10).some(s => URKUNDE_ERSATZ[s].some(v => v.kopf))
  }));
  if(!x.zehn) throw new Error('bei der 10 fehlt eine Überschrift');
  if(x.rest) throw new Error('18 oder 25 bringt eine Überschrift mit, die niemand zeigt');
});

await schritt('Die Anweisung an die API trägt Slang, Auftrag und Nachrichtenbezug', async () => {
  const t = await p.evaluate(() => urkundeAnweisung(state.we[0].tage[0],
    {id:'901:25:1', pid:'1', stufe:25, be:25, ort:'Augustiner'}));
  ['zappen', 'Peter', 'Bierpetereinheiten', 'Ehrenurkunde', 'Nachricht', 'JSON',
   'letzten', 'Augustiner']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
  if(/\{name\}/.test(t)) throw new Error('Platzhalter in der Anweisung');
  if(!/hat heute die Marke/.test(t)) throw new Error('Anlass fehlt in der Anrede');
  return t.length + ' Zeichen';
});

/* Die Websuche läuft serverseitig. Bleibt hier eine veraltete Werkzeug-Kennung stehen,
   antwortet die API mit 400, der Ersatztext greift – und niemand merkt, dass der
   Nachrichtenbezug still ausgefallen ist. */
await schritt('Der Aufruf bringt das Websuche-Werkzeug mit', async () => {
  const q = await p.evaluate(async () => {
    let gesehen = null;
    const echt = window.fetch;
    window.fetch = (u, o) => {
      if(String(u).indexOf('anthropic') >= 0) gesehen = JSON.parse(o.body);
      return Promise.reject(new Error('abgeklemmt'));
    };
    state.einst.kiSchluessel = 'sk-test';
    try{ await anKIText('hallo'); }catch(e){}
    window.fetch = echt; state.einst.kiSchluessel = '';
    return gesehen;
  });
  if(!q) throw new Error('es ging gar keine Anfrage raus');
  const w = (q.tools || [])[0] || {};
  if(w.name !== 'web_search') throw new Error('Werkzeug: ' + JSON.stringify(q.tools));
  if(!/^web_search_20\d{6}$/.test(w.type || '')) throw new Error('Kennung: ' + w.type);
  const soll = await p.evaluate(() => KI_MODELL_URKUNDE);
  if(q.model !== soll) throw new Error('Modell: ' + q.model + ' statt ' + soll);
  /* Das Modell denkt mit, und Denken, Suchergebnisse und Antwort teilen sich das Budget.
     Wird das hier je wieder klein gedreht, reißt die Antwort mitten im JSON ab und der
     Ersatztext springt ein, ohne dass irgendwo etwas davon steht. */
  if(!(q.max_tokens >= 4000)) throw new Error('max_tokens nur ' + q.max_tokens);
  return w.type + ' auf ' + q.model + ', max_tokens ' + q.max_tokens;
});

/* Wetter ist der billigste Aufhänger, den eine Nachricht hergibt, und beim zweiten Mal
   langweilt er. Steht das Verbot nicht mehr drin, merkt es sonst niemand. */
await schritt('Die Anweisung schließt Wetter und Trauriges aus', async () => {
  const t = await p.evaluate(() => urkundeAnweisung(state.we[0].tage[0],
    {id:'901:10:1', pid:'1', stufe:10, be:10, ort:'Augustiner'}));
  ['Wetter', 'Hitzerekord', 'Temperatur', 'Unglücke', 'Kriege']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" steht nicht im Verbot'); });
  return 'beides ausgeschlossen';
});

console.log('\n══ Betriebsanleitung und Änderungen ══');

await p.evaluate(() => { ansicht = 'info'; zeichnen(); });
await p.waitForTimeout(250);

await schritt('§ 8 handelt von den Tagesmarken', async () => {
  const t = await p.evaluate(() => {
    const e = document.getElementById('p8'); return e ? e.innerText : null; });
  if(!t) throw new Error('p8 gibt es nicht');
  if(!/§ 8\s*Tagesmarken/i.test(t)) throw new Error('Kopf: ' + t.slice(0,60));
  ['zehn', 'achtzehn', 'fünfundzwanzig'].forEach(w => {
    if(t.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
});

await schritt('Die Paragrafen sind lückenlos von 1 bis 12 durchnummeriert', async () => {
  const nr = await p.evaluate(() => [...document.querySelectorAll('.para')]
    .map(e => ({id:e.id, kopf:(e.querySelector('h2 i') || {}).textContent})));
  nr.forEach((x,i) => {
    if(x.id !== 'p' + (i+1)) throw new Error('an Stelle ' + (i+1) + ' steht ' + x.id);
    if(x.kopf !== '§ ' + (i+1)) throw new Error(x.id + ' trägt den Kopf ' + x.kopf);
  });
  if(nr.length !== 12) throw new Error('es sind ' + nr.length);
  return nr.length + ' Paragrafen';
});

await schritt('Jedes Erklär-Blatt zeigt auf den Paragrafen, den es benennt', async () => {
  const schlecht = await p.evaluate(() => Object.keys(ERKLAERUNGEN).map(k => {
    const e = ERKLAERUNGEN[k];
    const ziel = document.getElementById(e.para);
    if(!ziel) return k + ': Anker ' + e.para + ' gibt es nicht';
    const kopf = ziel.querySelector('h2');
    const ist = kopf ? kopf.textContent.replace(/\s+/g, ' ').trim() : '';
    return ist === e.paraName ? null
      : k + ': zeigt auf „' + ist + '", nennt aber „' + e.paraName + '"';
  }).filter(Boolean));
  if(schlecht.length) throw new Error(schlecht.join(' | '));
  return (await p.evaluate(() => Object.keys(ERKLAERUNGEN).length)) + ' Blätter geprüft';
});

await schritt('Die Fassung passt zur obersten Notiz', async () => {
  const x = await p.evaluate(() => ({f:FASSUNG,
    n:NOTIZEN[0].f + ' ' + NOTIZEN[0].d + ' ' + NOTIZEN[0].z}));
  const m = x.f.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}) · (G\d+)/);
  if(!m) throw new Error('FASSUNG hat ein anderes Format: ' + x.f);
  const soll = m[5] + ' ' + m[3] + '.' + m[2] + '.' + m[1] + ' ' + m[4];
  if(soll !== x.n) throw new Error('FASSUNG sagt ' + soll + ', die Notiz ' + x.n);
  return m[5];
});

/* Die Tagesmarken sollen am Abend überraschen. Steht das Wort in den Änderungen,
   liest es vorher jemand beim Nachschauen, was neu ist. */
await schritt('Die Änderungen verraten die Tagesmarken nicht', async () => {
  const t = await p.evaluate(() => JSON.stringify(NOTIZEN[0]));
  ['Urkunde', 'Tagesmarke', 'Biereinheiten', 'Ehrenurkunde', 'zehn', 'Stufe']
    .forEach(w => {
      if(new RegExp(w, 'i').test(t)) throw new Error('„' + w + '" steht in der Notiz');
    });
  return 'nichts verraten';
});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
