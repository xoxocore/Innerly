// A goal, opened.
//
// The page has to read at the density the rest of the app writes at — it was
// built at poster size, twice everything else, and nothing about a list of
// sub-goals earns that — and the colour has to be the user's to change.
//
// The rest of this file is about who decides what happens today. The answer is
// the person, every time: the ladder is theirs to build downwards, and the day
// is theirs to fill by hand, three things at most, one of them the one that
// matters. A page that quietly filled the day for them would pass a great many
// tests, so several of these check that a thing did *not* happen.
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

/**
 * One row's own controls, by the id of the line it draws.
 *
 * Its own, and not its children's: a row contains the rows beneath it, so a
 * lookup scoped to the whole row finds their buttons too — a strict-mode
 * violation at best and the wrong button at worst.
 */
const ctl = (p, id) => p.locator(`[data-row="${id}"] > div`).first();

/** The tick beside one named line, wherever in the thread it sits. */
const tickFor = (p, id) => ctl(p, id).getByRole("button", { name: "Mark complete" });

/** The goal as it is actually stored, which is the only honest witness. */
const stored = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons);

/** Every line in a goal, flattened, so a test can find one at any depth. */
const flat = async (p) =>
  Object.entries(await stored(p)).flatMap(([tier, list]) => {
    const out = [];
    const walk = (l, home) => l.forEach((s) => {
      out.push({ ...s, home });
      if (s.steps) walk(s.steps, home);
    });
    walk(list, tier);
    return out;
  });

const line = async (p, id) => (await flat(p)).find((s) => s.id === id);

/**
 * Choose something from one row's overflow menu.
 *
 * Most of what a row can do lives behind that mark now — seven controls on
 * every line of a six-tier plan is most of why the page read as loud — so a
 * test that wants any of them has to open it the way a person would.
 */
const menu = async (p, id, item) => {
  await ctl(p, id).getByRole("button", { name: /^More for / }).click();
  await p.waitForTimeout(250);
  await p.getByRole("menuitem", { name: item }).click();
};

/**
 * The titles shown in one tier.
 *
 * Titles are editable fields, so their words are values rather than text —
 * innerText cannot see a single one of them, and an assertion that reads the
 * card's text will quietly pass or fail for the wrong reason.
 */
const titlesIn = (p, tier) =>
  p.locator(`[data-tier=${tier}] input`).evaluateAll((els) => els.map((e) => e.value));

/** The button that adds an action to one named line. */
const addTo = (p, title) =>
  p.getByRole("button", { name: `Add an action to "${title}"` });

const GOAL = {
  id: "goal-under-test",
  title: "Get Innerly Live",
  color: "blue",
  createdAt: new Date().toISOString(),
  order: 0,
  // Yesterday, so the day turn has a night to carry things across.
  lastReset: "2020-01-01",
  horizons: {
    year: [{ id: "y1", title: "Get 100,000 active users to Innerly", done: false,
      steps: [{ id: "y1a", title: "Write the launch post", done: false }] }],
    sixMonths: [{ id: "s2", title: "Get 20,000 active users to Innerly", done: false }],
    threeMonths: [],
    oneMonth: [
      { id: "m1", title: "Finalise user Interface", done: false, steps: [
        { id: "a1", title: "Notifications and stickers", done: false },
        { id: "a2", title: "Final features", done: false },
      ] },
    ],
    thisWeek: [{ id: "w1", title: "Fix the wording in the UI", done: false }],
    today: [
      { id: "t1", title: "Change the review card to white", done: false },
      { id: "t2", title: "Innerly logo recreation", done: true,
        completedAt: "2020-01-01T10:15:00.000Z" },
    ],
  },
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open(goal = GOAL, opts = {}) {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 950 },
    deviceScaleFactor: 2,
    reducedMotion: opts.reducedMotion ? "reduce" : undefined,
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
  }, goal);
  if (opts.night) {
    await p.addInitScript(() => localStorage.setItem("innerly:night", "true"));
  }

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

  const label = await p
    .locator("[data-tier=year] span")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("...and a quiet tier label", label <= 11, `${label}px`);

  // Depth is carried by weight rather than by more chrome, so a target has to
  // read as a heading and its actions as parts of it. Same size for both was
  // most of why the thread read as a wall of identical sentences.
  const targetSize = await p
    .locator(`[data-row=y1] input`)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const actionSize = await p
    .locator(`[data-row=y1a] input`)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("a target outranks its actions", targetSize > actionSize,
    `${targetSize}px vs ${actionSize}px`);

  // One soft field per target, grouping it with its actions — and nothing
  // drawn around the tier itself, which used to be a third nested container.
  const row = await p.locator("[data-row=y1]").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius) };
  });
  check("a target sits on a field of its own", !/rgba\(0, 0, 0, 0\)/.test(row.bg), row.bg);
  check("...with the app's own corner", row.radius <= 28, `${row.radius}px`);

  const tier = await p.locator("[data-tier=year]").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, border: cs.borderTopWidth };
  });
  check("...and the tier around it draws nothing",
    /rgba\(0, 0, 0, 0\)/.test(tier.bg) && parseFloat(tier.border) === 0,
    `${tier.bg} / ${tier.border}`);

  // Distance is colour: the far end of the ladder is paler than the near end.
  const alpha = (bg) => {
    const m = bg.match(/[\d.]+/g) ?? [];
    return m.length === 4 ? parseFloat(m[3]) : 1;
  };
  const far = await p.locator("[data-row=y1]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const near = await p.locator("[data-row=m1]")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  check("a year away is paler than this month", alpha(far) < alpha(near),
    `${far} vs ${near}`);

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

  const lines = () =>
    p.locator("main input").evaluateAll((els) => els.map((e) => e.value));

  const body = await p.locator("main").innerText();
  check("yesterday's unfinished action came into today",
    (await lines()).includes("Change the review card to white"),
    (await lines()).join(" / "));
  check("...saying that it was carried", /Rolled over/i.test(body));
  check("yesterday's finished action is off the working list",
    !(await lines()).includes("Innerly logo recreation"));

  const kept = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].wins ?? []
  );
  check("...kept in the record of wins rather than thrown away",
    kept.some((w) => w.title === "Innerly logo recreation"),
    JSON.stringify(kept.map((w) => w.title)));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------- today's own wins fold away */
{
  const { p, errs } = await open();
  await openGoal(p);

  const lines = () =>
    p.locator("main input").evaluateAll((els) => els.map((e) => e.value));
  check("the drawer is not there while nothing has been finished today",
    (await p.getByRole("button", { name: /Completed wins/i }).count()) === 0);

  await tickFor(p, "t1").click();
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

/* -------------------------------------------- the day does not fill itself */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Under the old engine the week's action dropped in by itself when the day
  // cleared. The whole point of the rebuild is that it does not.
  await tickFor(p, "t1").click();
  await p.waitForTimeout(900);

  const h = await stored(p);
  check("clearing today leaves today empty",
    h.today.filter((s) => !s.done).length === 0,
    JSON.stringify(h.today.filter((s) => !s.done).map((s) => s.title)));
  check("...and the week's work stays in the week", h.thisWeek.some((s) => s.id === "w1"));
  check("...and the year's stays a year away", h.year.some((s) => s.id === "y1"));

  const after = await p.locator("main").innerText();
  check("an empty day asks the question instead of answering it",
    /which one thing today makes the rest easier/i.test(after));
  check("...and the count says the day is empty", /0\/3/.test(after));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- one rung, never a leap */
{
  const { p, errs } = await open();
  await openGoal(p);

  // The rule the whole page is built on: the arrow on a line offers the tier
  // immediately below it and no other. A year's target cannot reach today.
  const arrow = (id) => ctl(p, id).getByRole("button", { name: /^Push /});

  check("a year's target offers six months",
    /6 Months/.test(await arrow("y1").innerText()),
    await arrow("y1").innerText());
  check("a six-month target offers three months",
    /3 Months/.test(await arrow("s2").innerText()),
    await arrow("s2").innerText());
  check("a month's target offers the week",
    /Weekly Goal/.test(await arrow("m1").innerText()),
    await arrow("m1").innerText());
  check("a week's target offers today",
    /Today/.test(await arrow("w1").innerText()),
    await arrow("w1").innerText());
  check("and nothing on today offers anything lower",
    (await ctl(p, "t1").getByRole("button", { name: /^Push / }).count()) === 0);

  check("no target anywhere offers to jump straight to today",
    (await p.getByRole("button", { name: /Push .* to Today/ }).count()) === 1,
    `${await p.getByRole("button", { name: /Push .* to Today/ }).count()} offered`);

  // Press it, and it goes exactly one rung.
  await arrow("y1").click();
  await p.waitForTimeout(800);
  check("pressing it moves the line one rung",
    (await line(p, "y1")).at === "sixMonths", String((await line(p, "y1")).at));
  check("...and it is drawn in that tier",
    (await titlesIn(p, "sixMonths")).includes("Get 100,000 active users to Innerly"),
    JSON.stringify(await titlesIn(p, "sixMonths")));
  check("...and today is no closer to holding it",
    !(await titlesIn(p, "today")).some((t) => /100,000/.test(t)),
    JSON.stringify(await titlesIn(p, "today")));

  await ctl(p, "y1").getByRole("button", { name: /^Push / }).click();
  await p.waitForTimeout(800);
  check("pressing again moves it one more rung",
    (await line(p, "y1")).at === "threeMonths", String((await line(p, "y1")).at));

  await menu(p, "y1", /Send back a tier/);
  await p.waitForTimeout(800);
  check("sending it back moves it back one rung, not all the way",
    (await line(p, "y1")).at === "sixMonths", String((await line(p, "y1")).at));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------- an action pushed down, with its target's name on it */
{
  const { p, errs } = await open();
  await openGoal(p);

  const month = p.locator("[data-tier=oneMonth]");
  check("the target counts its actions", /0\/2/.test(await ctl(p, "m1").innerText()),
    (await ctl(p, "m1").innerText()).replace(/\n/g, " ").slice(0, 60));

  const push = ctl(p, "a1").getByRole("button", { name: /Push .* to Weekly Goal/ });
  check("an action of a month's target offers the week", (await push.count()) === 1);
  await push.click();
  await p.waitForTimeout(800);

  const h = await stored(p);
  check("the target stays in the month",
    h.oneMonth.length === 1 && h.oneMonth[0].id === "m1");
  check("...and nothing was copied into the week",
    h.thisWeek.every((s) => s.id !== "m1" && s.id !== "a1"),
    JSON.stringify(h.thisWeek.map((s) => s.title)));
  check("the action is scheduled onto the week",
    h.oneMonth[0].steps[0].at === "thisWeek",
    JSON.stringify(h.oneMonth[0].steps.map((t) => t.at ?? "—")));
  check("...and its sibling stayed behind", !h.oneMonth[0].steps[1].at);

  check("the week shows the action",
    (await titlesIn(p, "thisWeek")).includes("Notifications and stickers"),
    JSON.stringify(await titlesIn(p, "thisWeek")));
  // The tag is text rather than a field, and uppercased by the stylesheet.
  check("...tagged with the target it serves",
    /FINALISE USER INTERFACE/i.test(await p.locator("[data-tier=thisWeek]").innerText()),
    (await p.locator("[data-tier=thisWeek]").innerText()).replace(/\n/g, " ").slice(0, 160));
  check("...and the month says where it went",
    /On Weekly Goal/i.test(await month.innerText()),
    (await month.innerText()).replace(/\n/g, " ").slice(0, 120));

  // Ticking it in the week is ticking it in the target: one object, one count.
  await ctl(p, "a1").getByRole("button", { name: "Mark complete" }).click();
  await p.waitForTimeout(800);
  check("ticking it in the week moves the target's own count",
    /1\/2/.test(await ctl(p, "m1").innerText()),
    (await ctl(p, "m1").innerText()).replace(/\n/g, " ").slice(0, 60));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ----------------- a pushed action becomes a target where it lands */
{
  const { p, errs } = await open({
    ...GOAL,
    horizons: {
      ...GOAL.horizons,
      year: [{ id: "y1", title: "Finale user Interface", done: false, steps: [
        { id: "t1a", title: "test 1", done: false, at: "sixMonths" },
        { id: "t2a", title: "test 2", done: false },
      ] }],
      sixMonths: [],
    },
  });
  await openGoal(p);

  const six = p.locator("[data-tier=sixMonths]");
  check("the pushed action is shown at six months",
    (await titlesIn(p, "sixMonths")).includes("test 1"),
    JSON.stringify(await titlesIn(p, "sixMonths")));
  check("...tagged with the year's target it came from",
    /FINALE USER INTERFACE/i.test(await six.innerText()));

  // The request: it can be broken down where it landed.
  const add = addTo(p, "test 1");
  check("it offers to be broken into actions of its own", (await add.count()) === 1);
  await add.click();
  await p.waitForTimeout(500);
  await six.locator('input[placeholder="An action that gets you there…"]').first()
    .fill("Wire the settings screen");
  await p.waitForTimeout(600);

  const child = await line(p, "t1a");
  check("the new action is written inside it, not beside it",
    (child.steps ?? []).length === 1,
    JSON.stringify((child.steps ?? []).map((s) => s.title)));
  check("...and it now counts its own parts",
    /0\/1/.test(await ctl(p, "t1a").innerText()),
    (await ctl(p, "t1a").innerText()).replace(/\n/g, " ").slice(0, 70));

  // And that grandchild can itself be pushed one rung on.
  const grand = (await line(p, "t1a")).steps[0].id;
  await ctl(p, grand).getByRole("button", { name: /Push .* to 3 Months/ }).click();
  await p.waitForTimeout(800);
  check("a grandchild can be pushed on to three months",
    (await titlesIn(p, "threeMonths")).includes("Wire the settings screen"),
    JSON.stringify(await titlesIn(p, "threeMonths")));
  check("...tagged with the six-month line it belongs to",
    /TEST 1/i.test(await p.locator("[data-tier=threeMonths]").innerText()));

  // Finishing it settles the whole chain back up to the year.
  await ctl(p, grand).getByRole("button", { name: "Mark complete" }).click();
  await p.waitForTimeout(900);
  check("finishing the grandchild finishes its heading",
    (await line(p, "t1a")).done === true);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------- the week is not written into directly */
{
  const { p, errs } = await open();
  await openGoal(p);

  check("the week offers no way to write a target into it",
    (await p.locator("[data-tier=thisWeek]")
      .getByRole("button", { name: /Add target/ }).count()) === 0);
  check("...but the month does",
    (await p.locator("[data-tier=oneMonth]")
      .getByRole("button", { name: /Add target/ }).count()) === 1);
  check("...and today still takes an action typed straight in",
    (await p.locator("[data-tier=today]")
      .getByRole("button", { name: /Add action/ }).count()) === 1);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------- dragging a row onto the next rung */
{
  const { p, errs } = await open();
  await openGoal(p);

  // The same move the arrow makes, as the gesture a hand reaches for first —
  // and only ever onto the next rung.
  const grip = ctl(p, "m1").getByRole("button", { name: /Drag to reorder/ });
  const from = await grip.boundingBox();
  const onto = await p.locator("[data-tier=thisWeek]").boundingBox();

  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await p.mouse.move(
      from.x + from.width / 2,
      from.y + ((onto.y + onto.height / 2 - from.y) * i) / 12,
      { steps: 2 }
    );
    await p.waitForTimeout(30);
  }
  await p.waitForTimeout(150);
  await p.mouse.up();
  await p.waitForTimeout(900);

  check("a row dragged onto the next rung lands there",
    (await line(p, "m1")).at === "thisWeek", String((await line(p, "m1")).at));
  check("...and its actions came with it",
    (await titlesIn(p, "thisWeek")).includes("Notifications and stickers"),
    JSON.stringify(await titlesIn(p, "thisWeek")));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------ a drag that stays put only sorts */
{
  const { p, errs } = await open();
  await openGoal(p);

  const grip = ctl(p, "s2").getByRole("button", { name: /Drag to reorder/ });
  const from = await grip.boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  await p.mouse.move(from.x + from.width / 2, from.y + 18, { steps: 6 });
  await p.waitForTimeout(120);
  await p.mouse.up();
  await p.waitForTimeout(800);

  check("a short drag does not fling anything down a tier",
    (await line(p, "s2")).at === undefined, String((await line(p, "s2")).at));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- three is a full day (Rule B) */
{
  const { p, errs } = await open();
  await openGoal(p);

  const count = () => p.locator("[data-tier=today]").innerText();
  check("the day starts holding the one thing carried over",
    /1\/3/.test(await count()), (await count()).split("\n")[1] ?? "");

  const toToday = () => p.getByRole("button", { name: /Push .* to Today/ });
  await toToday().first().click();
  await p.waitForTimeout(700);
  check("...two", /2\/3/.test(await count()), (await count()).split("\n")[1] ?? "");

  // Bring another line down to the week so there is a third thing to pick.
  await ctl(p, "m1").getByRole("button", { name: /Push .* to Weekly Goal/ }).click();
  await p.waitForTimeout(700);
  await ctl(p, "m1").getByRole("button", { name: /Push .* to Today/ }).click();
  await p.waitForTimeout(700);
  check("...three", /3\/3/.test(await count()), (await count()).split("\n")[1] ?? "");

  const before = (await stored(p)).today.length;
  check("a fourth is not offered at all",
    (await p.getByRole("button", { name: /Push .* to Today/ }).count()) === 0);
  check("...and adding a fresh action is closed off too",
    await p.locator("[data-tier=today]")
      .getByRole("button", { name: /Add action/ }).isDisabled());
  check("...explaining itself in words",
    /Finish one, or put one back/i.test(await count()));
  check("...and nothing was written",
    (await stored(p)).today.length === before);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------ one thing that matters (Rule A) */
{
  const { p, errs } = await open();
  await openGoal(p);

  await p.getByRole("button", { name: /Push .* to Today/ }).first().click();
  await p.waitForTimeout(700);

  const flags = p.locator("[data-tier=today]")
    .getByRole("button", { name: /main thing today/ });
  check("today's lines each offer the flag", (await flags.count()) === 2,
    `${await flags.count()} offered`);
  check("...and nothing outside today does",
    (await p.locator("[data-tier=oneMonth]")
      .getByRole("button", { name: /main thing today/ }).count()) === 0);

  await flags.first().click();
  await p.waitForTimeout(700);
  check("naming the day's one thing writes it down",
    (await flat(p)).filter((s) => s.primary).length === 1,
    JSON.stringify((await flat(p)).filter((s) => s.primary).map((s) => s.title)));

  await p.locator("[data-tier=today]")
    .getByRole("button", { name: /main thing today/ }).nth(1).click();
  await p.waitForTimeout(700);
  const two = (await flat(p)).filter((s) => s.primary);
  check("naming a second moves the flag rather than adding one", two.length === 1,
    JSON.stringify(two.map((s) => s.title)));

  await p.getByRole("button", { name: /Not the main thing today/ }).click();
  await p.waitForTimeout(700);
  check("...and a day is allowed not to have one",
    (await flat(p)).every((s) => !s.primary));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------- a line you can honestly tick (Rule C) */
{
  const { p, errs } = await open();
  await openGoal(p);

  // The value attribute follows what is typed, so the locator that found the
  // field cannot be used again once it has been filled — Tab does the blur.
  await p.locator('input[value="Change the review card to white"]').first()
    .fill("Work on the UI");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(600);
  check("an activity gets a word of advice",
    /Name what will exist/i.test(await p.locator("main").innerText()));

  // Advice only — it never stands between somebody and their own plan.
  check("...but the words are still theirs to keep",
    (await stored(p)).today.some((s) => s.title === "Work on the UI"));

  await p.locator('input[value="Work on the UI"]').first()
    .fill("Wrap long task sentences in the daily plan");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(600);
  check("a real deliverable is left in peace",
    !/Name what will exist/i.test(await p.locator("main").innerText()));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ---------------------------- each tier asks what the one above it needs */
{
  const { p, errs } = await open();
  await openGoal(p);

  await p.locator("[data-tier=threeMonths]")
    .getByRole("button", { name: /Add target/ }).click();
  await p.waitForTimeout(500);
  const ask = await p.locator("[data-tier=threeMonths] input[value='']")
    .first().getAttribute("placeholder");
  check("an empty rung asks how it follows from the one above",
    /in 3 months, for that to happen/i.test(ask ?? ""), ask ?? "");

  await p.locator("[data-tier=today]")
    .getByRole("button", { name: /Add action/ }).click();
  await p.waitForTimeout(500);
  const todayAsk = await p.locator("[data-tier=today] input[value='']")
    .first().getAttribute("placeholder");
  check("...and today asks for something finishable",
    /finishable/i.test(todayAsk ?? ""), todayAsk ?? "");

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------- breaking a target down, and settling */
{
  const { p, errs } = await open();
  await openGoal(p);

  const add = addTo(p, "Fix the wording in the UI");
  check("a target offers to be broken into actions", (await add.count()) === 1);
  check("...without having to hover for it", await add.isVisible());

  await add.click();
  await p.waitForTimeout(400);
  await p.locator('[data-tier=thisWeek] input[placeholder="An action that gets you there…"]')
    .first().fill("Change the home page wording");
  await p.waitForTimeout(400);
  await add.click();
  await p.waitForTimeout(400);
  await p.locator('[data-tier=thisWeek] input[placeholder="An action that gets you there…"]')
    .first().fill("Change the daily plan wording");
  await p.waitForTimeout(600);

  check("the heading counts its actions", /0\/2/.test(await ctl(p, "w1").innerText()),
    (await ctl(p, "w1").innerText()).replace(/\n/g, " ").slice(0, 70));

  const parts = (await line(p, "w1")).steps;
  await ctl(p, parts[0].id).getByRole("button", { name: "Mark complete" }).click();
  await p.waitForTimeout(600);
  check("one of two leaves the heading open",
    /1\/2/.test(await ctl(p, "w1").innerText()) &&
      (await line(p, "w1")).done === false,
    (await ctl(p, "w1").innerText()).replace(/\n/g, " ").slice(0, 70));

  await ctl(p, parts[1].id).getByRole("button", { name: "Mark complete" }).click();
  await p.waitForTimeout(800);
  check("finishing every action ticks the heading itself",
    (await line(p, "w1")).done === true);
  check("...and the actions stay under it", (await line(p, "w1")).steps.length === 2);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------- today holds doing, not planning */
{
  const { p, errs } = await open();
  await openGoal(p);

  check("a line on today is not offered further breaking down",
    (await addTo(p, "Change the review card to white").count()) === 0);
  check("...though the tier itself still takes a fresh action",
    (await p.locator("[data-tier=today]")
      .getByRole("button", { name: /Add action/ }).count()) === 1);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------- the emoji, and where it sticks */
{
  const { p, errs } = await open();
  await openGoal(p);

  // A target's mark is its emoji, because a line with parts cannot be ticked —
  // its ring is read, not pressed. So the mark opens the grid.
  await ctl(p, "m1").getByRole("button", { name: /Choose an emoji/ }).click();
  await p.waitForTimeout(400);
  const grid = p.getByRole("button", { name: "Nature" });
  check("a target's mark opens the emoji grid", (await grid.count()) === 1);

  await grid.click();
  await p.waitForTimeout(300);
  // The grid itself, not "some button near the tabs" — the tab strip is also
  // buttons, and picking one of those would have set nothing and said nothing.
  const cell = p.locator("div[class*='grid-cols-8'] button").first();
  const glyph = (await cell.innerText()).trim();
  await cell.click();
  await p.waitForTimeout(700);

  check("picking one writes it to the line",
    !!(await line(p, "m1")).icon, JSON.stringify((await line(p, "m1")).icon));
  check("...the one that was picked",
    (await line(p, "m1")).icon === glyph,
    `${(await line(p, "m1")).icon} vs ${glyph}`);
  check("...and the grid closes behind it",
    (await p.getByRole("button", { name: "Nature" }).count()) === 0);
  check("...and it shows on the row",
    (await ctl(p, "m1").innerText()).includes(glyph),
    (await ctl(p, "m1").innerText()).replace(/\n/g, " ").slice(0, 40));

  // A line with no parts keeps its tick, so its emoji comes off the menu.
  await menu(p, "t1", /Choose an emoji/);
  await p.waitForTimeout(400);
  check("a line with a tick can still be given one",
    (await p.getByRole("button", { name: "Nature" }).count()) === 1);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);

  check("...and its tick is still a tick",
    (await ctl(p, "t1").getByRole("button", { name: "Mark complete" }).count()) === 1);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- what the row still says */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Three things out loud and no more: the mark, the words, the one move.
  const buttons = await ctl(p, "m1").getByRole("button").evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "")
  );
  check("a row shows three controls, not seven", buttons.length <= 4,
    JSON.stringify(buttons));

  // The rest are one press away, in a mark that never moves or resizes.
  await ctl(p, "m1").getByRole("button", { name: /^More for / }).click();
  await p.waitForTimeout(300);
  const items = await p.getByRole("menuitem").evaluateAll((els) =>
    els.map((e) => e.textContent?.trim())
  );
  check("...and the others are on the menu",
    items.some((t) => /emoji/i.test(t)) &&
      items.some((t) => /Add an action/i.test(t)) &&
      items.some((t) => /Delete/i.test(t)),
    JSON.stringify(items));

  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);

  // Deleting from the menu really deletes.
  await menu(p, "a2", /Delete/);
  await p.waitForTimeout(700);
  check("delete on the menu removes the line",
    (await line(p, "a2")) === undefined);
  check("...and only that line",
    !!(await line(p, "a1")) && !!(await line(p, "m1")));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ----------------------------------------- a tier can be folded out of the way */
{
  const { p, errs } = await open();
  await openGoal(p);

  const yearRows = () => p.locator("[data-tier=year] [data-row]").count();
  check("the year starts open", (await yearRows()) > 0);

  await p.getByRole("button", { name: /Hide 1 Year/ }).click();
  await p.waitForTimeout(500);
  check("folding a tier puts its plan away", (await yearRows()) === 0);
  check("...but the tier is still there to open",
    (await p.getByRole("button", { name: /Show 1 Year/ }).count()) === 1);

  await p.getByRole("button", { name: /Show 1 Year/ }).click();
  await p.waitForTimeout(500);
  check("...and it comes back unchanged", (await yearRows()) > 0);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------------- Jelly asks the day's question */
{
  const { p, errs } = await open({
    ...GOAL,
    horizons: { ...GOAL.horizons, today: [] },
  });
  await openGoal(p);

  const today = p.locator("[data-tier=today]");
  check("an empty day asks rather than answers",
    /which one thing today makes the rest easier/i.test(await today.innerText()));
  check("...and Jelly asks it, with her checklist",
    (await today.locator('[data-jelly=body]').count()) === 1);
  check("...and a pencil in a layer of its own",
    (await today.locator('[data-jelly=pencil]').count()) === 1);

  // The layers have to sit exactly on top of each other, or the pencil is back
  // where it was drawn but an inch to the left of where it was drawn.
  //
  // Measured as layout, not as a painted rectangle: the pencil is mid-swing
  // while this runs, and a rotated element's bounding box is bigger than the
  // element. The offset box ignores the transform, which is the question here.
  const boxes = await today.locator("[data-jelly]").evaluateAll((els) =>
    els
      .filter((e) => e.tagName === "IMG")
      .map((e) => [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight])
  );
  check("...laid one exactly over the other",
    boxes.length === 2 && JSON.stringify(boxes[0]) === JSON.stringify(boxes[1]),
    JSON.stringify(boxes));

  /* A drawing that never moves and a drawing whose animation snaps straight to
     its last frame look identical in a screenshot, and an assertion that the
     element exists passes for both. So the pencil is sampled frame by frame. */
  const frames = await today.locator("[data-jelly=pencil]").evaluate(
    (el) =>
      new Promise((done) => {
        const seen = [];
        let n = 0;
        const tick = () => {
          seen.push(getComputedStyle(el).transform);
          if (++n < 120) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      })
  );
  const distinct = new Set(frames);
  check("the pencil actually moves, frame to frame", distinct.size > 8,
    `${distinct.size} distinct transforms over ${frames.length} frames`);
  check("...turning, not just sliding",
    [...distinct].some((t) => /matrix\((-?[\d.]+), (-?[\d.]+)/.test(t) &&
      Math.abs(parseFloat(RegExp.$2)) > 0.02),
    [...distinct].slice(0, 3).join(" | "));
  check("...and coming back to rest",
    frames.includes("none") || frames.some((t) => /matrix\(1, 0, 0, 1/.test(t)),
    frames[0]);

  // She blinks here the way she blinks everywhere else.
  const lids = await today.locator("[data-jelly=lid]").count();
  check("...and she has two eyelids to blink with", lids === 2, `${lids}`);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------- and holds still if asked to */
{
  const { p, errs } = await open(
    { ...GOAL, horizons: { ...GOAL.horizons, today: [] } },
    { reducedMotion: true }
  );
  await openGoal(p);

  const frames = await p.locator("[data-jelly=pencil]").evaluate(
    (el) =>
      new Promise((done) => {
        const seen = [];
        let n = 0;
        const tick = () => {
          seen.push(getComputedStyle(el).transform);
          if (++n < 60) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      })
  );
  check("no writing for anyone who asked for less movement",
    new Set(frames).size === 1, [...new Set(frames)].join(" | "));
  check("...but Jelly is still there", (await p.locator("[data-jelly=body]").count()) === 1);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------ and again with the lights off */
{
  // Night is a class on <html>, not Tailwind's dark: variant, so every colour
  // that is set from JavaScript has to be checked here or it silently keeps
  // its light-mode value. The ink shade is built for a pale tint and vanishes
  // on a dark one — this is the check that would have caught that.
  const { p, errs } = await open(GOAL, { night: true });
  await openGoal(p);

  const lum = (c) => {
    const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };

  const page = await p.locator("body").evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  check("night mode really is dark", lum(page) < 0.3, page);

  const chip = await p
    .locator("[data-row=m1] button", { hasText: "Weekly Goal" })
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check("the push chip stays readable on a dark field", lum(chip) > 0.35, chip);

  const label = await p
    .locator("[data-tier=oneMonth] span")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check("...and so does the tier label", lum(label) > 0.3, label);

  // The count span specifically, not a wrapper that happens to contain it —
  // the wrapper inherits the page's ordinary text colour and would pass here
  // while the number itself was unreadable.
  const count = await p
    .locator("[data-row=m1] > div span[class*=tabular-nums]")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  check("...and the count beside a target", lum(count) > 0.3, count);

  // The goal under test is blue: #007AFF is the shade meant for dark grounds,
  // #0060DF the one meant for pale ones. Naming them is sharper than a
  // luminance threshold, which an alpha-blended colour can slip past.
  check("...using the shade built for a dark ground, not the pale-ground one",
    [chip, label, count].every((c) => !/0, 96, 223/.test(c)),
    JSON.stringify([chip, label, count]));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- the tier is now Weekly Goal */
{
  const { p, errs } = await open();
  await openGoal(p);
  const body = await p.locator("main").innerText();
  check("the week is called what it is", /Weekly Goal/i.test(body));
  check("...and no longer This Week", !/THIS WEEK/i.test(body));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
