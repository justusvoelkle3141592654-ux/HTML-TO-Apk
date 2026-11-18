'use strict';
// Item stacks (SNBT component syntax of Minecraft 26.2) used by the engine.
const C = require('./config');

const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const txt = (text, color = 'white', extra = '') => `{text:${q(text)},color:${q(color)},italic:false${extra}}`;
const lore = (lines) => 'lore=[' + lines.map((l) => (Array.isArray(l) ? txt(l[0], l[1]) : txt(l, 'gray'))).join(',') + ']';
const ench = (o) => 'enchantments={' + Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `${k.includes(':') ? q(k) : k}:${v}`).join(',') + '}';
const item = (id, comps) => `minecraft:${id}[${comps.filter(Boolean).join(',')}]`;
const data = (o) => 'custom_data={' + Object.entries(o).map(([k, v]) => `${k}:${typeof v === 'number' ? v + 'b' : q(v)}`).join(',') + '}';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function swordItem(mat, sharp) {
  const m = C.SWORD_MATERIALS[mat];
  const e = { sharpness: sharp, vanishing_curse: 1 };
  if (sharp >= 6) e.fire_aspect = sharp >= 7 ? 2 : 1;
  if (sharp >= 8) e.looting = 3;
  return item(m.item, [data({ mh: 'sword' }), `item_name=${txt('Manhunt-Schwert (' + m.name + ')', 'gold')}`,
    lore([['Upgrade-fähig im Manhunt-Menü (Taste M)', 'yellow'], 'Schärfe ' + (sharp ? ROMAN[sharp] : '-') + ' · Material ' + m.name]),
    'unbreakable={}', ench(e)]);
}

function bowItem(power, punch, flame) {
  return item('bow', [data({ mh: 'bow' }), `item_name=${txt('Manhunt-Bogen', 'gold')}`,
    lore([['Upgrade-fähig im Manhunt-Menü (Taste M)', 'yellow'], `Stärke ${power ? ROMAN[power] : '-'} · Schlag ${punch ? ROMAN[punch] : '-'} · Flamme ${flame ? 'ja' : '-'}`]),
    'unbreakable={}', ench({ infinity: 1, power, punch, flame, vanishing_curse: 1 })]);
}

const COMPASS = item('compass', [data({ mh: 'compass' }), `item_name=${txt('Ortungskompass', 'aqua')}`,
  lore([['Zeigt auf den nächsten Speedrunner', 'gray'], ['in deiner Dimension (letzte bekannte Position).', 'gray'], ['Schlüssel für das Hunter-Arsenal', 'gold']]),
  'lodestone_tracker={target:{pos:[I;0,0,0],dimension:"minecraft:overworld"},tracked:false}', ench({ vanishing_curse: 1 }),
  'enchantment_glint_override=false']);

const ARROW = 'minecraft:arrow';

const REPEATER = item('crossbow', [data({ mh: 'repeater' }), `item_name=${txt('Repetierarmbrust', 'gold')}`,
  lore([['Schnellladen III + Durchschuss II', 'yellow'], 'Ersatz für „Schnellladen“: Bögen haben in', 'dieser Minecraft-Version keine Ladeverzauberung.']),
  'unbreakable={}', ench({ quick_charge: 3, piercing: 2, vanishing_curse: 1 })]);

// ---------- special weapons ----------
const W = Object.fromEntries(C.WEAPONS.map((w) => [w.key, w]));
const wbase = (key, extraLore = []) => [data({ mh: key }), `item_name=${txt(W[key].name, 'light_purple')}`, `item_model=${q('manhunt:' + key)}`,
  lore([[W[key].desc, 'gray'], ...extraLore, ['Manhunt-Sonderwaffe', 'dark_purple']])];

function potion(id, key, color, effects) {
  return item(id, [...wbase(key), `potion_contents={custom_color:${color},custom_effects:[${effects.join(',')}]}`]);
}

const WEAPON_ITEMS = {
  explosion_bow: item('bow', [...wbase('explosion_bow'), 'unbreakable={}', ench({ 'manhunt:explosive': 1 }),
    'use_cooldown={seconds:6.0f,cooldown_group:"manhunt:explosion_bow"}']),
  teleport_staff: null, // filled below (needs nested remainder)
  lightning_sword: item('golden_sword', [...wbase('lightning_sword'), 'unbreakable={}', ench({ 'manhunt:lightning': 1 }),
    'attribute_modifiers=[{type:"minecraft:attack_damage",id:"minecraft:base_attack_damage",amount:5.0d,operation:"add_value",slot:"mainhand"},{type:"minecraft:attack_speed",id:"minecraft:base_attack_speed",amount:-2.4d,operation:"add_value",slot:"mainhand"}]']),
  frost_sword: item('copper_sword', [...wbase('frost_sword'), 'unbreakable={}', ench({ 'manhunt:frost': 1 }),
    'attribute_modifiers=[{type:"minecraft:attack_damage",id:"minecraft:base_attack_damage",amount:5.0d,operation:"add_value",slot:"mainhand"},{type:"minecraft:attack_speed",id:"minecraft:base_attack_speed",amount:-2.4d,operation:"add_value",slot:"mainhand"}]']),
  fire_bow: item('bow', [...wbase('fire_bow'), 'unbreakable={}', ench({ flame: 1, 'manhunt:inferno': 1 })]),
  smoke_bomb: potion('lingering_potion', 'smoke_bomb', 3355443, ['{id:"minecraft:blindness",amplifier:0b,duration:480}', '{id:"minecraft:slowness",amplifier:1b,duration:480}']),
  explosion_sword: item('netherite_sword', [...wbase('explosion_sword'), 'unbreakable={}', ench({ 'manhunt:blast': 1 }),
    'attribute_modifiers=[{type:"minecraft:attack_damage",id:"minecraft:base_attack_damage",amount:6.0d,operation:"add_value",slot:"mainhand"},{type:"minecraft:attack_speed",id:"minecraft:base_attack_speed",amount:-2.6d,operation:"add_value",slot:"mainhand"}]']),
  poison_arrows: item('tipped_arrow', [...wbase('poison_arrows'), 'potion_contents={custom_color:5149489,custom_effects:[{id:"minecraft:poison",amplifier:1b,duration:960}]}']),
  grapple: item('fishing_rod', [...wbase('grapple'), 'unbreakable={}']),
  invis_potion: potion('potion', 'invis_potion', 15987699, ['{id:"minecraft:invisibility",amplifier:0b,duration:600}']),
  speed_potion: potion('potion', 'speed_potion', 3402751, ['{id:"minecraft:speed",amplifier:1b,duration:400}']),
};
WEAPON_ITEMS.teleport_staff = teleportStaffItem(5);

function teleportStaffItem(charges) {
  // Build the nested component map for use_remainder in SNBT map syntax and the top level in [] syntax.
  const map = (n) => {
    const e = [
      `"minecraft:custom_data":{mh:"teleport_staff",charges:${n}b}`,
      `"minecraft:item_name":${txt(W.teleport_staff.name, 'light_purple')}`,
      `"minecraft:item_model":"manhunt:teleport_staff"`,
      `"minecraft:lore":[${txt(W.teleport_staff.desc, 'gray')},${txt('Ladungen: ' + n + ' / ' + charges, 'aqua')},${txt('Manhunt-Sonderwaffe', 'dark_purple')}]`,
      `"minecraft:max_stack_size":1`,
      `"minecraft:consumable":{consume_seconds:0.4f,animation:"none",sound:"minecraft:entity.enderman.teleport",has_consume_particles:false,on_consume_effects:[{type:"minecraft:teleport_randomly",diameter:24.0f}]}`,
      `"minecraft:use_cooldown":{seconds:15.0f,cooldown_group:"manhunt:teleport_staff"}`,
    ];
    if (n > 1) e.push(`"minecraft:use_remainder":{id:"minecraft:blaze_rod",count:1,components:{${map(n - 1).join(',')}}}`);
    return e;
  };
  return 'minecraft:blaze_rod[' + map(charges).map((s) => s.replace(/^"minecraft:([a-z_]+)":/, '$1=')).join(',') + ']';
}

// ---------- armor ----------
const SLOTS = [['head', 'helmet'], ['chest', 'chestplate'], ['legs', 'leggings'], ['feet', 'boots']];
const ARMOR_VAL = {
  leather: [1, 3, 2, 1], chainmail: [2, 5, 4, 1], iron: [2, 6, 5, 2], golden: [2, 5, 3, 1], diamond: [3, 8, 6, 3],
};
function armorMods(mat, i, slot, extra = []) {
  const id = `minecraft:armor.${slot}`;
  const mods = [`{type:"minecraft:armor",id:${q(id)},amount:${ARMOR_VAL[mat][i]}.0d,operation:"add_value",slot:${q(slot)}}`];
  return mods.concat(extra.map((e) => e.replace(/SLOT/g, slot)));
}
function setPiece(setKey, i) {
  const s = C.ARMOR_SETS.find((x) => x.key === setKey);
  const [slot, piece] = SLOTS[i];
  const base = [data({ mh_set: setKey }), `item_name=${txt(s.name, 'gold')}`, lore([[s.desc, 'gray'], ['Manhunt-Rüstung', 'dark_purple']]), 'unbreakable={}'];
  switch (setKey) {
    case 'speed':
      return item('leather_' + piece, [...base, 'dyed_color=6737151', `attribute_modifiers=[${armorMods('leather', i, slot, [
        '{type:"minecraft:movement_speed",id:"manhunt:speed_SLOT",amount:0.05d,operation:"add_multiplied_base",slot:"SLOT"}']).join(',')}]`, ench({ vanishing_curse: 1 })]);
    case 'guard':
      return item('iron_' + piece, [...base, `attribute_modifiers=[${armorMods('iron', i, slot, [
        '{type:"minecraft:armor_toughness",id:"manhunt:tough_SLOT",amount:1.0d,operation:"add_value",slot:"SLOT"}']).join(',')}]`, ench({ protection: 2, vanishing_curse: 1 })]);
    case 'fire':
      return item('golden_' + piece, [...base, ench({ fire_protection: 4, vanishing_curse: 1 })]);
    case 'shadow':
      return item('leather_' + piece, [...base, 'dyed_color=1908001', ench(i === 2 ? { swift_sneak: 3, vanishing_curse: 1 } : { vanishing_curse: 1 })]);
    case 'hunter':
      return item('chainmail_' + piece, [...base, ench({ protection: 1, vanishing_curse: 1 })]);
    default: throw new Error(setKey);
  }
}

module.exports = { q, txt, lore, item, data, ench, swordItem, bowItem, COMPASS, ARROW, REPEATER, WEAPON_ITEMS, setPiece, SLOTS, ROMAN };
