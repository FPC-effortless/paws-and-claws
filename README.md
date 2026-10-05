# 🐾 Paws & Claws

Paws & Claws is a static-first pet-care platform with a storefront, booking portal, pet marketplace, member portal, and admin console.

The repository supports two deliberately different environments:

- **Local/demo:** browser-local demo data and demo accounts are allowed.
- **Hosted/production:** Clerk is required for identity and Convex is required for authoritative state and authorization. The application fails closed when either secure service is unavailable. Demo credentials and `?demo=1` are not accepted on hosted deployments.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home, service groups, featured pets, product highlights |
| `services.html` | Service catalog and booking wizard |
| `shop.html` | Product catalog, cart and checkout entry point |
| `pets.html` | Pet marketplace and inquiries |
| `membership.html` | Membership plans and authentication |
| `account.html` | Member portal |
| `contact.html` | Contact, emergency information and message form |
| `admin/index.html` | Staff/admin console |

## Security model

Production identity is provided by Clerk. Application authorization is enforced again inside Convex from the authenticated Clerk identity and the server-side `admins` table.

The browser is not trusted for:

- owner identity
- staff role
- membership entitlement
- pricing/discounts
- inventory
- payment state
- booking ownership
- refund authorization
- audit records

The browser may keep a scoped cache for rendering, but Convex is authoritative for hosted mutations.

## Local demo

Run the static site locally:

```bash
python3 -m http.server 8000
```

or:

```bash
npx serve .
```

The local demo seed is available only on localhost/file-style development environments. Demo credentials are intentionally not rendered or accepted on hosted deployments.

## Test suite

Run:

```bash
npm install
npm test
```

The suite covers the data layer, Clerk demo-mode behavior, and production fail-closed guards.

CI executes the same suite for pull requests and before GitHub Pages deployment.

## Clerk + Convex production setup

### 1. Create Clerk

Create a Clerk application and configure the users/staff you want to allow.

Staff authorization is determined from the server-side Convex `admins` table. Do not treat browser-visible metadata as an authorization boundary.

Create a Clerk JWT template named **`convex`** for the Convex application.

Set the Convex deployment environment variable:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN
```

Use the issuer domain for your Clerk instance.

### 2. Configure the public runtime values

Edit `assets/js/config.js`:

```js
window.PNC_CLERK_PUBLISHABLE_KEY = "pk_...";
window.__PNC_CONVEX_URL__ = "https://....convex.cloud";
```

The Clerk publishable key and Convex URL are public configuration values. Never put a Clerk secret key or bootstrap secret in this file.

### 3. Deploy Convex

```bash
npm install
npx convex dev
```

When the backend is ready:

```bash
npx convex deploy
```

### 4. Bootstrap a non-production/demo deployment

The seed mutation is protected by `PNC_BOOTSTRAP_SECRET` and is not exposed through the browser client.

Set the deployment secret:

```bash
npx convex env set PNC_BOOTSTRAP_SECRET
```

Then run the trusted bootstrap tool after Convex code generation:

```bash
CONVEX_URL="https://....convex.cloud" \
PNC_BOOTSTRAP_SECRET="..." \
node tools/seed-convex.cjs
```

Review the seed data before importing it into any real environment. The repository seed contains demonstration customer and operational records.

## Payments

The application deliberately **fails closed** for hosted online checkout and deposit-required online bookings until a real payment processor is configured.

It does not claim that an order is paid merely because the customer clicked checkout, and it does not claim to have issued a refund when no processor transaction was reversed.

The current POS path records a staff-entered payment event rather than pretending to be a card processor.

## Memberships

The demo supports the three plan labels and discount logic locally.

Hosted paid-plan changes are disabled until subscription billing is configured. A browser caller cannot grant itself a higher paid tier because Convex rejects self-service entitlement changes.

## Booking behavior

Standard appointment services use the provider/leave/overlap availability engine.

Overnight boarding is intentionally not represented as a normal one-day appointment slot. The current UI routes that service to the contact flow rather than exposing an impossible 24-hour slot.

## Repository structure

```
├── index.html · services.html · shop.html · pets.html
├── membership.html · account.html · contact.html
├── admin/index.html
├── assets/
│   ├── css/
│   └── js/
│       ├── config.js
│       ├── data.js
│       ├── app.js
│       ├── nav.js
│       ├── clerk.js
│       ├── convexClient.js
│       └── page controllers
├── convex/
│   ├── auth.config.ts
│   ├── auth.js
│   ├── domain.js
│   ├── schema.js
│   └── seed.js
├── tools/
│   └── seed-convex.cjs
└── test/
    ├── harness.js
    ├── clerk_demo.js
    └── production_guard.js
```

## Deployment

GitHub Pages deployment is test-gated:

1. checkout
2. install test tooling
3. run `npm test`
4. only then deploy the static tree

Pull requests run the same test job without deploying.

Vercel configuration is retained for deployments that prefer Vercel, with short-lived asset caching and basic browser security headers.

## Important limitations

This repository is now designed to **fail safely** where a real financial/identity provider has not been integrated.

Before accepting real customer data, money, medical records, or production appointments, configure and test:

- Clerk identity
- Convex production deployment
- real payment processing
- production data/bootstrap procedure
- operational backup/recovery
- privacy/retention policy
- domain/email/SMS delivery infrastructure
