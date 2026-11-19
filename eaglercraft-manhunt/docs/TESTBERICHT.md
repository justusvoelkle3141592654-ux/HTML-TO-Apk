# Testbericht

Testumgebung: Headless Chromium (Playwright) mit Software-Rendering (SwiftShader), 4 CPU-Kerne.
Gesteuert wurde per Mausklicks, Tastatur und einem nur für Tests installierten Lua-„Bridge“-Mod, der Befehle
ausführt. Dieser Mod ist **nicht** im Release enthalten. Jeder Test lief in einem frischen Browserprofil,
sofern nicht anders angegeben.

Legende: **bestanden** = im Spiel ausgeführt und Ergebnis geprüft · **teilweise** = nur ein Teil prüfbar ·
**nicht getestet** = nicht im Spiel geprüft.

| # | Test | Ergebnis | Nachweis / Bemerkung |
|---|---|---|---|
| 1 | Eaglercraft startet weiterhin | bestanden | Titelbildschirm, Profil, Einzelspieler laden normal. |
| 2 | Manhunt-Welt lässt sich öffnen | bestanden | „Manhunt-Welt“ steht in der Weltliste und lädt. Engine wird automatisch platziert („Loaded template manhunt:engine“). |
| 3 | Startmenü erscheint automatisch | bestanden | Manhunt-Menü öffnet sich beim ersten Betreten (Screenshot). Ohne Lua-Client erscheint stattdessen der Dialog. |
| 4 | Rollenauswahl | bestanden | Klick im Menü → „Du bist jetzt Speedrunner“. Rolle bleibt nach dem Neuladen erhalten. |
| 5 | Hunter-Anzahl einstellbar | bestanden | Hunter-Bots 0 → 1 → 2 per Menü bzw. Trigger; Anzeige aktualisiert sich. Mehrere menschliche Hunter: siehe Nr. 17. |
| 6 | Startausrüstung | teilweise | Speedrunner-Kit geprüft (Holzschwert, Bogen mit Unendlichkeit, Pfeil, Brot). Das Hunter-Kit mit Kompass wurde nicht als Hunter-Spieler geprüft (eine Runde braucht einen Speedrunner, im Test gab es nur einen Spieler). |
| 7 | Hunter-Kiste | bestanden | Ohne Kompass: „Hunter-Arsenal is locked!“. Mit Ortungskompass in der Hand: öffnet, Stufe-0-Inhalt vorhanden. Gefundener Fehler (Rauchbomben wegen Stapelgröße nicht eingefügt) behoben. |
| 8 | Kompass verfolgt Speedrunner | teilweise | Der Mechanismus (Position in Lodestone-Ziel schreiben, Kompass in den Slot kopieren) wurde einzeln im Spiel geprüft. Der komplette Ablauf braucht zwei Spieler und war nicht testbar (siehe Nr. 17). |
| 9 | XP werden vergeben | bestanden | Diamanterz-Statistik → +40 XP; Überlebens-XP. Echtes Abbauen per Maus war im Headless-Browser nicht zuverlässig, deshalb wurde die Statistik-Objective gesetzt. |
| 10 | Levelaufstiege | bestanden | XP → Level 8 bzw. 34; Meldung „+1 Herz“ ab Level 10; Fähigkeit 2 ab Level 8. |
| 11 | Schwert-Upgrades ändern den Schaden | bestanden | Eisengolem (100 HP, keine Rüstung): Steinschwert + Schärfe I = 6,0 Schaden; nach Schärfe II = 6,5. Materialkosten abgezogen. |
| 12 | Bogen-Upgrades | bestanden | Kauf Stärke I + Flamme → Manhunt-Bogen hat Unendlichkeit, Stärke 1, Flamme 1. Pfeilschaden mit Stärke nicht gesondert gemessen. |
| 13 | Sonderwaffen | teilweise | Bestanden: Frostschwert (6 Schaden, Langsamkeit IV), Blitzschwert (Blitz, Abklingzeit wirkt), Explosionsschwert (Ziel ~19 Zusatzschaden, Angreifer geschützt, kein Blockschaden), Explosionsbogen (Treffer, Abklingzeit), Feuerbogen (Ziel brennt ~8 s), Teleportationsstab (Teleport, Ladung verbraucht), Rauchbombe (Wolke mit Blindheit/Langsamkeit), Geschwindigkeitstrank (Tempo II), Enterhaken (Zug 12 Blöcke zum Anker). Nicht getestet: Giftpfeile im Flug, Unsichtbarkeitstrank. Einschränkung: Umstehende erhielten durch die Explosion nur 1 Schaden. |
| 14 | Rüstungen | teilweise | Feuerschutz-Set: Set-Bonus Feuerresistenz aktiv; Schutz I auf getragene Rüstung angewendet. Läufer-, Schutz-, Schatten- und Jägerrüstung nicht einzeln geprüft. |
| 15 | M-Menü | bestanden | Alle Reiter öffnen; Rollen-, Einstellungs- und Startknöpfe per Klick getestet; das Spiel läuft bei offenem Menü weiter. |
| 16 | Einzelspieler | bestanden | Alle obigen Tests liefen im Einzelspieler. |
| 17 | Multiplayer | teilweise | „Open to LAN“ erzeugt einen Relay-Code. Der Beitritt eines zweiten Clients scheiterte in der Testumgebung an der WebRTC-Verbindung. Dabei festgestellt: Eaglercraft pausiert Lua-Mods in geteilten Welten. Darauf hin wurden Fallback-HUD, Dialog-Menü und ein serverseitiger Enterhaken umgesetzt. |
| 18 | Hunter-Bots verfolgen und bekämpfen | bestanden | Bot (Normal) spawnt nach dem Vorsprung, verfolgt den Speedrunner und tötet ihn („slain by Hunter-Bot“). Aufhol-Teleport und die Stufen Einfach/Schwer/Experte nicht einzeln geprüft. |
| 19 | Siegbedingungen | bestanden | Speedrunner tot → „Hunter gewinnen“; Drache durch Spieler getötet → „Speedrunner gewinnen“. Ergebnisanzeige mit Dauer, Verlierer, Level, XP, Kills, Waffen; „Zurück zur Lobby“ funktioniert. |
| 20 | Speicherung | bestanden | Welt verlassen und neu betreten: Einstellungen, Rolle und Status erhalten, die Engine läuft weiter. |

## Weitere automatische Prüfungen

- **Syntax-Scan aller Befehlsblöcke:** Debug-Build mit Ausgabe-Tracking, jedes Engine-Modul einmal ausgelöst,
  danach die letzte Ausgabe aller 1.835 Blöcke ausgelesen. Ergebnis: 0 Syntaxfehler. Die 38 übrigen
  Meldungen sind normale Laufzeitmeldungen („Tag nicht vorhanden“, „kein Spieler gefunden“).
- **Leistung:** ohne Engine ca. 4 ms pro Server-Tick; mit Engine ca. 23 ms (Lobby) bzw. 35–37 ms
  (laufende Runde); Ziel unter 50 ms.

## Während der Tests gefundene und behobene Fehler

1. `.mcfunction`-Dateien lassen den Welt-Start abstürzen → Umstieg auf die Befehlsblock-Engine.
2. Engine mit 1.757 Befehlen pro Tick: 190 ms pro Tick → modularer Aufbau (Hauptschleife ~90 Befehle).
3. Lua-Menü pausierte den Einzelspieler-Server → `pause = false`.
4. Ungültige Selektoren mit doppeltem `scores=` (Tod/Ausscheiden) → zusammengeführt.
5. `execute … unless if score` (Syntaxfehler) → korrigiert.
6. Welt fehlte in der Weltliste (`worlds_list.txt`) → wird jetzt eingetragen.
7. Explosion ohne `damage_type` richtete keinen Schaden an → ergänzt.
8. Tränke nicht stapelbar → Truhe konnte sie nicht befüllen → `max_stack_size`.
9. Trank-Namen „Uncraftable Potion“ → `custom_name`.
10. Sync-Zeilen im Chat bei pausiertem Lua-Mod → kurze „Lease“ für die Mod-Kennung.
11. `execute on owner` funktioniert beim Angelhaken nicht → nächster Spieler mit Enterhaken.
