// Builds a TRUE single self-contained HTML (like the v48 file) for sharing/testing:
// Tailwind CSS is generated and inlined, the React app is bundled by esbuild into one
// IIFE (no chunk runtime), and embedded as a base64 data: URI script. Opens anywhere.
import { build } from "esbuild";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const dest = join(projectRoot, "Innerly-preview.html");

// 1) Generate Tailwind CSS from the real design system.
const tmp = await mkdtemp(join(tmpdir(), "innerly-css-"));
const cssOut = join(tmp, "out.css");
const tw = spawnSync(
  process.execPath,
  [
    join(projectRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs"),
    "-i",
    join(projectRoot, "src", "app", "globals.css"),
    "-o",
    cssOut,
    "--minify",
  ],
  { cwd: projectRoot, encoding: "utf8" }
);
if (tw.status !== 0) {
  console.error(tw.stdout, tw.stderr);
  throw new Error("tailwind build failed");
}
let css = await readFile(cssOut, "utf8");
await rm(tmp, { recursive: true, force: true });

// Inter web font + the --font-inter variable the design system expects.
const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');";
css = `${fontImport}\n:root{--font-inter:'Inter';}\n${css}`;

// 2) Bundle the React app into a single IIFE.
const result = await build({
  entryPoints: [join(here, "standalone", "entry.tsx")],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": resolve(projectRoot, "src") },
  loader: { ".tsx": "tsx", ".ts": "ts" },
  target: ["es2020"],
});
// Inline as a normal <script> (NOT a data: URI). A large base64 data: URL can
// hit the browser's script-source length limit and silently fail when opened
// via file:// (double-click). Escaping `</script` keeps the inline tag valid.
const jsInline = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// 3) Compose one self-contained HTML.
const html = `<!doctype html>
<html lang="en" class="h-full antialiased">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Innerly</title>
<style>${css}</style>
</head>
<body class="min-h-full flex flex-col">
<div id="root"></div>
<script>${jsInline}</script>
</body>
</html>`;

await writeFile(dest, html, "utf8");

// Also drop a fresh, clearly-named copy in Downloads so it's easy to find/open.
try {
  const downloads = join(process.env.USERPROFILE || process.env.HOME || ".", "Downloads", "Innerly.html");
  await writeFile(downloads, html, "utf8");
  console.log(`Wrote ${downloads}`);
} catch (e) {
  console.warn("Could not write Downloads copy:", e?.message);
}

console.log(`Wrote ${dest} (${(html.length / 1024).toFixed(0)} KB)`);
