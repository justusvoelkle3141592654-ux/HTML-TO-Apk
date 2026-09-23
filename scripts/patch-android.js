// Passt das generierte Android-Projekt an (nach "npx cap add android" ausführen).
// Erlaubt unverschlüsselte Verbindungen (http://), damit lokale KI-Server im WLAN
// (z. B. Ollama auf dem PC unter http://192.168.x.x:11434) erreichbar sind.
const fs = require('fs');
const path = require('path');
const manifest = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(manifest, 'utf8');
if (!xml.includes('usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
  fs.writeFileSync(manifest, xml);
  console.log('AndroidManifest angepasst: usesCleartextTraffic=true');
} else {
  console.log('AndroidManifest bereits angepasst');
}
