# 🐾 Paws & Claws

A complete pet-care platform — storefront, booking portal, pet marketplace,
member portal, and a full admin control panel (ERP/CRM) — built as a fast,
dependency-free static site (HTML + CSS + vanilla JS) with **no build step**,
ready to deploy to **Vercel**.

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
**this is not real authentication**. Before going live, replace the auth module
with a real backend or a service like Clerk, Auth0, or Supabase.

## Structure

```
├── index.html · services.html · shop.html · pets.html
├── membership.html · account.html · contact.html
├── admin/index.html              # admin control panel
├── vercel.json                   # Vercel config (static, /admin rewrite)
├── assets/
│   ├── css/
│   │   ├── style.css             # design system: tokens, reset, header/footer, forms, modals
│   │   ├── pages.css             # storefront page styles
│   │   └── platform.css          # booking, shop, pets, member portal, contact, admin
│   └── js/
│       ├── app.js                # core: cart, auth, toasts, modals
│       ├── data.js               # PNC_DB: seed data, store, booking/order/CRM engine
│       ├── nav.js                # shared header, cart modal, footer, notifications
│       ├── home.js · booking.js · shop.js · pets.js
│       ├── account.js · contact.js · admin.js
└── test/harness.js               # data-layer test suite (node test/harness.js)
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
node test/harness.js
```

## Deploy to Vercel

Zero-config — the repo is static, so `vercel.json` only adds clean URLs, an
`/admin` → `/admin/index.html` rewrite, and long-cache headers for `/assets`.

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

Or import the repo on [vercel.com](https://vercel.com) — Framework Preset
**Other** is auto-detected; no build or output commands are needed.

## Tech

- Zero dependencies. No npm install, no framework, no bundler.
- Google Fonts (Fredoka + Quicksand) loaded via CDN.
- Accessible-ish: semantic landmarks, `aria-modal` dialogs, visible focus
  rings, `prefers-reduced-motion` support, keyboard-dismissible modals.
