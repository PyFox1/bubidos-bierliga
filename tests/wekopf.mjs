// Führt der Zurück-Pfeil an der ersten Location aufs Deckblatt, und schreibt es zurück?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8954);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8954/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Ein laufendes Wochenende, eine einzige Location, drei Leute – Korbi und Fifu haben
   schon getrunken, Sperry ist da und hat nichts. */
const aufbau = (mehr) => p.evaluate((mehr) => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},
                   {id:4,name:'Gerry'}];
  const orte = [{id:11, name:'Augustiner', getraenke:{
    '1':['normal:05','normal:05'], '2':['normal:05'], '3':[]}}];
  if(mehr) orte.push({id:12, name:'Neubau', getraenke:{'1':[], '2':[]}});
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-09', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = mehr ? 12 : 11;
  ansicht = null; vorwahl = null; stapel = []; pinLoeschen();
  if(mehr) zieheZu(901, 11);   // aufs erste Blatt der Kette blättern
  zeichnen();
}, mehr);

await aufbau(false);
await p.waitForTimeout(300);

console.log('\n══ Der Pfeil an der ersten Location ══');

await schritt('Die Navi steht auch bei einer einzigen Location da', async () => {
  const n = await p.$('.kettennavi');
  if(!n) throw new Error('keine Kettennavi – der Weg zurück fehlt gleich nach dem Start');
  return 'da';
});

await schritt('Der Zurück-Pfeil ist nicht grau, sondern führt aufs Deckblatt', async () => {
  const k = await p.evaluate(() => {
    const x = document.querySelector('.kettennavi button');
    return {tu:x.dataset.tu, aus:x.disabled, label:x.getAttribute('aria-label')};
  });
  if(k.aus) throw new Error('immer noch disabled');
  if(k.tu !== 'weKopf') throw new Error('zeigt auf ' + k.tu);
  return k.label;
});

/* Die Felder tragen ihren Inhalt im value, nicht im Text – innerText sieht sie nicht.
   Die Knöpfe wiederum stellt das CSS in Versalien, deshalb hier immer gegen das HTML. */
const blatt = () => p.evaluate(() => ({
  text: document.body.innerText,
  titel: (document.getElementById('weTitel')||{}).value,
  datum: (document.getElementById('weDatum')||{}).value,
  ort:   (document.getElementById('weOrt')||{}).value,
  knopf: [...document.querySelectorAll('.knopf')].map(x => x.textContent.trim())
}));

await schritt('Ein Tipp landet auf dem Wochenend-Blatt', async () => {
  await p.evaluate(() => tu.weKopf());
  await p.waitForTimeout(250);
  const b = await blatt();
  if(!b.text.includes('Das Wochenende')) throw new Error('keine Überschrift');
  if(b.titel !== 'Nockherberg') throw new Error('Titelfeld: ' + b.titel);
  if(b.datum !== '2026-09-09') throw new Error('Datumsfeld: ' + b.datum);
  if(b.ort !== 'Augustiner') throw new Error('Ortsfeld: ' + b.ort);
  if(!b.text.includes('Wer ist an der ersten Location dabei?'))
    throw new Error('keine Vorauswahl');
  return b.titel + ' · ' + b.datum + ' · ' + b.ort;
});

await schritt('Es heißt nicht „Neues Wochenende“ und nicht „Los geht’s“', async () => {
  const b = await blatt();
  if(b.text.includes('Neues Wochenende')) throw new Error('„Neues Wochenende“ steht da');
  if(b.knopf.some(x => x.includes('Los geht')))
    throw new Error('„Los geht’s“ steht da – das legt ein zweites Wochenende an');
  if(JSON.stringify(b.knopf) !== JSON.stringify(['Passt','Abbrechen']))
    throw new Error('Knöpfe: ' + b.knopf.join(', '));
  return b.knopf.join(' / ');
});

await schritt('Der Kopf hat einen Zurück-Pfeil', async () => {
  const z = await p.evaluate(() => {
    const x = document.querySelector('.kopf-zurueck');
    return x ? x.dataset.tu : null;
  });
  if(!z) throw new Error('kein Zurück im Kopf');
  if(z !== 'weKopfZu') throw new Error('zeigt auf ' + z);
  return z;
});

await schritt('Die Vorauswahl steht auf denen, die an der Location sind', async () => {
  const v = await p.evaluate(() => { vorwahl.offen = true; zeichnen();
    return [...document.querySelectorAll('#vorauswahl button')]
      .map(x => x.textContent.trim() + ':' + x.dataset.an); });
  const soll = ['Korbi2×:1','Fifu1×:1','Sperry:1','Gerry:0'];
  if(JSON.stringify(v) !== JSON.stringify(soll))
    throw new Error(v.join(' | '));
  return v.join(' ');
});

await p.screenshot({path:ORDNER + 'wekopf-blatt.png', fullPage:true});

console.log('\n══ Was „Passt“ zurückschreibt ══');

await schritt('Titel, Datum und Ortsname landen im laufenden Wochenende', async () => {
  const r = await p.evaluate(() => {
    document.getElementById('weTitel').value = 'Nockherberg 2026';
    document.getElementById('weDatum').value = '2026-09-10';
    document.getElementById('weOrt').value = 'Augustiner Keller';
    tu.weKopfPasst();
    const w = state.we[0];
    return {t:w.titel, d:w.datum, o:w.tage[0].orte[0].name, ansicht:modus()};
  });
  if(r.t !== 'Nockherberg 2026') throw new Error('Titel: ' + r.t);
  if(r.d !== '2026-09-10') throw new Error('Datum: ' + r.d);
  if(r.o !== 'Augustiner Keller') throw new Error('Ort: ' + r.o);
  if(r.ansicht !== 'zaehlen') throw new Error('bleibt auf ' + r.ansicht + ' stehen');
  return r.t + ' · ' + r.d + ' · ' + r.o;
});

await schritt('Die Striche der Dagebliebenen sind unangetastet', async () => {
  const g = await p.evaluate(() => state.we[0].tage[0].orte[0].getraenke);
  if(g['1'].length !== 2 || g['2'].length !== 1)
    throw new Error(JSON.stringify(g));
  if(!Array.isArray(g['3']) || g['3'].length)
    throw new Error('Sperry hat sein „war da, nichts getrunken“ verloren');
  return 'Korbi 2, Fifu 1, Sperry 0';
});

await aufbau(false);
await p.waitForTimeout(200);

await schritt('Jemanden dazunehmen legt ihn mit leerer Liste an', async () => {
  const r = await p.evaluate(() => {
    tu.weKopf();
    vorwahl.ids = [1,2,3,4];
    tu.weKopfPasst();
    const o = state.we[0].tage[0].orte[0];
    return {k:Object.keys(o.getraenke).sort(), vier:o.getraenke['4'], dabei:state.we[0].dabei};
  });
  if(!r.k.includes('4')) throw new Error('Gerry fehlt: ' + r.k.join(','));
  if(!Array.isArray(r.vier) || r.vier.length) throw new Error('nicht leer angelegt');
  if(!r.dabei.includes(4)) throw new Error('nicht in we.dabei: ' + r.dabei.join(','));
  return 'Gerry drin, we.dabei ' + r.dabei.join(',');
});

await aufbau(false);
await p.waitForTimeout(200);

await schritt('Abwählen wirft ihn samt Strichen raus', async () => {
  const r = await p.evaluate(() => {
    tu.weKopf();
    vorwahl.ids = [1,2];               // Sperry raus
    tu.weKopfPasst();
    const o = state.we[0].tage[0].orte[0];
    return {k:Object.keys(o.getraenke).sort(), dabei:state.we[0].dabei};
  });
  if(r.k.includes('3')) throw new Error('Sperry steht noch da');
  if(r.dabei.includes(3)) throw new Error('Sperry noch in we.dabei');
  return 'weg, we.dabei ' + r.dabei.join(',');
});

console.log('\n══ Was nicht kaputtgehen darf ══');

/* Der Klassiker: Die Runde hat sich aufgeteilt, zwei sitzen an einer späteren Station.
   Wer dort steht, darf beim Aufräumen der ersten Location nicht mit verschwinden. */
await aufbau(true);
await p.waitForTimeout(200);

await schritt('Wer an einer späteren Station steht, bleibt im Wochenende', async () => {
  const r = await p.evaluate(() => {
    tu.weKopf();
    vorwahl.ids = [1];                 // Fifu an der ersten Location abwählen
    vorwahl.ids = [1,3];
    tu.weKopfPasst();
    const w = state.we[0];
    return {erste:Object.keys(w.tage[0].orte[0].getraenke).sort(),
            zweite:Object.keys(w.tage[0].orte[1].getraenke).sort(), dabei:w.dabei};
  });
  if(r.erste.includes('2')) throw new Error('an der ersten Location noch da');
  if(!r.zweite.includes('2')) throw new Error('aus der zweiten Location gelöscht');
  if(!r.dabei.includes(2))
    throw new Error('aus we.dabei geflogen, obwohl er im Neubau sitzt: ' + r.dabei.join(','));
  return 'Fifu sitzt im Neubau und bleibt in we.dabei';
});

await aufbau(true);
await p.waitForTimeout(200);

await schritt('An der zweiten Location führt ‹ wieder zur vorigen Location', async () => {
  const k = await p.evaluate(() => {
    zieheZu(901, 12);
    return document.querySelector('.kettennavi button').dataset.tu;
  });
  if(k !== 'zurueckOrt') throw new Error('zeigt auf ' + k);
  return 'zurueckOrt';
});

await aufbau(false);
await p.waitForTimeout(200);

await schritt('Unter zwei Leuten lässt es sich nicht übernehmen', async () => {
  const r = await p.evaluate(() => {
    tu.weKopf(); vorwahl.ids = [1]; zeichnen();
    const knopf = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Passt');
    return {aus:knopf ? knopf.disabled : null, txt:document.body.innerText};
  });
  if(r.aus !== true) throw new Error('„Passt“ ist nicht gesperrt');
  if(!r.txt.includes('Unter zwei geht es nicht'))
    throw new Error('kein Hinweis, warum');
  return 'gesperrt mit Begründung';
});

await schritt('Wessen Striche auf dem Spiel stehen, wird vorher genannt', async () => {
  const t = await p.evaluate(() => {
    tu.weKopf(); vorwahl.ids = [2,3]; zeichnen();   // Korbi mit 2 Strichen raus
    return document.body.innerText;
  });
  if(!t.includes('Korbi hat hier 2 Getränke stehen'))
    throw new Error('keine Warnung vor dem Verlust');
  return 'Warnung steht da';
});

await p.screenshot({path:ORDNER + 'wekopf-warnung.png', fullPage:true});

await schritt('Das Eröffnen eines Wochenendes ist unverändert', async () => {
  await p.evaluate(() => { state.aktivWe = null; tu.weNeu(); });
  const b = await blatt();
  if(!b.text.includes('Neues Wochenende')) throw new Error('Überschrift weg');
  if(!b.knopf.some(x => x.includes('Los geht'))) throw new Error('„Los geht’s“ weg: ' + b.knopf.join(', '));
  if(b.knopf.some(x => x === 'Passt')) throw new Error('zeigt „Passt“ beim Eröffnen');
  const z = await p.evaluate(() => !!document.querySelector('.kopf-zurueck'));
  if(z) throw new Error('hat plötzlich einen Zurück-Pfeil im Kopf');
  return b.knopf.join(' / ');
});

console.log('\n══ Hängt jede data-tu-Aktion an einem Handler? ══');
await schritt('Auf allen drei Bildschirmen', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    const sammeln = () => [...document.querySelectorAll('[data-tu]')]
      .forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    sammeln();
    state.aktivWe = 900; ansicht = null; vorwahl = null; zeichnen(); sammeln();
    tu.weKopf(); vorwahl.offen = true; vorwahl.ids = [2]; zeichnen(); sammeln();
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log('');
await b.close(); srv.close();
