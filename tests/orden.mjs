// Stimmen die Orden im Fazit mit dem überein, was die Erklärung und § 6 behaupten?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8951);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8951/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

/* Ein Wochenende, das absichtlich alle fünf Orden auslöst:
   Tag 1: Korbi+Fifu in zwei Locations. Tag 2: Sperry stößt dazu.
   Korbi trinkt am meisten und ist überall dabei, Fifu gleichmäßig,
   Sperry kommt spät und liefert. */
const halbe = n => Array(n).fill('normal:05');
const aufbau = () => p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.einst = {k:40};
  state.we = [
    {id:800, titel:'Vorher', datum:'2026-08-01', zu:true, dabei:[1,2,3],
     tage:[{id:801, label:'1. Tag', orte:[{id:11, name:'L0', getraenke:{
       '1':Array(5).fill('normal:05'), '2':Array(3).fill('normal:05'),
       '3':Array(1).fill('normal:05')}}]}]},
    {id:900, titel:'Jetzt', datum:'2026-09-09', zu:false, dabei:[1,2,3], tage:[
      {id:901, label:'1. Tag', orte:[
        {id:1, name:'A', getraenke:{'1':Array(1).fill('normal:05'), '2':Array(1).fill('normal:05')}},
        {id:2, name:'B', getraenke:{'1':Array(1).fill('normal:05'), '2':Array(1).fill('normal:05')}}]},
      {id:902, label:'2. Tag', orte:[
        {id:3, name:'C', getraenke:{'1':Array(3).fill('normal:05'), '2':Array(2).fill('normal:05'),
                                    '3':Array(3).fill('normal:05')}},
        {id:4, name:'D', getraenke:{'1':Array(3).fill('normal:05'),
                                    '3':Array(3).fill('normal:05')}}]}]}];
  state.aktivWe = null;
  const r = berechnen();
  const e = r.log.find(x => x.we.id === 900);
  const f = fazitVon(e);
  return {
    orden: f.orden.map(o => ({t:o.t, w:o.w, v:o.v})),
    leute: f.leute.map(l => ({name:l.name, be:l.be, tage:l.tage, orte:l.orte,
      schnitt:+l.schnitt.toFixed(2), streuung:l.streuung === null ? null : +l.streuung.toFixed(2),
      delta:+l.delta.toFixed(2)}))
  };
});

const d = await aufbau();

console.log('\n══ Wer steht wie da ══');
d.leute.forEach(l => console.log('  ' + l.name.padEnd(7) + ' BE ' + l.be.toFixed(2)
  + ' · ' + l.tage + ' Tage · ' + l.orte + ' Locations · Ø ' + l.schnitt
  + ' · Streuung ' + l.streuung + ' · Δ ' + l.delta));

console.log('\n══ Die Orden im Fazit ══');
d.orden.forEach(o => console.log('  ' + o.t.padEnd(13) + ' ' + o.w.padEnd(16) + ' ' + o.v));

await schritt('Alle fünf Orden werden tatsächlich vergeben', async () => {
  const soll = ['Deckelkönig','Schlagzahl','Aufsteiger','Gleichmaß','Durchhalter'];
  const ist = d.orden.map(o => o.t);
  const fehlt = soll.filter(s => !ist.includes(s));
  if(fehlt.length) throw new Error('nicht vergeben: ' + fehlt.join(', '));
  return ist.length + ' Orden';
});

await schritt('Die Reihenfolge im Fazit ist die des Katalogs', async () => {
  const soll = ['Deckelkönig','Schlagzahl','Aufsteiger','Gleichmaß','Durchhalter'];
  const ist = d.orden.map(o => o.t);
  const gefiltert = soll.filter(s => ist.includes(s));
  if(JSON.stringify(ist) !== JSON.stringify(gefiltert))
    throw new Error(ist.join(' → '));
  return ist.join(' → ');
});

console.log('\n══ Deckt die Erklärung ab, was das Fazit vergibt? ══');
const texte = await p.evaluate(() => ({
  blatt: ERKLAERUNGEN.orden.titel + ' :: ' + ERKLAERUNGEN.orden.text.join(' '),
  titel: ERKLAERUNGEN.orden.titel,
  info: ansichtInfo()
}));

await schritt('Jeder vergebene Orden steht im Erklär-Blatt', async () => {
  const fehlt = d.orden.map(o => o.t).filter(t => !texte.blatt.includes(t));
  if(fehlt.length) throw new Error('fehlt im Blatt: ' + fehlt.join(', '));
  return 'alle ' + d.orden.length;
});

await schritt('Jeder vergebene Orden steht in § 6', async () => {
  const fehlt = d.orden.map(o => o.t).filter(t => !texte.info.includes(t));
  if(fehlt.length) throw new Error('fehlt in § 6: ' + fehlt.join(', '));
  return 'alle ' + d.orden.length;
});

await schritt('Der Titel des Blattes nennt die richtige Zahl', async () => {
  const woerter = {4:'vier', 5:'fünf', 6:'sechs'};
  const n = 5;   // der Katalog, nicht die an diesem Wochenende vergebenen
  if(!texte.titel.includes(woerter[n]))
    throw new Error('Titel sagt "' + texte.titel + '", der Katalog hat aber ' + n);
  return texte.titel;
});

await schritt('Blatt und § 6 führen dieselben Orden', async () => {
  const alle = ['Deckelkönig','Schlagzahl','Aufsteiger','Gleichmaß','Durchhalter'];
  const imBlatt = alle.filter(t => texte.blatt.includes(t));
  const imPara  = alle.filter(t => texte.info.includes(t));
  if(JSON.stringify(imBlatt) !== JSON.stringify(imPara))
    throw new Error('Blatt: ' + imBlatt.join(',') + ' | § 6: ' + imPara.join(','));
  return imBlatt.length + ' in beiden';
});

console.log('\n══ Begründet der Wert jeweils den Orden? ══');
await schritt('Gleichmaß weist die Schwankung aus, nicht den Schnitt', async () => {
  const g = d.orden.find(o => o.t === 'Gleichmaß');
  const s = d.orden.find(o => o.t === 'Schlagzahl');
  if(!g) throw new Error('kein Gleichmaß vergeben');
  if(s && g.v.replace(/[\d,]/g,'') === s.v.replace(/[\d,]/g,''))
    throw new Error('Gleichmaß zeigt "' + g.v + '", genau wie Schlagzahl "' + s.v
      + '" – der Wert begründet den Orden nicht');
  return g.v;
});

console.log('');
await b.close(); srv.close();
