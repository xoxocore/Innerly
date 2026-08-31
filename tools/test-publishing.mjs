// Writing a post in the panel, and reading it in the app.
//
// Needs a build pointed at a host this script can intercept:
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-publishing.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.
//
// The check that matters most is that a draft never reaches a reader, and the
// one that is easiest to get wrong is reading time: a post left open in a
// background tab is not hours of reading, and under three seconds is a glance.

import { chromium } from "playwright-core";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const mkUser = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
  email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(),
  app_metadata: { provider: "email" }, user_metadata: { name: "Divya", full_name: "Divya" } });
const mkSession = (u) => ({ access_token: "at.1", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "rt.1", user: mkUser(u) });

// A tiny in-memory posts table.
const db = [{
  id: "p-1", kind: "blog", slug: "the-quiet-cost-of-overthinking",
  title: "The quiet cost of overthinking", excerpt: "Overthinking feels like progress.",
  content: "<p>Existing seeded post.</p>", category: "Patterns", duration: null,
  cover_path: null, gradient: ["#e8f7ef", "#d6ece0"], published: true,
  published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}];
const hearts = new Set();
let uploaded = 0, saved = null, readsRecorded = [];

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

    if (path === "/auth/v1/token") return json(mkSession(OWNER));
    if (path === "/auth/v1/user") return json(mkUser(OWNER));
    if (path === "/rest/v1/rpc/is_admin") return json(true);
    if (path === "/rest/v1/rpc/admin_stats") return json({ accounts:1, confirmed:1, suspended:0,
      new_7d:0, new_30d:1, online_now:1, active_today:1, active_7d:1, active_30d:1,
      returning:0, eligible:0, posts_published:db.filter(p=>p.published).length,
      posts_drafts:db.filter(p=>!p.published).length, daily: [] });
    if (path === "/rest/v1/rpc/admin_accounts") return json([]);
    if (path === "/rest/v1/rpc/post_counts")
      return json(db.filter(p=>p.published).map(p => ({ post_id: p.id,
        hearts: hearts.has(p.id) ? 1 : 0, readers: 0 })));

    if (path.startsWith("/storage/v1/object/posts/")) { uploaded++; return json({ Key: "posts/x.png" }); }

    if (path === "/rest/v1/posts") {
      if (m === "GET") {
        const kind = (u.searchParams.get("kind") || "").replace("eq.", "");
        const pub = u.searchParams.get("published");
        let rows = db;
        if (kind) rows = rows.filter((p) => p.kind === kind);
        if (pub === "eq.true") rows = rows.filter((p) => p.published);
        return json(rows);
      }
      if (m === "POST") {
        const sent = JSON.parse(body || "{}");
        const row = Array.isArray(sent) ? sent[0] : sent;
        saved = row;
        const existing = db.find((p) => p.kind === row.kind && p.slug === row.slug);
        const full = { id: existing?.id ?? "p-" + (db.length + 1), gradient: null,
          cover_path: null, category: null, duration: null,
          updated_at: new Date().toISOString(), ...existing, ...row };
        if (existing) Object.assign(existing, full); else db.push(full);
        return json(full);
      }
      if (m === "DELETE") return json({});
    }
    if (path === "/rest/v1/post_hearts") {
      if (m === "GET") return json([...hearts].map((id) => ({ post_id: id })));
      if (m === "POST") { hearts.add(JSON.parse(body).post_id); return json({}); }
      if (m === "DELETE") { hearts.clear(); return json({}); }
    }
    if (path === "/rest/v1/post_reads") {
      if (m === "GET") return json(null);
      if (m === "POST") { readsRecorded.push(JSON.parse(body)); return json({}); }
    }
    if (path.startsWith("/rest/v1/user_state")) return m === "GET" ? json([]) : json({});
    if (path.startsWith("/rest/v1/usage_days") || path.startsWith("/rest/v1/profiles")) return json({});
    return json({});
  });
}

/* ---------------------------------------------- writing one in the panel --- */
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /Sign in/ }).click();
  await p.waitForTimeout(1500);

  await p.getByRole("button", { name: /^Writing$/ }).click();
  await p.waitForTimeout(900);
  check("the panel lists what already exists",
    (await p.locator("body").innerText()).includes("The quiet cost of overthinking"));

  await p.getByRole("button", { name: /Write a post/ }).click();
  await p.waitForTimeout(700);
  check("the editor opens", !!(await p.getByPlaceholder("Title").count()));

  await p.getByPlaceholder("Title").fill("How to notice a pattern");
  await p.waitForTimeout(300);
  const slug = await p.locator('input[aria-label="Address"]').inputValue();
  check("the address writes itself from the title", slug === "how-to-notice-a-pattern", slug);

  const body = p.locator(".post-body[contenteditable]");
  await body.click();
  await p.keyboard.type("Patterns are easier to see from the outside.");
  await p.waitForTimeout(200);

  // Formatting: select what was typed and make it a heading, then write more.
  await p.keyboard.press("Home");
  for (let i = 0; i < 8; i++) await p.keyboard.press("Shift+ArrowRight");
  await p.getByRole("button", { name: "Bold" }).click();
  await p.waitForTimeout(300);
  const html = await body.innerHTML();
  check("bold actually marks up the text", /<b>|<strong>/i.test(html), html.slice(0, 60));

  await p.locator('textarea[aria-label="Summary"]').fill("A short way in.");
  await p.locator('input[aria-label="Category"]').fill("Patterns");

  // A cover picture, which is the one thing here that leaves the browser.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVR42mNk+M9QzzCKRsEoGAWjYBSMglEwCkbBSAcAr0kH4Zb6VtQAAAAASUVORK5CYII=",
    "base64"
  );
  const covers = await p.$$('input[type=file]');
  await covers[covers.length - 1].setInputFiles({
    name: "cover.png", mimeType: "image/png", buffer: png,
  });
  await p.waitForTimeout(900);

  // Choosing a picture no longer uploads it. It opens the framing dialog
  // first, because a cover cropped to the middle by CSS puts whatever happened
  // to be in the centre of the photograph on the card.
  check("choosing a cover asks how to frame it first",
    (await p.getByRole("dialog", { name: /Frame the cover/ }).count()) > 0);
  check("...and nothing has been sent yet", uploaded === 0, `${uploaded} upload(s)`);

  await p.getByRole("button", { name: /Use this/ }).click();
  await p.waitForTimeout(1400);
  check("a cover picture uploads", uploaded > 0, `${uploaded} upload(s)`);
  check("...and is shown back straight away",
    (await p.locator("aside img").count()) > 0);

  await p.getByRole("button", { name: /^Preview$/ }).click();
  await p.waitForTimeout(500);
  const prev = await p.locator("body").innerText();
  check("preview shows it as a reader would see it",
    prev.includes("How to notice a pattern") && prev.includes("A short way in."));
  await p.screenshot({ path: "publish-preview.png" });
  await p.getByRole("button", { name: /Keep writing/ }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "publish-editor.png" });

  await p.getByRole("button", { name: /^Publish$/ }).click();
  await p.waitForTimeout(1400);
  check("publishing saves it", saved?.title === "How to notice a pattern");
  check("...as published, with a date", saved?.published === true && !!saved?.published_at);
  check("...and returns to the list",
    (await p.locator("body").innerText()).includes("How to notice a pattern"));

  // Draft
  await p.getByRole("button", { name: /Write a post/ }).click();
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Title").fill("Not ready yet");
  await p.getByRole("button", { name: /Save draft/ }).click();
  await p.waitForTimeout(1200);
  check("a draft saves unpublished", saved?.published === false);
  const list = await p.locator("body").innerText();
  check("...and is marked as a draft in the list", /draft/i.test(list));
  await p.screenshot({ path: "publish-list.png" });
  check("no page errors in the panel", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- reading it in the app --- */
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })).newPage();
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
  await p.waitForTimeout(800);
  const tour = p.locator("[role=dialog]");
  if (await tour.count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }

  await p.getByRole("button", { name: /^Blog$/ }).first().click();
  await p.waitForTimeout(1200);
  const blogList = await p.locator("body").innerText();
  check("the new post appears in the app without a deploy",
    blogList.includes("How to notice a pattern"));
  check("...alongside the ones that were already there",
    blogList.includes("The quiet cost of overthinking"));
  check("the unpublished draft is NOT shown to readers",
    !blogList.includes("Not ready yet"));
  await p.screenshot({ path: "publish-app-list.png" });

  await p.getByText("How to notice a pattern").first().click();
  await p.waitForTimeout(1000);
  check("the post opens", (await p.locator("body").innerText()).includes("Patterns are easier"));

  await p.getByRole("button", { name: /Love this/ }).click();
  await p.waitForTimeout(700);
  const after = await p.locator("body").innerText();
  check("a heart registers", /Loved this/.test(after));
  check("...and is counted", /1 person found this useful/.test(after), after.match(/\d+ pe\w+ found[^\n]*/)?.[0]);
  await p.screenshot({ path: "publish-app-post.png" });

  // Dwell past the three-second floor — under that is a glance, not a read,
  // and the code deliberately does not count it.
  await p.waitForTimeout(3500);

  // Leaving the post banks the reading time.
  await p.getByRole("button", { name: /^Blog$/ }).first().click();
  await p.waitForTimeout(1200);
  check("time spent reading is recorded on the way out",
    readsRecorded.length > 0 && readsRecorded[0].seconds >= 3,
    readsRecorded[0] ? `${readsRecorded[0].seconds}s` : "none");
  check("no page errors in the app", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad === 0 ? "\nAll checks passed." : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
