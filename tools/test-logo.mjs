// The logo, in the app it actually lives in.
//
// Three things worth guarding, because all three are easy to break without
// noticing: the wordmark is BLACK artwork, so it is painted as a shape in the
// page's own ink — get that wrong and it vanishes entirely on night mode, and
// a blank space is not something a test that only looks for an element would
// catch. Jelly blinks, so a lid has to come down and go away again rather than
// stick. And the lockup needs air between it and the first menu item.
//
//   export NEXT_PUBLIC_SUPABASE_URL=https://stub.supabase.co
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key
//   npm run build && npm start &
//   node tools/test-logo.mjs
//
// Rebuild normally afterwards, or the stub host ends up in a real deploy.

import { chromium } from "playwright-core";
const OWNER = { id:"33333333-3333-3333-3333-333333333333", email:"owner@example.com" };
const UP = new Date(Date.now()-30*864e5).toISOString();
const mkUser=()=>({id:OWNER.id,aud:"authenticated",role:"authenticated",email:OWNER.email,
  email_confirmed_at:UP,created_at:UP,app_metadata:{provider:"email"},
  user_metadata:{name:"Divya",full_name:"Divya"}});
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let bad=0; const check=(n,ok,x)=>{if(!ok)bad++;console.log(`${ok?"PASS":"FAIL"}  ${n}${x?"  — "+x:""}`)};

async function open(dark=false){
  const p = await (await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2,
    colorScheme: dark?"dark":"light"})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.route("**stub.supabase.co/**",r=>{
    const path=new URL(r.request().url()).pathname;
    const j=(d)=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(d)});
    if(path==="/auth/v1/token")return j({access_token:"at.1",token_type:"bearer",expires_in:3600,
      expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:"rt.1",user:mkUser()});
    if(path==="/auth/v1/user")return j(mkUser());
    if(path.startsWith("/rest/v1/user_state"))return j([]);
    if(path.startsWith("/rest/v1/posts"))return j([]);
    if(path.startsWith("/rest/v1/notifications"))return j([]);
    return j({});
  });
  await p.goto("http://localhost:3000/",{waitUntil:"networkidle"});
  await p.waitForTimeout(600);
  await p.getByPlaceholder("Email").fill(OWNER.email);
  await p.getByPlaceholder("Password").fill("x");
  await p.getByRole("button",{name:/^Sign in$/}).click();
  await p.waitForTimeout(1800);
  for(let i=0;i<8;i++){const btn=p.getByRole("button",{name:/Continue|Get started/}); if(!(await btn.count()))break; await btn.first().click(); await p.waitForTimeout(350);}
  await p.locator("[role=dialog]").first().waitFor({state:"visible",timeout:8000}).catch(()=>{});
  for(let i=0;i<6&&(await p.locator("[role=dialog]").count());i++){await p.keyboard.press("Escape");await p.waitForTimeout(350);}
  await p.waitForTimeout(700);
  return {p,errs};
}

{
  const {p,errs} = await open();
  const brand = p.getByRole("button",{name:/Innerly — go to the dashboard/});
  check("the lockup is there", await brand.count()>0);
  check("...and the name is readable to a screen reader",
    (await p.getByRole("img",{name:"Innerly"}).count())>0);

  // The gap the user asked for: logo bottom to the first menu item.
  const gap = await p.evaluate(() => {
    const brand = document.querySelector('button[aria-label^="Innerly"]');
    const dash = document.querySelector('button[data-tour="nav-dashboard"]');
    if(!brand||!dash) return null;
    return Math.round(dash.getBoundingClientRect().top - brand.getBoundingClientRect().bottom);
  });
  check("there is real air between the logo and Dashboard", gap !== null && gap >= 24, `${gap}px`);

  // The wordmark must actually be painted, not an invisible mask.
  const ink = await p.evaluate(() => {
    const el = document.querySelector('span[role="img"][aria-label="Innerly"]');
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, mask: (s.maskImage||s.webkitMaskImage||"").slice(0,30), w: el.getBoundingClientRect().width };
  });
  check("the wordmark is inked, not blank", /rgb/.test(ink.bg) && ink.w > 40, `${ink.bg} ${Math.round(ink.w)}px`);
  check("...and shaped by the artwork", /url\(/.test(ink.mask), ink.mask);

  // Jelly blinks: watch the lid height change over time.
  const heights = [];
  for (let i=0;i<70;i++){
    heights.push(await p.evaluate(() => {
      const lid = document.querySelector('button[aria-label^="Innerly"] span span');
      return lid ? Math.round(lid.getBoundingClientRect().height*10)/10 : -1;
    }));
    await p.waitForTimeout(200);
  }
  const closed = heights.filter(h=>h>0.5).length;
  check("Jelly blinks", closed > 0, `${closed} of ${heights.length} samples had a lid down`);
  check("...and is open the rest of the time", closed < heights.length*0.35,
    `${Math.round(closed/heights.length*100)}% closed`);

  check("no page errors", errs.length===0, errs[0]);
  await p.screenshot({path:"app-light.png"});
  await p.close();
}
{
  // Night mode is Innerly's own switch, not the operating system's, so it has
  // to be pressed rather than simulated.
  const {p,errs} = await open();
  await p.getByRole("button",{name:/Toggle night mode/}).first().click();
  await p.waitForTimeout(700);
  check("night mode is actually on",
    await p.evaluate(() => document.documentElement.classList.contains("dark")));
  const vis = await p.evaluate(() => {
    const el = document.querySelector('span[role="img"][aria-label="Innerly"]');
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/\d+/g).map(Number);
    return { bg, lum: (m[0]*0.299+m[1]*0.587+m[2]*0.114) };
  });
  check("in night mode the wordmark is light, not black", vis.lum > 120, `${vis.bg} luma ${Math.round(vis.lum)}`);
  check("no page errors in night mode", errs.length===0, errs[0]);
  await p.screenshot({path:"app-dark.png"});
  await p.close();
}
await b.close();
console.log(bad===0?"\nAll checks passed.":`\n${bad} FAILED`);
process.exit(bad?1:0);
