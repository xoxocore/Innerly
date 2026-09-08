import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The photo on a shared vision card.
 *
 * The `visions` bucket is private and stays that way. A signed URL lasts about
 * an hour, so baking one into a shared link would hand somebody a card that
 * quietly breaks by tomorrow — and making the bucket public to avoid that would
 * expose every photo anybody had ever uploaded, shared or not.
 *
 * So the link points here instead, and the signing happens per request against
 * the token. That keeps the bucket closed, keeps shared links working for as
 * long as they are meant to, and makes revoking a share close the door on the
 * photo too rather than only on the words.
 */

/** Long enough to be worth a round trip, short enough that revoking bites. */
const SIGNED_FOR = 60 * 30;
const CACHE_FOR = 60 * 5;

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new NextResponse("No token", { status: 400 });

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return new NextResponse("Sharing is not configured", { status: 503 });
  }

  const { data: share } = await admin
    .from("vision_shares")
    .select("image_path, image_url, revoked_at")
    .eq("token", token)
    .maybeSingle();

  // A revoked or unknown token is the same answer either way, so that nobody
  // can tell a card that was taken back from one that never existed.
  if (!share || share.revoked_at) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (share.image_path) {
    const { data: signed } = await admin.storage
      .from("visions")
      .createSignedUrl(share.image_path, SIGNED_FOR);
    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, {
        status: 307,
        headers: { "Cache-Control": `private, max-age=${CACHE_FOR}` },
      });
    }
  }

  // A photo somebody pasted a link to rather than uploaded needs no signing.
  if (share.image_url) {
    return NextResponse.redirect(share.image_url, { status: 307 });
  }

  return new NextResponse("No image", { status: 404 });
}
