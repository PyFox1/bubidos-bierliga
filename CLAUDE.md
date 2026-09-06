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

**Navigation**: `stapel` merkt bis zu zwölf Schritte, der Zurück-Pfeil ruft `zurueckNavi()`.
`geheArchiv` und `geheZaehlen` sind Heimatziele und leeren den Stapel.

**Bedienmuster**: Alle Klicks laufen über `data-tu="name"` und einen gleichnamigen Handler im
`tu`-Objekt. Gefährliche Aktionen nutzen `gefahr()` — zweimal tippen, Rücksetzung nach 4 s.

## Landkarte der wichtigsten Funktionen

- `berechnen()` — rechnet die gesamte Historie neu: Punkte, Siege, BE-Summen, Höchststände
- `fazitVon(e)` — Wochenendbilanz samt Orden
- `rangDaten()` / `rangZeilen()` — die sortierbare Tabelle, Spalten in `SPALTEN`
- `laden()` / `sichern()` / `schreiben()` — GitHub-Anbindung
- `zeichnen()` — Fangnetz, ruft `zeichnenRoh()`
- `ERKLAERUNGEN` — die Erklär-Blätter, jedes mit Verweis auf einen Paragrafen-Anker

## Speicher-Ablauf

1. `sichern()` merkt sich den Stand lokal und plant das Schreiben in **2,5 Sekunden** ein.
   Weitere Änderungen verschieben den Termin — eine Serie von Tipps wird ein Commit.
   `sichern({sofort:true})` schreibt ohne Verzögerung.
2. `schreiben()` schickt die Datei mit dem bekannten `sha`. Antwortet GitHub mit **409**, war
   jemand schneller: Der fremde Stand wird geladen, der eigene daraufgesetzt, erneut geschrieben.
   Beide Fassungen stehen dann in der Historie — es geht nichts verloren.
3. Alle 25 Sekunden wird der `sha` verglichen und bei Änderung neu geladen.
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

## Entscheidungen und ihre Gründe

Diese Punkte wurden ausführlich diskutiert. Bitte nicht ohne Rückfrage umdrehen.

- **Gewertet wird der Tag, nicht die Location.** Die Gruppe zieht an einem Abend durch bis zu
  fünf Kneipen. Jede Station einzeln zu werten würde die Tabelle wild schwanken lassen.
- **Der Deckel ist ab Werk aus.** Er war ursprünglich an (8 BE je Tag), wurde auf Wunsch
  abgeschaltet. Er bleibt als Regler erhalten. Ohne ihn führt die Tabelle, wer am meisten trinkt.
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
- **Erklärungen sitzen im Kontext, nicht in der Anleitung.** Tipp auf eine Zahl öffnet ein kurzes
  Blatt mit Verweis in den passenden Paragrafen. Die Betriebsanleitung ist Nachschlagewerk,
  kein Einstieg. Jeder Paragraf hat einen Anker `p1` bis `p11`.
- **Das Eingabe-Tagebuch wird beim Abschließen eines Wochenendes gelöscht.** Es macht 70 % der
  Dateigröße aus und ist nach dem Abend wertlos. Die Getränkedaten bleiben vollständig.

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
- **Kein `localStorage` für die eigentlichen Daten.** Nur Token, Gerätekennung und eine
  Notfallkopie liegen lokal. Die Wahrheit steht immer im Repository.

## Gewohnheiten

- **Die Fassungskennung `FASSUNG` bei jeder Änderung hochzählen.** Sie steht in den Einstellungen
  und im Fuß der Anleitung und dient dazu, veraltete Versionen zu erkennen.
- **Die Betriebsanleitung mitpflegen.** Sie ist Teil der Datei (`ansichtInfo`), im Ton einer
  augenzwinkernden DIN-Norm. Wer eine Funktion ändert, ändert den Paragrafen mit.
- **Das Fangnetz nicht entfernen.** `zeichnen()` fängt Ausnahmen ab und zeigt einen
  Fehlerbildschirm statt einzufrieren. Eine App, die am Bierabend hängenbleibt, ist wertlos.
- **Nach Änderungen prüfen**, dass alle `data-tu`-Aktionen einen Handler im `tu`-Objekt haben —
  das war mehrfach die Fehlerquelle.

## Ton

Die Oberfläche ist knapp und trocken, die Betriebsanleitung parodiert eine technische Norm
(„Der Betrieb an bereits schrägen Tischen erfolgt auf eigene Gefahr"). Keine Ausrufezeichen,
keine Emojis in der Oberfläche, kein Werbesprech. Optik: dunkles Zinn, Bierdeckel-Creme,
Malz-Akzent, bayerisches Rautenband.
