// Einfacher lokaler Webserver für die Web-Version: npm run serve  →  http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'www');
const types = { '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.gguf': 'application/octet-stream', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': /^text|json|javascript/.test(type) ? type + '; charset=utf-8' : type });
    res.end(data);
  });
}).listen(port, () => console.log('NovaChat läuft auf http://localhost:' + port));
