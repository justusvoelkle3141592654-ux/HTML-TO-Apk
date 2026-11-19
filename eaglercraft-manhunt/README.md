# Eaglercraft 26.2 – Manhunt

Manhunt-Edition von **Eaglercraft 26.2** (Minecraft Java 26.2 im Browser). Speedrunner gegen Hunter:
Der Speedrunner muss den Enderdrachen besiegen, die Hunter müssen den Speedrunner töten.
Die Mod ist fest eingebaut und von Anfang an aktiv. Nichts muss installiert werden.

## Schnellstart

1. `release/Eaglercraft-Manhunt.html` herunterladen und im Browser öffnen (aktueller Chrome, Edge oder Firefox).
   Die Datei funktioniert offline.
2. Profil bestätigen („Done“).
3. **Einzelspieler → „Manhunt-Welt“ → Play Selected World.**
   Beim ersten Betreten richtet sich Manhunt automatisch ein (ca. 5 Sekunden, Chat-Meldung
   „Manhunt-Engine installiert“). Danach öffnet sich das Manhunt-Menü.
4. Rolle wählen, Hunter-Bots und Regeln einstellen, **„Runde starten“**.

| Taste | Funktion |
|---|---|
| **M** | Manhunt-Menü (12 Bereiche) |
| **R** / **V** | Fähigkeit 1 / Fähigkeit 2 |
| **ESC → Manhunt** oder **G** (Quick Actions) | Ersatzmenü (Dialog), funktioniert auch im Multiplayer |

Die „Manhunt-Welt“ wird beim allerersten Öffnen der Datei mit zufälligem Seed angelegt und wie jede
Minecraft-Welt gespeichert. Auch eine selbst erstellte Welt wird automatisch zur Manhunt-Welt,
wenn beim Erstellen **„Allow Cheats: ON“** gewählt wurde (die automatische Einrichtung braucht Befehlsrechte).

## Als Webserver

Siehe `web/README.md`: `node web/server.js` startet einen Server auf Port 8080.

## Multiplayer (Shared World)

- **Host:** ESC → *Open to LAN* → *Relay LAN: ON* → *Apply Changes*. Den angezeigten Join-Code weitergeben.
- **Gäste:** Einzelspieler → *Join LAN World* → Code eingeben.
- Alle Spielregeln (Rollen, Kompass, XP, Upgrades, Waffen, Truhe, Bots, Siegbedingungen) laufen auf dem
  integrierten Server des Hosts und gelten für alle Spieler.
- **Wichtig:** Eaglercraft pausiert Lua-Mods, sobald eine Welt geteilt wird (Meldung im Log:
  „mods paused: your world is open to LAN“). Das große Menü (M), das grafische HUD und die Tasten R/V
  stehen dann nicht zur Verfügung. Stattdessen gibt es:
  - **ESC → Manhunt** bzw. **Taste G**: Dialog-Menü mit Rollen, Runde, Regeln, Upgrades, Sonderwaffen,
    Rüstung, Fähigkeiten (inkl. „Fähigkeit benutzen“) und Weltoptionen.
  - **Actionbar-HUD**: Rolle, Level, XP, Leben bzw. Zielkoordinaten.
- Gäste sollten ebenfalls diese HTML-Datei benutzen, damit die eigenen Waffen-Icons angezeigt werden.
- Bestehende öffentliche Eaglercraft-Server unterstützen die Mod **nicht**. Sie funktioniert nur in
  Welten, die mit dieser Datei gehostet werden.

## Funktionsübersicht

| Bereich | Umsetzung |
|---|---|
| Rollen | Speedrunner, Hunter, Zuschauer; vor jeder Runde frei wählbar, Host kann zufällig verteilen. Mehrere Speedrunner möglich. Während einer Runde kann man als Hunter einsteigen. |
| Hunter-Anzahl | Beliebig viele menschliche Hunter plus 0–5 Hunter-Bots. |
| Startausrüstung | Holzschwert (Upgrade-fähig), Bogen mit Unendlichkeit + 1 Pfeil, Brot; Hunter zusätzlich den Ortungskompass. Kit-Gegenstände haben „Fluch des Verschwindens“ und werden beim Respawn neu ausgegeben. |
| Ortungskompass | Zeigt auf den nächsten Speedrunner in derselben Dimension (Lodestone-Ziel, alle Hunter reihum aktualisiert). Ist kein Speedrunner in der Dimension, bleibt die letzte bekannte Position erhalten. HUD: Pfeil, Entfernung, Name. |
| Hunter-Kiste | „Hunter-Arsenal“ neben dem Spawn, mit Minecraft-Schloss: öffnet sich nur mit dem Ortungskompass in der Hand. Inhalte in 3 Stufen (alle 10 Minuten aufgerüstet, alle 5 Minuten nachgefüllt). Abbau-Schutz: Bedrock darunter, Abbaulähmung für Speedrunner daneben, Wiederaufbau bei Zerstörung, herausgefallene Arsenal-Items werden entfernt. |
| Level 1–50 | XP durch Erze, Holz, Mobs, Spieler, Schaden, Überleben/Verfolgen und Meilensteine (Nether, Festung, Bastion, Stronghold, Ende). Benötigte XP: 40 × Level + 200 (Level 5: 400). XP-Multiplikator einstellbar. |
| Level-Belohnungen | Freischaltung aller Upgrades und Sonderwaffen nach Level, Fähigkeit 2 ab Level 8, +1 Herz max. Gesundheit bei Level 10/20/30/40/50. |
| Schwert-Upgrades | Schärfe I–V bei Level 5/10/15/20/25, zusätzlich VI–VIII (Level 30/40/50, mit Verbrennung/Plünderung) und Material Stein/Eisen/Diamant. Kosten in Eisen/Diamanten werden aus dem Inventar entfernt. |
| Bogen-Upgrades | Stärke I–V, Schlag I–II, Flamme, Unendlichkeit (immer). Schnellladen: Bögen haben in dieser Version keine Ladeverzauberung, daher gibt es die **Repetierarmbrust** (Schnellladen III, Durchschuss II). |
| Sonderwaffen (11) | Explosionsbogen, Teleportationsstab, Blitzschwert, Frostschwert, Feuerbogen, Rauchbombe, Explosionsschwert, Giftpfeile, Enterhaken, Unsichtbarkeits- und Geschwindigkeitstrank. Jede mit eigenem Icon, Namen, Beschreibung, Wirkung und Begrenzung (Abklingzeit, Ladungen oder Stückzahl). Der Enterhaken arbeitet serverseitig und funktioniert daher auch im Multiplayer. |
| Rüstung | Schutz-Upgrade I–IV für die getragene Rüstung (kostenlos auf neue Rüstung übertragbar) und 5 Spezialsets: Läufer- (Tempo), Schutz-, Feuerschutz- (Set-Bonus Feuerresistenz), Schatten- (Schleichen = unsichtbar) und Jägerrüstung (Speedrunner in 24 Blöcken leuchten). |
| Fähigkeiten | Speedrunner: Sprintschub, Schattenschritt, Fluchtsprung. Hunter: Ortungspuls, Jagdfieber, Kampfschrei. Zwei Slots frei belegbar, Abklingzeiten; im Menü an/aus und Abklingzeit-Faktor einstellbar. |
| Hunter-Bots | Zombies (Nahkampf) und Skelette (Bogen) mit Spieler-Kopf, Hunter-Team-Zugehörigkeit (greifen nur Speedrunner an) und Ausrüstung je Schwierigkeit: Einfach, Normal, Schwer, Experte (Leben, Tempo, Sichtweite, Waffen, Regeneration). Vanilla-Wegfindung; Ziel erkennen nur mit Sichtkontakt. Bei großer Entfernung holen sie auf (Teleport ~28 Blöcke hinter einen Speedrunner, Abstand je nach Schwierigkeit). |
| Siegbedingungen | Speedrunner gewinnt, wenn ein Spieler den Enderdrachen tötet. Hunter gewinnen, wenn alle Speedrunner keine Leben mehr haben (Leben 1–3 einstellbar) oder ein optionales Zeitlimit abläuft. Ergebnis: Gewinner, Verlierer, Dauer, Level, XP, Kills, Mob-Kills, benutzte Waffen; danach „Zurück zur Lobby“ für eine neue Runde. |
| Menü (M) | Übersicht, Rollen, Hunter-Einstellungen, Level, Schwert, Bogen, Sonderwaffen, Rüstung, Fähigkeiten, Spielregeln, Anzeige (HUD an/aus, Größe, Position, Zielpfeil, Abklingzeiten, XP-Einblendungen, Sounds), Welt (Speichern, Tag/Wetter/Schwierigkeit, Lobby verlegen, Arsenal neu aufbauen, Daten zurücksetzen, Engine neu installieren). |
| HUD | Rolle, Rundenzeit/Vorsprung, Level, XP-Balken „XP: 250 / 400“, Lebenspunkte, Leben/Kills, Fähigkeiten mit Abklingzeit, Spezialwaffen-Abklingzeit, Zielrichtung und -entfernung (Hunter), XP-Einblendungen. |
| Speichern | Welt, Einstellungen, Rollen, Level/XP, Upgrades und Rundenstatus liegen in der Welt (Scoreboards) und werden mit der Welt automatisch gespeichert. Eine neue Runde setzt alle rundenbezogenen Werte zurück. Anzeige-Einstellungen speichert der Client. |

## Technische Umsetzung

Analyse der gelieferten Datei:

- `eaglercraft-26.2-fe8f1237.html`, „Eaglercraft 26.2 (zeus/master)“, Minecraft-Version 26.2
  (Protokoll 776, Data-Pack-Format 107). Der Java-Code ist per TeaVM nach WebAssembly-GC kompiliert
  (Client 107 MB, integrierter Server 42 MB) und liegt ohne Quellcode in der Datei.
- Alle Assets und der Vanilla-Datapack liegen im EPK-Archiv `eag-inline-assets` (19.514 Dateien),
  das Client und integrierter Server lesen.
- Welten, Optionen und Lua-Mods liegen in IndexedDB (`…_worlds`, Schlüssel = Pfad).
- **Wichtiger Befund:** Der integrierte Server kann keine `.mcfunction`-Dateien laden. Schon eine einzige
  Funktionsdatei lässt das Laden der Welt abstürzen („CompletableFuture observed before completion“).
  Andere Datapack-Inhalte (Verzauberungen, Dialoge, Prädikate, Item-Modifier, Structures, Tags) funktionieren.

Darauf aufbauend besteht die Mod aus vier Teilen:

1. **Eingebauter Datapack + Ressourcen** (im EPK-Archiv, damit in jeder Welt aktiv):
   datengetriebene Verzauberungen für die Sonderwaffen, Dialog-Menü, Prädikate, Item-Modifier,
   eigene Item-Icons und -Modelle.
2. **Befehlsblock-Engine** (`data/manhunt/structure/engine.nbt`, ca. 1.800 Befehlsblöcke) als Ersatz für
   Funktionen. Eine Hauptschleife (~90 Befehle pro Tick) startet bei Bedarf Impuls-Module (Käufe,
   Rundenstart, XP alle 10 Ticks, Wartung jeden 20. Tick usw.). Die Engine liegt unzerstörbar unter dem
   Spawn auf Höhe −64 in dauerhaft geladenen Chunks.
3. **Lua-Client-Mod** (Eaglercraft „Zeus“-Mod-System): HUD, Menü (M), Ergebnisanzeige, Tasten R/V,
   automatische Einrichtung (platziert die Engine beim ersten Betreten). Der Client empfängt den Spielstand
   über unsichtbare Chatzeilen und sendet Aktionen über `/trigger`.
4. **Shell-Skript** in der HTML: installiert bzw. aktualisiert den Lua-Mod und legt beim ersten Start die
   „Manhunt-Welt“ an.

## Einschränkungen

- **Multiplayer:** In geteilten Welten pausiert Eaglercraft Lua-Mods. Dann gelten Dialog-Menü und
  Actionbar-HUD (siehe oben). Ein echter Mehrspieler-Test war in der Testumgebung nicht möglich,
  weil WebRTC-Verbindungen dort nicht zustande kommen (LAN-Raum und Join-Code wurden erfolgreich erzeugt).
- **Bots** sind Mobs (Zombie/Skelett), keine echten Spieler. Sie bauen und graben nicht, betreten keine
  Portale selbstständig (das Aufholen per Teleport bringt sie in die Dimension des Speedrunners) und
  verschwinden auf „Friedlich“ (die Engine stellt beim Rundenstart dann auf „Einfach“ und spawnt auf „Friedlich“ keine Bots).
- **Kompass:** Er zeigt auf die letzte gemessene Position. In einer anderen Dimension dreht er sich wie ein
  normaler Lodestone-Kompass, bis ein Speedrunner in der eigenen Dimension gefunden wird.
- **Drachensieg** zählt, wenn ein Spieler den Drachen tötet (Statistik `killed:ender_dragon`).
  Ein Tod des Drachen ohne Spieler-Kill (z. B. nur durch eine Bett-Explosion) wird nicht erkannt.
  Ist der Drache in einer Welt schon besiegt, braucht eine neue Runde mit Drache eine neue Welt.
- **Schutz-Upgrade** wirkt auf die beim Kauf getragene Rüstung. Für neue Rüstung gibt es den kostenlosen
  Knopf „Auf neue Rüstung anwenden“.
- **Explosionsschwert/-bogen:** Die Explosion trifft das Ziel stark (gemessen ca. 19 Zusatzschaden) und schleudert zurück. Kreaturen direkt daneben erhielten im Test nur 1 Schaden; ein echter Flächenschaden auf Umstehende ist damit nicht gegeben.
- **Teleportationsstab** teleportiert zufällig (wie Chorusfrucht) im Umkreis von 12 Blöcken, nicht gezielt.
- **Unsichtbarkeit** lässt (wie in Vanilla) getragene Rüstung sichtbar.
- **Abklingzeit Spezialschwerter** wird über den Statuseffekt „Pech“ umgesetzt, der im Inventar sichtbar ist.
- **Automatische Einrichtung** braucht Befehlsrechte („Allow Cheats: ON“ oder LAN mit Cheats).
  Die mitgelieferte Manhunt-Welt ist so angelegt.
- **Leistung:** In der Testumgebung (Software-Rendering, 4 CPU-Kerne) lag die Server-Tick-Zeit ohne Engine
  bei ca. 4 ms, mit Engine bei ca. 23 ms in der Lobby und ca. 37 ms im Mittel kurz nach einem Rundenstart
  (Ziel: unter 50 ms). Auf schwachen Geräten kann die Engine spürbar sein.

## Dateien

| Pfad | Inhalt |
|---|---|
| `release/Eaglercraft-Manhunt.html` | Fertige Manhunt-Version, eine Datei, alles eingebaut |
| `release/manhunt-pack.zip` | Datapack + Ressourcen als lose Dateien (zur Ansicht) |
| `release/manhunt-mod.zip` | Der Lua-Client-Mod (ist in der HTML enthalten) |
| `src/shared/` | Gemeinsame Spielwerte (Level, Kosten, Waffen, Fähigkeiten) und Item-Definitionen |
| `src/engine/engine.js` | Generator der Befehlsblock-Engine |
| `src/pack/` | Statische Datapack-Dateien (Verzauberungen, Prädikate, Item-Modifier) |
| `src/mod/main.lua` | Lua-Client-Mod |
| `src/shell/manhunt-shell.js` | Installation von Mod und Welt beim Start |
| `src/world/` | Vorlage für `level.dat` und Spielregeln der Manhunt-Welt |
| `tools/` | Build: EPK-Archiv, NBT, PNG, Engine-Compiler, Pack-Generator |
| `docs/TESTBERICHT.md` | Durchgeführte Tests und Ergebnisse |

## Selbst bauen

Voraussetzung: Node.js 22 und die Original-Datei `eaglercraft-26.2-fe8f1237.html`.

```bash
cd eaglercraft-manhunt
node tools/build.js /pfad/zu/eaglercraft-26.2-fe8f1237.html
# Ergebnis in release/
```
