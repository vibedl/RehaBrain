# Projektplan: Kopf-Fit, ein kostenloses Hirnleistungstraining mit Kartenspielen

*Arbeitstitel. Stand: 16.09.2026, Planung abgeschlossen (Entscheidungen in Abschnitt 8), noch kein Code.*

Die Idee: ein Trainingsprogramm nach dem Vorbild von RehaCom (Aufmerksamkeit, Gedächtnis, Planen), aber kostenlos, offline, ohne API-Keys und auf Mac, Windows und Tablet nutzbar. Dazu kommt eine Stufenleiter an Kartenspielen, von „Paare finden“ bis Skat.

---

## 1. Rahmenbedingungen

| Punkt | Entscheidung | Warum |
|---|---|---|
| Kosten | 0 €, keine KI-API, keine Cloud | ausdrücklicher Wunsch |
| Plattform | Web-App (HTML/JS), installierbar als PWA | läuft auf Mac, Windows, iPad und Android, auch offline |
| Daten | nur lokal im Gerät (IndexedDB) und als Export-Datei | Datenschutz, keine Server |
| Zielgruppe | Menschen nach Schlaganfall und mit Parkinson (plus Angehörige) | große Schrift, große Trefferflächen, wenig Text, keine Hektik (Details in 8.) |
| Rechtliches | **kein Medizinprodukt**, kein Name „RehaCom“ | Marke von HASOMED; Therapie-Versprechen würden MDR-Zulassung erfordern. Formulierung: „Gedächtnis- und Konzentrationstraining“, Hinweis „ersetzt keine Therapie“. |

---

## 2. Barrierefreiheit (gilt für alles)

- Schriftgröße mindestens 20 px, Buttons mindestens 64 × 64 px, hoher Kontrast; umschaltbar auf „extra groß“
- **Einhand-Bedienung**: alles mit Maus, Touch oder nur Leertaste und Pfeiltasten spielbar (wichtig bei Halbseitenlähmung)
- Neglect-Option: Inhalte bei Bedarf nur mittig anzeigen oder die vernachlässigte Seite gezielt einbeziehen
- kein Zeitdruck als Standard; Zeitlimits nur optional
- Anleitung vor jeder Übung vorgelesen (kostenlose Browser-Sprachausgabe) und mit Beispielrunde
- Fehler werden nie rot bestraft, sondern freundlich korrigiert; Sitzungen von 10–20 Minuten mit Pausenhinweis

---

## 3. Trainingsmodule

Jedes Modul hat **Stufen 1–20**. Die Schwierigkeit passt sich automatisch an: bei ≥ 80 % Treffern geht es eine Stufe hoch, bei < 50 % eine runter, Auswertung nach jedem Block.

### A. Aufmerksamkeit
| Modul | Aufgabe | Schwieriger wird es durch |
|---|---|---|
| Reaktion | Taste drücken, sobald ein Symbol erscheint | kürzere Anzeige, Ablenker |
| Wachsamkeit | nur bei einem bestimmten Zielreiz reagieren (Go/No-Go) | seltenere Ziele, längere Dauer |
| Suchbild | alle Äpfel unter vielen Objekten finden | mehr, ähnlichere Objekte |
| Geteilte Aufmerksamkeit | zwei Dinge gleichzeitig beobachten (Ampel und Ton) | schnelleres Tempo |

### B. Gedächtnis
| Modul | Aufgabe |
|---|---|
| Zahlen merken | Zahlenfolge merken, vorwärts oder rückwärts eingeben |
| Einkaufsliste | Wörter oder Bilder merken und später wiedererkennen |
| Wege merken | Reihenfolge aufleuchtender Felder nachtippen (Corsi-Prinzip) |
| Gesichter & Namen | Personen und ihre Namen zuordnen |
| Alltag | Uhrzeiten, Termine, PIN-artige Codes merken |

### C. Planen & Denken (exekutive Funktionen)
| Modul | Aufgabe |
|---|---|
| Einkaufen | mit begrenztem Geld eine Liste einkaufen |
| Turm | Scheiben in möglichst wenigen Zügen umschichten |
| Regeln wechseln | nach Farbe sortieren, plötzlich nach Form |
| Reihenfolgen | Alltagsabläufe (Kaffee kochen) richtig ordnen |

### D. Sehen & Raum
| Modul | Aufgabe |
|---|---|
| Linien halbieren / Durchstreichen | Neglect-Screening als Übung |
| Blicksprung | Zielen am Bildschirmrand folgen |
| Figuren vergleichen | gedrehte Formen erkennen |

---

## 4. Kartenspiel-Leiter (das Herzstück)

Kartenspiele trainieren Gedächtnis, Aufmerksamkeit und Planung gleichzeitig und machen Spaß, das motiviert zum Weitermachen. Das Deck: wahlweise **französisches Blatt** oder **deutsches Blatt** (Eichel, Grün, Rot, Schellen), mit extra großen Karten.

| Stufe | Spiel | Trainiert | Gegner |
|---|---|---|---|
| 1 | **Farben sortieren**: Karten nach Farbe oder Wert ablegen | Wahrnehmung, Kategorien | – |
| 2 | **Paare finden (Memory)**, 6 bis 32 Karten | Kurzzeitgedächtnis | – |
| 3 | **Höher oder tiefer** | Zahlenverständnis, Aufmerksamkeit | – |
| 4 | **Schnipp-Schnapp**: gleiche Karte erkennen und tippen | Reaktion, Aufmerksamkeit | Computer |
| 5 | **Mau-Mau** | Regeln befolgen, Farbe/Wert abgleichen | 1–3 Computer |
| 6 | **Patience (Klondike, Freecell)** | Planen, Vorausdenken | – |
| 7 | **Rommé (vereinfacht)** | Kombinationen bilden, Kategorien | Computer |
| 8 | **17 und 4** | Kopfrechnen, Risiko abwägen | Computer (Bank) |
| 9 | **Schafkopf/Doppelkopf light** oder **Sechsundsechzig** | Stiche, Trumpf, Punkte zählen | Computer |
| 10 | **Skat** | alles: Karten merken, Reizen, Planen, Zählen | 2 Computer |

### Skat im Detail
Wird in drei Teilschritten gebaut, damit man langsam hineinwächst:
1. **Skat-Schule**: Kartenwerte zählen (Ass 11, Zehn 10 …), Trumpf erkennen, „Wer gewinnt den Stich?“ als Quiz
2. **Offener Skat**: vollständige Partie, aber mit Hilfen: gespielte Karten sichtbar, Tipp-Knopf, Zug zurücknehmen
3. **Echter Skat** nach der Internationalen Skatordnung: Reizen, Skat aufnehmen und drücken, Farb-/Grand-/Nullspiele, Hand, Schneider/Schwarz, Punkteliste

**Computer-Gegner ohne KI-API**: regelbasiert in drei Stärken:
- *Anfänger*: spielt legale Karten, leicht zufällig
- *Vereinsspieler*: feste Heuristiken (Trumpf ziehen, Asse schmieren, Partner-Signale)
- *Profi*: merkt sich gespielte Karten und rechnet mögliche Verteilungen durch (Monte-Carlo-Simulation, läuft lokal)

---

## 5. Auswertung & Motivation

- **Einstufungstest** (ca. 15 Min.) beim ersten Start legt die Startstufen fest
- **Tagesplan**: 3–4 Übungen plus ein Kartenspiel zur Belohnung; automatisch oder von Angehörigen/Therapeuten zusammengestellt
- **Verlauf**: einfache Kurven pro Bereich („Gedächtnis: +3 Stufen in 4 Wochen“)
- **PDF-Bericht** zum Mitnehmen in Ergotherapie oder Arztpraxis
- Mehrere Profile auf einem Gerät (z. B. Oma und Opa), optional PIN für den Angehörigen-Bereich
- Belohnungen: Serie an Trainingstagen, keine Ranglisten und kein Vergleich mit anderen

---

## 6. Technik

- **Vanilla TypeScript und Vite**, kein Framework nötig; Karten als SVG (skalieren scharf)
- **PWA**: einmal öffnen, „Zum Home-Bildschirm“ bzw. „Installieren“, läuft danach offline
- Kostenloses Hosting auf **GitHub Pages**, oder die Datei lokal öffnen
- Struktur:
  ```
  hirntraining/
    src/core/       Profile, Adaptivität, Speicherung, Sprachausgabe
    src/modules/    je Übung ein Ordner (gleiche Schnittstelle: start, stufe, auswerten)
    src/cards/      Deck, Regeln-Engine, KI-Gegner, Spiele
    src/ui/         große Buttons, Tafeln, Verlauf
    tests/          Regeltests (v. a. Skat: Reizwerte, Spielwertberechnung)
  ```
- Die Skat-Regeln werden mit **automatischen Tests** abgesichert (Spielwerte, Reizen, Überreizen), weil Fehler dort sofort auffallen und frustrieren

---

## 7. Umsetzung in Etappen

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| **1 – Grundgerüst** | Profile, Barrierefreiheits-Einstellungen, Adaptivität, Speicherung | leere App, installierbar |
| **2 – Erste Übungen** | Reaktion, Zahlen merken, Wege merken, Suchbild | erste nutzbare Version |
| **3 – Karten Stufe 1–4** | Deck, Sortieren, Memory, Höher/Tiefer, Schnipp-Schnapp | Spaß-Teil startet |
| **4 – Auswertung** | Einstufungstest, Tagesplan, Verlauf, PDF-Bericht | vollständiges Trainingsprogramm |
| **5 – Karten Stufe 5–8** | Mau-Mau, Patience, Rommé, 17 und 4 und die Gegner-Engine | |
| **6 – Restliche Module** | Planen & Denken, Sehen & Raum | alle vier Bereiche vollständig |
| **7 – Skat** | Skat-Schule, offener Skat, echter Skat mit 3 Gegnerstärken | Krönung |
| **8 – Feinschliff** | Test mit echten Nutzer:innen (Angehörige, ggf. Ergotherapeut), Texte, Hosting | Version 1.0 |

Etappen 1–3 sind die sinnvolle erste Runde: schnell etwas zum Ausprobieren in der Hand.

---

## 8. Entscheidungen (16.09.2026)

| Frage | Entscheidung |
|---|---|
| Zielgruppe | allgemein für **Schlaganfall- und Parkinson-Patient:innen** |
| Kartenblatt | **französisch und deutsch**, in den Einstellungen wählbar |
| Skat | ISkO **plus Ramsch und Bock** (je einzeln zuschaltbar) |
| Geräte | **Tablet und Computer** gleichwertig |
| Auslieferung | **Web-App (PWA)**, zuerst statisch, Server erst in Ausbaustufe 2 (siehe 9.) |

### Zusätzliche Anforderungen für Parkinson
- **Zittern (Tremor):** große Trefferflächen mit Abstand dazwischen. Ein Antippen zählt erst beim Loslassen, und wer mit dem Finger leicht verrutscht, trifft trotzdem. Mehrfach-Tipps innerhalb von 300 ms zählen nur einmal.
- **Kein Ziehen und Ablegen als Pflicht:** Jede Karte lässt sich auch mit *antippen → Ziel antippen* bewegen. Doppelklick wird nirgends vorausgesetzt.
- **Verlangsamung (Bradykinese):** Reaktionsübungen werten an der persönlichen Bestzeit, nicht an festen Grenzen. Tages-Schwankungen („On/Off-Phasen“) werden bei der Stufenanpassung nicht als Rückschritt gewertet, man kann den Tag auch als „schlechten Tag“ markieren.
- **Doppelaufgaben** (Denken und gleichzeitig reagieren) als eigener Schwerpunkt, weil sie bei Parkinson besonders beeinträchtigt sind
- **Leise Stimme / Sprechstörung:** nie Spracheingabe voraussetzen

### Zusätzliche Anforderungen für Schlaganfall
- **Sprachstörung (Aphasie):** jede Anleitung auch als Bild bzw. vorgemachtes Beispiel, kurze Sätze, Vorlesen per Knopf
- **Gesichtsfeldausfall / Neglect:** wichtige Bedienelemente mittig; Einstellung, auf welcher Seite trainiert wird
- **Einhand-Bedienung** (siehe 2.)

### Skat-Zusatzregeln
- **Ramsch:** wird gespielt, wenn alle passen; es gewinnt, wer die wenigsten Augen hat; optional „Schieberamsch“ und Jungfrau-Wertung
- **Bock:** nach Kontra/Re, 60:60 oder verlorenem Spiel mit hohem Grundwert wird eine Bockrunde ausgelöst, und alle Spiele zählen dann doppelt. Die Auslöser sind einstellbar.
- Punkteliste mit gekennzeichneten Bock- und Ramschrunden

---

## 9. Auslieferung: erst Web-App, später Server

**Stufe 1: statische PWA (sofort, 0 €)**
- Die App besteht nur aus HTML/JS/CSS-Dateien, ein eigener Server-Code ist nicht nötig.
- Kostenlos hosten auf GitHub Pages, Netlify oder Cloudflare Pages, alternativ später auf jedem eigenen Webspace
- Im Browser öffnen und installieren, danach läuft sie offline. Trainingsdaten bleiben im Gerät, Sicherung per Export-Datei.
- **Vorteil:** Es werden keine Gesundheitsdaten auf einem Server gespeichert, dadurch ist der Datenschutz sehr einfach.

**Stufe 2: mit Server (nur bei Bedarf)**
Sinnvoll erst, wenn gebraucht wird:
- Training auf Tablet *und* Computer mit gemeinsamem Fortschritt
- Angehörige oder Therapeut:innen, die aus der Ferne Pläne erstellen und Ergebnisse sehen

Dann gilt:
- kleiner eigener Server bei einem deutschen Anbieter (z. B. Hetzner, ca. 5 €/Monat) mit einer schlanken API (Node oder Python) und einer Datenbank (SQLite/Postgres)
- Die App-Architektur wird von Anfang an so gebaut, dass die Speicherschicht austauschbar ist (lokal ↔ Server). Dann ist Stufe 2 ein Zusatz statt eines Umbaus.
- **Achtung Datenschutz:** Trainingsergebnisse von Patient:innen sind Gesundheitsdaten (Art. 9 DSGVO). Nötig sind Hosting in der EU, Verschlüsselung, eine Datenschutzerklärung, eine Einwilligung und ein Auftragsverarbeitungsvertrag. Das ist machbar, sollte aber vor dem Start geprüft werden.
