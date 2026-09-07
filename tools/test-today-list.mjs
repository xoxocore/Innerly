// Today's plan, on the home page.
//
// Two things worth guarding. The home list is what is still to do — a task
// that has been finished has had its moment and should not sit there being
// scrolled past. And finishing one should feel like something: a small burst
// beside the tick, which has to survive long enough to be seen before the row
// it belongs to leaves, or ticking a task looks like losing it.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-today-list.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.

import { chromium } from "playwright-core";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const UP = new Date(Date.now() - 30 * 864e5).toISOString();
const mkUser = () => ({
  id: OWNER.id, aud: "authenticated", role: "authenticated", email: OWNER.email,
  email_confirmed_at: UP, created_at: UP, app_metadata: { provider: "email" },
  user_metadata: { name: "Divya", full_name: "Divya" },
});

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const OPEN_1 = "Write the launch email";
const OPEN_2 = "Book the dentist";
const FINISHED = "Already finished this one";
const TASKS = [
  { id: "t1", title: OPEN_1, done: false },
  { id: "t2", title: FINISHED, done: true },
  { id: "t3", title: OPEN_2, done: false },
];
const DAY = new Date().toISOString().slice(0, 10);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open({ reduced = false } = {}) {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2,
    reducedMotion: reduced ? "reduce" : "no-preference",
  })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.route("**stub.supabase.co/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    const j = (d) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (path === "/auth/v1/token") return j({
      access_token: "at.1", token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "rt.1", user: mkUser(),
    });
    if (path === "/auth/v1/user") return j(mkUser());
    if (path.startsWith("/rest/v1/")) return j([]);
    return j({});
  });
  await p.addInitScript(([day, tasks]) => {
    localStorage.setItem(`innerly:tasks:${day}`, JSON.stringify(tasks));
  }, [DAY, TASKS]);

  await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
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
  await p.waitForTimeout(800);
  return { p, errs };
}

// Named by what it holds rather than by a task, so it still resolves once the
// task that named it has been ticked off and left.
const list = (p) =>
  p
    .locator("ul")
    .filter({ has: p.getByRole("button", { name: /Mark (complete|incomplete)/ }) })
    .first();

/* ------------------------------------------------- finished tasks are gone */
{
  const { p, errs } = await open();

  check("the open tasks are listed",
    (await p.getByText(OPEN_1, { exact: true }).count()) > 0 &&
    (await p.getByText(OPEN_2, { exact: true }).count()) > 0);
  check("...and the finished one is not",
    (await p.getByText(FINISHED, { exact: true }).count()) === 0);

  const rows = await list(p).locator("li").count();
  check("...so the list is only what is left", rows === 2, `${rows} rows`);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------------------- ticking one off */
{
  const { p, errs } = await open();

  const row = list(p).locator("li").filter({ hasText: OPEN_1 }).first();
  const tick = row.getByRole("button", { name: "Mark complete" });
  check("the tick is there to press", (await tick.count()) > 0);

  // Sampling starts in the page before the click, because what matters is not
  // that twelve elements exist — it is that they are painted on their way. A
  // burst that jumps straight to its final frame is present in the DOM and
  // invisible to the person who earned it.
  const tracing = p.evaluate(
    () =>
      new Promise((done) => {
        const seen = [];
        const t0 = performance.now();
        const frame = () => {
          const el = document.querySelector("li .celebrate > span");
          if (el) {
            const cs = getComputedStyle(el);
            seen.push(Number(cs.opacity));
          }
          if (performance.now() - t0 < 1100) requestAnimationFrame(frame);
          else done(seen);
        };
        requestAnimationFrame(frame);
      })
  );

  await tick.click();
  const opacities = await tracing;
  const painted = opacities.filter((o) => o > 0.05);
  check("a burst is actually painted", painted.length >= 5,
    `${painted.length} frames of ${opacities.length}`);
  check("...and it fades out rather than hanging about",
    opacities.length > 0 && opacities[opacities.length - 1] <= 0.05,
    String(opacities[opacities.length - 1]));

  await p.waitForTimeout(60);

  // It stays long enough to be seen, then the row goes.
  check("the row waits while the burst plays",
    (await p.getByText(OPEN_1, { exact: true }).count()) > 0);

  await p.waitForTimeout(1600);
  check("...then leaves the list",
    (await p.getByText(OPEN_1, { exact: true }).count()) === 0);
  check("...and the other task is untouched",
    (await p.getByText(OPEN_2, { exact: true }).count()) > 0);

  const stored = await p.evaluate(
    (day) => JSON.parse(localStorage.getItem(`innerly:tasks:${day}`)),
    DAY
  );
  const t1 = stored.find((t) => t.id === "t1");
  check("...having actually been marked done", t1.done === true, JSON.stringify(t1));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------ nothing left to do */
{
  const { p, errs } = await open();
  for (const title of [OPEN_1, OPEN_2]) {
    await list(p).locator("li").filter({ hasText: title }).first()
      .getByRole("button", { name: "Mark complete" }).click();
    await p.waitForTimeout(1200);
  }
  const text = await p.locator("main").innerText();
  check("finishing everything says so, rather than 'no actions yet'",
    /everything for today/i.test(text) && !/No actions yet/i.test(text),
    text.split("\n").find((l) => /today/i.test(l) && !/plan/i.test(l)) ?? "");
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------ its size and place */
{
  const { p, errs } = await open();
  const row = list(p).locator("li").filter({ hasText: OPEN_1 }).first();
  const tick = row.getByRole("button", { name: "Mark complete" });
  const tickBox = await tick.boundingBox();
  await tick.click();
  await p.waitForTimeout(60);

  const sparks = row.locator(".celebrate > span");
  check("the burst has some body to it", (await sparks.count()) >= 8,
    `${await sparks.count()} pieces`);

  const box = await sparks.first().boundingBox();
  const dx = Math.abs(box.x + box.width / 2 - (tickBox.x + tickBox.width / 2));
  const dy = Math.abs(box.y + box.height / 2 - (tickBox.y + tickBox.height / 2));
  check("...and it stays beside the task, not across the page", dx < 60 && dy < 60,
    `${Math.round(dx)}px across, ${Math.round(dy)}px down`);
  check("...each piece confetti-sized", box.width <= 10 && box.height <= 10,
    `${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------ less movement, please */
{
  const { p, errs } = await open({ reduced: true });
  const row = list(p).locator("li").filter({ hasText: OPEN_1 }).first();
  await row.getByRole("button", { name: "Mark complete" }).click();
  await p.waitForTimeout(120);
  const shown = await row.locator(".celebrate").first()
    .evaluate((el) => getComputedStyle(el).display)
    .catch(() => "none");
  check("no shower for anyone who asked for less movement", shown === "none", shown);
  await p.waitForTimeout(1400);
  check("...but the task still completes",
    (await p.getByText(OPEN_1, { exact: true }).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
