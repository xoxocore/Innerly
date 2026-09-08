// Sending one vision card to somebody, and what comes back.
//
// This is the first thing in Innerly that leaves the private circle, so the
// test walks the whole way round it: the owner makes a link, a stranger with
// no account opens it in a browser that has never seen Innerly, leaves a
// heart, and the count turns up on the owner's own board. Then the owner takes
// the link back and the stranger is left with nothing.
//
// Supabase is stood up as a real HTTP server rather than intercepted in the
// page, because the shared card is rendered on the server — routing it in the
// browser would leave the half that matters untested.
//
//   node tools/test-vision-share.mjs          (builds and starts the app itself)
//
// The migration's own rules are tested separately, against real Postgres, in
// supabase/tests/vision-shares.sql.

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const DB_PORT = 54999;
const APP = "http://localhost:3000";
const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const UP = new Date(Date.now() - 30 * 864e5).toISOString();

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

/* ------------------------------------------------- Supabase, near enough to it */

const shares = new Map();  // token -> row
const hearts = new Map();  // token -> Set(viewer)

const db = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const path = new URL(req.url, "http://x").pathname;
    const send = (code, data) => {
      res.writeHead(code, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      });
      res.end(JSON.stringify(data));
    };
    if (req.method === "OPTIONS") return send(200, {});
    const arg = body ? JSON.parse(body) : {};

    if (path === "/auth/v1/token" || path === "/auth/v1/user") {
      const user = {
        id: OWNER.id, aud: "authenticated", role: "authenticated", email: OWNER.email,
        email_confirmed_at: UP, created_at: UP, app_metadata: { provider: "email" },
        user_metadata: { name: "Divya", full_name: "Divya" },
      };
      return send(200, path === "/auth/v1/user" ? user : {
        access_token: "at.1", token_type: "bearer", expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "rt.1", user,
      });
    }

    if (path === "/rest/v1/rpc/vision_share_put") {
      const found = [...shares.values()].find((s) => s.item_id === arg.p_item_id);
      if (found) {
        Object.assign(found, {
          title: arg.p_title, description: arg.p_description,
          image_path: arg.p_image_path, image_url: arg.p_image_url, revoked_at: null,
        });
        return send(200, found.token);
      }
      const token = randomUUID().replace(/-/g, "").slice(0, 24);
      shares.set(token, {
        token, item_id: arg.p_item_id, title: arg.p_title,
        description: arg.p_description, image_path: arg.p_image_path,
        image_url: arg.p_image_url, created_at: new Date().toISOString(), revoked_at: null,
      });
      return send(200, token);
    }

    if (path === "/rest/v1/rpc/vision_share_get") {
      const s = shares.get(arg.share_token);
      if (!s || s.revoked_at) return send(200, []);
      const set = hearts.get(s.token) ?? new Set();
      return send(200, [{
        title: s.title, description: s.description, image_path: s.image_path,
        image_url: s.image_url, created_at: s.created_at,
        hearts: set.size,
        hearted: !!arg.viewer_id && set.has(arg.viewer_id),
      }]);
    }

    if (path === "/rest/v1/rpc/vision_share_heart") {
      const s = shares.get(arg.share_token);
      if (!s || s.revoked_at) return send(200, null);
      if (!arg.viewer_id || arg.viewer_id.length < 8) return send(200, null);
      const set = hearts.get(s.token) ?? new Set();
      if (arg.loved) set.add(arg.viewer_id);
      else set.delete(arg.viewer_id);
      hearts.set(s.token, set);
      return send(200, set.size);
    }

    if (path === "/rest/v1/rpc/vision_share_mine") {
      return send(200, [...shares.values()].filter((s) => !s.revoked_at).map((s) => ({
        item_id: s.item_id, token: s.token, hearts: (hearts.get(s.token) ?? new Set()).size,
      })));
    }

    if (path === "/rest/v1/vision_shares" && req.method === "PATCH") {
      const token = new URL(req.url, "http://x").searchParams.get("token")?.replace("eq.", "");
      const s = shares.get(token);
      if (s) s.revoked_at = new Date().toISOString();
      return send(200, []);
    }

    if (path === "/rest/v1/vision_shares" && req.method === "GET") {
      const token = new URL(req.url, "http://x").searchParams.get("token")?.replace("eq.", "");
      const s = shares.get(token);
      return send(200, s ? [s] : []);
    }

    // The board signs a batch of photos at once; the image route signs one.
    // Two different endpoints, and the plural one has no trailing path.
    if (path === "/storage/v1/object/sign/visions") {
      return send(200, (arg.paths ?? []).map((pth) => ({
        path: pth, signedURL: `/object/sign/visions/${pth}?token=signed`, error: null,
      })));
    }

    if (path.startsWith("/storage/v1/object/sign/visions/")) {
      const object = path.replace("/storage/v1/object/sign/visions/", "");
      return send(200, { signedURL: `/object/sign/visions/${object}?token=signed` });
    }

    if (path.startsWith("/rest/v1/")) return send(200, []);
    send(200, {});
  });
});
await new Promise((r) => db.listen(DB_PORT, "127.0.0.1", r));

/* ---------------------------------------------------------------- the app */

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${DB_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon-key",
  // Set so the image route runs its real path rather than reporting itself
  // unconfigured — which is what a shared photo depends on.
  SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
};
console.log("building against the stub…");
await new Promise((resolve, reject) => {
  const b = spawn("npm", ["run", "build"], { env, stdio: "ignore" });
  b.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("build failed"))));
});
// A server left running from an earlier run would happily answer on this port
// and the whole suite would silently grade the wrong build — which is exactly
// how a failing image route once looked like a bug in the route.
try {
  await fetch(APP);
  console.error(
    `Something is already serving ${APP}. Stop it first, or this suite will ` +
      `test that instead of the build it just made.`
  );
  process.exit(1);
} catch {
  // Nothing there, which is what we want.
}

const app = spawn("npm", ["start"], { env, stdio: "ignore", detached: true });
const stopApp = () => {
  try {
    process.kill(-app.pid);
  } catch {
    app.kill();
  }
};
process.on("exit", stopApp);
for (let i = 0; i < 40; i++) {
  try { await fetch(APP); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const VISION = {
  id: "vision-under-test",
  title: "A cabin with a long window",
  description: "<p>Somewhere the light comes in all morning.</p>",
  imagePath: "33333333-3333-3333-3333-333333333333/cabin.jpg",
  gradient: ["#e8f7ef", "#d6ece0"],
  createdAt: new Date().toISOString(),
};
const BOARD = [{ id: "y", year: "2030", items: [VISION] }];

async function asOwner() {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 950 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript((b) => {
    localStorage.setItem("innerly:visionboard", JSON.stringify(b));
  }, BOARD);
  await p.goto(APP, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /^Sign in$/ }).click();
  await p.waitForTimeout(1800);
  for (let i = 0; i < 8; i++) {
    const btn = p.getByRole("button", { name: /Continue|Get started/ });
    if (!(await btn.count())) break;
    await btn.first().click();
    await p.waitForTimeout(350);
  }
  await p.locator("[role=dialog]").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  for (let i = 0; i < 8 && (await p.locator("[role=dialog]").count()); i++) {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Vision Board" }).first().click();
  await p.waitForTimeout(900);
  return { p, errs };
}

/* ------------------------------------------------------- the owner makes a link */

const owner = await asOwner();
await owner.p.getByText(VISION.title, { exact: true }).first().click();
await owner.p.waitForTimeout(700);
await owner.p.getByRole("button", { name: "Share" }).click();
await owner.p.waitForTimeout(900);

check("opening Share publishes nothing on its own", shares.size === 0,
  `${shares.size} shares exist`);

const make = owner.p.getByRole("button", { name: /Create a link/ });
check("...it offers to make one", (await make.count()) > 0);
await make.click();
await owner.p.waitForTimeout(1200);

check("a link is made once asked for", shares.size === 1, `${shares.size}`);
const token = [...shares.keys()][0];
const linkBox = owner.p.getByRole("textbox", { name: "Link to this vision" });
const shown = await linkBox.inputValue();
check("...and shown to copy", shown.endsWith(`/v/${token}`), shown);
check("...with a token nobody could guess", token.length >= 20, `${token.length} chars`);
check("...that is not the vision's own id", !shown.includes(VISION.id), shown);

/* --------------------------------------------- a stranger opens what they were sent */

const strangerCtx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const stranger = await strangerCtx.newPage();
const strangerErrs = [];
stranger.on("pageerror", (e) => strangerErrs.push(String(e)));
await stranger.goto(`${APP}/v/${token}`, { waitUntil: "networkidle" });
await stranger.waitForTimeout(800);

const seen = await stranger.locator("body").innerText();
check("a stranger sees the card", seen.includes(VISION.title), seen.slice(0, 60));
check("...and what was written on it",
  seen.includes("light comes in all morning"), seen.slice(0, 120));
check("...but nothing else of the owner's",
  !/Dashboard|Daily Plan|Reflect|Settings|History/.test(seen), seen.slice(0, 120));
check("...without being asked to sign in",
  !/Sign in|Password/i.test(seen), seen.slice(0, 120));

const heart = stranger.getByRole("button", { name: "Leave a heart" });
check("...and can leave a heart", (await heart.count()) > 0);

await heart.click();
await stranger.waitForTimeout(700);
check("the heart is counted", (hearts.get(token)?.size ?? 0) === 1,
  `${hearts.get(token)?.size ?? 0}`);

await stranger.getByRole("button", { name: "Take back your heart" }).click();
await stranger.waitForTimeout(600);
check("...and can be taken back", (hearts.get(token)?.size ?? 0) === 0);
await stranger.getByRole("button", { name: "Leave a heart" }).click();
await stranger.waitForTimeout(600);

await stranger.reload({ waitUntil: "networkidle" });
await stranger.waitForTimeout(900);
check("...and is remembered on the way back",
  (await stranger.getByRole("button", { name: "Take back your heart" }).count()) > 0);
check("a reload does not inflate the count", (hearts.get(token)?.size ?? 0) === 1,
  `${hearts.get(token)?.size ?? 0}`);
check("no errors on the shared card", strangerErrs.length === 0, strangerErrs[0]);

/* ------------------------------------------- and it comes back to the owner's board */

const back = await asOwner();
await back.p.getByText(VISION.title, { exact: true }).first().click();
await back.p.waitForTimeout(700);
await back.p.getByRole("button", { name: "Share" }).click();
await back.p.waitForTimeout(1200);
const ownerSees = await back.p.locator("body").innerText();
check("the heart turns up on the owner's own board",
  /One person has loved this/.test(ownerSees),
  ownerSees.split("\n").find((l) => /loved/.test(l)) ?? "");

/* ------------------------------------------------------------- the photo */

{
  const live = await strangerCtx.request.get(
    `${APP}/api/share/image?token=${token}`,
    { maxRedirects: 0 }
  );
  check("the photo is served while the card is shared",
    live.status() === 307, `${live.status()}`);
  const to = live.headers()["location"] ?? "";
  check("...as a signed link, never as a public object",
    /token=signed/.test(to) && !/^https?:\/\/[^/]*\/storage\/v1\/object\/public/.test(to),
    to.slice(0, 70));

  const nosuch = await strangerCtx.request.get(
    `${APP}/api/share/image?token=not-a-real-token`,
    { maxRedirects: 0 }
  );
  check("...and an unknown token gets no photo", nosuch.status() === 404,
    `${nosuch.status()}`);
}

/* ------------------------------------------------------------ taking it back */

await back.p.getByRole("button", { name: "Stop sharing" }).click();
await back.p.waitForTimeout(1000);
check("the share can be stopped", !!shares.get(token)?.revoked_at);

const after = await strangerCtx.newPage();
await after.goto(`${APP}/v/${token}`, { waitUntil: "networkidle" });
await after.waitForTimeout(600);
const gone = await after.locator("body").innerText();
check("...and the link then shows nothing",
  !gone.includes(VISION.title) && /isn't being shared/i.test(gone), gone.slice(0, 90));

const img = await strangerCtx.request.get(`${APP}/api/share/image?token=${token}`, {
  maxRedirects: 0,
});
check("...and the photo is closed off with it", img.status() === 404, `${img.status()}`);

const madeUp = await strangerCtx.newPage();
await madeUp.goto(`${APP}/v/not-a-real-token`, { waitUntil: "networkidle" });
const nothing = await madeUp.locator("body").innerText();
check("a made-up link shows nothing either", /isn't being shared/i.test(nothing),
  nothing.slice(0, 60));

check("no errors on the owner's side", back.errs.length === 0, back.errs[0]);

await browser.close();
stopApp();
db.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
