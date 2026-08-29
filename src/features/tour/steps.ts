import type { View } from "@/state/app-context";

export type TourStep = {
  /** Matches a data-tour attribute in the app. Absent = a centred card. */
  anchor?: string;
  /** Move to this screen before showing the step. */
  view?: View;
  title: string;
  body: string;
};

/**
 * The tour. Five stops, because a walkthrough somebody abandons halfway
 * teaches less than a short one they finish.
 *
 * Each stop names what the thing is FOR rather than what it is called — the
 * label is already on screen, so repeating it teaches nothing.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Innerly",
    body: "A quick look around — about thirty seconds. You can skip it, and start it again any time from Settings.",
  },
  {
    anchor: "nav-reflect",
    view: "reflect",
    title: "Reflect",
    body: "Somewhere to put the day down. Write a moment, why it landed the way it did, and what you'd do differently. Nobody else can read it.",
  },
  {
    anchor: "nav-daily-plan",
    view: "daily-plan",
    title: "Daily Plan",
    body: "A calendar and a short list for today. Anything you add to a day shows up on your home screen when that day comes.",
  },
  {
    anchor: "nav-vision-board",
    view: "vision-board",
    title: "Vision Board",
    body: "Pictures of what you're working toward, kept by year. Add photos, write why each one matters.",
  },
  {
    anchor: "streak",
    view: "dashboard",
    title: "Your streak",
    body: "Counts the days you've opened Innerly. Missing a day isn't a failure — it's just a day.",
  },
];
