# Security and workflow review — 8 October 2026

Implemented fixes:

- Require verified email for the initial link to an unbound customer/staff record; reject claims on records bound to another Clerk subject. Strip internal customer notes from member responses and reject member edits to those notes.
- Strip product costs and staff leave reasons/identifiers from public responses. Share anonymous occupied time slots so other customers' appointments block availability without exposing their records. Use real booking availability in hosted mode instead of simulated closures.
- Clear private browser snapshots when backend authentication expires; discard responses arriving after a session change.
- Escape edited catalog icons and service-group text before rendering. Add clickjacking protection through `X-Frame-Options: DENY`.
- Publish only HTML and assets through `dist/`, with deployment isolation and asset checks in CI.
- Limit contact/inquiry submissions to five per ten minutes per authenticated identity or guest email. Guest email throttling is a basic control; distributed abuse still needs an edge rate limiter or bot protection.
- Repair the admin dashboard shortcut and return identifiers required by stock, listing, service, and order confirmations. Refresh hosted data through the dashboard refresh control.
- Add admin booking confirmation/rescheduling controls. Hide fulfillment controls on closed orders and waitlist removal from unauthorized roles. Reject leave dates that overlap active appointments and validate dates without timezone-dependent conversions.
- Retain inquiry contact details, show inquiries in admin inventory, and store member confirmations in the authoritative inbox. Prevent concurrent inquiry/POS submissions.
- Read current catalog prices in the cart; discard malformed, negative, and missing-product saved lines. Refresh catalog, services, CMS/contact details, and shop facets after backend data loads.
- Remove inactive wishlist/social controls and replace the false newsletter subscription confirmation with an availability message. Preserve explicit local demo mode across navigation while hosted deployments continue rejecting demo mode.

Verification:

- `npm test`: existing member/admin tests plus account-claim attacks, private-data filtering, booking overlap/self-rescheduling, closed orders, submission throttling, malformed carts, current prices, and expired-auth snapshot isolation.
- `npm run test:build`: public page assets exist; backend/test/tool/configuration paths are excluded from the deployment.
- `npm audit`: zero reported dependency vulnerabilities at review time.
- Local browser checks: dashboard booking shortcut; stock increment/decrement; CRM customer view and portal messaging; member inbox/read action; pet editing/saving; all member tabs; cart quantity/totals and demo checkout redirect; inquiry submission and contact details in admin.

Deployment and remaining integration work:

- Deploy the updated Convex schema/functions (including `submissionLimits`) before deploying the frontend. Confirm Clerk's Convex token includes the standard `email_verified` claim; [Convex documents it as `identity.emailVerified`](https://docs.convex.dev/auth/functions-auth).
- Live hosted authentication and each real staff role still need production acceptance testing. This review used local demo UI and real backend handlers running against an in-memory test database; it did not deploy or mutate production data.
- Online checkout, refunds, saved payment methods, self-service deposit bookings, and paid membership changes require payment/subscription integration. They remain unavailable in production.
- Newsletter delivery and automated email/SMS are not integrated. Portal messages work within the application; staff must reply to guest inquiries/contact requests through their existing communication service.

Passing these checks does not establish that every production integration or every possible interaction is error-free.


Physical-store update (2026-10-08):

- Store location: Amasoma. Currency: NGN (naira). Counter payments: cash and bank transfer only. Placeholder phone, email and US map are removed; a real phone number and precise street directions remain to be supplied. Legacy template contact values are normalized without overwriting later CMS edits.
- Template opening hours are unpublished. The admin content form can publish real hours and closed days; the backend validates the complete schedule.
- Walk-in checkout requires no customer account. Catalog products use server prices, whole quantities, aggregate stock validation, and transactional stock reduction. Custom items retain descriptions. Cash received/change, transfer references, sale history and printable receipts are available.
- Sale request IDs and appointment payment IDs prevent duplicate writes on retry. Payment records do not initiate a bank transfer or verify settlement automatically; staff record payments they have received.
- Authorized admins can record completed cash or bank-transfer refunds against in-store sales. Refunds reduce net revenue; staff check and adjust returned inventory separately.
- Staff can create customers without email, register pets, add vaccine records for review, create in-store/phone appointments, and collect appointment deposits/balances. Vaccine and schedule checks still apply. Service payment revenue is not duplicated as a retail order.
- Public pages explain visiting the store, optional accounts, and online appointment/contact tools. Paid subscription plans remain unavailable. Live service prices do not inherit sample membership discounts.
- Internet is required for production writes, as requested. No internet-outage transaction queue is included.
- All catalog/service amounts remain sample prices; the currency switch is not an exchange-rate conversion. Set actual naira prices and confirm store hours before launch.
- New backend fields/indexes: orders item label, requestId index, payment reference/cash amounts and storeRefunds; bookings storePayments. Deploy Convex schema/functions before the matching frontend.
- Verification: local/server workflow tests cover guest sales, authoritative prices, stock limits, quantities, insufficient cash, retries, no-email customers, staff-created bookings, payment limits, and unauthorized writes. Browser checks cover cash receipt/change, no-email customer/pet registration, appointment creation, and bank-transfer settlement. Production was not changed.
