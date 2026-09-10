/* Läuft alle Tests der Reihe nach und fasst zusammen.
   Aufruf:  node tests/alle.mjs            – alles
            node tests/alle.mjs urkunde    – nur, was „urkunde“ im Namen hat

   Gebraucht werden Node ab 18 und `playwright-core` mit einem Chromium. Liegt der
   nicht unter /opt/pw-browsers/chromium, hilft PLAYWRIGHT_CHROMIUM=<pfad>.
   Kein Build-Schritt, keine Abhängigkeit der App selbst – die bleibt eine Datei.

   Nacheinander und nicht nebeneinander: Jeder Test macht seinen eigenen kleinen
   Webserver auf einem festen Port auf, parallel würden sie sich in die Quere kommen.

   `echt-ki.mjs` läuft absichtlich nicht mit: Der geht wirklich ins Netz, kostet Geld
   und braucht einen Schlüssel. */
import { spawn } from 'child_process';
import fs from 'fs';

const HIER  = new URL('.', import.meta.url).pathname;
const AUSSEN = new Set(['alle.mjs', 'echt-ki.mjs']);
const filter = process.argv[2] || '';

const dateien = fs.readdirSync(HIER)
  .filter(f => f.endsWith('.mjs') && !AUSSEN.has(f))
  .filter(f => !filter || f.indexOf(filter) >= 0)
  .sort();

if(!dateien.length){
  console.error('Nichts gefunden' + (filter ? ' zu „' + filter + '“' : '') + '.');
  process.exit(2);
}

const laufen = datei => new Promise(fertig => {
  const kind = spawn(process.execPath, [HIER + datei], {stdio:['ignore','pipe','pipe']});
  let aus = '';
  kind.stdout.on('data', d => aus += d);
  kind.stderr.on('data', d => aus += d);
  kind.on('close', code => fertig({aus, code}));
});

let gesamtOk = 0, gesamtFehl = 0;
const kaputt = [];
const start = Date.now();

for(const datei of dateien){
  const {aus, code} = await laufen(datei);
  const zeilen = aus.split('\n');
  const ok   = zeilen.filter(z => /^\s{2}OK\s/.test(z)).length;
  const fehl = zeilen.filter(z => /^\s{2}FEHL\s/.test(z)).length;
  const hart = zeilen.filter(z => /PAGEERROR|FANGNETZ/.test(z));
  gesamtOk += ok; gesamtFehl += fehl + hart.length;
  const schlimm = fehl || hart.length || code !== 0;
  if(schlimm) kaputt.push(datei);
  console.log((schlimm ? '  FEHL ' : '  ok   ')
    + datei.replace('.mjs','').padEnd(16) + String(ok).padStart(3) + ' geprüft'
    + (fehl ? ', ' + fehl + ' daneben' : '')
    + (hart.length ? ', ' + hart.length + ' Ausnahme(n)' : '')
    + (code !== 0 && !fehl && !hart.length ? ', Abbruch mit Code ' + code : ''));
  if(schlimm){
    const nennen = zeilen.filter(z => /^\s{2}FEHL\s|PAGEERROR|FANGNETZ/.test(z));
    /* Bricht der Test ab, bevor die erste Prüfung durch ist – fehlendes
       playwright-core, kein Chromium, Tippfehler –, gibt es keine FEHL-Zeile zum
       Zeigen. Dann die letzten Ausgabezeilen, sonst steht da nur „Code 1“ und man
       sucht die Ursache von Hand. */
    const zeigen = nennen.length ? nennen.slice(0, 6)
      : zeilen.filter(z => z.trim()).slice(-6);
    zeigen.forEach(z => console.log('       ' + z.trim()));
  }
}

const dauer = Math.round((Date.now() - start)/1000);
console.log('\n' + dateien.length + ' Dateien, ' + gesamtOk + ' Prüfungen, '
  + (gesamtFehl ? gesamtFehl + ' daneben' : 'alles grün') + ', ' + dauer + ' s');
if(kaputt.length) console.log('Nachsehen bei: ' + kaputt.join(', '));
process.exit(kaputt.length ? 1 : 0);
