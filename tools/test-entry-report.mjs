// A saved reflection, read back as a report.
//
// The thing worth guarding is the order and the completeness. An entry is
// three steps — what was heavy, why, what happens next — and read out of that
// order, or with the marks somebody made in step three dropped on the floor,
// it stops being a reflection and becomes a page of text. The report also has
// to survive being printed: the marks were made in whichever mode the user was
// in, and paper is always white.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-entry-report.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.

import { chromium } from "playwright-core";
import { readFile, unlink } from "node:fs/promises";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const UP = new Date(Date.now() - 30 * 864e5).toISOString();
const mkUser = () => ({
  id: OWNER.id, aud: "authenticated", role: "authenticated", email: OWNER.email,
  email_confirmed_at: UP, created_at: UP, app_metadata: { provider: "email" },
  user_metadata: { name: "Divya", full_name: "Divya" },
});

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const HEAVY =
  "I felt completely overwhelmed when I realised I might miss the deadline for the marketing launch, even though I had worked all day.";
const WHY_PLAIN = "It happened because I underestimated the competitor research stage.";
const MARK_1 = "I thought it would only take an hour, but it was three";
const MARK_2 = "when things go wrong my first thought is that I have failed at everything";
const STEPS = [
  "Break the remaining work into 30-minute blocks and do one at a time.",
  "Ask for a quick alignment check with the team at 9am tomorrow.",
  "Set a time limit for research so it cannot become analysis paralysis.",
];

// Saved exactly as step three saves it: one <section> per moment, the moment
// restated above its reason, and the marks made as inline background colour —
// here in the NIGHT-mode highlight, which must not reach paper as a dark block.
const REVIEW =
  `<section>` +
  `<p>${HEAVY}</p>` +
  `<p style="color:var(--muted-foreground)">${WHY_PLAIN} ` +
  `<span style="background-color: rgb(90, 51, 64);">${MARK_1}</span>. This made me panic. ` +
  `I also noticed that <span style="background-color: rgb(90, 51, 64);">${MARK_2}</span>, ` +
  `which makes me freeze.</p>` +
  `</section>`;

const ENTRY = {
  id: "reflection-under-test",
  date: new Date().toISOString(),
  moments: [{ text: HEAVY, why: WHY_PLAIN, next: STEPS }],
  differently: STEPS.join(" · "),
  review: REVIEW,
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function open({ dark = false } = {}) {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2,
    colorScheme: dark ? "dark" : "light",
  });
  const p = await ctx.newPage();
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
  await p.addInitScript((entry) => {
    localStorage.setItem("innerly:reflections", JSON.stringify([entry]));
  }, ENTRY);

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
  await p.getByRole("button", { name: "History" }).first().click();
  await p.waitForTimeout(900);
  return { p, errs };
}

async function openReport(p) {
  await p.getByText(HEAVY.slice(0, 40), { exact: false }).first().click();
  await p.locator('[role=dialog][aria-label="Reflection"]').waitFor({ timeout: 8000 });
  await p.waitForTimeout(500);
  return p.locator('[role=dialog][aria-label="Reflection"]');
}

/* ------------------------------------------------------- order and content */
{
  const { p, errs } = await open();
  const dialog = await openReport(p);

  const headings = await dialog.locator("section h3").allInnerTexts();
  const order = headings.map((h) => h.replace(/\s+/g, " ").trim());
  check("the three steps are all there", order.length === 3, JSON.stringify(order));
  check("...in the order a reflection is made",
    /1 WHAT FELT HEAVY/i.test(order[0] ?? "") &&
    /2 WHY DID IT HAPPEN/i.test(order[1] ?? "") &&
    /3 CLEAR NEXT STEPS/i.test(order[2] ?? ""),
    JSON.stringify(order));

  const blocks = dialog.locator("section.print-block > div");
  check("what felt heavy is the moment itself",
    (await blocks.nth(0).innerText()).trim() === HEAVY);

  const why = (await blocks.nth(1).innerText()).replace(/\s+/g, " ").trim();
  check("the reason is in the reason block", why.includes(WHY_PLAIN.slice(0, 40)), why.slice(0, 60));
  check("...and carries the first mark", why.includes(MARK_1), why.slice(0, 80));
  check("...and the second", why.includes(MARK_2));
  check("...without restating the heavy moment", !why.includes(HEAVY.slice(0, 40)),
    why.slice(0, 60));

  const marks = dialog.locator(".report-mark");
  check("the marks are drawn as marks", (await marks.count()) === 2,
    `${await marks.count()} found`);
  const markBg = await marks.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  check("...in the report's own highlight, not the night one",
    !/rgb\(90, 51, 64\)/.test(markBg), markBg);

  const steps = dialog.locator("section.print-block ol li");
  check("every next step is its own point", (await steps.count()) === STEPS.length,
    `${await steps.count()} of ${STEPS.length}`);
  const first = (await steps.first().innerText()).replace(/\s+/g, " ");
  check("...numbered and readable", first.includes(STEPS[0]), first.slice(0, 60));

  check("each block is kept off a page break",
    (await dialog.locator("section.print-block").count()) === 3);
  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

/* ------------------------------------------------------------------- print */
{
  const { p, errs } = await open({ dark: true });
  const dialog = await openReport(p);

  const exportBtn = dialog.locator("button.print-hide", { hasText: /Export to PDF/i });
  check("the export button is offered",
    (await dialog.getByRole("button", { name: /Export to PDF/i }).count()) > 0);

  await p.emulateMedia({ media: "print" });
  await p.waitForTimeout(300);

  const hidden = await p.evaluate(() => {
    const buried = [...document.querySelectorAll("body > *:not(.print-root)")];
    return buried.every((el) => getComputedStyle(el).display === "none");
  });
  check("printing leaves the app behind", hidden);

  const chrome = await exportBtn.evaluate((el) => getComputedStyle(el).display);
  check("...and the buttons that only mean something on screen", chrome === "none");

  const paper = await dialog.locator(".print-sheet").evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  check("...on white paper even from night mode", /255, 255, 255/.test(paper), paper);

  const bars = await dialog.locator("section.print-block h3").evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).backgroundColor)
  );
  const light = bars.every((b) => {
    const [r, g, bl] = (b.match(/\d+/g) ?? []).map(Number);
    return r + g + bl > 450;
  });
  check("...with the section colours still printed light", light, bars.join(" "));

  const pdf = "/tmp/innerly-entry-report.pdf";
  await p.pdf({ path: pdf, format: "A4", printBackground: true });
  const bytes = await readFile(pdf);
  check("a real PDF comes out", bytes.subarray(0, 5).toString() === "%PDF-",
    `${(bytes.length / 1024).toFixed(1)}KB`);
  await unlink(pdf).catch(() => {});

  check("no page errors", errs.length === 0, errs[0]);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
