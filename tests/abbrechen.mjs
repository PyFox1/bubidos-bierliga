// „+ Tag" und „+ Location" fragen erst, legen dann an. Vorher war es andersherum: Der Tag
// beziehungsweise die Station stand schon im Bestand, wenn „Wo seid ihr jetzt?" aufging –
// und wer sich vertippt hatte, stand vor einem Blatt mit genau einem Ausgang („Passt").
// Diese Datei hält beide Hälften fest: dass vor „Passt" nichts entsteht, und dass mit
// „Passt" alles entsteht, was vorher der Knopf erledigt hat.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8974);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:2});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
/* Das Fangnetz in zeichnen() schluckt Ausnahmen – ohne diese Zeile sähe ein kaputtes
   ansichtBenennen() aus wie „das Blatt ist halt nicht da". */
p.on('console', m => {
  if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text()))
    fehler.push('FANGNETZ: ' + m.text());
});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8974/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Ein laufendes Wochenende, ein Tag, zwei Stationen. Die Runde steht auf der zweiten. */
const aufbau = () => p.evaluate(() => {
  const bier = k => Array(k).fill('normal:05');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},
                   {id:4,name:'Gerry'}];
  state.we = [{id:900, titel:'Heidelberg', datum:'2026-09-14', zu:false, dabei:[1,2,3,4],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:10, name:'Zum Ochsen',
       getraenke:{'1':bier(2),'2':bier(1),'3':bier(1),'4':bier(1)}, log:[]},
      {id:11, name:'Augustiner',
       getraenke:{'1':bier(3),'2':bier(2),'3':bier(2),'4':bier(2)}, log:[]}
    ]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  state.einst = {k:40, kiSchluessel:''};
  ansicht = null; benennen = false; letzteRunde = null; nachfrage = null;
  pinLoeschen(); zeichnen();
});

const lage = () => p.evaluate(() => {
  const we = state.we[0];
  return {
    tage: we.tage.length,
    label: we.tage.map(t => t.label).join(' | '),
    orte: we.tage.map(t => t.orte.map(o => o.name).join(',')).join(' || '),
    leute: we.tage.map(t => t.orte.map(o => Object.keys(o.getraenke).join('')).join(',')).join(' || '),
    aktivTag: state.aktivTag, aktivOrt: state.aktivOrt,
    hier: (aktuell().ort || {}).name,
    pin: ortPin ? ortPin.tagId + '/' + ortPin.ortId : null,
    getrennt: /getrennt/i.test(document.body.innerText),   // steht per CSS groß da
    blatt: !!document.querySelector('.karte [data-tu="benennenAb"]'),
    zeile: (document.querySelector('.karte .mini') || {}).textContent || '',
    angeboten: [...document.querySelectorAll('.teiln.haken [data-tu="mitAn"]')]
                 .map(e => e.textContent).join(',')
  };
});

console.log('\n══ Vor „Passt" ist nichts angelegt ══');

await aufbau();
await p.waitForTimeout(200);
const vorher = await lage();

await schritt('„+ Tag" fragt erst und legt nichts an', async () => {
  await p.evaluate(() => tu.tagNeu());
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.tage !== vorher.tage) throw new Error('es stehen schon ' + x.tage + ' Tage im Bestand');
  if(x.orte !== vorher.orte) throw new Error('die Kette hat sich geändert: ' + x.orte);
  if(x.aktivTag !== vorher.aktivTag || x.aktivOrt !== vorher.aktivOrt)
    throw new Error('der Zeiger der Gruppe ist schon gewandert');
  if(!x.blatt) throw new Error('kein Blatt');
  await p.screenshot({path: ORDNER + 'abbrechen-tag.png'});
  return 'Blatt offen, Bestand unverändert';
});

/* Das Blatt muss die Zahlen zeigen, die nach „Passt" gelten – nicht die von jetzt. */
await schritt('Das Blatt kündigt den Tag an, den es anlegen würde', async () => {
  const x = await lage();
  if(!/2\. Tag/.test(x.zeile)) throw new Error('im Blatt steht: ' + x.zeile.trim());
  return x.zeile.trim().slice(0, 40);
});

await schritt('Das Kreuz überlappt die Überschrift nicht', async () => {
  const x = await p.evaluate(() => {
    const k = document.querySelector('.karte [data-tu="benennenAb"]').getBoundingClientRect();
    /* Nicht die Box der Überschrift messen, sondern den Text darin: Ein padding-right
       hält den Text zwar frei, die Box reicht aber weiter und meldete 32 px Überlappung,
       wo keine ist. */
    const r = document.createRange();
    r.selectNodeContents(document.querySelector('.karte h3'));
    return {kreuzLinks: k.left, textRechts: r.getBoundingClientRect().right};
  });
  if(x.textRechts > x.kreuzLinks)
    throw new Error('die Überschrift reicht ' + Math.round(x.textRechts - x.kreuzLinks)
      + ' px unter das Kreuz');
  return Math.round(x.kreuzLinks - x.textRechts) + ' px Luft';
});

await schritt('Das Kreuz lässt den Bestand, wie er war', async () => {
  await p.evaluate(() => tu.benennenAb());
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.tage !== vorher.tage || x.orte !== vorher.orte)
    throw new Error('geändert: ' + x.tage + ' Tage, ' + x.orte);
  if(x.aktivTag !== vorher.aktivTag || x.aktivOrt !== vorher.aktivOrt)
    throw new Error('der Zeiger steht auf ' + x.aktivTag + '/' + x.aktivOrt);
  if(x.pin) throw new Error('es hängt ein Pin auf ' + x.pin);
  if(x.getrennt) throw new Error('die Kopfzeile meldet „getrennt"');
  if(x.blatt) throw new Error('das Blatt steht noch offen');
  return 'unverändert, Gerät in ' + x.hier;
});

await schritt('„+ Location" fragt erst und legt nichts an', async () => {
  await p.evaluate(() => tu.ortNeu());
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.orte !== vorher.orte) throw new Error('die Kette hat sich geändert: ' + x.orte);
  if(x.pin) throw new Error('es hängt schon ein Pin auf ' + x.pin);
  if(!x.blatt) throw new Error('kein Blatt');
  if(!/Station 3/.test(x.zeile)) throw new Error('im Blatt steht: ' + x.zeile.trim());
  await p.evaluate(() => tu.benennenAb());
  await p.waitForTimeout(150);
  const y = await lage();
  if(y.orte !== vorher.orte) throw new Error('nach dem Kreuz: ' + y.orte);
  if(y.hier !== vorher.hier) throw new Error('das Gerät steht jetzt in ' + y.hier);
  return 'Blatt kündigt Station 3 an, Kette bleibt bei ' + y.orte;
});

/* Der eigentliche Gewinn: Solange niemand bestätigt hat, sehen die anderen Handys nichts.
   Vorher ging die frische Station mit dem Öffnen des Blattes sofort hinaus. */
await schritt('Solange das Blatt offen steht, geht nichts an die anderen Handys', async () => {
  const n = await p.evaluate(() => {
    let zaehler = 0;
    const echt = sichern;
    sichern = function(...a){ zaehler++; return echt.apply(this, a); };
    tu.tagNeu(); tu.benennenAb();
    tu.ortNeu(); tu.benennenAb();
    sichern = echt;
    return zaehler;
  });
  if(n !== 0) throw new Error('es wurde ' + n + '-mal gesichert');
  return 'kein Schreibvorgang bei vier Handgriffen';
});

console.log('\n══ Mit „Passt" entsteht alles ══');

await schritt('„Passt" legt den Tag an, mit der ganzen Runde', async () => {
  await aufbau();
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    tu.tagNeu();
    document.getElementById('ortNameNeu').value = 'Frühstück';
    tu.benennenFertig();
  });
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.tage !== 2) throw new Error('es sind ' + x.tage + ' Tage');
  if(x.label !== '1. Tag | 2. Tag') throw new Error('Beschriftung: ' + x.label);
  if(!/Frühstück/.test(x.orte)) throw new Error('Stationen: ' + x.orte);
  if(x.hier !== 'Frühstück') throw new Error('das Gerät steht in ' + x.hier);
  if(x.leute.split(' || ')[1] !== '1234')
    throw new Error('am neuen Tag stehen: ' + x.leute.split(' || ')[1]);
  if(x.pin) throw new Error('es hängt ein Pin auf ' + x.pin);
  return x.label + ' · ' + x.orte;
});

await schritt('„Passt" legt die Location an und benennt sie', async () => {
  await aufbau();
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    tu.ortNeu();
    document.getElementById('ortNameNeu').value = 'Zur Krone';
    tu.benennenFertig();
  });
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.orte.indexOf('Zur Krone') < 0) throw new Error('Stationen: ' + x.orte);
  if(x.blatt) throw new Error('das Blatt steht noch offen');
  if(x.pin) throw new Error('alle sind mitgegangen, trotzdem hängt ein Pin auf ' + x.pin);
  if(x.hier !== 'Zur Krone') throw new Error('das Gerät steht in ' + x.hier);
  return x.orte;
});

await schritt('Ohne Eingabe bleibt es beim vorgeschlagenen Namen', async () => {
  await aufbau();
  await p.waitForTimeout(150);
  await p.evaluate(() => { tu.ortNeu(); tu.benennenFertig(); });
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.orte.indexOf('Location 3') < 0) throw new Error('Stationen: ' + x.orte);
  return x.orte;
});

console.log('\n══ Die Aufteilung läuft weiter wie gehabt ══');

await schritt('Wer abgehakt wird, bleibt sitzen – nur dieses Gerät zieht vor', async () => {
  await aufbau();
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    tu.ortNeu();
    tu.mitAn({dataset:{id:'3'}});
    tu.mitAn({dataset:{id:'4'}});
    document.getElementById('ortNameNeu').value = 'Neubau';
    tu.benennenFertig();
  });
  await p.waitForTimeout(150);
  const x = await lage();
  const neu = x.leute.split(',')[2];
  if(neu !== '12') throw new Error('im Neubau stehen: ' + neu);
  if(x.aktivOrt !== 11) throw new Error('der Gruppenzeiger ist auf ' + x.aktivOrt + ' gewandert');
  if(!x.pin) throw new Error('dieses Gerät hat keinen eigenen Standort');
  if(x.hier !== 'Neubau') throw new Error('das Gerät steht in ' + x.hier);
  if(!x.getrennt) throw new Error('die Kopfzeile meldet nicht „getrennt"');
  await p.screenshot({path: ORDNER + 'abbrechen-teilung.png'});
  return 'Neubau mit ' + neu + ', Gruppe bleibt auf 11';
});

await schritt('Wer schon vorausgezogen ist, wird gar nicht angeboten', async () => {
  await p.evaluate(() => {
    /* Sperry und Gerry sitzen noch im Augustiner, Korbi und Fifu sind im Neubau. Vom
       Augustiner aus darf „Wer geht mit?" die beiden vorn nicht noch einmal anbieten. */
    zieheZu(901, 11);
    tu.ortNeu();
  });
  await p.waitForTimeout(150);
  const x = await lage();
  if(x.angeboten !== 'Sperry,Gerry') throw new Error('angeboten wird: ' + x.angeboten);
  await p.evaluate(() => tu.benennenAb());
  return 'nur ' + x.angeboten;
});

/* Wie jede Testdatei: Jede data-tu-Aktion braucht einen Handler im tu-Objekt. */
await schritt('Alle data-tu-Aktionen haben einen Handler', async () => {
  const fehlend = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => {
      if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu);
    });
    return [...raus];
  });
  if(fehlend.length) throw new Error('ohne Handler: ' + fehlend.join(', '));
  return 'vollständig';
});

console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;
await b.close(); srv.close();
