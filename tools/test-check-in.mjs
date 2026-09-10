// When Jelly may mention what was left, and when she may not.
//
// This is the one thing in Innerly that raises something that did not go well,
// unprompted, with somebody who did not ask for it. Almost every rule around
// it is a rule about staying quiet, so almost every check here is that nothing
// was said.
//
//   node tools/test-check-in.mjs
//
// No browser: the rules are plain functions.

const { CLOSES_AT, checkIn, closedDay, nameThem, shouldAsk } =
  await import("../src/lib/missed.ts");

let bad = 0;
const check = (n, ok, x) => { if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const at = (iso) => new Date(iso);

/* ------------------------------------------------ which day is being asked about */

{
  check("a day is not over at four in the afternoon",
    closedDay(at("2026-03-02T16:00")).when === "yesterday",
    JSON.stringify(closedDay(at("2026-03-02T16:00"))));
  check("...so the one before it is the one to ask about",
    closedDay(at("2026-03-02T16:00")).day === "2026-03-01");

  check("at eleven at night, today is a day you can look back on",
    closedDay(at("2026-03-02T23:00")).when === "today");
  check("...and it is today", closedDay(at("2026-03-02T23:00")).day === "2026-03-02");
  check("the hour it closes is eleven", CLOSES_AT === 23);

  check("just before eleven it is still today's afternoon",
    closedDay(at("2026-03-02T22:59")).when === "yesterday");

  // Local time throughout: a day boundary read off UTC asks somebody in
  // Auckland about their morning.
  const midnight = closedDay(at("2026-03-02T00:30"));
  check("half past midnight asks about the day that just ended",
    midnight.day === "2026-03-01" && midnight.when === "yesterday",
    JSON.stringify(midnight));
}

/* -------------------------------------------------------- when to stay quiet */

const day = { day: "2026-03-01", titles: ["Ship the export"], when: "yesterday" };

{
  check("something left, never asked, switch on → ask",
    shouldAsk({ missed: day, alreadyAsked: null, wanted: true }) === true);

  check("nothing was left → say nothing",
    shouldAsk({ missed: { ...day, titles: [] }, alreadyAsked: null, wanted: true })
      === false);
  check("no day to ask about → say nothing",
    shouldAsk({ missed: null, alreadyAsked: null, wanted: true }) === false);
  check("already asked about this day → say nothing",
    shouldAsk({ missed: day, alreadyAsked: "2026-03-01", wanted: true }) === false);
  check("switched off in settings → say nothing",
    shouldAsk({ missed: day, alreadyAsked: null, wanted: false }) === false);

  check("...but a different day is a different question",
    shouldAsk({ missed: day, alreadyAsked: "2026-02-28", wanted: true }) === true);
}

/* --------------------------------------------------- two names, then a count */

{
  check("one thing is named", nameThem(["Ship the export"]) === "\u201cShip the export\u201d",
    nameThem(["Ship the export"]));
  check("two are named",
    nameThem(["Ship the export", "Call the accountant"])
      === "\u201cShip the export\u201d and \u201cCall the accountant\u201d",
    nameThem(["Ship the export", "Call the accountant"]));
  // Somebody's own words, dropped into a sentence somebody else wrote. Left
  // unquoted, "Call the accountant" reads as a capital in the wrong place.
  check("...in their own words, quoted",
    nameThem(["Call the accountant"]).startsWith("\u201c"));
  check("three become two and a count",
    nameThem(["A", "B", "C"]) === "\u201cA\u201d and \u201cB\u201d, and 1 more", nameThem(["A", "B", "C"]));
  check("...and six do too",
    nameThem(["A", "B", "C", "D", "E", "F"]) === "\u201cA\u201d and \u201cB\u201d, and 4 more");

  // A full list of everything undone is a charge sheet, and nobody needs one
  // of those handed to them at eleven at night.
  const many = nameThem(["A", "B", "C", "D", "E", "F", "G", "H"]);
  check("no list is ever longer than two names",
    (many.match(/,/g) ?? []).length <= 1 && !many.includes("C"), many);

  check("blank lines are not counted", nameThem(["A", "  ", ""]) === "\u201cA\u201d");
}

/* -------------------------------------------------------------- what she says */

{
  const said = checkIn("Divya", day);
  check("she uses the name", said.greeting === "Hi Divya.", said.greeting);
  check("...and manages without one", checkIn(undefined, day).greeting === "Hi.");
  check("...and without a blank one", checkIn("   ", day).greeting === "Hi.");

  check("she says which day", /yesterday/.test(said.what), said.what);
  check("...and today when it is today",
    /today/.test(checkIn("Divya", { ...day, when: "today" }).what));
  check("she names the thing", /Ship the export/.test(said.what), said.what);
  check("she offers rather than instructs", /If you'd like/.test(said.offer));

  // The whole point. A message about a day that did not go to plan has to be
  // readable by somebody who has had one.
  const all = `${said.greeting} ${said.what} ${said.offer}`;
  const blame = [
    /you failed/i, /you didn't/i, /you did not/i, /you missed/i, /you should/i,
    /try harder/i, /streak/i, /don't give up/i, /no excuses/i, /again\b.*\?/i,
    /disappoint/i, /behind/i, /fall(ing)? short/i,
  ];
  check("nothing in it blames anybody",
    !blame.some((re) => re.test(all)), blame.find((re) => re.test(all))?.source);
  check("...and nothing in it is an exclamation", !all.includes("!"), all);
  check("it is short enough to read at eleven at night",
    all.length < 320, `${all.length} characters`);
}

console.log(bad === 0 ? "\nall good" : `\n${bad} failing`);
process.exit(bad === 0 ? 0 : 1);
