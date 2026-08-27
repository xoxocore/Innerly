# Phase 2 — what to set up, and what to send me

Everything here needs your accounts, so it is yours to do. None of it takes
long. When you are done, send me the values marked **→ send me**.

---

## 1. Supabase project

1. Go to <https://supabase.com>, sign in, **New project**.
2. Name it `innerly`. Choose the region closest to most of your users — this
   is the one setting that is painful to change later.
3. Save the database password somewhere safe. You will rarely need it, and it
   cannot be recovered, only reset.
4. Wait for the project to finish provisioning (~2 minutes).

### Run the schema

In the Supabase dashboard: **SQL Editor → New query**. Paste the contents of
`supabase/migrations/0001_init.sql`, run it. Then do the same with
`supabase/migrations/0002_storage.sql`.

Both should report success with no rows. If anything errors, send me the exact
message rather than editing the SQL.

### Collect the keys

**Project Settings → API**:

- **Project URL** → send me
- **anon / public key** → send me (safe in the browser; it only ever grants
  what the row-level policies allow)
- **service_role key** → **do not send me, do not paste in chat.** Add it
  directly to Vercel yourself in step 3. It bypasses every security policy.

---

## 2. Google sign-in

1. <https://console.cloud.google.com> → new project → **APIs & Services →
   OAuth consent screen**. External. Fill in app name, your support email,
   and the Innerly logo.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under *Authorised redirect URIs* add the callback URL Supabase shows you at
   **Authentication → Providers → Google** (it looks like
   `https://<project>.supabase.co/auth/v1/callback`).
4. Copy the client ID and secret into that same Supabase Google provider page
   and enable it.

Nothing here needs to reach me — it lives in Supabase.

> The consent screen starts in "testing" mode, which caps you at 100 sign-ins
> and shows an unverified-app warning. Submitting for verification takes
> Google days to weeks, so start it before you launch, not after.

---

## 3. Vercel environment variables

**Project → Settings → Environment Variables**, for all environments:

| Name | Value | Who adds it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | me, once you send it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | me, once you send it |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **you, directly** |

---

## 4. Make yourself an admin

You cannot do this until you have signed in once, because the row points at
your account.

1. Sign in to Innerly with the email you want as the admin.
2. Supabase dashboard → **Authentication → Users**, copy your user's UID.
3. **SQL Editor**, run:

   ```sql
   insert into public.admins (user_id) values ('<paste-your-uid>');
   ```

Admin rights come only from this table. Nothing in the app can add a row to
it, which is what keeps `/admin` closed.

---

## What I build once you send the keys

In this order, because each depends on the one before:

1. **Auth** — sign up, sign in, Google, password reset, session handling.
2. **The migration** — on first sign-in, whatever is in that browser's
   localStorage is lifted into the account, so nobody loses a journal they
   already wrote. This only works while the person still has their old
   browser data, which is why it ships with auth rather than after it.
3. **Reads and writes move to Supabase** — screen by screen, so each one can
   be checked before the next.
4. **Admin at `/admin`** — its own sign-in, publishing for blogs and
   tutorials, image uploads.
5. **Admin dashboard** — signups, active accounts, retention, which posts get
   read. No revenue line: the app is free.

Innerly is free, so there is no billing anywhere in this phase. If that ever
changes, it is one migration to add the columns and a self-contained piece of
work to add checkout — nothing built here has to be undone for it.

## Two things that change the day accounts go live

- **Settings currently says "Your data stays on this device."** That stops
  being true. The copy has to change in the same release, not after.
- **You will need a privacy policy**, and if anyone in the EU signs up, GDPR
  obligations follow — export and deletion in particular. Worth drafting
  while the rest is being built.
