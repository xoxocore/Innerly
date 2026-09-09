// The goal engine, on its own.
//
// The rule this file exists to defend is a negative one: nothing reaches Today
// unless a person put it there. An earlier version of the engine promoted the
// next action the moment the last was ticked, and the failure mode was quiet —
// a year's thinking drains into one afternoon and nobody sees it happen. So the
// tests below check the absence of that as carefully as they check the presence
// of anything else, alongside the three rules that hold around the choice: one
// primary, three at most, and a title you can honestly tick.
//
//   node tools/test-cascade.mjs
//
// No browser: the rules are plain functions, and the point of them being plain
// functions is that they can be checked like this.

// Node strips the types itself, so the real module is the one under test —
// no transpiled copy that might differ from what the app actually runs.
const {
  DAILY_CAP, VAGUE_HINT,
  atCapacity, borrowedAt, completeStep, completeSub, dayLoad, editSteps, isOn,
  isVague, lentSubs, moveSub, nearer, openToday, picksOf, primaryOf, pullStep,
  pushStep, putBack, setPrimary, settle, stepAt, stepProgress, takeIntoToday,
  todaysWork, turnAll, turnDay, winsToday,
} = await import("../src/lib/cascade.ts");

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const sub = (id, title, done = false) => ({ id, title, done });
const stepped = (id, title, steps) => ({ id, title, done: false, steps });
const step = (id, title, done = false) => ({ id, title, done });
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

/* ------------------------------------ nothing arrives on its own any more */

{
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard")],
    thisWeek: [sub("w1", "Fix wording", true)],
    today: [sub("t1", "Change the card")],
  });
  const after = completeSub(g, "today", "t1");
  check("clearing the day does not refill it",
    openToday(after).length === 0, titles(openToday(after)).join(" / "));
  check("...and does not move the month's work either",
    titles(after.horizons.oneMonth).join() === "Admin dashboard",
    titles(after.horizons.oneMonth).join(" / "));
  check("...or the week's",
    after.horizons.thisWeek.length === 1);
}

{
  const g = goal({ year: [sub("y1", "100,000 users")] });
  check("a goal written only against next year stays there",
    openToday(g).length === 0 && g.horizons.year.length === 1);
}

{
  // The one that used to happen on its own, now asked for.
  const g = goal({ thisWeek: [sub("w1", "Fix the wording")] });
  const after = takeIntoToday(g, "thisWeek", "w1");
  check("taking something into today moves it",
    titles(openToday(after)).join() === "Fix the wording");
  check("...out of the tier it came from",
    after.horizons.thisWeek.length === 0);
  check("...tagged with where it came from",
    openToday(after)[0].promotedFrom === "thisWeek");
}

{
  const g = goal({ today: [sub("t1", "Already here")] });
  check("today cannot take from itself",
    takeIntoToday(g, "today", "t1") === g);
}

{
  const g = goal({ thisWeek: [sub("w1", "Done already", true)] });
  check("a finished sub-goal cannot be picked",
    takeIntoToday(g, "thisWeek", "w1") === g);
}

{
  const g = goal({ oneMonth: [sub("m1", "Ship the report")] });
  const after = takeIntoToday(g, "oneMonth", "m1");
  check("anything can be picked, not only the week",
    titles(openToday(after)).join() === "Ship the report");
  check("...and says it came from the month",
    openToday(after)[0].promotedFrom === "oneMonth");
}

/* ------------------------------------------- a stepped goal lends, not moves */

{
  const g = goal({
    thisWeek: [stepped("w1", "Fix all the bugs", [
      step("s1", "Wrap long sentences"),
      step("s2", "Green today's date"),
    ])],
  });
  const after = takeIntoToday(g, "thisWeek", "w1");
  check("a target with actions stays in its own tier",
    after.horizons.thisWeek.length === 1 && after.horizons.today.length === 0);
  check("...with its actions scheduled onto today",
    isOn(after.horizons.thisWeek[0], "today") === true);
  check("...and its open actions are what today shows",
    todaysWork(after).map((w) => w.sub.title).join(" / ")
      === "Wrap long sentences / Green today's date");
  check("...each carrying the target it belongs to",
    todaysWork(after).every((w) => w.parent?.title === "Fix all the bugs"));
  check("picking it twice changes nothing",
    takeIntoToday(after, "thisWeek", "w1") === after);

  const one = completeStep(after, "thisWeek", "w1", "s1");
  check("ticking an action leaves the target open",
    one.horizons.thisWeek[0].done === false,
    `${stepProgress(one.horizons.thisWeek[0]).done}/2`);
  check("...and still on today",
    isOn(one.horizons.thisWeek[0], "today") === true);
  check("...with only what is left showing on today",
    todaysWork(one).map((w) => w.sub.title).join() === "Green today's date");

  const both = completeStep(one, "thisWeek", "w1", "s2");
  check("ticking the last action finishes the target",
    both.horizons.thisWeek[0].done === true);
  check("...where it was written all along",
    both.horizons.thisWeek.length === 1 && both.horizons.today.length === 0);
  check("...and it stops asking anything of today",
    todaysWork(both).length === 0 && borrowedAt(both, "today").length === 0);
  check("...and nothing takes its place",
    both.horizons.oneMonth.length === 0 && openToday(both).length === 0);
}

/* ----------------------------- one action at a time, into any nearer tier */

{
  // The shape from the screenshot: two targets in the month, one broken into
  // three actions. The month is the plan; the week is what is being worked on.
  const g = goal({
    oneMonth: [
      stepped("m1", "Finalise user interface", [
        step("a1", "Notifications + stickers"),
        step("a2", "Final features"),
        step("a3", "Final app tour"),
      ]),
      sub("m2", "Finalise admin interface"),
    ],
  });

  const one = pushStep(g, "oneMonth", "m1", "a1");
  check("an action can be pushed a tier closer on its own",
    borrowedAt(one, "thisWeek").map((b) => b.step.title).join()
      === "Notifications + stickers",
    JSON.stringify(borrowedAt(one, "thisWeek").map((b) => b.step.title)));
  check("...tagged with the target it serves",
    borrowedAt(one, "thisWeek")[0].parent.title === "Finalise user interface");
  check("...which says where that target is written",
    borrowedAt(one, "thisWeek")[0].parentHorizon === "oneMonth");
  check("...while the target itself has not moved",
    one.horizons.oneMonth.length === 2 && one.horizons.thisWeek.length === 0,
    JSON.stringify(titles(one.horizons.oneMonth)));
  check("...and the other target is untouched",
    one.horizons.oneMonth[1].title === "Finalise admin interface");
  check("...and its siblings stayed behind",
    borrowedAt(one, "thisWeek").length === 1);

  const two = pushStep(one, "oneMonth", "m1", "a2");
  check("a second action can follow it",
    borrowedAt(two, "thisWeek").length === 2,
    JSON.stringify(borrowedAt(two, "thisWeek").map((b) => b.step.title)));
  check("...leaving the third where it was",
    stepAt(two.horizons.oneMonth[0].steps[2], "oneMonth") === "oneMonth");

  // Ticking it in the week is ticking it in the target: same object, one count.
  const ticked = completeStep(two, "oneMonth", "m1", "a1");
  check("ticking a pushed action moves the target's own count",
    stepProgress(ticked.horizons.oneMonth[0]).done === 1,
    `${stepProgress(ticked.horizons.oneMonth[0]).done}/3`);
  check("...and it leaves the week's list",
    borrowedAt(ticked, "thisWeek").length === 1);

  // Pushing again carries it the rest of the way down.
  const nearerStill = pushStep(two, "oneMonth", "m1", "a1");
  check("pushing again takes it to today",
    borrowedAt(nearerStill, "today").map((b) => b.step.title).join()
      === "Notifications + stickers");
  check("...and off the week", borrowedAt(nearerStill, "thisWeek").length === 1);
  check("today counts it as one thing", dayLoad([nearerStill]) === 1);

  const home = pullStep(nearerStill, "oneMonth", "m1", "a1");
  check("an action can be sent home again",
    borrowedAt(home, "today").length === 0 && borrowedAt(home, "thisWeek").length === 1);
  check("...back under its target",
    stepAt(home.horizons.oneMonth[0].steps[0], "oneMonth") === "oneMonth");
  check("sending home something already home does nothing",
    pullStep(home, "oneMonth", "m1", "a1") === home);

  check("the target is listed as lending",
    lentSubs(two).map((x) => x.sub.title).join() === "Finalise user interface");
}

{
  const g = goal({ today: [stepped("t1", "Here already", [step("s1", "a")])] });
  check("nothing can be pushed past today",
    nearer("today") === null && pushStep(g, "today", "t1", "s1") === g);
  check("the tier below the month is the week", nearer("oneMonth") === "thisWeek");
  check("...and below the week is today", nearer("thisWeek") === "today");
}

{
  const g = goal({ oneMonth: [stepped("m1", "x", [step("s1", "a", true)])] });
  check("a finished action is not pushed anywhere",
    pushStep(g, "oneMonth", "m1", "s1") === g);
}

{
  // Ticking the target by hand un-schedules its actions: a finished line is
  // not still asking something of next week.
  const g = pushStep(
    goal({ oneMonth: [stepped("m1", "x", [step("s1", "a"), step("s2", "b")])] }),
    "oneMonth", "m1", "s1");
  const done = completeSub(g, "oneMonth", "m1");
  check("finishing a target clears where its actions were scheduled",
    borrowedAt(done, "thisWeek").length === 0,
    JSON.stringify(borrowedAt(done, "thisWeek").map((b) => b.step.title)));
  check("...and a finished target lends nothing", lentSubs(done).length === 0);
}

{
  // Reopening an action reopens the target above it.
  const g = goal({
    thisWeek: [{ ...stepped("w1", "Fix all the bugs", [step("s1", "One", true)]),
      done: true }],
  });
  const after = completeStep(g, "thisWeek", "w1", "s1");
  check("reopening the last step reopens its heading",
    after.horizons.thisWeek[0].done === false);
}

{
  const s = settle({ ...stepped("w1", "x", [step("s1", "a", true)]), primary: true });
  check("finishing a target gives up the day's primary slot",
    s.done === true && s.primary === undefined);
}

/* ---------------------------------------------------------- putting it back */

{
  const g = takeIntoToday(
    goal({ thisWeek: [sub("w1", "Fix the wording")] }), "thisWeek", "w1");
  const back = putBack(g, "today", "w1");
  check("something taken down can go home",
    titles(back.horizons.thisWeek).join() === "Fix the wording");
  check("...leaving today empty",
    back.horizons.today.length === 0);
  check("...and losing the tag on the way",
    back.horizons.thisWeek[0].promotedFrom === undefined);
}

{
  const g = takeIntoToday(
    goal({ thisWeek: [stepped("w1", "Fix all the bugs", [step("s1", "One")])] }),
    "thisWeek", "w1");
  const back = putBack(g, "thisWeek", "w1");
  check("a lending target can stop lending",
    isOn(back.horizons.thisWeek[0], "today") === false);
  check("...and today asks nothing again",
    todaysWork(back).length === 0);
  check("...without the goal itself moving",
    back.horizons.thisWeek.length === 1);
}

{
  const g = goal({ today: [sub("t1", "Written straight onto today")] });
  check("something written on today has nowhere to go back to",
    putBack(g, "today", "t1") === g);
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
  // A goal being worked on counts once, however many steps it breaks into —
  // counting the steps would put a careful plan over the cap and a vague one
  // under it, which is exactly backwards.
  const g = takeIntoToday(
    goal({ thisWeek: [stepped("w1", "Fix all the bugs",
      [step("s1", "a"), step("s2", "b"), step("s3", "c"), step("s4", "d")])] }),
    "thisWeek", "w1");
  check("a target being worked on counts once, not once per action",
    picksOf(g).length === 1, String(dayLoad([g])));
  check("...so a well-broken-down goal is not punished",
    atCapacity([g]) === false);
  check("...though today really does show four things to do",
    todaysWork(g).length === 4);
}

{
  const g = goal({ today: [sub("t1", "One"), sub("t2", "Two", true)] });
  check("finished work does not hold a slot", dayLoad([g]) === 1);
}

/* --------------------------------------------- Rule A: one thing, or none */

{
  const a = goal({ today: [sub("t1", "One"), sub("t2", "Two")] });
  const b = { ...goal({ today: [sub("t3", "Three")] }), id: "g2" };

  check("nothing is primary until it is named", primaryOf([a, b]) === null);

  const named = setPrimary([a, b], "g", "t1");
  check("naming the day's one thing marks it",
    primaryOf(named).sub.title === "One");

  const moved = setPrimary(named, "g2", "t3");
  check("naming a second clears the first",
    primaryOf(moved).sub.title === "Three");
  check("...even in another goal",
    moved[0].horizons.today.every((s) => !s.primary));

  const off = setPrimary(moved, "g2", "t3");
  check("pressing the one that holds it takes it back",
    primaryOf(off) === null);
}

{
  // The flag on a lending goal lives on the goal, in its own tier.
  const g = takeIntoToday(
    goal({ thisWeek: [stepped("w1", "Fix all the bugs", [step("s1", "a")])] }),
    "thisWeek", "w1");
  const named = setPrimary([g], "g", "w1");
  check("a goal lending its steps can be the day's one thing",
    primaryOf(named).sub.title === "Fix all the bugs");
}

{
  const g = goal({ today: [{ ...sub("t1", "One"), primary: true }] });
  const after = completeSub(g, "today", "t1");
  check("finishing the primary releases the flag",
    primaryOf([after]) === null);
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
    concrete.every((t) => !isVague(t)),
    concrete.filter(isVague).join(" / "));
  check("an empty line is not nagged about", isVague("") === false);
  check("the hint says what to do instead",
    /what will exist/i.test(VAGUE_HINT), VAGUE_HINT);
}

/* ------------------------------------------------------- the turn of a day */

{
  const g = goal({ today: [sub("t1", "Unfinished"), sub("t2", "Finished", true)] },
    { lastReset: "2026-03-01" });
  const after = turnDay(g, "2026-03-02");
  check("unfinished work follows you into the new day",
    titles(openToday(after)).join() === "Unfinished");
  check("...and says so",
    openToday(after)[0].rolledOver === true);
  check("finished work moves into the record",
    titles(after.wins).join() === "Finished");
  check("...and off the working list",
    after.horizons.today.length === 1);
  check("the new day does not fill itself",
    openToday(after).length === 1 && after.horizons.thisWeek.length === 0);
}

{
  const g = goal({ oneMonth: [sub("m1", "Next thing")],
    today: [sub("t1", "Finished", true)] }, { lastReset: "2026-03-01" });
  const after = turnDay(g, "2026-03-02");
  check("a day finished to the last item still wakes up empty",
    openToday(after).length === 0, titles(openToday(after)).join(" / "));
  check("...with the month untouched, waiting to be chosen from",
    titles(after.horizons.oneMonth).join() === "Next thing");
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
  check("...and does not archive what was never done",
    (two.wins ?? []).length === 0);
}

{
  const a = goal({ today: [sub("t1", "x", true)] }, { lastReset: "2026-03-01" });
  const b = { ...goal({}, { lastReset: "2026-03-02" }), id: "g2" };
  const after = turnAll([a, b], "2026-03-02");
  check("the whole board turns together", after[0] !== a && after[1] === b);
  check("...and an already-current board is left alone",
    turnAll(after, "2026-03-02") === after);
}

/* ------------------------------------------------------ moving by hand */

{
  const g = goal({ oneMonth: [sub("m1", "Ship it")] });
  const after = moveSub(g, "oneMonth", "thisWeek", "m1");
  check("re-planning moves a line between tiers",
    titles(after.horizons.thisWeek).join() === "Ship it");
  check("...and it is not tagged as taken down",
    after.horizons.thisWeek[0].promotedFrom === undefined);
  check("moving somewhere it already is does nothing",
    moveSub(g, "oneMonth", "oneMonth", "m1") === g);
}

{
  // Moving to today is picking, so the stepped case has to behave the same way
  // whichever door it comes through.
  const g = goal({ thisWeek: [stepped("w1", "Fix all the bugs", [step("s1", "a")])] });
  const after = moveSub(g, "thisWeek", "today", "w1");
  check("moving a target with actions to today lends them instead",
    isOn(after.horizons.thisWeek[0], "today") && after.horizons.today.length === 0);
}

/* ----------------------------------------------------------- the small stuff */

{
  const g = goal({ today: [sub("t1", "Done", true), sub("t2", "Not done")] });
  check("today's wins are what was ticked", titles(winsToday(g)).join() === "Done");
  check("...and the list is what is left", titles(openToday(g)).join() === "Not done");
}

{
  const g = goal({ thisWeek: [sub("w1", "No steps")] });
  check("a sub-goal with no steps has no progress",
    stepProgress(g.horizons.thisWeek[0]) === null);

  const one = editSteps(g, "thisWeek", "w1", (steps) => [...steps, step("s1", "a")]);
  check("adding the first step gives it a count",
    stepProgress(one.horizons.thisWeek[0]).total === 1);

  const gone = editSteps(one, "thisWeek", "w1", () => []);
  check("removing the last step gives the tick back",
    stepProgress(gone.horizons.thisWeek[0]) === null);
}

{
  // Ticking a heading by hand means its parts are done too, or a finished line
  // would sit above unfinished work.
  const g = goal({ thisWeek: [stepped("w1", "Whole thing",
    [step("s1", "a"), step("s2", "b")])] });
  const after = completeSub(g, "thisWeek", "w1");
  check("ticking a heading ticks its parts",
    after.horizons.thisWeek[0].steps.every((t) => t.done));
  const back = completeSub(after, "thisWeek", "w1");
  check("...and unticking it reopens them",
    back.horizons.thisWeek[0].steps.every((t) => !t.done));
}

console.log(bad === 0 ? "\nall good" : `\n${bad} failing`);
process.exit(bad === 0 ? 0 : 1);
