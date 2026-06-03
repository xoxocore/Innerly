"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { KEYS, usePersistentState } from "@/lib/storage";
import { DEFAULT_PREFS, type Prefs } from "@/lib/types";
import { useApp } from "@/state/app-context";

const c = copy.settings;

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-[15px] font-medium text-foreground">{label}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-border"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-background transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const { profile, setProfile, signOut, night, toggleNight } = useApp();
  const [prefs, setPrefs] = usePersistentState<Prefs>(KEYS.prefs, DEFAULT_PREFS);
  const [name, setName] = useState(profile?.firstName ?? "");

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  return (
    <div>
      <ScreenHeader breadcrumb="Innerly / Settings" title={copy.nav.settings} />

      <div className="space-y-6">
        {/* Profile */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-heading">Profile</h2>
          <label className="mt-4 block text-sm font-medium text-muted-foreground">
            First name
          </label>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-ring"
            />
            <Button
              variant="secondary"
              onClick={() =>
                profile && setProfile({ ...profile, firstName: name.trim() || "friend" })
              }
            >
              Save
            </Button>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-heading">Appearance</h2>
          <Toggle
            label="Night mode"
            desc="A darker, calmer palette for the evening."
            checked={night}
            onChange={toggleNight}
          />
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-heading">
            {c.notificationsTitle}
          </h2>
          <div className="mt-2 divide-y divide-border">
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
            <Toggle
              label={c.notifWeeklyLabel}
              desc={c.notifWeeklyDesc}
              checked={prefs.weeklyReport}
              onChange={() => update({ weeklyReport: !prefs.weeklyReport })}
            />
          </div>
        </Card>

        {/* Account */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-heading">Account</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Signing out returns you to the welcome screen. Your data stays on this
            device.
          </p>
          <Button variant="outline" className="mt-4" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}
