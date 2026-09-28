// „Geht heim“: eintragen, berichtigen, zurücknehmen – und was es am Tisch bewirkt:
// keine Runde mehr, kein „Wer geht mit?“, eine Rückfrage beim +, und beim Zurückbleiben
// an „+ Location“ zieht die Gruppe weiter, statt sich aufzuteilen.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8961);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8961/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufbau = () => p.evaluate(() => {
  const h = n => Array(n).fill('normal:05');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},{id:4,name:'Kammy'}];
  state.einst = {k:40};
  const jetzt = Date.now();
  state.we = [{id:900, titel:'Berlin', datum:'2026-09-26', zu:false, dabei:[1,2,3,4], tage:[
    {id:901, label:'1. Tag', orte:[{id:1, name:'Hofbräu',
      getraenke:{'1':h(3),'2':h(3),'3':h(3),'4':h(2)},
      log:[{t:jetzt - 3*3600000, gid:null, art:'runde', key:'normal:05', n:4, ids:['1','2','3','4']}]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  ansicht = null; blatt = null; benennen = false; heimBlatt = null; nachfrage = null;
  letzteRunde = null; pinLoeschen(); zeichnen();
});
const tag = () => p.evaluate(() => JSON.parse(JSON.stringify(state.we[0].tage[0])));
const klick = sel => p.click(sel);

await aufbau();

console.log('\n== Eintragen über den Namen ==');
await schritt('Im Blatt einer Person steht „Geht heim“', async () => {
  await klick('button.pname[data-id="4"]');
  const da = await p.$('.blende [data-tu="heimJetzt"]');
  if(!da) throw new Error('kein Knopf');
});
await schritt('Ein Tipp hält die Uhrzeit fest und schließt das Blatt', async () => {
  const vor = Date.now();
  await klick('.blende [data-tu="heimJetzt"]');
  const t = await tag();
  if(!t.heim || !(t.heim['4'] >= vor - 1000)) throw new Error(JSON.stringify(t.heim));
  if(await p.$('.blende')) throw new Error('Blatt noch offen');
});
await schritt('Am Zählbildschirm wird die Zeile grau und zeigt die Uhrzeit', async () => {
  const z = await p.evaluate(() => {
    const r = document.querySelector('button.pname[data-id="4"]').closest('.pzeile');
    return {grau:r.classList.contains('heim'), text:r.textContent};
  });
  if(!z.grau) throw new Error('nicht grau');
  if(!/heim · \d\d:\d\d/.test(z.text)) throw new Error(z.text);
});

console.log('\n== Was es am Tisch bewirkt ==');
await schritt('„Runde für alle“ zählt ihn nicht mit und gibt ihm nichts', async () => {
  const knopf = await p.evaluate(() => document.querySelector('.rundeknopf').textContent);
  if(!/3×/.test(knopf)) throw new Error(knopf);
  await klick('.rundeknopf');
  const t = await tag();
  const g = t.orte[0].getraenke;
  if(g['4'].length !== 2) throw new Error('Kammy hat ' + g['4'].length);
  if(g['1'].length !== 4) throw new Error('Korbi hat ' + g['1'].length);
  return 'drei Biere, Kammy bleibt bei zwei';
});
await schritt('Das + bei ihm fragt erst nach und trägt nichts ein', async () => {
  await klick('button.plus[data-id="4"]');
  const t = await tag();
  if(t.orte[0].getraenke['4'].length !== 2) throw new Error('eingetragen');
  const txt = await p.evaluate(() => document.querySelector('button.pname[data-id="4"]').closest('.pzeile').textContent);
  if(!/Ist heim – nochmal tippen/.test(txt)) throw new Error(txt);
});
await schritt('Der zweite Tipp trägt ein, und er ist wieder da', async () => {
  await klick('button.plus[data-id="4"]');
  const t = await tag();
  if(t.orte[0].getraenke['4'].length !== 3) throw new Error('nicht eingetragen');
  if(t.heim && t.heim['4'] !== undefined) throw new Error('noch heim');
});

console.log('\n== Berichtigen und zurücknehmen ==');
await schritt('Die Uhrzeit lässt sich ändern – 01:30 ist die Nacht danach', async () => {
  await klick('button.pname[data-id="4"]');
  await klick('.blende [data-tu="heimJetzt"]');
  await klick('button.pname[data-id="4"]');
  await p.fill('#heimZeit', '01:30');
  await klick('.blende [data-tu="heimSetzen"]');
  const r = await p.evaluate(() => {
    const t = state.we[0].tage[0];
    const basis = t.orte[0].log[0].t;
    const d = new Date(t.heim['4']);
    return {h:d.getHours(), m:d.getMinutes(), nach:t.heim['4'] > basis,
            abstand:(t.heim['4'] - basis) / 3600000};
  });
  if(r.h !== 1 || r.m !== 30) throw new Error(r.h + ':' + r.m);
  if(!r.nach) throw new Error('liegt vor dem Abend');
  if(r.abstand > 24) throw new Error(r.abstand.toFixed(1) + ' h nach dem ersten Eintrag');
  return 'nach dem ersten Eintrag des Abends, nicht einen Tag davor';
});
await schritt('Eine Uhrzeit am Abend bleibt am selben Tag', async () => {
  await p.fill('#heimZeit', '23:10');
  await klick('.blende [data-tu="heimSetzen"]');
  const r = await p.evaluate(() => {
    const t = state.we[0].tage[0];
    const d = new Date(t.heim['4']), b = new Date(t.orte[0].log[0].t);
    return {h:d.getHours(), tagGleich: d.toDateString() === b.toDateString() ||
      (b.getHours() >= 20 && d.getTime() - b.getTime() < 24*3600000)};
  });
  if(r.h !== 23 || !r.tagGleich) throw new Error(JSON.stringify(r));
});
await schritt('„Doch noch da“ nimmt es zurück', async () => {
  await klick('.blende [data-tu="heimWeg"]');
  const t = await tag();
  if(t.heim && t.heim['4'] !== undefined) throw new Error('noch heim');
  await klick('.blende [data-tu="blattZu"]');
});

console.log('\n== + Location ==');
await schritt('Wer heim ist, wird bei „Wer geht mit?“ nicht angeboten', async () => {
  await p.evaluate(() => { state.we[0].tage[0].heim = {'4':Date.now()}; zeichnen(); tu.ortNeu(); });
  const wer = await p.evaluate(() => benennen.wer.map(String));
  if(wer.includes('4')) throw new Error(wer.join(','));
  await p.evaluate(() => tu.benennenAb());
});
await schritt('Bleibt genau einer zurück, fragt das Blatt, ob er heimgeht', async () => {
  await p.evaluate(() => { state.we[0].tage[0].heim = {}; zeichnen(); tu.ortNeu(); });
  await klick('.blende [data-tu="mitAn"][data-id="3"]');
  const t = await p.evaluate(() => document.querySelector('.blende').textContent);
  if(!/Sperry geht heim/.test(t)) throw new Error('keine Frage');
  if(!/Passt, wir teilen uns auf/.test(t)) throw new Error('ohne Kreuz sollte es eine Aufteilung sein');
});
await schritt('Ohne Kreuz bleibt es eine Aufteilung: Die Gruppe bleibt stehen', async () => {
  const r = await p.evaluate(() => {
    const merk = JSON.stringify(state.we);
    tu.benennenFertig();
    const aus = {gruppe:state.aktivOrt, pin:!!pinGueltig(state.we[0]), heim:state.we[0].tage[0].heim};
    state.we = JSON.parse(merk); state.aktivOrt = 1; pinLoeschen(); zeichnen();
    return aus;
  });
  if(r.gruppe !== 1) throw new Error('Gruppe zog weiter');
  if(!r.pin) throw new Error('kein Pin');
  if(r.heim && r.heim['3']) throw new Error('heim eingetragen');
});
await schritt('Mit Kreuz geht er heim, und die Gruppe zieht geschlossen weiter', async () => {
  await p.evaluate(() => tu.ortNeu());
  await klick('.blende [data-tu="mitAn"][data-id="3"]');
  await klick('.blende [data-tu="benennenHeim"]');
  const knopf = await p.evaluate(() => document.querySelector('.blende [data-tu="benennenFertig"]').textContent);
  if(knopf !== 'Passt') throw new Error('Knopf: ' + knopf);
  await klick('.blende [data-tu="benennenFertig"]');
  const r = await p.evaluate(() => ({gruppe:state.aktivOrt, orte:state.we[0].tage[0].orte.length,
    pin:!!pinGueltig(state.we[0]), heim:state.we[0].tage[0].heim}));
  if(r.orte !== 2) throw new Error(r.orte + ' Stationen');
  if(r.gruppe === 1) throw new Error('Gruppe blieb stehen');
  if(r.pin) throw new Error('Pin gesetzt – das ist keine Aufteilung');
  if(!r.heim || !r.heim['3']) throw new Error('nicht heim');
  return 'Sperry heim, die anderen an Station 2';
});

console.log('\n== Nachtragen im Zwischenstand ==');
await schritt('Jeder Name hat dort seinen Heim-Knopf, auch wer zurückgeblieben ist', async () => {
  await p.evaluate(() => tu.geheZwischen());
  const chips = await p.evaluate(() => [...document.querySelectorAll('.heimchip')].map(c => c.dataset.id + ':' + c.textContent));
  if(!chips.some(c => /^3:heim \d\d:\d\d$/.test(c))) throw new Error(chips.join(' '));
  if(!chips.some(c => c === '4:heim?')) throw new Error(chips.join(' '));
});
await schritt('Das Blatt bleibt offen, wenn man ins Uhrzeitfeld tippt', async () => {
  await klick('.heimchip[data-id="3"]');
  await klick('#heimZeit');
  if(!await p.$('.blende #heimZeit')) throw new Error('Blatt zu');
  await klick('.blende [data-tu="heimZu"]');
  if(await p.$('.blende')) throw new Error('Blatt nicht zu');
});
await schritt('Der Bettzipfel steht dort als „Stand jetzt“', async () => {
  const t = await p.evaluate(() => document.querySelector('.tagblock').textContent);
  if(!/Stand jetzt/.test(t) || !/Goldener BettzipfelSperry/.test(t)) throw new Error(t.slice(-200));
});

console.log('\n== Abgleich ==');
await schritt('Heim-Zeiten von zwei Handys kommen zusammen', async () => {
  const r = await p.evaluate(() => {
    const basis = {spieler:[], einst:{}, we:[{id:1, dabei:[], tage:[{id:2, heim:{'9':5}, orte:[]}]}]};
    const meins = JSON.parse(JSON.stringify(basis)); meins.we[0].tage[0].heim = {'9':5, '1':100};
    const fremd = JSON.parse(JSON.stringify(basis)); fremd.we[0].tage[0].heim = {'2':200};
    return zusammenfuehren(basis, meins, fremd).we[0].tage[0].heim;
  });
  if(r['1'] !== 100 || r['2'] !== 200) throw new Error(JSON.stringify(r));
  if(r['9'] !== undefined) throw new Error('drüben zurückgenommenes „heim“ kam zurück');
  return 'beide da, das drüben zurückgenommene weg';
});
await schritt('Eine hier geänderte Uhrzeit gewinnt gegen die unveränderte von drüben', async () => {
  const r = await p.evaluate(() => {
    const basis = {spieler:[], einst:{}, we:[{id:1, dabei:[], tage:[{id:2, heim:{'1':100}, orte:[]}]}]};
    const meins = JSON.parse(JSON.stringify(basis)); meins.we[0].tage[0].heim = {'1':150};
    const fremd = JSON.parse(JSON.stringify(basis));
    return zusammenfuehren(basis, meins, fremd).we[0].tage[0].heim;
  });
  if(r['1'] !== 150) throw new Error(JSON.stringify(r));
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
