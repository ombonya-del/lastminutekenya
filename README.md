# LastMinuteKenya

**When an event provider flops, the Last Minute Network steps in.**

A trust-and-rescue platform for event service delivery in Kenya. It fills the gap
behind all those social-media horror stories — the caterer who vanishes hours before
the party, the tent company that never shows for the wedding — with a vetted network
of providers on standby and an intelligence layer that warms them up *before* the
rescue call even comes.

This repository is the **working prototype**: an installable PWA with all four
surfaces running on realistic seed data. There is no backend yet — every action is
an in-memory mutation shaped exactly like the Supabase call that will replace it.

---

## The two pathways

1. **Public PWA (self-serve).** A client whose provider has gone dark opens the app,
   raises an **SOS** with the event, location, time and what's needed. The nearest
   capable providers are matched and alerted instantly.

2. **Site Assessment (assurance).** A client with *doubts* about their booked
   provider requests a **Site Assessor**, who physically visits the venue a few hours
   before the event, talks to the client, the provider and previous clients, and
   produces a **Last Minute Scorecard** (Red / Amber / Green) and a report. If the
   scorecard is Amber or Red, the system **pre-emptively alerts nearby providers** —
   advisory email / WhatsApp / SMS saying *where*, *what's likely needed* and *how
   long until the event* — so the network is already moving before the client calls.

## The four surfaces (one app, role switcher in the top bar)

| Surface | Route | What it does |
|---|---|---|
| **Customer** | `/customer` | Public PWA. Raise an SOS, request an assessor, track status, read the scorecard. |
| **Provider** (Last Minute Network) | `/provider` | Readiness toggle, incoming pre-dispatch intelligence alerts, accept rescue jobs. |
| **Assessor** | `/assessor` | Assigned visits → fill the scorecard → submit (which alerts the network). |
| **Admin** | `/admin` | Overview KPIs, all scorecards, live dispatch board with ranked matches, alert log, coverage map. |

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build + service worker
npm run preview      # preview the build
```

Deploy to Vercel as-is — `vercel.json` ships the security headers and the SPA
rewrite (with `privacy.html` excluded so the static privacy page is served directly).

---

## Architecture

React 18 + Vite + `react-router-dom`, installable PWA via `vite-plugin-pwa`
(`autoUpdate`). Built to the **CMT house style**: Lora + Nunito Sans, a restrained
navy/terracotta palette with RAG reserved for scorecards, mobile-first with a bottom
nav and safe-area insets, a DPA-2019/GDPR privacy page linked from the shell, and
security headers baked in.

```
src/
  data/
    seed.js          # all mock data — maps 1:1 to the tables below
    store.js         # in-memory reactive store; every action = a future Supabase mutation
  lib/
    scorecard.js     # weighted RAG scoring from assessor criteria
    matching.js      # rank providers by distance / rating / readiness / capacity
    alertEngine.js   # build the pre-dispatch advisory alerts (simulated sends)
    geo.js           # Nairobi area coordinates + haversine distance
    format.js        # categories, event types, currency, time helpers
  components/        # ui.jsx (primitives) + domain.jsx (scorecard, alert, provider row)
  surfaces/          # Customer / Provider / Assessor / Admin
```

### Data model (Supabase target)

The seed shapes are the table shapes. Wiring the backend is mechanical:

| Table | Key columns | Notes / RLS |
|---|---|---|
| `providers` | id, name, lead, categories[], base(lat,lng), rating, capacity, readiness, response_mins, channels, preferred_channel | Public can read name/area/rating; contact behind RLS. |
| `clients` | id, name, phone | **PII** — `anon` may INSERT, never SELECT. |
| `assessors` | id, name, phone, area, rating, visits | Staff table. |
| `events` | id, client_id, type, title, area, coord, venue, starts_at, guests, booked_provider, category, budget | Owner + assigned staff read. |
| `assessments` | id, event_id, requested_by, assessor_id, status, concern, answers(jsonb), notes, band, score, timestamps | Client reads own; assessor reads assigned. |
| `sos_jobs` | id, event_id, from_assessment, category, status, note, accepted_by, raised_at | Providers read open jobs in their categories. |
| `alerts` | id, provider_id, channel, kind, likelihood, category, area, ref_id, message, status, sent_at, acknowledged | Written by the trigger below. |

**Security (house style, non-negotiable):** only the public **anon** key ships to the
client. The service-role key and every channel secret (SMS / WhatsApp / email) live
in Supabase Edge Function env via `supabase secrets set …`. `anon` may INSERT to the
public SOS/assessment forms (guard with Cloudflare Turnstile) but must **not** SELECT
PII tables. Rely on RLS, not client checks.

### How the pre-dispatch alert engine will go live

`submitScorecard()` and `raiseSOS()` already compute the matches and build the alert
rows. In production:

1. The mutation inserts the `alerts` rows (or a Postgres trigger does, off the
   scorecard band).
2. A Supabase **Edge Function** reads each row and calls the real channel:
   **Africa's Talking** for SMS, the **WhatsApp Cloud API** for WhatsApp, and an
   email provider — chosen per the provider's `preferred_channel`.
3. Realtime pushes the acknowledgements back to the admin dispatch board.

The advisory copy deliberately withholds the client's identity — only area, need and
timing go out until a provider engages.

---

## Roadmap

- [x] All four surfaces on live seed data (this prototype)
- [x] Last Minute Scorecard (weighted RAG) + report readout
- [x] Provider matching + simulated pre-dispatch alerts
- [ ] **Choose the real alert channels & wire them** (Africa's Talking / WhatsApp
      Cloud API / email) — *deferred decision*
- [ ] Supabase schema, RLS policies, and auth (customer / provider / assessor / admin roles)
- [ ] Turnstile on public write forms; edge-function guards
- [ ] Real geocoding of addresses; provider live location
- [ ] Payments / deposits and provider payouts

---

_A Community Media Trust platform. Controller: Community Media Trust, P.O. Box
9190–00300, Kirichwa Road, ADK House 1, Kilimani, Nairobi._
