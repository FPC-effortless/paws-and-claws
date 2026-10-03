/* ============================================================
   Paws & Claws — Convex schema
   ------------------------------------------------------------
   Mirrors the relational model documented at the top of
   assets/js/data.js. Convex is an *optional* upgrade path: the
   site runs entirely on data.js + localStorage until you run
   `npx convex dev`, then this schema becomes the source of
   truth and convexClient.js swaps in.
   ============================================================ */

export default {
  /* ---------------------------- people ---------------------------- */
  owners: {
    fullName: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    phone: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    plan: v.optional(v.string()),
    migrated: v.optional(v.boolean()),
    createdAt: v.string(),
  },
  pets: {
    ownerId: v.id("owners"),
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
    ownerId: v.id("owners"),
    petId: v.id("pets"),
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
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
  },
  /* Leave is a table instead of a provider array so staff can
     admin it without rewriting a provider record. */
  staffLeave: {
    providerId: v.string(),
    date: v.string(),
    reason: v.string(),
    createdAt: v.optional(v.string()),
  },
  waitlist: {
    ownerId: v.id("owners"),
    serviceId: v.string(),
    providerId: v.string(),
    note: v.optional(v.string()),
    createdAt: v.string(),
  },

  /* ---------------------------- retail ---------------------------- */
  products: {
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
    ownerId: v.id("owners"),
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
  },
  listings: {
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
    ownerId: v.id("owners"),
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
    ownerId: v.id("owners"),
    direction: v.string(),
    channel: v.string(),
    subject: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  },
  notifications: {
    ownerId: v.id("owners"),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  },

  /* ---------------------------- admin ----------------------------- */
  admins: {
    email: v.string(),
    name: v.string(),
    role: v.string(),
    providerId: v.optional(v.string()),
    passwordHash: v.string(),
  },
  /* Session tokens issued by convex/auth.js. Deleting a row is
     the logout. */
  sessions: {
    subjectId: v.id("owners"),
    subjectType: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  audit: {
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
