# NovaChat

KI-Chat-App im Stil von ChatGPT – als **Desktop-App** (Windows, macOS, Linux) und als **Android-APK**.
Mit eingebetteter **Offline-KI**, kostenloser **Online-KI ohne Anmeldung** und frei wählbaren **eigenen API-Schlüsseln**.

## ⬇️ Herunterladen & installieren

| Gerät | Download | Installation |
|---|---|---|
| **Windows** (Laptop/PC) | [NovaChat-Setup.exe](https://github.com/justusvoelkle3141592654-ux/HTML-TO-Apk/releases/latest/download/NovaChat-Setup.exe) | Datei öffnen → Windows-Warnung: „Weitere Informationen“ → „Trotzdem ausführen“ → Installieren |
| **Android** (Handy) | [NovaChat.apk](https://github.com/justusvoelkle3141592654-ux/HTML-TO-Apk/releases/latest/download/NovaChat.apk) | Auf dem Handy öffnen → „Installation aus unbekannten Quellen“ erlauben → Installieren |
| **Mac** (Apple Silicon) | [NovaChat-Mac.dmg](https://github.com/justusvoelkle3141592654-ux/HTML-TO-Apk/releases/latest/download/NovaChat-Mac.dmg) | Öffnen, App in „Programme“ ziehen, beim ersten Start Rechtsklick → „Öffnen“ |
| **Linux** | [NovaChat.AppImage](https://github.com/justusvoelkle3141592654-ux/HTML-TO-Apk/releases/latest/download/NovaChat.AppImage) | Rechtsklick → Eigenschaften → „Als Programm ausführen“ erlauben, dann starten |

Die **Offline-KI** ist nur in den Computer-Versionen (Windows, Mac, Linux) enthalten.
Die Android-App nutzt die kostenlose Online-KI oder einen eigenen API-Schlüssel.
Alle Versionen: [Releases](https://github.com/justusvoelkle3141592654-ux/HTML-TO-Apk/releases).

## KI-Quellen (oben über den Modellnamen wählbar)

| Quelle | Beschreibung |
|---|---|
| **Automatisch** (Standard) | Mit Internet: eigener API-Schlüssel oder kostenlose Online-KI. Ohne Internet: Offline-KI. |
| **Nova Online** (kostenlos) | GPT-OSS 20B über [Pollinations.ai](https://pollinations.ai) – ohne Anmeldung, ohne Schlüssel. Nachrichten gehen an Pollinations.ai; Verfügbarkeit und Limits bestimmt der Anbieter. |
| **Eigener API-Schlüssel** | OpenAI, Anthropic (Claude), Google Gemini, Mistral, Groq, OpenRouter, DeepSeek, xAI oder lokal Ollama / LM Studio. Schlüssel bleibt nur auf dem Gerät. |
| **Offline-KI** (nur Computer) | llama.cpp (über [wllama](https://github.com/ngxson/wllama)) läuft direkt auf dem Laptop/PC, auch ohne Internet. |
| **Basis (ohne KI)** | Notfall-Modus: Rechnen, Umrechnen, Datum, Dokumentvorlagen. |

### Offline-Modelle

| Name | Modell | Größe | |
|---|---|---|---|
| Nova Mini | Qwen2.5 0.5B Instruct Q4_K_M | 491 MB | **in der Computer-App enthalten** |
| Nova | Qwen2.5 1.5B Instruct Q4_K_M | 1,1 GB | Download in der App, deutlich bessere Antworten |
| Llama 3.2 1B | Llama 3.2 1B Instruct Q4_K_M | 808 MB | Download in der App |
| Gemma 2 2B | Gemma 2 2B Instruct Q4_K_M | 1,7 GB | Download in der App, für PCs mit ≥ 8 GB RAM |

Das mitgelieferte Mini-Modell ist klein und macht öfter Fehler. Für bessere Offline-Antworten in den
Einstellungen → Offline-KI „Nova“ herunterladen. Auf dem PC nutzt die Offline-KI mehrere Prozessorkerne
und – wenn verfügbar – die Grafikkarte (WebGPU).

## Funktionen

- Chat mit Streaming, Markdown, Tabellen, Code (Kopieren, Syntaxfarben), „Nachgedacht“-Anzeige
- Antworten neu generieren mit Versionen (‹ 1/2 ›), Nachrichten bearbeiten, Daumen hoch/runter, Vorlesen
- **Bilder erstellen** (kostenlos über Pollinations.ai; + → Bild erstellen oder „Erstelle ein Bild von …“), Bibliothek aller Bilder
- **Canvas / Dokumente**: KI schreibt Dokumente, bearbeiten, KI um Änderungen bitten, Export als .md/.txt/.html/.doc, Drucken/PDF
- **Dateien**: Bilder, **PDFs** (Text wird ausgelesen), Text- und Code-Dateien
- **Sprachmodus** (Gespräch per Stimme), Diktieren, Vorlesen – im Browser und in der Android-App
- **Gedächtnis**: „Merk dir, dass …“ / „Vergiss …“, verwaltbar unter Personalisierung
- **Temporärer Chat**, **Archiv**, Anheften, Umbenennen, Suche, Teilen, Export/Import
- **Demo-Abo** (Free/Plus/Pro) – rein simuliert, keine Zahlungsdaten, keine Kosten
- Hell/Dunkel, Handy- und Desktop-Layout; alle Daten bleiben lokal auf dem Gerät

## Apps herunterladen (Cloud-Build)

Bei jedem Push baut GitHub Actions automatisch alle Apps (`.github/workflows/build.yml`), bettet das
Offline-Modell in die Computer-Versionen ein und legt alles unter **Releases** ab (Links oben).

## Selbst bauen

Voraussetzung: Node.js 22+.

```bash
npm install                 # kopiert auch wllama und pdf.js nach www/vendor
npm run model:bundle        # lädt das Offline-Modell nach www/models (491 MB)

npm start                   # Desktop-App starten
npm run dist:win            # Installer bauen (oder dist:mac, dist:linux)
npm run serve               # Web-Version: http://localhost:8080

npm run android:build       # APK (benötigt JDK 21 und Android SDK)
```

## Aufbau

```
www/                    Oberfläche (HTML/CSS/JS, ohne Build-Schritt)
  js/app.js             Chat-Kern (Verlauf, Senden, Versionen, Canvas, Gedächtnis, Bilder)
  js/panels.js          Einstellungen, Offline-KI, API-Schlüssel, Bibliothek, Suche, Sprachmodus, Demo-Abo
  js/providers.js       KI-Quellen (kostenlos, eigener Schlüssel, offline, Basis)
  js/local-ai.js        Offline-KI (wllama / llama.cpp)
  js/models.js          Katalog der Offline-Modelle
  js/speech.js          Spracherkennung und Sprachausgabe
  js/ui.js              Symbole, Menüs, Dialoge, Dateien
electron/main.js        Desktop-Hülle (Electron, app://-Protokoll)
capacitor.config.json   Android-Hülle (Capacitor)
scripts/                Vendor-Kopie, Modell-Einbettung, Android-Anpassungen, Testserver
```

## Hinweise

- Die APK ist ein Debug-Build zur eigenen Nutzung. Für den Play Store wäre ein signierter Release-Build nötig.
- Name und Logo sind eigenständig; Layout und Bedienung orientieren sich an ChatGPT.
- Websuche und „Deep Research“ sind nicht enthalten (dafür wäre ein Such-Dienst mit API-Schlüssel nötig).
- Lizenzen: Qwen2.5 (Apache-2.0), wllama (MIT), pdf.js (Apache-2.0).
