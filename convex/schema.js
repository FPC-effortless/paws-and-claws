import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const vaccine = v.object({
  name: v.string(),
  date: v.string(),
  lot: v.optional(v.string()),
  status: v.string(),
});

export default defineSchema({
  submissionLimits: defineTable({ key: v.string(), windowStart: v.number(), count: v.number() }).index("by_key", ["key"]),
  owners: defineTable({
    id: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    fullName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    plan: v.optional(v.string()),
    migrated: v.optional(v.boolean()),
    createdAt: v.string(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  pets: defineTable({
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
    vaccines: v.optional(v.array(vaccine)),
    notes: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    createdAt: v.string(),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"]),

  bookings: defineTable({
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
    storePayments: v.optional(v.array(v.object({requestId: v.string(), amount: v.number(), method: v.string(), reference: v.string(), at: v.string()}))),
    paymentStatus: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    intake: v.optional(v.any()),
    internalNotes: v.optional(v.any()),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    discountRate: v.optional(v.number()),
    createdAt: v.string(),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"])
    .index("by_providerId_date", ["providerId", "date"]),

  staffLeave: defineTable({
    id: v.optional(v.string()),
    providerId: v.string(),
    date: v.string(),
    reason: v.string(),
    createdAt: v.optional(v.string()),
  })
    .index("by_external_id", ["id"])
    .index("by_providerId_date", ["providerId", "date"]),

  waitlist: defineTable({
    id: v.optional(v.string()),
    ownerId: v.string(),
    petId: v.optional(v.string()),
    serviceId: v.string(),
    providerId: v.string(),
    note: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"]),

  products: defineTable({
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
    imageStorageId: v.optional(v.id("_storage")),
  }).index("by_external_id", ["id"]),

  orders: defineTable({
    id: v.optional(v.string()),
    ownerId: v.string(),
    placedAt: v.string(),
    items: v.array(v.object({
      productId: v.string(),
      label: v.optional(v.string()),
      qty: v.number(),
      price: v.number(),
    })),
    requestId: v.optional(v.string()),
    reference: v.optional(v.string()),
    tendered: v.optional(v.number()),
    change: v.optional(v.number()),
    fulfillment: v.string(),
    address: v.optional(v.string()),
    status: v.string(),
    stage: v.string(),
    total: v.number(),
    paid: v.number(),
    refunded: v.optional(v.number()),
    storeRefunds: v.optional(v.array(v.object({requestId: v.string(), amount: v.number(), method: v.string(), reason: v.string(), at: v.string()}))),
    paymentStatus: v.optional(v.string()),
    method: v.optional(v.string()),
    discountRate: v.optional(v.number()),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"])
    .index("by_requestId", ["requestId"]),

  listings: defineTable({
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
    imageStorageId: v.optional(v.id("_storage")),
  }).index("by_external_id", ["id"]),

  payments: defineTable({
    id: v.optional(v.string()),
    ownerId: v.string(),
    brand: v.string(),
    last4: v.string(),
    expMonth: v.number(),
    expYear: v.number(),
    primary: v.boolean(),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"]),

  services: defineTable({
    id: v.optional(v.string()),
    active: v.optional(v.boolean()),
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
    imageStorageId: v.optional(v.id("_storage")),
  }).index("by_external_id", ["id"]),

  serviceGroups: defineTable({
    id: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    blurb: v.string(),
  }).index("by_external_id", ["id"]),

  providers: defineTable({
    id: v.string(),
    active: v.optional(v.boolean()),
    name: v.string(),
    role: v.string(),
    title: v.string(),
    group: v.string(),
    icon: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    off: v.array(v.number()),
    bio: v.string(),
  }).index("by_external_id", ["id"]),

  messages: defineTable({
    id: v.optional(v.string()),
    ownerId: v.string(),
    direction: v.string(),
    channel: v.string(),
    subject: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  }).index("by_ownerId", ["ownerId"]),

  notifications: defineTable({
    id: v.optional(v.string()),
    ownerId: v.string(),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.string(),
  }).index("by_ownerId", ["ownerId"]),

  admins: defineTable({
    id: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    providerId: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  audit: defineTable({
    id: v.optional(v.string()),
    adminEmail: v.string(),
    action: v.string(),
    detail: v.string(),
    at: v.string(),
  }),

  contactMessages: defineTable({
    id: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    ownerId: v.optional(v.string()),
    createdAt: v.string(),
    status: v.string(),
  })
    .index("by_external_id", ["id"])
    .index("by_email", ["email"]),

  inquiries: defineTable({
    id: v.optional(v.string()),
    ref: v.string(),
    ownerId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    listingId: v.string(),
    message: v.string(),
    status: v.string(),
    createdAt: v.string(),
  })
    .index("by_external_id", ["id"])
    .index("by_ownerId", ["ownerId"]),

  cms: defineTable({
    id: v.optional(v.string()),
    siteName: v.string(),
    tagline: v.optional(v.string()),
    banner: v.optional(v.string()),
    heroTitle: v.optional(v.string()),
    catalogConfirmed: v.optional(v.boolean()),
    emergencyHotline: v.string(),
    emergencyNote: v.string(),
    hours: v.any(),
    toggles: v.any(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
  }).index("by_external_id", ["id"]),
});
