import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Suspending and deleting accounts.
 *
 * The only endpoint in Innerly that can act on someone else's account, so the
 * order of checks matters and is deliberate:
 *
 *   1. Who is asking? Read from the session cookie, never from the request body.
 *   2. Are they an admin? Asked of the database AS THAT PERSON, so the answer
 *      comes from the allowlist rather than from anything the caller sent.
 *   3. Only then is the service key touched.
 *
 * A request that fails 1 or 2 never reaches a client that could bypass a policy.
 */

// A hundred years. Supabase has no "forever", and a date this far out is
// indistinguishable from one in every way that matters.
const FOREVER = "876000h";

type Action = "suspend" | "unsuspend" | "delete";

export async function POST(request: Request) {
  let body: { action?: string; userId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  const userId = body.userId;
  const reason = (body.reason ?? "").trim().slice(0, 500);

  if (!action || !["suspend", "unsuspend", "delete"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "No account given." }, { status: 400 });
  }

  // 1. Who is asking.
  const session = await supabaseServer();
  const {
    data: { user: actor },
  } = await session.auth.getUser();

  if (!actor) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // 2. Are they allowed. Asked as them, so the allowlist is the authority.
  const { data: isAdmin, error: checkFailed } = await session.rpc("is_admin");
  if (checkFailed || !isAdmin) {
    return NextResponse.json({ error: "Not an admin." }, { status: 403 });
  }

  // An admin locking themselves out, or deleting their own account from the
  // panel, is always a mistake rather than an intention.
  if (userId === actor.id) {
    return NextResponse.json(
      { error: "You cannot suspend or delete your own account here." },
      { status: 400 }
    );
  }

  // 3. Now, and only now, the service key.
  const admin = supabaseAdmin();

  const { data: target, error: missing } = await admin.auth.admin.getUserById(userId);
  if (missing || !target?.user) {
    return NextResponse.json({ error: "No such account." }, { status: 404 });
  }
  const targetEmail = target.user.email ?? "";

  if (action === "delete") {
    // Storage is not covered by the database's cascade, so a plain delete
    // would leave someone's photos sitting in the bucket after their account
    // is gone. Clear them first: better an orphaned account than orphaned
    // pictures of someone who asked to be erased.
    const { data: files } = await admin.storage.from("visions").list(userId);
    if (files?.length) {
      await admin.storage
        .from("visions")
        .remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: action === "suspend" ? FOREVER : "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Written with the service key so that no admin can quietly edit the record
  // of what they did. A log its subject can rewrite is decoration.
  await admin.from("admin_actions").insert({
    actor_id: actor.id,
    actor_email: actor.email ?? "",
    target_id: userId,
    target_email: targetEmail,
    action,
    reason,
  });

  return NextResponse.json({ ok: true, action, email: targetEmail });
}
