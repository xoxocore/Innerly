# Opening Innerly to real people

Everything below needs your accounts, so it is yours to do. Nothing here is
hard, but the order matters, and two of the steps are the difference between
"people can sign up" and "people click the link in their email and nothing
happens".

Work top to bottom. Where a step says **check**, do the check — it is there
because skipping it fails quietly rather than loudly.

Your project is `iiemqvxpnurfazhmlscp`; the dashboard is at
<https://supabase.com/dashboard/project/iiemqvxpnurfazhmlscp>.

---

## Already done

- Supabase project created, `0001_init.sql` and `0002_storage.sql` run.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel
  — **check both are ticked for Production, not only Preview.** If they are
  Preview-only, the live site quietly runs the old no-accounts version and
  shows the welcome screen instead of sign-in, which looks like a failed
  deploy but is not one.
- Accounts, sync, private photo storage and password reset are all merged to
  `main`, so the live site builds from them.

---

## 1. Finish the database — one paste, 2 minutes

**SQL Editor → New query.** Paste all of `supabase/setup.sql` and press Run.

It adds the table your writing is stored in, then checks every lock and prints
the result. **Every row must say PASS.** If one says FAIL it names what is
wrong — send me that line and stop there.

Safe to run more than once, and safe on a live project, so re-run it whenever
you want to check.

## 2. Give Supabase a real way to send email — 15 minutes

**This is the step that catches people out.** Supabase's built-in email sender
is for testing: it is capped at a handful of messages an hour, and over that
limit it simply stops. Confirmation and password-reset emails would go missing
with no error shown to anyone — not to you, not to the person signing up.

Use [Resend](https://resend.com) (free for 3,000 emails a month):

1. Sign up at resend.com.
2. **Domains → Add Domain.** If you own a domain, add it and copy the DNS
   records it gives you into wherever your domain is registered. If you do not
   own one yet, skip to the note below.
3. **API Keys → Create API Key.** Copy it — it is shown once.
4. In Supabase: **Project Settings → Authentication → SMTP Settings.**
   Turn on *Enable Custom SMTP* and fill in:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the API key from step 3
   - Sender email: `hello@yourdomain.com`
   - Sender name: `Innerly`
5. Save.

> **No domain yet?** Buy one before you invite anyone. Email sent from a
> borrowed sender address lands in spam, and "did you get the email?" is not a
> good first impression of an app about self-reflection. A `.com` is about
> £10/year.

**Check:** Supabase → **Authentication → Users → Invite user**, send one to
your own address. It should arrive within a minute, from your domain.

## 3. Point the confirmation links at the real site — 3 minutes

**Authentication → URL Configuration.**

- **Site URL:** `https://innerly-sooty.vercel.app`
- **Redirect URLs**, add both:
  - `https://innerly-sooty.vercel.app/**`
  - `http://localhost:3000/**`

Without this, the link inside every confirmation email points at
`localhost:3000`, which only works on the machine that sent it. Everyone else
clicks it and lands nowhere.

## 4. Tighten the password rules — 2 minutes

**Authentication → Providers → Email:** *Confirm email* must be ON. This is
what stops someone signing up as an address they do not own.

**Authentication → Policies** (some dashboards: *Sign In / Providers →
Passwords*):

- Minimum password length: **8**
- Turn on **leaked password protection**. It checks new passwords against
  known breached ones, so nobody protects their journal with a password that
  is already on a list somewhere.

## 5. Google sign-in — 15 minutes

The button is already in the app; it needs credentials behind it.

1. <https://console.cloud.google.com> → create a project called `Innerly`.
2. **APIs & Services → OAuth consent screen.** External. App name `Innerly`,
   your email for both support and developer contact. Save through to the end.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type: **Web application**.
4. Under *Authorised redirect URIs*, add exactly:
   `https://iiemqvxpnurfazhmlscp.supabase.co/auth/v1/callback`
5. Create. Copy the **Client ID** and **Client secret**.
6. Supabase → **Authentication → Providers → Google.** Enable, paste both,
   save.

**Check:** open the site, click *Continue with Google*. If it says
"redirect_uri_mismatch", step 4 does not match — it must be that URL exactly,
no trailing slash.

## 6. Make yourself the admin — 2 minutes

Do this *after* step 2, or the confirmation email will not arrive.

1. Open the live site and sign up with your own email. Confirm it.
2. Supabase → **SQL Editor**, run:

   ```sql
   -- put your own address here, the one you just signed up with
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

3. Re-run `supabase/setup.sql`. The last row should now read `1`.

Admin rights come only from this table. Nothing anyone types during signup can
grant them, which is what keeps the admin area closed.

## 7. Turn on the admin panel — 5 minutes

Only needed when you want the panel at `/admin`. The app works without it.

1. **SQL Editor → New query**, paste all of
   `supabase/migrations/0004_admin.sql`, Run. Safe to run twice.

2. **Project Settings → API**, copy the **service_role** (or `sb_secret_…`)
   key. **Do not send it to anyone, including me.** It bypasses every policy
   in the database.

3. In Vercel: **Settings → Environment Variables → Add**.
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: the key you just copied
   - Environments: tick **Production**
   - **No `NEXT_PUBLIC_` prefix.** With one, Vercel would publish it to every
     visitor, and anyone could read or delete anything.

4. Redeploy, then open `https://innerly-sooty.vercel.app/admin` and sign in
   with the account you added to the allowlist in step 6.

The panel can suspend, restore and delete accounts. It cannot read what
anyone wrote — the database refuses that for admins as well, which is checked
by `supabase/tests/admin-rls.sql`.

## 8. Sign in and use it

Once 1 through 4 are done, the site is a working app: create an account,
confirm the email, and you are in. Google sign-in (step 5) and the admin row
(step 6) can follow whenever.

## What "only you can read it" actually means

Worth being precise, because you will be asked.

**Another user cannot read your entries.** Not by guessing, not by editing the
app in their browser, not by writing their own request with the public key.
The database refuses at the row, not the app at the query, so there is no
forgotten filter that could open it. This is tested — `supabase/tests/rls.sql`
plays an attacker against a real Postgres and every attempt comes back empty.

**Someone who is not signed in reads nothing at all** except published blog
posts and tutorials.

**Vision-board photos are private too.** They go in a bucket that is not
public, so no photo can be reached by URL alone. Showing one means asking
Supabase for a link that lasts an hour and belongs to whoever uploaded it.
Tested the same way as the entries — `supabase/tests/storage-rls.sql`.

**Signing out wipes the device.** The app keeps a local copy so it is fast and
works offline; sign-out uploads anything outstanding and then deletes that
copy. On a shared or borrowed computer, the next person gets an empty app.

**The one exception, and you should know it:** the `service_role` secret key
in your Vercel settings bypasses every policy. That is what it is for, and why
it must never be sent to anyone or given a `NEXT_PUBLIC_` prefix. It means
*you*, as the operator, could technically read what people write. Nothing in
the app does — the admin dashboard is built to count accounts and active days,
never to open an entry — but the capability exists.

If you want it to be impossible rather than merely not-done, that is
end-to-end encryption: entries scrambled in the browser with a key derived
from the person's password, so the database only ever holds noise. It is a
real piece of work, and it has one hard consequence — forget your password and
your writing is gone forever, because nobody, including you, can unlock it.
Tell me if you want that and I will scope it.

---

## Still to build

Named so nothing is a surprise later:

- **Live sync between two open devices.** Today, a second device sees changes
  after a reload, and the later write wins.
- **Notifications** — composing, scheduling, and the triggered ones
  ("welcome back", "did you know?").
- **A newsletter**, once there is a marketing site with somewhere to sign up.
- **Website traffic** — turn on Vercel Analytics rather than building it.
