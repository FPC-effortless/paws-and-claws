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

GitHub Actions runs the same regression and production-safety suite for pushes to `main` and pull requests. Vercel builds and deploys the project from the connected GitHub repository.

## Clerk + Convex production setup

### 1. Create Clerk

Create a Clerk application and configure the sign-in methods and users you want to allow. Use the production Clerk instance for the hosted site; development keys (`pk_test_...`) are not production credentials.

Staff authorization is determined from the server-side Convex `admins` table. Do not treat browser-visible metadata as an authorization boundary.

Activate Clerk's Convex integration in the Clerk Dashboard. The application requests a Clerk token using the template name **`convex`**. Use the integration's recommended template/configuration and make sure its audience is `convex`.

Set the Convex deployment environment variable:

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN "https://clerk.<your-domain>.com"
```

Use the full HTTPS Frontend API URL shown by Clerk for the production instance. For local development, configure the development issuer separately with `npx convex env set --deployment local CLERK_JWT_ISSUER_DOMAIN "https://<your-instance>.clerk.accounts.dev"`.

### 2. Configure the Vercel production project

In the Vercel project, add these environment variables for Production (and Preview if you want authenticated previews):

| Variable | Value |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | Clerk production publishable key beginning `pk_live_` |
| `CONVEX_URL` | Production Convex deployment URL ending in `.convex.cloud` |

The static client uses the public Clerk publishable key in `assets/js/clerk.js` and the Convex deployment URL in `assets/js/convexClient.js`. Keep them aligned with the Production values above when rotating either value. Both values are public by design; the Clerk secret key is not needed by this client or by Convex's Clerk JWT verification. Never put a Clerk secret key or bootstrap secret in frontend code. `npm run build` copies the pinned Convex browser SDK into the deployed assets so the site does not depend on a third-party CDN at runtime.

### 3. Deploy Convex

```bash
npm install
npx convex dev
```

These commands configure the development deployment. Set `CLERK_JWT_ISSUER_DOMAIN` on the production deployment separately before deploying.

For production, deploy the Convex backend after setting the production issuer:

```bash
npx convex deploy
```

Keep the Vercel values above aligned with the defaults in `assets/js/clerk.js` and `assets/js/convexClient.js`. Clerk must also allow the website's production origin and redirect URLs. The initial production Convex database should be populated with reviewed real data; do not run the demo snapshot bootstrap against production.

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

Vercel production deploys are test-gated by GitHub Actions:

1. pushes to `main` start the GitHub Actions regression and production-safety suite;
2. Vercel automatically builds and deploys the connected `main` branch.

Pull requests run the same test job without updating the Vercel production deployment.

Vercel serves the static site with short-lived asset caching and basic browser security headers.

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
