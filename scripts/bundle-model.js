// Lädt das mitgelieferte Offline-Modell (siehe www/js/models.js, "bundled: true")
// nach www/models und schreibt www/models/manifest.json.
// Wird beim Bauen der Apps (GitHub Actions) ausgeführt.
//   node scripts/bundle-model.js            -> Modell laden
//   node scripts/bundle-model.js --local X  -> vorhandene Datei X verwenden (Tests)
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

global.window = {};
require('../www/js/models.js');
const model = window.ModelCatalog.bundled();
const dir = path.join(__dirname, '..', 'www', 'models');
fs.mkdirSync(dir, { recursive: true });

(async () => {
  const localIdx = process.argv.indexOf('--local');
  const target = path.join(dir, model.file);
  if (localIdx > 0) {
    fs.copyFileSync(process.argv[localIdx + 1], target);
  } else if (!fs.existsSync(target)) {
    console.log('Lade', model.url);
    const res = await fetch(model.url);
    if (!res.ok) throw new Error('Download fehlgeschlagen: HTTP ' + res.status);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(target + '.part'));
    fs.renameSync(target + '.part', target);
  }
  const size = fs.statSync(target).size;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ bundled: [{ id: model.id, file: model.file, size }] }, null, 2));
  console.log('Mitgeliefertes Modell:', model.id, (size / 1048576).toFixed(0) + ' MB');
})().catch((e) => { console.error(e); process.exit(1); });
