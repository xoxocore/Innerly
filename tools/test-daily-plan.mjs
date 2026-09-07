// The Daily Plan, in the app it actually lives in.
//
// Two things worth guarding. A task you write is a sentence, not a label, so a
// long one has to wrap and be readable rather than end in an ellipsis — and an
// ellipsis is not something a test that only looks for the element would
// catch. And nothing on this screen may be alarm red: the plan is somewhere
// you come to decide what your day is, and a red mark on an ordinary errand
// reads as a warning about it.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-daily-plan.mjs
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

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

/** "rgb(r, g, b)" -> [r,g,b] */
const parse = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

/** The kind of red that reads as a warning rather than as a colour. */
const isAlarmRed = ([r, g, b]) => r > 175 && g < 95 && b < 95;

async function open(dark = false) {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2,
    colorScheme: dark ? "dark" : "light",
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
    if (path.startsWith("/rest/v1/user_state")) return j([]);
    if (path.startsWith("/rest/v1/posts")) return j([]);
    if (path.startsWith("/rest/v1/notifications")) return j([]);
    return j({});
  });
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
  for (let i = 0; i < 6 && (await p.locator("[role=dialog]").count()); i++) {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: "Daily Plan" }).first().click();
  await p.waitForTimeout(900);
  return { p, errs };
}

/** The panel for the selected day — not the shell's navigation, also an aside. */
const dayPanel = (p) =>
  p.locator("aside").filter({ has: p.getByPlaceholder("Add to this day") }).first();

const LONG =
  "Note down additional features for the settings page and check them with the team before Friday";
const SHORT = "Water the plants";

/* ------------------------------------------------ a long task has to be readable */
{
  const { p, errs } = await open();

  await p.getByPlaceholder("Add to this day").fill(LONG);
  await p.getByRole("button", { name: /^Add$/i }).click();
  await p.waitForTimeout(500);
  await p.getByPlaceholder("Add to this day").fill(SHORT);
  await p.getByRole("button", { name: /^Add$/i }).click();
  await p.waitForTimeout(600);

  const panel = dayPanel(p);
  const long = panel.getByText(LONG, { exact: true }).first();
  const short = panel.getByText(SHORT, { exact: true }).first();
  check("the long task is in the day panel", (await long.count()) > 0);

  const m = await long.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      h: el.getBoundingClientRect().height,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      overflow: cs.textOverflow,
      whiteSpace: cs.whiteSpace,
      text: el.innerText,
    };
  });
  const oneLine = await short.evaluate((el) => el.getBoundingClientRect().height);

  check("...and it wraps onto more than one line", m.h > oneLine * 1.5,
    `${Math.round(m.h)}px tall vs ${Math.round(oneLine)}px for one line`);
  check("...without being cut off sideways", m.scrollW <= m.clientW + 1,
    `scrollWidth ${m.scrollW} vs clientWidth ${m.clientW}`);
  check("...and it is not ellipsised", m.overflow !== "ellipsis", `text-overflow: ${m.overflow}`);
  check("...so the whole sentence is really there", m.text.trim() === LONG,
    JSON.stringify(m.text.trim().slice(0, 60)));

  // The tick has to stay level with the first line, not drift to the middle.
  const tickTop = await panel
    .locator("button[aria-pressed]")
    .first()
    .locator("> span")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  const textTop = await long.evaluate((el) => el.getBoundingClientRect().top);
  check("...with its tick still beside the first line", Math.abs(tickTop - textTop) < 8,
    `tick ${Math.round(tickTop)} vs text ${Math.round(textTop)}`);

  /* ------------------------------------------------------- today is green, not red */
  const pill = await p.evaluate(() => {
    const cells = [...document.querySelectorAll("button[aria-label]")];
    const t = new Date();
    const want = t.toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const cell = cells.find((c) => c.getAttribute("aria-label") === want);
    if (!cell) return null;
    const num = cell.querySelector("span");
    return { bg: getComputedStyle(num).backgroundColor, day: num.textContent };
  });
  check("today's date is marked", pill !== null, pill ? `day ${pill.day}` : "cell not found");
  if (pill) {
    const rgb = parse(pill.bg);
    check("...in green, not red", rgb[1] > rgb[0] && rgb[1] > rgb[2], pill.bg);
    check("...and it is not alarm red", !isAlarmRed(rgb), pill.bg);
  }

  /* ------------------------------------------- nothing on the screen is alarm red */
  const reds = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("main *, aside *")) {
      const cs = getComputedStyle(el);
      for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
        const v = cs[prop];
        const m = (v.match(/\d+/g) ?? []).slice(0, 3).map(Number);
        if (m.length < 3) continue;
        if (v.startsWith("rgba") && v.endsWith(", 0)")) continue;
        if (m[0] > 175 && m[1] < 95 && m[2] < 95) {
          out.push(`${el.tagName.toLowerCase()} ${prop}=${v} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
        }
      }
    }
    return out;
  });
  check("no alarm red anywhere on the Daily Plan", reds.length === 0, reds.slice(0, 4).join(" | "));

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------------------------- the same, on night mode */
{
  const { p, errs } = await open(true);
  await p.getByPlaceholder("Add to this day").fill(LONG);
  await p.getByRole("button", { name: /^Add$/i }).click();
  await p.waitForTimeout(700);

  const long = dayPanel(p).getByText(LONG, { exact: true }).first();
  const m = await long.evaluate((el) => ({
    h: el.getBoundingClientRect().height,
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
  }));
  check("night mode: the long task still wraps", m.h > 26, `${Math.round(m.h)}px`);
  check("night mode: and is not cut off", m.scrollW <= m.clientW + 1);
  check("night mode: no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
