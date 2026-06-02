// Extract the central copy dictionary object from v48 by brace-matching.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = await readFile(join(root, "reference", "innerly-v48.html"), "utf8");

// Find the dictionary: look for `{brand:{appName` and walk back to the opening brace.
const anchor = html.indexOf("brand:{appName");
if (anchor < 0) throw new Error("anchor not found");
// The opening brace of the whole dict is the `{` immediately before `brand:`.
let start = html.lastIndexOf("{", anchor);
// Brace-match forward from start.
let depth = 0;
let inStr = null;
let end = -1;
for (let i = start; i < html.length; i++) {
  const ch = html[i];
  if (inStr) {
    if (ch === "\\") { i++; continue; }
    if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
  if (ch === "{") depth++;
  else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
}
const obj = html.slice(start, end + 1);
await writeFile(join(root, "tools", "v48-copy-raw.txt"), obj, "utf8");
console.log("dict length:", obj.length);
console.log("preview:", obj.slice(0, 300));
