// Die Ehrenhalle seit G62: Pokal-Kacheln, Ehrenliste, Wanderwege, Chronik – was drinsteht,
// in welcher Reihenfolge, wohin ein Tipp führt, und dass sie auch auf schmalen Handys
// nicht quer übersteht.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8976);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8976/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Fünf Leute, vier abgeschlossene Wochenenden, eines läuft.
   Deckelkrone: Fifu → Korbi → Sperry → Fifu. Rekord: Korbi 8 → Fifu 9 → Korbi 10 (Maß).
   Treuepokal: Korbi seit Bamberg, inzwischen vier in Folge. */
const aufbau = () => p.evaluate(() => {
  const h = n => Array(n).fill('normal:05');
  const mass = n => Array(n).fill('normal:10');
  const um = (datum, hhmm) => new Date(datum + 'T' + hhmm + ':00').getTime();
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Gerry'},{id:5,name:'Kammy'}];
  state.einst = {k:40};
  state.we = [
    {id:100, titel:'Pfingsten Regensburg', datum:'2024-05-17', zu:true, dabei:[1,2,3,4,5], tage:[
      {id:101, label:'1. Tag', heim:{'5':um('2024-05-17','23:10')}, schlag:{'2':um('2024-05-17','20:14')},
        orte:[{id:1011, name:'Kneitinger', getraenke:{'1':h(8),'2':h(7),'3':h(6),'4':h(5),'5':h(4)}}]},
      {id:102, label:'2. Tag', heim:{'4':um('2024-05-18','22:40')}, schlag:{'1':um('2024-05-18','19:52')},
        orte:[{id:1021, name:'Spitalgarten', getraenke:{'1':h(6),'2':h(9),'3':h(5),'4':h(5),'5':h(6)}}]}]},
    {id:200, titel:'Oktoberfest', datum:'2024-09-27', zu:true, dabei:[1,2,3,4], tage:[
      {id:201, label:'1. Tag', heim:{'3':um('2024-09-27','21:55')},
        schlag:{'1':um('2024-09-27','14:31'),'2':um('2024-09-27','14:32')},
        orte:[{id:2011, name:'Schottenhamel', getraenke:{'1':mass(5),'2':mass(4),'3':mass(4),'4':mass(3)}}]},
      {id:202, label:'2. Tag', schlag:{'4':um('2024-09-28','13:05')},
        orte:[{id:2021, name:'Augustiner', getraenke:{'1':mass(4),'2':mass(4),'3':mass(2),'4':mass(3)}}]}]},
    {id:300, titel:'Bamberg', datum:'2025-05-09', zu:true, dabei:[1,2,3,5], tage:[
      {id:301, label:'1. Tag', heim:{'2':um('2025-05-09','23:45')}, schlag:{'3':um('2025-05-09','18:20')},
        orte:[{id:3011, name:'Schlenkerla', getraenke:{'1':h(7),'2':h(6),'3':h(9),'5':h(5)}}]}]},
    {id:400, titel:'Herbst Berlin', datum:'2025-10-03', zu:true, dabei:[1,2,3,4,5], tage:[
      {id:401, label:'1. Tag', heim:{'4':um('2025-10-03','22:15'),'5':um('2025-10-03','22:20')},
        schlag:{'2':um('2025-10-03','19:40')},
        orte:[{id:4011, name:'Prater', getraenke:{'1':h(6),'2':h(8),'3':h(7),'4':h(4),'5':h(5)}}]},
      {id:402, label:'2. Tag', heim:{'1':um('2025-10-04','23:30')}, schlag:{'2':um('2025-10-04','20:02')},
        orte:[{id:4021, name:'Klunkerkranich', getraenke:{'1':h(5),'2':h(7),'3':h(6),'4':h(6),'5':h(5)}}]}]},
    {id:500, titel:'Hamburg', datum:'2026-09-25', zu:false, dabei:[1,2,3,4,5], tage:[
      {id:501, label:'1. Tag', schlag:{'3':um('2026-09-25','19:12')},
        orte:[{id:5011, name:'Zum Silbersack', getraenke:{'1':h(4),'2':h(5),'3':h(6),'4':h(3),'5':h(4)}, log:[]}]}]}];
  state.aktivWe = 500; state.aktivTag = 501; state.aktivOrt = 5011;
  ansicht = null; stapel = []; erklaer = null; zeichnen();
  tu.geheRuhm();
});
const text = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim()), sel);

await aufbau();

console.log('\n== Wanderpokale ==');
await schritt('Drei Kacheln, in der Reihenfolge der Pokale, mit Halter und Wert', async () => {
  const k = await text('.eh-kachel');
  const soll = ['DeckelkroneFifu15,0 BE', 'RekordhalterKorbi10,0 BE an einem Tag', 'TreuepokalKorbi4 in Folge'];
  if(k.map(x => x.replace(/ /g, '')).join('|') !== soll.map(x => x.replace(/ /g, '')).join('|'))
    throw new Error(k.join(' | '));
});
await schritt('Beim Treuepokal steht die laufende Serie, nicht die vom Tag der Übergabe', async () => {
  const r = await p.evaluate(() => ({uebergabe:ehrungen().halter.treue.wert,
    kachel:document.querySelectorAll('.eh-kachel')[2].querySelector('em').textContent}));
  if(r.uebergabe !== 3) throw new Error('Übergabe bei ' + r.uebergabe);
  if(r.kachel !== '4 in Folge') throw new Error(r.kachel);
  return 'übergeben mit 3, jetzt 4';
});
await schritt('Die Stand-Zeile zählt Wochenenden, Tage und vergebene Abzeichen', async () => {
  const r = await p.evaluate(() => {
    const c = ehrungen().chronik;
    return {zeile:document.querySelector('.eh-stand').textContent,
            summe:c.reduce((s, x) => s + ABZEICHEN.reduce((a, z) => a + x.a[z.k].length, 0), 0)};
  });
  const soll = '5 Wochenenden · 8 Tage · ' + r.summe + ' Abzeichen vergeben';
  if(r.zeile !== soll) throw new Error(r.zeile + ' statt ' + soll);
  return r.zeile;
});
await schritt('Ein Tipp auf eine Kachel erklärt die Pokale', async () => {
  const w = await p.evaluate(() => { document.querySelector('.eh-kachel').click(); const x = erklaer;
    tu.erklaerZu ? tu.erklaerZu() : (erklaer = null); zeichnen(); return x; });
  if(w !== 'pokale') throw new Error(w);
});

console.log('\n== Ehrenliste ==');
await schritt('Wer Pokale hält, steht oben, dann nach Zahl der Abzeichen', async () => {
  const r = await text('.eh-person .eh-name');
  if(r.join(',') !== 'Korbi,Fifu,Sperry,Gerry,Kammy') throw new Error(r.join(','));
  return 'Sperry vor Gerry: gleich viele, aber zwei Tagessiege';
});
await schritt('Monogramme: zwei Buchstaben, wo einer nicht eindeutig wäre', async () => {
  const r = await text('.eh-person .eh-port');
  if(r.join(',') !== 'Ko,F,S,G,Ka') throw new Error(r.join(','));
});
await schritt('Die Porträts sind kreisrund, in der Liste wie im Wanderweg', async () => {
  const r = await p.evaluate(() => [...document.querySelectorAll('.eh-port')].map(e => {
    const b = e.getBoundingClientRect(); return {b:Math.round(b.width*10)/10, h:Math.round(b.height*10)/10};
  }).filter(x => x.b !== x.h));
  if(r.length) throw new Error(r.length + ' nicht rund: ' + JSON.stringify(r[0]));
});
await schritt('Pokal-Halter haben den Goldschimmer und ihre Pokale unter dem Namen', async () => {
  const r = await p.evaluate(() => [...document.querySelectorAll('.eh-person')].map(k => ({
    id:k.dataset.id, gold:k.querySelector('.eh-port').classList.contains('gold'),
    chips:[...k.querySelectorAll('.eh-chip')].map(c => c.textContent).join('+')})));
  const nach = Object.fromEntries(r.map(x => [x.id, x]));
  if(!nach['1'].gold || nach['1'].chips !== 'Rekordhalter+Treuepokal') throw new Error('Korbi ' + JSON.stringify(nach['1']));
  if(!nach['2'].gold || nach['2'].chips !== 'Deckelkrone') throw new Error('Fifu ' + JSON.stringify(nach['2']));
  if(nach['3'].gold || nach['3'].chips) throw new Error('Sperry ' + JSON.stringify(nach['3']));
});
await schritt('Die Medaillen zählen wie die Ehrungen, leere sind blass', async () => {
  const r = await p.evaluate(() => {
    const eh = ehrungen();
    return [...document.querySelectorAll('.eh-person')].flatMap(k => [...k.querySelectorAll('.eh-med')].map((m, i) => {
      const a = ABZEICHEN[i], n = (eh.zahlen[k.dataset.id] || {})[a.k] || 0;
      const b = m.querySelector('b');
      const ok = m.getAttribute('aria-label') === a.name + ': ' + n && (b ? +b.textContent : 0) === n
        && m.classList.contains('null') === !n;
      return ok ? null : k.dataset.id + '/' + a.k;
    })).filter(Boolean);
  });
  if(r.length) throw new Error('daneben: ' + r.join(', '));
  return '5 Leute × 4 Abzeichen';
});
await schritt('Jedes Abzeichen hat Farbe und Symbol', async () => {
  const r = await p.evaluate(() => ABZEICHEN.filter(a => !/^#[0-9A-F]{6}$/i.test(a.farbe || '') || !/<(path|circle)/.test(a.pfad || ''))
    .map(a => a.k));
  if(r.length) throw new Error(r.join(', '));
});
await schritt('Der goldene Bettzipfel trägt eine goldene Mütze, die anderen ein cremefarbenes Symbol', async () => {
  const r = await p.evaluate(() => [...document.querySelector('.eh-person').querySelectorAll('.eh-med')]
    .map((m, i) => [ABZEICHEN[i].k, getComputedStyle(m.querySelector('svg')).color, getComputedStyle(m).backgroundColor]));
  const z = r.find(x => x[0] === 'zipfel'), rest = r.filter(x => x[0] !== 'zipfel');
  if(z[1] !== 'rgb(242, 193, 78)') throw new Error('Mütze ' + z[1]);
  if(z[2] !== 'rgb(31, 56, 104)') throw new Error('Grund ' + z[2]);
  if(rest.some(x => x[1] !== 'rgb(244, 238, 221)')) throw new Error(JSON.stringify(rest));
  const falsch = await p.evaluate(() => ABZEICHEN.filter(a => a.zeichen && !/^#[0-9A-F]{6}$/i.test(a.zeichen))
    .map(a => a.k));
  if(falsch.length) throw new Error('zeichen: ' + falsch.join(', '));
});
await schritt('Ein Tipp auf eine Person führt zu ihr, zurück geht es in die Ehrenhalle', async () => {
  const r = await p.evaluate(() => {
    document.querySelector('.eh-person[data-id="4"]').click();
    const dort = {m:modus(), id:personId};
    tu.zurueckNavi();
    return {dort, zurueck:modus()};
  });
  if(r.dort.m !== 'person' || r.dort.id !== 4) throw new Error(JSON.stringify(r.dort));
  if(r.zurueck !== 'ruhm') throw new Error('zurück nach ' + r.zurueck);
});
await schritt('Die Legende nennt alle Abzeichen und erklärt sie auf Tipp', async () => {
  const r = await p.evaluate(() => {
    const t = document.querySelector('.eh-legende').textContent;
    document.querySelector('.eh-legende').click();
    const w = erklaer; erklaer = null; zeichnen();
    return {t, w, namen:ABZEICHEN.map(a => a.name)};
  });
  const fehlt = r.namen.filter(n => !r.t.includes(n));
  if(fehlt.length) throw new Error('fehlt: ' + fehlt.join(', '));
  if(r.w !== 'abzeichen') throw new Error(r.w);
});

console.log('\n== Wanderwege ==');
await schritt('Die Deckelkrone geht von links nach rechts, der jetzige Halter zuletzt', async () => {
  const r = await p.evaluate(() => {
    const weg = document.querySelectorAll('.eh-weg')[0];
    return [...weg.querySelectorAll('.eh-halt')].map(x => x.querySelector('.eh-port').textContent
      + (x.classList.contains('jetzt') ? '*' : '') + ' ' + x.querySelector('small').textContent);
  });
  const soll = ['F 2024Pfingsten Regensburg', 'Ko 2024Oktoberfest', 'S 2025Bamberg', 'F* 2025Herbst Berlin'];
  if(r.join('|') !== soll.join('|')) throw new Error(r.join(' | '));
});
await schritt('Mehr als sechs Stationen: die ältesten als „+n“ davor', async () => {
  const r = await p.evaluate(() => {
    const v = Array.from({length:8}, (_, i) => ({wer:[String(1 + i % 5)], weId:100, wert:1}));
    const d = document.createElement('div'); d.innerHTML = wanderweg(v);
    return {n:d.querySelectorAll('.eh-halt').length, mehr:d.querySelector('.eh-halt.mehr').textContent};
  });
  if(r.n !== 7) throw new Error(r.n + ' Stationen');
  if(!/^\+2/.test(r.mehr)) throw new Error(r.mehr);
});
await schritt('Geteilter Pokal: das Monogramm des ersten, mit „+1“', async () => {
  const r = await p.evaluate(() => {
    const d = document.createElement('div'); d.innerHTML = wanderweg([{wer:['1','5'], weId:100, wert:9}]);
    return {port:d.querySelector('.eh-port').textContent, title:d.querySelector('.eh-halt').title};
  });
  if(r.port !== 'Ko+1' || r.title !== 'Korbi, Kammy') throw new Error(JSON.stringify(r));
});
await schritt('Reißt die Serie und hat niemand drei in Folge: „vorerst im Schrank“', async () => {
  const r = await p.evaluate(() => {
    /* Ein Wochenende nur mit einem Gast: Jede Serie reißt, und seine ist eins lang. */
    const merk = JSON.stringify(state.we), merkS = JSON.stringify(state.spieler);
    state.spieler.push({id:6, name:'Gast'});
    state.we[4].zu = true;
    state.we.push({id:600, titel:'Nur der Gast', datum:'2026-11-01', zu:true, dabei:[6], tage:[
      {id:601, label:'1. Tag', orte:[{id:6011, name:'Daheim', getraenke:{'6':['normal:05']}}]}]});
    state.aktivWe = null; zeichnen(); tu.geheRuhm();
    const kachel = document.querySelectorAll('.eh-kachel')[2].textContent;
    const letzter = [...document.querySelectorAll('.eh-weg')[2].querySelectorAll('.eh-halt')].pop();
    state.we = JSON.parse(merk); state.spieler = JSON.parse(merkS); state.aktivWe = 500; zeichnen(); tu.geheRuhm();
    return {kachel, leer:letzter.querySelector('.eh-port').classList.contains('leer'), jetzt:letzter.classList.contains('jetzt')};
  });
  if(!/vorerst im Schrank/.test(r.kachel)) throw new Error(r.kachel);
  if(!r.leer || !r.jetzt) throw new Error('letzte Station: ' + JSON.stringify(r));
});

console.log('\n== Chronik ==');
await schritt('Neueste zuerst, das laufende Wochenende mit „läuft“', async () => {
  const r = await p.evaluate(() => [...document.querySelectorAll('.eh-chrtitel')]
    .map(t => [...t.children].map(c => c.textContent).join(' ')));
  const soll = ['Hamburg 25.09.2026 läuft', 'Herbst Berlin 03.10.2025', 'Bamberg 09.05.2025',
                'Oktoberfest 27.09.2024', 'Pfingsten Regensburg 17.05.2024'];
  if(r.join('|') !== soll.join('|')) throw new Error(r.join(' | '));
});
await schritt('Je Tag eine Zeile, je Abzeichen eine Spalte', async () => {
  const r = await p.evaluate(() => [...document.querySelectorAll('.eh-chr')[1].querySelectorAll('.eh-raster:not(.eh-rasterkopf)')]
    .map(z => [...z.children].map(c => c.innerHTML.replace(/<br>/g, '+')).join('|')));
  const soll = ['1. Tag|Fifu|Gerry|Fifu|Gerry+Kammy', '2. Tag|Fifu|Korbi+Kammy|Fifu|Korbi'];
  if(r.join(' / ') !== soll.join(' / ')) throw new Error(r.join(' / '));
  return 'Herbst Berlin';
});
await schritt('Ein Tipp führt zum Fazit, beim laufenden Wochenende in den Zwischenstand', async () => {
  const r = await p.evaluate(() => {
    document.querySelectorAll('.eh-chr')[2].click();
    const fazit = {m:modus(), id:detailId};
    tu.zurueckNavi();
    document.querySelectorAll('.eh-chr')[0].click();
    const zw = modus();
    tu.zurueckNavi();
    return {fazit, zw, zurueck:modus()};
  });
  if(r.fazit.m !== 'wedetail' || r.fazit.id !== 300) throw new Error(JSON.stringify(r.fazit));
  if(r.zw !== 'zwischen') throw new Error('läuft → ' + r.zw);
  if(r.zurueck !== 'ruhm') throw new Error('zurück nach ' + r.zurueck);
});

console.log('\n== Auf schmalen Handys ==');
for(const breite of [390, 320]){
  await schritt('Bei ' + breite + ' px steht nichts quer über', async () => {
    await p.setViewportSize({width:breite, height:800});
    await p.evaluate(() => zeichnen());
    const r = await p.evaluate(() => {
      const w = innerWidth;
      const zu = [...document.querySelectorAll('#app *')].filter(e => e.getBoundingClientRect().right > w + .5)
        .map(e => e.className);
      return {sw:document.documentElement.scrollWidth, w, zu:[...new Set(zu)].slice(0, 4)};
    });
    if(r.sw > r.w || r.zu.length) throw new Error(r.sw + ' > ' + r.w + ': ' + r.zu.join(', '));
  });
}
await p.setViewportSize({width:390, height:844});

console.log('\n== Noch nichts gewertet ==');
await schritt('Ohne Wochenenden: leere Kacheln und Hinweise, kein Fehler', async () => {
  const r = await p.evaluate(() => {
    state.we = []; state.aktivWe = null; state.aktivTag = null; state.aktivOrt = null;
    zeichnen(); tu.geheRuhm();
    return {kacheln:[...document.querySelectorAll('.eh-kachel em')].map(e => e.textContent),
            app:document.getElementById('app').textContent};
  });
  if(r.kacheln.some(x => x !== 'noch nicht vergeben')) throw new Error(r.kacheln.join(' | '));
  if(!/Noch nichts gewertet/.test(r.app)) throw new Error('kein Hinweis');
});

await schritt('Kein Zeichnen ist fehlgeschlagen', async () => {
  if(fehler.length) throw new Error(fehler.join(' | '));
});
await schritt('Alle data-tu-Aktionen haben einen Handler', async () => {
  const namen = [...new Set([...html.matchAll(/data-tu="([A-Za-z]+)"/g)].map(m => m[1]))];
  const fehlt = await p.evaluate(n => n.filter(x => typeof tu[x] !== 'function'), namen);
  if(fehlt.length) throw new Error(fehlt.join(', '));
});

console.log('');
await b.close(); srv.close();
