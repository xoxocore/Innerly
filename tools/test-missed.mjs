// Jelly's evening check-in, in a browser.
//
// It brings up something that did not go well, to somebody who did not ask, on
// arrival. Almost every rule around it is about staying quiet, and a feature
// whose correctness is mostly silence is one where "it appeared" is the least
// interesting thing to check — so most of what is below is that nothing was
// said, in the cases where nothing should be.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-missed.mjs
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

/** Morning of the 2nd: the day being asked about is the 1st. */
const MORNING = "2026-03-02T09:00:00";
/** Late on the 2nd: the day being asked about is the 2nd itself. */
const LATE = "2026-03-02T23:30:00";
/** Mid-afternoon: no day has closed. */
const AFTERNOON = "2026-03-02T16:00:00";

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

/**
 * A signed-in app with a fixed clock and whatever was left lying about.
 *
 * The clock is fixed before anything loads, because the check-in decides which
 * day it is asking about once, on arrival — a clock moved afterwards would be
 * testing a decision that had already been made.
 */
async function open({ now = MORNING, seed = {} } = {}) {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 950 },
    timezoneId: "UTC",
  })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.clock.setFixedTime(new Date(now));

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

  // Everything goes in as JSON, strings included: the app reads this keyspace
  // with JSON.parse, and a bare string written without quotes throws there and
  // is read back as nothing at all — which looked exactly like the feature
  // working when the seed was the thing that was broken.
  await p.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, seed);

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
  await p.waitForTimeout(700);
  return { p, errs };
}

const card = (p) => p.locator("[data-check-in]");
const task = (id, title, done = false) => ({ id, title, done });
const goal = (horizons, extra = {}) => ({
  id: "g1", title: "Get Innerly live", color: "emerald",
  createdAt: "2026-01-01T00:00:00.000Z", order: 0,
  horizons: {
    year: [], sixMonths: [], threeMonths: [],
    oneMonth: [], thisWeek: [], today: [], ...horizons,
  },
  ...extra,
});

/* --------------------------------------------------------------- it appears */
{
  const { p, errs } = await open({
    seed: {
      "innerly:missed:2026-03-01": ["Ship the therapist export"],
      "innerly:tasks:2026-03-01": [
        task("t1", "Call the accountant"),
        task("t2", "Water the plants", true),
      ],
    },
  });

  check("a day that was left holding something gets asked about",
    (await card(p).count()) === 1);

  const text = await card(p).innerText();
  check("...by name", /Hi Divya\./.test(text), text.split("\n")[0]);
  check("...naming what stayed", /Ship the therapist export/.test(text), text);
  check("...and the other one", /Call the accountant/.test(text));
  check("...but not what was finished", !/Water the plants/.test(text));
  check("...saying which day it was", /yesterday/.test(text));
  check("...and offering rather than instructing", /If you'd like/.test(text));

  check("Jelly brings the heart", (await card(p).locator("[data-jelly=heart]").count()) === 1);
  check("...and blinks with it", (await card(p).locator("[data-jelly=lid]").count()) === 2);

  // Two ways out, and neither of them is the only way out.
  check("there is a way to say yes",
    (await card(p).getByRole("button", { name: /look at it/i }).count()) === 1);
  check("...and a way to say not now",
    (await card(p).getByRole("button", { name: /Not now/i }).count()) === 1);

  // A card, not a dialog: a dialog has to be dealt with before anything else
  // can happen, and demanding to be dealt with is the wrong tone for this.
  check("it does not block the app",
    (await p.locator("[role=dialog]").count()) === 0);
  check("...and the page underneath is usable",
    await p.getByRole("button", { name: "Daily Plan" }).first().isEnabled());

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------------- staying quiet */
{
  const { p, errs } = await open({ now: AFTERNOON, seed: {
    "innerly:tasks:2026-03-02": [task("t1", "Still working on it")],
  }});
  check("nothing is said about a day that is still going",
    (await card(p).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [task("t1", "Call the accountant", true)],
  }});
  check("nothing is said when the day was finished",
    (await card(p).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

{
  const { p, errs } = await open({ seed: {} });
  check("nothing is said when there was no plan at all",
    (await card(p).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [task("t1", "Call the accountant")],
    "innerly:prefs": { notifications: false, dailyReminder: true, missedCheckIn: false },
  }});
  check("nothing is said once it is switched off in settings",
    (await card(p).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [task("t1", "Call the accountant")],
    "innerly:missed-asked": "2026-03-01",
  }});
  check("nothing is said about a day already asked about",
    (await card(p).count()) === 0);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ----------------------------------------------------- and it only asks once */
{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [task("t1", "Call the accountant")],
  }});
  check("it is there to begin with", (await card(p).count()) === 1);

  await card(p).getByRole("button", { name: /Not now/i }).click();
  await p.waitForTimeout(700);
  check("saying not now puts it away", (await card(p).count()) === 0);

  const settled = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("innerly:missed-asked"))
  );
  check("...and writes the day down", settled === "2026-03-01", String(settled));

  // "Not now" is a whole answer. A prompt that came back tomorrow having been
  // declined today would be nagging somebody about what they did not manage.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  check("...so it does not come back on the next visit",
    (await card(p).count()) === 0);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------ yes goes to Reflect */
{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [task("t1", "Call the accountant")],
  }});

  await card(p).getByRole("button", { name: /look at it/i }).click();
  await p.waitForTimeout(900);

  const body = await p.locator("main").innerText();
  check("saying yes opens the reflection", /what felt heavy|Pause & review|Reflect/i.test(body),
    body.split("\n").slice(0, 3).join(" / "));
  check("...and the card is gone", (await card(p).count()) === 0);
  check("...and that day is settled too",
    (await p.evaluate(() => localStorage.getItem("innerly:missed-asked")))
      === '"2026-03-01"');

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ----------------------------------- what the goal page left, noted as it turns */
{
  // The note is taken as the day turns, because that is the only moment the
  // old day still exists. A minute later its unfinished work has been carried
  // onto today and is indistinguishable from what was written this morning.
  const { p, errs } = await open({
    now: MORNING,
    seed: {
      "innerly:goals": [
        goal({ today: [
          { id: "a", title: "Turn the date green", done: false },
          { id: "b", title: "Wrap the long sentences", done: true },
        ] }, { lastReset: "2026-03-01" }),
      ],
    },
  });

  const noted = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("innerly:missed:2026-03-01") ?? "null")
  );
  check("what a goal was still holding is noted as the day turns",
    Array.isArray(noted) && noted.includes("Turn the date green"),
    JSON.stringify(noted));
  check("...and what was finished is not", !(noted ?? []).includes("Wrap the long sentences"));

  check("...and the check-in names it",
    /Turn the date green/.test(await card(p).innerText()),
    await card(p).innerText());

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------- late at night it means today */
{
  const { p, errs } = await open({ now: LATE, seed: {
    "innerly:tasks:2026-03-02": [task("t1", "Send the invoice")],
  }});
  check("at half past eleven it asks about today",
    (await card(p).count()) === 1);
  const text = await card(p).innerText();
  check("...and says today", /today/.test(text) && !/yesterday/.test(text), text);
  check("...naming today's own leftover", /Send the invoice/.test(text));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* --------------------------------------------------- never a list of failures */
{
  const { p, errs } = await open({ seed: {
    "innerly:tasks:2026-03-01": [
      task("t1", "One"), task("t2", "Two"), task("t3", "Three"),
      task("t4", "Four"), task("t5", "Five"), task("t6", "Six"),
    ],
  }});
  const text = await card(p).innerText();
  check("a bad day is not read back as a list", /and 4 more/.test(text), text);
  check("...and the words are theirs, quoted",
    /\u201cOne\u201d/.test(text), text);
  check("...only two are named",
    /One/.test(text) && /Two/.test(text) && !/Three/.test(text) && !/Six/.test(text));
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
