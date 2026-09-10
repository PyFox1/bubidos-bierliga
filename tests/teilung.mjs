import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

/* Rauschen aus dem Prüfstand selbst: abgefangene Netzaufrufe, die absichtlich
   provozierten Fehlerantworten und die nicht erreichbaren Google Fonts. Echte
   Ausnahmen kommen als pageerror oder als „Zeichnen fehlgeschlagen“ durch. */
const RAUSCHEN = /fonts\.googleapis|gstatic|net::ERR_|status of (404|409|500)/;

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8911);

// Ein gemeinsamer „Server“ für beide Geräte, mit sha wie bei GitHub.
const heute = new Date().toISOString().slice(0,10);
let datei = JSON.stringify({
  spieler: [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'},
            {id:4,name:'Gerry'},{id:5,name:'Kammy'}],
  we: [{id:900, titel:'Berlin', datum:heute, zu:false, dabei:[1,2,3,4,5],
    tage:[{id:901, label:'1. Tag', orte:[
      {id:902, name:'Alte Bar', getraenke:{'1':[],'2':[],'3':[],'4':[],'5':[]}}]}]}],
  aktivWe:900, aktivTag:901, aktivOrt:902, einst:{k:40}, geraete:{}, stand:1000
});
let sha = 's1', n = 1;

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const fehler = [];

async function geraet(kennung){
  const ctx = await b.newContext({viewport:{width:390, height:820}});
  const p = await ctx.newPage();
  p.on('pageerror', e => fehler.push(kennung + ' PAGEERROR: ' + e.message));
  p.on('console', m => { if(m.type() === 'error' && !RAUSCHEN.test(m.text()) && !/fonts\.googleapis/.test(m.text()))
    fehler.push(kennung + ' CONSOLE: ' + m.text()); });
  await p.route('**/api.github.com/**', async r => {
    const q = r.request();
    if(q.method() === 'PUT'){
      const k = JSON.parse(q.postData());
      if(k.sha !== sha) return r.fulfill({status:409, contentType:'application/json', body:'{}'});
      datei = Buffer.from(k.content, 'base64').toString('utf8');
      sha = 's' + (++n);
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({content:{sha}})});
    }
    if(!q.url().includes('/contents/stand.json'))       // Ordner: nur der sha
      return r.fulfill({status:200, contentType:'application/json',
        body: JSON.stringify([{path:'stand.json', sha, type:'file'}])});
    r.fulfill({status:200, contentType:'application/json',
      body: JSON.stringify({sha, content: Buffer.from(datei).toString('base64')})});
  });
  await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
  await p.goto('http://localhost:8911/');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);
  return p;
}

// Schreiben sofort erzwingen und den anderen abgleichen lassen.
const durchreichen = async (von, nach) => {
  await von.evaluate(() => sichern({sofort:true}));
  await von.waitForTimeout(350);
  await nach.evaluate(() => { ghSha = null; return abgleichen(); });
  await nach.waitForTimeout(350);
};
const ortVon = p => p.evaluate(() => { const {ort} = aktuell(); return ort ? ort.name : null; });
const leuteVon = p => p.evaluate(() => { const {ort} = aktuell();
  return Object.keys(ort.getraenke).map(id => {
    const q = state.spieler.find(x => String(x.id) === String(id)); return q ? q.name : id; }); });

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const A = await geraet('A');   // Korbi, zieht vor
const B = await geraet('B');   // Sperry, bleibt sitzen

console.log('\n== Normalfall: alle ziehen gemeinsam weiter ==');
await schritt('Beide starten in der Alten Bar', async () => {
  const [a, b2] = [await ortVon(A), await ortVon(B)];
  if(a !== 'Alte Bar' || b2 !== 'Alte Bar') throw new Error(a + ' / ' + b2);
  return a;
});

await schritt('A macht eine Station auf, alle gehen mit – B folgt', async () => {
  await A.evaluate(() => { tu.ortNeu();
    document.getElementById('ortNameNeu').value = 'Zweite Kneipe'; tu.benennenFertig(); });
  await durchreichen(A, B);
  const [a, b2] = [await ortVon(A), await ortVon(B)];
  if(a !== 'Zweite Kneipe' || b2 !== 'Zweite Kneipe') throw new Error('A: ' + a + ', B: ' + b2);
  return 'beide in ' + a;
});

await schritt('Niemand hängt an einem eigenen Standort', async () => {
  const e = await A.evaluate(() => aktuell().eigen) || await B.evaluate(() => aktuell().eigen);
  if(e) throw new Error('eigener Standort gesetzt, obwohl alle zusammen sind');
});

console.log('\n== Aufteilung: Korbi und Fifu ziehen vor ==');
await schritt('Der eingetippte Name übersteht das Ab- und Anschalten von Leuten', async () => {
  await A.evaluate(() => {
    tu.ortNeu();
    document.getElementById('ortNameNeu').value = 'Neubau';
    // Sperry, Gerry, Kammy bleiben sitzen – jeder Tipp zeichnet das Blatt neu
    ['3','4','5'].forEach(id => tu.mitAn({dataset:{id}}));
  });
  const feld = await A.evaluate(() => document.getElementById('ortNameNeu').value);
  if(feld !== 'Neubau') throw new Error('Name ging verloren: "' + feld + '"');
  return feld;
});

await schritt('Getipptes übersteht auch ein Neuzeichnen von außen', async () => {
  await A.evaluate(() => {
    const f = document.getElementById('ortNameNeu');
    f.value = 'Neubau am Markt';
    f.dispatchEvent(new Event('input', {bubbles:true}));
    zeichnen();   // etwa durch einen Abgleich im Hintergrund
  });
  const feld = await A.evaluate(() => document.getElementById('ortNameNeu').value);
  if(feld !== 'Neubau am Markt') throw new Error('Name ging verloren: "' + feld + '"');
  await A.evaluate(() => {
    const f = document.getElementById('ortNameNeu');
    f.value = 'Neubau';
    f.dispatchEvent(new Event('input', {bubbles:true}));
  });
  return feld;
});

await schritt('A öffnet den Neubau nur für Korbi und Fifu', async () => {
  await A.evaluate(() => tu.benennenFertig());
  const l = await leuteVon(A);
  const name = await ortVon(A);
  if(l.join(',') !== 'Korbi,Fifu') throw new Error('im Neubau: ' + l.join(', '));
  if(name !== 'Neubau') throw new Error('Station heißt: ' + name);
  return name + ': ' + l.join(', ');
});

await schritt('B bleibt in der Zweiten Kneipe sitzen', async () => {
  await durchreichen(A, B);
  const b2 = await ortVon(B);
  if(b2 !== 'Zweite Kneipe') throw new Error('B wurde mitgerissen nach: ' + b2);
  return b2;
});

await schritt('B sieht dort alle fünf und darf zählen', async () => {
  const l = await leuteVon(B);
  const r = await B.evaluate(() => istRueckblick());
  if(l.length !== 5) throw new Error('B sieht: ' + l.join(', '));
  if(r) throw new Error('B ist gesperrt, obwohl die Gruppe dort steht');
  return l.length + ' Leute, kein Rückblick';
});

await schritt('B zählt weiter, ohne etwas zu entsperren', async () => {
  await B.evaluate(() => tu.strich({dataset:{id:'3'}}));
  const be = await B.evaluate(() => { const {ort} = aktuell(); return ort.getraenke['3'].length; });
  if(be !== 1) throw new Error('nicht eingetragen: ' + be);
  return '1 Bier für Sperry';
});

await schritt('A steht sichtbar getrennt', async () => {
  const e = await A.evaluate(() => aktuell().eigen);
  const kopf = await A.locator('.kz-wo').textContent();
  const band = await A.locator('.rueckband').count();
  if(!e) throw new Error('A gilt nicht als getrennt');
  if(!/getrennt/.test(kopf)) throw new Error('Kopfzeile: ' + kopf);
  if(!band) throw new Error('kein Band auf dem Zählbildschirm');
  return kopf;
});

await schritt('A zählt im Neubau, B wird davon nicht bewegt', async () => {
  await A.evaluate(() => tu.strich({dataset:{id:'1'}}));
  await durchreichen(A, B);
  const b2 = await ortVon(B);
  if(b2 !== 'Zweite Kneipe') throw new Error('B steht in: ' + b2);
  return 'B unverändert';
});

console.log('\n== Beide Grüppchen ziehen unabhängig weiter ==');
await schritt('B zieht mit allen Zurückgebliebenen weiter – A bleibt im Neubau', async () => {
  await B.evaluate(() => { tu.ortNeu();
    document.getElementById('ortNameNeu').value = 'Dritte Kneipe'; tu.benennenFertig(); });
  await durchreichen(B, A);
  const a = await ortVon(A);
  if(a !== 'Neubau') throw new Error('A wurde mitgerissen nach: ' + a);
  return 'A weiter im Neubau, B in der Dritten Kneipe';
});

console.log('\n== Die Wertung nimmt die Aufteilung nicht übel ==');
await schritt('Alle fünf sind im Tag, jeder zählt nur seine eigene Station', async () => {
  const r = await A.evaluate(() => {
    const tl = berechnen().log[0].tagLog[0];
    const n = {}; Object.keys(tl.erg).forEach(id => {
      const q = state.spieler.find(x => String(x.id) === String(id));
      n[q.name] = {be:+tl.erg[id].be.toFixed(2), orte:tl.erg[id].orte};
    });
    return n;
  });
  if(Object.keys(r).length !== 5) throw new Error('im Tag: ' + Object.keys(r).join(', '));
  if(r.Korbi.be !== 1) throw new Error('Korbi ' + r.Korbi.be + ' BE');
  if(r.Sperry.be !== 1) throw new Error('Sperry ' + r.Sperry.be + ' BE');
  // Korbi war in Alte Bar, Zweite Kneipe, Neubau – nicht in der Dritten Kneipe
  if(r.Korbi.orte !== 3) throw new Error('Korbi in ' + r.Korbi.orte + ' Locations');
  if(r.Sperry.orte !== 3) throw new Error('Sperry in ' + r.Sperry.orte + ' Locations');
  return 'Korbi ' + r.Korbi.be + ' BE/' + r.Korbi.orte + ' Stationen, '
       + 'Sperry ' + r.Sperry.be + ' BE/' + r.Sperry.orte;
});

console.log('\n== Ein neuer Tag holt alle zurück ==');
await schritt('B macht den 2. Tag auf – A läuft wieder mit', async () => {
  await B.evaluate(() => { tu.tagNeu();
    document.getElementById('ortNameNeu').value = 'Frühstück'; tu.benennenFertig(); });
  await durchreichen(B, A);
  const a = await ortVon(A);
  const e = await A.evaluate(() => aktuell().eigen);
  if(a !== 'Frühstück') throw new Error('A steht in: ' + a);
  if(e) throw new Error('A hängt noch an einem eigenen Standort');
  return 'beide im Frühstück';
});

console.log('\n== Blättern bewegt nur das eigene Gerät ==');
await schritt('A blättert zurück, B bleibt wo es ist', async () => {
  await A.evaluate(() => tu.bewege(-1));
  await durchreichen(A, B);
  const [a, b2] = [await ortVon(A), await ortVon(B)];
  if(a === 'Frühstück') throw new Error('A hat sich nicht bewegt');
  if(b2 !== 'Frühstück') throw new Error('B wurde mitgezogen nach: ' + b2);
  return 'A in ' + a + ', B in ' + b2;
});

await schritt('Zurückgeblättertes ist Rückblick und bleibt gesperrt', async () => {
  const r = await A.evaluate(() => istRueckblick());
  if(!r) throw new Error('kein Schreibschutz beim Zurückblättern');
});

await schritt('„Wieder mitlaufen“ bringt A zurück zur Gruppe', async () => {
  await A.evaluate(() => tu.zurGruppe());
  const a = await ortVon(A);
  const e = await A.evaluate(() => aktuell().eigen);
  if(a !== 'Frühstück' || e) throw new Error('A steht in: ' + a + ', eigen: ' + e);
  return a;
});

console.log('\n== Ein Abgleich mitten im offenen Blatt ==');
await schritt('„Passt" trifft die aufgemachte Station, nicht die, wo das Gerät steht', async () => {
  const r = await A.evaluate(() => {
    tu.ortNeu();                                   // neue Station am laufenden Tag
    const meine = benennen.ortId;
    ['3','4','5'].forEach(id => tu.mitAn({dataset:{id}}));   // Aufteilung

    // Währenddessen macht drüben jemand einen neuen Tag auf – so übernimmt es abgleichen()
    const we = state.we.find(w => w.id === state.aktivWe);
    const g = {}; we.dabei.forEach(id => g[id] = []);
    const fremdOrt = {id:987654, name:'Neuer Tag, Location 1', getraenke:g};
    we.tage.push({id:987000, label:'X. Tag', orte:[fremdOrt]});
    state.aktivTag = 987000; state.aktivOrt = 987654;

    document.getElementById('ortNameNeu').value = 'Meine Station';
    tu.benennenFertig();

    const finde = (id) => { for(const t of we.tage){ const o = t.orte.find(x => x.id === id);
      if(o) return o; } return null; };
    return {meine: finde(meine), fremd: finde(987654),
            aktivTag: state.aktivTag, aktivOrt: state.aktivOrt};
  });
  if(Object.keys(r.fremd.getraenke).length !== 5)
    throw new Error('die fremde Station wurde angefasst: '
      + Object.keys(r.fremd.getraenke).length + ' statt 5 Leute');
  if(r.fremd.name !== 'Neuer Tag, Location 1')
    throw new Error('die fremde Station wurde umbenannt: ' + r.fremd.name);
  if(r.meine.name !== 'Meine Station')
    throw new Error('die eigene Station heißt: ' + r.meine.name);
  if(Object.keys(r.meine.getraenke).length !== 2)
    throw new Error('eigene Station: ' + Object.keys(r.meine.getraenke).join(', '));
  if(r.aktivTag !== 987000 || r.aktivOrt !== 987654)
    throw new Error('die Gruppe wurde zurückgezogen: ' + r.aktivTag + '/' + r.aktivOrt);
  return 'fremde Station unberührt, Gruppe bleibt auf ihrem Tag';
});

console.log('\n== Nichts hängt in der Luft ==');
for(const [k, p] of [['A', A], ['B', B]]){
  await schritt('Jede data-tu-Aktion hat einen Handler (' + k + ')', async () => {
    await p.evaluate(() => { ansicht = 'info'; zeichnen(); });
    const offen1 = await p.evaluate(() => {
      const n = new Set(); document.querySelectorAll('[data-tu]').forEach(e => n.add(e.dataset.tu));
      return [...n].filter(x => typeof tu[x] !== 'function');
    });
    await p.evaluate(() => { ansicht = null; wechsler = true; zeichnen(); });
    const offen2 = await p.evaluate(() => {
      const n = new Set(); document.querySelectorAll('[data-tu]').forEach(e => n.add(e.dataset.tu));
      return [...n].filter(x => typeof tu[x] !== 'function');
    });
    await p.evaluate(() => { wechsler = false; zeichnen(); });
    const offen = [...new Set([...offen1, ...offen2])];
    if(offen.length) throw new Error('ohne Handler: ' + offen.join(', '));
  });
}

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n') : '\nKeine Konsolen-/Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
