// Which writing leads the blog, and which moves aside.
//
// The rule is "published in the last seven days leads", with a fallback so a
// quiet week still has a front page rather than an empty one. Both halves are
// checked here, because the fallback is the branch that only runs when nobody
// has written anything lately — which is exactly when nobody is looking at the
// code either.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-blog.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.

import { chromium } from "playwright-core";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const SIGNED_UP = new Date(Date.now() - 30 * 864e5).toISOString();
const mkUser = () => ({ id: OWNER.id, aud:"authenticated", role:"authenticated", email: OWNER.email,
  email_confirmed_at: SIGNED_UP, created_at: SIGNED_UP, app_metadata:{provider:"email"},
  user_metadata:{ name:"Divya", full_name:"Divya" } });
const mkSession = () => ({ access_token:"at.1", token_type:"bearer", expires_in:3600,
  expires_at: Math.floor(Date.now()/1000)+3600, refresh_token:"rt.1", user: mkUser() });

const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
// Two from this week, three older. The older ones must not lead the page.
const posts = [
  { id:"p1", kind:"blog", slug:"fresh-one", title:"Written two days ago", excerpt:"New.",
    content:"<p>Body</p>", category:"Mindset", duration:null, cover_path:null,
    gradient:["#f6d6e0","#e7e1f0"], published:true, published_at: day(2), updated_at: day(2) },
  { id:"p2", kind:"blog", slug:"fresh-two", title:"Written yesterday", excerpt:"Also new.",
    content:"<p>Body</p>", category:"Patterns", duration:null, cover_path:null,
    gradient:["#d7e8f2","#eef0e6"], published:true, published_at: day(1), updated_at: day(1) },
  { id:"p3", kind:"blog", slug:"old-one", title:"From last month", excerpt:"Older.",
    content:"<p>Body</p>", category:"Habits", duration:null, cover_path:null,
    gradient:["#f0e3d6","#e9dcec"], published:true, published_at: day(30), updated_at: day(30) },
  { id:"p4", kind:"blog", slug:"old-two", title:"From two months ago", excerpt:"Older still.",
    content:"<p>Body</p>", category:"Habits", duration:null, cover_path:null,
    gradient:["#e2eede","#eadff0"], published:true, published_at: day(60), updated_at: day(60) },
  { id:"p5", kind:"blog", slug:"old-three", title:"From last year", excerpt:"Oldest.",
    content:"<p>Body</p>", category:"Habits", duration:null, cover_path:null,
    gradient:["#f3d9e6","#dfe7f2"], published:true, published_at: day(300), updated_at: day(300) },
];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok?"PASS":"FAIL"}  ${n}${x?"  — "+x:""}`); };

async function mock(page, override = posts) {
  await page.route("**stub.supabase.co/**", (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    const path = u.pathname;
    const json = (d) => route.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(d) });
    if (path === "/auth/v1/token") return json(mkSession());
    if (path === "/auth/v1/user") return json(mkUser());
    if (path === "/rest/v1/rpc/is_admin") return json(true);
    if (path === "/rest/v1/rpc/post_counts") return json([]);
    if (path.startsWith("/rest/v1/posts")) return json(override);
    if (path.startsWith("/rest/v1/post_hearts")) return json([]);
    if (path.startsWith("/rest/v1/notifications")) return json([]);
    if (path.startsWith("/rest/v1/rpc/notification_counts")) return json([]);
    if (path.startsWith("/rest/v1/user_state")) return m === "GET" ? json([]) : json({});
    return json({});
  });
}

async function openBlog(override) {
  const p = await (await b.newContext({ viewport:{width:1280,height:1000}, deviceScaleFactor:2 })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await mock(p, override);
  await p.goto("http://localhost:3000/", { waitUntil:"networkidle" });
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button", { name: /^Sign in$/ }).click();
  await p.waitForTimeout(1800);
  for (let i=0;i<8;i++){ const btn=p.getByRole("button",{name:/Continue|Get started/}); if(!(await btn.count()))break; await btn.first().click(); await p.waitForTimeout(350);}
  await p.locator("[role=dialog]").first().waitFor({ state:"visible", timeout:8000 }).catch(()=>{});
  for (let i=0;i<6 && (await p.locator("[role=dialog]").count());i++){ await p.keyboard.press("Escape"); await p.waitForTimeout(350);}
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Blog$/ }).first().click();
  await p.waitForTimeout(1000);
  return { p, errs };
}

/* ------------------------------------------------- this week leads the page */
{
  const { p, errs } = await openBlog();
  const text = await p.locator("main").innerText();
  check("this week's writing is called out", /this week/i.test(text));

  // Featured area is the grid; earlier ones live in the aside.
  const featured = await p.locator("section .grid button").allInnerTexts();
  const earlier = await p.locator("aside li").allInnerTexts();

  check("only this week's two are featured", featured.length === 2, `${featured.length} featured`);
  check("...and they are the right two",
    featured.join(" ").includes("Written yesterday") &&
    featured.join(" ").includes("Written two days ago"));
  check("the newest of them comes first",
    (featured[0] ?? "").includes("Written yesterday"), featured[0]?.split("\n")[1]);
  check("older writing moves to the side, not away", earlier.length === 3, `${earlier.length} earlier`);
  check("...newest of those first", (earlier[0] ?? "").includes("From last month"), earlier[0]?.split("\n")[0]);
  check("nothing is lost between the two", featured.length + earlier.length === 5);

  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no sideways scroll", over <= 1, String(over));
  check("no page errors", errs.length === 0, errs[0]);
  await p.screenshot({ path: "blog-week.png", fullPage: true });
  await p.close();
}

/* ------------------------------------------- a quiet week still has a front */
{
  const old = posts.map((p, i) => ({ ...p, published_at: day(30 + i * 10) }));
  const { p, errs } = await openBlog(old);
  const text = await p.locator("main").innerText();
  check("a quiet week says Featured, not This week",
    /featured/i.test(text) && !/this week/i.test(text),
    JSON.stringify(text.slice(0, 90)));
  const featured = await p.locator("section .grid button").allInnerTexts();
  check("...and the page is not left bare", featured.length === 4, `${featured.length} featured`);
  check("...with the most recent leading", (featured[0] ?? "").includes("Written two days ago"),
    featured[0]?.split("\n")[1]);
  check("no page errors", errs.length === 0, errs[0]);
  await p.screenshot({ path: "blog-quiet.png", fullPage: true });
  await p.close();
}

await b.close();
console.log(bad === 0 ? "\nAll checks passed." : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
