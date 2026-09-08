// The vision board's small controls.
//
// A topic is a short line somebody writes about their own future, and an emoji
// usually belongs inside it rather than tacked onto the end — so the picker has
// to drop one where the caret is. And a board you keep is a board you stop
// seeing: shuffling has to genuinely change the order and be remembered, or it
// is a button that appears to do nothing.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-vision-board.mjs
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

const TITLES = [
  "A calm morning routine",
  "Run a half marathon",
  "Learn to make bread",
  "A week with no screens",
  "Move somewhere with light",
  "Speak Spanish properly",
];
const BOARD = [
  {
    id: "year-2028",
    year: "2028",
    items: TITLES.map((title, i) => ({
      id: `v${i}`,
      title,
      description: "",
      gradient: ["#e8f7ef", "#d6ece0"],
      createdAt: new Date().toISOString(),
    })),
  },
];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open() {
  const p = await (await b.newContext({
    viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
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
  await p.addInitScript((board) => {
    localStorage.setItem("innerly:visionboard", JSON.stringify(board));
  }, BOARD);

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
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Vision Board" }).first().click();
  await p.waitForTimeout(900);
  return { p, errs };
}

const order = (p) =>
  p.evaluate(
    (titles) =>
      [...document.querySelectorAll("main *")]
        .filter((el) => el.children.length === 0 && titles.includes(el.textContent.trim()))
        .map((el) => el.textContent.trim()),
    TITLES
  );

const saved = (p) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem("innerly:visionboard"))[0].items.map((i) => i.title)
  );

/* ------------------------------------------------------------------ shuffle */
{
  const { p, errs } = await open();

  const before = await order(p);
  check("every vision is on the board", before.length === TITLES.length,
    `${before.length} of ${TITLES.length}`);

  const button = p.getByRole("button", { name: "Shuffle the board" });
  check("shuffle is offered", (await button.count()) > 0);

  await button.click();
  await p.waitForTimeout(600);
  const after = await order(p);

  check("...and the order really changes", after.join() !== before.join(),
    `${before.slice(0, 3).join(" / ")} → ${after.slice(0, 3).join(" / ")}`);
  check("...without losing or duplicating a card",
    after.length === before.length &&
      [...after].sort().join() === [...before].sort().join());

  const onDisk = await saved(p);
  check("...and the new order is written down", onDisk.join() === after.join(),
    onDisk.slice(0, 3).join(" / "));

  // Ten shuffles in a row must never leave the board untouched.
  let noops = 0;
  for (let i = 0; i < 10; i++) {
    const was = await saved(p);
    await button.click();
    await p.waitForTimeout(250);
    if ((await saved(p)).join() === was.join()) noops++;
  }
  check("...every time it is pressed", noops === 0, `${noops} did nothing`);

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* -------------------------------------------------------- an emoji in a topic */
{
  const { p, errs } = await open();

  await p.getByRole("button", { name: /Add to board/ }).click();
  await p.waitForTimeout(500);

  const topic = p.getByPlaceholder(/^Topic/);
  check("the composer is open", (await topic.count()) > 0);

  await topic.fill("A calm morning");
  const opener = p.getByRole("button", { name: "Add an emoji to the topic" });
  check("the topic offers emoji", (await opener.count()) > 0);

  // Caret to just after "A", so an appended emoji would land in the wrong place.
  await topic.click();
  await topic.evaluate((el) => el.setSelectionRange(1, 1));
  await opener.click();
  await p.waitForTimeout(400);

  // The picker's category tabs are emoji too, so the grid is named by what it
  // is not: the tabs carry an aria-label, the emoji themselves do not.
  const first = p
    .locator("button:not([aria-label])")
    .filter({ hasText: /\p{Extended_Pictographic}/u });
  const count = await first.count();
  check("the picker opens with emoji in it", count > 0, `${count} buttons`);

  const chosen = await first.first().innerText();
  await first.first().click();
  await p.waitForTimeout(300);

  const value = await topic.inputValue();
  check("the emoji lands in the topic", value.includes(chosen.trim()), value);
  check("...where the caret was, not on the end",
    value.startsWith("A" + chosen.trim()), value);
  check("...and the picker closes", (await first.count()) === 0);

  const caret = await topic.evaluate((el) => el.selectionStart);
  check("...leaving the caret after it", caret === 1 + chosen.trim().length,
    `caret at ${caret}`);

  // It has to survive being saved.
  await p.getByRole("button", { name: /Add to board/ }).last().click();
  await p.waitForTimeout(800);
  const titles = await saved(p);
  check("...and it is saved with the vision",
    titles.some((t) => t.includes(chosen.trim())),
    titles.find((t) => t.startsWith("A")) ?? "");

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
