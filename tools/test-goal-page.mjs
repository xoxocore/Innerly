// A goal, opened.
//
// Two things worth guarding. The page has to read at the density the rest of
// the app writes at — it was built at poster size, twice everything else, and
// nothing about a list of sub-goals earns that. And the colour has to be the
// user's to change: colours are handed out by position when a goal is made, so
// the one somebody ends up with is an accident until they can pick another.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-goal-page.mjs
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

/** The tick beside one named action, wherever in the thread it sits. */
const tickFor = (p, title) =>
  p
    .locator("li")
    .filter({ has: p.locator(`input[value="${title}"]`) })
    .getByRole("button", { name: "Mark complete" });

const GOAL = {
  id: "goal-under-test",
  title: "Get Innerly Live",
  color: "blue",
  createdAt: new Date().toISOString(),
  order: 0,
  // Yesterday, so the day turn has a night to carry things across.
  lastReset: "2020-01-01",
  horizons: {
    year: [{ id: "s1", title: "Get 100,000 active users to Innerly", done: false }],
    sixMonths: [{ id: "s2", title: "Get 20,000 active users to Innerly", done: false }],
    threeMonths: [], oneMonth: [],
    thisWeek: [{ id: "w1", title: "Fix the wording in the UI", done: false }],
    today: [
      { id: "t1", title: "Change the review card to white", done: false },
      { id: "t2", title: "Innerly logo recreation", done: true,
        completedAt: "2020-01-01T10:15:00.000Z" },
    ],
  },
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open() {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2,
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
  await p.addInitScript((g) => {
    localStorage.setItem("innerly:goals", JSON.stringify([g]));
  }, GOAL);

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
  await p.waitForTimeout(600);
  return { p, errs };
}

async function openGoal(p) {
  await p.getByRole("button", { name: "Daily Plan" }).first().click();
  await p.waitForTimeout(900);
  // The goal's name also appears as the note under its own action in the day
  // panel above, so the card in "Your goals" is the last of the two.
  await p.getByText(GOAL.title, { exact: true }).last().click();
  await p.getByRole("button", { name: /All goals/ }).waitFor({ timeout: 8000 });
  await p.waitForTimeout(500);
}

/* ---------------------------------------------------------------- density */
{
  const { p, errs } = await open();
  await openGoal(p);

  const title = await p.locator("input[placeholder='Name your goal']").evaluate(
    (el) => parseFloat(getComputedStyle(el).fontSize)
  );
  check("the goal title is a page heading, not a poster", title <= 26, `${title}px`);

  // The Reflect screen is the density this page is supposed to match.
  const sub = p.locator(`input[value="${GOAL.horizons.year[0].title}"]`).first();
  const subSize = await sub.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("a sub-goal reads at the app's own size", subSize <= 13.5, `${subSize}px`);

  const card = await p.locator("input[placeholder='Name your goal']")
    .evaluate(() => {
      const label = [...document.querySelectorAll("p")].find((el) =>
        /^1 YEAR$/i.test(el.innerText.trim())
      );
      const el = label?.closest("div");
      const cs = getComputedStyle(el);
      return {
        padTop: parseFloat(cs.paddingTop),
        radius: parseFloat(cs.borderTopLeftRadius),
        label: parseFloat(getComputedStyle(label).fontSize),
      };
    });
  check("the horizon cards are not oversized", card.padTop <= 14, `${card.padTop}px padding`);
  check("...with the app's own corner", card.radius <= 24, `${card.radius}px radius`);
  check("...and a quiet label", card.label <= 11, `${card.label}px`);

  const tall = await p.evaluate(() => {
    const label = [...document.querySelectorAll("p")].find((el) =>
      /^1 YEAR$/i.test(el.innerText.trim())
    );
    return label.closest("div").getBoundingClientRect().height;
  });
  check("a card with one sub-goal stays compact", tall < 130, `${Math.round(tall)}px tall`);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ----------------------------------------------------------- picking colour */
{
  const { p, errs } = await open();
  await openGoal(p);

  const swatch = p.getByRole("button", { name: "Change colour" });
  check("the colour is offered on the dot itself", (await swatch.count()) > 0);

  const before = await p.locator("span[style*='background']").first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  await swatch.click();
  await p.waitForTimeout(300);
  const options = p.getByRole("option");
  check("...opening the whole palette", (await options.count()) === 7,
    `${await options.count()} colours`);
  check("...with the current one marked",
    (await p.locator("[role=option][aria-selected=true]").count()) === 1);

  await p.getByRole("option", { name: "amber" }).click();
  await p.waitForTimeout(400);
  check("...and it closes once a colour is picked",
    (await p.getByRole("option").count()) === 0);

  const after = await swatch.locator("span").evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  check("the goal takes the new colour", after !== before, `${before} → ${after}`);
  check("...which is the amber that was picked", /255, 149, 0/.test(after), after);

  // Written down, not just painted on screen.
  const saved = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].color
  );
  check("...and it is written to the goal", saved === "amber", saved);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- pause & review, on white */
{
  const { p, errs } = await open();
  await p.getByRole("button", { name: "Reflect" }).first().click();
  await p.waitForTimeout(900);

  // Step one names the moment, step two gives the reason, step three is the
  // re-read where the marking happens — the card under test.
  await p.locator("textarea").first().fill("I missed the deadline and felt awful about it.");
  await p.getByRole("button", { name: "Continue" }).first().click();
  await p.waitForTimeout(600);
  await p.locator("textarea").first().fill("Because I underestimated how long it would take.");
  await p.getByRole("button", { name: "Continue" }).first().click();
  await p.waitForTimeout(700);

  const heading = (await p.locator("h2").first().innerText()).trim();
  check("step three is the re-read", /Pause & review/i.test(heading), heading);

  const card = p.locator(".rich-content[contenteditable]").first();
  const seen = await card.count();
  check("the review card is reached", seen > 0, `${seen} found`);
  if (seen) {
    const bg = await card.evaluate((el) => {
      let n = el;
      while (n && n !== document.body) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) return c;
        n = n.parentElement;
      }
      return "none";
    });
    const [r, g, bl] = (bg.match(/\d+/g) ?? []).map(Number);
    check("...and it is white, not a pink wash", r > 245 && g > 245 && bl > 245, bg);
    check("...with no colour cast between the channels",
      Math.max(r, g, bl) - Math.min(r, g, bl) <= 3, bg);
  }
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------- the day, turned over */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Sub-actions are editable fields, so their words are values rather than
  // text — innerText cannot see a single one of them.
  const lines = () =>
    p.locator("main input").evaluateAll((els) => els.map((e) => e.value));

  const body = await p.locator("main").innerText();
  check("yesterday's unfinished action came into today",
    (await lines()).includes("Change the review card to white"),
    (await lines()).join(" / "));
  check("...saying that it was carried", /Rolled over/i.test(body),
    body.split("\n").find((l) => /Rolled/i.test(l)) ?? "");
  check("yesterday's finished action is off the working list",
    !(await lines()).includes("Innerly logo recreation"),
    (await lines()).join(" / "));

  const kept = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].wins ?? []
  );
  check("...kept in the record of wins rather than thrown away",
    kept.some((w) => w.title === "Innerly logo recreation"),
    JSON.stringify(kept.map((w) => w.title)));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------- today's own wins fold away */
{
  const { p, errs } = await open();
  await openGoal(p);

  const lines = () =>
    p.locator("main input").evaluateAll((els) => els.map((e) => e.value));
  check("the drawer is not there while nothing has been finished today",
    (await p.getByRole("button", { name: /Completed wins/i }).count()) === 0);

  await tickFor(p, "Change the review card to white").click();
  await p.waitForTimeout(800);

  check("finishing something takes it off the working list",
    !(await lines()).includes("Change the review card to white"),
    (await lines()).join(" / "));

  const drawer = p.getByRole("button", { name: /Completed wins/i });
  check("...and folds it into the wins drawer", (await drawer.count()) > 0);
  check("...counted", /Completed wins \(1\)/i.test(await drawer.innerText()),
    await drawer.innerText());
  check("the drawer is shut until it is opened",
    !(await p.locator("main").innerText()).includes("Change the review card"));

  await drawer.click();
  await p.waitForTimeout(500);
  check("...and opens to show what was done",
    (await p.locator("main").innerText()).includes("Change the review card to white"));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------------------------- the waterfall */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Finish the last thing left in Today; This Week's action should drop in.
  await tickFor(p, "Change the review card to white").click();
  await p.waitForTimeout(900);

  // Checked against what was stored, not against the page: "Fix the wording"
  // is on screen either way, so reading the page could never tell whether it
  // had actually moved.
  const stored = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("clearing today pulls the week's action down",
    stored.today.some((s) => s.id === "w1"),
    JSON.stringify(stored.today.map((s) => s.id)));
  check("...and it really left the week", stored.thisWeek.length === 0,
    JSON.stringify(stored.thisWeek));

  const after = await p.locator("main").innerText();
  check("...marked as having come from a longer horizon",
    /From This Week/i.test(after),
    after.split("\n").find((l) => /From /i.test(l)) ?? "");

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------- moving one down by hand */
{
  const { p, errs } = await open();
  await openGoal(p);

  const move = p.getByRole("button", { name: /Move .* to Today/ });
  check("a longer-horizon action offers to come down", (await move.count()) > 0,
    `${await move.count()} offered`);
  check("...but Today itself offers nothing lower",
    (await move.count()) < (await p.locator("input[value]").count()));

  await move.first().click();
  await p.waitForTimeout(700);
  const moved = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("pressing it moves the action into today",
    moved.today.some((s) => s.id === "s1"),
    JSON.stringify(moved.today.map((s) => s.id)));
  check("...and out of where it was", !moved.year.some((s) => s.id === "s1"));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ---------------------------------------------------- steps under a sub-goal */
{
  const { p, errs } = await open();
  await openGoal(p);

  const row = p.locator("li").filter({ has: p.locator('input[value="Fix the wording in the UI"]') });
  await row.hover();
  await p.waitForTimeout(300);

  const add = row.getByRole("button", { name: /Add step/ });
  check("a sub-goal offers to be broken into steps", (await add.count()) > 0);

  await add.click();
  await p.waitForTimeout(400);
  await row.locator('input[placeholder="A smaller piece of it…"]').first()
    .fill("Change the home page wording");
  await add.click();
  await p.waitForTimeout(400);
  await row.locator('input[placeholder="A smaller piece of it…"]').last()
    .fill("Change the daily plan wording");
  await p.waitForTimeout(500);

  check("the heading counts its steps", /0\/2/.test(await row.innerText()),
    (await row.innerText()).replace(/\n/g, " ").slice(0, 70));

  const ticks = row.getByRole("button", { name: "Mark step complete" });
  await ticks.first().click();
  await p.waitForTimeout(500);
  check("one of two leaves the heading open",
    /1\/2/.test(await row.innerText()) &&
      (await p.evaluate(() =>
        JSON.parse(localStorage.getItem("innerly:goals"))[0]
          .horizons.thisWeek.find((s) => s.id === "w1").done)) === false,
    (await row.innerText()).replace(/\n/g, " ").slice(0, 70));

  await row.getByRole("button", { name: "Mark step complete" }).first().click();
  await p.waitForTimeout(700);

  const stored = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  const parent =
    stored.thisWeek.find((s) => s.id === "w1") ?? stored.today.find((s) => s.id === "w1");
  check("finishing every step ticks the heading itself", parent.done === true,
    JSON.stringify(parent && { done: parent.done, steps: parent.steps?.length }));
  check("...and the steps travel with it wherever it goes",
    (parent.steps ?? []).length === 2,
    JSON.stringify((parent.steps ?? []).map((t) => t.title)));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
