// Turns the plan-page Jelly into the two layers the app animates.
//
//   brand/jelly-plan-source.png   Jelly with a checklist and a pencil, on white
//
// She has to come apart, because the pencil moves and she does not. So the
// drawing is lifted off its white ground the same way the logo is, and then
// the pencil is cut out of it into a layer of its own — leaving a
// pencil-shaped hole in her, which is filled back in with the skin around it
// so that nothing shows through when the pencil swings away.
//
// Only the part of the hole that was *inside* her is filled. The pencil sticks
// out past her edge, and that part of the hole is background: it stays
// transparent, found the same way the white was — by asking which side of the
// silhouette it is on rather than by guessing at a shape.
//
// The checklist stays put. It is what she is holding, and a clipboard that
// waved about while being written on would read as a mistake.
//
// The eyes are measured rather than typed in, so she blinks on this drawing
// the way she blinks on the logo, and a redraw moves the blink with it.
//
// Writes:
//   public/innerly-plan.png       both layers, for anything that wants a still
//   src/lib/plan-jelly.ts         the layers as data URIs, the eyes, the pivot
//
// Run with: node tools/prepare-plan-jelly.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { decodePng, downscale, encodePng } from "./png.mjs";
import { CLOSE, GROW, crop, eyelidColour, findEyes, lift, opaqueBox } from "./jelly-lift.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "brand", "jelly-plan-source.png");

/** Drawn at around 44px, so this stays crisp on the densest screen. */
const OUT = 256;

/** Room around the artwork inside its square, as a share of its longest side. */
const PAD = 0.02;

/**
 * Where the pencil starts, as a share of the width.
 *
 * Everything in the drawing that is not green is a prop — but that includes
 * her eyes, her mouth and her blush, so "not green" alone would take her face
 * apart too. The pencil is the only prop out at this end, and between the
 * checklist and it there is a column of nothing but skin, which is where this
 * line is drawn. Measured from the artwork rather than guessed: see the
 * histogram in the commit that added this.
 */
const PENCIL_FROM = 0.6;

/** Green, near enough — her skin, in every shade she is drawn in. */
const isSkin = (r, g, b) => g > r + 18 && g > b + 18;

const source = decodePng(await readFile(SOURCE));
const lifted = lift(source);
const { width: W, height: H, rgba } = lifted;

/* ------------------------------------------------------------- the pencil */

// One connected run of not-skin, started from the far side of the gap, so the
// cut follows the pencil's own outline instead of a straight line through it.
const pencil = new Uint8Array(W * H);
// Two masks, on purpose. The hole cut out of her is generous, so none of the
// pencil's own soft edge is left behind as an outline of a pencil that has
// moved; the pencil layer itself is exactly the pencil, so it does not carry a
// green fringe of her skin around with it wherever it goes.
const core = new Uint8Array(W * H);
{
  const cut = Math.round(W * PENCIL_FROM);
  // Read the matted colour, not the source one, and only where it is fully
  // solid. At her outer edge the source is part-way to the white it was drawn
  // on, and a blend of green and white is not green by any honest test — so
  // classifying on the source picked out a one-pixel outline of her head as
  // "pencil", four hundred rows above the actual pencil.
  const isProp = (p) => {
    const x = p % W;
    if (x < cut) return false;
    const o = p * 4;
    if (rgba[o + 3] < 250) return false;
    return !isSkin(rgba[o], rgba[o + 1], rgba[o + 2]);
  };

  // The largest connected run of them, not all of them. The gloss on her head
  // is a near-white highlight, which is not skin either — taking every not-skin
  // pixel out here swept that in and made the "pencil" four hundred pixels
  // taller than the pencil. One run, and the biggest one, is the pencil.
  const seen = new Uint8Array(W * H);
  let best = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !isProp(s)) continue;
    const run = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop();
      run.push(p);
      const x = p % W;
      const y = (p - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (seen[q] || !isProp(q)) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (run.length > best.length) best = run;
  }
  for (const p of best) {
    pencil[p] = 1;
    core[p] = 1;
  }

  // Grow by a couple of pixels into the skin, to take the pencil's own soft
  // edge with it. Left behind, that edge is a dark outline of a pencil that
  // has moved.
  for (const p of best) {
    const x = p % W;
    const y = (p - x) / W;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        pencil[yy * W + xx] = 1;
      }
    }
  }
}

let pMinX = W, pMaxX = 0, pMinY = H, pMaxY = 0, pn = 0;
for (let p = 0; p < W * H; p++) {
  if (!pencil[p]) continue;
  const x = p % W;
  const y = (p - x) / W;
  pn++;
  if (x < pMinX) pMinX = x;
  if (x > pMaxX) pMaxX = x;
  if (y < pMinY) pMinY = y;
  if (y > pMaxY) pMaxY = y;
}
if (pn < 1000) throw new Error("no pencil found — the artwork has changed");

/* ------------------------------------------------- her, with the hole filled */

// The pencil crosses her outline, so the hole it leaves is part her and part
// background — and the two are joined, which means no test of "is this inside
// or outside" can tell them apart on its own.
//
// So the hole is divided instead. Every pixel of it goes to whichever it
// reaches first, her body or the background, growing both at the same speed
// from their own edges. That puts the new boundary along the midline between
// where she was last seen and where the background was last seen, which is as
// close to continuing her silhouette as anything can be without knowing what
// the drawing hid.
const WASBODY = 1;
const WASBACK = 2;
const claim = new Uint8Array(W * H);
{
  const q = [];
  for (let p = 0; p < W * H; p++) {
    if (pencil[p]) continue;
    const solid = rgba[p * 4 + 3] >= 250;
    claim[p] = solid ? WASBODY : WASBACK;
    // Only the pixels actually touching the hole start the race.
    const x = p % W;
    const y = (p - x) / W;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (pencil[yy * W + xx]) {
          edge = true;
          break;
        }
      }
    }
    if (edge) q.push(p);
  }

  for (let head = 0; head < q.length; head++) {
    const p = q[head];
    const x = p % W;
    const y = (p - x) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (!pencil[n] || claim[n]) continue;
        claim[n] = claim[p];
        q.push(n);
      }
    }
  }
}

const body = Buffer.from(rgba);
for (let p = 0; p < W * H; p++) {
  if (!pencil[p]) continue;
  const o = p * 4;
  body[o] = 0;
  body[o + 1] = 0;
  body[o + 2] = 0;
  body[o + 3] = 0;
}

// The half of the hole that was her, filled inward a ring at a time: each
// empty pixel takes the average of the filled ones beside it. On skin this
// flat, a few passes are indistinguishable from what the pencil was covering.
{
  let remaining = new Set();
  for (let p = 0; p < W * H; p++) {
    if (pencil[p] && claim[p] === WASBODY) remaining.add(p);
  }
  for (let pass = 0; pass < 600 && remaining.size; pass++) {
    const done = [];
    for (const p of remaining) {
      const x = p % W;
      const y = (p - x) / W;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const o = (yy * W + xx) * 4;
          if (body[o + 3] < 250) continue;
          r += body[o];
          g += body[o + 1];
          b += body[o + 2];
          n++;
        }
      }
      if (!n) continue;
      done.push([p, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    }
    if (!done.length) break;
    for (const [p, r, g, b] of done) {
      const o = p * 4;
      body[o] = r;
      body[o + 1] = g;
      body[o + 2] = b;
      body[o + 3] = 255;
      remaining.delete(p);
    }
  }
  if (remaining.size) {
    throw new Error(`${remaining.size} px of her were left unfilled`);
  }
}

const only = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) {
  if (!core[p]) continue;
  const o = p * 4;
  only[o] = rgba[o];
  only[o + 1] = rgba[o + 1];
  only[o + 2] = rgba[o + 2];
  only[o + 3] = rgba[o + 3];
}

/* --------------------------------------------------------------- the square */

// Both layers are cut to the same square so that laying one over the other
// puts the pencil back exactly where it was drawn.
const bounds = opaqueBox(lifted);
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

const bodyCut = crop({ rgba: body, width: W, height: H }, square);
const pencilCut = crop({ rgba: only, width: W, height: H }, square);

const [leftEye, rightEye] = findEyes(lifted);
const grow = Math.max(1, Math.round((leftEye.maxX - leftEye.minX + 1) * GROW));
const LID = eyelidColour(lifted, [leftEye, rightEye], grow);

/* ------------------------------------------------------------------ write */

const png = (cut) =>
  encodePng(OUT, OUT, downscale(cut.rgba, cut.w, cut.h, OUT, OUT));

const bodyPng = png(bodyCut);
const pencilPng = png(pencilCut);

await writeFile(join(root, "public", "innerly-plan.png"), bodyPng);
await writeFile(join(root, "public", "innerly-plan-pencil.png"), pencilPng);

const uri = (b) => `data:image/png;base64,${b.toString("base64")}`;
const pct = (n) => Number(n.toFixed(4));
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const box = (e) => ({
  left: pct((e.minX - grow - square.minX) / side),
  top: pct((e.minY - grow - square.minY) / side),
  width: pct((e.maxX - e.minX + 1 + grow * 2) / side),
  height: pct((e.maxY - e.minY + 1 + grow * 2) / side),
});
const eyeHeight = leftEye.maxY - leftEye.minY + 1;

// The pencil turns about a point up near its eraser, so the tip is what
// travels. Turning it about the tip instead swings the far end around, which
// reads as tapping rather than writing.
const pivotX = pct((pMinX + (pMaxX - pMinX) * 0.72 - square.minX) / side);
const pivotY = pct((pMinY + (pMaxY - pMinY) * 0.22 - square.minY) / side);

await writeFile(
  join(root, "src", "lib", "plan-jelly.ts"),
  `// Generated by tools/prepare-plan-jelly.mjs — do not edit by hand.
//
// Jelly with her checklist, in two layers so the pencil can move on its own.
// Carried as data URIs so the single-file build has them too, and so she never
// arrives a frame after the page around her.

export const PLAN_BODY_SRC =
  "${uri(bodyPng)}";

export const PLAN_PENCIL_SRC =
  "${uri(pencilPng)}";

/** The skin colour a closed eyelid is painted in. */
export const PLAN_EYELID = "${hex(LID)}";

/** How far down its box a lid comes when the eye is shut. */
export const PLAN_SHUT = ${pct((CLOSE * eyeHeight + grow) / (eyeHeight + grow * 2))};

/**
 * The eyes, as a share of the square, measured from the drawing.
 *
 * A lid is drawn over these boxes and taken away again, so a blink cannot
 * damage a face it never touches — and a redraw moves the blink with it
 * rather than the drawing having to match a number written here.
 */
export const PLAN_EYES = [
${[leftEye, rightEye]
  .map((e) => {
    const b = box(e);
    return `  { left: ${b.left}, top: ${b.top}, width: ${b.width}, height: ${b.height} },`;
  })
  .join("\n")}
];

/**
 * The point the pencil turns about, as a share of the square.
 *
 * Up near the eraser, so what travels is the tip. Turning it about the tip
 * instead swings the far end around, which reads as tapping rather than
 * writing.
 */
export const PLAN_PIVOT = { x: ${pivotX}, y: ${pivotY} };
`
);

const kb = (b) => (b.length / 1024).toFixed(1) + "KB";
console.log(`source     ${W}x${H} → ${side}x${side} → ${OUT}x${OUT}`);
console.log(`pencil     ${pMaxX - pMinX + 1}x${pMaxY - pMinY + 1} at (${pMinX},${pMinY})  ${pn} px`);
console.log(`body       ${kb(bodyPng)}   lid ${hex(LID)}`);
console.log(`pencil.png ${kb(pencilPng)}`);
console.log(`eyes       ${leftEye.maxX - leftEye.minX + 1}x${eyeHeight} and ${rightEye.maxX - rightEye.minX + 1}x${rightEye.maxY - rightEye.minY + 1}`);
console.log(`pivot      ${pivotX}, ${pivotY}`);
