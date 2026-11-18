'use strict';
// Reader/writer for the Eaglercraft EPK v2.0 asset archive ("EAGPKG$$").
// Layout (as found in the shipped assets.epk):
//   "EAGPKG$$" | u8 len + "ver2.0" | u8 len + archive name | u16 len + comment
//   | u64 timestamp | u32 entry count | u8 compression ('G' gzip, 'Z' zlib, '0' none)
//   | compressed body | ":::YEE:>"
// Body entries:
//   "HEAD" | u8 len + key | u32 len + value | '>'
//   "FILE" | u8 len + name | u32 (4 + data + 1) | u32 crc32 | data | ':' | '>'
//   "END$"
const zlib = require('zlib');

function parse(buf) {
  if (buf.toString('latin1', 0, 8) !== 'EAGPKG$$') throw new Error('not an EPK archive');
  let p = 8;
  const vl = buf[p++]; const version = buf.toString('latin1', p, p + vl); p += vl;
  const nl = buf[p++]; const name = buf.toString('latin1', p, p + nl); p += nl;
  const cl = buf.readUInt16BE(p); p += 2; const comment = buf.toString('latin1', p, p + cl); p += cl;
  const timestamp = buf.readBigUInt64BE(p); p += 8;
  const count = buf.readUInt32BE(p); p += 4;
  const compression = String.fromCharCode(buf[p++]);
  const tail = buf.lastIndexOf(Buffer.from(':::YEE:>'));
  if (tail < 0) throw new Error('EPK tail missing');
  let body = buf.subarray(p, tail);
  if (compression === 'G') body = zlib.gunzipSync(body);
  else if (compression === 'Z') body = zlib.inflateSync(body);
  else if (compression !== '0') throw new Error('unknown EPK compression ' + compression);
  const entries = [];
  let q = 0;
  while (q < body.length) {
    const type = body.toString('latin1', q, q + 4); q += 4;
    if (type === 'END$') break;
    const l = body[q++]; const n = body.toString('utf8', q, q + l); q += l;
    const len = body.readUInt32BE(q); q += 4;
    let data;
    if (type === 'FILE') {
      const crc = body.readUInt32BE(q);
      data = Buffer.from(body.subarray(q + 4, q + len - 1));
      if (body[q + len - 1] !== 0x3a) throw new Error('bad FILE terminator: ' + n);
      if (zlib.crc32(data) !== crc) throw new Error('crc mismatch: ' + n);
      q += len;
    } else if (type === 'HEAD') {
      data = Buffer.from(body.subarray(q, q + len)); q += len;
    } else {
      throw new Error('unknown EPK entry type ' + type);
    }
    if (body[q] !== 0x3e) throw new Error('bad entry terminator: ' + n);
    q++;
    entries.push({ type, name: n, data });
  }
  if (entries.length !== count) throw new Error('entry count mismatch ' + entries.length + ' != ' + count);
  return { version, name, comment, timestamp, compression, entries };
}

function build(epk) {
  const parts = [];
  for (const e of epk.entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    if (nameBuf.length > 255) throw new Error('EPK entry name too long: ' + e.name);
    parts.push(Buffer.from(e.type, 'latin1'), Buffer.from([nameBuf.length]), nameBuf);
    const len = Buffer.alloc(4);
    if (e.type === 'FILE') {
      len.writeUInt32BE(e.data.length + 5);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(e.data) >>> 0);
      parts.push(len, crc, e.data, Buffer.from(':>', 'latin1'));
    } else {
      len.writeUInt32BE(e.data.length);
      parts.push(len, e.data, Buffer.from('>', 'latin1'));
    }
  }
  parts.push(Buffer.from('END$', 'latin1'));
  const body = zlib.gzipSync(Buffer.concat(parts), { level: 9 });
  const name = Buffer.from(epk.name, 'latin1');
  const comment = Buffer.from(epk.comment, 'latin1');
  const head = [Buffer.from('EAGPKG$$', 'latin1'), Buffer.from([epk.version.length]), Buffer.from(epk.version, 'latin1'),
    Buffer.from([name.length]), name];
  const cl = Buffer.alloc(2); cl.writeUInt16BE(comment.length);
  const ts = Buffer.alloc(8); ts.writeBigUInt64BE(epk.timestamp);
  const cnt = Buffer.alloc(4); cnt.writeUInt32BE(epk.entries.length);
  return Buffer.concat([...head, cl, comment, ts, cnt, Buffer.from('G', 'latin1'), body, Buffer.from(':::YEE:>', 'latin1')]);
}

module.exports = { parse, build };
