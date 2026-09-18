// 生成 PWA 图标（纯 Node，无依赖）：深色底 + 轨条 + 周刻度。
// 用法:
//   node make-icon.mjs --out <目录> --sizes 180,192,512            # 默认三轨配色（蓝/紫/绿）
//   node make-icon.mjs --out <目录> --tracks 4c9aff,63799c,63799c  # 自定义各条颜色（软考版：只亮主色）
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = argOf("--out", ".");
const SIZES = argOf("--sizes", "180,192,512").split(",").map(s => parseInt(s.trim(), 10)).filter(Boolean);
const hexToRgb = h => [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
const TRACKS = argOf("--tracks", "4c9aff,7c5cff,2fd18a").split(",").map(h => hexToRgb(h.trim()));
const FILLS  = argOf("--fills", "1,0.72,0.46").split(",").map(Number);   // 每条的长度比例

const AA = 3;
const BG = [11, 18, 32];

function draw(size) {
  const S = size * AA;
  const buf = new Float32Array(S * S * 3);
  const put = (x, y, c, a = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 3;
    buf[i]     = buf[i]     * (1 - a) + c[0] * a;
    buf[i + 1] = buf[i + 1] * (1 - a) + c[1] * a;
    buf[i + 2] = buf[i + 2] * (1 - a) + c[2] * a;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S * 0.28) / (S * 0.72), dy = (y + S * 0.1) / (S * 0.6);
    const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) * 0.55;
    put(x, y, [BG[0] + 24 * glow, BG[1] + 30 * glow, BG[2] + 42 * glow]);
  }
  const roundRect = (x0, y0, w, h, r, color) => {
    for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++)
      for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
        const cx = Math.min(Math.max(x + 0.5, x0 + r), x0 + w - r);
        const cy = Math.min(Math.max(y + 0.5, y0 + r), y0 + h - r);
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        put(x, y, color, d <= r - 1 ? 1 : d >= r ? 0 : (r - d));
      }
  };
  const bx = S * 0.20, bw = S * 0.60, bh = S * 0.105, gap = S * 0.082, r = bh / 2;
  const y0 = S * 0.30;
  TRACKS.forEach((c, i) => roundRect(bx, y0 + (bh + gap) * i, bw * (FILLS[i] || 0.6), bh, r, c));
  const tkY = y0 + (bh + gap) * (TRACKS.length - 1) + bh + S * 0.075;
  for (let i = 0; i < 7; i++) {
    const w = S * 0.035, x = bx + (bw - w) * (i / 6);
    roundRect(x, tkY, w, S * 0.042, w / 2, [58, 80, 120]);
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r0 = 0, g0 = 0, b0 = 0;
    for (let sy = 0; sy < AA; sy++) for (let sx = 0; sx < AA; sx++) {
      const i = ((y * AA + sy) * S + (x * AA + sx)) * 3;
      r0 += buf[i]; g0 += buf[i + 1]; b0 += buf[i + 2];
    }
    const n = AA * AA, o = (y * size + x) * 4;
    out[o] = Math.round(r0 / n); out[o + 1] = Math.round(g0 / n); out[o + 2] = Math.round(b0 / n); out[o + 3] = 255;
  }
  return out;
}
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const f = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(f, png(draw(size), size));
  console.log(`icon-${size}.png  ${size}x${size}  ${(fs.statSync(f).size / 1024).toFixed(1)} KB`);
}
console.log("-> " + path.resolve(OUT));
