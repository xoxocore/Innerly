"use client";

import { supabase } from "@/lib/supabase/client";

export type Audience = "everyone" | "new" | "returning";
export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  subject: string;
  preheader: string;
  body: string;
  /** A whole HTML email pasted in from a designer, instead of `body`. */
  custom_html: string | null;
  audience: Audience;
  status: CampaignStatus;
  sent_at: string | null;
  recipients: number;
  delivered: number;
  failed: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A deploy lands the moment it is pushed; a migration is run by hand, later.
 * Between the two there is a window where the code knows about a column the
 * database does not have yet — and asking for it fails the whole query, which
 * took out the entire Email tab rather than the one feature that was missing.
 *
 * So the newer column is asked for separately, and dropped for the rest of the
 * session the first time the database says it does not exist. Everything that
 * worked before a migration keeps working until it is run.
 */
const BASE_COLUMNS =
  "id, subject, preheader, body, audience, status, sent_at, recipients, delivered, failed, error, created_at, updated_at";

/** Added by migration 0010. */
const DESIGN_COLUMN = "custom_html";

let hasDesignColumn = true;

function columns() {
  return hasDesignColumn ? `${BASE_COLUMNS}, ${DESIGN_COLUMN}` : BASE_COLUMNS;
}

/** Postgres 42703, which PostgREST passes through as "column ... does not exist". */
function missingColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    /column .*does not exist/i.test(error.message ?? "")
  );
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const run = () =>
    supabase()
      .from("email_campaigns")
      .select(columns())
      .order("created_at", { ascending: false });

  let { data, error } = await run();
  if (error && missingColumn(error) && hasDesignColumn) {
    hasDesignColumn = false;
    ({ data, error } = await run());
  }
  if (error) throw new Error(error.message);
  return (data ?? []).map(withDesign) as Campaign[];
}

export async function saveCampaign(c: Partial<Campaign>) {
  const run = () => {
    // Nothing is written to a column that is not there, so saving a draft
    // still works before the migration — it just cannot carry a pasted design.
    const row = hasDesignColumn ? c : stripDesign(c);
    return supabase().from("email_campaigns").upsert(row).select(columns()).single();
  };

  let { data, error } = await run();
  if (error && missingColumn(error) && hasDesignColumn) {
    hasDesignColumn = false;
    ({ data, error } = await run());
  }
  if (error) throw new Error(error.message);
  return withDesign(data) as Campaign;
}

/** Keeps the shape whole for callers, whether the column exists or not. */
function withDesign(row: unknown): Campaign {
  const r = row as Campaign;
  return { ...r, custom_html: r?.custom_html ?? null };
}

function stripDesign(c: Partial<Campaign>): Partial<Campaign> {
  const copy = { ...c };
  delete copy.custom_html;
  return copy;
}

/** True once the database has been migrated far enough to hold a design. */
export function designsSupported(): boolean {
  return hasDesignColumn;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase().from("email_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** How many people a send would actually reach, before sending it. */
export async function audienceSize(target: Audience): Promise<number> {
  const { data, error } = await supabase().rpc("email_audience_size", { target });
  if (error) return 0;
  return Number(data ?? 0);
}

export async function sendCampaign(campaignId: string, test: boolean) {
  const res = await fetch("/api/admin/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, test }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    delivered?: number;
    failed?: number;
    to?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "That didn't send.");
  // A send that reached nobody comes back as 200 with the reason attached —
  // the request was fine, the sending was not. Treated as success it would
  // close the composer and look like it went out.
  if (body.error && !body.delivered) {
    throw new Error(body.error);
  }
  return body;
}
