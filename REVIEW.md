# Remediation review — 10 October 2026

This branch addresses the defects found in the full customer and staff workflow review. It does not deploy or modify production data.

## Correctness and authorization

- Admin grants now conform to the Convex schema and bind both the selected owner record and Clerk subject.
- Booking availability uses the published opening hours, rejects elapsed same-day times, honors the appointment's booked duration during rescheduling, and prevents the same pet from holding overlapping appointments with different providers.
- Staff reset archives providers and services, preserves historical references, and refuses to run while active appointments or waitlist entries exist.
- Provider profiles can be unlinked safely; an account cannot be linked to more than one provider.
- Appointment payments support permission-checked, idempotent cash and bank-transfer refunds with reasons and full audit timestamps.
- Vaccine rules are species-specific and ignore expired records. New records include a validity date.
- The seed operation is non-destructive and only runs against a completely empty application database.

## Catalog and content workflows

- Products and pet listings now have create, edit, image, archive/delete, and publication workflows in the admin console.
- Product names are no longer subject to the service-specific `Paw` naming rule. Service creates and renames enforce it consistently.
- Service creation keeps an uploaded image, and all hosted image attachments require a registered upload owned by the authenticated subject.
- The backend validates image MIME metadata and the 8 MB limit, then deletes rejected uploads.
- Publishing the catalog validates product, active service, and listing completeness.
- The store booking form is rebuilt from current data rather than retaining a stale pet or service list.

## Production and scale safeguards

- Clerk and Convex public configuration is generated from Vercel environment variables; production builds fail when either is missing.
- A Content Security Policy limits scripts, connections, frames, objects, and form targets to the application and required Clerk/Convex endpoints.
- Hosted data subscriptions update the browser when Convex state changes. Large bootstrap views are bounded and fail explicitly instead of making unbounded database reads.
- Guest submissions have both per-sender and global server-side burst limits.
- CI uses reproducible installs, type-checks the Convex functions, runs the complete workflow suite, verifies the isolated static build, and audits production dependencies.

## Provider-dependent capabilities

Online card checkout, card refunds, subscription billing, email/SMS delivery, and edge bot protection still require the store to choose and configure external providers. The production application continues to fail closed for payment and paid-membership actions until those providers are connected. Cash and bank-transfer operations remain available to authorized staff and are recorded as staff-confirmed transactions.

Production acceptance should exercise each real Clerk staff role and the selected payment and messaging providers after their credentials and webhooks are configured.
