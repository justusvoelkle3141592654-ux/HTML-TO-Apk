'use strict';
// Single source of truth for Manhunt game values.
// Used by the command-block engine generator (server) and injected into the Lua mod (client).

const MAX_LEVEL = 50;
// XP needed to go from level L to L+1.
const xpNeed = (lvl) => 40 * lvl + 200; // L1: 240, L5: 400, L49: 2160

// XP per statistic unit (before the XP multiplier).
const XP_MINED = {
  coal_ore: 3, deepslate_coal_ore: 3,
  copper_ore: 3, deepslate_copper_ore: 3,
  iron_ore: 8, deepslate_iron_ore: 8,
  gold_ore: 10, deepslate_gold_ore: 10, nether_gold_ore: 3,
  redstone_ore: 5, deepslate_redstone_ore: 5,
  lapis_ore: 6, deepslate_lapis_ore: 6,
  diamond_ore: 40, deepslate_diamond_ore: 40,
  emerald_ore: 30, deepslate_emerald_ore: 30,
  nether_quartz_ore: 3, ancient_debris: 60,
  oak_log: 1, spruce_log: 1, birch_log: 1, jungle_log: 1, acacia_log: 1, dark_oak_log: 1,
  mangrove_log: 1, cherry_log: 1, pale_oak_log: 1, crimson_stem: 1, warped_stem: 1,
};
const XP_OTHER = [
  // [objective suffix, criterion, xp per unit, label]
  ['mob', 'minecraft.custom:minecraft.mob_kills', 8, 'Mob besiegt'],
  ['pk', 'playerKillCount', 120, 'Spieler besiegt'],
  ['blaze', 'minecraft.killed:minecraft.blaze', 20, 'Lohe besiegt (Bonus)'],
  ['ender', 'minecraft.killed:minecraft.enderman', 15, 'Enderman besiegt (Bonus)'],
  ['eye', 'minecraft.crafted:minecraft.ender_eye', 25, 'Enderauge hergestellt'],
  ['rod', 'minecraft.picked_up:minecraft.blaze_rod', 10, 'Lohenrute aufgehoben'],
  ['pearl', 'minecraft.picked_up:minecraft.ender_pearl', 10, 'Enderperle aufgehoben'],
];
const XP_DAMAGE_DIV = 20;          // damage_dealt is stored x10 per HP: 1 XP per 2 HP dealt
const XP_SURVIVE = { runner: 4, hunter: 2, chase: 3, period: 400 }; // every 20 s
const XP_MILESTONES = [
  // [tag, xp, label, condition (execute subcommand run as/at the player)]
  ['nether', 150, 'Nether betreten', 'if dimension minecraft:the_nether'],
  ['fortress', 150, 'Netherfestung gefunden', 'if predicate manhunt:in_fortress'],
  ['bastion', 100, 'Bastion gefunden', 'if predicate manhunt:in_bastion'],
  ['stronghold', 200, 'Festung (Stronghold) gefunden', 'if predicate manhunt:in_stronghold'],
  ['end', 300, 'Das Ende betreten', 'if dimension minecraft:the_end'],
];

// Sword: material track + sharpness track (the menu sells them separately).
const SWORD_MATERIALS = [
  { tier: 0, name: 'Holz', item: 'wooden_sword' },
  { tier: 1, name: 'Stein', item: 'stone_sword', lvl: 3, iron: 2, diamond: 0 },
  { tier: 2, name: 'Eisen', item: 'iron_sword', lvl: 12, iron: 6, diamond: 0 },
  { tier: 3, name: 'Diamant', item: 'diamond_sword', lvl: 22, iron: 0, diamond: 3 },
];
const SWORD_SHARPNESS = [
  { tier: 1, lvl: 5, iron: 3, diamond: 0 },
  { tier: 2, lvl: 10, iron: 5, diamond: 0 },
  { tier: 3, lvl: 15, iron: 8, diamond: 0 },
  { tier: 4, lvl: 20, iron: 0, diamond: 2 },
  { tier: 5, lvl: 25, iron: 0, diamond: 4 },
  { tier: 6, lvl: 30, iron: 0, diamond: 5, extra: 'Verbrennung I' },
  { tier: 7, lvl: 40, iron: 0, diamond: 7, extra: 'Verbrennung II' },
  { tier: 8, lvl: 50, iron: 0, diamond: 9, extra: 'Verbrennung II + Plünderung III' },
];
const BOW_POWER = [
  { tier: 1, lvl: 3, iron: 2, diamond: 0 },
  { tier: 2, lvl: 7, iron: 4, diamond: 0 },
  { tier: 3, lvl: 11, iron: 6, diamond: 0 },
  { tier: 4, lvl: 16, iron: 0, diamond: 1 },
  { tier: 5, lvl: 21, iron: 0, diamond: 3 },
];
const BOW_PUNCH = [
  { tier: 1, lvl: 9, iron: 4, diamond: 0 },
  { tier: 2, lvl: 18, iron: 0, diamond: 2 },
];
const BOW_FLAME = { lvl: 14, iron: 5, diamond: 0 };
// Bows of this version have no draw-speed enchantment: Quick Charge only exists for crossbows.
const BOW_REPEATER = { lvl: 26, iron: 0, diamond: 4 };

const ARMOR_PROT = [
  { tier: 1, lvl: 6, iron: 6, diamond: 0 },
  { tier: 2, lvl: 12, iron: 10, diamond: 0 },
  { tier: 3, lvl: 18, iron: 0, diamond: 3 },
  { tier: 4, lvl: 24, iron: 0, diamond: 6 },
];

// Special armor sets. role: 0 = both, 1 = runner only, 2 = hunter only.
const ARMOR_SETS = [
  { id: 1, key: 'speed', name: 'Läuferrüstung', role: 1, lvl: 8, iron: 10, diamond: 0,
    desc: 'Leder, jedes Teil +5 % Tempo (volles Set +20 %).' },
  { id: 2, key: 'guard', name: 'Schutzrüstung', role: 0, lvl: 14, iron: 16, diamond: 0,
    desc: 'Eisen mit Schutz II und +1 Härte pro Teil.' },
  { id: 3, key: 'fire', name: 'Feuerschutzrüstung', role: 0, lvl: 16, iron: 8, diamond: 2,
    desc: 'Feuerschutz IV, volles Set: dauerhaft Feuerresistenz.' },
  { id: 4, key: 'shadow', name: 'Schattenrüstung', role: 1, lvl: 20, iron: 0, diamond: 6,
    desc: 'Schleichen macht unsichtbar (volles Set), Huschen III.' },
  { id: 5, key: 'hunter', name: 'Jägerrüstung', role: 2, lvl: 10, iron: 12, diamond: 0,
    desc: 'Kettenrüstung, volles Set: Speedrunner in 24 Blöcken leuchten.' },
];

// Special weapons. role: 0 both. count: stack size given.
const WEAPONS = [
  { id: 1, key: 'explosion_bow', name: 'Explosionsbogen', lvl: 18, iron: 0, diamond: 3,
    desc: 'Pfeile explodieren beim Aufprall (kein Blockschaden). Abklingzeit 6 s.' },
  { id: 2, key: 'teleport_staff', name: 'Teleportationsstab', lvl: 12, iron: 8, diamond: 0,
    desc: 'Rechtsklick: Teleport an einen zufälligen Ort im Umkreis von 12 Blöcken. Abklingzeit 15 s.' },
  { id: 3, key: 'lightning_sword', name: 'Blitzschwert', lvl: 20, iron: 0, diamond: 4,
    desc: 'Treffer ruft einen Blitz auf das Ziel. Abklingzeit 8 s.' },
  { id: 4, key: 'frost_sword', name: 'Frostschwert', lvl: 10, iron: 10, diamond: 0,
    desc: 'Treffer verlangsamt das Ziel stark für 2 s.' },
  { id: 5, key: 'fire_bow', name: 'Feuerbogen', lvl: 8, iron: 8, diamond: 0,
    desc: 'Brennende Pfeile, Treffer setzen das Ziel 8 s in Brand.' },
  { id: 6, key: 'smoke_bomb', name: 'Rauchbombe', lvl: 4, iron: 3, diamond: 0, count: 2,
    desc: 'Werfen: Rauchwolke (Blindheit + Langsamkeit) für alle darin, 6 s.' },
  { id: 7, key: 'explosion_sword', name: 'Explosionsschwert', lvl: 28, iron: 0, diamond: 6,
    desc: 'Treffer löst eine Explosion am Ziel aus: hoher Zusatzschaden und Rückstoß (kein Blockschaden). Abklingzeit 10 s.' },
  { id: 8, key: 'poison_arrows', name: 'Giftpfeile', lvl: 6, iron: 4, diamond: 0, count: 8,
    desc: 'Pfeile mit Vergiftung II (6 s).' },
  { id: 9, key: 'grapple', name: 'Enterhaken', lvl: 5, iron: 5, diamond: 0,
    desc: 'Haken auswerfen, an einer Oberfläche einhaken lassen, einholen: zieht dich hin. Abklingzeit: 1 Zug pro Wurf.' },
  { id: 10, key: 'invis_potion', name: 'Unsichtbarkeitstrank', lvl: 9, iron: 6, diamond: 0,
    desc: 'Unsichtbarkeit für 30 s (Rüstung bleibt sichtbar).' },
  { id: 11, key: 'speed_potion', name: 'Geschwindigkeitstrank', lvl: 3, iron: 3, diamond: 0,
    desc: 'Tempo II für 20 s.' },
];

const ABILITIES = [
  { id: 1, role: 1, name: 'Sprintschub', cd: 45, desc: 'Tempo III für 6 s.' },
  { id: 2, role: 1, name: 'Schattenschritt', cd: 90, desc: 'Unsichtbarkeit 6 s, entfernt Leuchten.' },
  { id: 3, role: 1, name: 'Fluchtsprung', cd: 40, desc: 'Sprungkraft IV 4 s, Sanfter Fall 6 s, Tempo I 4 s.' },
  { id: 4, role: 2, name: 'Ortungspuls', cd: 60, desc: 'Alle Speedrunner leuchten 5 s, Entfernung im Chat.' },
  { id: 5, role: 2, name: 'Jagdfieber', cd: 50, desc: 'Tempo II für 8 s.' },
  { id: 6, role: 2, name: 'Kampfschrei', cd: 75, desc: 'Stärke I + Resistenz I für 6 s.' },
];
const ABILITY_SLOT2_LEVEL = 8;

const BOT_DIFFICULTIES = [
  { id: 0, name: 'Einfach', hp: 20, speed: 0.23, follow: 24, sword: 'wooden_sword', armor: 'leather', catchup: 0, catchDist: 0, regen: false },
  { id: 1, name: 'Normal', hp: 24, speed: 0.25, follow: 32, sword: 'stone_sword', armor: 'chainmail', catchup: 1200, catchDist: 96, regen: false },
  { id: 2, name: 'Schwer', hp: 30, speed: 0.27, follow: 48, sword: 'iron_sword', armor: 'iron', catchup: 600, catchDist: 64, regen: false },
  { id: 3, name: 'Experte', hp: 40, speed: 0.29, follow: 64, sword: 'diamond_sword', armor: 'diamond', catchup: 400, catchDist: 48, regen: true },
];

// Settings (fake players in mh.sys). values: allowed cycle values.
const SETTINGS = [
  { key: 'bots', name: 'Hunter-Bots', def: 0, values: [0, 1, 2, 3, 4, 5] },
  { key: 'botdiff', name: 'Bot-Schwierigkeit', def: 1, values: [0, 1, 2, 3], labels: BOT_DIFFICULTIES.map((d) => d.name) },
  { key: 'hsset', name: 'Vorsprung (s)', def: 30, values: [0, 15, 30, 60, 90] },
  { key: 'lives', name: 'Leben Speedrunner', def: 1, values: [1, 2, 3] },
  { key: 'tlimit', name: 'Zeitlimit (min)', def: 0, values: [0, 30, 60, 90, 120], labels: ['Aus', '30', '60', '90', '120'] },
  { key: 'xpmul', name: 'XP-Multiplikator (%)', def: 100, values: [50, 100, 150, 200, 300] },
  { key: 'arsenal', name: 'Hunter-Arsenal', def: 1, values: [0, 1], labels: ['Sofort komplett', 'Gestaffelt (alle 10 min)'] },
  { key: 'abil', name: 'Fähigkeiten', def: 1, values: [0, 1], labels: ['Aus', 'An'] },
  { key: 'cdf', name: 'Abklingzeit-Faktor (%)', def: 100, values: [50, 75, 100, 150, 200] },
  { key: 'hresp', name: 'Hunter respawnen', def: 1, values: [0, 1], labels: ['Nein (ausgeschieden)', 'Ja'] },
  { key: 'ffire', name: 'Teambeschuss Hunter', def: 0, values: [0, 1], labels: ['Aus', 'An'] },
  { key: 'keepinv', name: 'Inventar behalten (Hunter)', def: 1, values: [0, 1], labels: ['Nein', 'Ja'] },
];

// Trigger action ids (scoreboard trigger mh.act).
const ACT = {
  ROLE_RUNNER: 1, ROLE_HUNTER: 2, ROLE_SPECTATOR: 3,
  START: 10, ABORT: 11, LOBBY: 12, RANDOM_ROLES: 13, ALL_HUNTERS: 14,
  SETTING_BASE: 20, // 20 + 2*i = next value, 21 + 2*i = previous value
  SWORD_MAT_BASE: 100, // 100 + tier
  SWORD_SHARP_BASE: 110, // 110 + tier
  BOW_POWER_BASE: 120, BOW_PUNCH_BASE: 130, BOW_FLAME: 140, BOW_REPEATER: 141,
  ARMOR_PROT_BASE: 150, ARMOR_SET_BASE: 160,
  WEAPON_BASE: 200, // 200 + weapon id
  ABILITY_USE1: 301, ABILITY_USE2: 302,
  ABILITY_SET1_BASE: 310, ABILITY_SET2_BASE: 320, // + ability id
  WORLD_DAY: 401, WORLD_CLEAR: 402, WORLD_DIFF_BASE: 410, // 410..413 peaceful..hard
  WORLD_RELOBBY: 420, WORLD_REBUILD_CHEST: 421, WORLD_RESET_STATS: 422,
  REQUEST_SYNC: 500, SHOW_RESULTS: 501, OPEN_DIALOG: 502, GRAPPLE: 503,
};

module.exports = {
  MAX_LEVEL, xpNeed, XP_MINED, XP_OTHER, XP_DAMAGE_DIV, XP_SURVIVE, XP_MILESTONES,
  SWORD_MATERIALS, SWORD_SHARPNESS, BOW_POWER, BOW_PUNCH, BOW_FLAME, BOW_REPEATER,
  ARMOR_PROT, ARMOR_SETS, WEAPONS, ABILITIES, ABILITY_SLOT2_LEVEL, BOT_DIFFICULTIES, SETTINGS, ACT,
};
