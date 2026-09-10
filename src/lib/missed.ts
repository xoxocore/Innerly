/**
 * The evening check-in: what was left, and whether to say anything about it.
 *
 * This is the one place in Innerly that brings up something that did not go
 * well, unprompted, to somebody who did not ask. That is worth being careful
 * about, so most of what is written here is about when to stay quiet.
 *
 * The rules:
 *
 *   Once. One day is asked about once, and answering either way — or ignoring
 *   it — settles it for good. There is no second attempt and no "are you sure".
 *
 *   Only about a day that is over. A list with things still on it at four in
 *   the afternoon is not a failure, it is an afternoon. So the day has to have
 *   closed: past eleven at night, or already yesterday.
 *
 *   Only if there was a plan. A day nobody wrote anything for cannot have gone
 *   badly, and telling someone they missed nothing is worse than saying
 *   nothing at all.
 *
 *   Never a scoreboard. Two things are named and the rest is "and one more" —
 *   a full list of everything undone is a charge sheet, and nobody needs to be
 *   handed one of those at eleven at night.
 *
 * The wording carries the same weight. It says what is true, offers, and
 * stops: no "you failed to", no streak lost, no encouragement to try harder
 * tomorrow. The offer is to look at what got in the way, because that is
 * sometimes worth knowing — and if the answer is no, that is a whole answer.
 */

/** After this hour, today counts as a day you can look back on. */
export const CLOSES_AT = 23;

/** How many are named before the rest becomes a count. */
const NAMED = 2;

export type Missed = {
  /** The day being asked about, as YYYY-MM-DD. */
  day: string;
  /** Everything left on it, in the order it was written. */
  titles: string[];
  /** Whether that day is today (late) or the one before. */
  when: "today" | "yesterday";
};

const key = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/**
 * The day worth asking about, or null while today is still going.
 *
 * Local time throughout: eleven at night is eleven where the person is, and a
 * day boundary read off UTC would ask somebody in Auckland about their morning.
 */
export function closedDay(now = new Date()): { day: string; when: "today" | "yesterday" } | null {
  if (now.getHours() >= CLOSES_AT) return { day: key(now), when: "today" };
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  return { day: key(before), when: "yesterday" };
}

/** Whether there is anything to say, given what was left and what was asked. */
export function shouldAsk({
  missed,
  alreadyAsked,
  wanted,
}: {
  missed: Missed | null;
  /** The last day already asked about, whatever the answer was. */
  alreadyAsked: string | null;
  /** Off in Settings means off. */
  wanted: boolean;
}): boolean {
  if (!wanted) return false;
  if (!missed) return false;
  if (missed.titles.length === 0) return false;
  if (alreadyAsked === missed.day) return false;
  return true;
}

/**
 * "“Ship the export” and “Write the launch post”", or "… and 2 more".
 *
 * Quoted, because these are somebody's own words dropped into the middle of a
 * sentence somebody else wrote. Unquoted, a task written as "Call the
 * accountant" reads as a capital letter in the wrong place — and lowercasing
 * it to fix that would be editing what they wrote.
 */
export function nameThem(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean);
  const shown = clean.slice(0, NAMED).map((t) => `\u201c${t}\u201d`);
  const rest = clean.length - shown.length;

  const list =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;

  if (rest === 0) return list;
  return `${list}, and ${rest} more`;
}

/**
 * What Jelly says.
 *
 * Written to be read once, at night, by somebody who has had a day. It names
 * what is true, offers one thing, and stops.
 */
export function checkIn(name: string | undefined, missed: Missed): {
  greeting: string;
  what: string;
  offer: string;
} {
  const who = name?.trim() ? `Hi ${name.trim()}.` : "Hi.";
  const day = missed.when === "today" ? "today" : "yesterday";
  const one = missed.titles.length === 1;

  return {
    greeting: who,
    what: `${nameThem(missed.titles)} ${one ? "stayed" : "stayed"} on your list ${day}.`,
    offer:
      "That happens more than anyone admits. If you'd like, we could look at " +
      "what got in the way — there's often something worth knowing in it.",
  };
}
