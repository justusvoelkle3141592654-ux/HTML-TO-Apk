#!/usr/bin/env node
'use strict';
// Minimal static web server for Eaglercraft 26.2 Manhunt (no dependencies).
//   node server.js [port]      -> http://localhost:8080
// Serves ../release/Eaglercraft-Manhunt.html as "/" (gzip-compressed once at startup).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HTML = path.resolve(__dirname, '..', 'release', 'Eaglercraft-Manhunt.html');
if (!fs.existsSync(HTML)) { console.error('Nicht gefunden: ' + HTML); process.exit(1); }

console.log('Lade und komprimiere ' + path.basename(HTML) + ' …');
const raw = fs.readFileSync(HTML);
const gz = zlib.gzipSync(raw, { level: 6 });
const etag = '"' + require('crypto').createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"';
console.log('Bereit: ' + (raw.length / 1048576).toFixed(1) + ' MB, gzip ' + (gz.length / 1048576).toFixed(1) + ' MB');

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url !== '/' && url !== '/index.html' && url !== '/Eaglercraft-Manhunt.html') {
    res.writeHead(url === '/favicon.ico' ? 204 : 404); res.end(); return;
  }
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return; }
  const useGz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = useGz ? gz : raw;
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, ETag: etag,
    'Cache-Control': 'no-cache', ...(useGz ? { 'Content-Encoding': 'gzip' } : {}),
  });
  if (req.method === 'HEAD') res.end(); else res.end(body);
}).listen(PORT, '0.0.0.0', () => {
  console.log('Eaglercraft Manhunt läuft auf http://localhost:' + PORT);
  console.log('Im selben Netzwerk: http://<IP-dieses-Rechners>:' + PORT);
});
