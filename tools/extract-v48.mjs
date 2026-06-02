// Extract a content/structure map from the minified v48 bundle so we can rebuild faithfully.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = await readFile(join(root, "reference", "innerly-v48.html"), "utf8");

// Pull the inline scripts out of the HTML.
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const js = scripts.join("\n");

// 1) String literals (single, double, template) of reasonable length.
const strings = new Set();
const reDouble = /"((?:[^"\\]|\\.){2,200})"/g;
const reSingle = /'((?:[^'\\]|\\.){2,200})'/g;
const reTick = /`((?:[^`\\]|\\.){2,400})`/g;
for (const re of [reDouble, reSingle, reTick]) {
  let m;
  while ((m = re.exec(js))) {
    const s = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
    // Keep human-readable copy: has a space or starts uppercase word, not code-ish.
    if (/[A-Za-z]/.test(s) && !/^[a-z]+([A-Z][a-z]*)+$/.test(s) && !/^[\w.-]+$/.test(s)) {
      strings.add(s);
    }
  }
}

// 2) localStorage keys.
const lsKeys = new Set();
for (const m of js.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)/g)) lsKeys.add(m[1]);
for (const m of js.matchAll(/["'`](innerly[._:-][\w.:-]+)["'`]/gi)) lsKeys.add(m[1]);

// 3) Candidate screen/route identifiers (PascalCase words that look like view names).
const screens = new Set();
for (const m of js.matchAll(/["'`]([A-Z][a-zA-Z]{2,30})["'`]/g)) screens.add(m[1]);

const out = {
  scriptCount: scripts.length,
  jsLength: js.length,
  localStorageKeys: [...lsKeys].sort(),
  screenIdCandidates: [...screens].sort(),
  copy: [...strings].sort((a, b) => a.localeCompare(b)),
};
await writeFile(join(root, "tools", "v48-map.json"), JSON.stringify(out, null, 2), "utf8");
console.log("scripts:", scripts.length, "jsLen:", js.length);
console.log("localStorageKeys:", out.localStorageKeys.length);
console.log("screenIdCandidates:", out.screenIdCandidates.length);
console.log("copy strings:", out.copy.length);
