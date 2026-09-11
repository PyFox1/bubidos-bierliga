// Testmodus: ?test schaltet auf ein eigenes Repository und eigene lokale Schlüssel.
// Der Kern ist nicht die Umschaltung, sondern die Trennung: Was im Testmodus passiert,
// darf den echten Bestand nicht berühren – weder über GitHub noch über den Browser.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP = new URL('../index.html', import.meta.url).pathname;
const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8967);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:844}});
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
p.on('console', m => {
  if(m.type() === 'error' && /Zeichnen fehlgeschlagen/.test(m.text()))
    fehler.push('FANGNETZ: ' + m.text());
});

/* Beide Repos werden abgefangen – geprüft wird, welches überhaupt gefragt wird. */
const gefragt = [];
await p.route('**/api.github.com/**', r => {
  gefragt.push(r.request().url());
  return r.fulfill({status:404, contentType:'application/json', body:'{}'});
});

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

const oeffnen = async (query) => {
  gefragt.length = 0;
  await p.goto('http://localhost:8967/' + query);
  await p.waitForTimeout(500);
};

console.log('\n══ Ohne ?test bleibt alles wie bisher ══');

await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_echt'));
await oeffnen('');

await schritt('Der Testmodus ist aus', async () => {
  const t = await p.evaluate(() => TESTMODUS);
  if(t !== false) throw new Error('TESTMODUS ist ' + t);
});

await schritt('Gefragt wird das echte Repository', async () => {
  const t = await p.evaluate(() => GH_REPO);
  if(t !== 'bubidos-bierliga-daten') throw new Error('GH_REPO ist ' + t);
  if(!gefragt.length) throw new Error('es ging gar keine Anfrage raus');
  if(!gefragt.every(u => u.indexOf('bubidos-bierliga-daten') >= 0))
    throw new Error('fremdes Repo gefragt: ' + gefragt.join(', '));
  return gefragt.length + ' Abrufe, alle ans echte Repo';
});

await schritt('Kein Band', async () => {
  const da = await p.evaluate(() =>
    !document.getElementById('testband').hidden);
  if(da) throw new Error('das Band steht da, obwohl kein Testmodus läuft');
});

await schritt('Die Schlüssel heißen unverändert', async () => {
  const k = await p.evaluate(() => lokal.s('bubidos-basis'));
  if(k !== 'bubidos-basis') throw new Error('Schlüssel heißt ' + k);
  const t = await p.evaluate(() => token);
  if(t !== 'github_pat_echt') throw new Error('Token ist ' + t);
});

console.log('\n══ Mit ?test ══');

await oeffnen('?test');

await schritt('Der Testmodus ist an', async () => {
  const t = await p.evaluate(() => TESTMODUS);
  if(t !== true) throw new Error('TESTMODUS ist ' + t);
});

await schritt('Gefragt wird ausschließlich das Testrepository', async () => {
  const t = await p.evaluate(() => GH_REPO);
  if(t !== 'bubidos-bierliga-testdaten') throw new Error('GH_REPO ist ' + t);
  const echt = gefragt.filter(u => /\/bubidos-bierliga-daten\//.test(u));
  if(echt.length) throw new Error('das echte Repo wurde angefasst: ' + echt.join(', '));
  return 'kein Abruf ans echte Repo';
});

await schritt('Das Band steht da und nennt den Grund', async () => {
  const t = await p.evaluate(() => {
    const e = document.getElementById('testband');
    return e.hidden ? null : e.innerText;
  });
  if(!t) throw new Error('kein Band');
  if(!/Testdaten/i.test(t)) throw new Error('Band sagt: ' + t);
  return t;
});

/* Das Band steht im Fluss und nicht darüber: Sonst verdeckte es den Kopf dauerhaft. */
await schritt('Das Band verdeckt den Kopf nicht', async () => {
  const r = await p.evaluate(() => {
    const band = document.getElementById('testband').getBoundingClientRect();
    const kopf = document.getElementById('kopf').getBoundingClientRect();
    return {bandUnten: band.bottom, kopfOben: kopf.top};
  });
  if(r.bandUnten > r.kopfOben + 0.5)
    throw new Error('Band reicht bis ' + r.bandUnten + ', Kopf beginnt bei ' + r.kopfOben);
  return 'Band endet bei ' + Math.round(r.bandUnten) + ', Kopf beginnt dort';
});

console.log('\n══ Die Trennung im Browser-Speicher ══');

await schritt('Der echte Token gilt im Testmodus nicht', async () => {
  const t = await p.evaluate(() => token);
  if(t === 'github_pat_echt') throw new Error('der echte Token wurde übernommen');
  if(t) throw new Error('es liegt ein Token: ' + t);
  return 'leer, die App fragt nach einem eigenen';
});

await schritt('Ohne eigenen Token steht der Verbinden-Bildschirm', async () => {
  const m = await p.evaluate(() => modus());
  if(m !== 'token') throw new Error('Modus ist ' + m);
});

await schritt('Jeder Schlüssel bekommt ein Präfix', async () => {
  const k = await p.evaluate(() => [
    'bubidos-token','bubidos-spiegel','bubidos-basis','bubidos-ortpin',
    'bubidos-urkunden','bubidos-ich','bubidos-namensfrage'
  ].map(x => lokal.s(x)));
  const ohne = k.filter(x => x.indexOf('test-') !== 0);
  if(ohne.length) throw new Error('ohne Präfix: ' + ohne.join(', '));
  return k.length + ' Schlüssel';
});

/* Der eigentliche Grund für die Trennung: `bubidos-basis` ist der gemeinsame Vorfahr
   des Drei-Wege-Abgleichs. Stünde dort der Testbestand, führte die echte App gegen
   einen falschen Vorfahren zusammen – und das kostet echte Biere. */
await schritt('Schreiben im Testmodus lässt die echten Schlüssel unberührt', async () => {
  const vorher = await p.evaluate(() => ({
    basis: localStorage.getItem('bubidos-basis'),
    spiegel: localStorage.getItem('bubidos-spiegel'),
    token: localStorage.getItem('bubidos-token')
  }));
  await p.evaluate(() => {
    lokal.schreiben('bubidos-basis', '{"testkram":true}');
    lokal.schreiben('bubidos-spiegel', '{"testkram":true}');
    lokal.schreiben('bubidos-token', 'github_pat_test');
  });
  const nachher = await p.evaluate(() => ({
    basis: localStorage.getItem('bubidos-basis'),
    spiegel: localStorage.getItem('bubidos-spiegel'),
    token: localStorage.getItem('bubidos-token'),
    testBasis: localStorage.getItem('test-bubidos-basis'),
    testToken: localStorage.getItem('test-bubidos-token')
  }));
  if(nachher.basis !== vorher.basis) throw new Error('bubidos-basis wurde überschrieben');
  if(nachher.spiegel !== vorher.spiegel) throw new Error('bubidos-spiegel wurde überschrieben');
  if(nachher.token !== vorher.token) throw new Error('bubidos-token wurde überschrieben');
  if(nachher.testBasis !== '{"testkram":true}') throw new Error('test-bubidos-basis fehlt');
  if(nachher.testToken !== 'github_pat_test') throw new Error('test-bubidos-token fehlt');
  return 'echte Schlüssel unverändert, Testschlüssel angelegt';
});

await schritt('Zurück ohne ?test findet den echten Token wieder', async () => {
  await oeffnen('');
  const t = await p.evaluate(() => token);
  if(t !== 'github_pat_echt') throw new Error('Token ist ' + t);
  const b = await p.evaluate(() => localStorage.getItem('bubidos-basis'));
  if(b === '{"testkram":true}') throw new Error('der Testbestand steht in der echten Basis');
  return 'echter Token, echte Basis';
});

console.log('\n══ Schreibweisen der Adresse ══');

for(const [q, soll] of [['?test', true], ['?test=1', true], ['?a=1&test', true],
                        ['', false], ['?testen=1', false], ['?protest', false]]){
  await schritt('„' + (q || '(leer)') + '" → ' + (soll ? 'Testmodus' : 'echt'), async () => {
    await oeffnen(q);
    const t = await p.evaluate(() => TESTMODUS);
    if(t !== soll) throw new Error('TESTMODUS ist ' + t);
  });
}

await schritt('Jede data-tu-Aktion hat einen Handler', async () => {
  const fehlt = await p.evaluate(() => {
    const raus = new Set();
    document.querySelectorAll('[data-tu]').forEach(e => {
      if(typeof tu[e.dataset.tu] !== 'function') raus.add(e.dataset.tu); });
    return [...raus];
  });
  if(fehlt.length) throw new Error('ohne Handler: ' + fehlt.join(', '));
  return 'alle';
});

console.log(fehler.length ? '\nFehler auf der Seite:\n' + fehler.join('\n')
                          : '\nKeine Seitenfehler.');
if(fehler.length) process.exitCode = 1;

await b.close(); srv.close();
