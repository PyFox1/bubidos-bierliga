import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8912);

const grund = {
  spieler: [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}],
  we: [{id:900, titel:'Berlin', datum:'2026-09-11', zu:false, dabei:[1,2,3],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:902, name:'Alte Bar', getraenke:{'1':['normal:05'],'2':[],'3':[]}, log:[]}]}]}],
  aktivWe:900, aktivTag:901, aktivOrt:902, einst:{k:40}, geraete:{}, stand:1000
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
await p.route('**/api.github.com/**', r => {
  if(!r.request().url().includes('/contents/stand.json'))
    return r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify([{path:'stand.json', sha:'abc', type:'file'}])});
  r.fulfill({status:200, contentType:'application/json',
    body: JSON.stringify({sha:'abc', content: Buffer.from(JSON.stringify(grund)).toString('base64')})});
});
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8912/');
await p.waitForTimeout(800);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

// Führt basis/meins/fremd zusammen und gibt die Getränke der Alten Bar zurück
const fuehre = (bau) => p.evaluate((quelle) => {
  const kopie = () => JSON.parse(JSON.stringify(quelle.grund));
  const basis = kopie(), meins = kopie(), fremd = kopie();
  new Function('basis','meins','fremd', quelle.bau)(basis, meins, fremd);
  const r = zusammenfuehren(basis, meins, fremd);
  const o = r.we[0].tage[0].orte;
  return {getraenke: o[0].getraenke, orte: o.map(x => x.name), log: (o[0].log||[]).length,
          spieler: r.spieler.map(s => s.name), dabei: r.we[0].dabei, ganz: r};
}, {grund, bau});

console.log('\n== Strichlisten ==');
await schritt('Beide tragen ein Bier ein – beide bleiben stehen', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte[0].getraenke['2'].push('normal:05');
    fremd.we[0].tage[0].orte[0].getraenke['3'].push('stark:05');`);
  if(r.getraenke['2'].length !== 1) throw new Error('Fifu: ' + JSON.stringify(r.getraenke['2']));
  if(r.getraenke['3'].length !== 1) throw new Error('Sperry: ' + JSON.stringify(r.getraenke['3']));
  return 'Fifu 1, Sperry 1';
});

await schritt('Beide tragen für dieselbe Person ein – es wird addiert, nicht überschrieben', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte[0].getraenke['2'].push('normal:05','normal:05');
    fremd.we[0].tage[0].orte[0].getraenke['2'].push('stark:05');`);
  const g = r.getraenke['2'];
  if(g.length !== 3) throw new Error(JSON.stringify(g));
  if(g.filter(x => x === 'normal:05').length !== 2) throw new Error(JSON.stringify(g));
  if(g.filter(x => x === 'stark:05').length !== 1) throw new Error(JSON.stringify(g));
  return g.join(' + ');
});

await schritt('Unverändertes verdoppelt sich nicht', async () => {
  const r = await fuehre(`/* niemand ändert etwas */`);
  if(r.getraenke['1'].length !== 1) throw new Error('Korbi: ' + JSON.stringify(r.getraenke['1']));
  return 'Korbi bleibt bei 1';
});

await schritt('Nur einer trägt ein – kein Doppel durch die Basis', async () => {
  const r = await fuehre(`meins.we[0].tage[0].orte[0].getraenke['1'].push('normal:05');`);
  if(r.getraenke['1'].length !== 2) throw new Error(JSON.stringify(r.getraenke['1']));
  return '1 + 1 = 2';
});

await schritt('Ein Zurücknehmen bleibt zurückgenommen', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte[0].getraenke['1'] = [];
    fremd.we[0].tage[0].orte[0].getraenke['2'].push('normal:05');`);
  if(r.getraenke['1'].length !== 0) throw new Error('Korbi: ' + JSON.stringify(r.getraenke['1']));
  if(r.getraenke['2'].length !== 1) throw new Error('Fifu: ' + JSON.stringify(r.getraenke['2']));
  return 'Korbi 0, Fifu 1';
});

await schritt('Drüben zurückgenommen, hier nichts angefasst', async () => {
  const r = await fuehre(`fremd.we[0].tage[0].orte[0].getraenke['1'] = [];`);
  if(r.getraenke['1'].length !== 0) throw new Error(JSON.stringify(r.getraenke['1']));
  return 'auch von drüben respektiert';
});

console.log('\n== Struktur ==');
await schritt('Zwei gleichzeitig aufgemachte Locations bleiben beide', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte.push({id:910, name:'Neubau', getraenke:{'1':['normal:05']}, log:[]});
    fremd.we[0].tage[0].orte.push({id:911, name:'Dritte', getraenke:{'3':['normal:05']}, log:[]});`);
  if(r.orte.join(',') !== 'Alte Bar,Neubau,Dritte') throw new Error(r.orte.join(', '));
  return r.orte.join(' · ');
});

await schritt('Ein drüben angelegter Spieler kommt mit', async () => {
  const r = await fuehre(`fremd.spieler.push({id:4, name:'Gerry'}); fremd.we[0].dabei.push(4);`);
  if(!r.spieler.includes('Gerry')) throw new Error(r.spieler.join(', '));
  if(!r.dabei.includes(4)) throw new Error('dabei: ' + JSON.stringify(r.dabei));
  return r.spieler.join(', ');
});

await schritt('Ein hier gelöschter Spieler kommt nicht zurück', async () => {
  const r = await fuehre(`
    meins.spieler = meins.spieler.filter(s => s.id !== 3);
    delete meins.we[0].tage[0].orte[0].getraenke['3'];`);
  if(r.spieler.includes('Sperry')) throw new Error('Sperry ist wieder da: ' + r.spieler.join(', '));
  if('3' in r.getraenke) throw new Error('Sperry steht wieder an der Location');
  return r.spieler.join(', ');
});

await schritt('„War hier nicht dabei“ bleibt entfernt', async () => {
  const r = await fuehre(`delete meins.we[0].tage[0].orte[0].getraenke['2'];`);
  if('2' in r.getraenke) throw new Error('Fifu wurde wieder eingetragen');
  return 'Fifu bleibt draußen';
});

await schritt('Drüben Dazugestoßener wird übernommen', async () => {
  const r = await fuehre(`
    delete meins.we[0].tage[0].orte[0].getraenke['9'];
    fremd.spieler.push({id:9, name:'Gast'});
    fremd.we[0].tage[0].orte[0].getraenke['9'] = ['normal:05'];`);
  if(!('9' in r.getraenke)) throw new Error('Gast fehlt');
  return 'Gast mit ' + r.getraenke['9'].length + ' Bier';
});

await schritt('Das Tagebuch wird vereinigt, nicht verdoppelt', async () => {
  const r = await fuehre(`
    basis.we[0].tage[0].orte[0].log = [{t:1, art:'einzel', pid:'1'}];
    meins.we[0].tage[0].orte[0].log = [{t:1, art:'einzel', pid:'1'}, {t:3, art:'einzel', pid:'2'}];
    fremd.we[0].tage[0].orte[0].log = [{t:1, art:'einzel', pid:'1'}, {t:2, art:'einzel', pid:'3'}];`);
  if(r.log !== 3) throw new Error(r.log + ' Einträge statt 3');
  return '3 Einträge, chronologisch';
});

await schritt('Eine zurückgenommene Runde steht danach nicht doppelt', async () => {
  const r = await p.evaluate(() => {
    const e = {t:5, gid:'gA', art:'runde', key:'normal:05', n:3};
    const raus = logVereinen([Object.assign({}, e, {weg:true})], [Object.assign({}, e)]);
    return {n:raus.length, weg: !!raus[0].weg};
  });
  if(r.n !== 1) throw new Error(r.n + ' Einträge statt 1');
  if(!r.weg) throw new Error('die Rücknahme ging verloren');
  return '1 Eintrag, Rücknahme erhalten';
});

await schritt('Das Tagebuch bleibt bei höchstens 40 Einträgen', async () => {
  const n = await p.evaluate(() => {
    const m = [], f = [];
    for(let i = 0; i < 40; i++) m.push({t:i, gid:'gA', art:'einzel'});
    for(let i = 100; i < 140; i++) f.push({t:i, gid:'gB', art:'einzel'});
    return logVereinen(m, f).length;
  });
  if(n !== 40) throw new Error(n + ' Einträge statt 40');
  return n + ' Einträge';
});

await schritt('Wiederherstellen setzt die Basis zurück', async () => {
  const r = await p.evaluate(async () => {
    const merk = token; token = null;   // ohne Token schreibt sichern() nicht
    basisDaten = {alt:true};
    sicherBlatt = {art:'bestaetigen',
      kandidat:{spieler:[{id:1,name:'Korbi'}], we:[], einst:{k:40}}};
    await tu.importAusfuehren();
    const b = basisDaten; token = merk;
    return b;
  });
  if(r !== null) throw new Error('basisDaten steht noch: ' + JSON.stringify(r));
  return 'ein Konflikt behielte den wiederhergestellten Stand';
});

console.log('\n== Der Zeiger der Gruppe ==');
await schritt('Wer die Runde bewegt hat, behält recht', async () => {
  const r = await fuehre(`
    fremd.we[0].tage[0].orte.push({id:910, name:'Neubau', getraenke:{'1':[]}, log:[]});
    fremd.aktivOrt = 910;
    meins.we[0].tage[0].orte[0].getraenke['2'].push('normal:05');`);
  if(r.ganz.aktivOrt !== 910) throw new Error('Zeiger steht auf ' + r.ganz.aktivOrt);
  return 'Zeiger folgt dem Neubau';
});

await schritt('Habe ich selbst bewegt, bleibt es bei meinem', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte.push({id:920, name:'Meine', getraenke:{'1':[]}, log:[]});
    meins.aktivOrt = 920;`);
  if(r.ganz.aktivOrt !== 920) throw new Error('Zeiger steht auf ' + r.ganz.aktivOrt);
  return 'Zeiger bleibt bei 920';
});

await schritt('Eine Aufteilung bewegt den Zeiger nicht', async () => {
  const r = await fuehre(`
    meins.we[0].tage[0].orte.push({id:930, name:'Neubau', getraenke:{'1':[]}, log:[]});
    fremd.we[0].tage[0].orte[0].getraenke['3'].push('normal:05');`);
  if(r.ganz.aktivOrt !== 902) throw new Error('Zeiger steht auf ' + r.ganz.aktivOrt);
  return 'Zeiger bleibt an der alten Bar';
});

await schritt('Ein drüben geänderter K-Faktor überlebt meinen Bier-Tipp', async () => {
  const r = await fuehre(`
    fremd.einst.k = 55;
    meins.we[0].tage[0].orte[0].getraenke['2'].push('normal:05');`);
  if(r.ganz.einst.k !== 55) throw new Error('K = ' + r.ganz.einst.k);
  return 'K = 55';
});

await schritt('Ein drüben hinterlegter Schlüssel geht nicht verloren', async () => {
  const r = await fuehre(`fremd.einst.kiSchluessel = 'sk-neu';`);
  if(r.ganz.einst.kiSchluessel !== 'sk-neu')
    throw new Error('Schlüssel: ' + r.ganz.einst.kiSchluessel);
  return 'Schlüssel übernommen';
});

await schritt('Habe ich selbst geändert, bleibt es bei meinem', async () => {
  const r = await fuehre(`meins.einst.k = 20; fremd.einst.k = 55;`);
  if(r.ganz.einst.k !== 20) throw new Error('K = ' + r.ganz.einst.k);
  return 'K = 20';
});

await schritt('Auch die Sortierung der Tabelle wird nicht zurückgesetzt', async () => {
  const r = await fuehre(`fremd.sortier = 'be';`);
  if(r.ganz.sortier !== 'be') throw new Error('sortier = ' + r.ganz.sortier);
  return 'sortier = be';
});

console.log('\n== Struktur, Fortsetzung ==');
await schritt('Ein ganzes fremdes Wochenende bleibt erhalten', async () => {
  const r = await p.evaluate((grund) => {
    const kopie = () => JSON.parse(JSON.stringify(grund));
    const basis = kopie(), meins = kopie(), fremd = kopie();
    fremd.we.push({id:800, titel:'München', datum:'2026-05-01', zu:true, dabei:[1,2], tage:[]});
    return zusammenfuehren(basis, meins, fremd).we.map(w => w.titel);
  }, grund);
  if(r.join(',') !== 'Berlin,München') throw new Error(r.join(', '));
  return r.join(' · ');
});

await schritt('Ohne Basis bleibt es beim eigenen Stand', async () => {
  const r = await p.evaluate((grund) => {
    const meins = JSON.parse(JSON.stringify(grund));
    meins.we[0].titel = 'Meins';
    return zusammenfuehren(null, meins, JSON.parse(JSON.stringify(grund))).we[0].titel;
  }, grund);
  if(r !== 'Meins') throw new Error(r);
  return r;
});

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
