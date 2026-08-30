"use client";

import { useState } from "react";
import { Check, Compass, Download, LogOut, Smartphone } from "lucide-react";
import { copy } from "@/lib/copy";
import { KEYS, usePersistentState } from "@/lib/storage";
import { DEFAULT_PREFS, type Prefs } from "@/lib/types";
import { downloadExport } from "@/lib/account";
import { useApp } from "@/state/app-context";
import { useAuth } from "@/state/auth-context";
import { restartTour } from "@/features/tour/tour";
import { EmailPreference } from "./email-preference";
import { AvatarField } from "./avatar-field";
import { PasswordField } from "./password-field";
import { DangerZone } from "./danger-zone";
import {
  FIELD,
  FieldLabel,
  Note,
  PrimaryButton,
  QuietButton,
  Section,
  Toggle,
} from "./parts";

const c = copy.settings;

/**
 * The earlier of the two dates we know: when the account was made, and when
 * this browser first held a profile. Somebody who wrote in Innerly for a month
 * before making an account has been using it since that first day, and the
 * label says "using Innerly since" rather than "account created".
 */
function joined(...candidates: (string | undefined)[]): string | null {
  const times = candidates
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => new Date(v).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Settings() {
  const { profile, setProfile, signOut, night, toggleNight, navigate } = useApp();
  const { signOut: endSession, signOutEverywhere, user } = useAuth();
  const [prefs, setPrefs] = usePersistentState<Prefs>(KEYS.prefs, DEFAULT_PREFS);
  const [name, setName] = useState(profile?.firstName ?? "");
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const since = joined(profile?.createdAt, user?.created_at);
  const dirty = name.trim() !== (profile?.firstName ?? "") && name.trim().length > 0;

  const saveName = () => {
    if (!profile) return;
    setProfile({ ...profile, firstName: name.trim() });
    setSaved(true);
  };

  const leave = async (everywhere: boolean) => {
    setLeaving(true);
    // App state first, session second: ending the session wipes the device, so
    // anything written after it would be left behind.
    signOut();
    await (everywhere ? signOutEverywhere() : endSession());
  };

  return (
    <div>
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Innerly / Settings
        </p>
        <h1 className="title-regular mt-2 text-[1.35rem] leading-[1.15] tracking-tight text-heading sm:text-[1.5rem]">
          {copy.nav.settings}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Your account, what Innerly is allowed to send you, and how to take
          your writing with you.
        </p>
      </header>

      <div className="space-y-4">
        {/* ------------------------------------------------------- profile */}
        <Section title="Profile">
          <div className="mt-4">
            <AvatarField />
          </div>

          <div className="mt-5">
            <FieldLabel>Display name</FieldLabel>
            <div className="flex gap-2">
              <input
                value={name}
                aria-label="Display name"
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty) saveName();
                }}
                className={FIELD}
              />
              <PrimaryButton onClick={saveName} disabled={!dirty}>
                {saved && !dirty ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Saved
                  </>
                ) : (
                  "Save"
                )}
              </PrimaryButton>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              What Innerly calls you. Nobody else sees it.
            </p>
          </div>

          {(user?.email || since) && (
            <dl className="mt-5 space-y-2 border-t border-border/50 pt-4">
              {user?.email && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12px] text-muted-foreground">Email</dt>
                  <dd className="truncate text-[12.5px] text-foreground">
                    {user.email}
                  </dd>
                </div>
              )}
              {since && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[12px] text-muted-foreground">
                    Using Innerly since
                  </dt>
                  <dd className="text-[12.5px] text-foreground">{since}</dd>
                </div>
              )}
            </dl>
          )}
        </Section>

        {/* ------------------------------------------------------ security */}
        <Section
          title="Password"
          desc="Changing it asks for your current one first, so a signed-in browser somebody else is sitting at cannot lock you out."
        >
          <PasswordField />
        </Section>

        {/* ---------------------------------------------------- appearance */}
        <Section title="Appearance">
          <div className="mt-2">
            <Toggle
              label="Night mode"
              desc="A darker, calmer palette for the evening."
              checked={night}
              onChange={toggleNight}
            />
          </div>
        </Section>

        {/* ------------------------------------------------- notifications */}
        <Section title={c.notificationsTitle}>
          <div className="mt-2 divide-y divide-border/50">
            <Toggle
              label={c.notifAllowLabel}
              desc={c.notifAllowDesc}
              checked={prefs.notifications}
              onChange={() => update({ notifications: !prefs.notifications })}
            />
            <Toggle
              label={c.notifDailyLabel}
              desc={c.notifDailyDesc}
              checked={prefs.dailyReminder}
              onChange={() => update({ dailyReminder: !prefs.dailyReminder })}
            />
          </div>
        </Section>

        <EmailPreference />

        {/* ------------------------------------------------------ your data */}
        <Section
          title="Your writing"
          desc="Everything you have written, as a file you keep. Plain JSON, so it can be read by something other than Innerly — writing from a year ago shouldn't need this app to still exist."
        >
          <QuietButton
            className="mt-4"
            onClick={() => downloadExport(user?.email ?? null)}
          >
            <Download className="h-3.5 w-3.5" /> Download everything
          </QuietButton>
        </Section>

        {/* ----------------------------------------------------------- tour */}
        <Section
          title="The tour"
          desc="A short walk through what each part of Innerly is for. Takes about thirty seconds."
        >
          <QuietButton
            className="mt-4"
            onClick={() => {
              restartTour();
              navigate("dashboard");
            }}
          >
            <Compass className="h-3.5 w-3.5" /> Show me around again
          </QuietButton>
        </Section>

        {/* ------------------------------------------------------ signing out */}
        <Section
          title="Signing out"
          desc={
            user
              ? "Your writing is saved to your account and removed from this device, so nobody who uses this computer after you can read it. Sign back in to get it all."
              : "Returns you to the welcome screen. Your writing stays on this device."
          }
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <QuietButton onClick={() => leave(false)} disabled={leaving}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </QuietButton>
            {user && (
              <QuietButton onClick={() => leave(true)} disabled={leaving}>
                <Smartphone className="h-3.5 w-3.5" /> Sign out everywhere
              </QuietButton>
            )}
          </div>
          {user && (
            <Note
              quiet
              text="Use the second one if you have signed in on a phone or a computer you no longer have."
            />
          )}
        </Section>

        <DangerZone />
      </div>
    </div>
  );
}
