# Manhunt als Webserver

Voraussetzung: Node.js (ab Version 18). Keine weiteren Pakete nötig.

```bash
cd eaglercraft-manhunt/web
node server.js          # oder ./start.sh (Linux/Mac) bzw. start-windows.bat (Windows)
```

Dann im Browser `http://localhost:8080` öffnen. Andere Geräte im selben WLAN öffnen
`http://<IP-des-Rechners>:8080`. Ein anderer Port geht mit `node server.js 3000`.

Der Server liefert `../release/Eaglercraft-Manhunt.html` gzip-komprimiert aus (55 MB statt 73 MB).
Alternativ kann die HTML-Datei auf jedem beliebigen statischen Webspace (z. B. GitHub Pages, Netlify)
als `index.html` hochgeladen werden – sie braucht keine weiteren Dateien.

Hinweis: Welten und Einstellungen speichert der Browser pro Adresse. Eine über `http://localhost:8080`
gespielte Welt erscheint nicht, wenn die Datei direkt (file://) oder über eine andere Adresse geöffnet wird.
