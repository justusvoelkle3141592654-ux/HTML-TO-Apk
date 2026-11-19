'use strict';
// Manhunt command-block engine generator.
//
// Eaglercraft 26.2's integrated server cannot load .mcfunction files (loading any function file
// crashes world start with "CompletableFuture observed before completion"), so all game logic
// runs as one long chain of command blocks: a repeating block followed by chain blocks, executed
// in order every tick. This file produces that ordered command list.
//
// Placeholders:
//   @BUF  -> relative coordinates (~dx ~dy ~dz) of the compass buffer chest inside the engine
//            structure, resolved per command block by the compiler. Use it only right after
//            "execute positioned" (before any "at"), or in "block @BUF".
const C = require('../shared/config');
const I = require('../shared/items');

// The engine is split into modules: "main" runs every tick (repeating command block), every other
// module is an impulse chain that main starts on demand by placing a redstone block at its trigger
// (@TRIG(name)); the module removes the redstone block again as its last command.
const modules = new Map();
let cur = null;
const use = (name) => { if (!modules.has(name)) modules.set(name, []); cur = modules.get(name); };
const add = (...c) => { for (const x of c.flat()) cur.push(x); };
const fire = (name) => `setblock @TRIG(${name}) minecraft:redstone_block`;
use('main');
// Prefix execute subcommands (conditions only) to a command.
const pre = (cond, c) => (c.startsWith('execute ') ? `execute ${cond} ${c.slice(8)}` : `execute ${cond} run ${c}`);
const when = (cond, list) => list.flat().map((c) => pre(cond, c));
const S = (n) => `#${n} mh.sys`;
const K = (n) => `#${n} mh.c`;
const tr = (sel, parts) => `tellraw ${sel} ${JSON.stringify(parts)}`;
const MH = { text: '[Manhunt] ', color: 'gold', bold: true };
const msg = (sel, text, color = 'yellow') => tr(sel, [MH, { text, color, bold: false }]);
const score = (name, obj) => ({ score: { name, objective: obj } });

const RUN = 'if score #state mh.sys matches 1';
const LOBBY = 'if score #state mh.sys matches 0';
const ENDED = 'if score #state mh.sys matches 2';
const NOT_RUN = 'unless score #state mh.sys matches 1';
const NOT_LOBBY = 'unless score #state mh.sys matches 0';
const T20 = 'if score #t20 mh.sys matches 0';
const T10 = 'if score #t10 mh.sys matches 0';
const T5 = 'if score #t5 mh.sys matches 0';
const IN_ROUND = 'team=mh.run'; // used inside selectors with the hunter counterpart below

const minedKeys = Object.keys(C.XP_MINED);
const statObj = (k) => 'mh.s_' + k.replace('deepslate_', 'd').replace('_ore', '').replace('nether_', 'n').replace('_log', 'L').replace('_stem', 'S').slice(0, 10);

// ------------------------------------------------------------------ 0. bootstrap
add('scoreboard objectives add mh.sys dummy');
const boot = [];
const OBJ = [
  ['mh.c', 'dummy'], ['mh.role', 'dummy'], ['mh.act', 'trigger'], ['mh.mod', 'trigger'], ['mh.lvl', 'dummy'], ['mh.xp', 'dummy'],
  ['mh.need', 'dummy'], ['mh.xpt', 'dummy'], ['mh.xpg', 'dummy'], ['mh.tmp', 'dummy'], ['mh.swm', 'dummy'], ['mh.sws', 'dummy'],
  ['mh.bpw', 'dummy'], ['mh.bpu', 'dummy'], ['mh.bfl', 'dummy'], ['mh.bxb', 'dummy'], ['mh.arm', 'dummy'], ['mh.cd1', 'dummy'],
  ['mh.cd2', 'dummy'], ['mh.ab1', 'dummy'], ['mh.ab2', 'dummy'], ['mh.lives', 'dummy'], ['mh.kills', 'dummy'], ['mh.mkill', 'dummy'],
  ['mh.died', 'deathCount'], ['mh.hp', 'health'], ['mh.leave', 'minecraft.custom:minecraft.leave_game'], ['mh.cupd', 'dummy'],
  ['mh.tx', 'dummy'], ['mh.tz', 'dummy'], ['mh.tdim', 'dummy'], ['mh.tsame', 'dummy'], ['mh.tid', 'dummy'], ['mh.ni', 'dummy'],
  ['mh.nd', 'dummy'], ['mh.id', 'dummy'], ['mh.out', 'dummy'], ['mh.adm', 'dummy'], ['mh.wt', 'dummy'], ['mh.rl', 'dummy'],
  ['mh.ri', 'dummy'], ['mh.rd', 'dummy'], ['mh.dragon', 'minecraft.killed:minecraft.ender_dragon'], ['mh.dmg', 'minecraft.custom:minecraft.damage_dealt'],
  ['mh.u_sw', 'dummy'], ['mh.u_bow', 'minecraft.used:minecraft.bow'], ['mh.u_xb', 'minecraft.used:minecraft.crossbow'],
  ['mh.u_gs', 'minecraft.used:minecraft.golden_sword'], ['mh.u_cs', 'minecraft.used:minecraft.copper_sword'],
  ['mh.u_ns', 'minecraft.used:minecraft.netherite_sword'], ['mh.u_tp', 'minecraft.used:minecraft.blaze_rod'],
  ['mh.u_sb', 'minecraft.used:minecraft.lingering_potion'], ['mh.u_gh', 'minecraft.used:minecraft.fishing_rod'],
  ['mh.u_pt', 'minecraft.used:minecraft.potion'], ['mh.u_w1', 'minecraft.used:minecraft.wooden_sword'],
  ['mh.u_w2', 'minecraft.used:minecraft.stone_sword'], ['mh.u_w3', 'minecraft.used:minecraft.iron_sword'],
  ['mh.u_w4', 'minecraft.used:minecraft.diamond_sword'], ['mh.modt', 'dummy'], ['mh.ghs', 'minecraft.used:minecraft.fishing_rod'], ['mh.pullt', 'dummy'], ['mh.age', 'dummy'],
];
for (const k of minedKeys) OBJ.push([statObj(k), 'minecraft.mined:minecraft.' + k]);
for (const [k, crit] of C.XP_OTHER) OBJ.push(['mh.s_' + k, crit]);
for (const [o, c] of OBJ) boot.push(`scoreboard objectives add ${o} ${c}`);
// constants
const consts = { 2: 2, 5: 5, 10: 10, 20: 20, 40: 40, 100: 100, 200: 200, 400: 400, 1200: 1200, 6000: 6000, 12000: 12000, xpa: 40, xpb: 200, ddiv: C.XP_DAMAGE_DIV };
for (const k of minedKeys) consts['w_' + k] = C.XP_MINED[k];
for (const [k, , w] of C.XP_OTHER) consts['w_' + k] = w;
for (const [k, v] of Object.entries(consts)) boot.push(`scoreboard players set ${K(k)} ${v}`);
for (const s of C.SETTINGS) boot.push(`execute unless score ${S(s.key)} matches -2147483648.. run scoreboard players set ${S(s.key)} ${s.def}`);
boot.push(
  'team add mh.run {"text":"Speedrunner","color":"green"}', 'team modify mh.run color green', 'team modify mh.run prefix {"text":"[Runner] ","color":"green"}',
  'team add mh.hunt {"text":"Hunter","color":"red"}', 'team modify mh.hunt color red', 'team modify mh.hunt prefix {"text":"[Hunter] ","color":"red"}',
  'team modify mh.hunt friendlyFire false', 'team modify mh.run friendlyFire false',
  'team add mh.spec {"text":"Zuschauer","color":"gray"}', 'team modify mh.spec color gray',
  'gamerule command_block_output false', 'gamerule player_movement_check false', 'gamerule elytra_movement_check false',
  'gamerule log_admin_commands false', 'gamerule spawn_wandering_traders false',
  `scoreboard players set ${S('state')} 0`, `scoreboard players set ${S('nextid')} 0`,
  `execute positioned @BUF run item replace block ~ ~ ~ container.0 with ${I.COMPASS}`,
  msg('@a', 'Manhunt-Engine installiert. Öffne das Menü mit M (oder Pause-Menü → Manhunt).', 'green'),
  `scoreboard players set ${S('boot')} 1`,
);
use('boot'); add(boot); use('main');
add(`execute unless score ${S('boot')} matches 1 run ${fire('boot')}`);

// ------------------------------------------------------------------ 1. clock
add(`scoreboard players add ${S('tick')} 1`);
for (const n of [5, 10, 20]) add(`scoreboard players operation ${S('t' + n)} = ${S('tick')}`, `scoreboard players operation ${S('t' + n)} %= ${K(n)}`);

// ------------------------------------------------------------------ 2. lobby marker / world setup
use('p20');
add(
  'execute unless entity @e[type=marker,tag=mh.lobby] at @a[limit=1,sort=arbitrary] positioned over motion_blocking_no_leaves run summon marker ~ ~ ~ {Tags:["mh.lobby"]}',
  `execute unless score ${S('lobbyok')} matches 1 at @e[type=marker,tag=mh.lobby,limit=1] run forceload add ~ ~`,
  `execute unless score ${S('lobbyok')} matches 1 at @e[type=marker,tag=mh.lobby,limit=1] run setworldspawn ~ ~ ~`,
  `execute unless score ${S('lobbyok')} matches 1 if entity @e[type=marker,tag=mh.lobby] run scoreboard players set ${S('chestbuild')} 1`,
  `execute unless score ${S('lobbyok')} matches 1 if entity @e[type=marker,tag=mh.lobby] run scoreboard players set ${S('lobbyok')} 1`,
);
// hunter chest (re)build
const LOCK = '{predicates:{"minecraft:custom_data":{mh:"compass"}}}';
use('chest');
add(([
  'execute at @e[type=marker,tag=mh.chest] run setblock ~ ~ ~ air',
  'kill @e[type=marker,tag=mh.chest]', 'kill @e[type=text_display,tag=mh.deco]',
  'execute at @e[type=marker,tag=mh.lobby,limit=1] positioned ~3 ~ ~ positioned over motion_blocking_no_leaves run summon marker ~ ~ ~ {Tags:["mh.chest"]}',
  'execute at @e[type=marker,tag=mh.chest,limit=1] run setblock ~ ~-1 ~ minecraft:bedrock',
  `execute at @e[type=marker,tag=mh.chest,limit=1] run setblock ~ ~ ~ minecraft:chest[facing=west]{lock:${LOCK},CustomName:{"text":"Hunter-Arsenal","color":"dark_red","bold":true}}`,
  'execute at @e[type=marker,tag=mh.chest,limit=1] run summon text_display ~ ~1.55 ~ {Tags:["mh.deco"],billboard:"center",text:{"text":"Hunter-Arsenal","color":"red","bold":true},background:1426063360}',
  'execute at @e[type=marker,tag=mh.chest,limit=1] run summon text_display ~ ~1.25 ~ {Tags:["mh.deco"],billboard:"center",text:{"text":"Nur Hunter · Kompass in der Hand = Schlüssel","color":"gray"},background:1426063360,transformation:{left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[0.6f,0.6f,0.6f]}}',
  `scoreboard players set ${S('refill')} 1`,
  `scoreboard players set ${S('chestbuild')} 0`,
]));
// protect the chest: restore if destroyed, remove dropped arsenal items, slow runners next to it
use('p20');
add(([
  `execute at @e[type=marker,tag=mh.chest,limit=1] unless block ~ ~ ~ minecraft:chest run scoreboard players set ${S('chestbuild')} 1`,
  'execute at @e[type=marker,tag=mh.chest,limit=1] run kill @e[type=item,distance=..8,nbt={Item:{components:{"minecraft:custom_data":{mh_arsenal:1b}}}}]',
  'execute at @e[type=marker,tag=mh.chest,limit=1] run effect give @a[team=mh.run,distance=..5] minecraft:mining_fatigue 2 4 true',
  'execute at @e[type=marker,tag=mh.chest,limit=1] run particle minecraft:flame ~ ~1 ~ 0.3 0.2 0.3 0.005 4',
]));

// ------------------------------------------------------------------ 3. players joining / leaving / admin
use('join');
add(
  'tag @a[tag=!mh.seen,limit=1] add mh.new',
  ...when('as @a[tag=mh.new]', [
    `scoreboard players add ${S('nextid')} 1`,
    `scoreboard players operation @s mh.id = ${S('nextid')}`,
    'scoreboard players set @s mh.role 0', 'scoreboard players set @s mh.lvl 1', 'scoreboard players set @s mh.xp 0',
    'scoreboard players set @s mh.need 240', 'scoreboard players set @s mh.out 0', 'scoreboard players set @s mh.wt 4',
    'scoreboard players set @s mh.ab1 0', 'scoreboard players set @s mh.ab2 0', 'scoreboard players set @s mh.leave 0',
    'tag @s add mh.seen',
  ]),
  // late joiners during a round watch as spectators until they pick a role
  `execute ${RUN} as @a[tag=mh.new] run gamemode spectator @s`,
  `execute ${RUN} as @a[tag=mh.new] run team join mh.spec @s`,
  `execute ${RUN} as @a[tag=mh.new] run ${msg('@s', 'Eine Runde läuft bereits. Du kannst im Menü (M) als Hunter einsteigen.')}`,
  'tag @a[tag=mh.new] remove mh.new',
);
use('p20');
add(
  // welcome: open the menu once (mod client) or the dialog (vanilla client)
  'scoreboard players remove @a[scores={mh.wt=1..}] mh.wt 1',
  'execute as @a[scores={mh.wt=1},tag=mh.mod] run tellraw @s "MHW|"',
  'execute as @a[scores={mh.wt=1},tag=!mh.mod] run dialog show @s manhunt:main',
  `execute as @a[scores={mh.wt=1}] run ${msg('@s', 'Willkommen bei Manhunt! Menü: Taste M (Manhunt-Client) oder ESC → Manhunt.', 'aqua')}`,
  // rejoin
  `execute ${LOBBY} as @a[scores={mh.leave=1..}] at @e[type=marker,tag=mh.lobby,limit=1] run tp @s ~ ~ ~`,
  'scoreboard players set @a[scores={mh.leave=1..}] mh.leave 0',
  'execute unless entity @a[tag=mh.admin] run tag @a[tag=mh.seen,limit=1,sort=arbitrary] add mh.admin',
  'scoreboard players set @a mh.adm 0', 'scoreboard players set @a[tag=mh.admin] mh.adm 1',
  // the Manhunt client renews its "mod active" lease every second; Eaglercraft pauses Lua mods in
  // shared (LAN) worlds, then the vanilla fallback (actionbar HUD, dialog menu) takes over
  'scoreboard players remove @a[scores={mh.modt=1..}] mh.modt 1', 'tag @a[tag=mh.mod,scores={mh.modt=..0}] remove mh.mod',
);
use('main');
add(
  'scoreboard players enable @a mh.act', 'scoreboard players enable @a mh.mod',
  'tag @a[scores={mh.mod=1..}] add mh.mod', 'scoreboard players set @a[scores={mh.mod=1..}] mh.modt 3', 'scoreboard players set @a[scores={mh.mod=1..}] mh.mod 0',
);

// ------------------------------------------------------------------ 4. trigger actions
const A = C.ACT;
const act = (n, extra = '', sc = '') => `@a[scores={mh.act=${n}${sc}}${extra}]`;
const ADMIN_ONLY = (n) => `execute as ${act(n, ',tag=!mh.admin')} run ${msg('@s', 'Nur der Host (Spielleiter) kann das ändern.', 'red')}`;
const adminAct = (n, list) => [ADMIN_ONLY(n), ...when(`if entity ${act(n, ',tag=mh.admin')}`, list)];

// roles
use('act_a');
add(
  `execute ${LOBBY} as ${act(A.ROLE_RUNNER)} run scoreboard players set @s mh.role 1`,
  `execute ${LOBBY} as ${act(A.ROLE_RUNNER)} run ${msg('@s', 'Du bist jetzt Speedrunner. Ziel: Besiege den Enderdrachen!', 'green')}`,
  `execute ${LOBBY} as ${act(A.ROLE_HUNTER)} run scoreboard players set @s mh.role 2`,
  `execute ${LOBBY} as ${act(A.ROLE_HUNTER)} run ${msg('@s', 'Du bist jetzt Hunter. Ziel: Töte den Speedrunner!', 'red')}`,
  `execute ${LOBBY} as ${act(A.ROLE_SPECTATOR)} run scoreboard players set @s mh.role 3`,
  `execute ${LOBBY} as ${act(A.ROLE_SPECTATOR)} run ${msg('@s', 'Du schaust die nächste Runde zu.', 'gray')}`,
  `execute ${RUN} as ${act(A.ROLE_RUNNER)} run ${msg('@s', 'Während einer Runde kannst du nur als Hunter einsteigen.', 'red')}`,
  // late join as hunter
  `execute ${RUN} as ${act(A.ROLE_HUNTER, '', ',mh.role=0')} run tag @s add mh.latejoin`,
  `execute ${RUN} as ${act(A.ROLE_HUNTER, '', ',mh.role=3')} run tag @s add mh.latejoin`,
  `execute ${RUN} as ${act(A.ROLE_HUNTER, ',tag=mh.out', ',mh.role=1')} run tag @s add mh.latejoin`,
  `execute ${ENDED} as ${act(A.ROLE_HUNTER)} run ${msg('@s', 'Die Runde ist vorbei. Warte auf die nächste Runde.', 'gray')}`,
);
add(adminAct(A.RANDOM_ROLES, [
  `execute ${LOBBY} run scoreboard players set @a mh.role 2`,
  `execute ${LOBBY} run scoreboard players set @r mh.role 1`,
  `execute ${LOBBY} run tellraw @a [{"text":"[Manhunt] ","color":"gold","bold":true},{"text":"Zufällige Rollen: Speedrunner ist ","color":"yellow","bold":false},{"selector":"@a[scores={mh.role=1}]","color":"green"}]`,
]));
add(adminAct(A.ALL_HUNTERS, [
  `execute ${LOBBY} run scoreboard players set @a[scores={mh.role=0}] mh.role 2`,
  `execute ${LOBBY} run scoreboard players set @a[scores={mh.role=3}] mh.role 2`,
  `execute ${LOBBY} run ${msg('@a', 'Alle Spieler ohne Rolle sind jetzt Hunter.')}`,
]));
// start / abort / lobby
add(adminAct(A.START, [
  `execute ${LOBBY} store result score ${S('cr')} if entity @a[scores={mh.role=1}]`,
  `execute ${LOBBY} store result score ${S('ch')} if entity @a[scores={mh.role=2}]`,
  `execute ${LOBBY} run scoreboard players operation ${S('cht')} = ${S('ch')}`,
  `execute ${LOBBY} run scoreboard players operation ${S('cht')} += ${S('bots')}`,
  `execute ${LOBBY} if score ${S('cr')} matches 0 run ${msg('@a', 'Start nicht möglich: Es gibt keinen Speedrunner.', 'red')}`,
  `execute ${LOBBY} if score ${S('cr')} matches 1.. if score ${S('cht')} matches 0 run ${msg('@a', 'Start nicht möglich: Es gibt keine Hunter (Spieler oder Bots).', 'red')}`,
  `execute ${LOBBY} if score ${S('cr')} matches 1.. if score ${S('cht')} matches 1.. run scoreboard players set ${S('startreq')} 1`,
  `execute ${RUN} run ${msg('@a', 'Es läuft bereits eine Runde.', 'red')}`,
]));
add(adminAct(A.ABORT, [
  `execute ${RUN} run scoreboard players set ${S('winner')} 3`,
]));
add(adminAct(A.LOBBY, [
  `execute ${NOT_LOBBY} run scoreboard players set ${S('tolobby')} 1`,
]));
// settings: 20 + 2i = next value, 21 + 2i = previous value
C.SETTINGS.forEach((s, i) => {
  for (const dir of [1, -1]) {
    const n = A.SETTING_BASE + 2 * i + (dir === 1 ? 0 : 1);
    const list = [`scoreboard players set ${S('ns')} -999`];
    s.values.forEach((v, j) => {
      const nv = s.values[(j + dir + s.values.length) % s.values.length];
      list.push(`execute if score ${S(s.key)} matches ${v} run scoreboard players set ${S('ns')} ${nv}`);
    });
    list.push(`execute if score ${S('ns')} matches -999 run scoreboard players set ${S('ns')} ${s.def}`);
    list.push(`scoreboard players operation ${S(s.key)} = ${S('ns')}`);
    if (s.key === 'ffire') list.push(`execute if score ${S('ffire')} matches 1 run team modify mh.hunt friendlyFire true`, `execute if score ${S('ffire')} matches 0 run team modify mh.hunt friendlyFire false`);
    if (s.key === 'keepinv') list.push(`execute if score ${S('keepinv')} matches 1 run gamerule keep_inventory true`, `execute if score ${S('keepinv')} matches 0 run gamerule keep_inventory false`);
    list.push(tr('@a[tag=mh.admin]', [MH, { text: s.name + ': ', color: 'yellow', bold: false }, { ...score('#' + s.key, 'mh.sys'), color: 'white' }]));
    add(adminAct(n, list));
  }
});

// ---- purchases (generic level + material check)
use('act_buy');
const purchases = []; // {n, lvl, iron, diamond, tierObj, tierNeed, role, grant:[cmds]}
C.SWORD_MATERIALS.filter((m) => m.tier > 0).forEach((m) => purchases.push({ n: A.SWORD_MAT_BASE + m.tier, lvl: m.lvl, iron: m.iron, diamond: m.diamond,
  tierObj: 'mh.swm', tierNeed: m.tier - 1, grant: [`scoreboard players set @s mh.swm ${m.tier}`, 'tag @s add mh.rbsword'], what: 'Schwert-Material ' + m.name }));
C.SWORD_SHARPNESS.forEach((t) => purchases.push({ n: A.SWORD_SHARP_BASE + t.tier, lvl: t.lvl, iron: t.iron, diamond: t.diamond,
  tierObj: 'mh.sws', tierNeed: t.tier - 1, grant: [`scoreboard players set @s mh.sws ${t.tier}`, 'tag @s add mh.rbsword'], what: 'Schärfe ' + I.ROMAN[t.tier] }));
C.BOW_POWER.forEach((t) => purchases.push({ n: A.BOW_POWER_BASE + t.tier, lvl: t.lvl, iron: t.iron, diamond: t.diamond,
  tierObj: 'mh.bpw', tierNeed: t.tier - 1, grant: [`scoreboard players set @s mh.bpw ${t.tier}`, 'tag @s add mh.rbbow'], what: 'Bogen: Stärke ' + I.ROMAN[t.tier] }));
C.BOW_PUNCH.forEach((t) => purchases.push({ n: A.BOW_PUNCH_BASE + t.tier, lvl: t.lvl, iron: t.iron, diamond: t.diamond,
  tierObj: 'mh.bpu', tierNeed: t.tier - 1, grant: [`scoreboard players set @s mh.bpu ${t.tier}`, 'tag @s add mh.rbbow'], what: 'Bogen: Schlag ' + I.ROMAN[t.tier] }));
purchases.push({ n: A.BOW_FLAME, ...C.BOW_FLAME, tierObj: 'mh.bfl', tierNeed: 0, grant: ['scoreboard players set @s mh.bfl 1', 'tag @s add mh.rbbow'], what: 'Bogen: Flamme' });
purchases.push({ n: A.BOW_REPEATER, ...C.BOW_REPEATER, tierObj: 'mh.bxb', tierNeed: 0, grant: ['scoreboard players set @s mh.bxb 1', `give @s ${I.REPEATER}`, 'give @s minecraft:arrow 16'], what: 'Repetierarmbrust' });
C.ARMOR_PROT.forEach((t) => purchases.push({ n: A.ARMOR_PROT_BASE + t.tier, lvl: t.lvl, iron: t.iron, diamond: t.diamond,
  tierObj: 'mh.arm', tierNeed: t.tier - 1, grant: [`scoreboard players set @s mh.arm ${t.tier}`, 'tag @s add mh.reprot'], what: 'Rüstung: Schutz ' + I.ROMAN[t.tier] }));
C.ARMOR_SETS.forEach((s) => purchases.push({ n: A.ARMOR_SET_BASE + s.id, lvl: s.lvl, iron: s.iron, diamond: s.diamond, role: s.role,
  grant: [0, 1, 2, 3].map((i) => `give @s ${I.setPiece(s.key, i)}`), what: s.name }));
C.WEAPONS.forEach((w) => purchases.push({ n: A.WEAPON_BASE + w.id, lvl: w.lvl, iron: w.iron, diamond: w.diamond,
  grant: [`give @s ${I.WEAPON_ITEMS[w.key]} ${w.count || 1}`], what: w.name }));

for (const p of purchases) {
  const g = act(p.n);
  add(
    `execute as ${g} run scoreboard players set @s mh.rl ${p.lvl}`,
    `execute as ${g} run scoreboard players set @s mh.ri ${p.iron}`,
    `execute as ${g} run scoreboard players set @s mh.rd ${p.diamond}`,
  );
  if (p.tierObj) {
    add(`execute as ${g} unless score @s ${p.tierObj} matches ${p.tierNeed} run tag @s add mh.badtier`);
  }
  if (p.role) add(`execute as ${g} unless score @s mh.role matches ${p.role} run tag @s add mh.badrole`);
  add(`tag ${g} add mh.buy`);
}
// generic checks
add(
  `execute ${NOT_RUN} run tag @a[tag=mh.buy] add mh.badstate`,
  'tag @a[tag=mh.buy,tag=mh.out] add mh.badstate',
  'tag @a[tag=mh.buy,scores={mh.role=0}] add mh.badstate', 'tag @a[tag=mh.buy,scores={mh.role=3}] add mh.badstate',
  'execute as @a[tag=mh.buy] store result score @s mh.ni run clear @s minecraft:iron_ingot 0',
  'execute as @a[tag=mh.buy] store result score @s mh.nd run clear @s minecraft:diamond 0',
  'execute as @a[tag=mh.buy,tag=!mh.badstate,tag=!mh.badtier,tag=!mh.badrole] if score @s mh.lvl >= @s mh.rl if score @s mh.ni >= @s mh.ri if score @s mh.nd >= @s mh.rd run tag @s add mh.buyok',
  `execute as @a[tag=mh.buy,tag=mh.badstate] run ${msg('@s', 'Kaufen ist nur während einer laufenden Runde als aktiver Spieler möglich.', 'red')}`,
  `execute as @a[tag=mh.buy,tag=mh.badtier,tag=!mh.badstate] run ${msg('@s', 'Diese Stufe hast du schon oder dir fehlt die vorherige Stufe.', 'red')}`,
  `execute as @a[tag=mh.buy,tag=mh.badrole,tag=!mh.badstate] run ${msg('@s', 'Das ist für deine Rolle nicht verfügbar.', 'red')}`,
  'execute as @a[tag=mh.buy,tag=!mh.buyok,tag=!mh.badstate,tag=!mh.badtier,tag=!mh.badrole] run tellraw @s [{"text":"[Manhunt] ","color":"gold","bold":true},{"text":"Nicht genug: benötigt Level ","color":"red","bold":false},{"score":{"name":"@s","objective":"mh.rl"}},{"text":", "},{"score":{"name":"@s","objective":"mh.ri"}},{"text":" Eisenbarren, "},{"score":{"name":"@s","objective":"mh.rd"}},{"text":" Diamanten."}]',
);
const ironVals = [...new Set(purchases.map((p) => p.iron).filter((x) => x > 0))];
const diaVals = [...new Set(purchases.map((p) => p.diamond).filter((x) => x > 0))];
for (const v of ironVals) add(`execute as @a[tag=mh.buyok,scores={mh.ri=${v}}] run clear @s minecraft:iron_ingot ${v}`);
for (const v of diaVals) add(`execute as @a[tag=mh.buyok,scores={mh.rd=${v}}] run clear @s minecraft:diamond ${v}`);
for (const p of purchases) {
  add(when(`as @a[tag=mh.buyok,scores={mh.act=${p.n}}]`, p.grant));
  add(`execute as @a[tag=mh.buyok,scores={mh.act=${p.n}}] run ${msg('@s', 'Gekauft: ' + p.what, 'green')}`);
}
add(
  'execute as @a[tag=mh.buyok] at @s run playsound minecraft:block.anvil.use player @s ~ ~ ~ 0.7 1.4',
  'tag @a remove mh.buy', 'tag @a remove mh.buyok', 'tag @a remove mh.badtier', 'tag @a remove mh.badrole', 'tag @a remove mh.badstate',
);
// re-apply protection to worn armor (free)
add(`tag ${act(A.ARMOR_PROT_BASE + 9)} add mh.reprot`);
for (let t = 1; t <= 4; t++) {
  for (const slot of ['head', 'chest', 'legs', 'feet']) add(`execute as @a[tag=mh.reprot,scores={mh.arm=${t}}] run item modify entity @s armor.${slot} manhunt:prot_${t}`);
}
add(`execute as @a[tag=mh.reprot,scores={mh.arm=1..}] run ${msg('@s', 'Getragene Rüstung verstärkt.', 'green')}`,
  `execute as @a[tag=mh.reprot,scores={mh.arm=0}] run ${msg('@s', 'Du hast noch kein Rüstungs-Upgrade gekauft.', 'red')}`, 'tag @a remove mh.reprot');

// ---- abilities
use('act_misc');
add(
  `execute as ${act(A.ABILITY_USE1)} run tag @s add mh.ab1use`,
  `execute as ${act(A.ABILITY_USE2)} run tag @s add mh.ab2use`,
  `execute ${NOT_RUN} as @a[tag=mh.ab1use] run ${msg('@s', 'Fähigkeiten gibt es nur während einer Runde.', 'red')}`,
  `execute ${NOT_RUN} as @a[tag=mh.ab2use] run ${msg('@s', 'Fähigkeiten gibt es nur während einer Runde.', 'red')}`,
  `execute ${NOT_RUN} run tag @a remove mh.ab1use`, `execute ${NOT_RUN} run tag @a remove mh.ab2use`,
  `execute if score ${S('abil')} matches 0 as @a[tag=mh.ab1use] run ${msg('@s', 'Fähigkeiten sind in den Spielregeln deaktiviert.', 'red')}`,
  `execute if score ${S('abil')} matches 0 as @a[tag=mh.ab2use] run ${msg('@s', 'Fähigkeiten sind in den Spielregeln deaktiviert.', 'red')}`,
  `execute if score ${S('abil')} matches 0 run tag @a remove mh.ab1use`, `execute if score ${S('abil')} matches 0 run tag @a remove mh.ab2use`,
  'tag @a[tag=mh.ab1use,tag=mh.out] remove mh.ab1use', 'tag @a[tag=mh.ab2use,tag=mh.out] remove mh.ab2use',
  `execute as @a[tag=mh.ab2use,scores={mh.lvl=..${C.ABILITY_SLOT2_LEVEL - 1}}] run ${msg('@s', 'Fähigkeit 2 wird ab Level ' + C.ABILITY_SLOT2_LEVEL + ' freigeschaltet.', 'red')}`,
  `tag @a[tag=mh.ab2use,scores={mh.lvl=..${C.ABILITY_SLOT2_LEVEL - 1}}] remove mh.ab2use`,
  `execute as @a[tag=mh.ab1use,scores={mh.cd1=1..}] run ${msg('@s', 'Fähigkeit 1 lädt noch.', 'red')}`,
  `execute as @a[tag=mh.ab2use,scores={mh.cd2=1..}] run ${msg('@s', 'Fähigkeit 2 lädt noch.', 'red')}`,
  'tag @a[tag=mh.ab1use,scores={mh.cd1=1..}] remove mh.ab1use', 'tag @a[tag=mh.ab2use,scores={mh.cd2=1..}] remove mh.ab2use',
);
const ABIL_EFFECTS = {
  1: ['effect give @s minecraft:speed 6 2'],
  2: ['effect give @s minecraft:invisibility 6 0', 'effect clear @s minecraft:glowing'],
  3: ['effect give @s minecraft:jump_boost 4 3', 'effect give @s minecraft:slow_falling 6 0', 'effect give @s minecraft:speed 4 0'],
  4: ['effect give @a[team=mh.run,tag=!mh.out] minecraft:glowing 5 0', 'tellraw @s [{"text":"[Manhunt] ","color":"gold","bold":true},{"text":"Ortungspuls: ","color":"aqua","bold":false},{"selector":"@a[team=mh.run,tag=!mh.out]","color":"green"},{"text":" leuchten 5 Sekunden.","color":"aqua"}]'],
  5: ['effect give @s minecraft:speed 8 1'],
  6: ['effect give @s minecraft:strength 6 0', 'effect give @s minecraft:resistance 6 0', 'execute at @s run particle minecraft:angry_villager ~ ~2 ~ 0.4 0.3 0.4 0 8'],
};
for (const slot of [1, 2]) {
  for (const ab of C.ABILITIES) {
    const sel = `@a[tag=mh.ab${slot}use,scores={mh.ab${slot}=${ab.id},mh.role=${ab.role}}]`;
    add(when(`as ${sel}`, [
      ...ABIL_EFFECTS[ab.id],
      `scoreboard players set @s mh.cd${slot} ${ab.cd * 20}`,
      `scoreboard players operation @s mh.cd${slot} *= ${S('cdf')}`,
      `scoreboard players operation @s mh.cd${slot} /= ${K(100)}`,
      'execute at @s run playsound minecraft:entity.illusioner.cast_spell player @a ~ ~ ~ 0.8 1.2',
      `title @s actionbar {"text":"${ab.name} aktiviert!","color":"light_purple"}`,
    ]));
  }
  add(`tag @a remove mh.ab${slot}use`);
}
for (const ab of C.ABILITIES) {
  for (const slot of [1, 2]) {
    const n = (slot === 1 ? A.ABILITY_SET1_BASE : A.ABILITY_SET2_BASE) + ab.id;
    add(
      `execute as ${act(n, '', ',mh.role=' + ab.role)} run scoreboard players set @s mh.ab${slot} ${ab.id}`,
      `execute as ${act(n, '', ',mh.role=' + ab.role)} run ${msg('@s', `Fähigkeit ${slot}: ${ab.name}`, 'green')}`,
      `execute as ${act(n)} unless score @s mh.role matches ${ab.role} run ${msg('@s', 'Diese Fähigkeit gehört zur anderen Rolle.', 'red')}`,
    );
  }
}

// ---- world options (admin)
add(adminAct(A.WORLD_DAY, ['time set day', msg('@a', 'Tageszeit auf Tag gesetzt.')]));
add(adminAct(A.WORLD_CLEAR, ['weather clear', msg('@a', 'Wetter: klar.')]));
['peaceful', 'easy', 'normal', 'hard'].forEach((d, i) => add(adminAct(A.WORLD_DIFF_BASE + i, [`difficulty ${d}`, msg('@a', 'Schwierigkeit: ' + ['Friedlich', 'Einfach', 'Normal', 'Schwer'][i])])));
add(adminAct(A.WORLD_RELOBBY, [
  `execute ${LOBBY} run kill @e[type=marker,tag=mh.lobby]`,
  `execute ${LOBBY} at @a[scores={mh.act=${A.WORLD_RELOBBY}},tag=mh.admin,limit=1] run summon marker ~ ~ ~ {Tags:["mh.lobby"]}`,
  `execute ${LOBBY} run scoreboard players set ${S('lobbyok')} 0`,
  `execute ${LOBBY} run ${msg('@a', 'Lobby/Spawn wurde an die Position des Hosts verlegt.', 'green')}`,
  `execute ${NOT_LOBBY} run ${msg('@a[tag=mh.admin]', 'Die Lobby kann nur zwischen den Runden verlegt werden.', 'red')}`,
]));
add(adminAct(A.WORLD_REBUILD_CHEST, [`scoreboard players set ${S('chestbuild')} 1`, msg('@a', 'Hunter-Arsenal wird neu aufgebaut.', 'green')]));
add(adminAct(A.WORLD_RESET_STATS, [
  `execute ${NOT_RUN} run scoreboard players set @a mh.role 0`,
  `execute ${NOT_RUN} run scoreboard players set ${S('tolobby')} 1`,
  `execute ${NOT_RUN} run ${msg('@a', 'Manhunt-Rollen und Rundendaten wurden zurückgesetzt.', 'green')}`,
  `execute ${RUN} run ${msg('@a[tag=mh.admin]', 'Zuerst die laufende Runde abbrechen.', 'red')}`,
]));
add(`execute as ${act(A.OPEN_DIALOG)} run dialog show @s manhunt:main`);
add(`execute as ${act(A.GRAPPLE)} if items entity @s weapon.mainhand *[custom_data~{mh:"grapple"}] run effect give @s minecraft:slow_falling 3 0 true`);
add(`tag ${act(A.SHOW_RESULTS)} add mh.wantres`);
use('act_a'); add('scoreboard players set @a[scores={mh.act=1..99}] mh.act 0', 'scoreboard players set #syncnow mh.sys 1');
use('act_buy'); add('scoreboard players set @a[scores={mh.act=100..299}] mh.act 0');

// ------------------------------------------------------------------ 5. kits
const giveKit = (sel, compass) => [
  `execute as ${sel} run tag @s add mh.rbsword`, `execute as ${sel} run tag @s add mh.rbbow`,
  `execute as ${sel} unless items entity @s container.* minecraft:arrow run give @s minecraft:arrow 1`,
  ...(compass ? [`execute as ${sel} unless items entity @s container.* *[custom_data~{mh:"compass"}] unless items entity @s weapon.offhand *[custom_data~{mh:"compass"}] run give @s ${I.COMPASS}`] : []),
];
// sword / bow rebuild (clear the old Manhunt weapon, give the current tier)
use('rebuild');
add('execute as @a[tag=mh.rbsword] run clear @s *[custom_data~{mh:"sword"}]');
for (let m = 0; m < C.SWORD_MATERIALS.length; m++) for (let s = 0; s <= 8; s++) add(`execute as @a[tag=mh.rbsword,scores={mh.swm=${m},mh.sws=${s}}] run give @s ${I.swordItem(m, s)}`);
add('tag @a remove mh.rbsword', 'execute as @a[tag=mh.rbbow] run clear @s *[custom_data~{mh:"bow"}]');
for (let pw = 0; pw <= 5; pw++) for (let pu = 0; pu <= 2; pu++) for (let fl = 0; fl <= 1; fl++) add(`execute as @a[tag=mh.rbbow,scores={mh.bpw=${pw},mh.bpu=${pu},mh.bfl=${fl}}] run give @s ${I.bowItem(pw, pu, fl)}`);
add('tag @a remove mh.rbbow');

// late joiners become hunters
use('latejoin');
add(when('as @a[tag=mh.latejoin]', [
  'scoreboard players set @s mh.role 2', 'scoreboard players set @s mh.out 0', 'tag @s remove mh.out', 'team join mh.hunt @s', 'gamemode survival @s', 'clear @s',
  'scoreboard players set @s mh.lvl 1', 'scoreboard players set @s mh.xp 0', 'scoreboard players set @s mh.need 240', 'scoreboard players set @s mh.xpt 0',
  'scoreboard players set @s mh.swm 0', 'scoreboard players set @s mh.sws 0', 'scoreboard players set @s mh.bpw 0', 'scoreboard players set @s mh.bpu 0',
  'scoreboard players set @s mh.bfl 0', 'scoreboard players set @s mh.bxb 0', 'scoreboard players set @s mh.arm 0', 'scoreboard players set @s mh.ab1 5',
  'scoreboard players set @s mh.ab2 4', 'execute at @e[type=marker,tag=mh.lobby,limit=1] run tp @s ~ ~ ~',
  'execute at @e[type=marker,tag=mh.lobby,limit=1] run spawnpoint @s ~ ~ ~', msg('@a', 'Ein neuer Hunter steigt in die Jagd ein!', 'red'),
]));
add(giveKit('@a[tag=mh.latejoin]', true), 'tag @a remove mh.latejoin');

// ------------------------------------------------------------------ 6. round start
const ROUND_SCORES = ['mh.xp', 'mh.xpt', 'mh.xpg', 'mh.swm', 'mh.sws', 'mh.bpw', 'mh.bpu', 'mh.bfl', 'mh.bxb', 'mh.arm', 'mh.cd1', 'mh.cd2',
  'mh.kills', 'mh.mkill', 'mh.out', 'mh.died', 'mh.dragon', 'mh.dmg', 'mh.tdim', 'mh.tsame', 'mh.tid', 'mh.tx', 'mh.tz',
  'mh.u_sw', 'mh.u_bow', 'mh.u_xb', 'mh.u_gs', 'mh.u_cs', 'mh.u_ns', 'mh.u_tp', 'mh.u_sb', 'mh.u_gh', 'mh.u_pt', 'mh.u_w1', 'mh.u_w2', 'mh.u_w3', 'mh.u_w4',
  ...minedKeys.map(statObj), ...C.XP_OTHER.map(([k]) => 'mh.s_' + k)];
const MILESTONE_TAGS = C.XP_MILESTONES.map(([t]) => 'mh.m_' + t);
const startList = [
  `scoreboard players set ${S('state')} 1`, `scoreboard players set ${S('time')} 0`, `scoreboard players set ${S('winner')} 0`,
  `scoreboard players set ${S('tier')} -1`, `scoreboard players set ${S('botcd')} 0`, `scoreboard players set ${S('botn')} 0`,
  `scoreboard players operation ${S('hs')} = ${S('hsset')}`, `scoreboard players operation ${S('hs')} *= ${K(20)}`,
  'kill @e[tag=mh.bot]', 'tag @a remove mh.out', 'tag @a remove mh.dead', ...MILESTONE_TAGS.map((t) => `tag @a remove ${t}`),
  'team join mh.run @a[scores={mh.role=1}]', 'team join mh.hunt @a[scores={mh.role=2}]',
  'team join mh.spec @a[scores={mh.role=0}]', 'team join mh.spec @a[scores={mh.role=3}]',
  'gamemode spectator @a[team=mh.spec]',
  ...ROUND_SCORES.map((o) => `scoreboard players set @a ${o} 0`),
  'scoreboard players set @a mh.lvl 1', 'scoreboard players set @a mh.need 240',
  `execute store result score ${S('rleft')} if entity @a[team=mh.run]`,
  `execute as @a[team=mh.run] run scoreboard players operation @s mh.lives = ${S('lives')}`,
  'execute as @a[team=mh.run] unless score @s mh.ab1 matches 1..3 run scoreboard players set @s mh.ab1 1',
  'execute as @a[team=mh.run] unless score @s mh.ab2 matches 1..3 run scoreboard players set @s mh.ab2 3',
  'execute as @a[team=mh.hunt] unless score @s mh.ab1 matches 4..6 run scoreboard players set @s mh.ab1 5',
  'execute as @a[team=mh.hunt] unless score @s mh.ab2 matches 4..6 run scoreboard players set @s mh.ab2 4',
  ...when('as @a[team=mh.run]', ['clear @s', 'effect clear @s', 'xp set @s 0 levels', 'xp set @s 0 points', 'gamemode survival @s',
    'effect give @s minecraft:instant_health 1 10 true', 'effect give @s minecraft:saturation 1 20 true', 'attribute @s minecraft:max_health modifier remove manhunt:level']),
  ...when('as @a[team=mh.hunt]', ['clear @s', 'effect clear @s', 'xp set @s 0 levels', 'xp set @s 0 points', 'gamemode survival @s',
    'effect give @s minecraft:instant_health 1 10 true', 'effect give @s minecraft:saturation 1 20 true', 'attribute @s minecraft:max_health modifier remove manhunt:level']),
  'execute at @e[type=marker,tag=mh.lobby,limit=1] run tp @a[team=mh.run] ~ ~ ~', 'execute at @e[type=marker,tag=mh.lobby,limit=1] run tp @a[team=mh.hunt] ~ ~ ~',
  'execute at @e[type=marker,tag=mh.lobby,limit=1] run tp @a[team=mh.spec] ~ ~5 ~',
  'execute at @e[type=marker,tag=mh.lobby,limit=1] run spawnpoint @a[team=mh.run] ~ ~ ~', 'execute at @e[type=marker,tag=mh.lobby,limit=1] run spawnpoint @a[team=mh.hunt] ~ ~ ~',
  ...giveKit('@a[team=mh.run]', false), ...giveKit('@a[team=mh.hunt]', true),
  'give @a[team=mh.run] minecraft:bread 4', 'give @a[team=mh.hunt] minecraft:bread 4',
  `execute if score ${S('hs')} matches 1.. run tag @a[team=mh.hunt] add mh.frozen`,
  'execute as @a[tag=mh.frozen] run attribute @s minecraft:movement_speed modifier add manhunt:freeze -1 add_multiplied_total',
  'execute as @a[tag=mh.frozen] run attribute @s minecraft:jump_strength modifier add manhunt:freeze -1 add_multiplied_total',
  'effect give @a[tag=mh.frozen] minecraft:blindness 1000 0 true', 'effect give @a[tag=mh.frozen] minecraft:resistance 1000 4 true',
  `execute if score ${S('hs')} matches 0 run scoreboard players set ${S('botspawn')} 1`,
  'title @a[team=mh.run] title {"text":"LAUF!","color":"green","bold":true}', 'title @a[team=mh.run] subtitle {"text":"Besiege den Enderdrachen","color":"white"}',
  'title @a[team=mh.hunt] title {"text":"JAGD!","color":"red","bold":true}', 'title @a[team=mh.hunt] subtitle {"text":"Töte den Speedrunner","color":"white"}',
  'execute as @a at @s run playsound minecraft:event.raid.horn master @s ~ ~ ~ 0.6 1',
  tr('@a', [MH, { text: 'Die Runde beginnt! Speedrunner: ', color: 'yellow', bold: false }, { selector: '@a[team=mh.run]', color: 'green' }, { text: ' · Hunter: ', color: 'yellow' }, { selector: '@a[team=mh.hunt]', color: 'red' }]),
  'tag @a remove mh.welcomed',
  `execute store result score ${S('diff')} run difficulty`,
  `execute if score ${S('bots')} matches 1.. if score ${S('diff')} matches 0 run difficulty easy`,
  `execute if score ${S('bots')} matches 1.. if score ${S('diff')} matches 0 run ${msg('@a', 'Schwierigkeit auf „Einfach“ gesetzt – auf „Friedlich“ verschwinden die Hunter-Bots.', 'gold')}`,
  `scoreboard players set ${S('startreq')} 0`,
];
use('start'); add(startList);

// ------------------------------------------------------------------ 7. running
use('main');
add(when(RUN, [
  `scoreboard players add ${S('time')} 1`,
  `execute if score ${S('hs')} matches 1.. run scoreboard players remove ${S('hs')} 1`,
  'scoreboard players remove @a[scores={mh.cd1=1..}] mh.cd1 1', 'scoreboard players remove @a[scores={mh.cd2=1..}] mh.cd2 1',
]));
use('p20');
add(when(RUN, [
  `execute if score ${S('hs')} matches 1.. run scoreboard players operation ${S('hssec')} = ${S('hs')}`,
  `execute if score ${S('hs')} matches 1.. run scoreboard players operation ${S('hssec')} /= ${K(20)}`,
  `execute if score ${S('hs')} matches 1.. run title @a[tag=mh.frozen] actionbar [{"text":"Freigabe in ","color":"red"},{"score":{"name":"#hssec","objective":"mh.sys"},"color":"white","bold":true},{"text":" s","color":"red"}]`,
]));
use('release');
add(
  `scoreboard players set ${S('botspawn')} 1`,
  'execute as @a[tag=mh.frozen] run attribute @s minecraft:movement_speed modifier remove manhunt:freeze',
  'execute as @a[tag=mh.frozen] run attribute @s minecraft:jump_strength modifier remove manhunt:freeze',
  'execute as @a[tag=mh.frozen] run effect clear @s minecraft:blindness',
  'execute as @a[tag=mh.frozen] run effect clear @s minecraft:resistance',
  'title @a[team=mh.hunt] title {"text":"LOS!","color":"red","bold":true}',
  msg('@a', 'Die Hunter sind freigelassen!', 'red'),
  'tag @a remove mh.frozen',
);

// ---- deaths & respawns
use('death');
add(when(RUN, [
  'execute as @a[scores={mh.died=1..}] run tag @s add mh.dead',
  'execute as @a[scores={mh.died=1..},team=mh.run] run scoreboard players remove @s mh.lives 1',
  `execute as @a[scores={mh.died=1..,mh.lives=..0},team=mh.run] run scoreboard players remove ${S('rleft')} 1`,
  'execute as @a[scores={mh.died=1..,mh.lives=..0},team=mh.run] run tag @s add mh.out',
  `execute as @a[scores={mh.died=1..,mh.lives=..0},team=mh.run] run tellraw @a [{"text":"[Manhunt] ","color":"gold","bold":true},{"selector":"@s","color":"green"},{"text":" ist ausgeschieden!","color":"red","bold":false}]`,
  `execute as @a[scores={mh.died=1..,mh.lives=1..},team=mh.run] run tellraw @a [{"text":"[Manhunt] ","color":"gold","bold":true},{"selector":"@s","color":"green"},{"text":" ist gestorben, verbleibende Leben: ","color":"yellow","bold":false},{"score":{"name":"@s","objective":"mh.lives"}}]`,
  `execute if score ${S('hresp')} matches 0 as @a[scores={mh.died=1..},team=mh.hunt] run tag @s add mh.out`,
  'scoreboard players set @a[scores={mh.died=1..}] mh.died 0',
  // respawned (health back above zero)
  'execute as @a[tag=mh.dead,scores={mh.hp=1..}] run tag @s add mh.resp',
  'gamemode spectator @a[tag=mh.resp,tag=mh.out]',
  ...giveKit('@a[tag=mh.resp,tag=!mh.out,team=mh.run]', false),
  ...giveKit('@a[tag=mh.resp,tag=!mh.out,team=mh.hunt]', true),
  'tag @a[tag=mh.resp] remove mh.dead', 'tag @a remove mh.resp',
]));
// win conditions
use('main');
add(when(RUN, [
  `execute if score ${S('rleft')} matches ..0 if score ${S('winner')} matches 0 run scoreboard players set ${S('winner')} 2`,
  `execute if entity @a[scores={mh.dragon=1..}] run scoreboard players set ${S('winner')} 1`,
  `scoreboard players operation ${S('tlt')} = ${S('tlimit')}`, `scoreboard players operation ${S('tlt')} *= ${K(1200)}`,
  `execute if score ${S('tlimit')} matches 1.. if score ${S('time')} >= ${S('tlt')} if score ${S('winner')} matches 0 run scoreboard players set ${S('winner')} 4`,
]));
const endList = [
  `scoreboard players set ${S('state')} 2`, `scoreboard players operation ${S('duration')} = ${S('time')}`,
  `scoreboard players operation ${S('dursec')} = ${S('time')}`, `scoreboard players operation ${S('dursec')} /= ${K(20)}`,
  `scoreboard players operation ${S('durmin')} = ${S('dursec')}`, `scoreboard players operation ${S('durmin')} /= ${K('x60')}`,
  'kill @e[tag=mh.bot]', 'tag @a remove mh.frozen',
  'execute as @a run attribute @s minecraft:movement_speed modifier remove manhunt:freeze', 'execute as @a run attribute @s minecraft:jump_strength modifier remove manhunt:freeze',
  `execute if score ${S('winner')} matches 1 run title @a title {"text":"Speedrunner gewinnen!","color":"green","bold":true}`,
  `execute if score ${S('winner')} matches 2 run title @a title {"text":"Hunter gewinnen!","color":"red","bold":true}`,
  `execute if score ${S('winner')} matches 3 run title @a title {"text":"Runde abgebrochen","color":"gray","bold":true}`,
  `execute if score ${S('winner')} matches 4 run title @a title {"text":"Zeit abgelaufen – Hunter gewinnen!","color":"red","bold":true}`,
  `execute if score ${S('winner')} matches 1 run title @a subtitle {"text":"Der Enderdrache wurde besiegt","color":"white"}`,
  `execute if score ${S('winner')} matches 2 run title @a subtitle {"text":"Alle Speedrunner sind ausgeschieden","color":"white"}`,
  `execute if score ${S('winner')} matches 1 at @a[team=mh.run] run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:30,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{explosions:[{shape:"large_ball",colors:[I;5635925,16777045]}]}}}}`,
  `execute if score ${S('winner')} matches 2 at @a[team=mh.hunt] run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:30,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{explosions:[{shape:"large_ball",colors:[I;16733525,16777045]}]}}}}`,
  'execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.8 1',
  'effect give @a minecraft:resistance 30 4 true',
  `scoreboard players set ${S('sendres')} 1`,
];
consts.x60 = 60;
// (constant x60 is added to the bootstrap list below)
use('end'); add(endList); use('main');

// ---- compass (one hunter per tick, round robin)
add(when(RUN, [
  'scoreboard players add @a[team=mh.hunt] mh.cupd 1',
  `scoreboard players set ${S('cmax')} 0`,
  `scoreboard players operation ${S('cmax')} > @a[team=mh.hunt,tag=!mh.out] mh.cupd`,
  `execute as @a[team=mh.hunt,tag=!mh.out] if score @s mh.cupd = ${S('cmax')} run tag @s add mh.ccand`,
  'tag @a[tag=mh.ccand,limit=1] add mh.cur', 'tag @a remove mh.ccand', 'scoreboard players set @a[tag=mh.cur] mh.cupd 0',
  'execute as @a[tag=mh.cur] at @s as @p[team=mh.run,tag=!mh.out,gamemode=!spectator,distance=0..] run tag @s add mh.tgt',
  'scoreboard players set @a[tag=mh.cur] mh.tsame 0',
  'execute if entity @a[tag=mh.tgt] run scoreboard players set @a[tag=mh.cur] mh.tsame 1',
  'execute if entity @a[tag=mh.tgt] positioned @BUF run data modify block ~ ~ ~ Items[0].components."minecraft:lodestone_tracker".target.dimension set from entity @a[tag=mh.tgt,limit=1] Dimension',
  'execute if entity @a[tag=mh.tgt] positioned @BUF store result block ~ ~ ~ Items[0].components."minecraft:lodestone_tracker".target.pos[0] int 1 run data get entity @a[tag=mh.tgt,limit=1] Pos[0]',
  'execute if entity @a[tag=mh.tgt] positioned @BUF store result block ~ ~ ~ Items[0].components."minecraft:lodestone_tracker".target.pos[1] int 1 run data get entity @a[tag=mh.tgt,limit=1] Pos[1]',
  'execute if entity @a[tag=mh.tgt] positioned @BUF store result block ~ ~ ~ Items[0].components."minecraft:lodestone_tracker".target.pos[2] int 1 run data get entity @a[tag=mh.tgt,limit=1] Pos[2]',
  'execute as @a[tag=mh.tgt] store result score @a[tag=mh.cur] mh.tx run data get entity @s Pos[0]',
  'execute as @a[tag=mh.tgt] store result score @a[tag=mh.cur] mh.tz run data get entity @s Pos[2]',
  'execute as @a[tag=mh.tgt] run scoreboard players operation @a[tag=mh.cur] mh.tid = @s mh.id',
  'execute as @a[tag=mh.tgt] at @s if dimension minecraft:overworld run scoreboard players set @a[tag=mh.cur] mh.tdim 0',
  'execute as @a[tag=mh.tgt] at @s if dimension minecraft:the_nether run scoreboard players set @a[tag=mh.cur] mh.tdim 1',
  'execute as @a[tag=mh.tgt] at @s if dimension minecraft:the_end run scoreboard players set @a[tag=mh.cur] mh.tdim 2',
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => `execute if entity @a[tag=mh.tgt] positioned @BUF as @a[tag=mh.cur] if items entity @s hotbar.${n} *[custom_data~{mh:"compass"}] run item replace entity @s hotbar.${n} from block ~ ~ ~ container.0`),
  'execute if entity @a[tag=mh.tgt] positioned @BUF as @a[tag=mh.cur] if items entity @s weapon.offhand *[custom_data~{mh:"compass"}] run item replace entity @s weapon.offhand from block ~ ~ ~ container.0',
  'tag @a remove mh.cur', 'tag @a remove mh.tgt',
]));

// ---- XP
const xpList = ['scoreboard players add #xps mh.sys 1'];
for (const k of minedKeys) {
  const o = statObj(k);
  if (C.XP_MINED[k] === 1) xpList.push(`execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.xpg += @s ${o}`);
  else xpList.push(`execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.tmp = @s ${o}`,
    `execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.tmp *= ${K('w_' + k)}`,
    `execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.xpg += @s mh.tmp`);
  xpList.push(`scoreboard players set @a[scores={${o}=1..}] ${o} 0`);
}
for (const [k] of C.XP_OTHER) {
  const o = 'mh.s_' + k;
  if (k === 'pk') xpList.push(`execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.kills += @s ${o}`);
  if (k === 'mob') xpList.push(`execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.mkill += @s ${o}`);
  xpList.push(`execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.tmp = @s ${o}`,
    `execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.tmp *= ${K('w_' + k)}`,
    `execute as @a[scores={${o}=1..}] run scoreboard players operation @s mh.xpg += @s mh.tmp`,
    `scoreboard players set @a[scores={${o}=1..}] ${o} 0`);
}
xpList.push(
  `execute as @a[scores={mh.dmg=${C.XP_DAMAGE_DIV}..}] run scoreboard players operation @s mh.tmp = @s mh.dmg`,
  `execute as @a[scores={mh.dmg=${C.XP_DAMAGE_DIV}..}] run scoreboard players operation @s mh.tmp /= ${K('ddiv')}`,
  `execute as @a[scores={mh.dmg=${C.XP_DAMAGE_DIV}..}] run scoreboard players operation @s mh.xpg += @s mh.tmp`,
  `execute as @a[scores={mh.dmg=${C.XP_DAMAGE_DIV}..}] run scoreboard players operation @s mh.tmp *= ${K('ddiv')}`,
  `execute as @a[scores={mh.dmg=${C.XP_DAMAGE_DIV}..}] run scoreboard players operation @s mh.dmg -= @s mh.tmp`,
  // survival / chase
  `execute if score #xps mh.sys matches 40.. run scoreboard players add @a[team=mh.run,tag=!mh.out,gamemode=!spectator] mh.xpg ${C.XP_SURVIVE.runner}`,
  `execute if score #xps mh.sys matches 40.. run scoreboard players add @a[team=mh.hunt,tag=!mh.out] mh.xpg ${C.XP_SURVIVE.hunter}`,
  `execute if score #xps mh.sys matches 40.. as @a[team=mh.hunt,tag=!mh.out] at @s if entity @a[team=mh.run,tag=!mh.out,distance=..48] run scoreboard players add @s mh.xpg ${C.XP_SURVIVE.chase}`,
);
for (const [tag, xp, label, cond] of C.XP_MILESTONES) {
  xpList.push(
    `execute as @a[tag=!mh.m_${tag},gamemode=!spectator] at @s ${cond} run tag @s add mh.mnew`,
    `scoreboard players add @a[tag=mh.mnew] mh.xpg ${xp}`,
    `execute as @a[tag=mh.mnew] run ${tr('@s', [MH, { text: 'Meilenstein: ' + label + ' (+' + xp + ' XP)', color: 'aqua', bold: false }])}`,
    `tag @a[tag=mh.mnew] add mh.m_${tag}`, 'tag @a remove mh.mnew',
  );
}
xpList.push(
  'execute as @a[scores={mh.xpg=1..}] run scoreboard players operation @s mh.xpg *= #xpmul mh.sys',
  `execute as @a[scores={mh.xpg=1..}] run scoreboard players operation @s mh.xpg /= ${K(100)}`,
  'execute as @a[scores={mh.xpg=1..}] run scoreboard players operation @s mh.xpt += @s mh.xpg',
  'execute as @a[scores={mh.xpg=1..}] run scoreboard players operation @s mh.xp += @s mh.xpg',
  'scoreboard players set @a[scores={mh.xpg=1..}] mh.xpg 0',
  // level up (one level per tick at most)
  `execute as @a[scores={mh.lvl=..${C.MAX_LEVEL - 1}}] if score @s mh.xp >= @s mh.need run tag @s add mh.lup`,
  'execute as @a[tag=mh.lup] run scoreboard players operation @s mh.xp -= @s mh.need',
  'scoreboard players add @a[tag=mh.lup] mh.lvl 1',
  `execute as @a[tag=mh.lup] run scoreboard players operation @s mh.need = @s mh.lvl`,
  `execute as @a[tag=mh.lup] run scoreboard players operation @s mh.need *= ${K('xpa')}`,
  `execute as @a[tag=mh.lup] run scoreboard players operation @s mh.need += ${K('xpb')}`,
  'execute as @a[tag=mh.lup] run title @s actionbar [{"text":"LEVEL UP! ","color":"gold","bold":true},{"text":"Level ","color":"yellow","bold":false},{"score":{"name":"@s","objective":"mh.lvl"},"color":"white"}]',
  'execute as @a[tag=mh.lup] at @s run playsound minecraft:entity.player.levelup player @s ~ ~ ~ 0.8 1',
  'execute as @a[tag=mh.lup] at @s run particle minecraft:totem_of_undying ~ ~1 ~ 0.4 0.6 0.4 0.2 25',
  'execute as @a[tag=mh.lup] run attribute @s minecraft:max_health modifier remove manhunt:level',
  'execute as @a[tag=mh.lup,scores={mh.lvl=10..19}] run attribute @s minecraft:max_health modifier add manhunt:level 2 add_value',
  'execute as @a[tag=mh.lup,scores={mh.lvl=20..29}] run attribute @s minecraft:max_health modifier add manhunt:level 4 add_value',
  'execute as @a[tag=mh.lup,scores={mh.lvl=30..39}] run attribute @s minecraft:max_health modifier add manhunt:level 6 add_value',
  'execute as @a[tag=mh.lup,scores={mh.lvl=40..49}] run attribute @s minecraft:max_health modifier add manhunt:level 8 add_value',
  'execute as @a[tag=mh.lup,scores={mh.lvl=50..}] run attribute @s minecraft:max_health modifier add manhunt:level 10 add_value',
  `execute as @a[tag=mh.lup,scores={mh.lvl=10}] run ${msg('@s', 'Level-Bonus: +1 Herz maximale Gesundheit (weitere bei 20/30/40/50).', 'aqua')}`,
  `execute as @a[tag=mh.lup,scores={mh.lvl=${C.ABILITY_SLOT2_LEVEL}}] run ${msg('@s', 'Fähigkeit 2 freigeschaltet (Menü M → Fähigkeiten).', 'aqua')}`,
  'tag @a remove mh.lup',
  `execute as @a[scores={mh.lvl=${C.MAX_LEVEL}..}] if score @s mh.xp > @s mh.need run scoreboard players operation @s mh.xp = @s mh.need`,
);
xpList.push('execute if score #xps mh.sys matches 40.. run scoreboard players set #xps mh.sys 0');
use('xp'); add(when(RUN, xpList)); use('main');

// ---- set bonuses (every 10 ticks)
const fullSet = (key) => ['head', 'chest', 'legs', 'feet'].map((s) => `if items entity @s armor.${s} *[custom_data~{mh_set:"${key}"}]`).join(' ');
use('p20');
add(when(RUN, [
  `execute as @a ${fullSet('fire')} run effect give @s minecraft:fire_resistance 2 0 true`,
  `execute as @a[predicate=manhunt:sneaking] ${fullSet('shadow')} run effect give @s minecraft:invisibility 1 0 true`,
  `execute as @a ${fullSet('hunter')} at @s run effect give @a[team=mh.run,tag=!mh.out,distance=..24] minecraft:glowing 1 0 true`,
]));

// ---- hunter arsenal (tiered refills)
const ARS = (s) => s.replace(/custom_data=\{/, 'custom_data={mh_arsenal:1b,');
const plain = (id, n = 1) => `minecraft:${id}[custom_data={mh_arsenal:1b}] ${n}`;
const W = I.WEAPON_ITEMS;
const TIERS = [
  [plain('stone_sword'), plain('iron_sword'), plain('bow'), plain('bow'), plain('arrow', 64), plain('arrow', 64), plain('iron_helmet'), plain('iron_chestplate'),
    plain('iron_leggings'), plain('iron_boots'), plain('shield'), plain('bread', 16), plain('bread', 16), plain('iron_ingot', 8), plain('cobblestone', 64), plain('cobblestone', 64),
    plain('oak_planks', 32), plain('water_bucket'), plain('golden_apple', 2), ARS(W.speed_potion) + ' 1', ARS(W.poison_arrows) + ' 16', ARS(W.smoke_bomb) + ' 2', plain('iron_pickaxe'), plain('iron_axe'), plain('torch', 32)],
  [plain('diamond_sword'), ARS(W.frost_sword) + ' 1', ARS(W.fire_bow) + ' 1', plain('bow'), plain('arrow', 64), plain('arrow', 64), ...[0, 1, 2, 3].map((i) => ARS(I.setPiece('hunter', i)) + ' 1'),
    plain('shield'), plain('cooked_beef', 16), plain('iron_ingot', 16), plain('diamond', 3), plain('golden_apple', 3), ARS(W.invis_potion) + ' 1', ARS(W.speed_potion) + ' 2',
    ARS(W.grapple) + ' 1', ARS(W.teleport_staff) + ' 1', plain('ender_pearl', 4), ARS(W.poison_arrows) + ' 16', ARS(W.smoke_bomb) + ' 3', plain('cobblestone', 64), plain('water_bucket'), plain('diamond_pickaxe')],
  [ARS(W.lightning_sword) + ' 1', ARS(W.explosion_sword) + ' 1', ARS(W.explosion_bow) + ' 1', ARS(W.fire_bow) + ' 1', plain('arrow', 64), plain('arrow', 64), plain('diamond_helmet'),
    plain('diamond_chestplate'), plain('diamond_leggings'), plain('diamond_boots'), ARS(I.REPEATER) + ' 1', plain('shield'), plain('cooked_beef', 32), plain('diamond', 6), plain('golden_apple', 5),
    ARS(W.invis_potion) + ' 2', ARS(W.speed_potion) + ' 2', ARS(W.grapple) + ' 1', ARS(W.teleport_staff) + ' 1', plain('ender_pearl', 8), ARS(W.poison_arrows) + ' 32', ARS(W.smoke_bomb) + ' 4',
    plain('cobblestone', 64), plain('water_bucket'), ARS(W.frost_sword) + ' 1'],
];
TIERS.forEach((t) => { if (t.length > 27) throw new Error('arsenal tier too large'); });
add(when(RUN, [
  `execute if score ${S('arsenal')} matches 0 run scoreboard players set ${S('tierw')} 2`,
  `execute if score ${S('arsenal')} matches 1 run scoreboard players operation ${S('tierw')} = ${S('time')}`,
  `execute if score ${S('arsenal')} matches 1 run scoreboard players operation ${S('tierw')} /= ${K(12000)}`,
  `execute if score ${S('tierw')} matches 3.. run scoreboard players set ${S('tierw')} 2`,
  `execute unless score ${S('tierw')} = ${S('tier')} run scoreboard players set ${S('refill')} 1`,
  `execute unless score ${S('tierw')} = ${S('tier')} if score ${S('tier')} matches 0.. run tellraw @a [{"text":"[Manhunt] ","color":"gold","bold":true},{"text":"Das Hunter-Arsenal wurde aufgerüstet (Stufe ","color":"red","bold":false},{"score":{"name":"#tierw","objective":"mh.sys"}},{"text":")!","color":"red"}]`,
  `scoreboard players operation ${S('tier')} = ${S('tierw')}`,
  `scoreboard players operation ${S('t6k')} = ${S('time')}`, `scoreboard players operation ${S('t6k')} %= ${K(6000)}`,
  `execute if score ${S('t6k')} matches 0 if score ${S('time')} matches 1.. run scoreboard players set ${S('refill')} 1`,
]));
const refill = [];
TIERS.forEach((items, t) => {
  for (let s = 0; s < 27; s++) {
    const it = items[s];
    refill.push(`execute if score ${S('tier')} matches ${t} at @e[type=marker,tag=mh.chest,limit=1] run item replace block ~ ~ ~ container.${s} with ${it ? it : 'minecraft:air'}`);
  }
});
use('refill'); add([...when(RUN, refill), `scoreboard players set ${S('refill')} 0`]); use('p20');
// clear the chest outside of rounds
add(when(LOBBY, ['execute at @e[type=marker,tag=mh.chest,limit=1] if block ~ ~ ~ minecraft:chest run data modify block ~ ~ ~ Items set value []']));

// ---- hunter bots
const BOT_ARMOR = { leather: 'leather', chainmail: 'chainmail', iron: 'iron', diamond: 'diamond' };
const botSummon = (d, archer) => {
  const D = C.BOT_DIFFICULTIES[d];
  const a = BOT_ARMOR[D.armor];
  const eq = archer
    ? `mainhand:{id:"minecraft:bow",count:1${d >= 2 ? ',components:{"minecraft:enchantments":{"minecraft:power":' + (d - 1) + '}}' : ''}}`
    : `mainhand:{id:"minecraft:${D.sword}",count:1${d >= 3 ? ',components:{"minecraft:enchantments":{"minecraft:sharpness":2}}' : ''}}`;
  const effects = D.regen ? ',active_effects:[{id:"minecraft:regeneration",amplifier:0b,duration:-1,show_particles:0b}]' : '';
  const type = archer ? 'skeleton' : 'zombie';
  return `summon minecraft:${type} ~ ~ ~ {CustomName:{"text":"Hunter-Bot","color":"red"},CustomNameVisible:1b,Team:"mh.hunt",Tags:["mh.bot","mh.botnew"],PersistenceRequired:1b,CanPickUpLoot:0b,${archer ? '' : 'CanBreakDoors:1b,IsBaby:0b,'}DeathLootTable:"minecraft:empty",equipment:{${eq},head:{id:"minecraft:player_head",count:1},chest:{id:"minecraft:${a}_chestplate",count:1},legs:{id:"minecraft:${a}_leggings",count:1},feet:{id:"minecraft:${a}_boots",count:1}},drop_chances:{mainhand:0.0f,head:0.0f,chest:0.0f,legs:0.0f,feet:0.0f},attributes:[{id:"minecraft:max_health",base:${D.hp}.0d},{id:"minecraft:follow_range",base:${D.follow}.0d},{id:"minecraft:movement_speed",base:${D.speed}d}${archer ? '' : ',{id:"minecraft:spawn_reinforcements",base:0.0d}'}],Health:${D.hp}.0f${effects}}`;
};
const spread = (sel, min, max) => [
  `execute if dimension minecraft:overworld run spreadplayers ~ ~ ${min} ${max} false ${sel}`,
  `execute if dimension minecraft:the_nether run spreadplayers ~ ~ ${min} ${max} under 118 false ${sel}`,
  `execute if dimension minecraft:the_end run spreadplayers ~ ~ ${min} ${max} false ${sel}`,
];
add(when(RUN, [
  `execute if score ${S('botspawn')} matches 1 run scoreboard players set ${S('botcd')} 0`,
  `execute if score ${S('botspawn')} matches 1 run scoreboard players set ${S('botfirst')} 1`,
  `scoreboard players set ${S('botspawn')} 0`,
  `execute if score ${S('botcd')} matches 1.. run scoreboard players remove ${S('botcd')} 1`,
  `execute store result score ${S('botalive')} if entity @e[tag=mh.bot]`,
  `execute store result score ${S('diff')} run difficulty`,
  `execute if score ${S('hs')} matches 0 if score ${S('botcd')} matches 0 if score ${S('diff')} matches 1.. if score ${S('botalive')} < ${S('bots')} run scoreboard players set ${S('botgo')} 1`,
  `execute if score ${S('botgo')} matches 1 run scoreboard players add ${S('botn')} 1`,
  `execute if score ${S('botgo')} matches 1 run scoreboard players operation ${S('botarch')} = ${S('botn')}`,
  `execute if score ${S('botgo')} matches 1 run scoreboard players operation ${S('botarch')} %= #3 mh.c`,
]));
consts[3] = 3;
for (let d = 0; d < 4; d++) {
  for (const archer of [false, true]) {
    const c = `${RUN} if score ${S('botgo')} matches 1 if score ${S('botdiff')} matches ${d} if score ${S('botarch')} matches ${archer ? '0' : '1..2'}`;
    // first wave at the lobby, later bots respawn behind a speedrunner
    add(`execute ${c} if score ${S('botfirst')} matches 1 at @e[type=marker,tag=mh.lobby,limit=1] run ${botSummon(d, archer)}`);
    add(`execute ${c} unless score ${S('botfirst')} matches 1 at @r[team=mh.run,tag=!mh.out,gamemode=!spectator] run ${botSummon(d, archer)}`);
  }
}
add(when(RUN, [
  `execute unless score ${S('botfirst')} matches 1 as @r[team=mh.run,tag=!mh.out,gamemode=!spectator] at @s rotated as @s positioned ^ ^ ^-40 run ${'tag @e[tag=mh.botnew] add mh.botmove'}`,
  ...spread('@e[tag=mh.botmove]', 1, 8).map((c) => `execute unless score ${S('botfirst')} matches 1 as @r[team=mh.run,tag=!mh.out,gamemode=!spectator] at @s rotated as @s positioned ^ ^ ^-40 ${c.slice(8)}`),
  `execute if score ${S('botgo')} matches 1 if score ${S('botfirst')} matches 1 run scoreboard players set ${S('botcd')} 1`,
  `execute if score ${S('botgo')} matches 1 unless score ${S('botfirst')} matches 1 run scoreboard players set ${S('botcd')} 20`,
  `execute if score ${S('botgo')} matches 1 run ${msg('@a', 'Ein Hunter-Bot ist auf der Jagd.', 'red')}`,
  `execute if score ${S('botalive')} >= ${S('bots')} run scoreboard players set ${S('botfirst')} 0`,
  'tag @e[tag=mh.botnew] remove mh.botmove', 'tag @e[tag=mh.botnew] remove mh.botnew',
  `scoreboard players set ${S('botgo')} 0`,
  // too many bots (setting lowered)
  `execute if score ${S('botalive')} > ${S('bots')} run kill @e[tag=mh.bot,limit=1,sort=random]`,
]));
// catch-up: bots far away from every speedrunner are moved behind one
add(`execute ${RUN} run scoreboard players add ${S('cuc')} 1`);
for (let d = 1; d < 4; d++) {
  const D = C.BOT_DIFFICULTIES[d];
  add(when(`${RUN} if score ${S('botdiff')} matches ${d}`, [
    `scoreboard players operation ${S('tcu')} = ${S('cuc')}`, `scoreboard players set ${S('cuv')} ${D.catchup / 20}`, `scoreboard players operation ${S('tcu')} %= ${S('cuv')}`,
    `execute if score ${S('tcu')} matches 0 as @e[tag=mh.bot] at @s unless entity @a[team=mh.run,tag=!mh.out,gamemode=!spectator,distance=..${D.catchDist}] run tag @s add mh.botfar`,
    ...spread('@e[tag=mh.botfar]', 2, 8).map((c) => `execute if entity @e[tag=mh.botfar] as @r[team=mh.run,tag=!mh.out,gamemode=!spectator] at @s rotated as @s positioned ^ ^ ^-28 ${c.slice(8)}`),
    'tag @e[tag=mh.botfar] remove mh.botfar',
  ]));
}

// ------------------------------------------------------------------ 8. ended / back to lobby
use('results');
add(when(`if score ${S('sendres')} matches 1`, [
  'tag @a add mh.wantres', `scoreboard players set ${S('sendres')} 0`,
  tr('@a', [MH, { text: 'Ergebnis – Dauer: ', color: 'yellow', bold: false }, { ...score('#durmin', 'mh.sys'), color: 'white' }, { text: ' min (', color: 'yellow' }, { ...score('#dursec', 'mh.sys'), color: 'white' }, { text: ' s gesamt)', color: 'yellow' }]),
  'execute as @a[team=mh.run] run tellraw @a [{"text":" Speedrunner ","color":"green"},{"selector":"@s"},{"text":": Level ","color":"gray"},{"score":{"name":"@s","objective":"mh.lvl"}},{"text":", XP ","color":"gray"},{"score":{"name":"@s","objective":"mh.xpt"}},{"text":", Kills ","color":"gray"},{"score":{"name":"@s","objective":"mh.kills"}}]',
  'execute as @a[team=mh.hunt] run tellraw @a [{"text":" Hunter ","color":"red"},{"selector":"@s"},{"text":": Level ","color":"gray"},{"score":{"name":"@s","objective":"mh.lvl"}},{"text":", XP ","color":"gray"},{"score":{"name":"@s","objective":"mh.xpt"}},{"text":", Kills ","color":"gray"},{"score":{"name":"@s","objective":"mh.kills"}}]',
  msg('@a', 'Neue Runde: Menü (M) → Spielübersicht → „Zurück zur Lobby“ (Host).', 'gray'),
]));
use('p20'); add(when(ENDED, ['effect give @a minecraft:saturation 2 0 true']));
use('lobby');
add(([
  `scoreboard players set ${S('state')} 0`, 'kill @e[tag=mh.bot]', 'tag @a remove mh.out', 'tag @a remove mh.frozen', 'tag @a remove mh.dead',
  'team leave @a', 'clear @a', 'effect clear @a', 'gamemode adventure @a', 'xp set @a 0 levels',
  'execute as @a run attribute @s minecraft:max_health modifier remove manhunt:level',
  'execute as @a run attribute @s minecraft:movement_speed modifier remove manhunt:freeze', 'execute as @a run attribute @s minecraft:jump_strength modifier remove manhunt:freeze',
  'execute at @e[type=marker,tag=mh.lobby,limit=1] run tp @a ~ ~ ~', 'execute at @e[type=marker,tag=mh.lobby,limit=1] run spawnpoint @a ~ ~ ~',
  'scoreboard players set @a mh.lvl 1', 'scoreboard players set @a mh.xp 0', 'scoreboard players set @a mh.need 240',
  msg('@a', 'Zurück in der Lobby. Wählt eure Rollen (Menü M) – der Host startet die nächste Runde.', 'green'),
  'scoreboard players set @a[tag=mh.seen] mh.wt 2',
  `scoreboard players set ${S('tolobby')} 0`,
]));
// lobby upkeep
use('p20');
add(when(LOBBY, [
  'effect give @a[tag=mh.seen] minecraft:saturation 2 0 true', 'effect give @a[tag=mh.seen] minecraft:resistance 2 4 true',
  'gamemode adventure @a[gamemode=survival,tag=mh.seen]', 'gamemode adventure @a[gamemode=spectator,tag=mh.seen]',
]));

// ------------------------------------------------------------------ 9. sync to the Manhunt client (hidden chat lines) + vanilla HUD
const P = (o) => ({ score: { name: '@s', objective: o } });
const G = (n) => ({ score: { name: '#' + n, objective: 'mh.sys' } });
const join = (parts) => { const out = []; parts.forEach((p, i) => { if (i) out.push('|'); out.push(p); }); return out; };
const perPlayer = ['MHP', G('state'), P('mh.role'), P('mh.lvl'), P('mh.xp'), P('mh.need'), P('mh.xpt'), P('mh.swm'), P('mh.sws'), P('mh.bpw'), P('mh.bpu'),
  P('mh.bfl'), P('mh.bxb'), P('mh.arm'), P('mh.cd1'), P('mh.cd2'), P('mh.ab1'), P('mh.ab2'), P('mh.lives'), P('mh.kills'), P('mh.tx'), P('mh.tz'),
  P('mh.tdim'), P('mh.tsame'), P('mh.tid'), G('hs'), G('time'), P('mh.adm'), P('mh.out'), P('mh.mkill'), P('mh.id')];
const global = ['MHG', G('state'), G('time'), G('hs'), ...C.SETTINGS.map((s) => G(s.key)), G('winner'), G('duration'), G('tier'), G('botalive'), G('rleft')];
use('main');
add(`execute if score #t10 mh.sys matches 0 as @a[tag=mh.mod] run tellraw @s ${JSON.stringify(join(perPlayer))}`);
use('p20');
add(`tellraw @a[tag=mh.mod] ${JSON.stringify(join(global))}`);

const roster = ['MHL', { selector: '@s' }, P('mh.role'), P('mh.lvl'), P('mh.kills'), P('mh.xpt'), P('mh.out'), P('mh.id'), P('mh.lives'), P('mh.adm')];
add(
  `scoreboard players add ${S('rc')} 1`,
  `execute if score ${S('rc')} matches 2.. as @a[tag=mh.seen] run tellraw @a[tag=mh.mod] ${JSON.stringify(join(roster))}`,
  `execute if score ${S('rc')} matches 2.. run scoreboard players set ${S('rc')} 0`,
);
use('main');
add(`execute if score #syncnow mh.sys matches 1 run tellraw @a[tag=mh.mod] ${JSON.stringify(join(global))}`,
  `execute if score #syncnow mh.sys matches 1 as @a[tag=mh.seen] run tellraw @a[tag=mh.mod] ${JSON.stringify(join(roster))}`,
  'scoreboard players set #syncnow mh.sys 0');
use('p20');
use('act_misc');
add(
  `execute if entity ${act(A.REQUEST_SYNC)} run tellraw @a[tag=mh.mod] ${JSON.stringify(join(global))}`,
  `execute if entity ${act(A.REQUEST_SYNC)} as @a[tag=mh.seen] run tellraw @a[tag=mh.mod] ${JSON.stringify(join(roster))}`,
  'scoreboard players set @a[scores={mh.act=300..}] mh.act 0',
);
use('results');
const resLine = ['MHE', { selector: '@s' }, P('mh.role'), P('mh.lvl'), P('mh.xpt'), P('mh.kills'), P('mh.mkill'), P('mh.u_w1'), P('mh.u_w2'), P('mh.u_w3'), P('mh.u_w4'),
  P('mh.u_bow'), P('mh.u_xb'), P('mh.u_gs'), P('mh.u_cs'), P('mh.u_ns'), P('mh.u_tp'), P('mh.u_sb'), P('mh.u_gh'), P('mh.u_pt'), P('mh.out')];
add(
  `execute if entity @a[tag=mh.wantres] if score ${S('duration')} matches 1.. run tellraw @a[tag=mh.wantres,tag=mh.mod] ${JSON.stringify(join(['MHX', G('winner'), G('duration')]))}`,
  `execute if entity @a[tag=mh.wantres] if score ${S('duration')} matches 1.. as @a[team=mh.run] run tellraw @a[tag=mh.wantres,tag=mh.mod] ${JSON.stringify(join(resLine))}`,
  `execute if entity @a[tag=mh.wantres] if score ${S('duration')} matches 1.. as @a[team=mh.hunt] run tellraw @a[tag=mh.wantres,tag=mh.mod] ${JSON.stringify(join(resLine))}`,
  `execute if entity @a[tag=mh.wantres] if score ${S('duration')} matches 1.. run tellraw @a[tag=mh.wantres,tag=mh.mod] "MHZ|"`,
  'tag @a remove mh.wantres',
);
// vanilla client HUD (actionbar)
use('p20');
add(when(RUN, [
  'execute as @a[tag=!mh.mod,team=mh.run,tag=!mh.out] run title @s actionbar [{"text":"SPEEDRUNNER ","color":"green","bold":true},{"text":"Level ","color":"gold","bold":false},{"score":{"name":"@s","objective":"mh.lvl"},"color":"white"},{"text":"  XP ","color":"gold"},{"score":{"name":"@s","objective":"mh.xp"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"@s","objective":"mh.need"},"color":"white"},{"text":"  Leben ","color":"gold"},{"score":{"name":"@s","objective":"mh.lives"},"color":"white"}]',
  'execute as @a[tag=!mh.mod,team=mh.hunt,tag=!mh.out,tag=!mh.frozen] run title @s actionbar [{"text":"HUNTER ","color":"red","bold":true},{"text":"Level ","color":"gold","bold":false},{"score":{"name":"@s","objective":"mh.lvl"},"color":"white"},{"text":"  XP ","color":"gold"},{"score":{"name":"@s","objective":"mh.xp"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"@s","objective":"mh.need"},"color":"white"},{"text":"  Ziel X ","color":"aqua"},{"score":{"name":"@s","objective":"mh.tx"},"color":"white"},{"text":" Z ","color":"aqua"},{"score":{"name":"@s","objective":"mh.tz"},"color":"white"}]',
]));

// late constants (referenced above)
const lateConsts = [`scoreboard players set ${K('x60')} 60`, `scoreboard players set ${K(3)} 3`];
modules.get('boot').unshift(...lateConsts);

// ------------------------------------------------------------------ grappling hook (server side, works for every client)
use('main');
add(
  'execute as @e[type=minecraft:fishing_bobber,tag=!mh.ghk] at @s unless block ~ ~-0.3 ~ #minecraft:replaceable run tag @s add mh.ghc',
  'execute as @e[type=minecraft:fishing_bobber,tag=mh.ghc] at @s as @p[distance=..40,gamemode=!spectator] if items entity @s weapon.mainhand *[custom_data~{mh:"grapple"}] at @s run kill @e[type=minecraft:marker,tag=mh.anchor,distance=..64]',
  'execute as @e[type=minecraft:fishing_bobber,tag=mh.ghc] at @s as @p[distance=..40,gamemode=!spectator] if items entity @s weapon.mainhand *[custom_data~{mh:"grapple"}] run summon minecraft:marker ~ ~ ~ {Tags:["mh.anchor"]}',
  'execute as @e[type=minecraft:fishing_bobber,tag=mh.ghc] at @s as @p[distance=..40,gamemode=!spectator] if items entity @s weapon.mainhand *[custom_data~{mh:"grapple"}] run scoreboard players set @s mh.ghs 0',
  'execute as @e[type=minecraft:fishing_bobber,tag=mh.ghc] at @s as @p[distance=..40,gamemode=!spectator] if items entity @s weapon.mainhand *[custom_data~{mh:"grapple"}] run tag @s add mh.ghooked',
  'tag @e[type=minecraft:fishing_bobber,tag=mh.ghc] add mh.ghk', 'tag @e[type=minecraft:fishing_bobber,tag=mh.ghc] remove mh.ghc',
  'scoreboard players set @a[tag=mh.ghooked,scores={mh.ghs=1..}] mh.pullt 30',
  'tag @a[tag=mh.ghooked,scores={mh.ghs=1..}] add mh.pull',
  'tag @a[tag=mh.pull] remove mh.ghooked',
  'scoreboard players set @a[scores={mh.ghs=1..},tag=!mh.ghooked] mh.ghs 0',
);
use('grapple');
add(
  'scoreboard players remove @a[tag=mh.pull] mh.pullt 1',
  'execute as @a[tag=mh.pull] at @s unless entity @e[type=minecraft:marker,tag=mh.anchor,distance=..48] run tag @s add mh.pulldone',
  'execute as @a[tag=mh.pull] at @s if entity @e[type=minecraft:marker,tag=mh.anchor,distance=..1.8] run tag @s add mh.pulldone',
  'execute as @a[tag=mh.pull,tag=!mh.pulldone] at @s facing entity @e[type=minecraft:marker,tag=mh.anchor,sort=nearest,limit=1] feet positioned ^ ^ ^1.1 unless block ~ ~ ~ #minecraft:replaceable run tag @s add mh.pulldone',
  'execute as @a[tag=mh.pull,tag=!mh.pulldone] at @s facing entity @e[type=minecraft:marker,tag=mh.anchor,sort=nearest,limit=1] feet positioned ^ ^ ^1.1 unless block ~ ~1 ~ #minecraft:replaceable run tag @s add mh.pulldone',
  'execute as @a[tag=mh.pull,tag=!mh.pulldone] at @s facing entity @e[type=minecraft:marker,tag=mh.anchor,sort=nearest,limit=1] feet run tp @s ^ ^ ^1.1',
  'execute as @a[tag=mh.pull,tag=!mh.pulldone] at @s run particle minecraft:crit ~ ~1 ~ 0.2 0.2 0.2 0 2',
  'tag @a[tag=mh.pull,scores={mh.pullt=..0}] add mh.pulldone',
  'execute as @a[tag=mh.pulldone] run effect give @s minecraft:slow_falling 2 0 true',
  'execute as @a[tag=mh.pulldone] at @s run playsound minecraft:entity.fishing_bobber.retrieve player @a ~ ~ ~ 1 0.8',
  'execute as @a[tag=mh.pulldone] at @s run kill @e[type=minecraft:marker,tag=mh.anchor,sort=nearest,limit=1]',
  'tag @a[tag=mh.pulldone] remove mh.pull', 'tag @a remove mh.pulldone',
);
use('p20');
add('scoreboard players add @e[type=minecraft:marker,tag=mh.anchor] mh.age 1', 'kill @e[type=minecraft:marker,tag=mh.anchor,scores={mh.age=20..}]');

// ------------------------------------------------------------------ dispatch (main starts modules)
use('main');
add(
  `execute if score ${S('chestbuild')} matches 1 run ${fire('chest')}`,
  `execute if entity @a[tag=!mh.seen] run ${fire('join')}`,
  `execute if entity @a[scores={mh.act=1..99}] run ${fire('act_a')}`,
  `execute if entity @a[scores={mh.act=100..299}] run ${fire('act_buy')}`,
  `execute if entity @a[scores={mh.act=300..}] run ${fire('act_misc')}`,
  'scoreboard players set @a[scores={mh.act=..-1}] mh.act 0',
  `execute if entity @a[tag=mh.rbsword] run ${fire('rebuild')}`,
  `execute if entity @a[tag=mh.rbbow] run ${fire('rebuild')}`,
  `execute if entity @a[tag=mh.latejoin] run ${fire('latejoin')}`,
  `execute if score ${S('startreq')} matches 1 run ${fire('start')}`,
  `execute ${RUN} if score ${S('hs')} matches 0 if entity @a[tag=mh.frozen] run ${fire('release')}`,
  `execute ${RUN} if entity @a[scores={mh.died=1..}] run ${fire('death')}`,
  `execute ${RUN} if entity @a[tag=mh.dead,scores={mh.hp=1..}] run ${fire('death')}`,
  `execute ${RUN} if score ${S('winner')} matches 1.. run ${fire('end')}`,
  `execute ${RUN} if score #t10 mh.sys matches 0 run ${fire('xp')}`,
  `execute if score ${S('refill')} matches 1 run ${fire('refill')}`,
  `execute if score #t20 mh.sys matches 0 run ${fire('p20')}`,
  `execute if score ${S('sendres')} matches 1 run ${fire('results')}`,
  `execute if entity @a[tag=mh.wantres] run ${fire('results')}`,
  `execute if score ${S('tolobby')} matches 1 run ${fire('lobby')}`,
  `execute if entity @a[tag=mh.pull] run ${fire('grapple')}`,
);

const MODULES = [...modules].map(([name, commands]) => ({ name, commands }));
module.exports = { modules: MODULES, TIERS };
if (require.main === module) {
  for (const m of MODULES) console.log(m.name.padEnd(10), m.commands.length);
  const all = MODULES.flatMap((m) => m.commands);
  console.log('total', all.length, 'longest', Math.max(...all.map((c) => c.length)));
}
