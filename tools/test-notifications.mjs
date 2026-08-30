// Writing a notification in the panel, and receiving it in the app.
//
// Needs a build pointed at a host this script can intercept:
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-notifications.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.
//
// The preview checks matter most: the composer renders through the very same
// component the app uses, and these are what would catch the two drifting.

import { chromium } from "playwright-core";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
// Signed up 30 days ago, so "returning" applies and "just joined" does not.
const SIGNED_UP = new Date(Date.now() - 30 * 864e5).toISOString();
const mkUser = () => ({ id: OWNER.id, aud: "authenticated", role: "authenticated",
  email: OWNER.email, email_confirmed_at: SIGNED_UP, created_at: SIGNED_UP,
  app_metadata: { provider: "email" }, user_metadata: { name: "Divya", full_name: "Divya" } });
const mkSession = () => ({ access_token: "at.1", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "rt.1", user: mkUser() });

const notes = [];
const state = [];
let saved = null;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad = 0;
const check = (n, ok, extra) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${extra ? "  — " + extra : ""}`); };

async function mock(page) {
  await page.route("**stub.supabase.co/**", async (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    const path = u.pathname;
    const body = route.request().postData();
    const json = (d, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(d) });

    if (path === "/auth/v1/token") return json(mkSession());
    if (path === "/auth/v1/user") return json(mkUser());
    if (path === "/rest/v1/rpc/is_admin") return json(true);
    if (path === "/rest/v1/rpc/notification_counts")
      return json(notes.map((n) => ({ notification_id: n.id,
        seen: state.filter((s) => s.notification_id === n.id && s.seen_at).length, dismissed: 0 })));
    if (path === "/rest/v1/rpc/admin_stats") return json({ accounts:1, confirmed:1, suspended:0,
      new_7d:0, new_30d:0, online_now:1, active_today:1, active_7d:1, active_30d:1,
      returning:0, eligible:0, posts_published:0, posts_drafts:0, daily: [] });
    if (path === "/rest/v1/rpc/admin_accounts") return json([]);
    if (path === "/rest/v1/rpc/post_counts") return json([]);

    if (path === "/rest/v1/notifications") {
      if (m === "GET") {
        const pub = u.searchParams.get("published");
        let rows = notes;
        if (pub === "eq.true") rows = rows.filter((n) => n.published);
        return json(rows);
      }
      if (m === "POST") {
        const sent = JSON.parse(body || "{}");
        const row = Array.isArray(sent) ? sent[0] : sent;
        saved = row;
        const existing = notes.find((n) => n.id === row.id);
        const full = { id: row.id ?? "n-" + (notes.length + 1),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          ...existing, ...row };
        if (existing) Object.assign(existing, full); else notes.push(full);
        return json(full);
      }
      if (m === "DELETE") return json({});
    }
    if (path === "/rest/v1/notification_state") {
      if (m === "GET") return json(state);
      if (m === "POST") {
        const sent = JSON.parse(body || "[]");
        for (const r of Array.isArray(sent) ? sent : [sent]) state.push(r);
        return json({});
      }
    }
    if (path.startsWith("/rest/v1/posts")) return json([]);
    if (path.startsWith("/rest/v1/user_state")) return m === "GET" ? json([]) : json({});
    return json({});
  });
}

/* ------------------------------------------------ writing one, with preview */
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1050 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /Sign in/ }).click();
  await p.waitForTimeout(1500);

  await p.getByRole("button", { name: /^Notify$/ }).click();
  await p.waitForTimeout(800);
  check("the panel has a Notify tab", !!(await p.getByText(/Nothing sent yet/).count()));

  await p.getByRole("button", { name: /Write one/ }).click();
  await p.waitForTimeout(600);

  const preview = p.locator("aside");
  check("a preview is shown before anything is sent",
    !!(await p.getByText(/Exactly what they'll see/).count()));

  await p.locator('input[aria-label="Title"]').fill("Welcome back to Innerly, {name}");
  await p.locator('textarea[aria-label="Body"]').fill("Your streak is still going.");
  await p.waitForTimeout(400);

  const shown = await preview.innerText();
  check("the preview fills in the name", shown.includes("Welcome back to Innerly, Divya"), shown.split("\n").find(l=>l.includes("Welcome")));
  check("...and shows the body too", shown.includes("Your streak is still going."));

  // Somebody who never set a name.
  await p.locator('input[aria-label="Preview as"]').fill("");
  await p.waitForTimeout(400);
  check("an empty name falls back to something sayable",
    (await preview.innerText()).includes("Welcome back to Innerly, there"));
  await p.locator('input[aria-label="Preview as"]').fill("Divya");
  await p.waitForTimeout(300);

  await p.getByRole("button", { name: /^Tip$/ }).click();
  await p.waitForTimeout(400);
  check("changing the style changes the preview",
    (await preview.locator("svg").count()) > 0);

  await p.getByRole("button", { name: /Been here a while/ }).click();
  await p.getByRole("button", { name: /When they arrive/ }).click();
  await p.waitForTimeout(400);
  const summary = await preview.innerText();
  check("the preview says who gets it and when",
    /been here a while/i.test(summary) && /as they open/i.test(summary),
    summary.split("\n").pop());
  await p.screenshot({ path: "notify-compose.png" });

  await p.getByRole("button", { name: /Send it|Turn it on|Schedule it/ }).click();
  await p.waitForTimeout(1400);
  check("sending saves it", saved?.title === "Welcome back to Innerly, {name}");
  check("...published, to the right people, at the right moment",
    saved?.published === true && saved?.audience === "returning" && saved?.trigger === "on_signin");
  check("...and returns to the list",
    (await p.locator("body").innerText()).includes("Welcome back to Innerly"));

  // A draft, and a scheduled one.
  await p.getByRole("button", { name: /Write one/ }).click();
  await p.waitForTimeout(600);
  await p.locator('input[aria-label="Title"]').fill("Not ready");
  await p.getByRole("button", { name: /Save draft/ }).click();
  await p.waitForTimeout(1200);
  check("a draft saves unpublished", saved?.published === false);
  check("...and is labelled in the list", /draft/i.test(await p.locator("body").innerText()));
  await p.screenshot({ path: "notify-list.png" });
  check("no page errors in the panel", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------------------- receiving it in the app */
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /^Sign in$/ }).click();
  await p.waitForTimeout(2000);
  for (let i = 0; i < 8; i++) {
    const btn = p.getByRole("button", { name: /Continue|Get started/ });
    if (!(await btn.count())) break;
    await btn.first().click(); await p.waitForTimeout(400);
  }
  await p.waitForTimeout(900);
  if (await p.locator("[role=dialog]").count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  await p.waitForTimeout(1200);

  const bell = p.getByRole("button", { name: /Notifications/ });
  check("there is a bell in the app", (await bell.count()) > 0);
  const label = await bell.first().getAttribute("aria-label");
  check("...with an unread badge", /1 new/.test(label || ""), label);
  await p.screenshot({ path: "notify-bell.png" });

  await bell.first().click();
  await p.waitForTimeout(700);
  const panel = await p.locator("body").innerText();
  check("the message arrives, with their real name in it",
    panel.includes("Welcome back to Innerly, Divya"));
  check("the unpublished draft is NOT delivered", !panel.includes("Not ready"));
  await p.screenshot({ path: "notify-panel.png" });

  check("opening it marks it seen", state.some((s) => s.seen_at));

  // Dismiss removes it for good.
  await p.getByRole("button", { name: /^Dismiss$/ }).first().click();
  await p.waitForTimeout(700);
  check("dismissing removes it",
    !(await p.locator("body").innerText()).includes("Welcome back to Innerly, Divya"));
  check("...and is remembered", state.some((s) => s.dismissed_at));
  check("no page errors in the app", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad === 0 ? "\nAll checks passed." : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
