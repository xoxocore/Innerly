"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  audienceSize, deleteCampaign, saveCampaign, sendCampaign,
  type Audience, type Campaign,
} from "@/lib/campaigns";
import { renderEmail } from "@/lib/email-template";
import { Editor } from "./editor";

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "everyone", label: "Everyone", hint: "Confirmed, opted in, not suspended." },
  { id: "new", label: "Just joined", hint: "Signed up in the last week." },
  { id: "returning", label: "Been here a while", hint: "Signed up over a week ago." },
];

export function EmailForm({
  campaign,
  onClose,
}: {
  campaign: Campaign | null;
  onClose: (changed: boolean) => void;
}) {
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [preheader, setPreheader] = useState(campaign?.preheader ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [audience, setAudience] = useState<Audience>(campaign?.audience ?? "everyone");
  const [previewName, setPreviewName] = useState("Divya");
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState<false | "draft" | "test" | "send">(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const alreadySent = campaign?.status === "sent" || campaign?.status === "sending";

  useEffect(() => {
    let cancelled = false;
    audienceSize(audience).then((n) => !cancelled && setSize(n));
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const persist = async (): Promise<string | null> => {
    const saved = await saveCampaign({
      ...(campaign?.id ? { id: campaign.id } : {}),
      subject: subject.trim(),
      preheader: preheader.trim(),
      body,
      audience,
    });
    return saved.id;
  };

  const saveDraft = async () => {
    setBusy("draft");
    setError(null);
    try {
      await persist();
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy("test");
    setError(null);
    setNote(null);
    try {
      const id = await persist();
      const r = await sendCampaign(id!, true);
      setNote(`Sent to ${r.to}. Check your inbox before sending it to anyone else.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't send.");
    } finally {
      setBusy(false);
    }
  };

  const sendReal = async () => {
    setBusy("send");
    setError(null);
    try {
      const id = await persist();
      await sendCampaign(id!, false);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't send.");
      setBusy(false);
      setConfirmSend(false);
    }
  };

  const ready = subject.trim().length > 0 && body.trim().length > 0;

  // The real email, in a frame. Same function the server sends through.
  const previewHtml = renderEmail({
    subject: subject || "Your subject line",
    preheader,
    body: body || "<p>Your message goes here.</p>",
    name: previewName,
    unsubscribeUrl: "#",
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onClose(false)}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All emails
        </button>
        <span className="text-[13px] text-muted-foreground">
          {alreadySent ? "Already sent" : campaign ? "Draft" : "New"}
        </span>

        {!alreadySent && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={saveDraft}
              disabled={!ready || !!busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              {busy === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save draft
            </button>
            <button
              onClick={sendTest}
              disabled={!ready || !!busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />}
              Send me a test
            </button>
            <button
              onClick={() => setConfirmSend(true)}
              disabled={!ready || !!busy || !size}
              style={{ backgroundColor: "var(--brand-green-strong)" }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Send to {size ?? "…"}
            </button>
          </div>
        )}
      </div>

      {note && (
        <p className="mb-4 rounded-2xl bg-[var(--brand-green)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--brand-green-ink)]">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Box label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Something new in Innerly, {name}"
              aria-label="Subject"
              disabled={alreadySent}
              className={field}
            />
            <input
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              placeholder="The grey line under the subject in an inbox. Optional."
              aria-label="Preview line"
              disabled={alreadySent}
              className={cn(field, "mt-2 text-[12.5px]")}
            />
          </Box>

          <Box label="Message">
            {alreadySent ? (
              <div
                className="post-body rounded-2xl border border-border bg-card px-5 py-4 text-[14px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <Editor value={body} onChange={setBody} />
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
              <code className="rounded bg-secondary px-1 py-0.5 font-mono">{"{name}"}</code>{" "}
              becomes their first name, in the subject as well as the message.
            </p>
          </Box>

          {!alreadySent && (
            <Box label="Who gets it">
              <div className="flex flex-col gap-1.5">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAudience(a.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                      audience === a.id
                        ? "border-[var(--brand-green)] bg-[var(--brand-green)]/8"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="block text-[13px] font-medium">{a.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {a.hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {size === null ? "counting…" : `${size} ${size === 1 ? "person" : "people"} right now`}
              </p>
            </Box>
          )}

          {campaign && alreadySent && (
            <Box label="What happened">
              <div className="flex gap-8 text-[13px]">
                <Stat label="Sent to" value={campaign.recipients} />
                <Stat label="Delivered" value={campaign.delivered} />
                <Stat label="Failed" value={campaign.failed} />
              </div>
              {campaign.error && (
                <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] leading-relaxed text-destructive">
                  {campaign.error}
                </p>
              )}
            </Box>
          )}

          {campaign && !alreadySent && (
            <div className="rounded-2xl border border-destructive/25 p-3.5">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[12.5px] text-muted-foreground">Delete this draft?</p>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-8 rounded-full px-3 text-[12.5px] text-muted-foreground hover:text-foreground"
                  >
                    Keep
                  </button>
                  <button
                    onClick={async () => {
                      await deleteCampaign(campaign.id);
                      onClose(true);
                    }}
                    className="h-8 rounded-full bg-destructive px-3 text-[12.5px] font-medium text-white hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete this draft
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-[57px] lg:self-start">
          <div className="rounded-3xl border border-border bg-secondary/40 p-4">
            <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Exactly what lands in their inbox
            </p>
            {/* An iframe because email HTML has its own styles, and letting
                them loose in the panel would restyle the panel. */}
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              sandbox=""
              className="h-[460px] w-full rounded-2xl border border-border bg-white"
            />
            <label className="mt-4 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Preview as
            </label>
            <input
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              placeholder="A first name"
              aria-label="Preview as"
              className="mt-1.5 h-9 w-full rounded-xl border border-border bg-card px-3 text-[13px] outline-none focus:border-[var(--brand-green)]"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Empty shows what somebody who never set a name gets.
            </p>
          </div>
        </aside>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-[400px] rounded-3xl border border-border bg-card p-6">
            <h2 className="text-[1.05rem] font-medium text-heading">
              Send to {size} {size === 1 ? "person" : "people"}?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              This goes out straight away and cannot be called back. If you
              haven&apos;t sent yourself a test yet, do that first.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSend(false)}
                className="h-10 rounded-full px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                Not yet
              </button>
              <button
                onClick={sendReal}
                disabled={busy === "send"}
                style={{ backgroundColor: "var(--brand-green-strong)" }}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === "send" && <Loader2 className="h-4 w-4 animate-spin" />}
                Send it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const field =
  "h-11 w-full rounded-2xl border border-border bg-card px-4 text-[13.5px] outline-none transition-colors focus:border-[var(--brand-green)] disabled:opacity-60";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[1.2rem] leading-none tabular-nums text-heading">{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
