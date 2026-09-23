// Kopiert die benötigten Bibliotheken aus node_modules nach www/vendor,
// damit die App komplett offline läuft (keine CDN-Aufrufe).
// Läuft automatisch nach "npm install".
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'www', 'vendor');

const files = [
  // Offline-KI: llama.cpp als WebAssembly
  ['@wllama/wllama/esm/index.js', 'wllama/index.js'],
  ['@wllama/wllama/esm/wasm/wllama.wasm', 'wllama/wllama.wasm'],
  ['@wllama/wllama/LICENCE', 'wllama/LICENCE'],
  // PDF lesen (als .js gespeichert, damit jeder Server den richtigen MIME-Typ liefert)
  ['pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.js'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.js'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE']
];

let copied = 0;
for (const [from, to] of files) {
  const src = path.join(nm, from);
  const dst = path.join(out, to);
  if (!fs.existsSync(src)) { console.warn('[vendor] fehlt:', from); continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied++;
}
console.log(`[vendor] ${copied} Dateien nach www/vendor kopiert`);
