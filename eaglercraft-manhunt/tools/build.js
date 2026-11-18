#!/usr/bin/env node
'use strict';
// Builds the Eaglercraft 26.2 Manhunt edition from the original single-file Eaglercraft HTML.
//
//   node tools/build.js <original eaglercraft-26.2-*.html> [output directory]
//
// Output (default: release/):
//   Eaglercraft-Manhunt.html   single file, everything built in (open it in a browser)
//   manhunt-pack.zip           the Manhunt data pack + resource pack as loose files (for inspection / servers)
//   manhunt-mod.zip            the Manhunt Lua client mod (also built into the HTML)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const epk = require('./epk');
const nbt = require('./nbt');
const { generate } = require('./gen-pack');
const C = require('../src/shared/config');
const { WIDTH } = require('./compile-engine');

const ROOT = path.resolve(__dirname, '..');
const VERSION = require('../package.json').version;
const input = process.argv[2];
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'release'));
if (!input) {
  console.error('usage: node tools/build.js <original eaglercraft-26.2 html> [outdir]');
  process.exit(2);
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}
function zipStore(files) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data) >>> 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
    local.push(lh, n, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

// ------------------------------------------------------------------ read original
const html = fs.readFileSync(input, 'latin1');
const ASSET_ID = 'eag-inline-assets';
const re = new RegExp('(<script type="application/octet-stream" id="' + ASSET_ID + '" data-size=")(\\d+)(">)([\\s\\S]*?)(</script>)');
const m = re.exec(html);
if (!m) throw new Error('inline assets payload not found - is this the single-file Eaglercraft 26.2 HTML?');
if (!html.includes('<title>Eaglercraft 26.2')) console.warn('warning: this does not look like Eaglercraft 26.2');
const oldSize = Number(m[2]);
const oldEpk = Buffer.from(m[4].replace(/\s+/g, ''), 'base64');
if (oldEpk.length !== oldSize) throw new Error('assets payload size mismatch');
const archive = epk.parse(oldEpk);
console.log('original assets.epk: %d entries, %d bytes', archive.entries.length, oldSize);
const index = new Map();
archive.entries.forEach((e, i) => { if (e.type === 'FILE') index.set(e.name, i); });
const vanilla = (p) => { const i = index.get(p); if (i === undefined) throw new Error('missing vanilla file ' + p); return archive.entries[i].data; };

// ------------------------------------------------------------------ pack (static + generated)
const tmpVanilla = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mh-vanilla-'));
for (const n of ['bow', 'bow_pulling_0', 'bow_pulling_1', 'bow_pulling_2', 'golden_sword', 'copper_sword', 'netherite_sword', 'blaze_rod',
  'firework_star', 'arrow', 'fishing_rod', 'fishing_rod_cast', 'potion', 'potion_overlay']) {
  const p = path.join(tmpVanilla, 'assets/minecraft/textures/item', n + '.png');
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, vanilla(`assets/minecraft/textures/item/${n}.png`));
}
const gen = generate(null, tmpVanilla);
fs.rmSync(tmpVanilla, { recursive: true, force: true });
console.log('engine: %d command blocks, structure %s', gen.engineCommands, gen.engineSize.join('x'));

const packDir = path.join(ROOT, 'src', 'pack');
const packFiles = new Map();
for (const rel of walk(packDir)) packFiles.set(rel, fs.readFileSync(path.join(packDir, rel)));
for (const [rel, buf] of gen.files) packFiles.set(rel, buf);

let added = 0, replaced = 0, merged = 0;
for (const [rel, data0] of packFiles) {
  if (!(rel.startsWith('data/') || rel.startsWith('assets/'))) continue;
  let data = data0;
  if (rel.endsWith('.json')) {
    try { JSON.parse(data.toString('utf8')); } catch (e) { throw new Error('invalid JSON in ' + rel + ': ' + e.message); }
  }
  if (rel.endsWith('.mcfunction')) throw new Error('mcfunction files crash Eaglercraft 26.2 world loading: ' + rel);
  if (index.has(rel)) {
    const entry = archive.entries[index.get(rel)];
    if (/^data\/[^/]+\/tags\//.test(rel)) {
      const a = JSON.parse(entry.data.toString('utf8'));
      const b = JSON.parse(data.toString('utf8'));
      const values = a.values.slice();
      for (const v of b.values) if (!values.some((x) => JSON.stringify(x) === JSON.stringify(v))) values.push(v);
      data = Buffer.from(JSON.stringify({ ...a, values }, null, 2));
      merged++;
    } else replaced++;
    entry.data = data;
  } else {
    archive.entries.push({ type: 'FILE', name: rel, data });
    index.set(rel, archive.entries.length - 1);
    added++;
  }
}
console.log('pack: %d added, %d replaced, %d tags merged', added, replaced, merged);
const newEpk = epk.build(archive);
epk.parse(newEpk);

// ------------------------------------------------------------------ Lua mod
const engineRows = gen.engineSize[2];
const luaConfig = {
  VERSION, MAX_LEVEL: C.MAX_LEVEL, ACT: C.ACT, SETTINGS: C.SETTINGS, SWORD_MATERIALS: C.SWORD_MATERIALS, SWORD_SHARPNESS: C.SWORD_SHARPNESS,
  BOW_POWER: C.BOW_POWER, BOW_PUNCH: C.BOW_PUNCH, BOW_FLAME: C.BOW_FLAME, BOW_REPEATER: C.BOW_REPEATER, ARMOR_PROT: C.ARMOR_PROT,
  ARMOR_SETS: C.ARMOR_SETS, WEAPONS: C.WEAPONS, ABILITIES: C.ABILITIES, ABILITY_SLOT2_LEVEL: C.ABILITY_SLOT2_LEVEL,
  BOT_DIFFICULTIES: C.BOT_DIFFICULTIES.map((d) => ({ id: d.id, name: d.name })), engine: { width: WIDTH, rows: engineRows },
};
let lua = fs.readFileSync(path.join(ROOT, 'src', 'mod', 'main.lua'), 'utf8');
const cfgJson = JSON.stringify(luaConfig);
if (cfgJson.includes(']==]')) throw new Error('config breaks Lua long string');
lua = lua.replace(/@@VERSION@@/g, VERSION).replace('@@CONFIG@@', cfgJson);
const meta = { api: 1, id: 'manhunt', main: 'main.lua', name: 'Manhunt', version: VERSION, authors: ['Manhunt'], minecraft: '26.2',
  description: 'Manhunt-Modus: HUD, Menü (M), Fähigkeiten (R/V), Enterhaken, automatische Einrichtung.' };
const modZip = zipStore([['main.lua', Buffer.from(lua, 'utf8')], ['metadata.json', Buffer.from(JSON.stringify(meta, null, 2))]]);

// ------------------------------------------------------------------ world template
const W = path.join(ROOT, 'src', 'world');
const lvl = nbt.read(fs.readFileSync(path.join(W, 'level.dat')));
const D = lvl.root.value.Data.value;
D.LevelName = nbt.T.string('Manhunt-Welt');
D.allowCommands = nbt.T.byte(1);
D.initialized = nbt.T.byte(0);
D.Time = nbt.T.long(0);
D.LastPlayed = nbt.T.long(Date.now());
D.GameType = nbt.T.int(0);
delete D.singleplayer_uuid;
const gr = nbt.read(fs.readFileSync(path.join(W, 'game_rules.dat')));
const R = gr.root.value.data.value;
for (const [k, v] of Object.entries({ command_block_output: 0, player_movement_check: 0, elytra_movement_check: 0, log_admin_commands: 0, spawn_wandering_traders: 0 })) {
  if (!R['minecraft:' + k]) throw new Error('unknown game rule ' + k);
  R['minecraft:' + k] = nbt.T.byte(v);
}
const wgs = nbt.read(fs.readFileSync(path.join(W, 'world_gen_settings.dat')));
wgs.root.value.data.value.seed = nbt.T.long(0x1122334455667788n);
const wgsRaw = nbt.write(wgs.name, wgs.root, false);
const seedOffset = wgsRaw.indexOf(Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]));
if (seedOffset < 0) throw new Error('seed marker not found');
const world = {
  folder: 'Manhunt', level: nbt.write(lvl.name, lvl.root, true).toString('base64'), gameRules: nbt.write(gr.name, gr.root, true).toString('base64'),
  worldGenRaw: wgsRaw.toString('base64'), seedOffset,
};

// ------------------------------------------------------------------ HTML
const b64 = newEpk.toString('base64');
const lines = [];
for (let i = 0; i < b64.length; i += 262144) lines.push(b64.slice(i, i + 262144));
let out = html.slice(0, m.index) + m[1] + newEpk.length + m[3] + '\n' + lines.join('\n') + '\n' + m[5] + html.slice(m.index + m[0].length);
const sizeNeedle = 'var size = ' + oldSize + ';';
if (out.split(sizeNeedle).length !== 2) throw new Error('server bootstrap size marker not found exactly once');
out = out.replace(sizeNeedle, 'var size = ' + newEpk.length + ';');
out = out.replace(/var total = Number\("(\d+)"\)/, (s, n) => 'var total = Number("' + (Number(n) - oldSize + newEpk.length) + '")');
out = out.replace(/<title>[^<]*<\/title>/, '<title>Eaglercraft 26.2 Manhunt</title>');
out = out.replace('Loading Eaglercraft 26.2 runtime…', 'Loading Eaglercraft 26.2 Manhunt…');

let shell = fs.readFileSync(path.join(ROOT, 'src', 'shell', 'manhunt-shell.js'), 'utf8');
shell = shell.replace(/@@VERSION@@/g, VERSION).replace('@@MOD_ZIP_B64@@', modZip.toString('base64')).replace('@@WORLD_JSON@@', JSON.stringify(world));
if (shell.includes('</script')) throw new Error('shell script must not contain </script');
const marker = '<script type="text/javascript">\n\t\t\t// Harness logging.';
if (out.split(marker).length !== 2) throw new Error('shell injection marker not found');
out = out.replace(marker, '<script type="text/javascript" id="manhunt-shell">\n' + shell + '\n</script>\n\t\t' + marker);
// Let the game start only after the mod / world files are in place.
const startNeedle = 'window.__eagPrepareInlineAssets();';
if (out.split(startNeedle).length !== 2) throw new Error('start marker not found');
out = out.replace(startNeedle, 'try { await (window.__manhuntShellReady || Promise.resolve()); } catch (e) {}\n\t\t\t\t' + startNeedle);
// Write the world into the latin1 file as UTF-8 bytes (the original file is plain ASCII + UTF-8 text).
fs.mkdirSync(outDir, { recursive: true });
const htmlOut = path.join(outDir, 'Eaglercraft-Manhunt.html');
fs.writeFileSync(htmlOut, Buffer.from(out, 'latin1'));
console.log('wrote %s (%d bytes, assets.epk %d bytes)', htmlOut, Buffer.byteLength(out, 'latin1'), newEpk.length);

const zipFiles = [];
for (const [rel, buf] of [...packFiles].sort()) zipFiles.push([rel, buf]);
fs.writeFileSync(path.join(outDir, 'manhunt-pack.zip'), zipStore(zipFiles));
fs.writeFileSync(path.join(outDir, 'manhunt-mod.zip'), modZip);
console.log('wrote manhunt-pack.zip (%d files), manhunt-mod.zip (%d bytes)', zipFiles.length, modZip.length);
