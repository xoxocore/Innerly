// Sending an email, and receiving a notification without asking for one.
//
// The send is the one thing here that cannot be taken back, so it is exercised
// for real rather than mocked away: this script runs a stand-in for both
// Supabase and Resend on port 4322 and reads back what the route actually
// posted — who it was addressed to, what the subject said, whether the
// unsubscribe link was in the body.
//
// That stand-in has to serve BOTH halves. `page.route` reaches the browser
// only, and /api/admin/email runs in Node, where it does its own sign-in check
// before it will send anything. Point the build at the stub and both halves
// land in the same place:
//
//   export NEXT_PUBLIC_SUPABASE_URL=http://localhost:4322
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   export SUPABASE_SERVICE_ROLE_KEY=stub
//   export RESEND_API_KEY=re_stub RESEND_API_BASE=http://localhost:4322
//   export EMAIL_FROM="Innerly <hello@example.com>"
//   npm run build && npm start &
//   node tools/test-email.mjs
//
// Rebuild normally afterwards, or a localhost URL ends up in a real deploy.

import { chromium } from "playwright-core";
import { createServer } from "node:http";


const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const SIGNED_UP = new Date(Date.now() - 30 * 864e5).toISOString();
const mkUser = () => ({ id: OWNER.id, aud: "authenticated", role: "authenticated",
  email: OWNER.email, email_confirmed_at: SIGNED_UP, created_at: SIGNED_UP,
  app_metadata: { provider: "email" }, user_metadata: { name: "Divya", full_name: "Divya" } });
const mkSession = () => ({ access_token: "at.1", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "rt.1", user: mkUser() });

const notes = [{ id: "n-1", title: "Welcome back to Innerly, {name}",
  body: "Your streak is still going.", kind: "tip", audience: "everyone",
  trigger: "on_signin", scheduled_for: null, link_view: null, published: true,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
const noteState = [];
const campaigns = [];
let unsubscribed = null;
let savedCampaign = null;

/* ------------------------------------------- the Supabase/Resend stand-in --
 * Only the handful of endpoints the send route reaches from Node. Everything
 * the browser asks for is intercepted below instead, so the two never disagree
 * about anything a check looks at.
 */
const posted = [];
// Flipped on to make the stand-in behave like Resend before a domain is
// verified: it refuses anything addressed to somebody other than the account
// holder. This is the state every new account starts in.
let noDomainYet = false;
const campaignRow = { id: "c-1", subject: "Something new, {name}",
  preheader: "A small thing", body: "<p>We added a tour for new people.</p>",
  custom_html: null, audience: "everyone", status: "draft", delivered: 0 };
const stub = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const path = new URL(req.url, "http://x").pathname;
    const send = (d) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(d));
    };

    if (path === "/emails/batch") {
      const msgs = JSON.parse(raw || "[]");
      if (noDomainYet && msgs.some((m) => m.to[0] !== OWNER.email)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ statusCode: 403, name: "validation_error",
          message: "You can only send testing emails to your own email address " +
            "(owner@example.com). To send emails to other recipients, please " +
            "verify a domain at resend.com/domains" }));
      }
      posted.push(...msgs);
      return send({ data: [] });
    }
    if (path === "/auth/v1/user") return send(mkUser());
    if (path === "/auth/v1/token") return send(mkSession());
    if (path === "/rest/v1/rpc/is_admin") return send(true);
    if (path === "/rest/v1/email_prefs") return send({ marketing: true, token: "tok-1" });
    if (path === "/rest/v1/email_campaigns") {
      if (req.method === "GET") return send(campaignRow);
      // The route writes the outcome back; keep it, so a second attempt sees
      // exactly what a real second attempt would.
      Object.assign(campaignRow, JSON.parse(raw || "{}"));
      return send(campaignRow);
    }
    if (path === "/rest/v1/rpc/email_recipients") {
      // Two people, one of them not the account holder — otherwise the
      // unverified-domain refusal below could never fire.
      return send([
        { user_id: OWNER.id, email: OWNER.email, first_name: "Divya", token: "tok-1" },
        { user_id: "11111111-1111-1111-1111-111111111111",
          email: "aisha@example.com", first_name: "Aisha", token: "tok-2" },
      ]);
    }
    return send({});
  });
});
await new Promise((go) => stub.listen(4322, go));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad = 0;
const check = (n, ok, extra) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${extra ? "  — " + extra : ""}`); };

async function mock(page) {
  await page.route("**localhost:4322/**", async (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    const path = u.pathname;
    const body = route.request().postData();
    const json = (d, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(d) });

    if (path === "/auth/v1/token") return json(mkSession());
    if (path === "/auth/v1/user") return json(mkUser());
    if (path === "/rest/v1/rpc/is_admin") return json(true);
    if (path === "/rest/v1/rpc/unsubscribe") { unsubscribed = JSON.parse(body).t; return json(true); }
    if (path === "/rest/v1/rpc/email_audience_size") return json(7);
    if (path === "/rest/v1/rpc/notification_counts") return json([]);
    if (path === "/rest/v1/rpc/admin_stats") return json({ accounts:1, confirmed:1, suspended:0,
      new_7d:0, new_30d:0, online_now:1, active_today:1, active_7d:1, active_30d:1,
      returning:0, eligible:0, posts_published:0, posts_drafts:0, daily: [] });
    if (path === "/rest/v1/rpc/admin_accounts") return json([]);
    if (path === "/rest/v1/rpc/post_counts") return json([]);

    if (path === "/rest/v1/notifications") return m === "GET" ? json(notes) : json({});
    if (path === "/rest/v1/notification_state") {
      if (m === "GET") return json(noteState);
      if (m === "POST") { for (const r of [].concat(JSON.parse(body||"[]"))) noteState.push(r); return json({}); }
    }
    if (path === "/rest/v1/email_campaigns") {
      if (m === "GET") return json(campaigns);
      if (m === "POST") {
        const row = [].concat(JSON.parse(body || "{}"))[0];
        savedCampaign = row;
        const full = { id: row.id ?? "c-1", status: "draft", sent_at: null, recipients: 0,
          delivered: 0, failed: 0, error: null, created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(), ...row };
        const existing = campaigns.find((c) => c.id === full.id);
        if (existing) Object.assign(existing, full); else campaigns.push(full);
        return json(full);
      }
    }
    if (path === "/rest/v1/email_prefs") {
      if (m === "GET") return json({ marketing: true, token: "tok-1" });
      if (m === "POST") return json({});
    }
    if (path.startsWith("/rest/v1/posts")) return json([]);
    if (path.startsWith("/rest/v1/user_state")) return m === "GET" ? json([]) : json({});
    return json({});
  });
}

/* ---------------------------------- a notification arriving without a click */
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
  // Walk the tour to the end: toasts are held back until it is done, so a
  // message never competes with a dimmed screen.
  for (let i = 0; i < 8; i++) {
    const next = p.locator("[role=dialog]").getByRole("button", { name: /^(Next|Start writing)$/ });
    if (!(await next.count())) break;
    await next.first().click(); await p.waitForTimeout(450);
  }
  await p.waitForTimeout(1800);

  const toast = p.locator("[role=status]");
  check("a notification appears without touching the bell", (await toast.count()) > 0);
  check("...with the name filled in",
    (await p.locator("body").innerText()).includes("Welcome back to Innerly, Divya"));
  await p.screenshot({ path: "toast.png" });

  check("seeing it counts as read", noteState.some((s) => s.seen_at));
  const bellLabel = await p.getByRole("button", { name: /Notifications/ }).first().getAttribute("aria-label");
  check("...so the bell does not still claim it is unread",
    !/new/.test(bellLabel || ""), bellLabel);

  // But it stays in the bell — missing a toast is not dismissing it.
  await p.getByRole("button", { name: /Notifications/ }).first().click();
  await p.waitForTimeout(600);
  check("it is still there in the bell afterwards",
    (await p.locator("body").innerText()).includes("Welcome back to Innerly, Divya"));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------- writing an email */
{
  const p = await (await b.newContext({ viewport: { width: 1360, height: 1050 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  // The send route is real, and points at a local stand-in for Resend so the
  // whole path is exercised rather than mocked away.

  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /Sign in/ }).click();
  await p.waitForTimeout(1500);

  await p.getByRole("button", { name: /^Email$/ }).click();
  await p.waitForTimeout(800);
  check("the panel has an Email tab", !!(await p.getByText(/Nothing sent yet/).count()));

  await p.getByRole("button", { name: /Write one/ }).click();
  await p.waitForTimeout(700);
  check("a preview is shown", !!(await p.getByText(/Exactly what lands in their inbox/).count()));

  await p.locator('input[aria-label="Subject"]').fill("Something new, {name}");
  const editor = p.locator(".post-body[contenteditable]");
  await editor.click();
  await p.keyboard.type("We added a tour for new people.");
  await p.waitForTimeout(700);

  // The preview is a real iframe rendering the real template.
  const frame = p.frameLocator("iframe[title='Email preview']");
  const previewText = await frame.locator("body").innerText();
  check("the preview renders the actual email",
    previewText.includes("Something new, Divya"), previewText.split("\n")[1]);
  check("...including the message", previewText.includes("We added a tour"));
  check("...and an unsubscribe line, on every one",
    /Stop these emails/i.test(previewText));

  await p.locator('input[aria-label="Preview as"]').fill("");
  await p.waitForTimeout(600);
  check("an empty name still reads properly",
    (await frame.locator("body").innerText()).includes("Something new, there"));
  await p.locator('input[aria-label="Preview as"]').fill("Divya");
  await p.waitForTimeout(400);

  check("it says how many people it would reach",
    /Send to 7/.test(await p.locator("body").innerText()));
  await p.screenshot({ path: "email-compose.png" });

  /* ------------------------------------------- pictures, buttons, pasting -- */

  // A picture with no width is the thing that made the last email look wrong:
  // an <img> in an email renders at its own pixel size unless it is told not to.
  await editor.click();
  await p.evaluate(() => {
    const el = document.querySelector(".post-body[contenteditable]");
    el.innerHTML +=
      '<figure><img src="https://example.com/huge.jpg" width="4000" height="3000" />' +
      '<figcaption>A caption</figcaption></figure>' +
      '<p><a data-cta="1" href="https://innerly.example/">Try Innerly</a></p>';
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.waitForTimeout(800);

  const framed = await frame.locator("img").first();
  const imgBox = await framed.evaluate((el) => ({
    w: el.getBoundingClientRect().width,
    attr: el.getAttribute("width"),
    style: el.getAttribute("style") || "",
  }));
  check("a huge picture is held to the frame", imgBox.w <= 500, `${Math.round(imgBox.w)}px wide`);
  check("...with a width attribute, not only CSS", imgBox.attr === "496", String(imgBox.attr));
  check("...and its original 4000px width dropped", !/width:\s*4000/.test(imgBox.style));

  const ctaBg = await frame.locator('a[href="https://innerly.example/"]').first()
    .evaluate((el) => {
      const cell = el.closest("td");
      return { bg: cell ? getComputedStyle(cell).backgroundColor : "", pad: getComputedStyle(el).padding };
    });
  check("a button is drawn as a button, not a link",
    /rgb\(0,\s*135,\s*74\)/.test(ctaBg.bg), ctaBg.bg);
  check("...with padding Outlook will actually paint", parseFloat(ctaBg.pad) > 5, ctaBg.pad);

  await p.screenshot({ path: "email-rich.png" });

  // A design made somewhere else goes out as it is.
  await p.getByRole("button", { name: /Paste a design/ }).click();
  await p.waitForTimeout(500);
  await p.locator('textarea[aria-label="Pasted HTML"]').fill(
    '<html><body><h1 style="color:#ff00ff">Hello {name}, from Canva</h1></body></html>'
  );
  await p.waitForTimeout(900);
  const pastedText = await frame.locator("body").innerText();
  check("a pasted design is shown as it is", /Hello Divya, from Canva/.test(pastedText),
    pastedText.split("\n")[0]);
  check("...with the unsubscribe line still added", /Stop these emails/i.test(pastedText));
  check("...and Innerly's own frame left off", !/Something new, Divya/.test(pastedText));
  await p.screenshot({ path: "email-pasted.png" });

  // Back to writing: the written version must have survived the detour.
  await p.getByRole("button", { name: /Write it here/ }).click();
  await p.waitForTimeout(700);
  check("switching back keeps what was written",
    /We added a tour/.test(await frame.locator("body").innerText()));

  await p.getByRole("button", { name: /Send me a test/ }).click();
  await p.waitForTimeout(2000);
  check("a test can be sent to yourself first",
    /Sent to owner@example.com/.test(await p.locator("body").innerText()));
  const testMail = posted.at(-1);
  check("...and it really left for the mail service",
    testMail?.to?.[0] === OWNER.email, JSON.stringify(testMail?.to));
  check("...marked as a test, so it is not mistaken for the real one",
    /^\[Test\] /.test(testMail?.subject || ""), testMail?.subject);
  check("...reading exactly as a real one would, name and all",
    testMail?.subject === "[Test] Something new, Divya", testMail?.subject);
  check("...carrying a working unsubscribe link",
    /\/unsubscribe\?t=tok-1/.test(testMail?.html || ""));

  // Sending for real asks first.
  await p.getByRole("button", { name: /Send to 7/ }).click();
  await p.waitForTimeout(600);
  const confirm = await p.locator("[role=dialog]").innerText();
  check("sending for real asks first", /Send to 7 people\?/.test(confirm));
  check("...and says it cannot be called back", /cannot be called back/.test(confirm));
  await p.screenshot({ path: "email-confirm.png" });
  await p.getByRole("button", { name: /Not yet/ }).click();
  await p.waitForTimeout(400);

  await p.getByRole("button", { name: /Save draft/ }).click();
  await p.waitForTimeout(1200);
  check("it saves as a draft", savedCampaign?.subject === "Something new, {name}");
  check("no page errors in the panel", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------------------- the unsubscribe link */
{
  const p = await (await b.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await mock(p);
  // Nobody signed in — exactly how somebody arrives from their inbox.
  await p.goto("http://localhost:3000/unsubscribe?t=tok-1", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const text = await p.locator("body").innerText();
  check("the link works without signing in", /no more of those/i.test(text), text.split("\n")[1]);
  check("...and the token was the one from the link", unsubscribed === "tok-1", String(unsubscribed));
  check("...and it promises account email still arrives",
    /password reset/i.test(text));
  await p.screenshot({ path: "unsubscribe.png" });
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------- sending before you own a domain -- */
{
  // Every Resend account starts here, and it is where somebody setting Innerly
  // up for the first time will be. Getting told plainly, and not losing the
  // newsletter, is the whole of it.
  noDomainYet = true;
  Object.assign(campaignRow, { status: "draft", delivered: 0 });

  // Driven from a signed-in page, because the route checks who is asking
  // before it checks anything else — a bare fetch is turned away at the door.
  const p = await (await b.newContext()).newPage();
  await mock(p);
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /Sign in/ }).click();
  await p.waitForTimeout(1500);

  const post = (test) => p.evaluate(async (t) => {
    const r = await fetch("/api/admin/email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: "c-1", test: t }),
    });
    return { status: r.status, body: await r.json() };
  }, test);

  const first = await post(false);
  check("sending with no domain is refused", first.body.delivered === 0,
    JSON.stringify(first.body).slice(0, 90));
  check("...and says why, in words that help",
    /domain isn.t verified/i.test(first.body.error || ""), first.body.error);
  check("...pointing at where to fix it",
    /resend\.com\/domains/.test(first.body.error || ""));
  check("...promising nothing went out", /nothing has gone out/i.test(first.body.error || ""));
  check("...and the campaign is not stamped as sent", campaignRow.sent_at === null,
    String(campaignRow.sent_at));

  // The thing that actually matters: it can be sent once a domain exists.
  const second = await post(false);
  check("it is NOT locked as already-sent", second.status !== 409,
    `HTTP ${second.status}: ${second.body.error || ""}`);

  noDomainYet = false;
  const third = await post(false);
  check("and once the domain is verified it goes", third.body.delivered === 2,
    JSON.stringify(third.body).slice(0, 90));

  // Now it really has gone out, so it must refuse to go again.
  const fourth = await post(false);
  check("after a real send it refuses to repeat", fourth.status === 409, `HTTP ${fourth.status}`);
  check("...and says who already has it",
    /already gone out to 2 people/.test(fourth.body.error || ""), fourth.body.error);
  // And what somebody actually sees: the composer must stay put and say so,
  // rather than closing as though the newsletter went out.
  noDomainYet = true;
  Object.assign(campaignRow, { status: "draft", delivered: 0, sent_at: null });
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /^Email$/ }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Write one/ }).click();
  await p.waitForTimeout(700);
  await p.locator('input[aria-label="Subject"]').fill("Hello everyone");
  await p.locator(".post-body[contenteditable]").click();
  await p.keyboard.type("A first newsletter.");
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /Send to \d/ }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /^Send it$|Send now|Yes/ }).first().click();
  await p.waitForTimeout(2000);
  const shown = await p.locator("body").innerText();
  check("the composer says so on screen rather than closing",
    /domain isn.t verified/i.test(shown), shown.split("\n").find((l) => /domain/i.test(l)));
  check("...and the draft is still there to send later",
    (await p.locator('input[aria-label="Subject"]').inputValue()) === "Hello everyone");
  await p.screenshot({ path: "email-nodomain.png" });
  await p.close();
}

await b.close();
stub.close();
console.log(bad === 0 ? "\nAll checks passed." : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
