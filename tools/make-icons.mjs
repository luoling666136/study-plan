// 生成 PWA 图标（纯 Node，无依赖）：深色底 + 三轨色条 + 进度环。
// 用法: node make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT  = path.resolve(HERE, "..", "plans", "three-track");   // 图标与 html 同目录

const BG = [11, 18, 32];          // #0b1220
const RK = [76, 154, 255];        // #4c9aff
const AI = [124, 92, 255];        // #7c5cff
const EN = [47, 209, 138];        // #2fd18a

const AA = 3;                     // 超采样倍率，边缘更干净

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
  // 底色 + 顶部径向微光（和网页背景同调）
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
  // 三轨进度条，长度递减 → 一眼看出是"计划/进度"
  const bx = S * 0.20, bw = S * 0.60, bh = S * 0.105, gap = S * 0.082, r = bh / 2;
  const y0 = S * 0.30;
  roundRect(bx, y0,                bw * 1.00, bh, r, RK);
  roundRect(bx, y0 + bh + gap,     bw * 0.72, bh, r, AI);
  roundRect(bx, y0 + (bh + gap) * 2, bw * 0.46, bh, r, EN);
  // 底部刻度线，暗示"周计划"（放在条形下方留白处，别和绿条打架）
  const tkY = y0 + (bh + gap) * 2 + bh + S * 0.075;
  for (let i = 0; i < 7; i++) {
    const w = S * 0.035, x = bx + (bw - w) * (i / 6);
    roundRect(x, tkY, w, S * 0.042, w / 2, [58, 80, 120]);
  }
  // 降采样
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
function pngFromRGBA(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of [180, 192, 512]) {
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, pngFromRGBA(draw(size), size));
  console.log(`icon-${size}.png  ${size}x${size}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}
console.log("-> " + OUT);
