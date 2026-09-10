// Der geschärfte Hinweistext im "Neues Wochenende"-Formular: unterscheidet er
// wirklich zwischen "später am selben Tag" (unbedenklich) und "an einem
// späteren Tag" (kostet Punkte)?
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';

const APP    = new URL('../index.html', import.meta.url).pathname;
const ORDNER = new URL('./bilder/', import.meta.url).pathname;

const html = fs.readFileSync(APP, 'utf8');
const srv = http.createServer((q, s) => {
  s.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); s.end(html);
}).listen(8917);

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await b.newPage({viewport:{width:390, height:820}});
await p.route('**/api.github.com/**', r => r.fulfill({status:404,
  contentType:'application/json', body:'{}'}));
await p.addInitScript(() => localStorage.setItem('bubidos-token', 'github_pat_test'));
await p.goto('http://localhost:8917/');
await p.waitForTimeout(700);

const schritt = async (name, fn) => {
  try { const z = await fn(); console.log('  OK   ' + name + (z ? '  (' + z + ')' : '')); }
  catch(e){ console.log('  FEHL ' + name + ' – ' + e.message); process.exitCode = 1; }
};

await p.evaluate(() => {
  state.spieler = [{id:1,name:'Korbi'},{id:2,name:'Fifu'},{id:3,name:'Kammy'}];
  vorwahl = null; ansicht = 'neu';
  zeichnen();          // baut vorwahl auf
  tu.vorwahlAuf();     // klappt die Pille auf
});

const titel = await p.locator('.pille-name').textContent();
const text = await p.locator('.wahl-auf .hinweis').textContent();
console.log('\n=== Beschriftung ===\n' + titel.trim());
console.log('\n=== Der Hinweistext ===\n' + text.trim() + '\n');

console.log('=== Prüfung ===');
await schritt('Die Beschriftung sagt, was der Regler wirklich tut', async () => {
  if(!/an der ersten Location/.test(titel))
    throw new Error('Beschriftung: "' + titel.trim() + '"');
  return titel.trim();
});
await schritt('Der Hinweis verweist knapp auf „dazugestoßen“', async () => {
  if(!/dazugestoßen/.test(text)) throw new Error('Verweis fehlt');
});
await schritt('Und ist kurz – die Begründung steht in § 4, nicht im Formular', async () => {
  const w = text.trim().split(/\s+/).length;
  if(w > 20) throw new Error(w + ' Wörter, das ist wieder ein Absatz');
  return w + ' Wörter';
});
await schritt('§ 4 trägt die Begründung', async () => {
  const info = await p.evaluate(() => { ansicht = 'info'; zeichnen();
    return document.getElementById('app').innerText; });
  if(!/nur angehakt, wer an der ersten Location steht/.test(info))
    throw new Error('die Begründung fehlt in der Anleitung');
  await p.evaluate(() => { ansicht = 'neu'; zeichnen(); });
});

console.log('\n=== Der deaktivierte Start ===');
await schritt('Mit nur einer Person sagt das Formular, warum es nicht weitergeht', async () => {
  await p.evaluate(() => { vorwahl.ids = [1]; zeichnen(); });
  const t = await p.locator('#app').innerText();
  const aus = await p.locator('[data-tu="weStart"]').isDisabled();
  if(!aus) throw new Error('Knopf ist gar nicht deaktiviert');
  if(!/Zum Start braucht es zwei/.test(t)) throw new Error('keine Erklärung sichtbar');
  return 'deaktiviert, mit Begründung';
});
/* Seit G38 hängt der Knopf an zwei Bedingungen: zwei Personen UND ein Wochenendname.
   Der Test prüfte nur die erste und schlug deshalb an, obwohl die App richtig lag. */
await schritt('Ab zwei Personen ist die Erklärung weg, der Name fehlt aber noch', async () => {
  await p.evaluate(() => { vorwahl.ids = [1,2]; vorwahl.titel = ''; zeichnen(); });
  const t = await p.locator('#app').innerText();
  if(/Zum Start braucht es zwei/.test(t)) throw new Error('Erklärung steht noch da');
  if(!(await p.locator('[data-tu="weStart"]').isDisabled()))
    throw new Error('ohne Namen darf der Knopf nicht frei sein');
  return 'Personen reichen nicht';
});
await schritt('Mit Namen ist der Knopf frei', async () => {
  await p.evaluate(() => { vorwahl.titel = 'Nockherberg'; zeichnen(); });
  if(await p.locator('[data-tu="weStart"]').isDisabled())
    throw new Error('immer noch deaktiviert');
  return 'frei';
});

await b.close(); srv.close();
