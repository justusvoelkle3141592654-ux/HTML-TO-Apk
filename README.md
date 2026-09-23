# NovaChat

KI-Chat-App im Stil bekannter Chat-Oberflächen – als **Desktop-App** (Windows, macOS, Linux) und als **Android-APK**.
Chatten und Dokumente erstellen, online mit einem KI-Modell deiner Wahl oder offline mit dem eingebauten Assistenten.

## Funktionen

- Chat-Oberfläche mit Seitenleiste, Chat-Verlauf (gruppiert nach Datum), Suche, Umbenennen, Anheften, Löschen
- Streaming-Antworten mit Markdown, Tabellen und Codeblöcken (mit Kopieren-Knopf und Syntaxfarben)
- Nachrichten bearbeiten, Antworten neu generieren, kopieren, vorlesen
- Dateien und Bilder anhängen (Textdateien werden gelesen, Bilder an Modelle mit Bildverständnis gesendet), Drag & Drop, Einfügen aus der Zwischenablage
- Spracheingabe (im Browser, wo unterstützt)
- **Canvas / Dokumente:** Die KI schreibt ein Dokument direkt in einen Editor; selbst bearbeiten, Vorschau, KI um Änderungen bitten, rückgängig machen, Export als `.md`, `.txt`, `.html`, `.doc`, Drucken/PDF (Desktop)
- **Demo-Abo:** Free / Plus / Pro mit Upgrade-Dialog, Checkout und Kündigung – rein simuliert, es werden **keine Zahlungsdaten** abgefragt und nichts berechnet
- Einstellungen: Design (hell/dunkel/System), Personalisierung (Name, Infos über dich, Antwortstil), KI-Verbindung, Datenexport/-import
- Alle Daten bleiben lokal auf dem Gerät

## Online & offline

| Modus | Was passiert |
|---|---|
| **Online** | Einstellungen → KI-Verbindung: OpenAI-kompatible API (z. B. OpenAI, OpenRouter, Groq) oder Anthropic mit eigenem API-Schlüssel. |
| **Lokal ohne Internet** | [Ollama](https://ollama.com) oder LM Studio auf dem PC installieren, Vorlage „Ollama (lokal)“ wählen, „Modelle laden“. Vom Handy aus: IP-Adresse des PCs im WLAN eintragen (z. B. `http://192.168.1.20:11434/v1`, Ollama mit `OLLAMA_HOST=0.0.0.0` starten). |
| **Offline (eingebaut)** | Funktioniert immer, ist aber **keine echte KI**: Rechnen, Einheiten umrechnen, Datum/Uhrzeit, Textstatistik und Dokumentvorlagen (Brief, Bewerbung, Lebenslauf, Kündigung, Protokoll, Listen, Rezept, Wochenplan, Aufsatz, Notizen). |

Im Modus „Automatisch“ wird die KI-Verbindung genutzt, wenn Internet vorhanden ist, sonst der Offline-Assistent.

## Apps herunterladen (Cloud-Build)

Bei jedem Push baut GitHub Actions automatisch alle Apps (`.github/workflows/build.yml`) und legt sie unter **Releases** ab:

- `NovaChat.apk` – Android (auf dem Handy öffnen, Installation aus unbekannten Quellen erlauben)
- `NovaChat-Setup-….exe` / `NovaChat-Portable-….exe` – Windows
- `….dmg` – macOS (Apple Silicon, nicht signiert: beim ersten Start Rechtsklick → Öffnen)
- `….AppImage` – Linux

Manuell starten: GitHub → Actions → „Apps bauen“ → „Run workflow“.

## Selbst bauen

Voraussetzung: Node.js 22+.

```bash
npm install

# Desktop-App starten / Installer bauen
npm start
npm run dist:win      # oder dist:mac, dist:linux

# Web-Version im Browser (http://localhost:8080)
npm run serve

# Android-APK (benötigt JDK 21 und Android SDK)
npm run android:build
# Ergebnis: android/app/build/outputs/apk/debug/app-debug.apk
```

## Aufbau

```
www/                 Oberfläche (HTML/CSS/JS, ohne Build-Schritt, läuft offline)
  js/app.js          App-Logik (Chats, Canvas, Einstellungen, Demo-Abo)
  js/providers.js    KI-Anbieter (OpenAI-kompatibel, Anthropic, offline)
  js/offline.js      Eingebauter Offline-Assistent
  js/markdown.js     Markdown-Renderer
electron/main.js     Desktop-Hülle (Electron)
capacitor.config.json  Android-Hülle (Capacitor)
assets/, resources/  App-Icons und Splash-Screens
```

## Hinweise

- Die APK ist ein Debug-Build (für die eigene Nutzung). Für den Play Store wäre ein signierter Release-Build nötig.
- Name und Logo sind eigenständig; Layout und Bedienung orientieren sich an gängigen KI-Chat-Apps.
