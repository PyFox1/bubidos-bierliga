// Das Abzeichen Schrittmacher (G61): wer als Erster drei Getränke binnen einer halben
// Stunde hat. Vergeben wird es am Tag, gezählt wird nur, was im Moment getippt wurde –
// Nachgetragenes nicht. Die Zeit wird festgehalten, weil das Tagebuch beim Abschließen
// verschwindet und je Station nur vierzig Einträge behält.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8975);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.route('**/api.anthropic.com/**', r => r.abort());
/* Die Uhr lässt sich vorstellen, ohne eine halbe Stunde zu warten. */
await p.addInitScript(() => {
  localStorage.setItem('bubidos-token', 'github_pat_test');
  const echt = Date.now.bind(Date);
  window.__versatz = 0;
  Date.now = () => echt() + window.__versatz;
});
await p.goto('http://localhost:8975/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};
const spulen = min => p.evaluate(m => { window.__versatz += m * 60000; }, min);

/* Vier am Tisch, noch nichts getrunken. Zwei Stationen stehen bereit, die Runde sitzt
   in der ersten. */
const aufbau = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Gerry'}];
  state.einst = {k:40};
  state.we = [{id:900, titel:'Jetzt', datum:'2026-09-26', zu:false, dabei:[1,2,3,4], marken:[], tage:[
    {id:901, label:'1. Tag', orte:[{id:1, name:'Hofbräu',
      getraenke:{'1':[],'2':[],'3':[],'4':[]}, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.wahlS = 'normal'; state.wahlG = '05';
  ansicht = null; blatt = null; benennen = false; nachfrage = null; letzteRunde = null;
  fazitOffen = null; heimBlatt = null; entsperrt = null; pinLoeschen();
  localStorage.removeItem('bubidos-urkunden');
  zeichnen();
});
/* Ein Strich, wie ihn der Finger setzt – fragt das + nach, bleibt es bei der Frage. */
const tipp = pid => p.evaluate(id => tu.strich({dataset:{id:String(id)}}), pid);
const tag = () => p.evaluate(() => JSON.parse(JSON.stringify(state.we[0].tage[0])));
const abz = () => p.evaluate(() => {
  const a = tagAbzeichen(tagAlsLog(state.we[0].tage[0]));
  return {wer:a.schlag.map(String).sort().join('+'), wert:a.wert.schlag};
});

await aufbau();

console.log('\n== Live getippt ==');
let korbiZeit;
await schritt('Drei Striche binnen einer halben Stunde: die Zeit des dritten wird festgehalten', async () => {
  await tipp(1); await tipp(2); await spulen(5);
  await tipp(1); await tipp(2); await spulen(5);
  await tipp(1);
  const t = await tag();
  const dritter = t.orte[0].log.filter(x => x.pid === '1').pop().t;
  if(!t.schlag || t.schlag['1'] !== dritter) throw new Error(JSON.stringify(t.schlag));
  korbiZeit = dritter;
  return 'Korbi';
});
await schritt('Korbi ist Schrittmacher, allein', async () => {
  const a = await abz();
  if(a.wer !== '1' || a.wert !== korbiZeit) throw new Error(JSON.stringify(a));
});
await schritt('Fifu eine Minute später: gleichzeitig bestellt, geteilt', async () => {
  await spulen(1); await tipp(2);
  const a = await abz();
  if(a.wer !== '1+2') throw new Error(a.wer);
  if(a.wert !== korbiZeit) throw new Error('Wert ist nicht mehr der des Ersten');
});
await schritt('Sperry zwanzig Minuten später: bekommt die Zeit, aber nicht das Abzeichen', async () => {
  await spulen(4); await tipp(3); await spulen(5); await tipp(3); await spulen(5); await tipp(3);
  const t = await tag();
  if(!t.schlag['3']) throw new Error('keine Zeit für Sperry');
  const a = await abz();
  if(a.wer !== '1+2') throw new Error(a.wer);
  return 'Zeiten: ' + Object.keys(t.schlag).sort().join(',');
});

console.log('\n== Nachgetragen zählt nicht ==');
await schritt('Drei vergessene Biere auf einmal nachgetippt: voll gezählt, aber keine Schlagzahl', async () => {
  /* Gerry: tippen – eingetragen. Tippen – Frage. Tippen – bestätigt. Und noch einmal. */
  for(let i = 0; i < 5; i++) await tipp(4);
  const t = await tag();
  if(t.orte[0].getraenke['4'].length !== 3) throw new Error(t.orte[0].getraenke['4'].length + ' Biere');
  const nach = t.orte[0].log.filter(x => x.pid === '4').map(x => !!x.nach);
  if(nach.join() !== 'false,true,true') throw new Error('nach: ' + nach.join());
  if(t.schlag['4'] !== undefined) throw new Error('Gerry hat eine Zeit');
  return 'drei Biere, eines davon live';
});
await schritt('Auch die Meldung zur Schlagzahl nennt ihn nicht', async () => {
  const pids = await p.evaluate(() => (state.we[0].marken || []).filter(m => m.art === 'schlag')
    .flatMap(m => m.pids));
  if(pids.includes('4')) throw new Error(pids.join());
  if(!pids.includes('1')) throw new Error('Korbi fehlt: ' + pids.join());
});
await schritt('Die Sammel-Eingabe zählt ebenfalls nicht', async () => {
  await spulen(40);
  await p.evaluate(() => { tu.blattAuf({dataset:{id:'4'}}); blatt.z['normal:05'] += 3; tu.blattSpeichern(); });
  const t = await tag();
  if(t.schlag['4'] !== undefined) throw new Error('Gerry hat eine Zeit');
});
await schritt('Eine Runde, die erst nach der Rückfrage bestätigt wird, ist ein Nachtrag', async () => {
  await spulen(40);
  const r = await p.evaluate(() => {
    tu.runde();                   // eingetragen
    tu.runde();                   // fragt
    tu.runde();                   // bestätigt
    const l = state.we[0].tage[0].orte[0].log.filter(x => x.art === 'runde');
    return l.map(x => !!x.nach);
  });
  if(r.join() !== 'false,true') throw new Error(r.join());
});
await schritt('Ein Strich an einer entsperrten früheren Station ist ein Nachtrag', async () => {
  await spulen(5);   // die Runde eben ist lange genug her, das + fragt nicht nach
  const r = await p.evaluate(() => {
    const tg = state.we[0].tage[0];
    tg.orte.push({id:2, name:'Augustiner', getraenke:{'1':[],'2':[],'3':[],'4':[]}, log:[]});
    state.aktivOrt = 2; pinLoeschen(); zeichnen();
    tu.zurueckOrt();                              // dieses Handy blättert zurück
    const rueck = istRueckblick();
    tu.entsperren();
    nachfrage = null;
    const vor = tg.orte[0].log.length;
    tu.strich({dataset:{id:'3'}});
    const x = tg.orte[0].log.length > vor ? tg.orte[0].log[tg.orte[0].log.length - 1] : null;
    tu.zurGruppe();
    tu.strich({dataset:{id:'3'}});                 // an der Station der Gruppe: live
    const y = tg.orte[1].log.filter(e => e.pid === '3').pop();
    return {rueck, neuDort:!!x, dort:!!(x && x.nach), hier:!!(y && y.nach), neu:!!y};
  });
  if(!r.rueck) throw new Error('war kein Rückblick');
  if(!r.neuDort) throw new Error('an der früheren Station nichts eingetragen');
  if(!r.dort) throw new Error('an der früheren Station nicht als Nachtrag markiert');
  if(!r.neu || r.hier) throw new Error('an der Station der Gruppe als Nachtrag markiert');
});

console.log('\n== Zurücknehmen ==');
await aufbau();
await schritt('Ein Minus gleich nach dem dritten nimmt die Zeit zurück', async () => {
  await tipp(1); await spulen(5); await tipp(1); await spulen(5); await tipp(1);
  if(!(await tag()).schlag) throw new Error('keine Zeit');
  await spulen(0.5);
  await p.evaluate(() => tu.minus({dataset:{id:'1'}}));
  const t = await tag();
  if(t.schlag && t.schlag['1'] !== undefined) throw new Error('noch da');
  const a = await abz();
  if(a.wer) throw new Error(a.wer);
});
await schritt('Ein Minus nach dem Fenster nimmt sie nicht mehr zurück', async () => {
  await tipp(1);              // wieder drei binnen einer halben Stunde
  const vor = (await tag()).schlag['1'];
  await spulen(3);
  await p.evaluate(() => tu.minus({dataset:{id:'1'}}));
  const t = await tag();
  if(t.schlag['1'] !== vor) throw new Error(JSON.stringify(t.schlag));
  return 'der Moment war';
});

console.log('\n== Bleibt, wenn das Tagebuch vergisst ==');
await aufbau();
await schritt('Vierzig spätere Einträge schieben den Anfang aus dem Tagebuch – die Zeit bleibt', async () => {
  await tipp(2); await spulen(5); await tipp(2); await spulen(5); await tipp(2);
  const vor = (await tag()).schlag['2'];
  for(let i = 0; i < 45; i++){ await spulen(4); await p.evaluate(i => { nachfrage = null;
    tu.strich({dataset:{id:i % 2 ? '1' : '3'}}); }, i); }
  const t = await tag();
  const drin = t.orte[0].log.some(x => x.pid === '2');
  if(drin) throw new Error('Fifus Striche stehen noch im Tagebuch');
  if(t.schlag['2'] !== vor) throw new Error(JSON.stringify(t.schlag));
  const a = await abz();
  if(!a.wer.split('+').includes('2')) throw new Error(a.wer);
  return 'Fifu weiter vorn';
});
await schritt('Nach dem Abschließen ist das Tagebuch weg, das Abzeichen nicht', async () => {
  await p.evaluate(() => tu.weSchliessen());
  const r = await p.evaluate(() => {
    const tg = state.we[0].tage[0];
    const c = ehrungen().chronik.find(x => x.tagId === 901);
    return {log:tg.orte.some(o => o.log), schlag:c.a.schlag.map(String), zahl:(ehrungen().zahlen['2'] || {}).schlag,
            fazit:fazitBlock(fazitVon(berechnen().log.find(x => x.we.id === 900)), false)};
  });
  if(r.log) throw new Error('Tagebuch noch da');
  if(!r.schlag.includes('2')) throw new Error('Chronik: ' + r.schlag.join());
  if(r.zahl !== 1) throw new Error('gezählt: ' + r.zahl);
  if(!/Schrittmacher/.test(r.fazit) || !/das dritte um \d\d:\d\d/.test(r.fazit)) throw new Error('Fazit');
  return 'Chronik, Zählung und Fazit';
});

console.log('\n== Abgleich ==');
await schritt('Zwei Handys, zwei Zeiten: Es gilt die frühere', async () => {
  const r = await p.evaluate(() => {
    const tag0 = s => ({id:2, schlag:s, orte:[]});
    const stand = s => ({spieler:[], einst:{}, we:[{id:1, dabei:[], tage:[tag0(s)]}]});
    const a = zusammenfuehren(stand(undefined), stand({'1':500}), stand({'1':400, '2':900}));
    const b2 = zusammenfuehren(stand({'1':500}), stand({'1':500}), stand({}));
    const c = zusammenfuehren(stand({'1':500}), stand({}), stand({'1':500}));
    return {a:a.we[0].tage[0].schlag, b:b2.we[0].tage[0].schlag || {}, c:c.we[0].tage[0].schlag || {}};
  });
  if(r.a['1'] !== 400 || r.a['2'] !== 900) throw new Error('beide gesetzt: ' + JSON.stringify(r.a));
  if(r.b['1'] !== undefined) throw new Error('drüben zurückgenommen, hier noch da');
  if(r.c['1'] !== undefined) throw new Error('hier zurückgenommen, kam wieder');
  return 'frühere gewinnt, Zurücknehmen trägt in beide Richtungen';
});

console.log('\n== Wo man es sieht ==');
await aufbau();
await schritt('Der Zwischenstand zeigt ihn unter „Stand jetzt“, mit Uhrzeit', async () => {
  await tipp(3); await spulen(5); await tipp(3); await spulen(5); await tipp(3);
  await p.evaluate(() => { let n = 0; while(offeneUrkunde() && n++ < 20) tu.urkundeWeg();
    tu.geheZwischen(); });
  const t = await p.evaluate(() => document.querySelector('.tagblock').textContent);
  if(!/Stand jetzt/.test(t) || !/SchrittmacherSperry/.test(t) || !/das dritte um \d\d:\d\d/.test(t))
    throw new Error(t.slice(-200));
});
await schritt('Vom Zwischenstand führt ein Knopf in die Ehrenhalle und zurück', async () => {
  const r = await p.evaluate(() => {
    const k = document.querySelector('#app [data-tu="geheRuhm"]');
    if(!k) return {k:false};
    k.click();
    const drin = modus(), kopf = document.getElementById('kopf').textContent;
    tu.zurueckNavi();
    return {k:true, drin, kopf, zurueck:modus()};
  });
  if(!r.k) throw new Error('kein Knopf');
  if(r.drin !== 'ruhm' || !/Ehrenhalle/.test(r.kopf)) throw new Error(r.drin + ' / ' + r.kopf);
  if(r.zurueck !== 'zwischen') throw new Error('zurück nach ' + r.zurueck);
});
await schritt('Die Ehrenhalle hat eine Spalte für ihn', async () => {
  const r = await p.evaluate(() => { tu.geheRuhm();
    return {kopf:document.querySelector('.abzkopf').textContent,
            sperry:[...document.querySelectorAll('.abzzeile')].map(z => z.textContent).find(z => z.startsWith('Sperry'))}; });
  if(!/Schrittmacher/.test(r.kopf)) throw new Error(r.kopf);
  /* Tagessieger ist er in dem Moment auch – niemand sonst hat etwas. */
  if(r.sperry !== 'Sperry1010') throw new Error(r.sperry);
  await p.evaluate(() => tu.zurueckNavi());
});
await schritt('Die Meldung zur Schlagzahl sagt dem Ersten, dass er Schrittmacher ist', async () => {
  const r = await p.evaluate(() => {
    const we = state.we[0];
    const m = we.marken.find(x => x.art === 'schlag');
    return {erste:urkundeAnweisung(we, m)};
  });
  if(!/Abzeichen Schrittmacher/.test(r.erste)) throw new Error('nicht erwähnt');
});
await schritt('Wer erst später so schnell ist, bekommt die Meldung ohne das Abzeichen', async () => {
  await spulen(10);
  await tipp(1); await spulen(5); await tipp(1); await spulen(5); await tipp(1);
  await spulen(3);
  const r = await p.evaluate(() => {
    const we = state.we[0];
    const m = we.marken.filter(x => x.art === 'schlag').find(x => x.pids.includes('1'));
    return m ? urkundeAnweisung(we, m) : null;
  });
  if(!r) throw new Error('keine Meldung für Korbi');
  if(/Abzeichen Schrittmacher/.test(r)) throw new Error('Korbi als Schrittmacher erwähnt');
});
await schritt('Die Morgenmeldung nennt den Schrittmacher des Vortags', async () => {
  await p.evaluate(() => { let n = 0; while(offeneUrkunde() && n++ < 20) tu.urkundeWeg(); });
  const r = await p.evaluate(() => {
    const we = state.we[0];
    morgenAnlegen(we, we.tage[0]);
    const m = we.marken.find(x => x.art === 'morgen');
    return {schlag:m.schlag, uhr:m.werte.schlag, text:urkundeAnweisung(we, m),
            html:ansichtUrkunde({m, we})};
  });
  if(r.schlag.join() !== '3') throw new Error('schlag: ' + r.schlag.join());
  if(!/Schrittmacher: Sperry/.test(r.text)) throw new Error('Anweisung');
  if(!/Schrittmacher/.test(r.html) || !r.html.includes('das dritte um ' + r.uhr)) throw new Error('Anzeige');
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
