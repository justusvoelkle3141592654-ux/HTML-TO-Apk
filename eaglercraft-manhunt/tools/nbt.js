'use strict';
// Minimal NBT (Java edition, big endian) reader/writer.
// Values are represented as { type, value } nodes so that round trips keep exact tag types.
//   type: 'byte','short','int','long','float','double','byteArray','string','list','compound','intArray','longArray'
//   list: { type:'list', elemType, value:[nodes] } ; compound: { type:'compound', value:{ name: node } }
const zlib = require('zlib');

const IDS = ['end', 'byte', 'short', 'int', 'long', 'float', 'double', 'byteArray', 'string', 'list', 'compound', 'intArray', 'longArray'];
const ID = Object.fromEntries(IDS.map((n, i) => [n, i]));

function read(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  let p = 0;
  const u8 = () => buf[p++];
  const str = () => { const l = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + l); p += l; return s; };
  function payload(t) {
    switch (t) {
      case 1: { const v = buf.readInt8(p); p += 1; return v; }
      case 2: { const v = buf.readInt16BE(p); p += 2; return v; }
      case 3: { const v = buf.readInt32BE(p); p += 4; return v; }
      case 4: { const v = buf.readBigInt64BE(p); p += 8; return v; }
      case 5: { const v = buf.readFloatBE(p); p += 4; return v; }
      case 6: { const v = buf.readDoubleBE(p); p += 8; return v; }
      case 7: { const l = buf.readInt32BE(p); p += 4; const v = Array.from(buf.subarray(p, p + l), (b) => (b << 24) >> 24); p += l; return v; }
      case 8: return str();
      case 9: { const et = u8(); const l = buf.readInt32BE(p); p += 4; const v = []; for (let i = 0; i < l; i++) v.push({ type: IDS[et], value: payload(et) }); return { elemType: IDS[et], items: v }; }
      case 10: { const o = {}; for (;;) { const ct = u8(); if (ct === 0) break; const n = str(); o[n] = node(ct); } return o; }
      case 11: { const l = buf.readInt32BE(p); p += 4; const v = []; for (let i = 0; i < l; i++) { v.push(buf.readInt32BE(p)); p += 4; } return v; }
      case 12: { const l = buf.readInt32BE(p); p += 4; const v = []; for (let i = 0; i < l; i++) { v.push(buf.readBigInt64BE(p)); p += 8; } return v; }
      default: throw new Error('bad NBT tag ' + t);
    }
  }
  function node(t) {
    const v = payload(t);
    if (t === 9) return { type: 'list', elemType: v.elemType, value: v.items };
    return { type: IDS[t], value: v };
  }
  const t = u8();
  const name = str();
  return { name, root: node(t) };
}

function write(rootName, root, gzip = true) {
  const parts = [];
  const push = (b) => parts.push(b);
  const str = (s) => { const b = Buffer.from(s, 'utf8'); const l = Buffer.alloc(2); l.writeUInt16BE(b.length); push(l); push(b); };
  function payload(n) {
    const v = n.value;
    switch (n.type) {
      case 'byte': { const b = Buffer.alloc(1); b.writeInt8(v); push(b); break; }
      case 'short': { const b = Buffer.alloc(2); b.writeInt16BE(v); push(b); break; }
      case 'int': { const b = Buffer.alloc(4); b.writeInt32BE(v); push(b); break; }
      case 'long': { const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(v)); push(b); break; }
      case 'float': { const b = Buffer.alloc(4); b.writeFloatBE(v); push(b); break; }
      case 'double': { const b = Buffer.alloc(8); b.writeDoubleBE(v); push(b); break; }
      case 'byteArray': { const b = Buffer.alloc(4 + v.length); b.writeInt32BE(v.length); v.forEach((x, i) => b.writeInt8(x, 4 + i)); push(b); break; }
      case 'string': str(v); break;
      case 'list': {
        const et = v.length ? v[0].type : (n.elemType || 'end');
        const b = Buffer.alloc(5); b.writeUInt8(ID[et]); b.writeInt32BE(v.length, 1); push(b);
        for (const x of v) { if (x.type !== et) throw new Error('mixed list'); payload(x); }
        break;
      }
      case 'compound': {
        for (const [k, x] of Object.entries(v)) { push(Buffer.from([ID[x.type]])); str(k); payload(x); }
        push(Buffer.from([0]));
        break;
      }
      case 'intArray': { const b = Buffer.alloc(4 + 4 * v.length); b.writeInt32BE(v.length); v.forEach((x, i) => b.writeInt32BE(x, 4 + 4 * i)); push(b); break; }
      case 'longArray': { const b = Buffer.alloc(4 + 8 * v.length); b.writeInt32BE(v.length); v.forEach((x, i) => b.writeBigInt64BE(BigInt(x), 4 + 8 * i)); push(b); break; }
      default: throw new Error('bad node type ' + n.type);
    }
  }
  push(Buffer.from([ID[root.type]])); str(rootName); payload(root);
  const out = Buffer.concat(parts);
  return gzip ? zlib.gzipSync(out) : out;
}

// Plain-JS view for debugging.
function plain(n) {
  if (n.type === 'compound') return Object.fromEntries(Object.entries(n.value).map(([k, v]) => [k, plain(v)]));
  if (n.type === 'list') return n.value.map(plain);
  if (n.type === 'long') return n.value.toString() + 'L';
  if (n.type === 'longArray') return n.value.map((x) => x.toString() + 'L');
  return n.value;
}

// Helpers to build nodes.
const T = {
  byte: (v) => ({ type: 'byte', value: v }),
  short: (v) => ({ type: 'short', value: v }),
  int: (v) => ({ type: 'int', value: v }),
  long: (v) => ({ type: 'long', value: BigInt(v) }),
  float: (v) => ({ type: 'float', value: v }),
  double: (v) => ({ type: 'double', value: v }),
  string: (v) => ({ type: 'string', value: v }),
  list: (elemType, items) => ({ type: 'list', elemType, value: items }),
  compound: (o) => ({ type: 'compound', value: o }),
  intArray: (v) => ({ type: 'intArray', value: v }),
};

module.exports = { read, write, plain, T };
