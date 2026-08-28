// Behaviour tests for the vision-board photo path.
//
//   node tools/test-vision-images.mjs
//
// The one that matters most: a signed URL must never be written to disk. It
// lasts an hour, so persisting one turns every board blank the next day. The
// rest cover the bucket not filling with files nothing points at.

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "vision-")), "m.mjs");

// Uploads and deletes recorded here, so the test can assert on them.
const calls = { uploaded: [], removed: [], signed: [] };

await build({
  entryPoints: ["/home/user/Innerly/src/state/use-data.ts"],
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  plugins: [
    {
      name: "stub",
      setup(b) {
        b.onResolve({ filter: /^@\/features\/vision-board\/vision-images$/ }, () => ({
          path: "stub-images",
          namespace: "stub",
        }));
        // stripSignedUrls is plain data work; the hooks around it are not
        // under test here, so React is stubbed rather than bundled.
        b.onResolve({ filter: /^react$/ }, () => ({
          path: "stub-react",
          namespace: "stub",
        }));
        b.onResolve({ filter: /^@\// }, (a) => ({
          path: a.path.replace("@/", "/home/user/Innerly/src/") + ".ts",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          contents:
            a.path === "stub-react"
              ? `export const useCallback = (f) => f;
                 export const useEffect = () => {};
                 export const useMemo = (f) => f();
                 export const useState = (v) => [v, () => {}];`
              : `export const isDataUrl = (v) => !!v && v.startsWith("data:");
                 export const storageEnabled = () => true;
                 export const uploadVisionImage = async () => "u1/x.jpg";
                 export const signVisionImages = async () => new Map();`,
          loader: "js",
        }));
      },
    },
  ],
});

const { stripSignedUrls } = await import(out);
const { normalizeVisionYear } = await import(
  await bundleTypes()
);

async function bundleTypes() {
  const o = join(out, "..", "t.mjs");
  await build({
    entryPoints: ["/home/user/Innerly/src/lib/types.ts"],
    bundle: true, format: "esm", outfile: o, platform: "neutral",
  });
  return o;
}

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
  );
};

const SIGNED =
  "https://x.supabase.co/storage/v1/object/sign/visions/u1/a.jpg?token=expires-in-an-hour";

// --- the invariant ----------------------------------------------------------
const board = [
  {
    id: "y1",
    year: "2026",
    items: [
      { id: "a", title: "Sea", imagePath: "u1/a.jpg", imageUrl: SIGNED },
      { id: "b", title: "Link", imageUrl: "https://example.com/photo.jpg" },
      { id: "c", title: "Legacy", imageUrl: "data:image/jpeg;base64,AAAA" },
      { id: "d", title: "No photo" },
    ],
  },
];

const saved = stripSignedUrls(board);
check("a signed URL is never written to disk", saved[0].items[0].imageUrl, undefined);
check("...but its path is kept", saved[0].items[0].imagePath, "u1/a.jpg");
check("an external link survives untouched",
  saved[0].items[1].imageUrl, "https://example.com/photo.jpg");
check("a not-yet-migrated data URL survives untouched",
  saved[0].items[2].imageUrl, "data:image/jpeg;base64,AAAA");
check("an item with no photo is left alone", saved[0].items[3].imageUrl, undefined);
check("stripping does not drop items", saved[0].items.length, 4);

// Re-stripping must not change anything: this runs on every single save.
check("stripping twice is the same as once",
  stripSignedUrls(saved), saved);

// --- round-trip through the normalizer, which is what reads from disk -------
const reread = normalizeVisionYear(JSON.parse(JSON.stringify(saved[0])));
check("imagePath survives a save/load round trip",
  reread.items[0].imagePath, "u1/a.jpg");
check("...and no stale URL comes back with it",
  reread.items[0].imageUrl, undefined);

// --- a board that predates Storage --------------------------------------
const legacyOnly = normalizeVisionYear({
  id: "y2", year: "2025",
  items: [{ id: "z", title: "Old", imageUrl: "data:image/png;base64,BBBB" }],
});
check("an old board still loads with its photo",
  legacyOnly.items[0].imageUrl, "data:image/png;base64,BBBB");
check("...and is marked as not yet moved", legacyOnly.items[0].imagePath, undefined);


// --- the Storage calls themselves ------------------------------------------
// Bundled against a stub client, so the exact bucket, path and options the app
// sends are checked without needing a network.

const images = join(out, "..", "images.mjs");
await build({
  entryPoints: ["/home/user/Innerly/src/features/vision-board/vision-images.ts"],
  bundle: true, format: "esm", outfile: images, platform: "neutral",
  plugins: [{
    name: "stub2",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: "c", namespace: "s2" }));
      b.onResolve({ filter: /^@\/lib\/sync$/ }, () => ({ path: "y", namespace: "s2" }));
      b.onLoad({ filter: /.*/, namespace: "s2" }, (a) => ({
        contents: a.path === "c"
          ? `export const isSupabaseConfigured = true;
             export const supabase = () => globalThis.__sb;`
          : `export const currentUserId = () => globalThis.__uid;`,
        loader: "js",
      }));
    },
  }],
});

globalThis.__uid = "user-one";
globalThis.__sb = {
  storage: {
    from(bucket) {
      return {
        async upload(path, blob, opts) {
          calls.uploaded.push({ bucket, path, type: blob.type, size: blob.size, opts });
          return { error: null };
        },
        async createSignedUrls(paths, ttl) {
          calls.signed.push({ bucket, paths, ttl });
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}?t=1` })), error: null };
        },
        async remove(paths) {
          calls.removed.push({ bucket, paths });
          return { error: null };
        },
      };
    },
  },
};

const vi = await import(images);

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const path = await vi.uploadVisionImage(PIXEL, "item-7");
check("upload goes to the visions bucket", calls.uploaded[0].bucket, "visions");
check("the path is prefixed with the owner's id — the fence the policy checks",
  path, "user-one/item-7.png");
check("the blob carries its real type", calls.uploaded[0].type, "image/png");
check("a re-upload replaces rather than erroring", calls.uploaded[0].opts.upsert, true);

const signed1 = await vi.signVisionImages(["user-one/a.jpg", "user-one/b.jpg"]);
check("both photos come back signed", signed1.size, 2);
check("signed in one request, not one each", calls.signed.length, 1);
await vi.signVisionImages(["user-one/a.jpg"]);
check("a still-valid link is reused, not re-signed", calls.signed.length, 1);

// The one that matters: never reach outside your own prefix.
await vi.deleteVisionImages(["someone-else/secret.jpg"]);
check("deleting another account's photo is refused", calls.removed.length, 0);
await vi.deleteVisionImages(["user-one/a.jpg", "someone-else/secret.jpg"]);
check("...and a mixed batch drops the foreign one",
  calls.removed[0].paths, ["user-one/a.jpg"]);

globalThis.__uid = null;
check("signed out, nothing is uploaded", await vi.uploadVisionImage(PIXEL, "x"), null);
check("signed out, storage is reported off", vi.storageEnabled(), false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
