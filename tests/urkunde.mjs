// Marken am Wochenende. Ausgezeichnet wird ab 18 BE, jeder bekommt seine eigene –
// kein Wettlauf. Die Zehn zaehlt andersherum: Sie ist eine Maengelanzeige an die, die
// sie als Einzige nicht haben.
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

const marken = () => p.evaluate(() => (state.we[0].marken || []).map(m =>
  ({id:m.id, art:m.art, stufe:m.stufe, pid:m.pid, quelle:m.quelle, text:m.text, kopf:m.kopf,
    ort:m.ort, ortNr:m.ortNr, be:m.be, zahl:m.zahl, tag:m.tag})));
const blende = () => p.evaluate(() => {
  const e = document.querySelector('.u-blende');
  return e ? {klasse:e.className, text:e.innerText} : null;
});

console.log('\n══ Eine Marke je Stufe, Wochenende und Person ══');

await aufbau({be:{'1':17, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Bei 17 BE ist noch nichts', async () => {
  await p.evaluate(() => markenPruefen());
  const m = await marken();
  if(m.length) throw new Error('es gibt schon ' + m.length);
});

await schritt('Das achtzehnte Bier stellt die Urkunde aus', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  const m = await marken();
  if(m.length !== 1) throw new Error('Marken: ' + JSON.stringify(m));
  if(m[0].id !== '900:stufe:18:1') throw new Error('Kennung ' + m[0].id);
  if(String(m[0].pid) !== '1') throw new Error('pid ' + JSON.stringify(m[0].pid));
  return m[0].id;
});

/* Die Kennung traegt das **Wochenende**, nicht den Tag: Wer am Freitag neun trinkt und
   am Samstag neun, hat achtzehn – und genau darum ging der Umbau. */
await schritt('Die BE addieren sich über die Tage', async () => {
  const x = await p.evaluate(() => {
    const we = state.we[0];
    we.marken = [];
    we.tage[0].orte[1].getraenke['2'] = Array(9).fill('normal:05');
    we.tage.push({id:902, label:'2. Tag', orte:[{id:20, name:'Frühstück',
      getraenke:{'2':Array(8).fill('normal:05')}, log:[]}]});
    state.aktivTag = 902; state.aktivOrt = 20; pinLoeschen();
    tu.strich({dataset:{id:'2'}});
    return {be:beAmWe(we, '2'), ids:(we.marken || []).map(m => m.id)};
  });
  if(Math.abs(x.be - 18) > 0.01) throw new Error('beAmWe ergibt ' + x.be);
  if(x.ids.indexOf('900:stufe:18:2') < 0)
    throw new Error('keine Marke über die Tage hinweg: ' + x.ids.join(', '));
  return '9 + 9 = 18, Marke steht';
});

await aufbau({be:{'1':17, '2':2, '3':1, '4':0}});
await p.waitForTimeout(200);
await p.evaluate(() => tu.strich({dataset:{id:'1'}}));

await schritt('Sie merkt sich Ort, Nummer und Tag für das Bild', async () => {
  const m = await marken();
  if(m[0].ort !== 'Augustiner') throw new Error('Ort: ' + m[0].ort);
  if(m[0].ortNr !== 2) throw new Error('ortNr: ' + m[0].ortNr);
  if(m[0].tag !== '1. Tag') throw new Error('Tag: ' + m[0].tag);
  return m[0].tag + ', ' + m[0].ortNr + '. Location: ' + m[0].ort;
});

await schritt('Ohne Schlüssel steht sofort ein Ersatztext mit Namen da', async () => {
  const m = await marken();
  if(m[0].quelle !== 'ersatz') throw new Error('Quelle ' + m[0].quelle);
  if(m[0].kopf) throw new Error('die Stufe bringt eine Überschrift mit, die niemand zeigt');
  if(/\{name\}/.test(m[0].text)) throw new Error('Platzhalter steht noch drin');
  if(!/Korbi/.test(m[0].text)) throw new Error('kein Name: ' + m[0].text);
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

await aufbau({be:{'1':17, '2':17, '3':1, '4':0}});
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
  if(ids !== '900:stufe:18:1 900:stufe:18:2') throw new Error('Kennungen: ' + ids);
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

/* Der Vierte steht hier bewusst über zehn: Sonst bekäme er zur selben Sekunde eine
   Mängelanzeige, und dieser Abschnitt prüft die Stufen. Das Zusammenspiel der beiden
   steht weiter unten und ist dort der eigentliche Punkt. */
await aufbau({be:{'1':17, '2':17, '3':17, '4':12}});
await p.waitForTimeout(200);
await schritt('Eine Runde für alle schiebt drei zugleich über die Achtzehn', async () => {
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

console.log('\n══ Die Mängelanzeige: wer die Zehn als Einziger nicht hat ══');

/* Eigener Aufbau, weil hier die Gruppengröße mitspielt: Die Regel hängt daran, wie
   viele drunter stehen *und* wie viele drüber. `be` ist die Liste der BE je Person. */
const runde = be => p.evaluate(be => {
  localStorage.removeItem('bubidos-urkunden');
  const bier = k => Array(k).fill('normal:05');
  const g = {};
  state.spieler = be.map((x,i) => ({id:i+1, name:'P' + (i+1)}));
  be.forEach((x,i) => g[String(i+1)] = bier(x));
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-10', zu:false,
    dabei: be.map((x,i) => i+1),
    tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'Augustiner', getraenke:g, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  state.einst = {k:40, kiSchluessel:''};
  ansicht = null; letzteRunde = null; nachfrage = null; pinLoeschen();
  markenPruefen();
  return {kandidaten: mangelKandidaten(state.we[0]).slice().sort(),
          marken: (state.we[0].marken || [])
            .filter(m => m.art === 'mangel').map(m => String(m.pid)).sort()};
}, be);

await schritt('Reissen alle die Zehn, passiert gar nichts', async () => {
  const x = await runde([12, 11, 10, 14, 10]);
  if(x.marken.length) throw new Error('es kam doch eine: ' + x.marken.join(','));
  return 'still';
});

await schritt('Einer drunter, der Rest drüber – der eine bekommt sie', async () => {
  const x = await runde([12, 11, 10, 6, 14]);
  if(x.marken.join(',') !== '4') throw new Error('Mängelanzeigen an: ' + x.marken.join(','));
  return 'P4';
});

await schritt('Zwei drunter von fünf – beide bekommen sie', async () => {
  const x = await runde([12, 11, 10, 6, 3]);
  if(x.marken.join(',') !== '4,5') throw new Error('Mängelanzeigen an: ' + x.marken.join(','));
  return 'P4 und P5';
});

/* Drei von fünf drunter heißt nicht „drei sind faul", sondern „es ist erst neun Uhr".
   Das wäre kein Vorwurf, sondern eine Uhrzeit. */
await schritt('Drei drunter – das Wochenende ist schlicht noch nicht weit genug', async () => {
  const x = await runde([12, 11, 6, 5, 3]);
  if(x.marken.length) throw new Error('es kam doch eine: ' + x.marken.join(','));
  return 'still';
});

/* Zwei gegen zwei ist ein Unentschieden, kein Nachsitzen. */
await schritt('Zwei von vier drunter – nichts, die Mehrheit fehlt', async () => {
  const x = await runde([12, 11, 6, 5]);
  if(x.marken.length) throw new Error('es kam doch eine: ' + x.marken.join(','));
  return 'still';
});

await schritt('Zu dritt: einer drunter ja, zwei drunter nein', async () => {
  const eins = await runde([12, 11, 6]);
  if(eins.marken.join(',') !== '3') throw new Error('bei einem: ' + eins.marken.join(','));
  const zwei = await runde([12, 6, 5]);
  if(zwei.marken.length) throw new Error('bei zweien kam: ' + zwei.marken.join(','));
  return 'einer ja, zwei nein';
});

await schritt('Sie nennt den Stand und trägt eine Überschrift', async () => {
  await runde([12, 11, 10, 6, 14]);
  const m = (await marken()).find(x => x.art === 'mangel');
  if(!m) throw new Error('keine Mängelanzeige');
  if(!m.kopf) throw new Error('ohne Überschrift');
  if(m.zahl !== '6,0') throw new Error('Stand: ' + m.zahl);
  if(m.id !== '900:mangel:10:4') throw new Error('Kennung: ' + m.id);
  if(m.text.indexOf('6,0') < 0) throw new Error('der Text nennt den Stand nicht: ' + m.text);
  if(/\{be\}|\{name\}/.test(m.text + m.kopf)) throw new Error('Platzhalter steht noch drin');
  if(m.text.indexOf('P4') < 0 && m.kopf.indexOf('P4') < 0)
    throw new Error('kein Name: ' + m.kopf + ' / ' + m.text);
  return m.zahl + ' von 10';
});

/* Ein Stups, kein Urteil: Wer die Zehn noch reißt, ist sie los. */
await schritt('Holt er auf, ist sie wieder weg', async () => {
  const n = await p.evaluate(() => {
    const o = state.we[0].tage[0].orte[0];
    o.getraenke['4'] = Array(11).fill('normal:05');
    markenAufraeumen();
    return (state.we[0].marken || []).filter(m => m.art === 'mangel').length;
  });
  if(n) throw new Error('sie steht noch da');
  return 'eingezogen';
});

/* Die andere Seite: Nicht der Gescholtene ändert sich, sondern das Feld um ihn herum.
   Sobald ein Dritter zurückfällt, ist es keine Minderheit mehr und der Vorwurf trägt nicht. */
await schritt('Fällt ein Dritter zurück, trägt der Vorwurf nicht mehr', async () => {
  const vorher = await runde([12, 11, 10, 6, 14]);
  if(vorher.marken.join(',') !== '4') throw new Error('Aufbau: ' + vorher.marken.join(','));
  const n = await p.evaluate(() => {
    const o = state.we[0].tage[0].orte[0];
    o.getraenke['3'] = Array(4).fill('normal:05');   // P3 rutscht unter zehn
    o.getraenke['5'] = Array(5).fill('normal:05');   // P5 auch
    markenAufraeumen();
    return (state.we[0].marken || []).filter(m => m.art === 'mangel').length;
  });
  if(n) throw new Error('sie steht noch da, obwohl jetzt drei drunter sind');
  return 'eingezogen';
});

/* Das Zusammenspiel, um das es eigentlich geht: Eine Runde für alle schiebt drei über
   die Achtzehn – und macht den Vierten damit zum Einzigen unter der Zehn. */
await schritt('Eine Runde kann Urkunde und Mängelanzeige zugleich auslösen', async () => {
  await runde([17, 17, 17, 5]);
  const x = await p.evaluate(() => {
    tu.runde();
    return (state.we[0].marken || []).map(m => m.art + ':' + m.pid).sort();
  });
  const soll = ['mangel:4', 'stufe:1', 'stufe:2', 'stufe:3'].join(' ');
  if(x.join(' ') !== soll) throw new Error('es kam: ' + x.join(' '));
  return 'drei Urkunden und eine Mängelanzeige';
});

console.log('\n══ Zurückgenommenes Bier zieht die Urkunde ein ══');

await aufbau({be:{'1':17, '2':2, '3':1, '4':0}});
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
    d.we[0].tage[0].orte[1].getraenke['1'] = Array(17).fill('normal:05');
    uebernehmen(d);
    return (state.we[0].marken || []).length;
  });
  if(n) throw new Error('nach dem Abgleich stehen noch ' + n);
  return 'weg';
});

console.log('\n══ Der Ort ist der der Person, nicht der des Handys ══');

await aufbau({be:{'1':17, '2':17, '3':1, '4':0}});
await p.waitForTimeout(200);
await schritt('Nach einer Aufteilung steht Korbis Location auf Korbis Urkunde', async () => {
  const m = await p.evaluate(() => {
    const tg = aktuell().tg;
    /* Fifu zieht in den Neubau vor, Korbi bleibt im Augustiner. Korbis achtzehntes Bier
       kommt von drüben; dieses Handy steht im Neubau und legt die Marke an. */
    tg.orte.push({id:12, name:'Neubau', getraenke:{'2':[]}, log:[]});
    state.aktivOrt = 12; pinLoeschen();
    tg.orte[1].getraenke['1'].push('normal:05');
    tu.strich({dataset:{id:'2'}});
    return (state.we[0].marken || []).map(x => ({pid:x.pid, ort:x.ort, ortNr:x.ortNr}));
  });
  const korbi = m.find(x => String(x.pid) === '1');
  if(!korbi) throw new Error('Korbi hat keine: ' + JSON.stringify(m));
  if(korbi.ort !== 'Augustiner') throw new Error('es steht ' + korbi.ort + ' drauf');
  if(korbi.ortNr !== 2) throw new Error('ortNr ' + korbi.ortNr);
  return korbi.ortNr + '. Location: ' + korbi.ort;
});

console.log('\n══ Die Formen unterscheiden sich ══');

/* Einer unter zehn, drei drüber – die Mängelanzeige fällt. */
await aufbau({be:{'1':12, '2':11, '3':10, '4':5}});
await p.waitForTimeout(200);
await schritt('Die Mängelanzeige kommt als Blatt von unten, in Rot', async () => {
  /* `markenPruefen()` zeichnet nicht von sich aus – im Betrieb tut das der Tipp,
     der es ausgelöst hat. */
  await p.evaluate(() => { markenPruefen(); zeichnen(); });
  await p.waitForTimeout(150);
  const e = await blende();
  if(!e) throw new Error('keine Blende');
  if(!/\bs1\b/.test(e.klasse)) throw new Error('Klasse ' + e.klasse);
  if(!/\bu-mangel\b/.test(e.klasse)) throw new Error('nicht als Mängelanzeige gekennzeichnet');
  if(!/MÄNGELANZEIGE/i.test(e.text)) throw new Error('kein Mängel-Band: ' + e.text);
  if(!/sichere dir/.test(e.text)) throw new Error('keine Andenken-Zeile');
  await p.screenshot({path: ORDNER + 'u-mangel.png'});
  return 's1 u-mangel';
});

await aufbau({be:{'1':17, '2':12, '3':11, '4':10}});
await p.waitForTimeout(200);
await schritt('18 kommt als Karte in der Mitte', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  const m = await marken();
  if(m.length !== 1) throw new Error('Marken: ' + m.map(x => x.art + x.stufe).join(','));
  const e = await blende();
  if(!/\bs2\b/.test(e.klasse)) throw new Error('Klasse ' + e.klasse);
  await p.screenshot({path: ORDNER + 'u-stufe18.png'});
  return 's2';
});

await aufbau({be:{'1':24, '2':12, '3':11, '4':10}});
await p.waitForTimeout(200);
await schritt('25 nimmt den ganzen Bildschirm', async () => {
  await p.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await p.waitForTimeout(150);
  await p.evaluate(() => tu.urkundeWeg());
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
    const we = state.we[0];
    const m = we.marken.find(x => x.stufe === 25);
    const c = await urkundeBild(m, we, '1');
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
    const we = state.we[0];
    const m = we.marken.find(x => x.stufe === 25);
    return [we.titel, m.tag, m.ortNr + '. Location: ' + m.ort].join(' · ');
  });
  ['Nockherberg', '1. Tag', '2. Location: Augustiner'].forEach(w => {
    if(s.indexOf(w) < 0) throw new Error('„' + w + '" fehlt in „' + s + '"');
  });
  return s;
});

/* Zum Ansehen: das Bild in die Seite hängen und abfotografieren. */
await p.evaluate(async () => {
  const we = state.we[0];
  const c = await urkundeBild(we.marken.find(x => x.stufe === 25), we, '1');
  document.body.innerHTML = '<img id="ub" style="width:540px;display:block" src="'
    + c.toDataURL('image/png') + '">';
});
await p.waitForTimeout(400);
await p.locator('#ub').screenshot({path: ORDNER + 'u-bild-25.png'});
await p.reload(); await p.waitForTimeout(600);

console.log('\n══ Abhaken gilt nur für dieses Handy ══');

await aufbau({be:{'1':17, '2':12, '3':11, '4':10}});
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
      we:[{id:900, titel:'N', zu:false, dabei:[1,2],
        marken:[{id:'900:stufe:18:1', art:'stufe', stufe:18, pid:'1', t, quelle:'ersatz', text}],
        tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':Array(18).fill('normal:05')}, log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]};
    const r = zusammenfuehren(basis, bau(200, 'spaet'), bau(100, 'frueh'));
    return r.we[0].marken;
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
      we:[{id:900, titel:'N', zu:false, dabei:[1,2],
        marken:[{id:'900:stufe:18:' + pid, art:'stufe', stufe:18, pid, t:100,
                 quelle:'ersatz', text:'x'}],
        tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'A',
          getraenke:{'1':Array(18).fill('normal:05'), '2':Array(18).fill('normal:05')},
          log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[], '2':[]}, log:[]}]}]}]};
    return zusammenfuehren(basis, bau('1'), bau('2')).we[0].marken.map(m => m.id);
  });
  if(n.length !== 2) throw new Error('es sind ' + n.length + ': ' + n.join(', '));
  return n.join(' + ');
});

await schritt('Bei gleicher Zeit gewinnt der Text von der API', async () => {
  const n = await p.evaluate(() => {
    const bau = quelle => ({
      spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900, aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1],
        marken:[{id:'900:stufe:18:1', art:'stufe', stufe:18, pid:'1', t:5, quelle, text:quelle}],
        tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':Array(18).fill('normal:05')}, log:[]}]}]}]});
    const basis = {spieler:[{id:1,name:'Korbi'}], einst:{}, geraete:{}, aktivWe:900,
      aktivTag:901, aktivOrt:11,
      we:[{id:900, titel:'N', zu:false, dabei:[1], tage:[{id:901, label:'1. Tag',
        orte:[{id:11, name:'A', getraenke:{'1':[]}, log:[]}]}]}]};
    return zusammenfuehren(basis, bau('ersatz'), bau('ki')).we[0].marken;
  });
  if(n.length !== 1) throw new Error('es sind ' + n.length);
  if(n[0].quelle !== 'ki') throw new Error('der Ersatztext hat gewonnen');
});

console.log('\n══ Beim Abschließen fällt der Text weg, die Marke bleibt ══');

await aufbau({be:{'1':18, '2':12, '3':11, '4':10}});
await p.waitForTimeout(200);
await schritt('Abschließen räumt den Text weg', async () => {
  await p.evaluate(() => { markenPruefen(); state.we[0].zu = true;
    abgeschlossenAufraeumen(state.we[0]); });
  const m = await marken();
  if(m.length !== 1) throw new Error('die Marke ist weg');
  if(m[0].text || m[0].kopf) throw new Error('der Text steht noch da');
  if(m[0].stufe !== 18 || String(m[0].pid) !== '1') throw new Error('Marke beschädigt');
  return 'Stufe und Person bleiben';
});

await schritt('Ein abgeschlossenes Wochenende zeigt keine Urkunde mehr', async () => {
  await p.evaluate(() => zeichnen());
  await p.waitForTimeout(150);
  if(await blende()) throw new Error('sie geht doch auf');
});

console.log('\n══ Kleinkram ══');

/* Über die Mängelanzeige geprüft: Dort steht der Name in der Überschrift *und* im
   Text, das ist die schärfere Probe als eine Stufe, die nur den Text füllt. */
await aufbau({be:{'1':6, '2':12, '3':11, '4':10}, name:'Kor<b>i'});
await p.waitForTimeout(200);
await schritt('Ein Name mit spitzen Klammern wird maskiert', async () => {
  await p.evaluate(() => { markenPruefen(); zeichnen(); });
  await p.waitForTimeout(150);
  const e = await p.evaluate(() => {
    const x = document.querySelector('.u-blende');
    return x ? {roh:x.innerHTML, kl:x.className} : null;
  });
  if(!e) throw new Error('keine Blende');
  if(!/u-mangel/.test(e.kl)) throw new Error('es kam keine Mängelanzeige: ' + e.kl);
  if(/Kor<b>i/.test(e.roh)) throw new Error('unmaskiert im HTML');
  if(!/Kor&lt;b&gt;i/.test(e.roh)) throw new Error('Name fehlt ganz');
  return 'in Überschrift und Text';
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

/* Die beiden Zitate sind Mundart und müssen es bleiben. Wer sie beim Aufräumen ins
   Hochdeutsche zieht — „die Sprüche kennen wir alle“ —, hat ein grammatisch sauberes
   Wörterbuch und einen Eintrag, der nach niemandem mehr klingt. Dasselbe gilt für die
   Ersatztexte: Stünde die Wendung nur im Prompt, klängen API-Text und Ersatztext
   verschieden, je nachdem ob gerade Netz da war. */
await schritt('Die Mundart-Zitate stehen wörtlich da, auch in den Ersatztexten', async () => {
  const x = await p.evaluate(() => {
    const woerter = SLANG.map(s => s.w + ' ' + s.b + ' ' + (s.bsp || []).join(' ')).join(' | ');
    const texte = Object.keys(URKUNDE_ERSATZ).map(a => URKUNDE_ERSATZ[a]
      .map(v => (v.kopf || '') + ' ' + v.text).join(' ')).join(' ');
    return {woerter, texte};
  });
  ['Mock', 'die Sprüch kenn mer alle', 'Dis is er, dis is der Mann fürs Leben',
   'gezappt wie ich gepisst hab', 'Original Dreck'].forEach(w => {
    if(x.woerter.indexOf(w) < 0) throw new Error('„' + w + '" fehlt im Wörterbuch');
  });
  [/\bMock\b/, /die Sprüch kenn mer alle/, /Dis is er, dis is der Mann fürs Leben/,
   /gezappt hat wie er gepisst hat/].forEach(r => {
    if(!r.test(x.texte)) throw new Error('kein Ersatztext benutzt ' + r);
  });
  if(/Sprüche kennen wir alle|kommt dir der Schleim|Das ist er, das ist der Mann/
      .test(x.woerter + x.texte))
    throw new Error('jemand hat es ins Hochdeutsche geglättet');
  return 'wörtlich, in beiden';
});

/* Zwei Einträge sind bewusst in der Form übernommen und im Ziel getauscht. Wer sie später
   „originalgetreu“ zurückdreht, baut einen Prompt, der bei jeder Urkunde anbietet, eine
   Frau Dreck zu nennen — auf einem Blatt, das einen Namen trägt und verschickt wird. */
await schritt('Die zwei getauschten Einträge zielen auf eine Sache, nicht auf einen Menschen',
  async () => {
  const x = await p.evaluate(() => {
    const s = SLANG.find(y => y.w === 'Dreck, Dreck, Original Dreck') || {};
    const g = SLANG.find(y => /gepisst/.test(y.w)) || {};
    return {dreck:s.b || '', dreckBsp:(s.bsp || []).join(' | '), gezappt:g.w + ' ' + (g.b || '')};
  });
  if(!/Sache/.test(x.dreck) || !/Nie einem Menschen|nie einem Menschen/.test(x.dreck))
    throw new Error('die Bedeutung sagt nicht mehr, dass es einer Sache gilt: ' + x.dreck);
  if(/\bfrau|\bsie\b|\bdie ist\b/i.test(x.dreckBsp))
    throw new Error('ein Beispiel zielt auf eine Person: ' + x.dreckBsp);
  if(/gefickt|ficken/i.test(x.gezappt))
    throw new Error('der Eintrag wurde auf das Original zurückgedreht');
  return 'beide zielen auf eine Sache';
});

/* Der Wortschatz kommt aus drei Quellen, und die Zitate stehen im Wortlaut da — auch das
   Grobe. In der Runde sind das stehende Sprüche; wer sie beim Aufräumen glättet oder
   herausnimmt, hat ein sauberes Wörterbuch und einen Ton, nach dem niemand mehr klingt.
   Gesteuert wird nicht über den Wortlaut, sondern über die Bedeutung: wogegen die Wendung
   geht, und dass das Schimpfwort anerkennend gemeint ist. */
await schritt('Alle drei Quellen stehen wörtlich im Wortschatz', async () => {
  const woerter = await p.evaluate(() =>
    SLANG.map(s => s.w + ' ' + s.b + ' ' + (s.bsp || []).join(' ')).join(' | '));
  ['Des sin Sachen ausm Leeeeeben', 'Dann machts BAM', 'des es andersda wie bei annern',
   'Besser isses', 'mit den Arschlöchern rumzureden', 'Isch hau Ihnen in die Fresse',
   'Dreckschwein', 'Geld in die Schweiz überwiesen']
    .forEach(w => { if(woerter.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
  return 'Toni, Boxprinz und Konrad';
});

/* Die Drohung und das Schimpfwort stehen im Wortlaut drin, aber die Bedeutung sagt, wohin
   sie zielen. Fällt der Satz weg, baut der Prompt bei jeder Urkunde an, jemanden zu
   beschimpfen, dessen Name groß darüber steht und die verschickt wird. */
await schritt('Bei den groben Wendungen sagt die Bedeutung, wogegen sie gehen', async () => {
  const x = await p.evaluate(() => {
    const f = SLANG.find(y => /in die Fresse/.test(y.w)) || {};
    const d = SLANG.find(y => /Dreckschwein/.test(y.w)) || {};
    return {fresse:f.b || '', dreck:d.b || '', dreckBsp:(d.bsp || []).join(' | ')};
  });
  if(!/nicht gegen den, dem die Urkunde gilt/.test(x.fresse))
    throw new Error('die Drohung sagt nicht mehr, wogegen sie geht: ' + x.fresse);
  /* Beim Schimpfwort ist die Anrede der Witz: „Du Dreckschwein" sagt man dem, den man
     feiert, und in dieser Runde weiß das jeder. Die Bedeutung muss das hergeben, sonst
     schreibt das Modell brav daran vorbei — festgehalten wird deshalb beides: dass es
     eine Auszeichnung ist und dass es direkt an den Gefeierten geht. */
  if(!/Auszeichnung/.test(x.dreck) || !/bewundernd/.test(x.dreck))
    throw new Error('das Schimpfwort ist nicht mehr als Auszeichnung erklärt: ' + x.dreck);
  if(!/Du Dreckschwein/.test(x.dreckBsp))
    throw new Error('kein Beispiel spricht den Gefeierten an: ' + x.dreckBsp);
  /* Und die zweite Richtung: Seit es die Mängelanzeige gibt, fällt der Spruch auch dort.
     Stand hier nur das Lob, schrieb das Modell auf so einem Blatt brav daran vorbei –
     obwohl die Runde ihn genau dort benutzt. */
  if(!/Bilanz/.test(x.dreck))
    throw new Error('die zweite Richtung fehlt in der Bedeutung: ' + x.dreck);
  return 'beide gesteuert, beide Richtungen';
});

/* Über dreißig Einträge, und das Modell baut ein bis zwei ein: Ohne Rangfolge käme jede
   einzelne nur in jeder zwanzigsten Urkunde dran, und die Wendungen, an denen die Runde
   sich überhaupt erkennt, gingen in der Masse unter. */
await schritt('Die stehenden Wendungen sind als Kern markiert', async () => {
  const x = await p.evaluate(() => ({
    n: SLANG.length, kern: SLANG.filter(s => s.kern).map(s => s.w)}));
  if(x.kern.length < 5) throw new Error('nur ' + x.kern.length + ' im Kern');
  ['Da kommt dir der Mock hoch', 'Die Sprüch kenn mer alle',
   'Dis is er, dis is der Mann fürs Leben'].forEach(w => {
    if(x.kern.indexOf(w) < 0) throw new Error('„' + w + '" steht nicht mehr im Kern');
  });
  return x.kern.length + ' von ' + x.n;
});

/* Nachtrag G47: ein Eintrag außerhalb der drei Quellen, für die Ablehnung von allem Neuen. */
await schritt('„Ich bleib beim Arschloch" zielt auf eine Gewohnheit, nicht auf einen Menschen',
  async () => {
  const x = await p.evaluate(() => {
    const e = SLANG.find(y => /Ich bleib beim Arschloch/.test(y.w)) || {};
    return {b:e.b || '', bsp:(e.bsp || []).join(' | ')};
  });
  if(!x.b) throw new Error('der Eintrag fehlt');
  if(!/nie einem Menschen/.test(x.b)) throw new Error('die Bedeutung sagt das nicht: ' + x.b);
  if(/\bihn\b|\bsie\b|\ber ist\b/i.test(x.bsp))
    throw new Error('ein Beispiel zielt auf eine Person: ' + x.bsp);
  return 'Gewohnheit statt Mensch';
});

/* Zu jeder Art, die es gibt, muss es auch Texte geben – sonst steht am Abend eine
   leere Urkunde da, und zwar genau dann, wenn kein Netz ist. */
await schritt('Zu jeder Art gibt es mehrere Ersatztexte', async () => {
  const schlecht = await p.evaluate(() =>
    ['mangel', ...MARKEN_STUFEN].filter(a => ((URKUNDE_ERSATZ[a] || []).length) < 2));
  if(schlecht.length) throw new Error('zu wenige Texte bei: ' + schlecht.join(', '));
  const n = await p.evaluate(() => Object.keys(URKUNDE_ERSATZ)
    .reduce((s,a) => s + URKUNDE_ERSATZ[a].length, 0));
  return n + ' Ersatztexte';
});

/* Die Mängelanzeige ist die einzige mit einer Überschrift – die Eilmeldung braucht eine,
   bei den Stufen steht die Zahl groß darüber und ein Kopf sägte dasselbe ein zweites Mal. */
await schritt('Nur die Mängelanzeige bringt Überschriften mit', async () => {
  const x = await p.evaluate(() => ({
    mangel: URKUNDE_ERSATZ.mangel.every(v => !!v.kopf),
    rest: MARKEN_STUFEN.some(st => URKUNDE_ERSATZ[st].some(v => v.kopf)),
    liste: [...MARKE_MIT_KOPF]
  }));
  if(!x.mangel) throw new Error('bei der Mängelanzeige fehlt eine Überschrift');
  if(x.rest) throw new Error('18 oder 25 bringt eine Überschrift mit, die niemand zeigt');
  if(x.liste.join(',') !== 'mangel')
    throw new Error('MARKE_MIT_KOPF und die Texte laufen auseinander: ' + x.liste.join(','));
  return 'nur mangel';
});

/* Der Stand der Person gehört in den Text: „sechs von zehn" ist der Vorwurf. Ohne die
   Zahl bleibt eine Beschimpfung ohne Anlass übrig. */
await schritt('Die Mängeltexte nennen den Stand', async () => {
  const ohne = await p.evaluate(() =>
    URKUNDE_ERSATZ.mangel.filter(v => v.text.indexOf('{be}') < 0).length);
  if(ohne) throw new Error(ohne + ' Mängeltexte nennen den Stand nicht');
  return 'alle drei';
});

await schritt('Die Anweisung an die API trägt Slang, Auftrag und Nachrichtenbezug', async () => {
  const t = await p.evaluate(() => urkundeAnweisung(state.we[0],
    {id:'900:stufe:25:1', art:'stufe', pid:'1', stufe:25, be:25, ort:'Augustiner',
     tag:'1. Tag', wendung:'Peter'}));
  ['Peter', 'Bierpetereinheiten', 'Ehrenurkunde', 'Nachricht', 'JSON',
   'letzten', 'Augustiner']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
  if(/\{name\}/.test(t)) throw new Error('Platzhalter in der Anweisung');
  if(!/an diesem Wochenende die Marke/.test(t)) throw new Error('Anlass fehlt in der Anrede');
  return t.length + ' Zeichen';
});

/* Der Spott gilt der Bilanz. Das ist keine Zierde: Das Blatt trägt einen Namen und wird
   weitergeschickt, und ohne den Satz entscheidet der Zufall, wohin die groben Wendungen
   zeigen. */
await schritt('Die Mängel-Anweisung richtet den Spott auf die Bilanz', async () => {
  const t = await p.evaluate(() => urkundeAnweisung(state.we[0],
    {id:'900:mangel:10:1', art:'mangel', pid:'1', stufe:10, be:6, ort:'Augustiner',
     tag:'1. Tag', wendung:'Peter'}));
  ['Mängelanzeige', 'Bilanz', 'nie dem Menschen', 'Nachricht', 'JSON']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" fehlt'); });
  if(!/nicht hat|nicht\./.test(t)) throw new Error('der umgedrehte Anlass fehlt');
  if(!/"kopf"/.test(t)) throw new Error('die Überschrift wird nicht verlangt');
  if(/hat an diesem Wochenende die Marke von 10 Biereinheiten gerissen/.test(t))
    throw new Error('die Mängelanzeige gratuliert');
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
  const t = await p.evaluate(() => urkundeAnweisung(state.we[0],
    {id:'900:stufe:18:1', art:'stufe', pid:'1', stufe:18, be:18, ort:'Augustiner'}));
  ['Wetter', 'Hitzerekord', 'Temperatur', 'Unglücke', 'Kriege']
    .forEach(w => { if(t.indexOf(w) < 0) throw new Error('„' + w + '" steht nicht im Verbot'); });
  return 'beides ausgeschlossen';
});

console.log('\n══ Betriebsanleitung und Änderungen ══');

await p.evaluate(() => { ansicht = 'info'; zeichnen(); });
await p.waitForTimeout(250);

/* Bewusst kein eigener Paragraf: Die Tagesmarken sollen überraschen, und das gilt auch
   für den, der von sich aus in der Anleitung nachschlägt. Deshalb hier das Gegenteil
   des früheren Tests – die Betriebsanleitung darf sie an keiner Stelle verraten. */
await schritt('Die Betriebsanleitung verrät die Tagesmarken nirgends', async () => {
  const t = await p.evaluate(() => document.getElementById('app').innerText);
  ['Tagesmarke', 'Ehrenurkunde', 'Biereinheiten an einem Tag', 'zwanzig Biereinheiten']
    .forEach(w => { if(t.indexOf(w) >= 0) throw new Error('„' + w + '" steht doch drin'); });
});

await schritt('Die Paragrafen sind lückenlos von 1 bis 11 durchnummeriert', async () => {
  const nr = await p.evaluate(() => [...document.querySelectorAll('.para')]
    .map(e => ({id:e.id, kopf:(e.querySelector('h2 i') || {}).textContent})));
  nr.forEach((x,i) => {
    if(x.id !== 'p' + (i+1)) throw new Error('an Stelle ' + (i+1) + ' steht ' + x.id);
    if(x.kopf !== '§ ' + (i+1)) throw new Error(x.id + ' trägt den Kopf ' + x.kopf);
  });
  if(nr.length !== 11) throw new Error('es sind ' + nr.length);
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

/* Der Fall, der das ausgelöst hat: Über einer Eilmeldung stand „Ich hab heut mehr Halbe
   wie Schritte" — die Bauart von „mehr gezappt wie ich gepisst hab", aber ohne ein
   einziges Wort daraus. Am Tisch war vom Wortschatz nichts wiederzuerkennen. Schuld war
   das Beispiel selbst: Es stand so im Eintrag und war eine entkernte Umschreibung.
   Seit G49 geht nur noch **eine** Wendung mit — damit trägt jedes einzelne Beispiel
   ungleich mehr Gewicht als früher, wo das Modell sich das passendste aussuchen konnte. */
await schritt('Jedes Beispiel trägt die Wendung erkennbar', async () => {
  const schlecht = await p.evaluate(() => SLANG.flatMap(s =>
    s.bsp.filter(b => !wendungErkennbar(b, s.w)).map(b => s.w + ' → ' + b)));
  if(schlecht.length)
    throw new Error(schlecht.length + ' entkernt: ' + schlecht.join(' | '));
  const n = await p.evaluate(() => SLANG.reduce((a, s) => a + s.bsp.length, 0));
  return n + ' Beispiele geprüft';
});

/* Die Erkennung darf nicht über Füllwörter anspringen — daran ist der Fall ja vorbei-
   gerutscht: „mehr Halbe wie Schritte" teilt sich mit dem Original das „mehr". */
await schritt('Füllwörter allein zählen nicht als Wiedererkennung', async () => {
  const x = await p.evaluate(() => ({
    entkernt: wendungErkennbar('Ich hab heut mehr Halbe wie Schritte',
      'mehr gezappt wie ich gepisst hab'),
    echt: wendungErkennbar('Ich hab heut mehr gezappt wie geschlafen',
      'mehr gezappt wie ich gepisst hab'),
    gebeugt: wendungErkennbar('hat den ganzen Abend durchgezappt', 'zappen')
  }));
  if(x.entkernt) throw new Error('die entkernte Fassung gilt als erkennbar');
  if(!x.echt) throw new Error('die echte Fassung gilt nicht als erkennbar');
  if(!x.gebeugt) throw new Error('gebeugte Formen zählen nicht mit');
  return 'entkernt nein, gebeugt ja';
});

console.log('\n══ Jede Wendung nur einmal je Wochenende ══');

/* Zwei Leute rissen nacheinander die Zehn, und über beiden Eilmeldungen stand dieselbe
   Wendung. Solange der ganze Wortschatz mitging und das Modell aussuchte, nahm es jedes
   Mal die zugkräftigste. Der harte Fall ist aber die Runde für alle: Sie schiebt mehrere
   im selben Durchlauf über die Schwelle, die Aufrufe laufen gleichzeitig los, und eine
   Ausschlussliste im Prompt käme für keinen davon rechtzeitig. Deshalb sucht die App aus
   und reserviert sofort. */
await aufbau({be:{'1':17, '2':17, '3':17, '4':12}});
await p.waitForTimeout(200);

await schritt('Eine Runde für alle vergibt drei verschiedene Wendungen', async () => {
  await p.evaluate(() => tu.runde());
  const w = await p.evaluate(() =>
    (state.we[0].marken || []).map(m => m.wendung));
  if(w.length !== 3) throw new Error('es sind ' + w.length + ' Marken');
  if(w.some(x => !x)) throw new Error('eine Marke ohne Wendung: ' + JSON.stringify(w));
  if(new Set(w).size !== 3) throw new Error('doppelt vergeben: ' + w.join(' | '));
  return w.map(x => x.slice(0, 18)).join(' · ');
});

await schritt('Zuerst sind die Kern-Wendungen dran', async () => {
  const schlecht = await p.evaluate(() => {
    const kern = SLANG.filter(s => s.kern).map(s => s.w);
    return (state.we[0].marken || []).map(m => m.wendung)
      .filter(w => kern.indexOf(w) < 0);
  });
  if(schlecht.length) throw new Error('aus dem Fundus statt dem Kern: ' + schlecht.join(', '));
  return 'alle drei aus dem Kern';
});

/* Acht Marken an einem Wochenende — vier Leute über beide Stufen. Keine zweimal. */
await schritt('Auch über alle Stufen hinweg wiederholt sich keine', async () => {
  const w = await p.evaluate(() => {
    const tg = state.we[0].tage[0];
    Object.keys(tg.orte[1].getraenke).forEach(id => {
      tg.orte[1].getraenke[id] = Array(25).fill('normal:05');
    });
    markenPruefen();
    return (state.we[0].marken || []).map(m => m.wendung);
  });
  if(w.length < 8) throw new Error('nur ' + w.length + ' Marken');
  if(w.some(x => !x)) throw new Error('eine Marke ohne Wendung');
  if(new Set(w).size !== w.length)
    throw new Error(w.length + ' Marken, aber nur ' + new Set(w).size + ' Wendungen');
  return w.length + ' Marken, alle verschieden';
});

await schritt('Beim Abschließen fällt die Wendung mit dem Text weg', async () => {
  const x = await p.evaluate(() => {
    state.we[0].zu = true;
    migrieren(state.we);
    const m = state.we[0].marken[0];
    return {text:m.text, wendung:m.wendung, stufe:m.stufe, pid:m.pid};
  });
  if(x.text !== undefined) throw new Error('der Text steht noch da');
  if(x.wendung !== undefined) throw new Error('die Wendung steht noch da');
  if(!x.stufe || !x.pid) throw new Error('die Marke selbst ist weg');
  return 'Text und Wendung weg, Stufe ' + x.stufe + ' bleibt';
});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
