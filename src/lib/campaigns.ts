"use client";

import { supabase } from "@/lib/supabase/client";

export type Audience = "everyone" | "new" | "returning";
export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  subject: string;
  preheader: string;
  body: string;
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

const COLUMNS =
  "id, subject, preheader, body, audience, status, sent_at, recipients, delivered, failed, error, created_at, updated_at";

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase()
    .from("email_campaigns")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

export async function saveCampaign(c: Partial<Campaign>) {
  const { data, error } = await supabase()
    .from("email_campaigns")
    .upsert(c)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
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
