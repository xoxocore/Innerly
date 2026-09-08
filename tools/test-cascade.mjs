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

console.log(bad ? `\n${bad} failing` : "\nall good");
process.exit(bad ? 1 : 0);
