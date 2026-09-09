// The goal engine, on its own.
//
// Two negatives are the reason this file exists, and both are the kind that
// pass unnoticed if you only ever check that features work.
//
// Nothing reaches Today unless a person put it there. An early version
// promoted the next action the moment the last was ticked, and a year's
// thinking drained into one afternoon with nobody seeing it happen.
//
// And nothing skips a rung. A year's target becomes a six-month target, then a
// three-month one, and so on; the arrow that offered to take it straight to
// this afternoon was quietly turning a plan into a wish with a deadline.
//
//   node tools/test-cascade.mjs
//
// No browser: the rules are plain functions, and the point of them being plain
// functions is that they can be checked like this.

// Node strips the types itself, so the real module is the one under test —
// no transpiled copy that might differ from what the app actually runs.
const {
  DAILY_CAP, VAGUE_HINT,
  atCapacity, childrenHere, complete, dayLoad, editByPath, editParts,
  findByPath, isVague, nearer, openToday, picksOf, placements, primaryOf, pull,
  push, removeByPath, setPrimary, settle, shownAt, stepProgress, todaysWork,
  turnAll, turnDay, winsToday,
} = await import("../src/lib/cascade.ts");

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const sub = (id, title, done = false) => ({ id, title, done });
const parent = (id, title, steps) => ({ id, title, done: false, steps });
const goal = (horizons, extra = {}) => ({
  id: "g", title: "Get Innerly live", color: "blue",
  createdAt: "2026-01-01T00:00:00.000Z", order: 0,
  horizons: {
    year: [], sixMonths: [], threeMonths: [],
    oneMonth: [], thisWeek: [], today: [], ...horizons,
  },
  ...extra,
});
const titles = (list) => list.map((s) => s.title);
const shownTitles = (g, h) => shownAt(g, h).map((p) => p.sub.title);

/* ---------------------------------------------------- one rung at a time */

{
  check("the rung below a year is six months", nearer("year") === "sixMonths");
  check("...then three months", nearer("sixMonths") === "threeMonths");
  check("...then the month", nearer("threeMonths") === "oneMonth");
  check("...then the week", nearer("oneMonth") === "thisWeek");
  check("...then today", nearer("thisWeek") === "today");
  check("...and nothing after that", nearer("today") === null);
}

{
  // The screenshot: a year's target with three actions under it.
  const g = goal({
    year: [parent("y1", "Finalise user Interface", [
      sub("a1", "test 1"), sub("a2", "test 2"), sub("a3", "test 3"),
    ])],
  });

  const once = push(g, "year", ["y1", "a1"]);
  check("an action of a year's target goes to six months, not today",
    shownTitles(once, "sixMonths").join() === "test 1",
    JSON.stringify(shownTitles(once, "sixMonths")));
  check("...and today is untouched", shownAt(once, "today").length === 0);
  check("...while the target stays in the year",
    shownTitles(once, "year").join() === "Finalise user Interface");
  check("...and its siblings stayed with it",
    childrenHere(once.horizons.year[0], "year").map((c) => c.title).join()
      === "test 2,test 3");
  check("...tagged with the target it serves",
    shownAt(once, "sixMonths")[0].parent?.title === "Finalise user Interface");

  const twice = push(once, "year", ["y1", "a1"]);
  check("pushing again takes it to three months",
    shownTitles(twice, "threeMonths").join() === "test 1");
  check("...and it is no longer at six months",
    shownAt(twice, "sixMonths").length === 0);

  const back = pull(twice, "year", ["y1", "a1"]);
  check("pulling brings it back one rung, not all the way",
    shownTitles(back, "sixMonths").join() === "test 1",
    JSON.stringify(shownTitles(back, "sixMonths")));
  const home = pull(back, "year", ["y1", "a1"]);
  check("...and again puts it back under its target",
    home.horizons.year[0].steps[0].at === undefined &&
      childrenHere(home.horizons.year[0], "year").length === 3);
  check("pulling something already home does nothing",
    pull(home, "year", ["y1", "a1"]) === home);
}

{
  // A whole target can descend too, one rung at a time, with its parts.
  const g = goal({
    year: [parent("y1", "Finalise user Interface", [sub("a1", "test 1")])],
  });
  const once = push(g, "year", ["y1"]);
  check("a target pushed down goes one rung",
    shownTitles(once, "sixMonths").join() === "Finalise user Interface");
  check("...and its parts come with it",
    childrenHere(once.horizons.year[0], "sixMonths").length === 1);
  check("...leaving the year showing nothing",
    shownAt(once, "year").length === 0);
}

{
  const g = goal({ today: [parent("t1", "Here already", [sub("s1", "a")])] });
  check("nothing on today can be pushed further",
    push(g, "today", ["t1"]) === g);
  check("...nor its parts", push(g, "today", ["t1", "s1"]) === g);
}

{
  const g = goal({ oneMonth: [parent("m1", "x", [sub("s1", "a", true)])] });
  check("a finished line is not pushed anywhere",
    push(g, "oneMonth", ["m1", "s1"]) === g);
}

/* --------------------------------- an action becomes a target where it lands */

{
  const g = push(
    goal({ year: [parent("y1", "Finalise user Interface", [sub("a1", "test 1")])] }),
    "year", ["y1", "a1"]);

  const grown = editParts(g, "year", ["y1", "a1"], (steps) => [
    ...steps, sub("b1", "Wire the settings screen"),
  ]);
  check("a pushed action can be broken down where it landed",
    stepProgress(findByPath(grown, "year", ["y1", "a1"])).total === 1,
    JSON.stringify(findByPath(grown, "year", ["y1", "a1"]).steps?.map((s) => s.title)));
  check("...and its own parts are shown beside it, at six months",
    childrenHere(findByPath(grown, "year", ["y1", "a1"]), "sixMonths").length === 1);
  check("...and can be pushed on to three months",
    shownTitles(push(grown, "year", ["y1", "a1", "b1"]), "threeMonths").join()
      === "Wire the settings screen");

  // Finishing the grandchild settles the whole chain upward.
  const done = complete(grown, "year", ["y1", "a1", "b1"]);
  check("finishing the last part finishes its heading",
    findByPath(done, "year", ["y1", "a1"]).done === true);
  check("...and that finishes the target above it",
    done.horizons.year[0].done === true);
}

{
  // Depth is not two: a plan can run the whole ladder down.
  let g = goal({ year: [parent("y1", "Top", [sub("a", "One")])] });
  g = push(g, "year", ["y1", "a"]);                       // six months
  g = editParts(g, "year", ["y1", "a"], () => [sub("b", "Two")]);
  g = push(g, "year", ["y1", "a", "b"]);                  // three months
  g = editParts(g, "year", ["y1", "a", "b"], () => [sub("c", "Three")]);
  g = push(g, "year", ["y1", "a", "b", "c"]);             // the month
  check("a chain can run rung by rung down the whole ladder",
    shownTitles(g, "oneMonth").join() === "Three",
    JSON.stringify(placements(g).map((p) => `${p.sub.title}@${p.tier}`)));
  check("...each rung showing the one above it as its tag",
    shownAt(g, "oneMonth")[0].parent?.title === "Two");
  check("...and every rung is somewhere different",
    new Set(placements(g).map((p) => p.tier)).size === 4);
}

/* ------------------------------------- the week is not written into directly */

{
  const { HORIZONS } = await import("../src/lib/types.ts");
  const week = HORIZONS.find((h) => h.key === "thisWeek");
  check("the week offers no way to write a target into it",
    week.addLabel === null, String(week.addLabel));
  check("...but the month does", HORIZONS.find((h) => h.key === "oneMonth").addLabel !== null);
  check("...and today still takes an action typed straight in",
    HORIZONS.find((h) => h.key === "today").addLabel !== null);
}

/* --------------------------------------------- Rule B: three is a full day */

{
  check("the cap is three", DAILY_CAP === 3);

  const a = goal({ today: [sub("t1", "One"), sub("t2", "Two")] });
  const b = { ...goal({ today: [sub("t3", "Three")] }), id: "g2" };
  check("the day is counted across every goal", dayLoad([a, b]) === 3);
  check("...and three is full", atCapacity([a, b]) === true);
  check("two is not full", atCapacity([a]) === false);
}

{
  // A line on today counts once, however many parts it breaks into — counting
  // parts would put a careful plan over the cap and a vague one under it.
  const g = goal({
    thisWeek: [{ ...parent("w1", "Fix all the bugs",
      [sub("s1", "a"), sub("s2", "b"), sub("s3", "c")]), at: "today" }],
  });
  check("a line being worked on counts once, not once per part",
    picksOf(g).length === 1, String(dayLoad([g])));
  check("...so a well-broken-down plan is not punished", atCapacity([g]) === false);
  check("...and its parts are shown beneath it, not as separate picks",
    childrenHere(g.horizons.thisWeek[0], "today").length === 3);
}

{
  const g = goal({ today: [sub("t1", "One"), sub("t2", "Two", true)] });
  check("finished work does not hold a slot", dayLoad([g]) === 1);
  check("...and is what the wins drawer counts",
    titles(winsToday(g)).join() === "Two");
  check("...while the list is what is left", titles(openToday(g)).join() === "One");
}

/* --------------------------------------------- Rule A: one thing, or none */

{
  const a = goal({ today: [sub("t1", "One"), sub("t2", "Two")] });
  const b = { ...goal({ today: [sub("t3", "Three")] }), id: "g2" };

  check("nothing is primary until it is named", primaryOf([a, b]) === null);

  const named = setPrimary([a, b], "g", "t1");
  check("naming the day's one thing marks it", primaryOf(named).sub.title === "One");

  const moved = setPrimary(named, "g2", "t3");
  check("naming a second clears the first", primaryOf(moved).sub.title === "Three");
  check("...even in another goal", moved[0].horizons.today.every((s) => !s.primary));

  check("pressing the one that holds it takes it back",
    primaryOf(setPrimary(moved, "g2", "t3")) === null);
}

{
  // The flag reaches a line nested inside a target, not only a top-level one.
  const g = goal({
    oneMonth: [parent("m1", "Target", [{ ...sub("a1", "Action"), at: "today" }])],
  });
  const named = setPrimary([g], "g", "a1");
  check("a pushed action can be the day's one thing",
    primaryOf(named).sub.title === "Action");
  const after = complete(named[0], "oneMonth", ["m1", "a1"]);
  check("finishing it releases the flag", primaryOf([after]) === null);
}

/* ------------------------------------ Rule C: something you can honestly tick */

{
  const vague = [
    "Work on the UI", "working on onboarding", "Think about pricing",
    "Focus on the launch", "Look at the numbers", "Continue the redesign",
    "Keep going with tests", "Spend time on copy", "Try to write more",
    "Improve the dashboard", "Sort out the emails", "Deal with feedback",
    "Onboarding",
  ];
  const concrete = [
    "Wrap long task sentences in the daily plan",
    "Turn today's date green",
    "Publish the pricing page",
    "Reply to the three support emails",
    "Review the launch checklist",
  ];
  check("activity, not output, is flagged",
    vague.every(isVague), vague.filter((t) => !isVague(t)).join(" / "));
  check("a real deliverable is left alone",
    concrete.every((t) => !isVague(t)), concrete.filter(isVague).join(" / "));
  check("an empty line is not nagged about", isVague("") === false);
  check("the hint says what to do instead",
    /what will exist/i.test(VAGUE_HINT), VAGUE_HINT);
}

/* ------------------------------------------ nothing arrives on its own */

{
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard")],
    thisWeek: [],
    today: [sub("t1", "Change the card")],
  });
  const after = complete(g, "today", ["t1"]);
  check("clearing the day does not refill it", openToday(after).length === 0);
  check("...and the month's work stays in the month",
    titles(after.horizons.oneMonth).join() === "Admin dashboard");
}

/* ------------------------------------------------------- the turn of a day */

{
  const g = goal({ today: [sub("t1", "Unfinished"), sub("t2", "Finished", true)] },
    { lastReset: "2026-03-01" });
  const after = turnDay(g, "2026-03-02");
  check("unfinished work follows you into the new day",
    titles(openToday(after)).join() === "Unfinished");
  check("...and says so", openToday(after)[0].rolledOver === true);
  check("finished work moves into the record", titles(after.wins).join() === "Finished");
  check("...and off the working list", after.horizons.today.length === 1);
  check("the new day does not fill itself", openToday(after).length === 1);
}

{
  // A pushed action that was finished stops being scheduled and goes back to
  // sitting under its target, struck through — it is not deleted from the plan.
  const g = goal({
    oneMonth: [parent("m1", "Target",
      [{ ...sub("a1", "Done one", true), at: "today" },
       { ...sub("a2", "Still open"), at: "today" }])],
  }, { lastReset: "2026-03-01" });
  const after = turnDay(g, "2026-03-02");
  check("a finished pushed action leaves the day",
    shownAt(after, "today").map((p) => p.sub.title).join() === "Still open",
    JSON.stringify(shownAt(after, "today").map((p) => p.sub.title)));
  check("...but stays in its target's plan",
    findByPath(after, "oneMonth", ["m1", "a1"])?.title === "Done one");
  check("...and is counted as a win", titles(after.wins).join() === "Done one");
  check("the unfinished one is marked as carried",
    findByPath(after, "oneMonth", ["m1", "a2"]).rolledOver === true);
}

{
  const g = goal({ today: [sub("t1", "Written today")] });
  const after = turnDay(g, "2026-03-02");
  check("a goal's first day only stamps the date",
    after.lastReset === "2026-03-02" && after.horizons.today[0].rolledOver === undefined);
}

{
  const g = goal({ today: [sub("t1", "x", true)] }, { lastReset: "2026-03-02" });
  check("the same day twice does nothing", turnDay(g, "2026-03-02") === g);
}

{
  const g = goal({ today: [sub("t1", "Unfinished")] }, { lastReset: "2026-03-01" });
  const two = turnDay(turnDay(g, "2026-03-02"), "2026-03-03");
  check("a second night does not badge it twice",
    two.horizons.today.filter((s) => s.rolledOver).length === 1);
  check("...and does not archive what was never done", (two.wins ?? []).length === 0);
}

{
  const a = goal({ today: [sub("t1", "x", true)] }, { lastReset: "2026-03-01" });
  const b = { ...goal({}, { lastReset: "2026-03-02" }), id: "g2" };
  const after = turnAll([a, b], "2026-03-02");
  check("the whole board turns together", after[0] !== a && after[1] === b);
  check("...and an already-current board is left alone",
    turnAll(after, "2026-03-02") === after);
}

/* ----------------------------------------------------------- editing anywhere */

{
  const g = goal({ year: [parent("y1", "Top", [sub("a", "One"), sub("b", "Two")])] });

  const renamed = editByPath(g, "year", ["y1", "b"], (s) => ({ ...s, title: "Second" }));
  check("a nested line can be renamed",
    findByPath(renamed, "year", ["y1", "b"]).title === "Second");
  check("...without disturbing its sibling",
    findByPath(renamed, "year", ["y1", "a"]).title === "One");

  const gone = removeByPath(g, "year", ["y1", "a"]);
  check("a nested line can be removed",
    findByPath(gone, "year", ["y1", "a"]) === null);
  check("...leaving the rest of the target intact",
    gone.horizons.year[0].steps.length === 1);

  const top = removeByPath(g, "year", ["y1"]);
  check("...and so can a whole target", top.horizons.year.length === 0);

  check("a path that leads nowhere finds nothing",
    findByPath(g, "year", ["y1", "nope"]) === null);
}

{
  // Removing the last unfinished part settles the heading, which is the rule
  // that would otherwise leave a target open with nothing left to do in it.
  const g = goal({ year: [parent("y1", "Top", [sub("a", "One", true), sub("b", "Two")])] });
  const gone = removeByPath(g, "year", ["y1", "b"]);
  check("removing the last open part finishes the heading",
    gone.horizons.year[0].done === true);
}

{
  const s = settle({ ...parent("w1", "x", [sub("s1", "a", true)]), primary: true });
  check("finishing a line gives up the day's primary slot",
    s.done === true && s.primary === undefined);
  check("a line with no parts settles to itself",
    settle(sub("x", "y")).done === false);
}

{
  const g = goal({ thisWeek: [parent("w1", "Whole thing", [sub("s1", "a"), sub("s2", "b")])] });
  const after = complete(g, "thisWeek", ["w1"]);
  check("ticking a heading ticks its parts",
    after.horizons.thisWeek[0].steps.every((t) => t.done));
  check("...and unticking it reopens them",
    complete(after, "thisWeek", ["w1"]).horizons.thisWeek[0].steps.every((t) => !t.done));
}

{
  const g = goal({
    oneMonth: [parent("m1", "Target", [{ ...sub("a1", "Scheduled"), at: "thisWeek" }])],
  });
  const done = complete(g, "oneMonth", ["m1"]);
  check("finishing a target un-schedules its parts",
    shownAt(done, "thisWeek").length === 0,
    JSON.stringify(shownAt(done, "thisWeek").map((p) => p.sub.title)));
}

{
  const g = goal({ today: [sub("t1", "One"), sub("t2", "Two")] });
  check("today's work is what today is showing",
    todaysWork(g).map((p) => p.sub.title).join() === "One,Two");
}

console.log(bad === 0 ? "\nall good" : `\n${bad} failing`);
process.exit(bad === 0 ? 0 : 1);
