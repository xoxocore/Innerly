"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Supabase is configured to refuse anything shorter, and a journal is worth a
 * real password. Kept here as the single number the UI counts against, so the
 * hint, the meter and the submit button can never disagree.
 */
export const MIN_PASSWORD = 8;

export type PasswordCheck = { label: string; ok: boolean };

export function checkPassword(value: string): PasswordCheck[] {
  return [
    { label: `At least ${MIN_PASSWORD} characters`, ok: value.length >= MIN_PASSWORD },
    { label: "A letter and a number", ok: /[a-z]/i.test(value) && /\d/.test(value) },
  ];
}

export function passwordOk(value: string) {
  return checkPassword(value).every((c) => c.ok);
}

const base =
  "h-11 w-full rounded-2xl border bg-card/70 pl-4 pr-11 text-[14px] text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/60";

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  label,
  /** Shown under the field once they start typing. */
  checks,
  /** Set when this is a confirm field and the two do not match yet. */
  mismatch,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  label: string;
  checks?: PasswordCheck[];
  mismatch?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={shown ? "text" : "password"}
          placeholder={placeholder}
          aria-label={label}
          autoComplete={autoComplete}
          className={cn(
            base,
            mismatch
              ? "border-destructive/60"
              : "border-border/60 focus:border-[var(--brand-green)]"
          )}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          // Typing a password you cannot see is how people end up locked out
          // of their own journal.
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {checks && value.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 pl-0.5">
          {checks.map((c) => (
            <li
              key={c.label}
              className={cn(
                "flex items-center gap-1.5 text-[11.5px] transition-colors",
                c.ok ? "text-[var(--brand-green-ink)]" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                  c.ok
                    ? "border-transparent bg-[var(--brand-green)]"
                    : "border-border"
                )}
              >
                {c.ok && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {mismatch && (
        <p className="mt-2 pl-0.5 text-[11.5px] text-destructive">
          Both passwords need to match.
        </p>
      )}
    </div>
  );
}
