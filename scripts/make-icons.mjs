/**
 * 生成手机主屏图标（纯 Node 实现，不引第三方依赖）。
 * 运行：npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'web/public/icons');

const BACKGROUND = [106, 168, 107]; // 与界面里的"出勤绿"一致
const FOREGROUND = [255, 255, 255];

function insideRounded(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function renderIcon(size) {
  const samples = 4;
  const radius = size * 0.23;
  const stroke = size * 0.085;
  const points = [
    [size * 0.29, size * 0.53],
    [size * 0.44, size * 0.68],
    [size * 0.73, size * 0.35],
  ];

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      let bgHit = 0;
      let fgHit = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (!insideRounded(px, py, size, radius)) continue;
          bgHit += 1;
          const near =
            distanceToSegment(px, py, points[0], points[1]) <= stroke / 2 ||
            distanceToSegment(px, py, points[1], points[2]) <= stroke / 2;
          if (near) fgHit += 1;
        }
      }
      const total = samples * samples;
      const alpha = bgHit / total;
      const ratio = bgHit === 0 ? 0 : fgHit / bgHit;
      const offset = rowStart + 1 + x * 4;
      raw[offset] = Math.round(BACKGROUND[0] * (1 - ratio) + FOREGROUND[0] * ratio);
      raw[offset + 1] = Math.round(BACKGROUND[1] * (1 - ratio) + FOREGROUND[1] * ratio);
      raw[offset + 2] = Math.round(BACKGROUND[2] * (1 - ratio) + FOREGROUND[2] * ratio);
      raw[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, size, raw);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, raw) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log(`已生成 ${file}`);
}
