// Steht in den Einstellungen das Häufige oben und das Seltene hinterm Aufklapper?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8965);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8965/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const aufbau = (gefragt) => p.evaluate(gefragt => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Sperry'}];
  state.we = []; state.aktivWe = null; state.einst = {k:40, kiSchluessel:''};
  state.geraete = {g1:{nr:1, name:null}}; gid = 'g1';
  if(gefragt) localStorage.setItem('bubidos-namensfrage','1');
  else localStorage.removeItem('bubidos-namensfrage');
  ansicht = 'einst'; verwaltungOffen = false; notizenStufe = 0; zeichnen();
}, gefragt);

/* Die Überschriften in der Reihenfolge, in der sie dastehen – daran hängt die ganze
   Umsortierung, und ein verrutschter Block fiele sonst niemandem auf. */
const koepfe = () => p.evaluate(() =>
  [...document.querySelectorAll('.abschnitt, .aufklapp')].map(x => x.textContent.trim()));

console.log('\n══ Beim allerersten Mal ══');
await aufbau(false);
await p.waitForTimeout(250);

await schritt('Ganz oben steht die Namensfrage', async () => {
  const k = await koepfe();
  if(k[0] !== 'Zuerst') throw new Error('oben steht: ' + k.join(' · '));
  return k.join(' · ');
});

await schritt('Die Namen stehen zum Antippen da', async () => {
  const n = await p.evaluate(() => [...document.querySelectorAll('[data-tu="ichBin"]')]
    .map(x => x.textContent.trim()));
  if(!n.includes('Korbi')) throw new Error('keine Namen: ' + n.join(', '));
  if(!n.includes('nur die Nummer')) throw new Error('kein Ausweg aus der Frage');
  return n.join(', ');
});

await schritt('Ein Tipp beantwortet sie und lässt sie verschwinden', async () => {
  await p.evaluate(() => tu.ichBin({dataset:{name:'Korbi'}}));
  await p.waitForTimeout(250);
  const k = await koepfe();
  if(k[0] === 'Zuerst') throw new Error('sie steht immer noch da');
  return 'oben steht jetzt: ' + k[0];
});

await schritt('Auch „nur die Nummer" beendet die Frage', async () => {
  await aufbau(false);
  await p.waitForTimeout(200);
  await p.evaluate(() => tu.ichBin({dataset:{}}));
  await p.waitForTimeout(250);
  const k = await koepfe();
  if(k[0] === 'Zuerst') throw new Error('wer die Nummer will, wird weiter gefragt');
  return 'weg';
});

console.log('\n══ Danach ══');
await aufbau(true);
await p.waitForTimeout(250);

await schritt('Oben steht, was man wirklich sucht', async () => {
  const k = await koepfe();
  const soll = ['Nachschlagen', 'Verwaltung', 'Änderungen'];
  if(JSON.stringify(k) !== JSON.stringify(soll))
    throw new Error('Reihenfolge: ' + k.join(' · '));
  return k.join(' · ');
});

await schritt('Die Betriebsanleitung ist ohne Scrollen erreichbar', async () => {
  const y = await p.evaluate(() => {
    const b = [...document.querySelectorAll('[data-tu="geheInfo"]')][0];
    return b ? b.getBoundingClientRect().top : null;
  });
  if(y === null) throw new Error('kein Knopf zur Anleitung');
  if(y > 820) throw new Error('steht bei ' + Math.round(y) + ' px, also unterhalb des Bildschirms');
  return 'bei ' + Math.round(y) + ' px';
});

/* Am Bedienelement gemessen, nicht am Fließtext: „Verbindung" steht auch im Toast und
   im Quelltext der Seite, und daran wäre die Prüfung blind vorbeigelaufen. */
await schritt('Das Seltene steht zugeklappt da', async () => {
  const da = await p.evaluate(() => [
    ['K-Faktor-Feld', !!document.getElementById('kFaktor')],
    ['Namensfeld der Bubidos', !!document.getElementById('neuName')],
    ['Export', !!document.querySelector('[data-tu="sicherAuf"]')],
    ['Schlüssel entfernen', !!document.querySelector('[data-tu="tokenLoesen"]')]
  ].filter(x => x[1]).map(x => x[0]));
  if(da.length) throw new Error('steht offen da: ' + da.join(', '));
  return 'kein einziges davon sichtbar';
});

await schritt('Ein Tipp auf Verwaltung holt alles hervor', async () => {
  await p.evaluate(() => tu.verwaltung());
  await p.waitForTimeout(250);
  const k = await koepfe();
  const soll = ['Nachschlagen','Verwaltung','Dieses Gerät','Regler','Die Bubidos',
                'Sichern','Verbindung','Änderungen'];
  if(JSON.stringify(k) !== JSON.stringify(soll))
    throw new Error('Reihenfolge: ' + k.join(' · '));
  return k.slice(2, -1).join(' · ');
});

await schritt('Und ein zweiter klappt es wieder zu', async () => {
  await p.evaluate(() => tu.verwaltung());
  await p.waitForTimeout(200);
  const k = await koepfe();
  if(k.length !== 3) throw new Error('offen geblieben: ' + k.join(' · '));
  return 'zu';
});

await schritt('Ein Neuzeichnen klappt es nicht von selbst zu', async () => {
  await p.evaluate(() => { tu.verwaltung(); zeichnen(); });
  await p.waitForTimeout(200);
  const t = await p.evaluate(() => document.body.innerText);
  if(!t.includes('K-Faktor'))
    throw new Error('der Abgleich hat den Block wieder zugeklappt');
  return 'bleibt offen';
});

console.log('\n══ Der K-Faktor erklärt sich ══');
await schritt('Unter dem Regler steht ein Erklär-Link', async () => {
  const l = await p.evaluate(() => {
    const x = [...document.querySelectorAll('.erklaerlink')].find(y => y.dataset.was === 'kfaktor');
    return x ? x.textContent.trim() : null;
  });
  if(!l) throw new Error('kein Link');
  return l;
});

await schritt('Er öffnet ein Blatt mit Verweis in den Paragrafen', async () => {
  await p.evaluate(() => tu.erklaerAuf({dataset:{was:'kfaktor'}}));
  await p.waitForTimeout(250);
  const t = await p.evaluate(() => document.body.innerText);
  if(!/K-Faktor/.test(t)) throw new Error('kein Blatt');
  if(!/§ 7/.test(t)) throw new Error('kein Verweis auf den Paragrafen');
  await p.evaluate(() => { erklaer = null; zeichnen(); });
  return 'Blatt mit Verweis auf § 7';
});

console.log('\n══ Die Foto-Zählung ist raus ══');
await aufbau(true);
await p.evaluate(() => { verwaltungOffen = true; zeichnen(); });
await p.waitForTimeout(250);

await schritt('Weder Schlüsselfeld noch Modellwahl stehen in den Einstellungen', async () => {
  const r = await p.evaluate(() => ({
    feld: !!document.getElementById('kiSchluessel'),
    modell: !!document.querySelector('[data-tu="kiModellWahl"]'),
    txt: document.body.innerText
  }));
  if(r.feld) throw new Error('das Schlüsselfeld steht noch da');
  if(r.modell) throw new Error('die Modellwahl steht noch da');
  if(/Foto-Zählung/.test(r.txt)) throw new Error('der Abschnitt steht noch da');
  return 'raus';
});

await schritt('Das Modell ist fest auf Sonnet verdrahtet', async () => {
  const m = await p.evaluate(() => KI_MODELL);
  if(m !== 'claude-sonnet-5') throw new Error('steht auf ' + m);
  return m;
});

await schritt('Ein hinterlegter Schlüssel bleibt trotzdem nutzbar', async () => {
  const s = await p.evaluate(() => {
    state.einst.kiSchluessel = 'sk-ant-test';
    return kiSchluessel();
  });
  if(s !== 'sk-ant-test') throw new Error('kiSchluessel() gibt ' + JSON.stringify(s));
  return 'wird weiter gelesen';
});

console.log('\n══ Hängt jede data-tu-Aktion an einem Handler? ══');
await schritt('Zu und offen, mit und ohne Namensfrage', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    const s = () => [...document.querySelectorAll('[data-tu]')]
      .forEach(e => { if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    [[true,true],[true,false],[false,true],[false,false]].forEach(([v,g]) => {
      verwaltungOffen = v;
      if(g) localStorage.setItem('bubidos-namensfrage','1');
      else localStorage.removeItem('bubidos-namensfrage');
      zeichnen(); s();
    });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

await aufbau(true);
await p.waitForTimeout(200);
await p.screenshot({path:ORDNER + 'einst-zu.png', fullPage:true});
await p.evaluate(() => { verwaltungOffen = true; zeichnen(); });
await p.waitForTimeout(200);
await p.screenshot({path:ORDNER + 'einst-auf.png', fullPage:true});

console.log('');
await b.close(); srv.close();
