// The parts of the Jelly pipeline that more than one tool needs.
//
// Both the logo and the plan-page Jelly are the same kind of thing: shaded
// artwork handed over on a white ground, which has to be lifted off that
// ground without leaving a halo, and which has eyes that have to be found
// rather than typed in so that a change to the drawing moves the blink with
// it. That work lives here so there is one copy of it to be right.

/**
 * How far down the eye a closed lid comes.
 *
 * The rest is the eye's own bottom curve, left showing as the closed line —
 * so a blink borrows the shape she was drawn with instead of inventing one.
 */
export const CLOSE = 0.82;

/**
 * How far past the eye the lid reaches, as a share of the eye's width.
 *
 * The eye has a soft edge, and a lid stopping exactly at it leaves that edge
 * behind as a dark outline around the closed eye — worse once the mark is
 * shrunk, because half a source pixel of near-black still darkens a whole one.
 * Reaching a little further costs nothing: the extra lands on skin, and the
 * lid is painted in the colour of that skin.
 */
export const GROW = 0.12;

/**
 * White, near enough.
 *
 * The ground is a flat 254 with a little compression noise, and the softest
 * part of an edge is still lighter than this — so the line is drawn high and
 * everything below it is treated as artwork and matted properly, rather than
 * being thrown away and leaving a hard edge.
 */
export const GROUND = 253;
export const isGround = (r, g, b) => Math.min(r, g, b) >= GROUND;

/** How far in from the white the edge is still part-transparent. */
export const RIM = 3;

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
export function lift(img) {
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
export function largestBlob(outside, width, height) {
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

/** The box around everything that is not see-through. */
export function opaqueBox({ rgba, width, height }, threshold = 4) {
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
export function crop({ rgba, width, height }, box) {
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
export function findEyes({ width, height, shape, rgb }) {
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
export function eyelidColour({ width, height, shape, rgb }, eyes, grow) {
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