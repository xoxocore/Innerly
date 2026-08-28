// Turns the brand exports into shippable assets.
//
// Both sources are 2000x2000 with no alpha and the artwork floating in a small
// patch of white, so both need trimming and cutting out — but in opposite
// ways, and getting them the same way round matters:
//
//   the wordmark  is green ink on white. White becomes transparent.
//   the mark      is a green disc with WHITE line art on it. Running the
//                 wordmark's rule over it would erase the jellyfish. It gets a
//                 circular cut-out instead, and its colours are left alone.
//
// Writes public/innerly-logo.png, public/innerly-mark.png, src/app/icon.png
// (which Next serves as the browser-tab icon) and src/lib/logo.ts, which
// carries both as data URIs so they render in the single-file build too.
//
// Pure Node: zlib is the only thing PNG needs, and a build tool that depends
// on a browser is a tool nobody can run. Handles the 8-bit non-interlaced
// RGB/RGBA case, which is what design tools export; anything else errors
// loudly rather than producing a silently wrong logo.
//
// Run with: node tools/prepare-logo.mjs

import { readFile, writeFile } from "node:fs/promises";
import { inflateSync, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORDMARK = join(root, "brand", "innerly-logo-source.png");
const MARK = join(root, "brand", "innerly-mark-source.png");

const WORDMARK_HEIGHT = 240; // crisp at 3x the largest place it is used (~40px)
const MARK_SIZE = 256;       // also the source for the favicon
const PAD = 2;
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/* ------------------------------------------------------------------ crc32 */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ----------------------------------------------------------------- decode */

function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");

  let pos = 8;
  let header = null;
  const idat = [];

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!header) throw new Error("PNG has no IHDR");
  if (header.depth !== 8)
    throw new Error(`only 8-bit PNGs are supported, got ${header.depth}-bit`);
  if (header.interlace !== 0) throw new Error("interlaced PNGs are not supported");
  if (header.colorType !== 2 && header.colorType !== 6)
    throw new Error(
      `only RGB and RGBA PNGs are supported, got colour type ${header.colorType}`
    );

  const channels = header.colorType === 6 ? 4 : 3;
  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filters. Each row is prefixed by its filter type and
  // refers back to the row above, so this has to run in order.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0; // left
      const b = prev ? prev[i] : 0; // above
      const c = prev && i >= channels ? prev[i - channels] : 0; // above-left
      const x = line[i];
      let value;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
      cur[i] = value & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

/* ----------------------------------------------------------------- encode */

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;

  // Filter 0 on every row: the mark is flat colour, so deflate does the work
  // and the encoder stays simple enough to be obviously correct.
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ shared */

// Bounding box of everything that is not the white ground, plus the most
// saturated pixel found, which is the artwork's true colour.
function inspect({ width, height, channels, data }) {
  const at = (x, y) => (y * width + x) * channels;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let ink = null;
  let lowest = Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r >= 240 && g >= 240 && b >= 240) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const sum = r + g + b;
      if (sum < lowest) {
        lowest = sum;
        ink = [r, g, b];
      }
    }
  }
  if (maxX < 0) throw new Error("the source is entirely white — nothing to trim to");
  return { minX, minY, maxX, maxY, ink, at };
}

// Box-filter downscale. RGB is premultiplied by alpha before averaging and
// divided back out after: without that, a transparent pixel's colour bleeds
// into its neighbours and every edge picks up a halo.
function downscale(src, w, h, outW, outH) {
  const out = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor((y * h) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / outH));
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor((x * w) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / outW));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * w + sx) * 4;
          const al = src[i + 3] / 255;
          r += src[i] * al;
          g += src[i + 1] * al;
          b += src[i + 2] * al;
          a += al;
          n++;
        }
      }
      const o = (y * outW + x) * 4;
      const alpha = a / n;
      out[o] = alpha > 0 ? Math.round(r / n / alpha) : 0;
      out[o + 1] = alpha > 0 ? Math.round(g / n / alpha) : 0;
      out[o + 2] = alpha > 0 ? Math.round(b / n / alpha) : 0;
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- wordmark */

// Green ink on white: solve P = a*C + (1-a)*255 on the red channel (widest
// spread — 255 on the ground, near zero in the ink) to recover alpha. A plain
// threshold would leave a white fringe on every anti-aliased edge.
function buildWordmark(img) {
  const { width, height, channels, data } = img;
  const { minX: bx, minY: by, maxX: bX, maxY: bY, ink, at } = inspect(img);

  const minX = Math.max(0, bx - PAD);
  const minY = Math.max(0, by - PAD);
  const maxX = Math.min(width - 1, bX + PAD);
  const maxY = Math.min(height - 1, bY + PAD);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  const [cr, cg, cb] = ink;
  const span = 255 - cr || 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(minX + x, minY + y);
      const o = (y * w + x) * 4;
      rgba[o] = cr;
      rgba[o + 1] = cg;
      rgba[o + 2] = cb;
      rgba[o + 3] = Math.round(
        Math.min(1, Math.max(0, (255 - data[i]) / span)) * 255
      );
    }
  }

  const outW = Math.max(1, Math.round((w * WORDMARK_HEIGHT) / h));
  return {
    png: encodePng(outW, WORDMARK_HEIGHT, downscale(rgba, w, h, outW, WORDMARK_HEIGHT)),
    w: outW,
    h: WORDMARK_HEIGHT,
    trimmed: `${w}x${h}`,
    colour: "#" + [cr, cg, cb].map((v) => v.toString(16).padStart(2, "0")).join(""),
  };
}

/* -------------------------------------------------------------------- mark */

// A green disc carrying white line art. The colours are kept exactly as drawn
// and only the area outside the disc is cut away, so the jellyfish survives.
// The radius is pulled in a hair to drop the source's own anti-aliased rim,
// which is part-white and would otherwise read as a pale halo on a dark page.
function buildMark(img) {
  const { width, height, channels, data } = img;
  const { minX, minY, maxX, maxY, ink, at } = inspect(img);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (Math.abs(w - h) > 2) {
    throw new Error(
      `the mark is expected to be a circle in a square box, got ${w}x${h}`
    );
  }

  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const radius = w / 2 - 1.5;
  const feather = 1.2;

  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(minX + x, minY + y);
      const o = (y * w + x) * 4;
      const d = Math.hypot(x - cx, y - cy);
      const alpha = Math.min(1, Math.max(0, (radius - d) / feather + 0.5));
      rgba[o] = data[i];
      rgba[o + 1] = data[i + 1];
      rgba[o + 2] = data[i + 2];
      rgba[o + 3] = Math.round(alpha * 255);
    }
  }

  return {
    png: encodePng(MARK_SIZE, MARK_SIZE, downscale(rgba, w, h, MARK_SIZE, MARK_SIZE)),
    size: MARK_SIZE,
    trimmed: `${w}x${h}`,
    colour: "#" + ink.map((v) => v.toString(16).padStart(2, "0")).join(""),
  };
}

/* ------------------------------------------------------------------- write */

const wordmark = buildWordmark(decodePng(await readFile(WORDMARK)));
const mark = buildMark(decodePng(await readFile(MARK)));

await writeFile(join(root, "public", "innerly-logo.png"), wordmark.png);
await writeFile(join(root, "public", "innerly-mark.png"), mark.png);
// Next serves src/app/icon.png as the browser-tab icon with no extra config.
await writeFile(join(root, "src", "app", "icon.png"), mark.png);

const aspect = (wordmark.w / wordmark.h).toFixed(4);

await writeFile(
  join(root, "src", "lib", "logo.ts"),
  `// GENERATED — do not edit by hand. See tools/prepare-logo.mjs.
// The brand assets as data URIs, so they render in the single-file build as
// well as in the app. Wordmark ${(wordmark.png.length / 1024).toFixed(1)}KB, mark ${(mark.png.length / 1024).toFixed(1)}KB.

export const LOGO_SRC =
  "data:image/png;base64,${wordmark.png.toString("base64")}";

export const MARK_SRC =
  "data:image/png;base64,${mark.png.toString("base64")}";

// Sampled from the artwork rather than guessed, so anything tinted to match
// the brand stays in step with it.
export const LOGO_GREEN = "${wordmark.colour}";

// Width ÷ height of the trimmed wordmark, so callers can size by height alone.
export const LOGO_ASPECT = ${aspect};
`
);

console.log(`wordmark  trimmed ${wordmark.trimmed} → ${wordmark.w}x${wordmark.h}  ${(wordmark.png.length / 1024).toFixed(1)}KB  ${wordmark.colour}`);
console.log(`mark      trimmed ${mark.trimmed} → ${mark.size}x${mark.size}  ${(mark.png.length / 1024).toFixed(1)}KB  ${mark.colour}`);
console.log(`also wrote src/app/icon.png (browser tab)`);
