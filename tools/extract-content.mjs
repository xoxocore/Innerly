import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = await readFile(join(root, "reference", "innerly-v48.html"), "utf8");

function matchObjAround(idx) {
  let start = html.lastIndexOf("{", idx);
  let depth = 0, inStr = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) { if (ch === "\\") { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}

const slugs = ["the-quiet-cost-of-overthinking","why-patterns-repeat","consistency-is-kindness","getting-started","pause-and-review","calm-daily-plan"];
let out = "";
for (const s of slugs) {
  const idx = html.indexOf(`slug:"${s}"`);
  if (idx < 0) { out += `\n// MISSING ${s}\n`; continue; }
  out += `\n/* ===== ${s} ===== */\n` + matchObjAround(idx) + "\n";
}
await writeFile(join(root, "tools", "v48-content-raw.txt"), out, "utf8");
console.log("wrote", out.length, "chars");
