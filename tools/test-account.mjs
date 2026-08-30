// Managing your own account: name, photo, password, notifications, pausing,
// deleting, exporting.
//
// Pausing and deleting run in Node, in /api/account, where page.route cannot
// reach — so this runs a stand-in for Supabase on port 4323 that the server
// itself calls, and drives both all the way through the real route rather
// than mocking the outcome. Deleting is the one action here with nothing
// behind it to undo; it is checked with a wrong password first (must refuse,
// must not delete) and then a right one (must actually delete, must clear
// the photos with it).
//
//   export NEXT_PUBLIC_SUPABASE_URL=http://localhost:4323
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   export SUPABASE_SERVICE_ROLE_KEY=stub
//   npm run build && npm start &
//   node tools/test-account.mjs
//
// Rebuild normally afterwards, or a localhost URL ends up in a real deploy.

import { chromium } from "playwright-core";
import { createServer } from "node:http";


const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const SIGNED_UP = new Date("2026-03-14T10:00:00Z").toISOString();
const mkUser = () => ({ id: OWNER.id, aud: "authenticated", role: "authenticated",
  email: OWNER.email, email_confirmed_at: SIGNED_UP, created_at: SIGNED_UP,
  app_metadata: { provider: "email" }, user_metadata: { name: "Divya", full_name: "Divya" } });
const mkSession = () => ({ access_token: "at.1", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "rt.1", user: mkUser() });

let marketing = true;
let paused = null;
let uploaded = null;
let removed = 0;
let passwordChanged = null;
let signOutScope = null;
const CURRENT = "hunter2";

/* --------------------------------------------------- the server's Supabase --
 * /api/account runs in Node, checks who is asking, and only then acts. None of
 * that is reachable by page.route, so pausing and deleting — the two things
 * here that cannot be taken back — would go completely untested without a
 * stand-in the server itself can call.
 */
let deletedUser = null;
const stub = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const path = new URL(req.url, "http://x").pathname;
    const ok = (d) => { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify(d)); };

    if (path === "/auth/v1/token") {
      const sent = JSON.parse(raw || "{}");
      if (sent.password && sent.password !== CURRENT) {
        res.writeHead(400, {"Content-Type":"application/json"});
        return res.end(JSON.stringify({ error: "invalid_grant",
          error_description: "Invalid login credentials" }));
      }
      return ok(mkSession());
    }
    if (path === "/auth/v1/user") return ok(mkUser());
    if (path === "/rest/v1/rpc/is_admin") return ok(true);
    if (path === "/rest/v1/rpc/set_paused") {
      paused = JSON.parse(raw || "{}").paused;
      return ok(paused ? new Date().toISOString() : null);
    }
    if (path.startsWith("/storage/v1/object/list/")) return ok([{ name: "old.jpg" }]);
    if (path.startsWith("/storage/v1/object/")) { removed++; return ok([]); }
    if (path.startsWith("/auth/v1/admin/users/")) {
      if (req.method === "DELETE") { deletedUser = path.split("/").pop(); return ok({}); }
      return ok({ user: mkUser() });
    }
    return ok({});
  });
});
await new Promise((go) => stub.listen(4323, go));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad = 0;
const check = (n, ok, extra) => { if (!ok) bad++; console.log(`${ok?"PASS":"FAIL"}  ${n}${extra?"  — "+extra:""}`); };

async function mock(page) {
  await page.route("**localhost:4323/**", async (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    const path = u.pathname, body = route.request().postData();
    const json = (d, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(d) });

    if (path === "/auth/v1/token") {
      const sent = JSON.parse(body || "{}");
      // Signing in again is how the current password is proved.
      if (sent.password && sent.password !== CURRENT) {
        return json({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
      }
      return json(mkSession());
    }
    if (path === "/auth/v1/user") {
      if (m === "PUT") { passwordChanged = JSON.parse(body || "{}").password; return json(mkUser()); }
      return json(mkUser());
    }
    if (path === "/auth/v1/logout") { signOutScope = u.searchParams.get("scope") ?? "global"; return json({}); }
    if (path === "/rest/v1/rpc/is_admin") return json(true);
    if (path === "/rest/v1/rpc/set_paused") { paused = JSON.parse(body).paused; return json(paused ? new Date().toISOString() : null); }
    if (path === "/rest/v1/email_prefs") {
      if (m === "GET") return json({ marketing });
      marketing = JSON.parse(body || "{}").marketing ?? marketing;
      return json({});
    }
    if (path.startsWith("/storage/v1/object/list/avatars")) return json([{ name: "old.jpg" }]);
    if (path.startsWith("/storage/v1/object/avatars")) {
      if (m === "POST" || m === "PUT") { uploaded = path; return json({ Key: "avatars/x" }); }
      if (m === "DELETE") { removed++; return json([]); }
    }
    if (path.startsWith("/storage/v1/object/sign/avatars")) {
      return json({ signedURL: "/storage/v1/object/sign/avatars/fake?token=t" });
    }
    if (path.startsWith("/rest/v1/rpc/notification_counts")) return json([]);
    if (path === "/rest/v1/notifications") return json([]);
    if (path.startsWith("/rest/v1/user_state")) return m === "GET" ? json([]) : json({});
    if (path.startsWith("/rest/v1/posts")) return json([]);
    return json({});
  });
}

async function signedIn(width = 1280, height = 1000) {
  const p = await (await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill(CURRENT);
  await p.getByRole("button", { name: /^Sign in$/ }).click();
  await p.waitForTimeout(1800);
  for (let i = 0; i < 8; i++) {
    const btn = p.getByRole("button", { name: /Continue|Get started/ });
    if (!(await btn.count())) break;
    await btn.first().click(); await p.waitForTimeout(350);
  }
  // Wait for the tour to actually appear before dismissing it. It mounts a
  // moment after the onboarding questions, so checking too early finds nothing
  // and then its full-screen overlay swallows every click that follows.
  await p.locator("[role=dialog]").first().waitFor({ state: "visible", timeout: 8000 })
    .catch(() => {});
  for (let i = 0; i < 6 && (await p.locator("[role=dialog]").count()); i++) {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Settings$/ }).first().click();
  await p.waitForTimeout(900);
  return { p, errs };
}

/* ------------------------------------------------------- what is on the page */
{
  const { p, errs } = await signedIn();
  const text = await p.locator("main").innerText();

  check("the weekly report is gone", !/Weekly report/i.test(text));
  for (const [name, re] of [
    ["a profile picture", /Add a photo/],
    ["a display name", /display name/i],
    ["the account's email", new RegExp(OWNER.email)],
    ["when they joined", /Using Innerly since/],
    ["changing the password", /Change password/],
    ["notifications", /Allow notifications/],
    ["email from us", /News and tips/],
    ["taking their writing with them", /Download everything/],
    ["the tour", /Show me around again/],
    ["signing out", /Sign out/],
    ["signing out everywhere", /Sign out everywhere/],
    ["pausing", /Pause my account/],
    ["deleting", /Delete my account/],
  ]) check(`it offers ${name}`, re.test(text), re.test(text) ? "" : "missing");

  check("the join date is the day they started, readable",
    /14 March 2026|March 14, 2026/.test(text),
    (text.match(/Using Innerly since\n?(.*)/) || [])[1]);

  // Density: this is the complaint being fixed.
  const h1 = await p.locator("h1").first().evaluate((e) => getComputedStyle(e).fontSize);
  check("the title matches Reflect, not the old big one", parseFloat(h1) <= 25, h1);
  const body = await p.locator("main p").nth(3).evaluate((e) => getComputedStyle(e).fontSize);
  check("body text is the compact size", parseFloat(body) <= 13.5, body);

  // The switch knob must sit inside its track. Without a horizontal origin it
  // starts at the button's default padding and hangs off the right-hand end.
  const knob = await p.evaluate(() => {
    const sw = document.querySelector('[role="switch"]');
    if (!sw) return null;
    const t = sw.getBoundingClientRect();
    const k = sw.firstElementChild.getBoundingClientRect();
    return { inside: k.left >= t.left - 0.5 && k.right <= t.right + 0.5,
             over: Math.round(k.right - t.right) };
  });
  check("the switch knob sits inside its track", knob?.inside === true,
    knob ? `${knob.over}px past the end` : "no switch found");

  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("nothing pushes the page sideways", over <= 1, String(over));
  check("no page errors", errs.length === 0, errs[0]);
  await p.screenshot({ path: "settings-full.png", fullPage: true });
  await p.close();
}

/* ------------------------------------------------------------ the name saves */
{
  const { p, errs } = await signedIn();
  const field = p.locator('input[aria-label="Display name"]');
  await field.fill("Divyanjali");
  await p.getByRole("button", { name: /^Save$/ }).click();
  await p.waitForTimeout(700);
  check("saving the name says so", /Saved/.test(await p.locator("main").innerText()));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /^Settings$/ }).first().click();
  await p.waitForTimeout(800);
  check("...and it survives a reload",
    (await p.locator('input[aria-label="Display name"]').inputValue()) === "Divyanjali");
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------------------- changing password */
{
  const { p, errs } = await signedIn();
  await p.getByRole("button", { name: /Change password/ }).click();
  await p.waitForTimeout(500);

  await p.locator('input[aria-label="Current password"]').fill("wrong-one");
  await p.locator('input[aria-label="New password"]').fill("brand-new-pw");
  await p.locator('input[aria-label="New password again"]').fill("brand-new-pw");
  await p.getByRole("button", { name: /^Change password$/ }).click();
  await p.waitForTimeout(1200);
  check("the wrong current password is refused",
    /current password doesn't match/i.test(await p.locator("main").innerText()));
  check("...and nothing was changed", passwordChanged === null, String(passwordChanged));

  await p.locator('input[aria-label="Current password"]').fill(CURRENT);
  await p.getByRole("button", { name: /^Change password$/ }).click();
  await p.waitForTimeout(1400);
  check("the right one goes through", passwordChanged === "brand-new-pw", String(passwordChanged));
  check("...and it says so", /has been changed/i.test(await p.locator("main").innerText()));

  // Mismatched confirmation must not even be submittable.
  await p.getByRole("button", { name: /Change password/ }).click();
  await p.waitForTimeout(400);
  await p.locator('input[aria-label="Current password"]').fill(CURRENT);
  await p.locator('input[aria-label="New password"]').fill("aaaaaaaa");
  await p.locator('input[aria-label="New password again"]').fill("bbbbbbbb");
  await p.waitForTimeout(300);
  check("a mismatch is caught before sending",
    await p.getByRole("button", { name: /^Change password$/ }).isDisabled());
  check("...and says which two disagree",
    /don.t match yet/i.test(await p.locator("main").innerText()));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------------ the danger zone */
{
  const { p, errs } = await signedIn();
  // Deleting asks twice, and the second time for a password.
  await p.getByRole("button", { name: /Delete my account/ }).click();
  await p.waitForTimeout(500);
  const text = await p.locator("main").innerText();
  check("deleting warns it cannot be undone", /no way for anyone/i.test(text));
  check("...and points at the export first", /Download everything/.test(text));
  check("...and asks for the password", !!(await p.locator('input[aria-label="Password to confirm deletion"]').count()));
  check("...with the button held until one is typed",
    await p.getByRole("button", { name: /Delete it permanently/ }).isDisabled());
  await p.screenshot({ path: "settings-danger.png" });

  await p.getByRole("button", { name: /Keep my account/ }).click();
  await p.waitForTimeout(400);
  check("backing out puts it away",
    (await p.locator('input[aria-label="Password to confirm deletion"]').count()) === 0);

  // Pausing is the reversible one, and says so.
  await p.getByRole("button", { name: /^Pause my account$/ }).click();
  await p.waitForTimeout(400);
  check("pausing promises it can be undone",
    /Signing back in brings all of it back/i.test(await p.locator("main").innerText()));
  await p.getByRole("button", { name: /Yes, pause it/ }).click();
  await p.waitForTimeout(1800);
  check("pausing really pauses", paused === true, String(paused));
  check("...and signs them out", /Sign in|Welcome/i.test(await p.locator("body").innerText()));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------- deleting for real */
{
  deletedUser = null; removed = 0;
  const { p, errs } = await signedIn();
  await p.getByRole("button", { name: /Delete my account/ }).click();
  await p.waitForTimeout(400);

  // The wrong password must not delete anything.
  await p.locator('input[aria-label="Password to confirm deletion"]').fill("not-it");
  await p.getByRole("button", { name: /Delete it permanently/ }).click();
  await p.waitForTimeout(1500);
  check("the wrong password does not delete", deletedUser === null, String(deletedUser));
  check("...and says so plainly",
    /password doesn.t match/i.test(await p.locator("main").innerText()));
  check("...leaving them signed in",
    (await p.locator('input[aria-label="Password to confirm deletion"]').count()) === 1);

  await p.locator('input[aria-label="Password to confirm deletion"]').fill(CURRENT);
  await p.getByRole("button", { name: /Delete it permanently/ }).click();
  await p.waitForTimeout(2200);
  check("the right password deletes the account", deletedUser === OWNER.id, String(deletedUser));
  check("...and clears the photos with it", removed > 0, `${removed} removals`);
  check("...and returns to the welcome screen",
    /Sign in|Welcome/i.test(await p.locator("body").innerText()));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- sign out everywhere + export */
{
  paused = null; signOutScope = null;
  const { p, errs } = await signedIn();

  const dl = p.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await p.getByRole("button", { name: /Download everything/ }).click();
  const file = await dl;
  check("the export downloads", !!file, file ? file.suggestedFilename() : "no download");
  check("...named for the day it was taken", /^innerly-\d{4}-\d{2}-\d{2}\.json$/.test(file?.suggestedFilename() ?? ""));
  if (file) {
    const path = await file.path();
    const { readFileSync } = await import("node:fs");
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    check("...and it really holds their writing", !!parsed.data && typeof parsed.data === "object",
      Object.keys(parsed.data ?? {}).slice(0, 4).join(","));
    check("...says which account it came from", parsed.account === OWNER.email);
  }

  await p.getByRole("button", { name: /Sign out everywhere/ }).click();
  await p.waitForTimeout(1600);
  check("signing out everywhere is global", signOutScope === "global", String(signOutScope));
  check("...and does not pause the account", paused === null, String(paused));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
stub.close();
console.log(bad === 0 ? "\nAll checks passed." : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
