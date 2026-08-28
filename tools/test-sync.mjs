// Behaviour tests for the sync layer: does an account keep someone's writing,
// and — the one that matters on a shared computer — does signing out take it
// off the device so the next person cannot read it?
//
//   node tools/test-sync.mjs
//
// The real module is bundled against a fake Supabase table and a fake
// localStorage, so the decisions being checked are the ones that ship. The
// database side of the same promise is checked separately, against a real
// Postgres, by supabase/tests/rls.sql.

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "sync-")), "sync.mjs");

await build({
  entryPoints: ["/home/user/Innerly/src/lib/sync.ts"],
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  plugins: [
    {
      name: "stub",
      setup(b) {
        b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({
          path: "stub-client",
          namespace: "stub",
        }));
        b.onResolve({ filter: /^@\// }, (a) => ({
          path: a.path.replace("@/", "/home/user/Innerly/src/") + ".ts",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: `
            export const isSupabaseConfigured = true;
            export function supabase() { return globalThis.__db; }
          `,
          loader: "ts",
        }));
      },
    },
  ],
});

// Exercises the real sync module. Fake localStorage, fake Supabase table.

class FakeStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

// One shared table, standing in for user_state with RLS already proven.
const rows = [];
globalThis.__db = {
  from() {
    return {
      _user: null,
      select() { return this; },
      eq(_col, v) { this._user = v; return this._run(); },
      _run() {
        const u = this._user;
        return Promise.resolve({
          data: rows.filter((r) => r.user_id === u).map((r) => ({ key: r.key, value: r.value })),
          error: null,
        });
      },
      upsert(row) {
        const i = rows.findIndex((r) => r.user_id === row.user_id && r.key === row.key);
        if (i >= 0) rows[i] = row; else rows.push(row);
        return Promise.resolve({ error: null });
      },
    };
  },
};

globalThis.window = { localStorage: new FakeStorage() };
const ls = globalThis.window.localStorage;

const sync = await import(out);

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// What the screens actually read. The owner marker sits outside this on
// purpose, so wiping the writing cannot also wipe the record of whose it was.
const entryKeys = () => [...ls.m.keys()].filter((k) => k.startsWith("innerly:")).sort();

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

// --- Aisha writes before she has an account, then signs up. -----------------
ls.setItem("innerly:reflections", JSON.stringify(["written before signing up"]));
ls.setItem("innerly:profile", JSON.stringify({ firstName: "Aisha" }));

await sync.pull(A);
await wait(50);
check("first sign-in keeps what she wrote beforehand",
  JSON.parse(ls.getItem("innerly:reflections")), ["written before signing up"]);
check("...and uploads it to her account",
  rows.filter((r) => r.user_id === A).map((r) => r.key).sort(),
  ["innerly:profile", "innerly:reflections"]);

// --- She writes more; it syncs. ---------------------------------------------
ls.setItem("innerly:reflections", JSON.stringify(["one", "two"]));
sync.push("innerly:reflections", ["one", "two"]);
await sync.flush();
check("later edits reach the server",
  rows.find((r) => r.user_id === A && r.key === "innerly:reflections").value, ["one", "two"]);

// --- She signs out on a shared laptop. --------------------------------------
await sync.detach();
check("signing out leaves nothing on the device", [...ls.m.keys()], []);
check("...but the account still has it",
  rows.find((r) => r.user_id === A && r.key === "innerly:reflections").value, ["one", "two"]);

// --- Ben sits down at the same laptop. --------------------------------------
await sync.pull(B);
await wait(50);
check("the next person sees an empty app", entryKeys(), []);
check("...and the only thing left on the device is the owner marker",
  [...ls.m.keys()], ["innerly-owner"]);
check("...which holds an account id and no writing", ls.getItem("innerly-owner"), B);
check("...and nothing of hers was copied to him",
  rows.filter((r) => r.user_id === B).length, 0);

// --- Ben writes his own thing, signs out. Aisha comes back. -----------------
ls.setItem("innerly:reflections", JSON.stringify(["ben's entry"]));
sync.push("innerly:reflections", ["ben's entry"]);
await sync.flush();
await sync.detach();

await sync.pull(A);
await wait(50);
check("she gets her own writing back, not his",
  JSON.parse(ls.getItem("innerly:reflections")), ["one", "two"]);

// --- A deletion on another device must not resurrect here. ------------------
ls.setItem("innerly:goals", JSON.stringify(["stale local goal"]));
await sync.pull(A);
await wait(50);
check("a key the account does not have is dropped, not re-uploaded",
  ls.getItem("innerly:goals"), null);

// --- Ben switching in WITHOUT a sign-out (session swap) ----------------------
await sync.pull(B);
await wait(50);
check("switching account without signing out still wipes first",
  JSON.parse(ls.getItem("innerly:reflections")), ["ben's entry"]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
