// Passt das generierte Android-Projekt an (nach "npx cap add android" ausführen).
// 1. Unverschlüsselte Verbindungen (http://) erlauben, damit lokale KI-Server im WLAN
//    (z. B. Ollama auf dem PC unter http://192.168.x.x:11434) erreichbar sind.
// 2. Offline-Modelle (.gguf) unkomprimiert in die APK packen – sonst lädt die Offline-KI sehr langsam.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'android', 'app');

const manifest = path.join(root, 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(manifest, 'utf8');
if (!xml.includes('usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"\n        android:largeHeap="true"');
  fs.writeFileSync(manifest, xml);
  console.log('AndroidManifest angepasst: usesCleartextTraffic, largeHeap');
}

const gradle = path.join(root, 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
if (!g.includes("noCompress 'gguf'")) {
  if (!/aaptOptions\s*\{/.test(g)) throw new Error('aaptOptions-Block in app/build.gradle nicht gefunden');
  g = g.replace(/aaptOptions\s*\{/, "aaptOptions {\n            noCompress 'gguf'");
  fs.writeFileSync(gradle, g);
  console.log("app/build.gradle angepasst: noCompress 'gguf'");
}
