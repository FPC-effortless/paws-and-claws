# 🐾 Paws & Claws

A complete pet-care platform — storefront, booking portal, pet marketplace,
member portal, and a full admin control panel (ERP/CRM) — built as a fast,
dependency-free static site (HTML + CSS + vanilla JS) with **no build step**,
deployed to **GitHub Pages**.

## Pages

### Storefront

| Page | What's on it |
|---|---|
| `index.html` | Home — CMS-driven hero, service groups, featured pet listings, bestsellers, perks, reviews, pet-care tips, newsletter |
| `services.html` | Services & booking portal — 4-step wizard (service → provider/time → pet/intake → confirm), real availability windows, 30% deposit, waitlist join |
| `shop.html` | Shop & marketplace — product grid with category/price filters, 5 sort orders, `?cat=` deep links, cart, member-gated checkout |
| `pets.html` | Pet marketplace — adoption/listing cards with health records, pedigree, temperament and inquiry flow |
| `membership.html` | Plan comparison (Puppy Pass / Adult Adventurer / Senior Snuggler), signup + login, FAQ |
| `account.html` | Member portal — dashboard, bookings, orders, pets & vaccines, payment methods, messages, plan switching, sign out |
| `contact.html` | Contact & emergency — emergency hotline band, store info, weekly hours with open/closed status, map, validated form, FAQ |
| `admin/index.html` | **Admin Control Panel** — dashboard, bookings, CRM, POS, inventory, CMS/staff/roles (see below) |

## Member demo accounts

The seeded members can sign in at **`membership.html`** (or any gated flow)
and then use the member portal, booking wizard, and checkout:

| Member | Email | Password |
|---|---|---|
| Elena Vasquez | `elena@example.com` | `member123` |
| Marcus Dunn | `marcus@example.com` | `member123` |
| Priya Raman | `priya@example.com` | `member123` |

Their pets, bookings, and orders are seeded by `assets/js/data.js`.

## Admin Control Panel (ERP/CRM)

Role-based access with four demo roles. Sign in at **`/admin`**:

| Role | Email | Password | Scope |
|---|---|---|---|
| Super | `owner@pawsandclaws.example` | `admin123` | Everything |
| Front desk | `front@pawsandclaws.example` | `desk123` | Bookings, CRM, POS |
| Provider | `rosa@pawsandclaws.example` | `rosa123` | Own bookings & pets |
| Retail | `retail@pawsandclaws.example` | `retail123` | POS & inventory |

Sections (each permission-gated via `PNC_DB.can`):

- **Dashboard** — KPIs (revenue, bookings today, owners, pets, low stock,
  pending orders/vaccines, waitlist, unread notifications), alerts, revenue
  bars, recent audit log
- **Bookings** — filterable schedule, mark complete, add notes, cancel,
  manage waitlist
- **CRM** — owner directory with lifetime spend, pet records, vaccine
  approval queue, global search
- **POS** — charge an owner for services/products, track order stages,
  issue refunds
- **Inventory** — stock adjust (±1 / +10), low-stock alerts, edit products,
  approve or reject marketplace listings
- **CMS & Staff** — edit hero/banner, hotline, hours, contact details and
  service pricing; manage provider leave; review role permission matrix

## State & data

Everything is seeded into `localStorage` under the `pnc_` prefix by
`assets/js/data.js` (`PNC_DB.seed()` / `PNC_DB.reset()`). The admin panel has a
"Reset demo data" button. Passwords use a demonstration-only scramble —
**this is not real authentication**.

### Optional: add a real backend (Convex)

The site is **static-first** — `data.js` is the source of truth and nothing
requires a server. When you want real auth plus state shared across devices,
an optional [Convex](https://convex.dev) layer ships with the repo and stays
inert until you turn it on:

```bash
npm install            # adds the convex dev dependency
npx convex dev         # signs in with your GitHub, creates the deployment
```

Then open the site once and run in the browser console:

```js
PNC_CONVEX.seedAll();   // uploads the seeded store to Convex
```

`assets/js/convexClient.js` loads the Convex browser client only after a
deployment URL exists, so until then the site behaves exactly as before.
`convex/schema.js` mirrors the relational model documented at the top of
`data.js`, and `convex/auth.js` replaces the demo scramble with server-side
**scrypt** hashing plus expiring session tokens.

### Optional: add real identity (Clerk)

The same static-first rule applies to identity. An optional
[Clerk](https://clerk.com) layer ships in `assets/js/clerk.js` and is
**inert until you configure it** — no key, no Clerk call is ever made.

When Clerk is configured it is the **sole identity provider** for members
*and* staff (Replace mode): the sign-in/sign-up forms on `membership.html`,
`account.html` and `admin/index.html` are swapped for Clerk's hosted UI,
loaded from Clerk's own CDN the same way the Convex client is.

1. Create a project at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Copy the **publishable** key (`pk_test_…`) and paste it into
   `assets/js/clerk.js` — it is the one place the key lives, and it is read
   by every page. (The **secret** key never goes in this repo; it belongs in
   the Convex dashboard.)
3. Provision staff by opening each staff user in the Clerk dashboard and
   setting `publicMetadata`:
   - `role` — one of `super`, `desk`, `provider`, `retail`, which maps onto
     the RBAC table in `data.js`. A user with no `role` is a plain member.
   - `providerId` — required for `provider` (e.g. `"Rosa"`), so a groomer or
     vet is scoped to their own schedule and customers.
   - `plan` — optional, for members (`puppy` / `adult` / `senior`), so member
     discounts still resolve.
4. Done. `PNC_DB.currentOwner()` / `PNC_DB.currentAdmin()` resolve the Clerk
   user to a row in the local store on first sight, so bookings, orders and
   notifications still attach.

**Demo mode.** With no key configured (or `?demo=1`, or `sessionStorage`),
the site runs in DEMO MODE and the local forms stay as the documented demo
path. This is *not* an authentication fallback — Clerk is still the only
thing that can issue a real session, and no session is ever minted by the
demo path. It exists so the deployed demo and the test harness stay usable
while the Clerk project is being created.

## Structure

```
├── index.html · services.html · shop.html · pets.html
├── membership.html · account.html · contact.html
├── admin/index.html              # admin control panel
├── vercel.json                   # static config (clean URLs, /admin rewrite, cache headers)
├── .github/workflows/deploy.yml  # GitHub Pages deploy (upload-pages-artifact, path: .)
├── convex.json                   # Convex config (optional backend)
├── convex/                       # optional backend
│   ├── schema.js                 # mirrors the data.js relational model
│   ├── auth.js                   # scrypt hashing + session tokens
│   └── seed.js                   # one-time upload of the local store
├── assets/
│   ├── css/
│   │   ├── style.css             # design system: tokens, reset, header/footer, forms, modals
│   │   ├── pages.css             # storefront page styles
│   │   └── platform.css          # booking, shop, pets, member portal, contact, admin
│   └── js/
│       ├── app.js                # core: cart, toasts, modals, password strength
│       ├── data.js               # PNC_DB: seed data, store, booking/order/CRM engine
│       ├── nav.js                # shared header, cart modal, footer, notifications
│       ├── convexClient.js       # optional Convex sync (inert until configured)
│       ├── clerk.js              # optional Clerk identity (inert until keyed)
│       ├── home.js · booking.js · shop.js · pets.js
│       ├── account.js · contact.js · admin.js
└── test/
    ├── harness.js             # data-layer suite (node test/harness.js)
    └── clerk_demo.js          # demo-mode gate for the identity layer
```

## Run locally

No build step. Open `index.html` in a browser, or:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Run the data-layer tests anytime:

```bash
node test/harness.js        # data layer + Clerk identity bridge
node test/clerk_demo.js     # identity layer degrades to demo mode, never crashes
```

## Deploy

The repo is static, so there is nothing to build. A GitHub Actions workflow
(`.github/workflows/deploy.yml`) deploys to **GitHub Pages** on every push to
`main` — it just uploads the tree as-is with `upload-pages-artifact` and
publishes it. Enable Pages in the repo settings (Source: **GitHub Actions**)
and the next push goes live.

`vercel.json` is retained for anyone who prefers Vercel: it only adds clean
URLs, an `/admin` → `/admin/index.html` rewrite, and long-cache headers for
`/assets`. Neither config runs a build or an output command.

## Tech

- Zero dependencies. No npm install, no framework, no bundler.
- Google Fonts (Fredoka + Quicksand) loaded via CDN.
- Accessible-ish: semantic landmarks, `aria-modal` dialogs, visible focus
  rings, `prefers-reduced-motion` support, keyboard-dismissible modals.
