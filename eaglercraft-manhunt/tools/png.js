'use strict';
// Tiny PNG decoder/encoder (8-bit and palette images), enough for 16x16 item textures.
const zlib = require('zlib');

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0, plte = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    p += 12 + len;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (il) throw new Error('interlaced PNG not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const bpp = Math.max(1, (chans * bd) >> 3);
  const stride = Math.ceil((w * chans * bd) / 8);
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[i] = v & 255;
    }
    prev = line;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const sample = (idx) => {
        if (bd === 8) return line[idx];
        const bit = idx * bd; const byte = line[bit >> 3]; const shift = 8 - bd - (bit & 7);
        return (byte >> shift) & ((1 << bd) - 1);
      };
      if (ct === 6) { line.copy(out, o, x * 4, x * 4 + 4); }
      else if (ct === 2) { out[o] = line[x * 3]; out[o + 1] = line[x * 3 + 1]; out[o + 2] = line[x * 3 + 2]; out[o + 3] = 255; }
      else if (ct === 0) { const g = sample(x) * (255 / ((1 << bd) - 1)); out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255; }
      else if (ct === 4) { out[o] = out[o + 1] = out[o + 2] = line[x * 2]; out[o + 3] = line[x * 2 + 1]; }
      else if (ct === 3) { const i = sample(x); out[o] = plte[i * 3]; out[o + 1] = plte[i * 3 + 1]; out[o + 2] = plte[i * 3 + 2]; out[o + 3] = trns && i < trns.length ? trns[i] : 255; }
    }
  }
  return { width: w, height: h, data: out };
}

function crc(type, data) { return zlib.crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0; }
function chunk(type, data) {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(type, data));
  return Buffer.concat([l, Buffer.from(type, 'latin1'), data, c]);
}
function encode(img) {
  const { width: w, height: h, data } = img;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh / 6, s, l];
}
function hsl2rgb(hh, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

// Recolor: set every opaque pixel to the given hue (0..1) and scale saturation / lightness.
// opts.mask(x, y, r, g, b) -> bool limits the effect to some pixels.
function recolor(img, hue, sat = 1, light = 1, opts = {}) {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const o = (y * img.width + x) * 4; if (out.data[o + 3] === 0) continue;
    const [r, g, b] = [out.data[o], out.data[o + 1], out.data[o + 2]];
    if (opts.mask && !opts.mask(x, y, r, g, b)) continue;
    const [, s, l] = rgb2hsl(r, g, b);
    const ns = Math.min(1, Math.max(opts.minSat || 0, s) * sat); const nl = Math.min(1, l * light + (opts.lightAdd || 0));
    const [nr, ng, nb] = hsl2rgb(hue, ns, nl);
    out.data[o] = Math.round(nr); out.data[o + 1] = Math.round(ng); out.data[o + 2] = Math.round(nb);
  }
  return out;
}
// Multiply-tint (like Minecraft's layer tint) a grayscale overlay and draw it over base.
function overlayTint(base, overlay, rgb) {
  const out = { width: base.width, height: base.height, data: Buffer.from(base.data) };
  for (let i = 0; i < out.data.length; i += 4) {
    const a = overlay.data[i + 3] / 255; if (!a) continue;
    for (let c = 0; c < 3; c++) out.data[i + c] = Math.round(out.data[i + c] * (1 - a) + (overlay.data[i + c] * rgb[c] / 255) * a);
    out.data[i + 3] = Math.max(out.data[i + 3], overlay.data[i + 3]);
  }
  return out;
}
function setPixel(img, x, y, rgba) { const o = (y * img.width + x) * 4; for (let c = 0; c < 4; c++) img.data[o + c] = rgba[c]; }

module.exports = { decode, encode, recolor, overlayTint, setPixel, rgb2hsl };
