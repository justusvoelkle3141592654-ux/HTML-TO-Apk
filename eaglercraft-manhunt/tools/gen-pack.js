'use strict';
// Generates pack files that are derived from the shared config:
//   - data/manhunt/structure/engine.nbt         (command-block engine)
//   - data/manhunt/dialog/*.json + dialog tags   (fallback menu for clients without the Lua mod)
//   - assets/manhunt/{items,models,textures}     (icons of the special weapons, recolored from vanilla textures)
const fs = require('fs');
const path = require('path');
const C = require('../src/shared/config');
const engine = require('../src/engine/engine');
const { compile } = require('./compile-engine');
const png = require('./png');

function generate(outDir, vanillaAssets) {
  vanillaAssets = vanillaAssets || "";
  const files = new Map(); // rel path -> Buffer
  const json = (rel, o) => files.set(rel, Buffer.from(JSON.stringify(o, null, 2)));

  // ---- engine structure
  const st = compile(engine.modules);
  files.set('data/manhunt/structure/engine.nbt', st.nbt);

  // ---- dialogs
  const A = C.ACT;
  const trig = (n) => ({ type: 'minecraft:run_command', command: `/trigger mh.act set ${n}` });
  const show = (id) => ({ type: 'minecraft:show_dialog', dialog: 'manhunt:' + id });
  const btn = (label, action, tooltip) => ({ label: { text: label }, ...(tooltip ? { tooltip: { text: tooltip } } : {}), action });
  const back = { label: { text: 'Zurück' }, action: show('main'), width: 150 };
  const dialog = (id, title, body, actions, columns = 2) => json(`data/manhunt/dialog/${id}.json`, {
    type: 'minecraft:multi_action', title: { text: title, color: 'gold' },
    body: body.map((t) => ({ type: 'minecraft:plain_message', contents: { text: t }, width: 300 })),
    actions, columns, exit_action: id === 'main' ? { label: { text: 'Schließen' }, width: 150 } : back,
    can_close_with_escape: true, pause: false, after_action: 'close', external_title: { text: 'Manhunt' },
  });
  dialog('main', 'Manhunt', ['Tipp: Mit dem Manhunt-Client öffnet Taste M das große Menü mit Live-Werten.', 'Rückmeldungen erscheinen im Chat.'], [
    btn('Rolle wählen', show('roles')), btn('Runde', show('round')), btn('Hunter & Regeln (Host)', show('settings')),
    btn('Schwert-Upgrades', show('sword')), btn('Bogen-Upgrades', show('bow')), btn('Rüstung', show('armor')),
    btn('Sonderwaffen', show('weapons')), btn('Fähigkeiten', show('abilities')), btn('Welt (Host)', show('world')),
  ]);
  dialog('roles', 'Rolle wählen', ['Rollen werden in der Lobby vor jeder Runde gewählt. Während einer Runde kannst du als Hunter einsteigen.'], [
    btn('Speedrunner', trig(A.ROLE_RUNNER), 'Besiege den Enderdrachen'), btn('Hunter', trig(A.ROLE_HUNTER), 'Töte den Speedrunner'),
    btn('Zuschauer', trig(A.ROLE_SPECTATOR)), btn('Zufällige Rollen (Host)', trig(A.RANDOM_ROLES)), btn('Alle ohne Rolle → Hunter (Host)', trig(A.ALL_HUNTERS)),
  ]);
  dialog('round', 'Runde', ['Der Host startet und beendet Runden.'], [
    btn('Runde starten', trig(A.START)), btn('Runde abbrechen', trig(A.ABORT)), btn('Zurück zur Lobby', trig(A.LOBBY)),
  ]);
  dialog('settings', 'Hunter & Regeln (Host)', ['Jeder Klick schaltet auf den nächsten Wert, der neue Wert erscheint im Chat.'],
    C.SETTINGS.map((s, i) => btn(s.name + ' ändern', trig(A.SETTING_BASE + 2 * i), 'Werte: ' + (s.labels || s.values).join(' / '))));
  const cost = (t) => `Level ${t.lvl}, ${t.iron} Eisen, ${t.diamond} Diamanten`;
  dialog('sword', 'Schwert-Upgrades', ['Stufen müssen der Reihe nach gekauft werden.'], [
    ...C.SWORD_MATERIALS.filter((m) => m.tier).map((m) => btn('Material: ' + m.name, trig(A.SWORD_MAT_BASE + m.tier), cost(m))),
    ...C.SWORD_SHARPNESS.map((t) => btn('Schärfe ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][t.tier], trig(A.SWORD_SHARP_BASE + t.tier), cost(t) + (t.extra ? ' · ' + t.extra : ''))),
  ], 3);
  dialog('bow', 'Bogen-Upgrades', ['Der Manhunt-Bogen hat immer Unendlichkeit.'], [
    ...C.BOW_POWER.map((t) => btn('Stärke ' + ['', 'I', 'II', 'III', 'IV', 'V'][t.tier], trig(A.BOW_POWER_BASE + t.tier), cost(t))),
    ...C.BOW_PUNCH.map((t) => btn('Schlag ' + ['', 'I', 'II'][t.tier], trig(A.BOW_PUNCH_BASE + t.tier), cost(t))),
    btn('Flamme', trig(A.BOW_FLAME), cost(C.BOW_FLAME)), btn('Repetierarmbrust', trig(A.BOW_REPEATER), cost(C.BOW_REPEATER) + ' · Schnellladen III'),
  ], 3);
  dialog('armor', 'Rüstung', ['Schutz-Upgrades verstärken die getragene Rüstung.'], [
    ...C.ARMOR_PROT.map((t) => btn('Schutz ' + ['', 'I', 'II', 'III', 'IV'][t.tier], trig(A.ARMOR_PROT_BASE + t.tier), cost(t))),
    btn('Schutz neu anwenden', trig(A.ARMOR_PROT_BASE + 9), 'Kostenlos, für neue Rüstung'),
    ...C.ARMOR_SETS.map((s) => btn(s.name, trig(A.ARMOR_SET_BASE + s.id), cost(s) + ' · ' + s.desc)),
  ], 2);
  dialog('weapons', 'Sonderwaffen', ['Kaufen mit Level und Materialien. Hunter finden viele davon auch im Hunter-Arsenal.'],
    C.WEAPONS.map((w) => btn(w.name, trig(A.WEAPON_BASE + w.id), cost(w) + ' · ' + w.desc)), 2);
  dialog('abilities', 'Fähigkeiten', ['Fähigkeit 2 ab Level ' + C.ABILITY_SLOT2_LEVEL + '.'], [
    btn('Fähigkeit 1 benutzen', trig(A.ABILITY_USE1)), btn('Fähigkeit 2 benutzen', trig(A.ABILITY_USE2)),
    ...C.ABILITIES.map((a) => btn('Slot 1: ' + a.name, trig(A.ABILITY_SET1_BASE + a.id), (a.role === 1 ? 'Speedrunner' : 'Hunter') + ' · ' + a.desc)),
    ...C.ABILITIES.map((a) => btn('Slot 2: ' + a.name, trig(A.ABILITY_SET2_BASE + a.id), (a.role === 1 ? 'Speedrunner' : 'Hunter') + ' · ' + a.desc)),
  ], 2);
  dialog('world', 'Welt (Host)', ['Die Welt speichert automatisch.'], [
    btn('Tag', trig(A.WORLD_DAY)), btn('Wetter klar', trig(A.WORLD_CLEAR)),
    ...['Friedlich', 'Einfach', 'Normal', 'Schwer'].map((d, i) => btn('Schwierigkeit: ' + d, trig(A.WORLD_DIFF_BASE + i))),
    btn('Lobby hierher verlegen', trig(A.WORLD_RELOBBY)), btn('Hunter-Arsenal neu aufbauen', trig(A.WORLD_REBUILD_CHEST)),
    btn('Rollen & Rundendaten zurücksetzen', trig(A.WORLD_RESET_STATS)),
  ], 2);
  json('data/minecraft/tags/dialog/pause_screen_additions.json', { values: ['manhunt:main'] });
  json('data/minecraft/tags/dialog/quick_actions.json', { values: ['manhunt:main'] });

  // ---- item icons
  const tex = (name) => png.decode(fs.readFileSync(path.join(vanillaAssets, 'assets/minecraft/textures/item', name + '.png')));
  const put = (name, img) => files.set(`assets/manhunt/textures/item/${name}.png`, png.encode(img));
  const H = (deg) => deg / 360;
  put('explosion_bow', png.recolor(tex('bow'), H(2), 1.3, 0.95, { minSat: 0.5 }));
  for (let i = 0; i < 3; i++) put('explosion_bow_pulling_' + i, png.recolor(tex('bow_pulling_' + i), H(2), 1.3, 0.95, { minSat: 0.5 }));
  put('fire_bow', png.recolor(tex('bow'), H(32), 1.6, 1.15, { minSat: 0.6 }));
  for (let i = 0; i < 3; i++) put('fire_bow_pulling_' + i, png.recolor(tex('bow_pulling_' + i), H(32), 1.6, 1.15, { minSat: 0.6 }));
  put('lightning_sword', png.recolor(tex('golden_sword'), H(55), 1.4, 1.2, { minSat: 0.6 }));
  put('frost_sword', png.recolor(tex('copper_sword'), H(190), 0.8, 1.35, { minSat: 0.4 }));
  put('explosion_sword', png.recolor(tex('netherite_sword'), H(8), 1.8, 1.25, { minSat: 0.7 }));
  put('teleport_staff', png.recolor(tex('blaze_rod'), H(285), 1.2, 0.95, { minSat: 0.6 }));
  put('smoke_bomb', png.recolor(tex('firework_star'), H(0), 0, 0.7));
  put('poison_arrows', png.recolor(tex('arrow'), H(110), 1.2, 1.0, { minSat: 0.5, mask: (x, y) => x + (15 - y) >= 18 }));
  put('grapple', png.recolor(tex('fishing_rod'), H(210), 0.15, 1.05));
  put('grapple_cast', png.recolor(tex('fishing_rod_cast'), H(210), 0.15, 1.05));
  const bottle = tex('potion'); const overlay = tex('potion_overlay');
  put('invis_potion', png.overlayTint(bottle, overlay, [200, 210, 240]));
  put('speed_potion', png.overlayTint(bottle, overlay, [51, 235, 255]));

  const model = (key, parent = 'minecraft:item/handheld', layer = key) => json(`assets/manhunt/models/item/${key}.json`, { parent, textures: { layer0: 'manhunt:item/' + layer } });
  const itemDef = (key, m) => json(`assets/manhunt/items/${key}.json`, { model: m });
  const simple = (key) => ({ type: 'minecraft:model', model: 'manhunt:item/' + key });
  for (const k of ['lightning_sword', 'frost_sword', 'explosion_sword', 'teleport_staff']) { model(k); itemDef(k, simple(k)); }
  for (const k of ['smoke_bomb', 'poison_arrows', 'invis_potion', 'speed_potion']) { model(k, 'minecraft:item/generated'); itemDef(k, simple(k)); }
  for (const k of ['explosion_bow', 'fire_bow']) {
    model(k, 'minecraft:item/bow');
    for (let i = 0; i < 3; i++) model(`${k}_pulling_${i}`, 'minecraft:item/bow', `${k}_pulling_${i}`);
    itemDef(k, {
      type: 'minecraft:condition', property: 'minecraft:using_item', on_false: simple(k),
      on_true: { type: 'minecraft:range_dispatch', property: 'minecraft:use_duration', scale: 0.05, fallback: simple(k + '_pulling_0'),
        entries: [{ threshold: 0.65, model: simple(k + '_pulling_1') }, { threshold: 0.9, model: simple(k + '_pulling_2') }] },
    });
  }
  model('grapple', 'minecraft:item/handheld_rod'); model('grapple_cast', 'minecraft:item/handheld_rod');
  itemDef('grapple', { type: 'minecraft:condition', property: 'minecraft:fishing_rod/cast', on_false: simple('grapple'), on_true: simple('grapple_cast') });

  if (outDir) {
    for (const [rel, buf] of files) { const p = path.join(outDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); }
  }
  return { files, engineCommands: st.blocks, engineSize: st.size };
}

module.exports = { generate };
