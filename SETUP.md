# Connecting LastMinuteKenya to Supabase — step by step

This takes the prototype from in-memory seed data to a real backend: Postgres +
RLS, auth with four roles, realtime, and the alert Edge Function that sends on
WhatsApp / SMS / email. Follow the steps in order.

Everything backend lives in `supabase/`:

```
supabase/
  migrations/
    0001_schema.sql        # tables + public views + auth-profile trigger
    0002_rls.sql           # row-level security policies + role helpers
    0003_seed_network.sql  # optional: the 10 providers + 3 assessors
    0004_accounts.sql      # email on profiles, whoami() RPC, admin role control
    0005_provider_emails.sql  # provider emails + channel prefs (email as a real channel)
    0006_shop.sql             # Save-The-Day Gift Shop: products + orders
    0007_payments.sql         # order payment tracking (method, callback matching)
  functions/
    dispatch-alerts/index.ts  # the pre-dispatch alert engine (service role)
    submit-intake/index.ts    # Turnstile-verified public write path (SOS / assessment)
    mpesa-stkpush/index.ts    # M-Pesa Daraja STK push for gift-shop checkout
    mpesa-callback/index.ts   # Daraja callback → marks the order paid
    flutterwave-charge/index.ts # Airtel Money & card (Visa/Mastercard) via Flutterwave
src/
  lib/supabase.js          # browser client (anon key only)
  lib/auth.js              # anonymous customers, staff sign-in, whoami
  data/api.js              # reads, mutations, realtime — mirrors store.js
```

---

## 0. Prerequisites

- A [Supabase](https://supabase.com) account and a [Vercel](https://vercel.com) account.
- Node 18+ and the Supabase CLI:
  ```bash
  npm install -g supabase
  ```
- The provider/assessor phone numbers in `0003_seed_network.sql` are demo values —
  replace them with real ones before you send anything.

---

## 1. Create the Supabase project

> **Account:** this project's Supabase lives under **vombonya@gmail.com** — sign in
> with that account for the dashboard, and `supabase login` / `supabase link` with it
> too (not the ombonya@gmail.com projects).

1. Supabase dashboard → **New project**. Pick the **Nairobi / EU** region closest
   to your users, set a strong database password, and wait for it to provision.
2. From **Project Settings → API**, copy the **Project URL** and the **anon public**
   key. You'll need them in step 4. *Never copy the `service_role` key into the app.*

---

## 2. Run the migrations

Easiest path — the SQL editor:

1. Dashboard → **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/0001_schema.sql`, run it.
3. Repeat for `0002_rls.sql`, `0003_seed_network.sql` (optional), `0004_accounts.sql`,
   `0005_provider_emails.sql`, `0006_shop.sql`, and `0007_payments.sql`. (All are
   idempotent — safe to re-run.)

Or with the CLI (from the repo root):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push        # applies everything in supabase/migrations
```

After this you have all tables, the `providers_public` view the anon key reads,
RLS locked down, and the network catalog seeded.

---

## 3. Auth and the four roles

Auth is Supabase Auth. A trigger (`handle_new_user`) creates a `profiles` row on
every signup and **always sets role `customer`** — a self-declared role in signup
metadata is never trusted (that would let anyone sign up as admin). Admins promote
people from the in-app **Accounts** screen.

**Turn on the sign-in methods:**

- **Customers — anonymous (no OTP, no SMS provider).** Supabase's Phone auth only
  supports Twilio / Vonage / MessageBird / Textlocal, which are costly and awkward for
  Kenya, so we don't use it. Enable **Authentication → Sign In / Providers →
  Anonymous**. The app signs a customer in silently on first use (`src/lib/auth.js`)
  and their **phone is captured as a field** on the "Get Help" form so providers have a
  callback number. They can upgrade to a real email account later (`linkEmail()`)
  without losing history.
- **Providers / Assessors / Admin — email.** Enable the **Email** provider and make sure
  **Authentication → Sign In / Providers → "Allow new users to sign up"** is on (both are
  default). Staff **register themselves** from the app's **Staff sign in / register**
  (top-right account menu) — they enter a name, pick provider or assessor, and get an
  account. That request is advisory: they land as `customer` until you approve them.

**Create your first admin** (there's no public path to admin, by design):

1. Authentication → **Add user** → create yourself with email + password.
2. SQL Editor: `update public.profiles set role = 'admin' where id = 'YOUR_AUTH_UID';`
   (UID is on the user row in Authentication → Users). This one is by hand; every
   admin after can be promoted in-app.

**Everything else is in-app now.** Sign in as that admin → the **Accounts** tab lets
you: see pending sign-ups with the role they requested and **Approve as …** in one tap,
promote anyone to provider / assessor / admin, and **link a provider or assessor listing
to a person's login by email** (no more SQL). Role-based routing is automatic — each
person only sees their own surface based on their role.

---

## 4. Environment variables

Local — create `.env` from the example:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_TURNSTILE_SITE_KEY=          # optional, for public form CAPTCHA
```

Vercel — add the same two `VITE_` vars in **Project → Settings → Environment
Variables** (Production + Preview). Only public values live here.

---

## 5. Deploy the Edge Functions + secrets

```bash
supabase functions deploy dispatch-alerts   # the alert engine
supabase functions deploy submit-intake     # guarded public write path (Turnstile)
supabase functions deploy mpesa-stkpush      # gift-shop M-Pesa checkout
```

### 5d. M-Pesa (Daraja) — Gift Shop checkout & revenue

The shop's "Pay via M-Pesa" sends an STK push to the buyer's phone. Until you set
the Daraja secrets it runs in **simulated** mode (the flow completes, no real charge),
so you can demo the shop immediately.

1. Create an app on the **Safaricom Daraja** portal (developer.safaricom.co.ke). Start
   in **sandbox**: get the Consumer Key/Secret, the test shortcode `174379` and passkey.
2. Set the secrets and (re)deploy:
   ```bash
   supabase secrets set MPESA_ENV=sandbox MPESA_CONSUMER_KEY=... MPESA_CONSUMER_SECRET=... \
     MPESA_SHORTCODE=174379 MPESA_PASSKEY=... \
     MPESA_CALLBACK_URL=https://YOUR_REF.functions.supabase.co/mpesa-callback
   supabase functions deploy mpesa-stkpush
   ```
3. Test with the Daraja sandbox test MSISDN. For production, apply for a real
   Paybill/Till and switch `MPESA_ENV=production`.
4. **Payment completes** via the callback. Deploy it so Daraja can reach it without a
   Supabase JWT, and point the STK push at it:
   ```bash
   supabase functions deploy mpesa-callback --no-verify-jwt
   supabase secrets set MPESA_CALLBACK_URL=https://YOUR_REF.functions.supabase.co/mpesa-callback
   ```
   Now a confirmed payment flips the order to `paid`; a cancelled one to `cancelled`.

### 5e. Airtel Money & cards (Visa/Mastercard) via Flutterwave

M-Pesa is direct via Daraja (lowest fees). For **Airtel Money and cards**, the checkout
uses **Flutterwave** (one integration covers both). Until you set the key it simulates.
```bash
supabase functions deploy flutterwave-charge
supabase secrets set FLW_SECRET_KEY=FLWSECK-... SHOP_REDIRECT_URL=https://lastminutekenya.com/customer/requests
```
The customer picks M-Pesa / Airtel / Card at checkout; card & Airtel open a hosted
Flutterwave page. (A `flutterwave-webhook` to mark those orders paid is the next step,
mirroring `mpesa-callback`.)

**Revenue model wired in:** SOS is free to raise; the Provider Network screen shows the
~15% platform commission on each rescue (provider "You keep" figure); the assessment
request shows the flat fee; and the Gift Shop carries retail margin + a delivery fee.
Tune the numbers in `src/lib/pricing.js`.

Then set the channel secrets (these live ONLY in the function's env — never in the
bundle, never in git):

```bash
supabase secrets set \
  AT_USERNAME=your_africastalking_username \
  AT_API_KEY=your_africastalking_api_key \
  WHATSAPP_TOKEN=your_whatsapp_cloud_api_token \
  WHATSAPP_PHONE_ID=your_whatsapp_phone_number_id \
  RESEND_API_KEY=your_resend_key \
  ALERT_FROM_EMAIL="LastMinuteKenya <alerts@lastminutekenya.com>" \
  ALERT_REPLY_TO=ops@lastminutekenya.com
```

`ALERT_REPLY_TO` is optional — set it to the inbox where provider replies to an
email alert should land (Resend sends *from* your verified domain but doesn't
receive; replies go wherever `reply_to` points).

Any channel whose secrets you skip is simply not sent — the alert is still recorded
as `queued` and shows in the app, so you can wire the channels one at a time. This is
where the **"save the alert-channel decision for later"** call lands: pick whichever
channel(s) you want live first, set only those secrets, deploy.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function
automatically — you don't set them.

### 5a. Africa's Talking SMS — the recommended first channel

1. **Create an account** at [africastalking.com](https://africastalking.com) and verify it.
2. **Test free in the sandbox first.** In the AT dashboard switch to the **Sandbox**
   app, copy its **API key**, and set:
   ```bash
   supabase secrets set AT_USERNAME=sandbox AT_API_KEY=your_sandbox_api_key
   supabase functions deploy dispatch-alerts
   ```
   Sandbox messages go to AT's **Launch Simulator** (a virtual phone), not real SIMs —
   perfect for proving the wiring at no cost.
3. **Prove it works** with the built-in test mode (replace the number with a simulator
   number, or a real one once you're live):
   ```bash
   curl -X POST "https://YOUR-PROJECT.functions.supabase.co/dispatch-alerts" \
     -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"kind":"test","to":"+254700000000"}'
   ```
   You should get `{"channel":"sms","to":"…","sent":true}` and see the message in the
   simulator. If `sent` is false, check `supabase functions logs dispatch-alerts`.
4. **Go live.** Create a **live** AT app, top up SMS credits, and (for branded messages)
   apply for an **alphanumeric sender ID** like `LASTMIN` or a short code — approval takes
   a few days. Then:
   ```bash
   supabase secrets set AT_USERNAME=your_live_username AT_API_KEY=your_live_api_key AT_FROM=LASTMIN
   supabase functions deploy dispatch-alerts
   ```
   (Without `AT_FROM` messages send from a shared masked number; with it they show your
   sender ID.) Replace the demo phone numbers in `0003_seed_network.sql` with real ones,
   in **E.164** format (`+2547XXXXXXXX`), before going live.
5. **End-to-end test:** in the app, score a Site Assessment **Red** (or raise an SOS) —
   the matched providers get a real SMS, and the alert log shows `sent`.

### 5b. WhatsApp (Cloud API) — a second channel

WhatsApp is stricter than SMS: a **business-initiated** message (which our alerts are —
the provider hasn't messaged us first) must use a **pre-approved template**, not free
text. The function handles this — you just supply the template name.

1. In **Meta for Developers**, create a **WhatsApp Business** app, get a **permanent
   access token** and your **phone number ID**.
2. Under **WhatsApp → Message templates**, create a template — e.g. name
   `lastminute_alert`, category *Utility*, with a body containing one variable:
   `LastMinuteKenya: {{1}}`. Submit it for approval.
3. Once approved, set the secrets and redeploy:
   ```bash
   supabase secrets set WHATSAPP_TOKEN=your_token WHATSAPP_PHONE_ID=your_phone_id \
     WHATSAPP_TEMPLATE=lastminute_alert WHATSAPP_TEMPLATE_LANG=en
   supabase functions deploy dispatch-alerts
   ```
4. Test it (the test mode now takes a channel):
   ```bash
   curl -X POST "https://YOUR-PROJECT.functions.supabase.co/dispatch-alerts" \
     -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"kind":"test","channel":"whatsapp","to":"+2547XXXXXXXX"}'
   ```
   (For a first no-template test, message your WhatsApp test number from the target phone
   first — that opens a 24h window in which free text is allowed.)

Each provider's `preferred_channel` decides which channel their alert uses; set it to
`whatsapp` for those you want on WhatsApp.

### 5c. Cloudflare Turnstile — anti-spam on the public forms

The customer "Get Help" forms (SOS + assessment request) are public writes, so they're
gated by Turnstile: the widget shows on the form, and the **submit-intake** Edge
Function verifies the token server-side before inserting.

1. In the **Cloudflare dashboard → Turnstile**, add a site (your domain +
   `localhost` for dev). Copy the **Site key** and **Secret key**.
2. **Client** — add the site key to `.env` and to Vercel env:
   ```
   VITE_TURNSTILE_SITE_KEY=your_site_key
   ```
3. **Server** — set the secret and deploy the intake function:
   ```bash
   supabase secrets set TURNSTILE_SECRET=your_secret_key
   supabase functions deploy submit-intake
   ```

If you don't set these, the app still works — the widget just doesn't render and the
function skips verification (fine for dev). With them set, a customer must pass the
challenge before an SOS or assessment can be submitted.

---

## 6. Point the app at Supabase

**This is already wired — you don't edit any code.** The app is dual-mode:

- **No env set** → runs on the in-memory seed with the demo role switcher (the
  prototype), so nothing breaks while you set things up.
- **Env set** → `src/data/store.js` hydrates from `api.fetchAll()`, subscribes to
  realtime, and every action (`submitScorecard`, `raiseSOS`, `acceptSOS`, …) routes
  through Supabase. `App.jsx` signs customers in anonymously, reads the signed-in
  user's role via the `whoami()` RPC, and shows only that role's surface — no demo
  switcher. Staff use **Staff sign in** from the account menu.

So step 6 is just: fill `.env` (next section) and it goes live. That's it.

---

## 7. Test locally

```bash
npm install
npm run dev
```

- Sign in as your admin → the Admin surfaces should load live rows.
- Sign in as a provider → readiness toggle and alerts should be their own.
- Score an assessment as an assessor → watch the alert rows appear (and a WhatsApp/SMS
  arrive if that channel's secrets are set).

Check the function logs if a send doesn't land: `supabase functions logs dispatch-alerts`.

---

## 8. Deploy to Vercel

```bash
# from the repo, once (or connect the Git repo in the Vercel dashboard)
vercel

# production
vercel --prod
```

`vercel.json` already ships the security headers (HSTS, nosniff, X-Frame-Options,
Referrer-Policy) and the SPA rewrite with `privacy.html` excluded, so the static
privacy page is served directly and the service worker doesn't hijack it.

---

## 9. Go-live checklist

- [ ] Only the **anon** key is in the client / Vercel env; `service_role` is nowhere
      near the frontend.
- [ ] RLS is **on** for every table (it is, from 0002) and the `providers_public`
      view is the only provider data the anon key can read.
- [ ] Cloudflare **Turnstile** added to the public SOS / assessment forms (site key in
      env, verify the token in a small edge function or DB `before insert` check).
- [ ] Real provider phone numbers and consent to be contacted, before any channel is
      switched on.
- [ ] Custom domain `lastminutekenya.com` on Vercel with HTTPS enforced.
- [ ] A Privacy Policy review with the DPA-2019 controller details (already in
      `public/privacy.html`).

---

### Where each concept lives

| Concept | File |
|---|---|
| Scorecard scoring (RAG) | `src/lib/scorecard.js` (client) + inline in the edge function |
| Provider matching | `src/lib/matching.js` (client) + inline in the edge function |
| Alert composition + sending | `supabase/functions/dispatch-alerts/index.ts` |
| Reads / mutations / realtime | `src/data/api.js` |
| Tables + views + auth trigger | `supabase/migrations/0001_schema.sql` |
| Security policies | `supabase/migrations/0002_rls.sql` |
