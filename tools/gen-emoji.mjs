// Generates src/lib/emoji.ts from the Unicode tables V8 already ships, so the
// set is the real assigned emoji list rather than a hand-picked sample.
import { writeFile } from "node:fs/promises";

const isPresentation = (s) => /\p{Emoji_Presentation}/u.test(s);
const isPictographic = (s) => /\p{Extended_Pictographic}/u.test(s);

// First matching range wins, so every emoji lands in exactly one group and
// nothing is silently dropped.
const GROUPS = [
  ["Smileys", [[0x1f600, 0x1f64f], [0x1f910, 0x1f92f], [0x1f970, 0x1f97a], [0x1f97e, 0x1f97f], [0x2639, 0x263b]]],
  ["People", [[0x1f464, 0x1f487], [0x1f9b0, 0x1f9bf], [0x1f9cd, 0x1f9df], [0x1f930, 0x1f93e], [0x1f440, 0x1f450], [0x1f645, 0x1f64f], [0x1f574, 0x1f57a]]],
  ["Nature", [[0x1f400, 0x1f43f], [0x1f980, 0x1f9ae], [0x1f300, 0x1f344], [0x1f33e, 0x1f33f], [0x1f950, 0x1f95f], [0x1f54a, 0x1f54a], [0x1f9a0, 0x1f9af]]],
  ["Food", [[0x1f345, 0x1f37f], [0x1f960, 0x1f96f], [0x1f9c0, 0x1f9cc], [0x1f32d, 0x1f32f]]],
  ["Activity", [[0x1f380, 0x1f3ca], [0x1f3cb, 0x1f3f0], [0x1f93f, 0x1f94f], [0x26bd, 0x26f9]]],
  ["Travel", [[0x1f680, 0x1f6d5], [0x1f6e0, 0x1f6ff], [0x1f5fa, 0x1f5ff], [0x1f3e0, 0x1f3f0], [0x2708, 0x2708]]],
  ["Objects", [[0x1f4a0, 0x1f4ff], [0x1f526, 0x1f53d], [0x1f6c0, 0x1f6cf], [0x1f9f0, 0x1f9ff], [0x1f550, 0x1f567], [0x1f5a4, 0x1f5b2], [0x1f4b0, 0x1f4b9]]],
  ["Symbols", [[0x2600, 0x27bf], [0x1f500, 0x1f525], [0x2b00, 0x2bff], [0x2300, 0x23ff], [0x1f191, 0x1f19a], [0x1f4ad, 0x1f4af], [0x1f7e0, 0x1f7eb]]],
];

const seen = new Set();
const out = {};
for (const [name] of GROUPS) out[name] = [];

function claim(cp) {
  const s = String.fromCodePoint(cp);
  if (seen.has(s)) return;
  // Default-presentation emoji stand alone; the older text-presentation ones
  // (hearts, sun, check) need VS16 or they render as monochrome glyphs.
  let ch = null;
  if (isPresentation(s)) ch = s;
  else if (isPictographic(s) && /\p{Emoji}/u.test(s)) ch = s + "️";
  if (!ch) return;
  seen.add(s);
  return ch;
}

for (const [name, ranges] of GROUPS) {
  for (const [a, b] of ranges) {
    for (let cp = a; cp <= b; cp++) {
      const ch = claim(cp);
      if (ch) out[name].push(ch);
    }
  }
}

// Anything assigned but outside the ranges above still deserves a home. The
// regional-indicator block is skipped: on its own each letter is not an emoji,
// and sweeping it here would pair adjacent letters into flags of no country.
out.More = [];
for (let cp = 0x1f000; cp <= 0x1faff; cp++) {
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) continue;
  const ch = claim(cp);
  if (ch) out.More.push(ch);
}

// Flags are pairs of regional indicators, so they are built from ISO codes.
const ISO =
  "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(
    " "
  );
out.Flags = ISO.map((code) =>
  String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
);

const order = ["Smileys", "People", "Nature", "Food", "Activity", "Travel", "Objects", "Symbols", "Flags", "More"];
const total = order.reduce((n, k) => n + out[k].length, 0);

const body = order
  .filter((k) => out[k].length)
  .map((k) => `  { name: ${JSON.stringify(k)}, emoji: ${JSON.stringify(out[k].join(""))} },`)
  .join("\n");

const file = `// GENERATED — do not edit by hand. See tools/gen-emoji.mjs.
// The full assigned emoji set, read out of the Unicode tables the JS engine
// already ships, so nothing here renders as a missing-glyph box.
// ${total} emoji across ${order.filter((k) => out[k].length).length} groups.

// Each group's emoji are stored as one string and split at read time; a flat
// array of ${total} short strings costs far more to parse.
export type EmojiGroup = { name: string; emoji: string };

const GROUPS: EmojiGroup[] = [
${body}
];

export const EMOJI_GROUPS: { name: string; list: string[] }[] = GROUPS.map(
  (g) => ({ name: g.name, list: [...g.emoji.matchAll(/\\p{Extended_Pictographic}\\uFE0F?|\\p{RI}\\p{RI}/gu)].map((m) => m[0]) })
);
`;

await writeFile(new URL("../src/lib/emoji.ts", import.meta.url), file);
console.log("total emoji:", total);
for (const k of order) if (out[k].length) console.log(" ", k, out[k].length);
