import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Mark } from "@/components/innerly/mark";
import { Wordmark } from "@/components/innerly/wordmark";
import { Heart } from "./heart";

/**
 * A vision card, opened by somebody who was sent the link.
 *
 * They are almost certainly not signed in, may never have heard of Innerly,
 * and are probably reading it on a phone in a messaging app — so this is a
 * single small card and nothing else. No navigation, no sign-up wall, no
 * invitation to browse anything of the sender's beyond the one thing they
 * chose to send.
 *
 * Rendered on the server so the card has a proper preview when the link is
 * pasted into a chat, which for something meant to be sent to one person is
 * most of the experience.
 */

export const dynamic = "force-dynamic";

type Card = {
  title: string;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
  hearts: number;
};

async function fetchCard(token: string): Promise<Card | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.rpc("vision_share_get", { share_token: token });
  const row = Array.isArray(data) ? data[0] : null;
  return (row as Card) ?? null;
}

/** The words out of the rich-text description, for a preview and for reading. */
function plain(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const card = await fetchCard(token);
  if (!card) return { title: "Innerly" };

  const description = plain(card.description).slice(0, 180);
  return {
    title: `${card.title} · Innerly`,
    description,
    openGraph: {
      title: card.title,
      description,
      images: card.image_path || card.image_url
        ? [`/api/share/image?token=${encodeURIComponent(token)}`]
        : undefined,
    },
    // A shared card is for one person, not for search results.
    robots: { index: false, follow: false },
  };
}

export default async function SharedVision({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = await fetchCard(token);

  if (!card) {
    return (
      <Shell>
        <div className="px-6 py-14 text-center">
          <Mark size={40} blink={false} className="mx-auto" />
          <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
            This card isn&apos;t being shared any more.
          </p>
        </div>
      </Shell>
    );
  }

  const image =
    card.image_path || card.image_url
      ? `/api/share/image?token=${encodeURIComponent(token)}`
      : null;
  const words = plain(card.description);

  return (
    <Shell>
      <article className="overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            // Decorative: the title says the same thing directly below it, and
            // alt text here would sprawl across the card if the photo ever
            // failed to load.
            alt=""
            className="aspect-[4/5] w-full bg-secondary object-cover"
          />
        ) : (
          <div className="aspect-[4/5] w-full bg-gradient-to-br from-[#e8f7ef] to-[#d6ece0]" />
        )}

        <div className="px-5 pb-4 pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            A vision
          </p>
          <h1 className="title-strong mt-1.5 text-[17px] leading-snug text-heading">
            {card.title}
          </h1>
          {words && (
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
              {words}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3.5">
            <span className="flex items-center gap-2">
              <Mark size={22} blink={false} />
              <Wordmark height={13} className="text-heading" />
            </span>
            <Heart token={token} hearts={card.hearts} />
          </div>
        </div>
      </article>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-bg grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[340px] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        {children}
      </div>
    </main>
  );
}
