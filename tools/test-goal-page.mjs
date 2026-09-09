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

  const card = await p.locator("[data-tier=year]").evaluate((el) => {
    const cs = getComputedStyle(el);
    const label = el.querySelector("p");
    return {
      padTop: parseFloat(cs.paddingTop),
      radius: parseFloat(cs.borderTopLeftRadius),
      label: parseFloat(getComputedStyle(label).fontSize),
    };
  });
  check("the horizon cards are not oversized", card.padTop <= 14, `${card.padTop}px padding`);
  check("...with the app's own corner", card.radius <= 24, `${card.radius}px radius`);
  check("...and a quiet label", card.label <= 11, `${card.label}px`);

  const tall = await p.locator("[data-tier=year]").evaluate(
    (el) => el.getBoundingClientRect().height
  );
  check("a card with one sub-goal stays compact", tall < 150, `${Math.round(tall)}px tall`);

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

/* -------------------------------------------- the day does not fill itself */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Finish the last thing left in Today. Under the old engine This Week's
  // action dropped in by itself; the whole point of the rebuild is that it
  // does not, because choosing is the part a person is supposed to do.
  await tickFor(p, "Change the review card to white").click();
  await p.waitForTimeout(900);

  // Checked against what was stored, not against the page: "Fix the wording"
  // is on screen either way, so reading the page could never tell whether it
  // had actually moved.
  const stored = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("clearing today leaves today empty",
    stored.today.filter((s) => !s.done).length === 0,
    JSON.stringify(stored.today.filter((s) => !s.done).map((s) => s.title)));
  check("...and the week's work stays in the week",
    stored.thisWeek.some((s) => s.id === "w1"),
    JSON.stringify(stored.thisWeek.map((s) => s.id)));
  check("...and the year's stays a year away",
    stored.year.some((s) => s.id === "s1"));

  const after = await p.locator("main").innerText();
  check("an empty day asks the question instead of answering it",
    /which one thing today makes the rest easier/i.test(after),
    after.split("\n").find((l) => /one thing/i.test(l)) ?? "");
  check("...and the count says the day is empty", /0 \/ 3/.test(after),
    after.split("\n").find((l) => /\/ 3/.test(l)) ?? "");

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------------- taking one down by hand */
{
  const { p, errs } = await open();
  await openGoal(p);

  const take = p.getByRole("button", { name: /Take .* into today/ });
  check("a longer-horizon action offers to come down", (await take.count()) > 0,
    `${await take.count()} offered`);
  check("...but Today itself offers nothing lower",
    (await take.count()) < (await p.locator("input[value]").count()));

  await take.first().click();
  await p.waitForTimeout(700);
  const moved = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("pressing it takes the action into today",
    moved.today.some((s) => s.id === "s1"),
    JSON.stringify(moved.today.map((s) => s.id)));
  check("...and out of where it was", !moved.year.some((s) => s.id === "s1"));
  check("...tagged with the tier it was drawn from",
    moved.today.find((s) => s.id === "s1").promotedFrom === "year");

  const body = await p.locator("main").innerText();
  check("...and the tag is on screen, next to the doing", /1 YEAR/i.test(body));

  // And back again: a choice you cannot reverse is not a choice.
  await p.getByRole("button", { name: /Put .* back/ }).first().click();
  await p.waitForTimeout(700);
  const back = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("it can be put back where it came from",
    back.year.some((s) => s.id === "s1") && !back.today.some((s) => s.id === "s1"),
    JSON.stringify({ year: back.year.length, today: back.today.length }));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------- dragging one down onto Today */
{
  const { p, errs } = await open();
  await openGoal(p);

  // The other way to pick, and the one a hand reaches for first: take hold of
  // the row and put it on the day. Driven as a real pointer, because a drag
  // that only works when a test calls the handler directly is not a drag.
  const row = p.locator("li").filter({
    has: p.locator('input[value="Fix the wording in the UI"]'),
  });
  const grip = row.getByRole("button", { name: /Drag to reorder/ });
  const from = await grip.boundingBox();
  const onto = await p.locator("[data-tier=today]").boundingBox();

  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  // In steps, so framer sees a gesture rather than a teleport.
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

  const stored = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("a row dragged onto Today lands there",
    stored.today.some((s) => s.id === "w1"),
    JSON.stringify(stored.today.map((s) => s.title)));
  check("...and left the week", !stored.thisWeek.some((s) => s.id === "w1"),
    JSON.stringify(stored.thisWeek.map((s) => s.title)));
  check("...tagged with where it came from",
    stored.today.find((s) => s.id === "w1")?.promotedFrom === "thisWeek");

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------ a drag that stays in its own tier only sorts */
{
  const { p, errs } = await open();
  await openGoal(p);

  const before = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons.today.length
  );
  const row = p.locator("li").filter({
    has: p.locator('input[value="Get 20,000 active users to Innerly"]'),
  });
  const grip = row.getByRole("button", { name: /Drag to reorder/ });
  const from = await grip.boundingBox();

  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  await p.mouse.move(from.x + from.width / 2, from.y + 18, { steps: 6 });
  await p.waitForTimeout(120);
  await p.mouse.up();
  await p.waitForTimeout(800);

  const after = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("a short drag does not fling anything into today",
    after.today.length === before, `${before} → ${after.today.length}`);
  check("...and the row stays where it was written",
    after.sixMonths.some((s) => s.id === "s2"));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- three is a full day (Rule B) */
{
  const { p, errs } = await open();
  await openGoal(p);

  const count = () => p.locator("[data-tier=today]").innerText();
  check("the day starts holding the one thing carried over",
    /1 \/ 3/.test(await count()), (await count()).split("\n")[1] ?? "");

  const take = () => p.getByRole("button", { name: /Take .* into today/ });
  await take().first().click();
  await p.waitForTimeout(600);
  check("...two", /2 \/ 3/.test(await count()));
  await take().first().click();
  await p.waitForTimeout(600);
  check("...three", /3 \/ 3/.test(await count()));

  const stored = () => p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  const before = (await stored()).today.length;

  // The fourth is refused, and says why rather than doing nothing.
  const left = take().first();
  check("a fourth is not offered", await left.isDisabled());
  check("...and says what the cap is",
    /cap/i.test(await left.getAttribute("title")),
    await left.getAttribute("title"));
  check("...and adding a fresh action is closed off too",
    await p.locator("[data-tier=today]")
      .getByRole("button", { name: /Add action/ }).isDisabled());
  check("...explaining itself in words",
    /Finish one, or put one back/i.test(await p.locator("[data-tier=today]").innerText()));
  check("...and nothing was written",
    (await stored()).today.length === before, `${before} → ${(await stored()).today.length}`);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------ one thing that matters (Rule A) */
{
  const { p, errs } = await open();
  await openGoal(p);

  await p.getByRole("button", { name: /Take .* into today/ }).first().click();
  await p.waitForTimeout(600);

  const flags = p.getByRole("button", { name: /main thing today/ });
  check("today's actions each offer the flag", (await flags.count()) === 2,
    `${await flags.count()} offered`);
  check("...and nothing outside today does",
    (await p.locator("[data-tier=thisWeek]")
      .getByRole("button", { name: /main thing today/ }).count()) === 0);

  await flags.first().click();
  await p.waitForTimeout(600);
  const one = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons.today
  );
  check("naming the day's one thing writes it down",
    one.filter((s) => s.primary).length === 1,
    JSON.stringify(one.map((s) => [s.title, !!s.primary])));

  // Naming a second has to move the flag, not add one — a day with two
  // bottlenecks has none.
  await p.getByRole("button", { name: /main thing today/ }).nth(1).click();
  await p.waitForTimeout(600);
  const two = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons.today
  );
  check("naming a second moves the flag rather than adding one",
    two.filter((s) => s.primary).length === 1,
    JSON.stringify(two.map((s) => [s.title, !!s.primary])));
  check("...onto the one just named",
    two.find((s) => s.primary)?.title === one.find((s) => !s.primary)?.title,
    two.find((s) => s.primary)?.title);

  // And pressing the one that holds it takes the name back.
  await p.getByRole("button", { name: /Not the main thing today/ }).click();
  await p.waitForTimeout(600);
  const none = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons.today
  );
  check("...and a day is allowed not to have one",
    none.every((s) => !s.primary));

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
  await p.waitForTimeout(500);
  check("an activity gets a word of advice",
    /Name what will exist/i.test(await p.locator("main").innerText()));

  // Advice only — it never stands between somebody and their own plan.
  const saved = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons.today
  );
  check("...but the words are still theirs to keep",
    saved.some((s) => s.title === "Work on the UI"),
    JSON.stringify(saved.map((s) => s.title)));

  await p.locator('input[value="Work on the UI"]').first()
    .fill("Wrap long task sentences in the daily plan");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(500);
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
    .getByRole("button", { name: /Add sub-goal/ }).click();
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

/* --------------------------- a weekly goal lends its steps and stays in the week */
{
  const { p, errs } = await open();
  await openGoal(p);

  // Break the week's action into steps, then finish today so it takes its turn.
  const row = p.locator("li").filter({ has: p.locator('input[value="Fix the wording in the UI"]') });
  const add = row.getByRole("button", { name: /Add step/ });
  check("Add step is there without having to hover for it",
    await add.isVisible(), "no hover needed");

  await add.click();
  await p.waitForTimeout(400);
  await row.locator('input[placeholder="A smaller piece of it…"]').first()
    .fill("Change the home page wording");
  await p.waitForTimeout(400);

  // Chosen, not delivered: the week's goal comes down because it is asked to.
  await row.getByRole("button", { name: /Take .* into today/ }).click();
  await p.waitForTimeout(900);

  const stored = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("the weekly goal stays in the week", stored.thisWeek.length === 1,
    JSON.stringify(stored.thisWeek.map((s) => s.title)));
  check("...and the button now says it is on today",
    /On today/i.test(await row.innerText()),
    (await row.innerText()).replace(/\n/g, " ").slice(0, 90));
  check("...marked as the one being worked on", stored.thisWeek[0].active === true);
  check("...and is not moved into today",
    !stored.today.some((s) => s.id === "w1"),
    JSON.stringify(stored.today.map((s) => s.id)));

  const body = await p.locator("main").innerText();
  check("its step is on today's list",
    body.includes("Change the home page wording"), body.slice(-260));
  // The tag is uppercased by the stylesheet, so innerText shouts it back.
  check("...tagged with the goal it belongs to",
    /FIX THE WORDING IN THE UI/i.test(body),
    body.slice(-160).replace(/\n/g, " "));

  // Finishing the step should strike the weekly goal through.
  await p.getByRole("button", { name: 'Mark "Change the home page wording" complete' }).click();
  await p.waitForTimeout(900);
  const after = await p.evaluate(
    () => JSON.parse(localStorage.getItem("innerly:goals"))[0].horizons
  );
  check("finishing its steps finishes the weekly goal",
    after.thisWeek[0].done === true);
  check("...which stays where it was written",
    after.thisWeek.length === 1, JSON.stringify(after.thisWeek.map((s) => s.title)));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------- the tier is now Weekly Goal */
{
  const { p, errs } = await open();
  await openGoal(p);
  const body = await p.locator("main").innerText();
  check("the week is called what it is", /Weekly Goal/i.test(body));
  check("...and no longer This Week", !/THIS WEEK/i.test(body),
    body.split("\n").find((l) => /week/i.test(l)) ?? "");
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
