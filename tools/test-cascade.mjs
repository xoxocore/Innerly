// The goal cascade and the turn of the day, on their own.
//
// These two rules move somebody's plan around without being asked to, so they
// are the part of the engine that most needs to be right: a waterfall that
// fires when it shouldn't quietly empties a year's thinking into this
// afternoon, and a day turn that runs twice archives work that was never done.
//
//   node tools/test-cascade.mjs
//
// No browser: the rules are plain functions, and the point of them being plain
// functions is that they can be checked like this.

// Node strips the types itself, so the real module is the one under test —
// no transpiled copy that might differ from what the app actually runs.
const { cascade, completeSub, completeStep, editSteps, stepProgress,
  todaysWork,
  turnDay, turnAll, moveSub, winsToday, openToday } =
  await import("../src/lib/cascade.ts");

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const sub = (id, title, done = false) => ({ id, title, done });
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

/* ------------------------------------------------------------ the waterfall */

{
  const g = goal({ year: [sub("y1", "100,000 users")] });
  const after = cascade(g);
  check("a goal written only against next year is left alone",
    after === g, JSON.stringify(titles(after.horizons.today)));
}

{
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard"), sub("m2", "Rollover logic")],
    thisWeek: [sub("w1", "Fix wording", true)],
  });
  const after = cascade(g);
  check("finishing the week's work pulls the month's next action down",
    titles(after.horizons.thisWeek).includes("Admin dashboard"),
    titles(after.horizons.thisWeek).join(" / "));
  check("...and it leaves the tier it came from",
    !titles(after.horizons.oneMonth).includes("Admin dashboard"),
    titles(after.horizons.oneMonth).join(" / "));
  check("...taking only the top of the queue",
    titles(after.horizons.oneMonth).join() === "Rollover logic",
    titles(after.horizons.oneMonth).join(" / "));
  check("...marked as having been dropped down",
    after.horizons.thisWeek.find((s) => s.id === "m1").promotedFrom === "oneMonth");
}

{
  // Today and This Week both clear: one pass should carry the month's action
  // the whole way, which is what makes it a waterfall rather than a step.
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard")],
    thisWeek: [sub("w1", "Fix wording", true)],
    today: [sub("t1", "Change the card", true)],
  });
  const after = cascade(g);
  check("a cleared week and day carry the month's action all the way down",
    titles(after.horizons.today).includes("Admin dashboard"),
    titles(after.horizons.today).join(" / "));
}

{
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard")],
    thisWeek: [sub("w1", "Fix wording")],
  });
  check("nothing moves while there is still work in the lower tier",
    cascade(g) === g);
}

{
  const g = goal({
    oneMonth: [sub("m1", "Done already", true)],
    thisWeek: [sub("w1", "Fix wording", true)],
  });
  check("a tier of finished work has nothing left to give",
    cascade(g) === g);
}

/* ----------------------------------------------------------- ticking a thing */

{
  const g = goal({
    oneMonth: [sub("m1", "Admin dashboard")],
    thisWeek: [sub("w1", "Fix wording")],
  });
  const after = completeSub(g, "thisWeek", "w1");
  check("ticking the last of a tier sets the cascade off",
    titles(after.horizons.thisWeek).includes("Admin dashboard"),
    titles(after.horizons.thisWeek).join(" / "));
  check("...and the tick is dated", !!after.horizons.thisWeek.find((s) => s.id === "w1").completedAt);

  const back = completeSub(after, "thisWeek", "w1");
  check("un-ticking clears the date again",
    back.horizons.thisWeek.find((s) => s.id === "w1").completedAt === undefined);
}

/* -------------------------------------------------------------- the day turn */

{
  const fresh = goal({ today: [sub("t1", "Something", false)] });
  const first = turnDay(fresh, "2026-09-08");
  check("a goal's first day turn only notes the date",
    first.lastReset === "2026-09-08" &&
      first.horizons.today[0].rolledOver === undefined,
    "nothing written twenty minutes ago is marked as carried over");
}

{
  const g = goal(
    { today: [sub("t1", "Unfinished"), sub("t2", "Finished", true)] },
    { lastReset: "2026-09-07" }
  );
  const after = turnDay(g, "2026-09-08");
  check("what was not finished comes into the new day",
    titles(after.horizons.today).join() === "Unfinished",
    titles(after.horizons.today).join(" / "));
  check("...wearing the badge that says so",
    after.horizons.today[0].rolledOver === true);
  check("what was finished goes to the wins",
    titles(after.wins ?? []).join() === "Finished",
    titles(after.wins ?? []).join(" / "));
  check("...and is not left on the working list",
    !titles(after.horizons.today).includes("Finished"));
  check("the day is stamped", after.lastReset === "2026-09-08");

  const again = turnDay(after, "2026-09-08");
  check("turning the same day twice changes nothing", again === after);

  const third = turnDay(after, "2026-09-09");
  check("a second night does not double-badge what was already carried",
    third.horizons.today[0].rolledOver === true &&
      (third.wins ?? []).length === 1,
    `${(third.wins ?? []).length} wins`);
}

{
  // Clearing the day and sleeping on it should leave tomorrow with the next
  // thing already waiting, rather than an empty board.
  const g = goal(
    {
      thisWeek: [sub("w1", "Next week thing")],
      today: [sub("t1", "All done", true)],
    },
    { lastReset: "2026-09-07" }
  );
  const after = turnDay(g, "2026-09-08");
  check("a day finished clean wakes up with the next action waiting",
    titles(after.horizons.today).join() === "Next week thing",
    titles(after.horizons.today).join(" / "));
}

{
  const days = turnAll(
    [goal({ today: [sub("a", "One")] }, { lastReset: "2026-09-07" })],
    "2026-09-08"
  );
  check("the whole board turns together", days[0].lastReset === "2026-09-08");
  const same = [goal({}, { lastReset: "2026-09-08" })];
  check("...and a board already up to date is left untouched",
    turnAll(same, "2026-09-08") === same);
}

/* --------------------------------------------------------- moving one by hand */

{
  const g = goal({ oneMonth: [sub("m1", "Admin dashboard")] });
  const after = moveSub(g, "oneMonth", "today", "m1");
  check("a sub-action can be dragged down by hand",
    titles(after.horizons.today).join() === "Admin dashboard" &&
      after.horizons.oneMonth.length === 0);
  check("...and is no longer marked as something the cascade did",
    after.horizons.today[0].promotedFrom === undefined);
  check("moving to where it already is does nothing",
    moveSub(g, "oneMonth", "oneMonth", "m1") === g);
  check("moving something that is not there does nothing",
    moveSub(g, "oneMonth", "today", "nope") === g);
}

/* ------------------------------------------------------------- the day's list */

{
  const g = goal({ today: [sub("a", "Open"), sub("b", "Won", true)] });
  check("the day shows what is left", titles(openToday(g)).join() === "Open");
  check("...and counts what was won", titles(winsToday(g)).join() === "Won");
}

/* -------------------------------------------------------------- steps */

const step = (id, title, done = false) => ({ id, title, done });

{
  const g = goal({
    thisWeek: [{ ...sub("w1", "Change the wording"), steps: [
      step("p1", "Home page"), step("p2", "Daily plan page"),
    ] }],
  });

  const one = completeStep(g, "thisWeek", "w1", "p1");
  check("ticking one step leaves the heading open",
    one.horizons.thisWeek[0].done === false,
    JSON.stringify(stepProgress(one.horizons.thisWeek[0])));

  const both = completeStep(one, "thisWeek", "w1", "p2");
  check("ticking the last step finishes the heading",
    both.horizons.thisWeek[0].done === true);
  check("...and dates it", !!both.horizons.thisWeek[0].completedAt);

  const reopened = completeStep(both, "thisWeek", "w1", "p2");
  check("reopening a step reopens the heading",
    reopened.horizons.thisWeek[0].done === false);
  check("...and clears its date",
    reopened.horizons.thisWeek[0].completedAt === undefined);
}

{
  const g = goal({
    thisWeek: [{ ...sub("w1", "Change the wording"), steps: [
      step("p1", "Home page"), step("p2", "Daily plan page"),
    ] }],
  });
  const ticked = completeSub(g, "thisWeek", "w1");
  check("ticking the heading ticks everything under it",
    ticked.horizons.thisWeek[0].steps.every((t) => t.done));
  const back = completeSub(ticked, "thisWeek", "w1");
  check("...and unticking it reopens them all",
    back.horizons.thisWeek[0].steps.every((t) => !t.done));
}

{
  const g = goal({
    oneMonth: [sub("m1", "Next thing")],
    thisWeek: [{ ...sub("w1", "Change the wording"), steps: [step("p1", "Home page")] }],
  });
  const after = completeStep(g, "thisWeek", "w1", "p1");
  check("finishing a heading through its steps still sets the cascade off",
    titles(after.horizons.thisWeek).includes("Next thing"),
    titles(after.horizons.thisWeek).join(" / "));
}

{
  const g = goal({ thisWeek: [sub("w1", "One clear thing")] });
  check("a sub-goal with no steps reports no progress",
    stepProgress(g.horizons.thisWeek[0]) === null);
  check("...and is still ticked by hand",
    completeSub(g, "thisWeek", "w1").horizons.thisWeek[0].done === true);
}

{
  const withSteps = goal({
    thisWeek: [{ ...sub("w1", "Change the wording"), steps: [step("p1", "Home")] }],
  });
  const added = editSteps(withSteps, "thisWeek", "w1", (steps) => [
    ...steps, step("p2", "Daily plan"),
  ]);
  check("a step can be added", stepProgress(added.horizons.thisWeek[0]).total === 2);

  const finished = completeStep(completeStep(added, "thisWeek", "w1", "p1"),
    "thisWeek", "w1", "p2");
  check("...and the heading follows the new count",
    finished.horizons.thisWeek[0].done === true);

  // Removing the last unfinished step should finish the heading, not strand it.
  const two = editSteps(withSteps, "thisWeek", "w1", (steps) => [
    ...steps, step("p2", "Daily plan"),
  ]);
  const oneDone = completeStep(two, "thisWeek", "w1", "p1");
  const pruned = editSteps(oneDone, "thisWeek", "w1", (steps) =>
    steps.filter((t) => t.id !== "p2")
  );
  check("removing the last unfinished step finishes the heading",
    pruned.horizons.thisWeek[0].done === true,
    JSON.stringify(stepProgress(pruned.horizons.thisWeek[0])));

  const emptied = editSteps(oneDone, "thisWeek", "w1", () => []);
  check("taking every step away hands the tick back",
    emptied.horizons.thisWeek[0].done === false &&
      stepProgress(emptied.horizons.thisWeek[0]) === null);
}

/* ------------------------------- a weekly goal lends its steps and stays put */

{
  const g = goal({
    thisWeek: [{ ...sub("w1", "Fix all the bugs"), steps: [
      step("p1", "Emoji access"), step("p2", "Green date"),
    ] }],
    today: [sub("t1", "Yesterday's leftover", true)],
  });
  const after = cascade(g);

  check("the weekly goal stays in the week",
    titles(after.horizons.thisWeek).join() === "Fix all the bugs",
    titles(after.horizons.thisWeek).join(" / "));
  check("...and is not copied into today",
    !titles(after.horizons.today).includes("Fix all the bugs"),
    titles(after.horizons.today).join(" / "));
  check("...but is marked as the thing being worked on",
    after.horizons.thisWeek[0].active === true);

  const work = todaysWork(after).filter((w) => w.parent);
  check("its steps are what today actually asks for",
    work.map((w) => w.sub.title).join() === "Emoji access,Green date",
    work.map((w) => w.sub.title).join(" / "));
  check("...each naming the goal it belongs to",
    work.every((w) => w.parent.title === "Fix all the bugs"));

  // Nothing else should drop while its steps are still outstanding.
  const held = goal({
    oneMonth: [sub("m1", "Something later")],
    thisWeek: [{ ...sub("w1", "Fix all the bugs"), steps: [step("p1", "One")], active: true }],
  });
  check("today is not refilled while borrowed steps are open",
    cascade(held) === held);
}

{
  const g = goal({
    thisWeek: [{ ...sub("w1", "Fix all the bugs"), steps: [
      step("p1", "Emoji access"), step("p2", "Green date"),
    ], active: true }],
  });

  const one = completeStep(g, "thisWeek", "w1", "p1");
  check("ticking one borrowed step leaves the weekly goal open",
    one.horizons.thisWeek[0].done === false &&
      one.horizons.thisWeek[0].active === true);
  check("...and it still shows in the week",
    titles(one.horizons.thisWeek).join() === "Fix all the bugs");

  const both = completeStep(one, "thisWeek", "w1", "p2");
  check("ticking the last one strikes the weekly goal through",
    both.horizons.thisWeek[0].done === true);
  check("...and it stops asking anything of today",
    both.horizons.thisWeek[0].active === undefined &&
      todaysWork(both).length === 0,
    JSON.stringify(todaysWork(both).map((w) => w.sub.title)));
  check("...while staying visible in the week it was written in",
    titles(both.horizons.thisWeek).join() === "Fix all the bugs");
}

{
  // A single action with no steps still moves, exactly as it used to.
  const g = goal({
    thisWeek: [sub("w1", "One clear action")],
    today: [sub("t1", "Done", true)],
  });
  const after = cascade(g);
  check("a sub-goal with no steps still comes down to today",
    titles(after.horizons.today).includes("One clear action"),
    titles(after.horizons.today).join(" / "));
  check("...and leaves the week", after.horizons.thisWeek.length === 0);
}

{
  // Finishing the week's goal should hand the turn to the next one, rather
  // than leaving an empty day and a queue that never starts.
  const g = goal({
    thisWeek: [
      { ...sub("w1", "Fix all the bugs"), steps: [step("p1", "One")], active: true },
      { ...sub("w2", "Write the copy"), steps: [step("p2", "Home page")] },
    ],
  });
  const after = completeStep(g, "thisWeek", "w1", "p1");
  check("the next weekly goal takes its turn once the first is done",
    after.horizons.thisWeek[1].active === true,
    JSON.stringify(after.horizons.thisWeek.map((x) => [x.title, x.done, x.active])));
  check("...and the finished one is struck through, not removed",
    after.horizons.thisWeek[0].done === true &&
      titles(after.horizons.thisWeek).length === 2);

  // Reopening it makes it an open weekly goal again, but does not take the
  // turn back from the one that has already started.
  const undone = completeStep(after, "thisWeek", "w1", "p1");
  check("reopening it makes it open again",
    undone.horizons.thisWeek[0].done === false);
  check("...without snatching the turn back from the one now under way",
    undone.horizons.thisWeek[1].active === true &&
      undone.horizons.thisWeek[0].active !== true,
    JSON.stringify(undone.horizons.thisWeek.map((x) => [x.title, x.active])));
}

console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
