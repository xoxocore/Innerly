import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderEmail, renderPlain } from "@/lib/email-template";

/**
 * Sending a campaign.
 *
 * Same order of checks as the account actions: who is asking, are they an
 * admin (asked of the database AS THEM), and only then anything privileged.
 *
 * Recipients come from the database rather than the request, so a crafted
 * request cannot make Innerly email an address that never signed up.
 */

// Overridable so the send path can be pointed at a stub and actually exercised
// — it is the one piece here that cannot be taken back once it runs, and an
// untested send is a worse risk than a configurable base URL.
const RESEND_BASE = process.env.RESEND_API_BASE ?? "https://api.resend.com";
// Resend takes a hundred at a time.
const BATCH = 100;

type Recipient = { user_id: string; email: string; first_name: string; token: string };

export async function POST(request: Request) {
  let body: { campaignId?: string; test?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!body.campaignId) {
    return NextResponse.json({ error: "No campaign given." }, { status: 400 });
  }

  const session = await supabaseServer();
  const {
    data: { user: actor },
  } = await session.auth.getUser();
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: isAdmin, error: checkFailed } = await session.rpc("is_admin");
  if (checkFailed || !isAdmin) {
    return NextResponse.json({ error: "Not an admin." }, { status: 403 });
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up yet. Add RESEND_API_KEY and EMAIL_FROM in Vercel " +
          "under Project → Settings → Environment Variables, then redeploy.",
      },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  const { data: campaign, error: missing } = await admin
    .from("email_campaigns")
    .select("id, subject, preheader, body, audience, status")
    .eq("id", body.campaignId)
    .single();
  if (missing || !campaign) {
    return NextResponse.json({ error: "No such campaign." }, { status: 404 });
  }
  // Sending the same campaign twice because a button was double-clicked is a
  // mistake nobody can take back, so the status is the guard.
  if (!body.test && campaign.status !== "draft") {
    return NextResponse.json(
      { error: "That has already been sent." },
      { status: 409 }
    );
  }

  const origin = new URL(request.url).origin;
  const unsubscribeFor = (token: string) =>
    `${origin}/unsubscribe?t=${encodeURIComponent(token)}`;

  /* ---------------------------------------------------------- a test send -- */

  if (body.test) {
    const { data: mine } = await admin
      .from("email_prefs")
      .select("token")
      .eq("user_id", actor.id)
      .single();

    // Addressed with the sender's own name, and the subject substituted the
    // same way a real one is. A test that reads differently from what lands in
    // everybody else's inbox is not a test of anything.
    const meta = actor.user_metadata as { name?: string; full_name?: string };
    const myName =
      (meta?.name ?? meta?.full_name ?? "").trim().split(/\s+/)[0] || "there";

    const url = unsubscribeFor(mine?.token ?? "test");
    const parts = {
      subject: campaign.subject,
      preheader: campaign.preheader,
      body: campaign.body,
      name: myName,
      unsubscribeUrl: url,
    };
    const sent = await send(key, [
      {
        from,
        to: [actor.email!],
        subject: "[Test] " + subjectFor(parts.subject, myName),
        html: renderEmail(parts),
        text: renderPlain(parts),
        headers: {
          "List-Unsubscribe": `<${url}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
    ]);
    return sent.ok
      ? NextResponse.json({ ok: true, test: true, to: actor.email })
      : NextResponse.json({ error: sent.error }, { status: 502 });
  }

  /* ------------------------------------------------------- the real thing -- */

  const { data: recipients, error: listFailed } = await session.rpc(
    "email_recipients",
    { target: campaign.audience }
  );
  if (listFailed) {
    return NextResponse.json({ error: listFailed.message }, { status: 500 });
  }

  const people = (recipients ?? []) as Recipient[];
  if (people.length === 0) {
    return NextResponse.json(
      { error: "Nobody matches that audience yet." },
      { status: 400 }
    );
  }

  await admin
    .from("email_campaigns")
    .update({ status: "sending", recipients: people.length })
    .eq("id", campaign.id);

  let delivered = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (let i = 0; i < people.length; i += BATCH) {
    const slice = people.slice(i, i + BATCH);
    const messages = slice.map((p) => {
      const parts = {
        subject: campaign.subject,
        preheader: campaign.preheader,
        body: campaign.body,
        name: p.first_name,
        unsubscribeUrl: unsubscribeFor(p.token),
      };
      return {
        from,
        to: [p.email],
        subject: subjectFor(parts.subject, p.first_name),
        html: renderEmail(parts),
        text: renderPlain(parts),
        // The one-click unsubscribe Gmail and Apple Mail put in their own UI.
        // Having it is part of not being treated as spam.
        headers: {
          "List-Unsubscribe": `<${unsubscribeFor(p.token)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const result = await send(key, messages);
    if (result.ok) delivered += slice.length;
    else {
      failed += slice.length;
      lastError = result.error;
    }
  }

  await admin
    .from("email_campaigns")
    .update({
      status: failed > 0 && delivered === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      delivered,
      failed,
      error: lastError,
    })
    .eq("id", campaign.id);

  return NextResponse.json({ ok: true, delivered, failed, error: lastError });
}

/** {name} in a subject line, filled the one way everywhere. */
function subjectFor(subject: string, name: string | null | undefined) {
  return subject.replace(/\{name\}/g, (name || "").trim() || "there");
}

async function send(
  key: string,
  messages: unknown[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${RESEND_BASE}/emails/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (res.ok) return { ok: true };
    const detail = await res.text();
    return { ok: false, error: `Resend said ${res.status}: ${detail.slice(0, 300)}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach the email service.",
    };
  }
}
