/* ============================================================
   Paws & Claws — Convex schema
   ------------------------------------------------------------
   Mirrors the relational model documented at the top of
   assets/js/data.js. Convex is an *optional* upgrade path: the
   site runs entirely on data.js + localStorage until you run
   `npx convex dev`, then this schema becomes the source of
   truth and convexClient.js swaps in.

   NOTE ON IDS: the client store addresses every row by a stable
   *string* id ("ow-1", "pt-1", "bk-1001" …) that is also stored
   as a field, because those ids are what URLs, notifications and
   the admin console echo back to users. Convex issues its own
   `_id` for each row, so the string id is declared here as
   `v.string()` and referenced the same way — foreign keys are
   `v.string()`, not `v.id()`, precisely so a seeded "ow-1" can
   point at a seeded "pt-1" without a lookup pass. Referential
   integrity is enforced by data.js, as it already is in local
   mode.
   ============================================================ */

export default {
  /* ---------------------------- people ---------------------------- */
  owners: {
    id: v.optional(v.string()),
    fullName: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    phone: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    plan: v.optional(v.string()),
    migrated: v.optional(v.boolean()),
    /* Set by seed:all when a client-format FNV hash had to be
       rehashed for the Convex deployment (see convex/seed.js). */
    hashUpgraded: v.optional(v.boolean()),
    createdAt: v.string(),
  },
  pets: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    petName: v.string(),
    species: v.string(),
    breed: v.optional(v.string()),
    dob: v.optional(v.string()),
    sex: v.string(),
    altered: v.string(),
    weightKg: v.number(),
    microchip: v.optional(v.string()),
    coat: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    vaccines: v.optional(
      v.array(
        v.object({
          name: v.string(),
          date: v.string(),
          lot: v.optional(v.string()),
          status: v.string(),
        })
      )
    ),
    notes: v.optional(v.string()),
    createdAt: v.string(),
  },

  /* --------------------------- bookings --------------------------- */
  bookings: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    petId: v.string(),
    serviceId: v.string(),
    providerId: v.string(),
    date: v.string(),
    hour: v.number(),
    duration: v.number(),
    status: v.string(),
    deposit: v.number(),
    total: v.number(),
    paid: v.number(),
    intake: v.optional(v.any()),
    internalNotes: v.optional(v.any()),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    /* Plan discount captured at booking time, mirroring data.js. */
    discountRate: v.optional(v.number()),
    createdAt: v.string(),
  },
  /* Leave is a table instead of a provider array so staff can
     admin it without rewriting a provider record. */
  staffLeave: {
    id: v.optional(v.string()),
    providerId: v.string(),
    date: v.string(),
    reason: v.string(),
    createdAt: v.optional(v.string()),
  },
  waitlist: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    petId: v.optional(v.string()),
    serviceId: v.string(),
    providerId: v.string(),
    note: v.optional(v.string()),
    createdAt: v.string(),
  },

  /* ---------------------------- retail ---------------------------- */
  products: {
    id: v.optional(v.string()),
    name: v.string(),
    cat: v.string(),
    price: v.number(),
    badge: v.optional(v.string()),
    rating: v.optional(v.number()),
    icon: v.optional(v.string()),
    desc: v.string(),
    species: v.optional(v.array(v.string())),
    age: v.optional(v.array(v.string())),
    size: v.optional(v.array(v.string())),
    stock: v.number(),
    sku: v.optional(v.string()),
    lowAt: v.number(),
    cost: v.optional(v.number()),
    lowStock: v.optional(v.boolean()),
  },
  orders: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    placedAt: v.string(),
    items: v.array(
      v.object({
        productId: v.string(),
        qty: v.number(),
        price: v.number(),
      })
    ),
    fulfillment: v.string(),
    address: v.optional(v.string()),
    status: v.string(),
    stage: v.string(),
    total: v.number(),
    paid: v.number(),
    refunded: v.optional(v.number()),
    method: v.optional(v.string()),
    /* Plan discount captured at checkout, mirroring data.js. */
    discountRate: v.optional(v.number()),
  },
  listings: {
    id: v.optional(v.string()),
    species: v.string(),
    name: v.string(),
    breed: v.string(),
    sex: v.string(),
    ageMonths: v.number(),
    price: v.number(),
    status: v.string(),
    icon: v.optional(v.string()),
    photos: v.optional(v.number()),
    breeder: v.optional(v.string()),
    health: v.optional(v.array(v.string())),
    pedigree: v.optional(v.string()),
    temperament: v.optional(v.array(v.string())),
    bio: v.optional(v.string()),
    listedAt: v.string(),
  },
  payments: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    brand: v.string(),
    last4: v.string(),
    expMonth: v.number(),
    expYear: v.number(),
    primary: v.boolean(),
  },

  /* --------------------------- services --------------------------- */
  services: {
    group: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    price: v.number(),
    duration: v.number(),
    deposit: v.boolean(),
    requiresVaccine: v.boolean(),
    staff: v.array(v.string()),
    desc: v.string(),
    popular: v.optional(v.boolean()),
  },
  serviceGroups: {
    id: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    blurb: v.string(),
  },
  providers: {
    id: v.string(),
    name: v.string(),
    role: v.string(),
    title: v.string(),
    group: v.string(),
    icon: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    off: v.array(v.number()),
    bio: v.string(),
  },

  /* ---------------------------- comms ----------------------------- */
  messages: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    direction: v.string(),
    channel: v.string(),
    subject: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  },
  notifications: {
    id: v.optional(v.string()),
    ownerId: v.string(),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  },

  /* ---------------------------- admin ----------------------------- */
  admins: {
    id: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    providerId: v.optional(v.string()),
    passwordHash: v.string(),
  },
  /* Session tokens issued by convex/auth.js. Deleting a row is
     the logout.

     `subjectId` is the string id of the subject, and
     `subjectType` says which collection it belongs to ("owner" or
     "admin"). It is deliberately NOT v.id(): an admin session
     points into `admins`, not `owners`, so a typed id here would
     make every admin sign-in throw on validation. Lookups go
     through auth:session, which dispatches on subjectType. */
  sessions: {
    subjectId: v.string(),
    subjectType: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  audit: {
    id: v.optional(v.string()),
    adminEmail: v.string(),
    action: v.string(),
    detail: v.string(),
    at: v.string(),
  },
  /* siteName, hours, toggles, hotline … mirrors db.cms */
  cms: {
    siteName: v.string(),
    tagline: v.optional(v.string()),
    banner: v.optional(v.string()),
    heroTitle: v.optional(v.string()),
    emergencyHotline: v.string(),
    emergencyNote: v.string(),
    hours: v.any(),
    toggles: v.any(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
  },
};
