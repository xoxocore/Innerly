// Turns the Jelly artwork into the assets the app ships.
//
// The source is one 1024x1024 export holding both halves of the lockup on a
// white ground: Jelly on the left, the name beside her. They are cut apart,
// lifted off the white, and written out separately, because the app uses them
// at different sizes and sometimes only one of them.
//
// Jelly's colours are left exactly as drawn. The only thing this removes is
// the white behind her.
//
// The artwork itself is never edited. To let her blink, the tool measures
// where each eye sits and hands those boxes to the app, which drops a lid in
// her own body colour over them for a moment. Nothing is erased and nothing is
// redrawn, so the resting Jelly is the file that was handed over, pixel for
// pixel — and a blink cannot damage a face it never touches.
//
// Writes:
//   public/innerly-mark.png     Jelly, background removed, otherwise untouched
//   public/innerly-wordmark.png the name, as ink on transparency
//   src/app/icon.png            the browser-tab icon
//   src/lib/logo.ts             both as data URIs, her body colour, and the eyes
//
// Run with: node tools/prepare-jelly.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, downscale, encodePng } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "brand", "jelly-source.png");

/** Room around Jelly inside her square, in source pixels. */
const PAD = 3;

/** The tab icon. Upscaled from small artwork, so kept modest rather than huge. */
const ICON_SIZE = 192;

/** Tall enough to stay crisp at the ~22px the wordmark is drawn at. */
const WORDMARK_HEIGHT = 132;

/** White, near enough. The source is flat art on a white ground with a little
 *  encoder noise, so "white" has to be a range rather than a value. */
const isGround = (r, g, b) => r >= 250 && g >= 250 && b >= 250;

/* ------------------------------------------------------------ cutting out */

/**
 * Lift flat art off a white ground without touching its colours.
 *
 * A pixel on an anti-aliased edge is some mix of the ink and the white behind
 * it: P = a·C + (1−a)·255. Knowing the palette, alpha can be solved for rather
 * than guessed at — a plain threshold leaves every curve either jagged or
 * ringed in white.
 *
 * Each candidate colour is solved on its own widest channel and scored by how
 * well it reconstructs the pixel; the best fit wins. That keeps a green edge
 * green and a black edge black instead of averaging them into something grey.
 */
function unmatte(r, g, b, palette) {
  if (isGround(r, g, b)) return null;

  let best = null;
  for (const c of palette) {
    // The channel furthest from white carries the most signal, so alpha is
    // read from that one.
    let k = 0;
    let spread = 0;
    for (let i = 0; i < 3; i++) {
      const s = 255 - c[i];
      if (s > spread) {
        spread = s;
        k = i;
      }
    }
    if (spread < 8) continue;

    const p = [r, g, b][k];
    const a = Math.min(1, Math.max(0, (255 - p) / spread));
    const err =
      Math.abs(r - (a * c[0] + (1 - a) * 255)) +
      Math.abs(g - (a * c[1] + (1 - a) * 255)) +
      Math.abs(b - (a * c[2] + (1 - a) * 255));
    if (!best || err < best.err) best = { err, a, c };
  }

  if (!best || best.a <= 0) return null;
  return [best.c[0], best.c[1], best.c[2], Math.round(best.a * 255)];
}

/** Crops a region out of the source and cuts it off the white ground. */
function cutOut(img, box, palette) {
  const { width, channels, data } = img;
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const rgba = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((box.minY + y) * width + (box.minX + x)) * channels;
      const px = unmatte(data[i], data[i + 1], data[i + 2], palette);
      const o = (y * w + x) * 4;
      if (px) {
        rgba[o] = px[0];
        rgba[o + 1] = px[1];
        rgba[o + 2] = px[2];
        rgba[o + 3] = px[3];
      }
    }
  }
  return { rgba, w, h };
}

/* ---------------------------------------------------------------- finding */

/** Everything that is not the white ground. */
function contentBox(img) {
  const { width, height, channels, data } = img;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (isGround(data[i], data[i + 1], data[i + 2])) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error("the source is entirely white — nothing to cut out");
  return { minX, minY, maxX, maxY };
}

/** Where Jelly is: the green. */
function greenBox(img) {
  const { width, height, channels, data } = img;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const tally = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!(g > 120 && g > r + 30 && g > b + 30)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const key = `${r},${g},${b}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  if (maxX < 0) throw new Error("no green found — is this the Jelly artwork?");

  // The commonest green is her body; the rest is anti-aliasing.
  let body = null;
  let most = 0;
  for (const [key, n] of tally) {
    if (n > most) {
      most = n;
      body = key.split(",").map(Number);
    }
  }
  return { minX, minY, maxX, maxY, body };
}

/**
 * The eyes, found rather than measured by hand.
 *
 * They are the two dark shapes inside the green, and the only things there
 * that are dark and the same size. Found by flood fill so that a change to the
 * artwork moves them rather than silently leaving the blink pointing at empty
 * face.
 */
function findEyes(img, jelly) {
  const { width, channels, data } = img;
  const dark = new Set();
  for (let y = jelly.minY; y <= jelly.maxY; y++) {
    for (let x = jelly.minX; x <= jelly.maxX; x++) {
      const i = (y * width + x) * channels;
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) {
        dark.add(y * width + x);
      }
    }
  }

  const seen = new Set();
  const blobs = [];
  for (const start of dark) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    let minX = width, minY = Infinity, maxX = -1, maxY = -1, n = 0;
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      const y = (p - x) / width;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = (y + dy) * width + (x + dx);
          if (dark.has(q) && !seen.has(q)) {
            seen.add(q);
            stack.push(q);
          }
        }
      }
    }
    blobs.push({ minX, minY, maxX, maxY, n });
  }

  // The two biggest, side by side and level with each other.
  blobs.sort((a, b) => b.n - a.n);
  const pair = blobs.slice(0, 2).sort((a, b) => a.minX - b.minX);
  const [left, right] = pair;
  if (!left || !right) throw new Error("could not find two eyes");
  if (Math.abs(left.minY - right.minY) > 2 || Math.abs(left.n - right.n) > left.n * 0.4) {
    throw new Error(
      "the two darkest shapes are not a pair of eyes — the artwork has changed"
    );
  }
  return pair;
}

/* ------------------------------------------------------------------ build */

const source = decodePng(await readFile(SOURCE));
const content = contentBox(source);
const jelly = greenBox(source);
const [leftEye, rightEye] = findEyes(source, jelly);

const BODY = jelly.body;
const INK = [0, 0, 0];
const BLUSH = [190, 191, 190];
const JELLY_PALETTE = [BODY, INK, BLUSH];

// Jelly's square: her own box, centred, with a little air.
const side = Math.max(jelly.maxX - jelly.minX + 1, jelly.maxY - jelly.minY + 1) + PAD * 2;
const cx = Math.round((jelly.minX + jelly.maxX) / 2);
const cy = Math.round((jelly.minY + jelly.maxY) / 2);
const half = Math.floor(side / 2);
const square = {
  minX: cx - half,
  minY: cy - half,
  maxX: cx - half + side - 1,
  maxY: cy - half + side - 1,
};

const mark = cutOut(source, square, JELLY_PALETTE);

// The name sits BELOW Jelly and starts to the left of her chin, so the two are
// split by height. Splitting by width would slice the first letter off, which
// is exactly what it did until this line was written the other way round.
if (content.maxY <= jelly.maxY) {
  throw new Error("expected the name to sit below Jelly — the artwork has changed");
}
const wordCut = cutOut(
  source,
  { minX: content.minX, minY: jelly.maxY + 1, maxX: content.maxX, maxY: content.maxY },
  [INK]
);

// Trimmed again: the cut starts at Jelly's chin, not at the first letter.
let wMinX = wordCut.w, wMinY = wordCut.h, wMaxX = -1, wMaxY = -1;
for (let y = 0; y < wordCut.h; y++) {
  for (let x = 0; x < wordCut.w; x++) {
    if (wordCut.rgba[(y * wordCut.w + x) * 4 + 3] > 6) {
      if (x < wMinX) wMinX = x;
      if (x > wMaxX) wMaxX = x;
      if (y < wMinY) wMinY = y;
      if (y > wMaxY) wMaxY = y;
    }
  }
}
const tw = wMaxX - wMinX + 1;
const th = wMaxY - wMinY + 1;
const wordRgba = Buffer.alloc(tw * th * 4);
for (let y = 0; y < th; y++) {
  wordCut.rgba.copy(
    wordRgba,
    y * tw * 4,
    ((wMinY + y) * wordCut.w + wMinX) * 4,
    ((wMinY + y) * wordCut.w + wMinX + tw) * 4
  );
}
const wordOutW = Math.max(1, Math.round((tw * WORDMARK_HEIGHT) / th));

/* ------------------------------------------------------------------ write */

const markPng = encodePng(mark.w, mark.h, mark.rgba);
const wordPng = encodePng(
  wordOutW,
  WORDMARK_HEIGHT,
  downscale(wordRgba, tw, th, wordOutW, WORDMARK_HEIGHT)
);
const iconPng = encodePng(
  ICON_SIZE,
  ICON_SIZE,
  downscale(mark.rgba, mark.w, mark.h, ICON_SIZE, ICON_SIZE)
);

await writeFile(join(root, "public", "innerly-mark.png"), markPng);
await writeFile(join(root, "public", "innerly-wordmark.png"), wordPng);
await writeFile(join(root, "src", "app", "icon.png"), iconPng);

const uri = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
const pct = (n) => Number(n.toFixed(4));
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

// Each eye as a fraction of the square, grown by a hair so a lid laid over it
// covers the anti-aliased rim too rather than leaving a dark outline behind.
const GROW = 1;
const box = (e) => ({
  left: pct((e.minX - GROW - square.minX) / mark.w),
  top: pct((e.minY - GROW - square.minY) / mark.h),
  width: pct((e.maxX - e.minX + 1 + GROW * 2) / mark.w),
  height: pct((e.maxY - e.minY + 1 + GROW * 2) / mark.h),
});

await writeFile(
  join(root, "src", "lib", "logo.ts"),
  `// Generated by tools/prepare-jelly.mjs — do not edit by hand.
//
// Carried as data URIs so the single-file build has them too, and so the mark
// never arrives a frame after the page around it.

export const MARK_SRC =
  "${uri(markPng)}";

export const LOGO_SRC =
  "${uri(wordPng)}";

export const LOGO_ASPECT = ${pct(wordOutW / WORDMARK_HEIGHT)};

/** Jelly's body colour, which is what an eyelid has to be painted in. */
export const JELLY_BODY = "${hex(BODY)}";

/**
 * Where each eye sits inside the mark, as fractions of its side.
 *
 * Measured from the artwork rather than typed in, so the blink follows the
 * drawing instead of the drawing having to match a number written here. The
 * artwork itself is never edited — a lid is drawn over these boxes and taken
 * away again, so a blink cannot damage a face it never touches.
 */
export const EYES = [
${[0, 1]
  .map((i) => {
    const b = box([leftEye, rightEye][i]);
    return `  { left: ${b.left}, top: ${b.top}, width: ${b.width}, height: ${b.height} },`;
  })
  .join("\n")}
];
`
);

const kb = (b) => (b.length / 1024).toFixed(1) + "KB";
console.log(`source     ${source.width}x${source.height}`);
console.log(`mark       ${mark.w}x${mark.h}  ${kb(markPng)}   body ${hex(BODY)}`);
console.log(
  `eyes       left ${leftEye.minX - square.minX},${leftEye.minY - square.minY}` +
    `  right ${rightEye.minX - square.minX},${rightEye.minY - square.minY}` +
    `  ${rightEye.maxX - rightEye.minX + 1}x${rightEye.maxY - rightEye.minY + 1} each`
);
console.log(`wordmark   ${tw}x${th} → ${wordOutW}x${WORDMARK_HEIGHT}  ${kb(wordPng)}`);
console.log(`icon       ${ICON_SIZE}x${ICON_SIZE}  ${kb(iconPng)}`);
