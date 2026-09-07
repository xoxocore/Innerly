// Turns the Jelly artwork into the assets the app ships.
//
// There are two sources, because the lockup is drawn in two pieces:
//
//   brand/jelly-source.png     Jelly herself, on a white ground
//   brand/wordmark-source.png  the name, in the lettering it was drawn in
//
// Both are lifted off the white and written out separately, because the app
// uses them at different sizes and sometimes only one of them.
//
// Jelly is shaded artwork — gloss on her head, a soft blush, a darker rim —
// so her colours are carried through exactly as drawn. The only thing this
// removes is the white behind her. The name is flat black ink, so it gets the
// simpler treatment: solved against its one colour and shipped as a shape.
//
// The artwork itself is never edited. To let her blink, the tool measures
// where each eye sits and hands those boxes to the app, which drops a lid in
// the colour of the skin just above them for a moment. Nothing is erased and
// nothing is redrawn, so the resting Jelly is the file that was handed over,
// pixel for pixel — and a blink cannot damage a face it never touches.
//
// Writes:
//   public/innerly-mark.png     Jelly, background removed, otherwise untouched
//   public/innerly-wordmark.png the name, as ink on transparency
//   src/app/icon.png            the browser-tab icon
//   src/lib/logo.ts             both as data URIs, the lid colour, and the eyes
//
// Run with: node tools/prepare-jelly.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, downscale, encodePng } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const JELLY = join(root, "brand", "jelly-source.png");
const WORDMARK = join(root, "brand", "wordmark-source.png");

/** Room around Jelly inside her square, as a share of her longest side. */
const PAD = 0.02;

/** Drawn at ~26px, so this is generous even on a very dense screen. */
const MARK_SIZE = 192;

/** The tab icon. */
const ICON_SIZE = 192;

/** Tall enough to stay crisp at the ~22px the wordmark is drawn at. */
const WORDMARK_HEIGHT = 132;

/**
 * How far down the eye a closed lid comes.
 *
 * The rest is the eye's own bottom curve, left showing as the closed line —
 * so a blink borrows the shape she was drawn with instead of inventing one.
 */
const CLOSE = 0.82;

/**
 * How far past the eye the lid reaches, as a share of the eye's width.
 *
 * The eye has a soft edge, and a lid stopping exactly at it leaves that edge
 * behind as a dark outline around the closed eye — worse once the mark is
 * shrunk, because half a source pixel of near-black still darkens a whole one.
 * Reaching a little further costs nothing: the extra lands on skin, and the
 * lid is painted in the colour of that skin.
 */
const GROW = 0.12;

/**
 * White, near enough.
 *
 * The ground is a flat 254 with a little compression noise, and the softest
 * part of an edge is still lighter than this — so the line is drawn high and
 * everything below it is treated as artwork and matted properly, rather than
 * being thrown away and leaving a hard edge.
 */
const GROUND = 253;
const isGround = (r, g, b) => Math.min(r, g, b) >= GROUND;

/** How far in from the white the edge is still part-transparent. */
const RIM = 3;

/* ------------------------------------------------------- lifting off white */

/**
 * Lift shaded artwork off a white ground, keeping every colour in it.
 *
 * The inside of the drawing is copied through untouched — gloss, gradient,
 * blush and all — because anything cleverer would flatten the shading that
 * makes her look like jelly rather than a sticker.
 *
 * Only the edge needs solving. A pixel on an anti-aliased edge is some mix of
 * the drawing and the white behind it: P = a·C + (1−a)·255. C is read from the
 * nearest fully-inside pixels, so alpha can be solved for rather than guessed
 * at — a plain threshold leaves every curve either jagged or ringed in white.
 *
 * The white is found by flooding in from the border rather than by testing
 * each pixel on its own, so a white highlight enclosed by the drawing stays
 * part of the drawing.
 */
function lift(img) {
  const { width, height, channels, data } = img;
  const n = width * height;
  const rgb = (p) => {
    const i = p * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // 1. The white around the outside.
  const outside = new Uint8Array(n);
  const queue = [];
  const flood = (p) => {
    if (outside[p]) return;
    const [r, g, b] = rgb(p);
    if (!isGround(r, g, b)) return;
    outside[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x++) {
    flood(x);
    flood((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    flood(y * width);
    flood(y * width + width - 1);
  }
  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    if (x > 0) flood(p - 1);
    if (x < width - 1) flood(p + 1);
    if (p >= width) flood(p - width);
    if (p < n - width) flood(p + width);
  }

  // 2. The drawing is the largest thing left. Compression leaves a scatter of
  //    off-white specks in the margin; taking only the biggest shape drops
  //    them without having to guess at a size threshold.
  const shape = largestBlob(outside, width, height);

  // 3. Inside stays as drawn; the rim is solved against the colour beside it.
  const rgba = Buffer.alloc(n * 4);
  const isRim = (x, y) => {
    for (let dy = -RIM; dy <= RIM; dy++) {
      for (let dx = -RIM; dx <= RIM; dx++) {
        const yy = y + dy;
        const xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= height || xx >= width) return true;
        if (outside[yy * width + xx]) return true;
      }
    }
    return false;
  };

  const rim = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (shape[p] && isRim(x, y)) rim[p] = 1;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!shape[p]) continue;
      const o = p * 4;
      const [r, g, b] = rgb(p);
      if (!rim[p]) {
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = 255;
        continue;
      }
      const c = nearestSolid(x, y) ?? [r, g, b];
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
      const a = spread < 8 ? 1 : Math.min(1, Math.max(0, (255 - [r, g, b][k]) / spread));
      rgba[o] = Math.round(c[0]);
      rgba[o + 1] = Math.round(c[1]);
      rgba[o + 2] = Math.round(c[2]);
      rgba[o + 3] = Math.round(a * 255);
    }
  }

  return { rgba, width, height, shape, rgb };

  function nearestSolid(x, y) {
    for (let rad = 1; rad <= RIM * 3; rad++) {
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
          const q = yy * width + xx;
          if (!shape[q] || rim[q]) continue;
          const c = rgb(q);
          sr += c[0];
          sg += c[1];
          sb += c[2];
          count++;
        }
      }
      if (count > 0) return [sr / count, sg / count, sb / count];
    }
    return null;
  }
}

/** The biggest run of connected pixels that the flood did not reach. */
function largestBlob(outside, width, height) {
  const n = width * height;
  const mark = new Uint8Array(n);
  let best = null;
  let bestSize = 0;
  const seen = new Uint8Array(n);

  for (let s = 0; s < n; s++) {
    if (outside[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    const members = [];
    while (stack.length) {
      const p = stack.pop();
      members.push(p);
      const x = p % width;
      const push = (q) => {
        if (!outside[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      };
      if (x > 0) push(p - 1);
      if (x < width - 1) push(p + 1);
      if (p >= width) push(p - width);
      if (p < n - width) push(p + width);
    }
    if (members.length > bestSize) {
      bestSize = members.length;
      best = members;
    }
  }

  if (!best) throw new Error("the source is entirely white — nothing to cut out");
  for (const p of best) mark[p] = 1;
  return mark;
}

/* ------------------------------------------------------------- flat ink art */

/**
 * The same idea for artwork of one flat colour, where the colour is known.
 *
 * Solving against a single ink is exact, so the letterforms come out with the
 * edges they were drawn with rather than with anything reconstructed.
 */
function liftInk(img, ink) {
  const { width, height, channels, data } = img;
  const rgba = Buffer.alloc(width * height * 4);
  let spread = 0;
  let k = 0;
  for (let i = 0; i < 3; i++) {
    const s = 255 - ink[i];
    if (s > spread) {
      spread = s;
      k = i;
    }
  }
  for (let p = 0; p < width * height; p++) {
    const i = p * channels;
    const c = [data[i], data[i + 1], data[i + 2]];
    if (isGround(c[0], c[1], c[2])) continue;
    const a = Math.min(1, Math.max(0, (255 - c[k]) / spread));
    if (a <= 0) continue;
    const o = p * 4;
    rgba[o] = ink[0];
    rgba[o + 1] = ink[1];
    rgba[o + 2] = ink[2];
    rgba[o + 3] = Math.round(a * 255);
  }
  return { rgba, width, height };
}

/* ------------------------------------------------------------------ finding */

/** The box around everything that is not see-through. */
function opaqueBox({ rgba, width, height }, threshold = 4) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error("nothing left after lifting the artwork off the white");
  return { minX, minY, maxX, maxY };
}

/** Copies a box out of a lifted image, padding with transparency past the edge. */
function crop({ rgba, width, height }, box) {
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = box.minY + y;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < w; x++) {
      const sx = box.minX + x;
      if (sx < 0 || sx >= width) continue;
      rgba.copy(out, (y * w + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
    }
  }
  return { rgba: out, w, h };
}

/**
 * The eyes, found rather than measured by hand.
 *
 * They are the two biggest dark shapes in her face, and the only ones that are
 * a matched pair. The smile is dark too, which is why size alone is not enough
 * and the two have to agree on their height and their area before they are
 * believed. Finding them this way means a change to the artwork moves the
 * blink with it instead of silently leaving a lid over empty face.
 */
function findEyes({ width, height, shape, rgb }) {
  const dark = new Set();
  for (let p = 0; p < width * height; p++) {
    if (!shape[p]) continue;
    const [r, g, b] = rgb(p);
    if (r < 120 && g < 120 && b < 120) dark.add(p);
  }

  const seen = new Set();
  const blobs = [];
  for (const start of dark) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    let minX = width, minY = height, maxX = -1, maxY = -1, n = 0;
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

  blobs.sort((a, b) => b.n - a.n);
  const pair = blobs.slice(0, 2).sort((a, b) => a.minX - b.minX);
  const [left, right] = pair;
  if (!left || !right) throw new Error("could not find two eyes");

  const tallest = Math.max(left.maxY - left.minY, right.maxY - right.minY) + 1;
  if (
    Math.abs(left.minY - right.minY) > tallest * 0.1 ||
    Math.abs(left.n - right.n) > left.n * 0.4
  ) {
    throw new Error(
      "the two darkest shapes are not a pair of eyes — the artwork has changed"
    );
  }
  return pair;
}

/**
 * The colour of the skin the eyelid will sit against.
 *
 * Not the commonest green in the drawing: she is shaded, and a lid in the
 * average colour of the whole body would sit on her face as a visible patch.
 * Taken from the skin that ends up touching the lid's own edges — above it and
 * along both sides — it disappears into her.
 *
 * The skin below the eyes is left out of it. That is where the blush is, and
 * the lid never reaches down that far anyway.
 */
function eyelidColour({ width, height, shape, rgb }, eyes, grow) {
  let r = 0, g = 0, b = 0, n = 0;
  const take = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (!shape[p]) return;
    const c = rgb(p);
    // Skip anything dark: at the corners the ring can clip the eye itself.
    if (c[0] < 120 && c[1] < 120 && c[2] < 120) return;
    r += c[0];
    g += c[1];
    b += c[2];
    n++;
  };

  for (const eye of eyes) {
    const band = grow * 2;
    const bottom = eye.minY + Math.round((eye.maxY - eye.minY + 1) * CLOSE);
    for (let y = eye.minY - grow - band; y < eye.minY - grow; y++) {
      for (let x = eye.minX - grow; x <= eye.maxX + grow; x++) take(x, y);
    }
    for (let y = eye.minY - grow; y <= bottom; y++) {
      for (let d = 1; d <= band; d++) {
        take(eye.minX - grow - d, y);
        take(eye.maxX + grow + d, y);
      }
    }
  }
  if (!n) throw new Error("no skin around the eyes to take a lid colour from");
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/* -------------------------------------------------------------------- build */

const jellySource = decodePng(await readFile(JELLY));
const lifted = lift(jellySource);
const bounds = opaqueBox(lifted);
const [leftEye, rightEye] = findEyes(lifted);
const grow = Math.max(1, Math.round((leftEye.maxX - leftEye.minX + 1) * GROW));
const LID = eyelidColour(lifted, [leftEye, rightEye], grow);

// Jelly's square: her own box, centred, with a little air.
const longest = Math.max(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1);
const side = longest + Math.round(longest * PAD) * 2;
const cx = Math.round((bounds.minX + bounds.maxX) / 2);
const cy = Math.round((bounds.minY + bounds.maxY) / 2);
const half = Math.floor(side / 2);
const square = {
  minX: cx - half,
  minY: cy - half,
  maxX: cx - half + side - 1,
  maxY: cy - half + side - 1,
};
const mark = crop(lifted, square);

const wordSource = decodePng(await readFile(WORDMARK));
const INK = [0, 0, 0];
const word = liftInk(wordSource, INK);
const wordBox = opaqueBox(word, 6);
const wordCut = crop(word, wordBox);
const wordOutW = Math.max(1, Math.round((wordCut.w * WORDMARK_HEIGHT) / wordCut.h));

/**
 * Rounds off the last scrap of compression noise in the shrunk mark.
 *
 * She is shaded rather than flat, and the source is a JPEG, so no two pixels
 * of the same green are quite the same number — which PNG cannot compress and
 * which the eye cannot see. Nudging each colour onto an even value costs less
 * than half of one percent of one step and saves a quarter of the file, and
 * the mark is carried inline in the bundle, so that quarter is paid on every
 * page load. Transparency is left exact: it is what the soft edge is made of.
 */
function settle(rgba) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    out[i] &= 0xfe;
    out[i + 1] &= 0xfe;
    out[i + 2] &= 0xfe;
  }
  return out;
}

/* -------------------------------------------------------------------- write */

const markPng = encodePng(
  MARK_SIZE,
  MARK_SIZE,
  settle(downscale(mark.rgba, mark.w, mark.h, MARK_SIZE, MARK_SIZE))
);
const wordPng = encodePng(
  wordOutW,
  WORDMARK_HEIGHT,
  downscale(wordCut.rgba, wordCut.w, wordCut.h, wordOutW, WORDMARK_HEIGHT)
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

const box = (e) => ({
  left: pct((e.minX - grow - square.minX) / side),
  top: pct((e.minY - grow - square.minY) / side),
  width: pct((e.maxX - e.minX + 1 + grow * 2) / side),
  height: pct((e.maxY - e.minY + 1 + grow * 2) / side),
});

// The lid is painted over a box a little larger than the eye, so closing it to
// CLOSE of the eye means closing it to rather less of the box. Worked out here
// rather than in the app, because it depends on how big the eye came out.
const eyeHeight = leftEye.maxY - leftEye.minY + 1;
const SHUT = pct((CLOSE * eyeHeight + grow) / (eyeHeight + grow * 2));

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

/**
 * The colour of Jelly's skin just above her eyes, which is what an eyelid has
 * to be painted in for a blink to disappear into her face.
 */
export const EYELID = "${hex(LID)}";

/**
 * How much of an eye's box a shut lid covers.
 *
 * Short of all of it, so the bottom of the eye stays showing and its own curve
 * becomes the closed line — the shape she was drawn with rather than one made
 * up for the occasion.
 */
export const SHUT = ${SHUT};

/**
 * Where each eye sits inside the mark, as fractions of its side.
 *
 * Measured from the artwork rather than typed in, so the blink follows the
 * drawing instead of the drawing having to match a number written here. The
 * artwork itself is never edited — a lid is drawn over these boxes and taken
 * away again, so a blink cannot damage a face it never touches.
 *
 * Each box reaches a little past its eye on every side, so that a lid covers
 * the eye's soft edge instead of leaving it behind as a dark outline.
 */
export const EYES = [
${[leftEye, rightEye]
  .map((e) => {
    const b = box(e);
    return `  { left: ${b.left}, top: ${b.top}, width: ${b.width}, height: ${b.height} },`;
  })
  .join("\n")}
];
`
);

const kb = (b) => (b.length / 1024).toFixed(1) + "KB";
console.log(`jelly      ${jellySource.width}x${jellySource.height} → ${side}x${side}`);
console.log(`mark       ${MARK_SIZE}x${MARK_SIZE}  ${kb(markPng)}   lid ${hex(LID)}`);
console.log(
  `eyes       ${leftEye.maxX - leftEye.minX + 1}x${leftEye.maxY - leftEye.minY + 1}` +
    ` and ${rightEye.maxX - rightEye.minX + 1}x${rightEye.maxY - rightEye.minY + 1}` +
    `  at y ${leftEye.minY - square.minY}`
);
console.log(
  `wordmark   ${wordCut.w}x${wordCut.h} → ${wordOutW}x${WORDMARK_HEIGHT}  ${kb(wordPng)}`
);
console.log(`icon       ${ICON_SIZE}x${ICON_SIZE}  ${kb(iconPng)}`);
