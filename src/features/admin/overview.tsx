"use client";

import { Loader2 } from "lucide-react";
import { Trend } from "./trend";
import { useStats } from "./use-admin";

/**
 * The numbers, all of them derived from when people signed up and which days
 * they opened the app. Nothing here counts, samples or summarises anything
 * anyone wrote.
 */
export function Overview() {
  const { data, error, loading } = useStats();

  if (loading) return <Centered><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Centered>;
  if (error) return <Centered><p className="text-[13px] text-destructive">{error}</p></Centered>;
  if (!data) return null;

  // Only meaningful once some accounts are old enough to have come back.
  const retention =
    data.eligible > 0 ? Math.round((data.returning / data.eligible) * 100) : null;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Accounts" value={data.accounts}
          foot={`${data.new_7d} joined this week`} />
        <Stat
          label="Here now"
          value={data.online_now}
          foot={`${data.active_today} opened it today`}
          live={data.online_now > 0}
        />
        <Stat
          label="Came back"
          value={retention === null ? "—" : `${retention}%`}
          foot={
            retention === null
              ? "needs a week of history"
              : `${data.returning} of ${data.eligible} older accounts`
          }
        />
        <Stat label="Suspended" value={data.suspended}
          foot={data.suspended === 0 ? "nothing to review" : "see Accounts"} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Opened today" value={data.active_today}
          foot={`${data.active_7d} this week`} />
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          The last 30 days
        </h2>
        <div className="mt-5 grid gap-7 lg:grid-cols-2 lg:gap-8">
          <Trend points={data.daily} field="signups" label="New accounts" />
          <Trend points={data.daily} field="active" label="People who opened Innerly" />
        </div>
      </section>

      <p className="text-[11.5px] text-muted-foreground">
        These refresh on their own every half minute.
      </p>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Writing you&apos;ve published
        </h2>
        <div className="mt-4 flex gap-8">
          <Small label="Published" value={data.posts_published} />
          <Small label="Drafts" value={data.posts_drafts} />
          <Small label="Confirmed emails" value={`${data.confirmed} of ${data.accounts}`} />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  foot,
  live,
}: {
  label: string;
  value: number | string;
  foot: string;
  /** Shows a pulsing dot, for a figure that means "at this moment". */
  live?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" />
          </span>
        )}
        {label}
      </p>
      <p className="mt-2 text-[1.9rem] font-normal leading-none tracking-tight tabular-nums text-heading">
        {value}
      </p>
      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{foot}</p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[1.35rem] font-normal leading-none tabular-nums text-heading">
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[40vh] place-items-center">{children}</div>;
}
