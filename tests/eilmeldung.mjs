// Die Eilmeldungen aus G57: Bettzipfel, Rekord in Reichweite und gebrochen, Schlagzahl,
// Alkoholfrei-Alarm, Morgenmeldung, Siegerehrung, der neue Arschloch, das Sammelfenster
// und welche Meldung eine Nachricht verweben darf.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8962);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push(e.message));
p.on('console', m => { if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text())) fehler.push(m.text()); });
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
/* Die API wird gefälscht: Wir wollen wissen, was hinausgeht, nicht was zurückkommt. */
const anfragen = [];
await p.route('**/api.anthropic.com/**', r => {
  const body = JSON.parse(r.request().postData() || '{}');
  anfragen.push(body);
  const text = 'Ein Text von der API, lang genug für eine Meldung, mit Peter und gezappt.';
  r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({
    stop_reason:'end_turn',
    content:[{type:'text', text:JSON.stringify({kopf:'Kopf von der API', text, bezug:'Große Meldung'})}]})});
});
/* Die Uhr lässt sich vorstellen, ohne zwei Minuten zu warten. */
await p.addInitScript(() => {
  localStorage.setItem('bubidos-token', 'github_pat_test');
  const echt = Date.now.bind(Date);
  window.__versatz = 0;
  Date.now = () => echt() + window.__versatz;
});
await p.goto('http://localhost:8962/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};
const spulen = min => p.evaluate(m => { window.__versatz += m * 60000; zeichnen(); }, min);
const marken = art => p.evaluate(a => JSON.parse(JSON.stringify(
  (state.we.find(w => w.id === 900).marken || []).filter(m => m.art === a))), art);
const offen = () => p.evaluate(() => { const u = offeneUrkunde(); return u ? {art:u.m.art, id:u.m.id,
  html:ansichtUrkunde(u)} : null; });
const allesGesehen = () => p.evaluate(() => { let n = 0;
  while(offeneUrkunde() && n++ < 40) tu.urkundeWeg(); });

/* Vorher ein abgeschlossenes Wochenende: Korbi hat den Rekord mit 9,66 BE an einem Tag.
   Jetzt: fünf am Tisch, Korbi 5, Fifu 8, Sperry 7, Gerry 6, Kammy 6 – alles Halbe. */
const aufbau = (mitSchluessel) => p.evaluate(mit => {
  const h = n => Array(n).fill('normal:05');
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},
                   {id:4,name:'Gerry'},{id:5,name:'Kammy'}];
  state.einst = {k:40};
  if(mit) state.einst.kiSchluessel = 'sk-test';
  state.we = [
    {id:100, titel:'Früher', datum:'2025-05-01', zu:true, dabei:[1,2], tage:[
      {id:101, label:'1. Tag', orte:[{id:11, name:'A', getraenke:{'1':h(9).concat('normal:033'),'2':h(2)}}]}]},
    {id:900, titel:'Jetzt', datum:'2026-09-26', zu:false, dabei:[1,2,3,4,5], marken:[], tage:[
      {id:901, label:'1. Tag', orte:[{id:1, name:'Hofbräu',
        getraenke:{'1':h(5),'2':h(8),'3':h(7),'4':h(6),'5':h(6)}, log:[]}]}]}];
  state.aktivWe = 900; state.aktivTag = 901; state.aktivOrt = 1;
  state.wahlS = 'normal'; state.wahlG = '05';
  ansicht = null; blatt = null; benennen = false; nachfrage = null; letzteRunde = null;
  fazitOffen = null; heimBlatt = null;
  localStorage.removeItem('bubidos-urkunden');
  urkundeVorrat.clear();
  zeichnen();
}, mitSchluessel);
/* Ein Bier für jemanden, und die Uhr vier Minuten weiter – so fragt das + nicht nach. */
const bier = async (pid, key) => {
  await p.evaluate(({pid, key}) => {
    if(key){ const [s2, g] = key.split(':'); state.wahlS = s2; state.wahlG = g; }
    nachfrage = null; tu.strich({dataset:{id:String(pid)}});
    state.wahlS = 'normal'; state.wahlG = '05';
  }, {pid, key});
};

await aufbau(false);

console.log('\n== Rekord in Reichweite: sammeln, zwei Minuten, dann eine Meldung ==');
await schritt('Fifu kommt in Reichweite – aber noch geht nichts auf', async () => {
  await bier(2);    // Fifu 9 BE, Rekord 9,66
  const m = await marken('rekordnah');
  if(m.length !== 1) throw new Error(m.length + ' Meldungen');
  const o = await offen();
  if(o && o.art === 'rekordnah') throw new Error('ging sofort auf');
  return 'Rekord ' + m[0].rekord.toFixed(2);
});
await schritt('Sperry kommt eine Minute später dazu – dieselbe Meldung', async () => {
  await spulen(1);
  /* Sperry steht schon bei acht – ein zweites + binnen Sekunden fragte zu Recht nach. */
  await p.evaluate(() => { state.we[1].tage[0].orte[0].getraenke['3'] = Array(8).fill('normal:05'); });
  await bier(3);    // Sperry 9
  const m = await marken('rekordnah');
  if(m.length !== 1) throw new Error(m.length + ' Meldungen');
  if(m[0].pids.join() !== '2,3') throw new Error('pids ' + m[0].pids.join());
});
await schritt('Nach dem Fenster geht sie mit beiden Namen auf', async () => {
  await spulen(1.5);
  const o = await offen();
  if(!o || o.art !== 'rekordnah') throw new Error('offen: ' + (o && o.art));
  if(!/Fifu, Sperry/.test(o.html)) throw new Error('nicht beide Namen');
  if(!/Rekord in Reichweite/.test(o.html)) throw new Error('kein Band');
  await allesGesehen();
});
await schritt('Wer erst nach dem Fenster in Reichweite kommt, bekommt eine eigene', async () => {
  await bier(4); await spulen(4); await bier(4); await spulen(4); await bier(4);   // Gerry 9
  const m = await marken('rekordnah');
  if(m.length !== 2) throw new Error(m.length + ' Meldungen');
  await spulen(3); await allesGesehen();
});

console.log('\n== Rekord gebrochen ==');
await schritt('Gleichziehen reicht nicht – über 9,66 muss es gehen', async () => {
  await spulen(4); await bier(2);     // Fifu 10
  const m = await marken('rekord');
  if(m.length !== 1 || m[0].pids.join() !== '2') throw new Error(JSON.stringify(m.map(x => x.pids)));
});
await schritt('Die Urkunde geht nach dem Fenster auf, als Karte mit Formel', async () => {
  await spulen(2.2);
  let o = await offen();
  while(o && o.art !== 'rekord'){ await p.evaluate(() => tu.urkundeWeg()); o = await offen(); }
  if(!o) throw new Error('keine');
  for(const s of ['Bubidos Bierliga · Rekord', 'Hiermit wird festgestellt', 'Fifu', '10,0'])
    if(!o.html.includes(s)) throw new Error('fehlt: ' + s);
  await allesGesehen();
});
await schritt('Mit einer Maß über die Reichweite gesprungen: gleich der Rekord, keine Reichweite', async () => {
  await spulen(4); await bier(1, 'normal:10'); await spulen(4); await bier(1, 'normal:10');  // Korbi 5 → 9 BE (in Reichweite)
  const vorher = (await marken('rekordnah')).flatMap(m => m.pids);
  await p.evaluate(() => { state.we[1].tage[0].orte[0].getraenke['5'] = Array(8).fill('normal:05'); });
  await spulen(4); await bier(5, 'normal:10');  // Kammy 8 → 10
  const nah = (await marken('rekordnah')).flatMap(m => m.pids);
  const rek = (await marken('rekord')).flatMap(m => m.pids);
  if(nah.includes('5')) throw new Error('Kammy steht in der Reichweite');
  if(!rek.includes('5')) throw new Error('Kammy hat keinen Rekord');
  return 'Korbi in Reichweite: ' + vorher.includes('1');
});
await spulen(3); await allesGesehen();

console.log('\n== Bettzipfel ==');
await schritt('Der erste „Geht heim“ löst sofort eine Meldung aus', async () => {
  await p.evaluate(() => tu.heimJetzt({dataset:{tag:'901', id:'3'}}));
  const o = await offen();
  if(!o || o.art !== 'zipfel') throw new Error('offen: ' + (o && o.art));
  for(const s of ['Goldener Bettzipfel', 'Sperry', 'heim um', 'Beleg sichern', 'Gute Nacht'])
    if(!o.html.includes(s)) throw new Error('fehlt: ' + s);
  await allesGesehen();
});
await schritt('Wer zehn Minuten danach geht, löst keine zweite aus', async () => {
  await spulen(5);
  await p.evaluate(() => tu.heimJetzt({dataset:{tag:'901', id:'4'}}));
  const m = await marken('zipfel');
  if(m.length !== 1) throw new Error(m.length);
});
await schritt('„Doch noch da“ beim Ersten nimmt die Meldung zurück', async () => {
  await p.evaluate(() => { tu.heimWeg({dataset:{tag:'901', id:'3'}}); tu.heimWeg({dataset:{tag:'901', id:'4'}}); });
  const m = await marken('zipfel');
  if(m.length) throw new Error('noch da');
});

console.log('\n== Schlagzahl ==');
await aufbau(false);
await schritt('Drei Striche binnen einer halben Stunde', async () => {
  await bier(4); await spulen(5); await bier(4); await spulen(5); await bier(4);
  const m = await marken('schlag');
  if(m.length !== 1 || m[0].pids.join() !== '4') throw new Error(JSON.stringify(m.map(x => x.pids)));
});
await schritt('Über die Sammel-Eingabe nachgetragen zählt nicht', async () => {
  await p.evaluate(() => { tu.blattAuf({dataset:{id:'5'}});
    blatt.z['normal:05'] += 3; tu.blattSpeichern(); });
  const m = (await marken('schlag')).flatMap(x => x.pids);
  if(m.includes('5')) throw new Error('Kammy hat die Schlagzahl');
});
await schritt('Drei Runden für alle binnen einer halben Stunde: eine Meldung für den Tisch', async () => {
  await spulen(40);
  for(let i = 0; i < 3; i++){ await p.evaluate(() => { nachfrage = null; tu.runde(); }); await spulen(4); }
  const m = (await marken('schlag')).filter(x => x.pids.length > 1);
  if(m.length !== 1) throw new Error((await marken('schlag')).map(x => x.pids.join('+')).join(' | '));
  return m[0].pids.length + ' Namen';
});

console.log('\n== Alkoholfrei-Alarm ==');
await aufbau(false);
await schritt('Das erste Alkoholfreie des Abends', async () => {
  await bier(2, 'af:05');
  await spulen(2.2);
  const o = await offen();
  if(!o || o.art !== 'af') throw new Error('offen: ' + (o && o.art));
  if(!/Alkoholfrei-Alarm/.test(o.html) || !/Fifu/.test(o.html)) throw new Error('Inhalt');
  await allesGesehen();
});
await schritt('Das zweite am selben Abend meldet nichts mehr', async () => {
  await spulen(10); await bier(3, 'af:05');
  const m = await marken('af');
  if(m.length !== 1 || m[0].pids.join() !== '2') throw new Error(JSON.stringify(m.map(x => x.pids)));
});

console.log('\n== Führungswechsel mit Fenster ==');
await aufbau(false);
await schritt('Überholt und zehn Sekunden später wieder eingeholt: kein Wechsel', async () => {
  await p.evaluate(() => { markenPruefen(); });                 // Fifu vorn, Merker gesetzt
  await bier(3); await spulen(4); await bier(3);                // Sperry 9 = Fifu? Sperry 7→9, Fifu 8
  let m = await marken('fuehrung');
  if(m.length !== 1 || m[0].pid !== '3') throw new Error('kein offener Wechsel: ' + JSON.stringify(m));
  await spulen(0.2); await bier(2); await spulen(0.1); await bier(2);   // Fifu 10
  m = await marken('fuehrung');
  if(m.length) throw new Error('bleibt: ' + JSON.stringify(m.map(x => x.pid)));
  return 'und auch kein neuer für Fifu';
});
await schritt('Hält die Führung zwei Minuten, geht die Urkunde auf', async () => {
  await spulen(4); await bier(3); await spulen(4); await bier(3);       // Sperry 11
  await spulen(2.2);
  let o = await offen();
  while(o && o.art !== 'fuehrung'){ await p.evaluate(() => tu.urkundeWeg()); o = await offen(); }
  if(!o) throw new Error('keine');
  if(!/Sperry/.test(o.html)) throw new Error('falscher Name');
});

console.log('\n== Arschloch: acht gleiche hintereinander, und zwei andere haben gewechselt ==');
await aufbau(false);
await schritt('Trinken alle nur Halbe, fällt er nie', async () => {
  await p.evaluate(() => { state.we[1].tage[0].orte[0].getraenke['1'] = Array(10).fill('normal:05'); markenPruefen(); });
  const m = await marken('sorte');
  if(m.length) throw new Error(m.length + ' vergeben');
});
await schritt('Haben zwei andere zwischendurch etwas anderes, fällt er', async () => {
  await p.evaluate(() => { const g = state.we[1].tage[0].orte[0].getraenke;
    g['2'].push('normal:033'); g['3'].push('stark:05'); markenPruefen(); });
  const m = await marken('sorte');
  if(m.length !== 1 || m[0].pid !== '1') throw new Error(JSON.stringify(m.map(x => x.pid)));
});
await schritt('Ein anderes Getränk vorneweg stört nicht – es zählen acht hintereinander', async () => {
  const k = await p.evaluate(() => { const w = state.we[1];
    w.tage[0].orte[0].getraenke['4'] = ['stark:05', 'leicht:05'].concat(Array(8).fill('normal:05'));
    return sorteTreu(w, '4'); });
  if(k !== 'normal:05') throw new Error(String(k));
});
await schritt('Einer allein, der wechselt, reicht nicht', async () => {
  const k = await p.evaluate(() => {
    const w = {tage:[{orte:[{getraenke:{'1':Array(8).fill('normal:05'), '2':['normal:033'],
      '3':Array(3).fill('normal:05')}}]}]};
    return sorteTreu(w, '1'); });
  if(k) throw new Error(k);
});

console.log('\n== Mit Nachricht oder ohne ==');
await aufbau(true);
await schritt('Die großen verweben eine Nachricht, die kleinen nicht', async () => {
  const r = await p.evaluate(() => {
    const we = state.we[1];
    const mit = a => urkundeAnweisung(we, Object.assign({id:'x', art:a, stufe:18, pid:'2', pids:['2'],
      tagId:901, rekord:9, uhr:'22:00', sieger:['2'], fahrer:['1'], zipfel:[], werte:{},
      krone:{wer:['2'], von:[]}, be:10}, {})).includes('echte Nachricht');
    const arten = ['stufe','rekord','morgen','ehrung','zipfel','af','schlag','rekordnah','mangel','fuehrung','sorte','runde'];
    return Object.fromEntries(arten.map(a => [a, mit(a)]));
  });
  const soll = {stufe:true, rekord:true, morgen:true, ehrung:true};
  const falsch = Object.keys(r).filter(a => r[a] !== !!soll[a]);
  if(falsch.length) throw new Error(falsch.map(a => a + ':' + r[a]).join(' '));
  return 'vier mit, acht ohne';
});
await schritt('Ohne Nachricht geht der Aufruf ohne Suche hinaus', async () => {
  anfragen.length = 0;
  await p.evaluate(() => tu.heimJetzt({dataset:{tag:'901', id:'5'}}));
  await p.waitForTimeout(400);
  const a = anfragen.find(x => (x.messages[0].content || '').includes('Goldenen Bettzipfel'));
  if(!a) throw new Error('kein Aufruf');
  if(a.tools) throw new Error('mit Suche');
  const m = (await marken('zipfel'))[0];
  if(m.quelle !== 'ki' || m.kopf !== 'Kopf von der API') throw new Error(m.quelle + ' / ' + m.kopf);
  return 'Text und Kopf von der API';
});
await schritt('Mit Nachricht geht er mit genau einer Suche hinaus', async () => {
  anfragen.length = 0;
  await p.evaluate(() => { const g = state.we[1].tage[0].orte[0].getraenke;
    g['2'] = Array(17).fill('normal:05'); markenPruefen(); });
  await p.waitForTimeout(400);
  const a = anfragen.find(x => (x.messages[0].content || '').includes('Marke von 18'));
  if(!a) throw new Error('kein Aufruf');
  if(!a.tools || a.tools[0].max_uses !== 1) throw new Error(JSON.stringify(a.tools));
});
await schritt('Schon verwendete Nachrichten stehen in der Anweisung als ausgeschlossen', async () => {
  const t = await p.evaluate(() => {
    const we = state.we[1];
    we.marken.push({id:'alt', art:'stufe', stufe:18, pid:'3', bezug:'Die Kanzlerwahl'});
    return urkundeAnweisung(we, {id:'neu', art:'stufe', stufe:25, pid:'2', be:25});
  });
  if(!/schon verwendet[^\n]*Die Kanzlerwahl/.test(t)) throw new Error('nicht ausgeschlossen');
});
await schritt('Die Meldung an die Runde kommt jetzt von der API, ohne Suche', async () => {
  anfragen.length = 0;
  await p.evaluate(() => { const g = state.we[1].tage[0].orte[0].getraenke;
    ['1','3','4','5'].forEach(id => g[id] = Array(9).fill('normal:05')); markenPruefen(); });
  await p.waitForTimeout(400);
  const a = anfragen.find(x => (x.messages[0].content || '').includes('ganze Runde'));
  if(!a) throw new Error('kein Aufruf');
  if(a.tools) throw new Error('mit Suche');
  const m = (await marken('runde'))[0];
  if(!m || m.quelle !== 'ki') throw new Error(m && m.quelle);
});

console.log('\n== Morgenmeldung ==');
await aufbau(false);
await schritt('„+ Tag“ bringt die Bilanz von gestern: Sieger, Fahrer, Bettzipfel', async () => {
  await p.evaluate(() => { state.we[1].tage[0].heim = {'4': Date.now()}; markenPruefen(); });
  await allesGesehen();
  await p.evaluate(() => { tu.tagNeu(); tu.benennenFertig(); });
  const m = await marken('morgen');
  if(m.length !== 1) throw new Error(m.length);
  if(m[0].sieger.join() !== '2' || m[0].fahrer.join() !== '1') throw new Error(JSON.stringify(m[0]));
  const o = await offen();
  if(!o || o.art !== 'morgen') throw new Error('offen: ' + (o && o.art));
  for(const s of ['Morgenmeldung', 'Tagessieger', 'Fifu', 'Fahrer des Abends', 'Korbi', 'Goldener Bettzipfel', 'Gerry'])
    if(!o.html.includes(s)) throw new Error('fehlt: ' + s);
  await allesGesehen();
});

console.log('\n== Siegerehrung ==');
await schritt('Beim Abschließen entsteht sie und wartet, bis das Fazit weg ist', async () => {
  await p.evaluate(() => tu.weSchliessen());
  const m = await p.evaluate(() => JSON.parse(JSON.stringify(state.we[1].marken.filter(x => x.art === 'ehrung'))));
  if(m.length !== 1) throw new Error(m.length);
  if(!m[0].text) throw new Error('ohne Text');
  const fazitDa = await p.$('.blende .fazit');
  if(!fazitDa) throw new Error('kein Fazit');
  await p.evaluate(() => tu.fazitZu());
  const o = await offen();
  if(!o || o.art !== 'ehrung') throw new Error('offen: ' + (o && o.art));
  for(const s of ['Siegerehrung', 'Deckelkrone', 'Fifu', 'Hiermit wird feierlich überreicht', 'Glückwunsch'])
    if(!o.html.includes(s)) throw new Error('fehlt: ' + s);
});
await schritt('Die anderen Meldungen verlieren ihren Text, die Siegerehrung nicht', async () => {
  const r = await p.evaluate(() => state.we[1].marken.map(m => m.art + ':' + (m.text ? 'Text' : '–')));
  if(!r.includes('ehrung:Text')) throw new Error(r.join(' '));
  if(r.some(x => x !== 'ehrung:Text' && x.endsWith('Text'))) throw new Error(r.join(' '));
});
await schritt('Auch nach einem Abgleich bleibt ihr Text', async () => {
  const t = await p.evaluate(() => {
    const d = JSON.parse(JSON.stringify(standDaten()));
    const r = zusammenfuehren(d, JSON.parse(JSON.stringify(d)), JSON.parse(JSON.stringify(d)));
    return r.we.find(w => w.id === 900).marken.find(m => m.art === 'ehrung').text;
  });
  if(!t) throw new Error('weg');
});
await schritt('Nach einer Woche ist sie vorbei', async () => {
  await spulen(8 * 24 * 60);
  const o = await offen();
  if(o && o.art === 'ehrung') throw new Error('noch offen');
  const t = await p.evaluate(() => { migrieren(state.we);
    return state.we[1].marken.find(m => m.art === 'ehrung').text; });
  if(t) throw new Error('Text noch da');
});

/* Der Fall, der beim Bauen durchgerutscht wäre: Die Siegerehrung eines Wochenendes, an
   dem jemand den Rekord gebrochen hat. Der Rekord steht dort als Objekt, der Ersatztext
   rechnete ihn als Zahl – und das Anlegen brach ab. */
await schritt('Siegerehrung eines Wochenendes mit neuem Rekord', async () => {
  await aufbau(false);
  await p.evaluate(() => { state.we[1].tage[0].orte[0].getraenke['2'] = Array(11).fill('normal:05');
    markenPruefen(); });
  await allesGesehen();
  await p.evaluate(() => { tu.weSchliessen(); tu.fazitZu(); });
  const o = await offen();
  if(!o || o.art !== 'ehrung') throw new Error('offen: ' + (o && o.art));
  if(!/Rekordhalter/.test(o.html) || !/11,00 BE an einem Tag/.test(o.html))
    throw new Error('der Rekord fehlt');
  return 'Krone und Rekord auf einem Blatt';
});

console.log('\n== Abgleich ==');
await schritt('Eine Sammelmeldung, auf zwei Handys verschieden gefüllt, kommt zusammen', async () => {
  const r = await p.evaluate(() => markenVereinen(
    [{id:'a', art:'schlag', t:5, pids:['1']}], [{id:'a', art:'schlag', t:5, pids:['1','2']}]));
  if(r[0].pids.join() !== '1,2') throw new Error(r[0].pids.join());
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
