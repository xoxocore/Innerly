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
import {
  CLOSE,
  GROW,
  crop,
  eyelidColour,
  isGround,
  findEyes,
  lift,
  opaqueBox,
} from "./jelly-lift.mjs";

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


/* ------------------------------------------------------- lifting off white */

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
