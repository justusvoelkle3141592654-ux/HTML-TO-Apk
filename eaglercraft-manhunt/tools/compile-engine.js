'use strict';
// Compiles the engine modules into a structure template (data/manhunt/structure/engine.nbt).
//
// Layout (structure coordinates):
//   y=0  command blocks. Every module occupies its own band of rows, separated by an empty row.
//        Its chain starts at (1, 0, z0) facing east and snakes through x = 1..WIDTH.
//        "main" starts with a repeating block (always active); every other module starts with an
//        impulse block whose trigger position is (0, 0, z0): placing a redstone block there runs the
//        module once (next tick); the module's last command removes the redstone block again.
//   y=1  bedrock cover; the compass buffer chest sits at (0, 1, 0).
// Placeholders resolved per command block: @BUF and @TRIG(name) -> relative coordinates.
const { write, T } = require('./nbt');

const WIDTH = 48;          // command blocks per row
const SIZE_X = WIDTH + 1;  // + trigger column
const DATA_VERSION = 4903;

function compile(modules, opts = {}) {
  // ---- layout
  const placed = []; // {module, cmd, pos}
  const trig = {};
  let z = 0;
  for (const mod of modules) {
    const cmds = mod.commands.slice();
    if (mod.name !== 'main') cmds.push(`setblock @TRIG(${mod.name}) minecraft:air`);
    trig[mod.name] = [0, 0, z];
    mod.start = placed.length;
    for (let i = 0; i < cmds.length; i++) {
      const r = Math.floor(i / WIDTH); const c = i % WIDTH;
      placed.push({ mod, cmd: cmds[i], pos: [1 + (r % 2 === 0 ? c : WIDTH - 1 - c), 0, z + r], first: i === 0 });
    }
    mod.end = placed.length;
    z += Math.ceil(cmds.length / WIDTH) + 1; // one empty row between modules
  }
  const rows = z;
  const BUF = [0, 1, 0];
  const rel = (from, to) => `~${to[0] - from[0] || ''} ~${to[1] - from[1] || ''} ~${to[2] - from[2] || ''}`;

  const palette = [];
  const paletteIndex = new Map();
  const state = (name, props) => {
    const key = name + JSON.stringify(props || {});
    if (!paletteIndex.has(key)) {
      paletteIndex.set(key, palette.length);
      const o = { Name: T.string(name) };
      if (props) o.Properties = T.compound(Object.fromEntries(Object.entries(props).map(([k, v]) => [k, T.string(v)])));
      palette.push(T.compound(o));
    }
    return paletteIndex.get(key);
  };
  const blocks = [];
  for (let i = 0; i < placed.length; i++) {
    const b = placed[i];
    const next = i + 1 < b.mod.end ? placed[i + 1].pos : null;
    let facing;
    if (next) facing = next[0] > b.pos[0] ? 'east' : next[0] < b.pos[0] ? 'west' : 'south';
    else facing = ((b.pos[2] - trig[b.mod.name][2]) % 2 === 0) ? 'east' : 'west'; // last block: points nowhere useful
    const name = !b.first ? 'minecraft:chain_command_block' : (b.mod.name === 'main' ? 'minecraft:repeating_command_block' : 'minecraft:command_block');
    let cmd = b.cmd.replace(/@BUF/g, rel(b.pos, BUF)).replace(/@TRIG\(([a-z_0-9]+)\)/g, (s, n) => {
      if (!trig[n]) throw new Error('unknown module in @TRIG: ' + n);
      return rel(b.pos, trig[n]);
    });
    if (cmd.length > 32500) throw new Error('command too long in ' + b.mod.name);
    const auto = !(b.first && b.mod.name !== 'main'); // impulse heads wait for redstone
    blocks.push(T.compound({
      pos: T.list('int', b.pos.map(T.int)),
      state: T.int(state(name, { facing, conditional: 'false' })),
      nbt: T.compound({
        id: T.string('minecraft:command_block'), Command: T.string(cmd), auto: T.byte(auto ? 1 : 0), TrackOutput: T.byte(opts.track ? 1 : 0),
        powered: T.byte(0), conditionMet: T.byte(0), UpdateLastExecution: T.byte(1), SuccessCount: T.int(0),
      }),
    }));
  }
  // cover layer
  const bedrock = state('minecraft:bedrock');
  for (let zz = 0; zz < rows; zz++) for (let x = 0; x < SIZE_X; x++) {
    if (x === BUF[0] && zz === BUF[2]) continue;
    blocks.push(T.compound({ pos: T.list('int', [T.int(x), T.int(1), T.int(zz)]), state: T.int(bedrock) }));
  }
  blocks.push(T.compound({
    pos: T.list('int', BUF.map(T.int)), state: T.int(state('minecraft:chest', { facing: 'north', type: 'single', waterlogged: 'false' })),
    nbt: T.compound({ id: T.string('minecraft:chest'), Items: T.list('compound', []), CustomName: T.string('Manhunt-Puffer') }),
  }));
  const root = T.compound({
    DataVersion: T.int(DATA_VERSION),
    size: T.list('int', [T.int(SIZE_X), T.int(2), T.int(rows)]),
    palette: T.list('compound', palette),
    blocks: T.list('compound', blocks),
    entities: T.list('compound', []),
  });
  return { nbt: write('', root, true), size: [SIZE_X, 2, rows], blocks: placed.length,
    layout: placed.map((b) => ({ m: b.mod.name, p: b.pos, c: b.cmd.slice(0, 120) })), triggers: trig };
}

module.exports = { compile, WIDTH: SIZE_X };
