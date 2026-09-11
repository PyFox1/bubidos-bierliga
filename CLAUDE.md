# Bubidos Bierliga

Eine Bier-Rangliste für eine feste Gruppe von fünf Freunden (Korbi, Fifu, Sperry, Gerry, Kammy),
die sich zwei bis drei Wochenenden im Jahr trifft. Läuft auf dem Handy, wird von mehreren Leuten
gleichzeitig bedient, oft in gemütlichem Zustand.

**Sprache: durchgehend Deutsch** — Oberfläche, Kommentare, Commit-Nachrichten, Variablennamen.

## Aufbau

Alles steckt in **einer einzigen `index.html`**: HTML, CSS, JavaScript, SVG-Logo. Keine
Build-Schritte, keine Abhängigkeiten außer drei Google Fonts (Anton, Karla, DM Mono).

- **App**: GitHub Pages aus `PyFox1/bubidos-bierliga`
- **Daten**: `stand.json` in `PyFox1/bubidos-bierliga-daten` (privat), über die GitHub-Contents-API
- **Zugriff**: Jedes Gerät gibt einmalig einen Fine-grained-Token ein, gespeichert in `localStorage`

Die Konfiguration steht ganz oben in der Datei zwischen den `======`-Kommentaren.

## Die Tests

Sie liegen in **`tests/`** und steuern einen echten Browser (Playwright) gegen die Datei —
es gibt nichts zu bauen, sie laden `index.html` direkt.

```
cd tests && npm install     # einmalig, holt playwright-core
node tests/alle.mjs         # alles, rund zehn Minuten
node tests/alle.mjs urkunde # nur, was so heißt
```

Sie laufen **nacheinander**: Jeder macht seinen eigenen kleinen Webserver auf einem festen
Port auf, parallel kämen sie sich in die Quere.

Die Tests sind die einzige Ausnahme von „keine Abhängigkeiten" — die gilt der **App**, und die
bleibt eine Datei. Deshalb steht die `package.json` in `tests/` und nicht im Wurzelverzeichnis.

Zwei Dinge, die man wissen muss, sonst sucht man lange:

- **`zeichnen()` hat ein Fangnetz**, das Ausnahmen schluckt und einen Fehlerbildschirm zeigt.
  Als `pageerror` taucht davon **nichts** auf — ein kaputtes `ansichtUrkunde()` sieht dann aus
  wie „die Blende ist halt nicht da". Deshalb hört jeder Test zusätzlich auf
  `console.error` und schlägt bei `Zeichnen fehlgeschlagen` an. Das war kein hypothetischer
  Fall: Genau so ist ein echter Fehler zunächst durchgerutscht.
- **`tests/echt-ki.mjs` läuft nicht mit.** Er geht wirklich an die Anthropic-API, kostet Geld
  und braucht einen Schlüssel (`ANTHROPIC_API_KEY=… node tests/echt-ki.mjs`). Alle anderen
  fälschen die Antwort. Er beantwortet, was ein Mock nicht kann: ob die API den Aufruf direkt
  aus dem Browser durchlässt, ob die Websuche auf diesem Weg funktioniert und wie ein echter
  Nachrichtenbezug aussieht.

Bilder aus den Tests landen in `tests/bilder/` und stehen in `.gitignore`.

## Aufbau der Oberfläche

Es gibt **keine Reiterleiste**. Die App hat zwei Grundzustände, `modus()` entscheidet:

- **Läuft ein Wochenende** (`state.aktivWe` gesetzt) → Zählbildschirm, ganzflächig
- **Läuft keines** → Archiv mit Tabelle und vergangenen Wochenenden

Die Variable `ansicht` überschreibt das für Unteransichten. Werte: `null` (automatisch),
`archiv`, `zaehlen`, `neu`, `zwischen`, `person`, `wedetail`, `einst`, `info`, `token`.

| Funktion | Bildschirm | Erreichbar über |
|---|---|---|
| `ansichtToken` | Verbinden, Token eingeben | automatisch ohne gültigen Token |
| `ansichtArchiv` | Tabelle + Wochenendliste | Startseite ohne laufendes Wochenende |
| `ansichtNeuesWe` | Wochenende eröffnen **oder** nachbessern | Knopf im Archiv, ‹ an der ersten Location |
| `ansichtZaehlen` | Getränke zählen | Startseite bei laufendem Wochenende |
| `ansichtZwischen` | Zwischenstand Tag für Tag | Balkensymbol im Zählkopf |
| `ansichtPerson` | Kacheln, Orden, Wochenenden | Tipp auf einen Namen in der Tabelle |
| `ansichtWeDetail` | Fazit eines Wochenendes | Tipp auf eine Wochenendzeile |
| `ansichtEinst` | Nachschlagen, Verwaltung, Änderungen | Zahnrad |
| `ansichtInfo` | Betriebsanleitung, §1–§12 | aus den Einstellungen oder Erklär-Blättern |

Überlagerungen (`.blende`), gezeichnet in dieser Rangfolge: `foto`, `rechnung`, `punkteOffen`,
`erklaer`, `blatt` (Sammel-Eingabe), `sicherBlatt`, `benennen`, `wechsler`, `fazitOffen`, zuletzt
die **Urkunde**. Die ist die einzige, die nicht an einer Variablen hängt, sondern am Datenbestand
(`offeneUrkunde()`) — deshalb steht sie hinten: Sie muss sich vor kein offenes Eingabeblatt
drängen, sie wartet ohnehin.

`benennen` ist ein Objekt, kein Schalter: `{ortId, mit?, name?}`. `mit` trägt die Vorauswahl
für „Wer geht mit?“ und fehlt beim neuen Tag, `name` hält den eingetippten Ortsnamen fest,
weil jeder Tipp auf ein Namenschip das Blatt neu zeichnet.

Das Blatt löst seine Station über **`benennenOrt()`** aus `ortId` auf, nie über `aktuell()`.
`aktuell()` folgt dem eigenen Standort, und den kann ein Abgleich im Hintergrund aufheben
(etwa wenn drüben ein neuer Tag aufgemacht wird). Sonst benennt „Passt“ die falsche Location
um und löscht Leute aus ihr. Gilt für jedes Blatt, das eine Sache über mehrere Zeichnungen
hinweg festhält.

**Navigation**: `stapel` merkt bis zu zwölf Schritte, der Zurück-Pfeil ruft `zurueckNavi()`.
`geheArchiv` und `geheZaehlen` sind Heimatziele und leeren den Stapel.

**Bedienmuster**: Alle Klicks laufen über `data-tu="name"` und einen gleichnamigen Handler im
`tu`-Objekt. Gefährliche Aktionen nutzen `gefahr()` — zweimal tippen, Rücksetzung nach 4 s.

## Landkarte der wichtigsten Funktionen

- `berechnen()` — rechnet die gesamte Historie neu: Punkte, Siege, BE-Summen, Höchststände
- `fazitVon(e)` — Wochenendbilanz samt Orden
- `rangDaten()` / `rangZeilen()` — die sortierbare Tabelle, Spalten in `SPALTEN`
- `laden()` / `sichern()` / `schreiben()` — GitHub-Anbindung
- `zusammenfuehren()` — Drei-Wege-Abgleich bei gleichzeitiger Änderung, samt `listeVereinen()`
- `aktuell()` / `pinGueltig()` — wo dieses Gerät steht, siehe Aufteilung
- `zeichnen()` — Fangnetz, ruft `zeichnenRoh()`
- `ERKLAERUNGEN` — die Erklär-Blätter, jedes mit Verweis auf einen Paragrafen-Anker
- `markenPruefen()` — legt fällige Tagesmarken an (nur beim Eintragen), `markenAufraeumen()`
  nimmt sie zurück (überall), `offeneUrkunde()` sucht die nächste zu zeigende
- `urkundeHolen()` / `anKIText()` — der Urkundentext über die API, mit Websuche

## Speicher-Ablauf

1. `sichern()` merkt sich den Stand lokal und schreibt **sofort**, wenn seit dem letzten
   Schreibvorgang mehr als `SCHREIB_RUHE` (4 s) vergangen ist. Sonst plant es das Schreiben
   in `SCHREIB_FENSTER` (2,5 s) ein, und weitere Änderungen verschieben den Termin — eine
   Serie von Tipps wird ein Commit. Der erste Strich nach einer Pause ist damit ohne
   Verzögerung draußen, was am Tisch den Unterschied macht.
   `sichern({sofort:true})` schreibt in jedem Fall ohne Verzögerung.
   `schreibTimer` **muss** beim Feuern auf `null` zurückgesetzt werden. Vergessen war das
   ein stiller Totalausfall: Die abgelaufene Timer-Kennung bleibt als Zahl stehen, und der
   Abgleich hielt sie für einen laufenden Schreibvorgang — nach dem ersten eingetragenen
   Bier kam auf dem Gerät nichts mehr von den anderen an, bis die Seite neu geladen wurde.
2. `schreiben()` schickt die Datei mit dem bekannten `sha`. Antwortet GitHub mit **409**, war
   jemand schneller: Der fremde Stand wird geladen und über `zusammenfuehren()` mit dem eigenen
   verschmolzen, dann erneut geschrieben. Drei Wege — `basisDaten` ist der zuletzt vom Server
   bekannte Stand und dient als gemeinsamer Vorfahr. Getränke sind Strichlisten, deshalb je
   Sorte `meins + fremd − Basis`, nie unter null: beide Seiten behalten ihre Biere, ein
   Zurücknehmen bleibt zurückgenommen. Neue Locations, Tage, Wochenenden und Spieler von drüben
   kommen dazu; hier gezielt Gelöschtes kommt nicht zurück. Bei `aktivWe`/`aktivTag`/`aktivOrt`
   gewinnt, wer sie gegenüber der Basis bewegt hat — sonst zöge ein Konflikt die Runde an die
   vorige Station zurück. Das Tagebuch wird über `t|gid|art` verglichen, nicht über den ganzen
   Eintrag: eine zurückgenommene Runde wird im vorhandenen Eintrag mit `weg:true` markiert und
   stünde sonst doppelt da.
   `einst` wird je Schlüssel nach derselben Regel behandelt, `sortier` ebenso — sonst setzt
   ein Bier-Tipp den K-Faktor oder den hinterlegten Schlüssel zurück, den jemand Sekunden
   vorher eingetragen hat.
   Eine **Wiederherstellung** setzt `basisDaten` vorher auf `null`. Ohne Basis führt
   `zusammenfuehren()` nicht zusammen, sondern lässt den eigenen Stand stehen — ein Konflikt
   holte sonst genau das zurück, was der Import gerade wegräumen soll.
   Die Basis liegt über `basisSetzen()` auch in `localStorage` (`BASIS_KEY`) und wird beim
   Start mit `basisLaden()` wieder eingelesen. Ohne das hätte die App nach einem Start ohne
   Netz keinen gemeinsamen Vorfahren, und der erste Schreibvorgang nach Rückkehr des Empfangs
   überschriebe alles, was in der Zwischenzeit an anderen Tischen eingetragen wurde. Rest:
   Wer von einer Fassung vor G18 kommt, hat beim ersten Start noch keine Basis — einmalig
   greift dort das alte Verhalten, danach heilt es sich mit dem ersten erfolgreichen Abgleich.
3. `abgleichen()` vergleicht den `sha` und lädt bei Änderung neu. Den Takt setzt `taktMs()`:
   **3 Sekunden**, solange `state.aktivWe` gesetzt ist — läuft ein Abend und liegt die App
   vorn, schaut jemand auf den Zählbildschirm und will Zahlen in Echtzeit. Sonst **20
   Sekunden**; im Hintergrund gleicht `abgleichen()` ohnehin nicht ab.
   Maßgeblich ist bewusst die Lage, **nicht** „vor kurzem war Bewegung". Eine solche
   Heuristik stand hier schon und war falsch: Sitzt die Runde zwanzig Minuten und redet,
   fällt jedes Gerät auf den ruhigen Takt, und das nächste Bier braucht dann bis zu 20
   Sekunden — nachgemessen in `zweigeraete.mjs` (19,4 s), genau der Fall, über den sich am
   Tisch jeder ärgert.
   Einen Knopf zum Holen gibt es nicht, der Stand ist beim Öffnen da.
   Gefragt wird zweistufig: `fernSha()` ruft über `GH_ORDNER()` das **Verzeichnis** ab. Die
   Contents-API liefert dafür die Einträge mit `sha`, aber ohne `content` — ein paar hundert
   Byte statt der ganzen Datei. Erst wenn dieser `sha` von `ghSha` abweicht, wird die Datei
   selbst geholt. Der `sha` aus der Liste ist der git-Blob-Hash, also derselbe Wert wie beim
   Datei-Abruf und beim Schreiben; das ist gegen die echte API geprüft. `fernSha()` gibt
   `null` für „nicht feststellbar" zurück, dann bleibt es beim bisherigen Stand.
   Dazu der **ETag** des letzten Abrufs als `If-None-Match`. Hat sich nichts getan, antwortet
   GitHub mit 304 ohne Rumpf, und solche Antworten zählen nicht gegen das Stundenkontingent —
   erst das macht den 3-Sekunden-Takt bei fünf Geräten am selben Token bezahlbar (sonst
   5 × 1200 = 6.000 Abrufe je Stunde gegen ein Limit von 5.000).
   Ist der Header cross-origin nicht lesbar — GitHub muss ihn über
   `Access-Control-Expose-Headers` freigeben —, bleibt `ordnerEtag` leer, und `taktMs()`
   geht auf `TAKT_SPARSAM` (8 s, macht 2.250/h bei fünf Geräten) statt weiter teuer zu
   fragen. Vor dem allerersten Abruf ist das noch unbekannt (`etagGeprueft`); bis dahin wird
   flink getaktet, sonst wäre ausgerechnet das erste Bier des Abends das langsamste.
   Als Auffangnetz liest `fernSha()` zusätzlich `X-RateLimit-Remaining`; unter 1000 setzt
   `kontingentKnapp` den Takt dauerhaft auf ruhig.
   Jeder GitHub-Abruf läuft über `ghHolen()` mit einer Frist von 10 Sekunden. Ohne Abbruch
   wartet `fetch` im schlechten Netz praktisch endlos — und weil der nächste Abgleich erst
   nach dem vorigen geplant wird, stünde damit der ganze Takt. `gleichtGerade` verhindert,
   dass Timer und Sichtbarkeitswechsel gleichzeitig abgleichen.
   Ein ausstehender `schreibTimer` blockiert den Abgleich **nicht** — wer gerade selbst tippt,
   will erst recht sehen, was drüben eingetragen wird. Nur `schreibtGerade` hält ihn auf
   (Race mit dem 409-Pfad). Dafür gilt beim Übernehmen: Steht ein eigener Strich aus
   (`schreibTimer` oder `nochmalSchreiben`), gewinnt der fremde Stand **nie** pauschal, auch
   wenn sein `stand` neuer ist — er kann diesen Strich gar nicht enthalten und würde ihn
   wegwerfen. Dann wird zusammengeführt. Ohne offene Eingabe bleibt es beim einfachen
   Übernehmen.
4. Ohne Verbindung startet die App aus der lokalen Notfallkopie (`SPIEGEL_KEY`) mit Hinweis.
5. **Export/Import** in den Einstellungen als zusätzliche Sicherung außerhalb von GitHub.

## Datenmodell

```
Wochenende → Tage → Locations → Getränke je Person
```

Ein Getränk ist ein String `stärke:größe`, z. B. `normal:05`.
Stärken: `leicht` (3 %), `normal` (5 %), `stark` (7 %), `af` (0 %).
Größen: `033`, `05`, `10`.

**Anwesenheit** = die Person ist ein Schlüssel im `getraenke`-Objekt der Location. Ein leeres
Array heißt „war da, hat nichts getrunken" — das ist etwas völlig anderes als „war nicht da".

Am Tag hängt außerdem `tag.marken`: die ausgestellten Urkunden, je eine
`{id, stufe, pid, be, t, ort, ortNr, text, kopf?, quelle}`. Die `id` ist fest aus
`tagId:stufe:pid` gebaut und nicht gewürfelt — die Marke gehört **einer Person**, nicht der
Stufe. Siehe Tagesmarken weiter unten.

## Die Wertung

**Biereinheit (BE)** = Liter × Vol.-% ÷ 2,5. Eine Halbe Helles ist genau 1,00.

**Elo, gewertet wird der Tag** (nicht die Location, nicht das Wochenende):
- Anteil: `S = BE_A / (BE_A + BE_B)`, bei beidseitig null gilt 0,5
- Erwartung: `E = 1 / (1 + 10^((R_B − R_A)/400))`
- Änderung: `Δ = K/(n−1) × Σ(S − E)` über alle Gegner des Tages

Die Punktzahlen werden **nie gespeichert**, sondern bei jedem Laden aus den Getränkelisten neu
berechnet. Deshalb kann eine Sicherung nie im Widerspruch zur Tabelle stehen.

**Die fünf Orden** — *Deckelkönig*, *Schlagzahl*, *Aufsteiger*, *Gleichmaß*, *Durchhalter* — stehen
an **drei Stellen**, die auseinanderlaufen können: vergeben werden sie in `fazitVon()`, erklärt im
Blatt `ERKLAERUNGEN.orden`, nachgeschlagen in **§ 6**. Genau das war schon auseinander: das Blatt
hieß „Die vier Orden" und ließ den *Aufsteiger* aus, während das Fazit ihn vergab — wer im Fazit auf
die Erklärung tippte, fand einen Orden weniger, als vor ihm stand. Wer einen Orden anfasst, fasst
alle drei Stellen an; `tests/orden.mjs` prüft sie gegeneinander.

Jeder Orden wird von einem Wert begleitet, und der muss **begründen, warum gerade dieser gewonnen
hat**. Das *Gleichmaß* zeigte lange den Schnitt („Ø 2,00 BE je Tag") statt der Streuung, auf die es
vergeben wird — im Fazit stand damit neben der *Schlagzahl* mit Ø 6,00 ein Orden für Ø 2,00, ohne
dass irgendwas den niedrigeren Wert erklärte. Es zeigt jetzt `± 0,00 BE Schwankung`.

Nicht jedes Wochenende vergibt alle fünf: *Schlagzahl* und *Gleichmaß* brauchen mehr als einen Tag,
der *Aufsteiger* einen echten Punktgewinn, der *Durchhalter* jemanden, der mehr Locations gesehen
hat als der Rest. Der Titel „Die fünf Orden" meint den Katalog, nicht den einzelnen Abend.

## Entscheidungen und ihre Gründe

Diese Punkte wurden ausführlich diskutiert. Bitte nicht ohne Rückfrage umdrehen.

- **Gewertet wird der Tag, nicht die Location.** Die Gruppe zieht an einem Abend durch bis zu
  fünf Kneipen. Jede Station einzeln zu werten würde die Tabelle wild schwanken lassen.
- **Es gibt keine Obergrenze.** Der Deckel war ursprünglich an (8 BE je Tag), wurde auf Wunsch
  abgeschaltet und blieb eine Weile als Regler stehen. Auch der ist raus — er wurde nie benutzt.
  Jedes Bier zählt voll, damit führt die Tabelle, wer am meisten trinkt. Ein `deckel` in alten
  Beständen wird nicht mehr gelesen.
- **Alkoholfrei zählt 0,00 BE und wird bei den Litern getrennt geführt.** Sonst stünde jemand
  oben, der den Abend über Malzbier getrunken hat. Es muss aber eintragbar bleiben, damit
  „anwesend, trinkt nichts" abbildbar ist — das kostet nämlich Punkte, und das ist gewollt.
- **Fehltage kosten nichts.** Wer an einem Tag nicht eingetragen ist, kommt in dessen Wertung
  nicht vor. Wer fälschlich mit 0 BE mitgeführt wird, verliert dagegen deutlich (ca. 18 Punkte
  in einer Dreierrunde). Deshalb warnt die Oberfläche davor.
- **Zwei Mengen-Orden.** *Deckelkönig* für die Gesamtmenge, *Schlagzahl* für den Tagesschnitt —
  damit jemand, der erst am Samstag anreist, nicht chancenlos ist.
- **Zurückliegende Locations sind schreibgeschützt.** Man kann durch die Kette wischen, aber
  nicht versehentlich Bier am falschen Abend eintragen. Entsperren geht mit einem Tipp.
  Ausnahme: die Station, auf die `state.aktivOrt` zeigt, ist nie gesperrt — sonst stünde die
  zurückgebliebene Hälfte einer aufgeteilten Runde plötzlich vor einem „Rückblick“.
- **Die Runde darf sich aufteilen.** Ziehen zwei schon in den Neubau, während der Rest sitzen
  bleibt, laufen zwei Stationen desselben Tages nebeneinander. Der Rechenkern kann das von
  Haus aus, weil der Tag gewertet wird und nicht die Location — es war reine Bediensache:
  - `state.aktivOrt` ist der **Zeiger der Gruppe**: zieht die Runde geschlossen weiter, folgen
    alle Geräte. Das ist der Normalfall und bleibt unverändert.
  - Daneben gibt es einen **geräte-lokalen Standort** (`ortPin`, `localStorage`). Blättern und
    Springen setzen nur ihn und reißen niemanden mehr mit. Landet man wieder dort, wo die
    Gruppe steht, löst er sich auf.
  - Der Pin hält über parallele Stationen hinweg, aber **nicht über Tage**: macht die Gruppe
    einen neuen Tag auf, läuft jedes Gerät mit. Sonst landen Biere im falschen Tag, und der
    Tag ist die Einheit, die gewertet wird. Dafür merkt sich der Pin in `gruppeTag`, auf
    welchem Tag die Gruppe stand, als er gesetzt wurde.
  - Ausgelöst wird die Aufteilung über „Wer geht mit?“ im Blatt nach **+ Location**. Kommen
    alle mit, zieht der Gruppenzeiger weiter; bleibt jemand zurück, bleibt er stehen und nur
    dieses Gerät geht voraus. `ortNeu()` bietet niemanden an, der an diesem Tag schon an einer
    späteren Station steht — der ist vorausgezogen und sitzt nicht mehr am Tisch.
  - Voraussetzung dafür ist das Zusammenführen beim Schreibkonflikt (siehe Speicher-Ablauf).
    Ohne das schreiben sich zwei parallel zählende Grüppchen gegenseitig die Biere weg.
- **Ein neuer Tag übernimmt stillschweigend die ganze bisherige Runde.** `tagNeu()` trägt beim
  Anlegen alle `we.dabei` automatisch als Schlüssel an der ersten Location des neuen Tages ein,
  ohne zu fragen — anders als `ortNeu()` (+ Location), das seit der Aufteilungs-Funktion „Wer
  geht mit?" fragt. Bewusst so: Wer einen Tag gemeinsam beendet, ist am nächsten Tag auch wieder
  gemeinsam da — für eine feste Gruppe, die zusammen übernachtet, der Normalfall. Ein eigenes
  „Wer ist heute schon dabei?"-Blatt wäre dafür nur eine zusätzliche Frage ohne Nutzen.
  Schläft ausnahmsweise jemand länger, wird er über `ortRaus` („War hier nicht dabei") entfernt,
  bevor eine Runde läuft — sonst trägt „Runde für alle" ihm ein Bier ein, das er nie getrunken
  hat (`runde()` trägt bei jedem Schlüssel der Location ein, unabhängig von echter Anwesenheit),
  und ein ganzer verschlafener Tag kostet ihn spürbar Punkte (~20 in einer Dreierrunde,
  nachgestellt in `tests/tagneu.mjs`).
- **Das Deckblatt ist dieselbe Ansicht wie das Eröffnen.** `ansichtNeuesWe()` läuft in zwei Rollen:
  ohne `vorwahl.weId` legt „Los geht’s“ ein Wochenende an, mit `weId` schreibt „Passt“ in das
  laufende zurück (`weKopf` / `weKopfPasst` / `weKopfZu`). Erreichbar über den linken Pfeil der
  Kettennavi an Position 0, der vorher `disabled` war — vom Zählbildschirm führte sonst überhaupt
  kein Weg zurück, und wer den vertippten Wochenendnamen bemerkt, sucht ihn dort, wo er ihn
  eingetippt hat. Deshalb steht die Navi jetzt auch bei einer einzigen Location: sonst fehlte der
  Weg zurück ausgerechnet in der Minute nach dem Start.
  Zwei Fallen beim Zurückschreiben. Abgewählte verlieren ihre Striche an dieser Location — das
  gehört **vor** den Knopf, nicht in eine Meldung danach. Und `we.dabei` verliert nur, wer im
  ganzen Wochenende nirgends mehr einen Schlüssel hat: Wer nach einer Aufteilung an einer
  späteren Station sitzt, flöge sonst aus dem Wochenende, bloß weil er an der ersten Location
  nicht mehr steht.
  Beim Anlegen braucht das Wochenende einen Namen, die erste Location nicht: Ohne Namen bleibt
  „Los geht’s“ `disabled`, `weStart()` legt ohne Namen gar nichts an. Die Location fällt dagegen
  weiterhin auf „Location 1“ zurück, weil sie sich jederzeit über ‹ umbenennen lässt — der
  Wochenendname dagegen prägt die ganze Archivzeile und stünde sonst dauerhaft als
  „Wochenende 3“ da. Das Freischalten läuft über den globalen `input`-Listener, nicht über ein
  Neuzeichnen bei jedem Tastendruck — sonst spränge der Cursor beim Tippen aus dem Feld.
  Gilt nur für `weStart` (neu anlegen); `weKopfPasst` (Nachbessern) behält seinen alten Titel,
  wenn das Feld leergetippt wird, und ist deshalb nie an das Feld gekoppelt.
- **Vor dem Eintragen wird nachgefragt, wenn es gerade erst etwas gab.** Lag die vorige
  Eintragung weniger als `FRAGE_FENSTER` (3 min) zurück, trägt der Tipp nichts ein, sondern
  stellt eine Frage, die der nächste Tipp bestätigt; unbeantwortet verfällt sie nach
  `FRAGE_DAUER` (6 s). Das galt lange nur für „Runde für alle“ und fing damit den halben Fall
  ab: Tippt einer die Runde und geht der andere die Namen einzeln durch, warnte nichts. Deshalb
  fragt das **`+` je Person** genauso, und eine Runde zählt als Eintragung für jeden, der aus
  ihr ein Bier bekommen hat.
  `nachfrage` hält den Zustand — **eine** Variable für beide Fälle (`'runde'` oder die Kennung
  der Person), weil immer nur eine Frage offen sein kann und sie an neun Stellen zurückgesetzt
  wird; zwei Variablen nebeneinander wären eine davon irgendwann vergessen worden.
  Was die Frage entkräftet, steht in `letzteGabeFuer()`: gesucht wird rückwärts die letzte
  Eintragung, die diesen Namen betrifft, und gefragt nur, wenn sie ihm etwas *gegeben* hat.
  Ein ↶ oder eine Sammel-Eingabe davor heißt: Da korrigiert jemand mit dem Stand vor Augen —
  den auszubremsen wäre der falsche Fall.
  „Betrifft diesen Namen“ heißt bei einer Runde: Er stand dabei. Deshalb trägt der
  Tagebuch-Eintrag die Beteiligten in `ids`, nicht nur ihre Anzahl. Ohne das galt jede Runde
  für jeden, der an der Location steht — auch für den, der erst danach über „Wer ist noch
  dazugestoßen?“ dazukam: Sein allererstes Bier lief in „vor 1 Min gab es schon eins“, obwohl
  die Runde gelaufen war, bevor er am Tisch saß. Fehlt `ids` (Runde von einem Gerät mit
  älterer Fassung, das per Abgleich hereinkommt), bleibt es beim alten Verhalten.
  Die Frage darf **nichts anfassen, bevor sie beantwortet ist**. `strich()` hat `letzteRunde`
  ganz oben genullt; mit der Rückfrage davor wäre damit das „Runde zurücknehmen“ verschwunden,
  ohne dass irgendetwas passiert ist.
- **Die Einstellungen sind nach Gebrauch geordnet, nicht nach Datenmodell.** Sie begannen mit
  den Bubidos und dem Regler und endeten mit der Anleitung — also genau falsch herum: Leute
  entfernt man so gut wie nie, nachgeschlagen wird dauernd. Jetzt gilt:
  - **Zuerst** — nur beim ersten Öffnen auf einem Handy: die Frage nach dem eigenen Namen.
    Sie verschwindet, sobald sie *einmal beantwortet* wurde, auch bei „nur die Nummer" —
    dafür der lokale Merker `NAMENSFRAGE_KEY`. Ohne ihn ließe sich „ich will die Nummer"
    nicht von „noch nicht gefragt" unterscheiden, und der Block stünde jemandem dauerhaft
    im Weg, der sich bewusst dagegen entschieden hat.
    Die Box allein hilft nur, wer von sich aus aufs Zahnrad tippt. Deshalb trägt der
    Zahnrad-Knopf zusätzlich einen Punkt (`.hatpunkt`), solange `namensfrageOffen()` gilt
    — auf dem Zählbildschirm genauso wie im Archiv. Im Archiv steht zusätzlich eine
    gestrichelte Zeile über „Wochenende eröffnen“, die per Tipp direkt in die
    Einstellungen springt. Nicht auf dem Zählbildschirm: dort schöbe sie „Halbe“ und
    „Runde für alle“ nach unten, und wer mitten am Abend zählt, hat Wichtigeres vor —
    der Punkt am Zahnrad reicht dort. Bewusst gestrichelt statt gefüllt wie die Box selbst,
    damit sie nicht mit dem Knopf direkt darunter um Aufmerksamkeit konkurriert.
    `namensfrageOffen()` ist die eine Stelle für „ist die Frage noch offen" — Box, Punkt
    und Zeile fragen alle dieselbe Funktion, sonst laufen sie irgendwann auseinander.
  - **Nachschlagen** und **Änderungen** stehen offen da.
  - **Verwaltung** klappt alles Seltene auf: Dieses Gerät, Regler, Die Bubidos, Sichern,
    Verbindung. Zustand in `verwaltungOffen` — kein `<details>`, aus demselben Grund wie bei
    den Notizen.
  - Der Aufklapper steht **über** den Änderungen: die sind der längste Block, und wer an den
    K-Faktor will, soll nicht am ganzen Protokoll vorbeiscrollen.
- **Modell und Schlüssel des Foto-Zählens stehen nicht in der Oberfläche.** Die Modelle sind
  Konstanten im Quelltext; die Wahl stand als Chip-Reihe in den Einstellungen und wurde nie
  benutzt. Es sind **zwei**: `KI_MODELL` fürs Foto-Zählen (Ablesen, da reicht das schnellere)
  und `KI_MODELL_URKUNDE` für den Urkundentext — trockener Ton, Wortspiel und ein
  Nachrichtenbezug, der sitzen muss, sind das teurere Modell wert.
  Dazu ein `max_tokens`, das großzügig aussieht und es nicht ist: Das Modell denkt von Haus
  aus mit, und Denken, Suchergebnisse und Antwort teilen sich dieses Budget. Bei 1500 riss
  es mitten im JSON ab, das Auslesen scheiterte, der Ersatztext blieb stehen — ohne Meldung,
  und von außen sah es aus wie „die API liefert keinen Nachrichtenbezug". `urkunde.mjs`
  schlägt an, wenn es je wieder klein gedreht wird. Der Zugangsschlüssel wird weiter aus `state.einst.kiSchluessel`
  gelesen, aber nicht mehr dort eingetragen — er kommt in den Datenbestand. Ein `kiModell` in
  alten Beständen wird nicht mehr gelesen, wie schon der `deckel`.
- **Erklärungen sitzen im Kontext, nicht in der Anleitung.** Tipp auf eine Zahl öffnet ein kurzes
  Blatt mit Verweis in den passenden Paragrafen. Die Betriebsanleitung ist Nachschlagewerk,
  kein Einstieg. Jeder Paragraf hat einen Anker `p1` bis `p12`. Wer einen Paragrafen einschiebt,
  muss die `para`-Verweise in `ERKLAERUNGEN` mitziehen — dort stehen Anker *und* Klartextname
  (`§ 7 Technische Daten`), und beide laufen sonst auseinander.
- **Tagesmarken: 10, 18 und 25 BE, je Stufe, Tag und Person genau eine.** Die Entscheidungen
  dahinter:
  - **Jeder bekommt seine eigene.** Die Kennung heißt `tagId:stufe:pid` und trägt die Person.
    Das war einmal andersherum — eine Urkunde je Stufe und Tag, für den, der zuerst dort war —
    und genau daran ist es gescheitert: Wer dem einen das zehnte Bier tippt und zwei Sekunden
    später dem nächsten, hat für sein Gefühl zwei gleichzeitige Zehner vor sich; die Marke sah
    nur den ersten. Mehrere kamen nur dann zusammen auf eine Urkunde, wenn *ein einziger*
    `markenPruefen()`-Durchlauf sie zugleich erwischte, also praktisch nur bei „Runde für alle“.
    Ein Zeitfenster hätte die Grenze bloß verschoben. Jetzt gibt es kein Rennen: Wer die Stufe
    reißt, bekommt sie. Jeder Tag fängt wieder bei null an.
  - **Mehrere Urkunden kommen nacheinander.** Eine Runde für alle kann drei auf einmal
    auslösen; `offeneUrkunde()` sortiert nach `t`, `stufe` und zuletzt `pid`, damit auf jedem
    Handy dieselbe zuerst steht. Ersatztexte gibt es deshalb nur noch in der Einzahl.
  - **Die Marke liegt im Datenbestand, nicht in einer Variablen.** Sonst ginge sie bei jedem
    Neuzeichnen wieder auf, sähe sie nur das Handy, das das Bier getippt hat, und jedes Gerät
    bekäme einen anderen Text. So verteilt der Abgleich sie wie alles andere.
  - **Angelegt wird nur beim Eintragen, zurückgenommen überall.** `markenPruefen()` läuft an den
    vier Eintragungsstellen und *nicht* beim Abgleich — sonst riefen fünf Handys für dieselbe
    Urkunde fünfmal die API. Das Zurücknehmen dagegen steckt in `markenAufraeumen()` und läuft
    in `sichern()` und `uebernehmen()`: Fällt jemand durch ein ↶, ein Minus oder „War hier
    nicht dabei“ unter die Stufe, verschwindet die Urkunde. Jedes Gerät rechnet das aus
    denselben Strichen selbst aus — deshalb muss keine Löschung durch den Abgleich getragen
    werden, was mit einer reinen Vereinigung ohnehin nicht ginge. In `sichern()` und nicht an
    jeder einzelnen Stelle, weil durch `sichern()` jede Änderung kommt und eine davon zu
    vergessen nur eine Frage der Zeit wäre.
  - **Der Ort auf der Marke ist der der Person** (`personOrt()`), nicht der des Handys. Nach
    einer Aufteilung steht das tippende Gerät woanders als der, für den es tippt — und
    `markenPruefen()` geht ohnehin alle Leute des Tages durch, nicht nur die an dieser Station.
  - **Abgehakt wird lokal** (`URKUNDEN_KEY`), nicht im Bestand. Stünde es dort, tippte der Erste
    sie für alle weg — und genau das soll nicht sein: Wer sein Handy in der Tasche hatte, soll
    sie beim nächsten Öffnen noch vorfinden, notfalls am Morgen danach.
  - **Beim Zusammenführen gewinnt die frühere Marke**, nicht die zuletzt geschriebene. Tippen
    zwei Geräte dasselbe Bier, bevor der Abgleich durch ist, entscheidet der Zeitstempel und
    nicht, wessen Schreibvorgang zufällig durchkam. Bei gleicher Zeit gewinnt `quelle:'ki'`
    gegen `quelle:'ersatz'`.
  - **Der Ersatztext steht sofort drin, der API-Text ersetzt ihn später.** Andersherum hinge am
    Bierabend eine leere Urkunde im Netz, und ohne hinterlegten Schlüssel gäbe es nie eine.
    Nach dem `await` wird die Marke über `markeFinden()` neu gesucht: Ein Abgleich dazwischen
    kann `state.we` ausgetauscht haben, und der Text landete sonst in einem Objekt, das
    niemand mehr sieht.
  - **Gestaffelt wird die Fläche, nicht nur der Text.** 10 ist ein Blatt von unten, 18 eine Karte
    in der Mitte, 25 nimmt den ganzen Bildschirm. Das erkennt man auch in fortgeschrittener
    Stunde noch, und darum ging es. Die 25 trägt bewusst kein `data-tu` auf der Blende — wer so
    weit gekommen ist, drückt den Knopf. Die anderen beiden tragen `urkundeHintergrund`, nicht
    `urkundeWeg`: Das Muster `…Hintergrund` lässt der globale Klick-Empfänger nur durch, wenn
    wirklich *daneben* getippt wurde. Sonst verschwände die Urkunde beim Lesen.
  - **Der Text nimmt Bezug auf eine echte Nachricht.** Dafür läuft der API-Aufruf mit dem
    Websuche-Werkzeug; das Modell weiß von sich aus nicht, was in der Zeitung stand. Die Suche
    läuft serverseitig, ein Aufruf genügt also — keine Werkzeugschleife. Sie muss **nicht von
    heute** sein: Der Prompt lässt die letzten Tage zu, ein guter Bezug schlägt einen frischen.
    Außerdem darin: nichts Trauriges, und weder Quelle noch Schlagzeile nennen — der Bezug muss
    sich aus dem Satz ergeben.
  - **Das Bild zum Aufheben wird auf ein Canvas gezeichnet** (`urkundeBild()`), nicht aus der
    Seite geschnitten. Ein Bildschirmfoto hätte den Zählbildschirm dahinter, die Blende darüber
    und die Maße des jeweiligen Handys. Darauf stehen Datum, Uhrzeit, Wochenende, Tag und
    „*n*. Location: Name“ — dafür merkt sich die Marke `ort` und `ortNr` beim Anlegen; später
    ließe sich das nicht mehr rekonstruieren, weil die Runde weiterzieht.
    Ein Blatt, ein Name, groß — wer sich das aufhängt, will sich darauf wiederfinden.
    Weitergereicht wird über `navigator.share`, weil ein Download-Link auf dem iPhone im Nichts
    endet — von dort führt der Weg in die Fotos. Herunterladen ist nur der Rückfall.
    **Falle:** Ein Canvas löst kein Nachladen einer Schrift aus. Ohne das ausdrückliche
    `document.fonts.load()` steht auf dem Bildschirm Anton und im gesicherten Bild die
    Systemschrift. `document.fonts.check()` taugt nicht zum Prüfen — es antwortet auch dann mit
    ja, wenn nur eine Systemschrift einspringt; `urkunde.mjs` misst deshalb Textbreiten.
- **`SLANG` ist der Wortschatz der Runde** und geht sowohl in die Anweisung an die API als auch
  in die Ersatztexte — sonst klängen die beiden verschieden. Erweitern heißt: eine Zeile dazu.
  **Die Beispiele sind wichtiger als die Bedeutung.** „Peter" ist keine Anrede und kein Füllwort,
  sondern eine Silbe, die mitten in ein Wort geschoben wird, am liebsten an der Fuge eines
  zusammengesetzten Wortes: *Bierpetereinheiten*, *ordnungspetergemäß*, *Legendenpeterbildung*.
  Ohne die Beispielliste streut das Modell es als Einzelwort ein, und dann ist der Witz weg.
  `urkunde.mjs` prüft, dass zu jedem Eintrag Bedeutung und Beispiele stehen.
  Fünf Einträge sind **Zitate einer Offenbacher Netzfigur** und in der Runde stehende
  Wendungen. Drei wörtlich: *„Da kommt dir der Mock hoch"* (Ekel, gegen eine Sache),
  *„Ja, ja, die Sprüch kenn mer alle"* (Abwinken vor einer Ankündigung) und *„Dis is er,
  dis is der Mann fürs Leben"* (Pointe, die Verdopplung gehört dazu). Die stehen in Mundart
  da und müssen es bleiben — wer sie beim Aufräumen glättet („die Sprüche kennen wir
  alle"), hat ein grammatisch sauberes Wörterbuch und einen Eintrag, der nach niemandem
  mehr klingt. `urkunde.mjs` schlägt darauf an, im Wörterbuch **und** in den Ersatztexten.
  Zwei weitere sind **in der Form übernommen und im Ziel getauscht**: *„mehr gezappt wie
  ich gepisst hab"* und *„Dreck, Dreck, Original Dreck"*. Im Original geht das eine ums
  Ficken und das andere gegen eine Frau. Wiedererkennbar ist beide Male nicht das Ziel,
  sondern die Bauart — die absurde Steigerung, die dreifache Verschärfung. Der Grund für
  den Tausch ist mechanisch und nicht prüde: Der Wortlaut steht in einem Prompt, der bei
  **jeder** Urkunde ein bis zwei Einträge einweben soll, das Modell trägt den satirischen
  Rahmen des Originals nicht mit, und das Ergebnis ist ein Blatt mit einem Namen darauf,
  das weitergeschickt wird. `urkunde.mjs` prüft deshalb, dass die Bedeutung weiterhin auf
  eine *Sache* zeigt und kein Beispiel auf eine Person.
  **Was nicht aus einer belegten Quelle stammt, kommt nicht rein.** Die Einträge landen
  wörtlich im Prompt; ein dazuerfundenes Beispiel erzeugt Urkunden, die nach einer Runde
  klingen, die es nicht gibt — schlechter als gar kein Eintrag. Im Zweifel nachfragen statt
  ergänzen.
- **Das Eingabe-Tagebuch wird beim Abschließen eines Wochenendes gelöscht.** Gemessen macht es
  rund 81 % der Dateigröße aus und ist nach dem Abend wertlos: gelesen wird `ort.log` nur auf
  dem Zählbildschirm und für die Warnung vor der doppelten Runde. Die Getränkedaten bleiben
  vollständig, und der letzte Stand mit Tagebuch steht weiter in der Historie.
  Umgesetzt an drei Stellen, damit die Regel überall gilt: `weSchliessen()` räumt beim
  Abschließen auf, `migrieren()` bei jedem Laden für alle bereits abgeschlossenen Wochenenden
  (räumt also Altbestände nach), und `zusammenfuehren()` zum Schluss — sonst holt der Abgleich
  das Tagebuch von einem Gerät zurück, das den Abschluss noch nicht kennt. Die Funktion heißt
  deshalb `abgeschlossenAufraeumen()` und nicht mehr `tagebuchWeg()`: Sie wirft inzwischen auch
  den **Wortlaut der Urkunden** weg. Die Marke selbst — wer, wann, welche Stufe — sind ein paar
  Dutzend Byte und bleibt; der Text sind ein paar hundert, und gebraucht wird er nur, bis ihn
  jedes Handy einmal gesehen hat. Das ist am Ende des Wochenendes vorbei.
  Mit dem 1-MB-Limit der Contents-API gerechnet: mit Tagebuch war bei 23 Wochenenden ≈ 9 Jahren
  Schluss, jetzt bei 117 ≈ 47 Jahren.

## Fallen

- **Klassennamen.** `.plus` ist der große Getränke-Knopf. Der Δ-Chip hieß früher ebenfalls
  `plus` und hat dessen Aussehen geerbt — die Tabelle war zerschossen. Deshalb heißen die
  Δ-Klassen jetzt `dplus`, `dminus`, `dnull`. Bei neuen Klassennamen auf Kollisionen achten.
  **Die Kehrseite:** Eine neue Überlagerung braucht die Klasse `blende` mit, auch wenn sie
  ihren eigenen Namensraum hat. An `.blende` hängen `zeichnenRoh()` (räumt die alte weg), die
  Wischsperre und die Tastensperre. Die Urkunde hieß erst nur `.u-blende` — sie wurde nie
  weggeräumt, stapelte sich bei jedem Zeichnen, und der Wisch zur nächsten Location ging
  mitten durch sie hindurch. Sie heißt jetzt `blende u-blende s1|s2|s3`, und weil die
  `u-`-Regeln hinter `.blende` im Stylesheet stehen, gewinnen sie bei gleicher Spezifität.
- **Dateigrößen-Grenze.** Die GitHub-Contents-API liefert Inhalte nur bis 1 MB. Hochgerechnet
  reicht das ohne Tagebuch für Jahrzehnte. Wird es eng: alte Jahrgänge in eigene Dateien.
- **Namensreihen mit Vorauswahl brauchen Kästchen.** `.teiln` allein sieht bei durchweg
  angehakten Namen aus wie eine Reihe Knöpfe zum Auswählen — im Test hat jemand sie der Reihe
  nach angetippt, um „dabei“ zu markieren, und damit alle abgewählt. Mehrfachauswahl bekommt
  deshalb `.teiln.haken`: Kästchen vor jedem Namen, abgewähltes leer und durchgestrichen, dazu
  ein Satz darüber, der den Ausgangszustand nennt („Alle sind angehakt“). Reihen, bei denen
  genau eines gilt (`ichBin`, `kiModellWahl`), bleiben ohne — ein Kästchen verspräche dort
  Mehrfachauswahl. `tests/haken.mjs` hält beide Seiten fest.
- **Escaping.** Namen kommen von Nutzern. Alles, was in HTML landet, muss durch `esc()`.
- **Der Aufruf der Anthropic-API aus dem Browser geht.** Er läuft mit
  `anthropic-dangerous-direct-browser-access` und wurde auf GitHub Pages am Foto-Zählen
  nachgewiesen. Hier stand lange das Gegenteil — das war überholt. Daran hängt auch der
  Nachrichtenbezug der Urkunden: derselbe Endpunkt, derselbe Header. Der Schlüssel liegt im
  Datenbestand und damit im Browser jedes Geräts — das ist für fünf Freunde vertretbar, für
  alles andere nicht.
  **Gegen die echte API geprüft** (G41): Opus 5 mit `web_search_20260209`, `effort: medium`
  und `max_tokens: 8000` antwortet mit 200, führt zwei Suchen aus und liefert einen echten
  Nachrichtenbezug. Gemessen dabei: 51.000 Eingabe-Token — die Suchergebnisse machen fast
  alles davon aus —, 2.423 Ausgabe-Token, davon **1.413 fürs Denken**. Zwei Zahlen zum
  Merken: Das alte `max_tokens: 1500` hätte mitten im JSON abgeschnitten, und eine Urkunde
  kostet damit rund **35 Cent**, nicht die anfangs geschätzten acht. Wird das zu viel:
  `max_uses` der Websuche von 2 auf 1, das halbiert die Eingabe.
- **Ein abfangender Proxy lässt den Aufruf wie einen App-Fehler aussehen.** In einer Sandbox,
  die TLS aufbricht, scheitert der Aufruf **aus dem Browser** nach ein bis zwei Sekunden mit
  `ERR_CERT_AUTHORITY_INVALID`; `urkundeHolen()` schluckt das und lässt den Ersatztext stehen.
  `tests/echt-ki.mjs` meldet dann „ERSATZTEXT“, obwohl die App in Ordnung ist. Gegenprobe:
  denselben Rumpf per `curl` schicken — geht der durch, liegt es an der Umgebung.
- **Kein `localStorage` für die eigentlichen Daten.** Nur Token, Gerätekennung, der eigene
  Standort (`ortPin`), die Notfallkopie und die Abgleich-Basis liegen lokal. Die Wahrheit
  steht immer im Repository. Spiegel und Basis sind je eine volle Fassung des Stands — bei
  einem vollen Speicher fällt `lokal.schreiben()` still auf eine Kopie im Arbeitsspeicher
  zurück, und der Abgleich verhält sich wie vorher.
- **`basisDaten` nie mit `state` verwechseln.** `uebernehmen()` ruft `migrieren()`, und das
  arbeitet in den Listen. Deshalb wird der Serverstand zweimal geparst — einmal als Basis,
  einmal für `state`. Teilen sich beide dieselben Objekte, ist der Drei-Wege-Abgleich wertlos.

## Gewohnheiten

- **Die Fassungskennung `FASSUNG` bei jeder Änderung hochzählen.** Sie steht in den Einstellungen
  und im Fuß der Anleitung und dient dazu, veraltete Versionen zu erkennen. Format
  `JJJJ-MM-TT HH:MM · G<n> (GitHub)`, Uhrzeit lokal (Europa/Berlin), `<n>` bei jeder Änderung eins
  hoch. Die Uhrzeit hilft beim Unterscheiden, wenn wegen Cache/CDN-Verzögerung kurzzeitig zwei
  Fassungen im Umlauf sind.
- **Mit der Fassung eine Notiz in `NOTIZEN` anlegen**, neueste zuerst, `{f, d, z, punkte}`. Die
  Einstellungen zeigen unter *Änderungen* die neuesten `NOTIZ_START` (1) offen — die laufende
  Fassung genügt, alles darunter hat man beim letzten Öffnen schon gelesen. „Ältere
  Fassungen" holt mit jedem Tipp `NOTIZ_ANZAHL` (3) weitere dazu, bis die Historie durch ist,
  dann verschwindet der Knopf. „Wieder einklappen" steht erst da, wenn wirklich etwas ausgeklappt
  ist. Nur die oberste ist farbig abgesetzt, alles darunter trägt `.alt` — sie ist die
  laufende Fassung, nicht bloß die erste Zeile einer Liste.
  **Ausnahme G41:** Die Tagesmarken stehen bewusst *nicht* in den Änderungen — sie sollen die
  Runde am Abend überraschen, und wer nachschaut was neu ist, hätte den Witz vorher gelesen.
  Die Notiz sagt, dass etwas da ist, und nicht was. Nachzulesen sind sie in § 8: Wer die
  Betriebsanleitung aufschlägt, will es wissen. `urkunde.mjs` prüft, dass die Notiz nicht
  doch verrät. Das ist die einzige Stelle, an der eine Notiz absichtlich schweigt.
  Geschrieben wird sonst **für den, der die App bedient**: was er jetzt anders vorfindet oder neu
  kann. Keine Funktions- und Klassennamen, kein `sha`/`ETag`/`Timer`, und vor allem keine
  Floskeln — „diverse Verbesserungen", „Stabilität erhöht" sagen niemandem etwas. Statt
  „`schreibTimer` wird zurückgesetzt" also „Nach dem ersten eingetragenen Bier kam von den
  anderen Handys nichts mehr an". `notizen.mjs` hat dafür eine Wortliste und schlägt an.
  Die oberste Notiz **ist** die Fassungsanzeige: eine eigene Fußzeile mit `FASSUNG` gab es
  darunter mal, sie sagte dasselbe ein zweites Mal und ist raus. Deshalb müssen `f`, `d` und
  `z` exakt zu `FASSUNG` passen — sonst zeigt die App eine falsche Fassung an, und das fällt
  keinem auf; `notizen.mjs` rechnet beides gegeneinander.
  **Die Uhrzeit gehört dazu**, nicht nur das Datum: an einem Tag gehen durchaus mehrere
  Fassungen raus, und dann sind zwei Zeilen mit demselben Datum nicht auseinanderzuhalten.
  Kein `<details>` dafür: `zeichnen()` baut die Seite bei jedem Abgleich neu auf, ein offenes
  `<details>` klappte dabei wieder zu. Deshalb hält `notizenStufe` den Zustand — eine Zahl,
  kein Schalter, weil in Schritten nachgeholt wird.
  `FASSUNG` bleibt ein **wörtliches** `const FASSUNG = '…'` — die Prüfung auf eine neuere
  Fassung liest den Quelltext der ausgelieferten Datei mit einem regulären Ausdruck und
  findet einen berechneten Wert nicht.
- **Die Betriebsanleitung mitpflegen.** Sie ist Teil der Datei (`ansichtInfo`), im Ton einer
  augenzwinkernden DIN-Norm. Wer eine Funktion ändert, ändert den Paragrafen mit.
- **Das Fangnetz nicht entfernen.** `zeichnen()` fängt Ausnahmen ab und zeigt einen
  Fehlerbildschirm statt einzufrieren. Eine App, die am Bierabend hängenbleibt, ist wertlos.
- **Nach Änderungen `node tests/alle.mjs` laufen lassen.** Dauert rund zehn Minuten und hat
  schon mehr gefunden, als beim Schreiben absehbar war. Wer etwas Neues baut, legt eine
  Testdatei dazu — sie ist der einzige Ort, an dem eine Entscheidung nachprüfbar festgehalten
  wird, statt nur beschrieben zu sein.
- **Nach Änderungen prüfen**, dass alle `data-tu`-Aktionen einen Handler im `tu`-Objekt haben —
  das war mehrfach die Fehlerquelle. Jede Testdatei tut das am Ende von sich aus.
- **Nicht pushen ohne ausdrückliches Go.** Committen ist in Ordnung, `git push` erst nach
  expliziter Freigabe durch den Nutzer in diesem Gespräch.

## Ton

Die Oberfläche ist knapp und trocken, die Betriebsanleitung parodiert eine technische Norm
(„Der Betrieb an bereits schrägen Tischen erfolgt auf eigene Gefahr"). Keine Ausrufezeichen,
keine Emojis in der Oberfläche, kein Werbesprech. Optik: dunkles Zinn, Bierdeckel-Creme,
Malz-Akzent, bayerisches Rautenband.
