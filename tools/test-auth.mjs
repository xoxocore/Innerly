// The sign-up, sign-in and password-reset flows, driven in a real browser
// against a stubbed Supabase.
//
// It needs a build pointed at a host this script can intercept:
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-auth.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.
//
// The reset half is the reason this file exists. A reset link signs you in, so
// nothing stops the app waving you straight through with the password you came
// to change still working — except a test that says it must not.

import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000/";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PASSWORD = "correct-horse9";

const USER = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  aud: "authenticated",
  role: "authenticated",
  email: "divya@example.com",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Divya", name: "Divya" },
};

const session = () => ({
  access_token: "at.1",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "rt.1",
  user: USER,
});

let failures = 0;
function check(name, ok, extra) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

/** Stand in for the whole Supabase API, recording what the app asked for. */
function mockSupabase(page, state) {
  return page.route("**stub.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = route.request().postData();
    state.seen.push(method + " " + url.pathname + (url.search || ""));
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

    if (url.pathname === "/auth/v1/signup") {
      // Confirmation on: an account, but no session until the link is clicked.
      return json({ ...USER, session: null });
    }
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "pkce") return json(session());
      const sent = JSON.parse(body || "{}");
      if (sent.password !== PASSWORD) {
        return json(
          { error: "invalid_grant", error_description: "Invalid login credentials" },
          400
        );
      }
      return json(session());
    }
    if (url.pathname === "/auth/v1/user") {
      if (method === "PUT") {
        state.passwordSetTo = JSON.parse(body || "{}").password;
        return json(USER);
      }
      return json(USER);
    }
    if (url.pathname.startsWith("/rest/v1/user_state")) {
      return method === "GET" ? json([]) : json({});
    }
    return json({});
  });
}

/** Click through the intro slides to wherever they end. */
async function walkIntro(page) {
  for (let i = 0; i < 8; i++) {
    const btn = page.getByRole("button", { name: /Continue|Get started/ });
    if (!(await btn.count())) break;
    await btn.first().click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
}

/* ------------------------------------------------- making an account ------ */

async function signUpFlow(browser) {
  const state = { seen: [], passwordSetTo: null };
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 950 } })).newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await mockSupabase(page, state);

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("the app opens on a sign-in screen, not the journal",
    !!(await page.getByText("Welcome back").count()));

  await page.getByRole("button", { name: /Make an account/i }).click();
  await page.waitForTimeout(500);
  check("sign-up asks for a name, email and two passwords",
    (await page.locator("input[type=password]").count()) === 2);

  await page.getByPlaceholder("Your first name").fill("Divya");
  await page.getByPlaceholder("Email").fill(USER.email);

  const submit = page.getByRole("button", { name: /Create account/i });
  await page.getByPlaceholder("New password").fill("short1");
  await page.waitForTimeout(300);
  check("a too-short password cannot be submitted", await submit.isDisabled());
  check("...and the rule is shown rather than only refused",
    !!(await page.getByText(/At least 8 characters/).count()));

  await page.getByPlaceholder("New password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm password").fill("correct-horse8");
  await page.waitForTimeout(300);
  check("mismatched passwords cannot be submitted", await submit.isDisabled());
  check("...and it says why", !!(await page.getByText(/Both passwords need to match/).count()));

  await page.getByPlaceholder("Confirm password").fill(PASSWORD);
  await page.waitForTimeout(300);
  check("matching, strong passwords can be submitted", await submit.isEnabled());

  await page.getByLabel("Show password").first().click();
  await page.waitForTimeout(200);
  check("a password can be revealed to check it",
    (await page.locator("input[type=text]").count()) >= 1);
  await page.getByLabel("Hide password").first().click();

  await submit.click();
  await page.waitForTimeout(1200);
  check("signing up reaches Supabase",
    state.seen.some((r) => r.startsWith("POST /auth/v1/signup")));
  check("it then asks them to check their email",
    !!(await page.getByText(/Check your email/).count()));

  await page.getByRole("button", { name: /send it again/i }).click();
  await page.waitForTimeout(700);
  check("the confirmation email can be resent",
    state.seen.some((r) => r.startsWith("POST /auth/v1/resend")));
  check("...and it confirms that it went", !!(await page.getByText(/sent again/).count()));

  await page.getByRole("button", { name: /Back to sign in/i }).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Email").fill(USER.email);
  await page.getByPlaceholder("Password").fill("wrong-password1");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForTimeout(1000);
  const alert = await page.locator("[role=alert]").first().textContent().catch(() => "");
  check("a wrong password says something a person understands",
    /don't match|check both/i.test(alert || ""), (alert || "").slice(0, 60));

  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForTimeout(1800);
  check("signing in loads the account",
    state.seen.some((s) => s.startsWith("GET /rest/v1/user_state")));
  check("onboarding does not ask the name again — sign-up already had it",
    (await page.getByText(/What should we call you/).count()) === 0);

  await walkIntro(page);
  check("and they land in the app itself", !!(await page.$("aside")));
  check("...greeted by name", /Divya/.test(await page.locator("body").innerText()));
  check("no errors anywhere in that flow", errs.length === 0, errs[0]);
}

/* ------------------------------------------- links that come by email ----- */

async function resetFlow(browser) {
  const state = { seen: [], passwordSetTo: null };
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await mockSupabase(page, state);

  await page.goto(
    BASE + "?error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
    { waitUntil: "networkidle" }
  );
  await page.waitForTimeout(1300);
  const shown = await page.locator("body").innerText();
  check("an expired link explains itself instead of hanging or failing silently",
    /expired/i.test(shown), shown.split("\n").find((l) => /expired/i.test(l)));
  check("...and the error is cleared out of the address bar",
    !(await page.evaluate(() => window.location.search)).includes("error"));

  // The cookie Supabase leaves behind when it sends a reset email. The
  // "/recovery" suffix is what marks the link as a password reset rather than
  // an ordinary sign-in.
  await ctx.addCookies([{
    name: "sb-stub-auth-token-code-verifier",
    value: "base64-" + Buffer.from(JSON.stringify("test-verifier-value/recovery")).toString("base64"),
    url: BASE.replace(/\/$/, ""),
  }]);

  await page.goto(BASE + "?code=abc123", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check("the code from the link is exchanged with Supabase",
    state.seen.some((s) => s.includes("grant_type=pkce")));

  const text = await page.locator("body").innerText();
  check("a reset link stops at 'choose a new password'",
    /Choose a new password/i.test(text), text.split("\n")[0]);
  check("...and does NOT drop them into the journal with the old password still working",
    !(await page.$("aside")));
  check("it asks for the new password twice",
    (await page.locator("input[type=password]").count()) === 2);

  const save = page.getByRole("button", { name: /Save it and continue/i });
  await page.getByPlaceholder("New password").fill("brand-new-pass1");
  await page.getByPlaceholder("Confirm password").fill("brand-new-pass2");
  await page.waitForTimeout(300);
  check("a mismatch is refused here too", await save.isDisabled());

  await page.getByPlaceholder("Confirm password").fill("brand-new-pass1");
  await page.waitForTimeout(300);
  check("matching, strong passwords are accepted", await save.isEnabled());

  await save.click();
  await page.waitForTimeout(2000);
  check("the new password actually reaches Supabase",
    state.passwordSetTo === "brand-new-pass1", String(state.passwordSetTo));

  await walkIntro(page);
  check("and only then are they let through into the app", !!(await page.$("aside")));
  check("no errors anywhere in that flow", errs.length === 0, errs[0]);
}

const browser = await chromium.launch({ executablePath: CHROME });
await signUpFlow(browser);
console.log();
await resetFlow(browser);
await browser.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
