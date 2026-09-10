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
| `ansichtNeuesWe` | Wochenende eröffnen | Knopf im Archiv |
| `ansichtZaehlen` | Getränke zählen | Startseite bei laufendem Wochenende |
| `ansichtZwischen` | Zwischenstand Tag für Tag | Balkensymbol im Zählkopf |
| `ansichtPerson` | Kacheln, Orden, Wochenenden | Tipp auf einen Namen in der Tabelle |
| `ansichtWeDetail` | Fazit eines Wochenendes | Tipp auf eine Wochenendzeile |
| `ansichtEinst` | Leute, Regler, Sichern, Verbindung | Zahnrad |
| `ansichtInfo` | Betriebsanleitung, §1–§11 | aus den Einstellungen oder Erklär-Blättern |

Überlagerungen (`.blende`), gezeichnet in dieser Rangfolge: `foto`, `rechnung`, `erklaer`,
`blatt` (Sammel-Eingabe), `sicherBlatt`, `benennen`, `wechsler`, `fazitOffen`.

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
alle drei Stellen an; `orden.mjs` im Scratchpad prüft sie gegeneinander.

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
  nachgestellt in `tagneu.mjs` im Scratchpad).
- **Erklärungen sitzen im Kontext, nicht in der Anleitung.** Tipp auf eine Zahl öffnet ein kurzes
  Blatt mit Verweis in den passenden Paragrafen. Die Betriebsanleitung ist Nachschlagewerk,
  kein Einstieg. Jeder Paragraf hat einen Anker `p1` bis `p11`.
- **Das Eingabe-Tagebuch wird beim Abschließen eines Wochenendes gelöscht.** Gemessen macht es
  rund 81 % der Dateigröße aus und ist nach dem Abend wertlos: gelesen wird `ort.log` nur auf
  dem Zählbildschirm und für die Warnung vor der doppelten Runde. Die Getränkedaten bleiben
  vollständig, und der letzte Stand mit Tagebuch steht weiter in der Historie.
  Umgesetzt an drei Stellen, damit die Regel überall gilt: `weSchliessen()` räumt beim
  Abschließen auf, `migrieren()` bei jedem Laden für alle bereits abgeschlossenen Wochenenden
  (räumt also Altbestände nach), und `zusammenfuehren()` zum Schluss — sonst holt der Abgleich
  das Tagebuch von einem Gerät zurück, das den Abschluss noch nicht kennt.
  Mit dem 1-MB-Limit der Contents-API gerechnet: mit Tagebuch war bei 23 Wochenenden ≈ 9 Jahren
  Schluss, jetzt bei 117 ≈ 47 Jahren.

## Fallen

- **Klassennamen.** `.plus` ist der große Getränke-Knopf. Der Δ-Chip hieß früher ebenfalls
  `plus` und hat dessen Aussehen geerbt — die Tabelle war zerschossen. Deshalb heißen die
  Δ-Klassen jetzt `dplus`, `dminus`, `dnull`. Bei neuen Klassennamen auf Kollisionen achten.
- **Dateigrößen-Grenze.** Die GitHub-Contents-API liefert Inhalte nur bis 1 MB. Hochgerechnet
  reicht das ohne Tagebuch für Jahrzehnte. Wird es eng: alte Jahrgänge in eigene Dateien.
- **Escaping.** Namen kommen von Nutzern. Alles, was in HTML landet, muss durch `esc()`.
- **Das Foto-Zählen funktioniert auf GitHub Pages nicht.** Es ruft die Anthropic-API auf, was nur
  innerhalb eines Claude-Artefakts geht. Der Code ist noch da und meldet das ehrlich. Soll
  irgendwann über einen Zwischendienst zurückkommen oder ganz raus.
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
- **Mit der Fassung eine Notiz in `NOTIZEN` anlegen**, neueste zuerst, `{f, d, punkte}`. Die
  Einstellungen zeigen unter *Änderungen* die oberste offen und die beiden darunter hinter
  „Frühere Fassungen" (`NOTIZ_ANZAHL`, derzeit 3). Geschrieben wird in der Sprache der Runde,
  nicht in der des Quelltextes: was am Tisch auffiel, nicht welche Funktion angefasst wurde.
  Der Eintrag ganz oben **muss** zur laufenden `FASSUNG` gehören — `notizen.mjs` prüft das.
  Kein `<details>` dafür: `zeichnen()` baut die Seite bei jedem Abgleich neu auf, ein offenes
  `<details>` klappte dabei wieder zu. Deshalb hält `notizenOffen` den Zustand.
- **Die Betriebsanleitung mitpflegen.** Sie ist Teil der Datei (`ansichtInfo`), im Ton einer
  augenzwinkernden DIN-Norm. Wer eine Funktion ändert, ändert den Paragrafen mit.
- **Das Fangnetz nicht entfernen.** `zeichnen()` fängt Ausnahmen ab und zeigt einen
  Fehlerbildschirm statt einzufrieren. Eine App, die am Bierabend hängenbleibt, ist wertlos.
- **Nach Änderungen prüfen**, dass alle `data-tu`-Aktionen einen Handler im `tu`-Objekt haben —
  das war mehrfach die Fehlerquelle.
- **Nicht pushen ohne ausdrückliches Go.** Committen ist in Ordnung, `git push` erst nach
  expliziter Freigabe durch den Nutzer in diesem Gespräch.

## Ton

Die Oberfläche ist knapp und trocken, die Betriebsanleitung parodiert eine technische Norm
(„Der Betrieb an bereits schrägen Tischen erfolgt auf eigene Gefahr"). Keine Ausrufezeichen,
keine Emojis in der Oberfläche, kein Werbesprech. Optik: dunkles Zinn, Bierdeckel-Creme,
Malz-Akzent, bayerisches Rautenband.
