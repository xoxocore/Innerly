import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Looking after your own account: pausing it, or ending it.
 *
 * The account acted on is ALWAYS the one in the session cookie. There is no
 * userId in the request body and no way to put one there — this endpoint
 * cannot be aimed at somebody else, which is what separates it from the admin
 * route beside it.
 *
 * Deleting also asks for the password again. The session alone is not enough:
 * an unlocked laptop is a signed-in session, and erasing somebody's journal is
 * the one action in Innerly with nothing behind it to undo.
 */

type Action = "pause" | "resume" | "delete";

export async function POST(request: Request) {
  let body: { action?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (!action || !["pause", "resume", "delete"].includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const session = await supabaseServer();
  const {
    data: { user: me },
  } = await session.auth.getUser();
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  /* ------------------------------------------------------ pause and resume -- */

  // Their own row, their own update policy — no elevated rights needed, and
  // none taken.
  if (action !== "delete") {
    const { error } = await session.rpc("set_paused", { paused: action === "pause" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action });
  }

  /* ------------------------------------------------------------- deleting -- */

  const password = body.password ?? "";
  if (!password) {
    return NextResponse.json(
      { error: "Enter your password to confirm." },
      { status: 400 }
    );
  }

  // Checked on a throwaway client with the public key, so that proving the
  // password does not touch — or refresh, or replace — the session cookie of
  // the person doing it.
  const check = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: wrong } = await check.auth.signInWithPassword({
    email: me.email ?? "",
    password,
  });
  if (wrong) {
    return NextResponse.json(
      { error: "That password doesn't match." },
      { status: 403 }
    );
  }

  const admin = supabaseAdmin();

  // Storage is outside the database's cascade, so deleting the account alone
  // would leave the photos behind. Pictures of somebody who asked to be erased
  // are the worst thing to leave lying around, so they go first: an orphaned
  // account is recoverable, an orphaned photo is a broken promise.
  for (const bucket of ["visions", "avatars"]) {
    const { data: files } = await admin.storage.from(bucket).list(me.id);
    if (files?.length) {
      await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${me.id}/${f.name}`));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(me.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nothing is written to admin_actions. That log is a record of what admins
  // did to other people; somebody closing their own account is not that, and
  // keeping their address in a table after they asked to be gone would undo
  // most of what the deletion was for.
  return NextResponse.json({ ok: true, action: "delete" });
}
