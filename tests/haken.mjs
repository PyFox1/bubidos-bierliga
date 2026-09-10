// Sieht man den Namensreihen an, dass schon alles angehakt ist?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8955);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8955/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufbau = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},
                   {id:4,name:'Gerry'},{id:5,name:'Kammy'}];
  state.we = [{id:900, titel:'Nockherberg', datum:'2026-09-09', zu:false, dabei:[1,2,3,4,5],
    tage:[{id:901, label:'1. Tag', orte:[{id:11, name:'Augustiner',
      getraenke:{'1':[], '2':[], '3':[], '4':[], '5':[]}}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 11;
  ansicht = null; vorwahl = null; stapel = []; benennen = false; pinLoeschen();
  zeichnen();
});

/* Ein Kästchen ist nur dann eins, wenn das Pseudo-Element tatsächlich Fläche bekommt –
   ein Tippfehler im Selektor fiele sonst niemandem auf. */
const kasten = (sel, welch) => p.evaluate(([sel, welch]) => {
  const el = document.querySelector(sel);
  if(!el) return null;
  const s = getComputedStyle(el, welch);
  return {inhalt:s.content, breite:s.width, hoehe:s.height, hg:s.backgroundColor,
          strich:getComputedStyle(el).textDecorationLine};
}, [sel, welch]);

console.log('\n══ Neues Wochenende / Deckblatt ══');

await aufbau();
await p.evaluate(() => { tu.weKopf(); vorwahl.offen = true; vorwahl.ids = [1,2,3,5]; zeichnen(); });
await p.waitForTimeout(250);

await schritt('Die Namensreihe ist als Hakenliste ausgezeichnet', async () => {
  const k = await p.evaluate(() => document.getElementById('vorauswahl').className);
  if(!/\bhaken\b/.test(k)) throw new Error('Klasse: ' + k);
  return k;
});

await schritt('Jeder Name trägt ein sichtbares Kästchen', async () => {
  const k = await kasten('#vorauswahl button', '::before');
  if(!k) throw new Error('kein Knopf gefunden');
  if(k.breite !== '16px' || k.hoehe !== '16px')
    throw new Error('Kästchen ist ' + k.breite + '×' + k.hoehe);
  return k.breite + '×' + k.hoehe;
});

await schritt('Der angehakte trägt einen Haken, das Kästchen ist gefüllt', async () => {
  const vor = await kasten('#vorauswahl button[data-an="1"]', '::before');
  const nach = await kasten('#vorauswahl button[data-an="1"]', '::after');
  if(vor.hg === 'rgba(0, 0, 0, 0)') throw new Error('Kästchen ist leer geblieben');
  if(nach.breite === 'auto' || parseFloat(nach.breite) < 3)
    throw new Error('kein Haken: ' + nach.breite);
  return 'gefüllt ' + vor.hg + ', Haken ' + nach.breite + '×' + nach.hoehe;
});

await schritt('Der abgewählte hat ein leeres Kästchen und ist durchgestrichen', async () => {
  const k = await kasten('#vorauswahl button[data-an="0"]', '::before');
  if(k.hg !== 'rgba(0, 0, 0, 0)') throw new Error('Kästchen ist gefüllt: ' + k.hg);
  if(!/line-through/.test(k.strich)) throw new Error('nicht durchgestrichen: ' + k.strich);
  return 'leer und durchgestrichen';
});

await schritt('Über den Namen steht, dass schon alles angehakt ist', async () => {
  const t = await p.evaluate(() => {
    const r = document.getElementById('vorauswahl');
    return r.previousElementSibling ? r.previousElementSibling.textContent.trim() : '';
  });
  if(!/angehakt/.test(t)) throw new Error('darüber steht: "' + t + '"');
  if(/schaltet aus und wieder ein/.test(t))
    throw new Error('noch der alte Text, der nicht sagt, wie der Ausgangszustand ist');
  return t;
});

await schritt('Antippen wählt weiterhin ab und wieder an', async () => {
  const r = await p.evaluate(async () => {
    const vorher = vorwahl.ids.slice();
    document.querySelector('#vorauswahl button[data-id="1"]').click();
    const nachAus = vorwahl.ids.slice();
    document.querySelector('#vorauswahl button[data-id="1"]').click();
    return {vorher, nachAus, nachEin:vorwahl.ids.slice()};
  });
  if(r.nachAus.includes(1)) throw new Error('erster Tipp hat nicht abgewählt');
  if(!r.nachEin.includes(1)) throw new Error('zweiter Tipp hat nicht wieder angehakt');
  return 'aus und wieder ein';
});

console.log('\n══ Wer geht mit? ══');

await aufbau();
await p.evaluate(() => { benennen = {ortId:11, mit:[1,2,3]}; zeichnen(); });
await p.waitForTimeout(250);

await schritt('Auch dort sind es Kästchen', async () => {
  const kl = await p.evaluate(() => {
    const r = [...document.querySelectorAll('.blende .teiln')]
      .find(x => [...x.querySelectorAll('button')].some(y => y.dataset.tu === 'mitAn'));
    return r ? r.className : null;
  });
  if(!kl) throw new Error('keine Reihe gefunden');
  if(!/\bhaken\b/.test(kl)) throw new Error('Klasse: ' + kl);
  return kl;
});

await schritt('Und darüber steht dasselbe', async () => {
  const t = await p.evaluate(() => document.body.innerText);
  if(!/Alle sind angehakt/.test(t)) throw new Error('kein Hinweis über der Reihe');
  return 'steht da';
});

console.log('\n══ Was nicht mitwandern darf ══');

/* Reihen, bei denen genau eines gilt, sind keine Hakenlisten – ein Kästchen würde dort
   Mehrfachauswahl versprechen, die es nicht gibt. */
await schritt('Gerätename und KI-Modell bleiben ohne Kästchen', async () => {
  const r = await p.evaluate(() => {
    ansicht = 'einst'; benennen = false; zeichnen();
    return [...document.querySelectorAll('.teiln')].map(x => ({
      kl:x.className,
      tu:[...x.querySelectorAll('button')].map(y => y.dataset.tu).filter((v,i,a) => a.indexOf(v) === i)
    }));
  });
  const falsch = r.filter(x => /\bhaken\b/.test(x.kl)
    && x.tu.some(t => t === 'ichBin' || t === 'kiModellWahl'));
  if(falsch.length) throw new Error('hat Kästchen bekommen: ' + falsch.map(x => x.tu).join(', '));
  return r.length + ' Reihen geprüft, keine davon';
});

await schritt('Alle data-tu haben weiterhin einen Handler', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    const s = () => [...document.querySelectorAll('[data-tu]')]
      .forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    s();
    ansicht = null; zeichnen(); s();
    benennen = {ortId:11, mit:[1,2]}; zeichnen(); s();
    benennen = false; tu.weKopf(); vorwahl.offen = true; zeichnen(); s();
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log('');
await b.close(); srv.close();
