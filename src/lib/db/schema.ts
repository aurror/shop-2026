import {
  pgSchema,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const SCHEMA_NAME = process.env.DB_SCHEMA || "student_test";
export const schema = pgSchema(SCHEMA_NAME);

// ─── Auth Tables (NextAuth compatible) ──────────────────────────────────────

export const users = schema.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    email: text("email").unique().notNull(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: text("role").default("customer").notNull(), // customer, staff, admin
    phone: text("phone"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("users_email_idx").on(table.email), index("users_role_idx").on(table.role)]
);

export const accounts = schema.table(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const sessions = schema.table("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = schema.table(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ─── Categories ─────────────────────────────────────────────────────────────

export const categories = schema.table("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── Products ───────────────────────────────────────────────────────────────

export const products = schema.table(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    descriptionHtml: text("description_html"),
    basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
    saleEndsAt: timestamp("sale_ends_at", { mode: "date", withTimezone: true }),
    saleDiscountCode: text("sale_discount_code"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    images: jsonb("images").$type<string[]>().default([]),
    weight: decimal("weight", { precision: 8, scale: 2 }).default("0"),
    featured: boolean("featured").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("19.00").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("products_category_idx").on(table.categoryId),
    index("products_featured_idx").on(table.featured),
    index("products_active_idx").on(table.active),
    index("products_slug_idx").on(table.slug),
  ]
);

// ─── Product Variants ───────────────────────────────────────────────────────

export const productVariants = schema.table(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "H0 Scale / Red"
    sku: text("sku").unique().notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    stock: integer("stock").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
    weight: decimal("weight", { precision: 8, scale: 2 }),
    attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    images: jsonb("images").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("variants_product_idx").on(table.productId),
    index("variants_sku_idx").on(table.sku),
  ]
);

// ─── Product Relations (manual + AI-approved) ───────────────────────────────

export const productRelations = schema.table(
  "product_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    relatedProductId: uuid("related_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    relationType: text("relation_type").default("related").notNull(), // related, accessory, bundle
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("relations_product_idx").on(table.productId),
    uniqueIndex("relations_unique_idx").on(
      table.productId,
      table.relatedProductId,
      table.relationType
    ),
  ]
);

// ─── AI Relation Suggestions ────────────────────────────────────────────────

export const productRelationSuggestions = schema.table(
  "product_relation_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    suggestedProductId: uuid("suggested_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    reasoning: text("reasoning"),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    status: text("status").default("pending").notNull(), // pending, approved, rejected
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
  },
  (table) => [index("suggestions_product_idx").on(table.productId)]
);

// ─── Addresses ──────────────────────────────────────────────────────────────

export const addresses = schema.table(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").default("Standard"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    company: text("company"),
    street: text("street").notNull(),
    streetNumber: text("street_number").notNull(),
    addressExtra: text("address_extra"),
    zip: text("zip").notNull(),
    city: text("city").notNull(),
    country: text("country").default("DE").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("addresses_user_idx").on(table.userId)]
);

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = schema.table(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").unique().notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").default("pending").notNull(),
    // pending, awaiting_payment, paid, processing, shipped, delivered, cancelled, refunded
    paymentMethod: text("payment_method").notNull(), // stripe, klarna, bank_transfer
    paymentStatus: text("payment_status").default("pending").notNull(),
    // pending, paid, failed, refunded
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    discountId: uuid("discount_id").references(() => discounts.id, {
      onDelete: "set null",
    }),
    shippingAddress: jsonb("shipping_address").$type<{
      firstName: string;
      lastName: string;
      company?: string;
      street: string;
      streetNumber: string;
      addressExtra?: string;
      zip: string;
      city: string;
      country: string;
    }>(),
    billingAddress: jsonb("billing_address").$type<{
      firstName: string;
      lastName: string;
      company?: string;
      street: string;
      streetNumber: string;
      addressExtra?: string;
      zip: string;
      city: string;
      country: string;
    }>(),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    notes: text("notes"),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    agreedToTerms: boolean("agreed_to_terms").default(false).notNull(),
    agreedToWithdrawal: boolean("agreed_to_withdrawal").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_number_idx").on(table.orderNumber),
    index("orders_created_idx").on(table.createdAt),
  ]
);

// ─── Order Items ────────────────────────────────────────────────────────────

export const orderItems = schema.table(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)]
);

// ─── Cart ───────────────────────────────────────────────────────────────────

export const cartItems = schema.table(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("cart_user_idx").on(table.userId),
    uniqueIndex("cart_unique_idx").on(table.userId, table.variantId),
  ]
);

// ─── Discounts ──────────────────────────────────────────────────────────────

export const discounts = schema.table(
  "discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").unique().notNull(),
    description: text("description"),
    type: text("type").notNull(), // percentage, fixed, free_shipping
    value: decimal("value", { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
    maxUses: integer("max_uses"),
    currentUses: integer("current_uses").default(0).notNull(),
    productIds: jsonb("product_ids").$type<string[]>(),
    categoryIds: jsonb("category_ids").$type<string[]>(),
    startsAt: timestamp("starts_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("discounts_code_idx").on(table.code),
  ]
);

// ─── Stock Notifications ────────────────────────────────────────────────────

export const stockNotifications = schema.table(
  "stock_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    notified: boolean("notified").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { mode: "date" }),
  },
  (table) => [
    index("stock_notif_variant_idx").on(table.variantId),
    index("stock_notif_email_idx").on(table.email),
  ]
);

// ─── Page Views (Analytics) ─────────────────────────────────────────────────

export const pageViews = schema.table(
  "page_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"), // anonymized
    sessionId: text("session_id"),
    userId: uuid("user_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("page_views_path_idx").on(table.path),
    index("page_views_created_idx").on(table.createdAt),
  ]
);

// ─── Admin Notifications ────────────────────────────────────────────────────

export const adminNotifications = schema.table(
  "admin_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    // new_order, payment_received, low_stock, stock_request, shipping_update
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("admin_notif_read_idx").on(table.read),
    index("admin_notif_created_idx").on(table.createdAt),
  ]
);

// ─── Settings (Key-Value) ───────────────────────────────────────────────────

export const settings = schema.table("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── Order Returns ──────────────────────────────────────────────────────────

export const orderReturns = schema.table(
  "order_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default("other"),
    // damaged, wrong_item, other
    reasonDetail: text("reason_detail"),
    status: text("status").notNull().default("requested"),
    // requested, approved, received, completed, rejected
    action: text("action"),
    // refunded, replacement_sent, credit_issued
    adminNotes: text("admin_notes"),
    items: jsonb("items").$type<{ productName: string; variantName?: string; quantity: number }[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("returns_order_idx").on(table.orderId),
    index("returns_customer_idx").on(table.customerId),
  ]
);

// ─── Backup Logs ────────────────────────────────────────────────────────────

export const backupLogs = schema.table(
  "backup_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filename: text("filename").notNull(),
    location: text("location").notNull(), // local, s3
    path: text("path").notNull(),
    sizeBytes: integer("size_bytes"),
    status: text("status").notNull(), // success, failed
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("backup_logs_created_idx").on(table.createdAt)]
);

// ─── Admin Roles ────────────────────────────────────────────────────────────

export const adminRoles = schema.table("admin_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
  permissions: jsonb("permissions")
    .$type<{
      orders: { view: boolean; edit: boolean; delete: boolean };
      products: { view: boolean; edit: boolean; delete: boolean };
      customers: { view: boolean; edit: boolean };
      analytics: { view: boolean };
      discounts: { view: boolean; edit: boolean; delete: boolean };
      settings: { view: boolean; edit: boolean };
      backups: { view: boolean; create: boolean };
      roles: { view: boolean; edit: boolean };
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const userRoleAssignments = schema.table(
  "user_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_role_unique_idx").on(table.userId, table.roleId),
  ]
);

// ─── Email Templates ────────────────────────────────────────────────────────

export const emailTemplates = schema.table("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").unique().notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  variables: jsonb("variables").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── Drizzle Relations ──────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  addresses: many(addresses),
  orders: many(orders),
  cartItems: many(cartItems),
  roleAssignments: many(userRoleAssignments),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  relationsFrom: many(productRelations, { relationName: "fromProduct" }),
  stockNotifications: many(stockNotifications),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    stockNotifications: many(stockNotifications),
    cartItems: many(cartItems),
  })
);

export const productRelationsRelations = relations(
  productRelations,
  ({ one }) => ({
    product: one(products, {
      fields: [productRelations.productId],
      references: [products.id],
      relationName: "fromProduct",
    }),
    relatedProduct: one(products, {
      fields: [productRelations.relatedProductId],
      references: [products.id],
    }),
  })
);

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  discount: one(discounts, {
    fields: [orders.discountId],
    references: [discounts.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ many }) => ({
  orders: many(orders),
}));

export const stockNotificationsRelations = relations(
  stockNotifications,
  ({ one }) => ({
    product: one(products, {
      fields: [stockNotifications.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [stockNotifications.variantId],
      references: [productVariants.id],
    }),
  })
);

export const adminRolesRelations = relations(adminRoles, ({ many }) => ({
  assignments: many(userRoleAssignments),
}));

export const userRoleAssignmentsRelations = relations(
  userRoleAssignments,
  ({ one }) => ({
    user: one(users, {
      fields: [userRoleAssignments.userId],
      references: [users.id],
    }),
    role: one(adminRoles, {
      fields: [userRoleAssignments.roleId],
      references: [adminRoles.id],
    }),
  })
);

// ---------------------------------------------------------------------------
// Contact / Custom-print requests
// ---------------------------------------------------------------------------
export const contactRequests = schema.table(
  "contact_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(), // 'custom_print' | 'general'
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    fileNames: jsonb("file_names").$type<string[]>(),
    filePaths: jsonb("file_paths").$type<string[]>(),
    status: text("status").notNull().default("new"), // new, in_progress, replied, closed, spam
    spamScore: integer("spam_score"), // 0-100, set by LLM
    spamReason: text("spam_reason"),
    adminNotes: text("admin_notes"),
    errorMessage: text("error_message"), // set if request submission had an issue
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("contact_requests_status_idx").on(t.status), index("contact_requests_type_idx").on(t.type)],
);

export const contactReplies = schema.table(
  "contact_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .references(() => contactRequests.id, { onDelete: "cascade" })
      .notNull(),
    message: text("message").notNull(),
    sentBy: text("sent_by").notNull(), // admin email or name
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("contact_replies_request_idx").on(t.requestId)],
);

export const contactRequestsRelations = relations(contactRequests, ({ many }) => ({
  replies: many(contactReplies),
}));

export const contactRepliesRelations = relations(contactReplies, ({ one }) => ({
  request: one(contactRequests, {
    fields: [contactReplies.requestId],
    references: [contactRequests.id],
  }),
}));

// ---------------------------------------------------------------------------
// Telegram bot
// ---------------------------------------------------------------------------
export const telegramUsers = schema.table(
  "telegram_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: text("chat_id").notNull().unique(),
    username: text("username"),
    firstName: text("first_name"),
    isGroup: boolean("is_group").default(false).notNull(),
    acknowledged: boolean("acknowledged").default(false).notNull(),
    notifyOrders: boolean("notify_orders").default(true).notNull(),
    notifyRequests: boolean("notify_requests").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("telegram_users_chat_id_idx").on(t.chatId)],
);

// ---------------------------------------------------------------------------
// Homepage recommendation rules
// ---------------------------------------------------------------------------
// Coupon attempt log
// ---------------------------------------------------------------------------
export const couponAttempts = schema.table(
  "coupon_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    valid: boolean("valid").default(false).notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
    error: text("error"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("coupon_attempts_code_idx").on(t.code), index("coupon_attempts_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Checkout stock reservations (stripe/klarna pending payment)
// ---------------------------------------------------------------------------
export const checkoutReservations = schema.table(
  "checkout_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    releasedAt: timestamp("released_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("cr_order_idx").on(t.orderId),
    index("cr_variant_idx").on(t.variantId),
    index("cr_expires_idx").on(t.expiresAt),
  ]
);

// ---------------------------------------------------------------------------
// Email change requests (verification codes)
// ---------------------------------------------------------------------------
export const emailChangeRequests = schema.table(
  "email_change_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    newEmail: text("new_email").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("ecr_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
export const homepageRules = schema.table("homepage_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // "manual" | "most_bought" | "on_sale" | "newest" | "category" | "low_stock"
  label: text("label").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── Advertising / Google Merchant ──────────────────────────────────────────

export const adCampaigns = schema.table("ad_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "shopping" | "search" | "remarketing"
  status: text("status").default("paused").notNull(), // "active" | "paused"
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }).default("5.00").notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0").notNull(),
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const productAdConfig = schema.table(
  "product_ad_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    advertised: boolean("advertised").default(false).notNull(),
    campaignId: uuid("campaign_id").references(() => adCampaigns.id, { onDelete: "set null" }),
    customTitle: text("custom_title"),
    customDescription: text("custom_description"),
    googleProductCategory: text("google_product_category"),
    adKeywords: jsonb("ad_keywords").$type<string[]>().default([]),
    maxCpc: decimal("max_cpc", { precision: 8, scale: 2 }),
    priority: text("priority").default("medium").notNull(), // "high" | "medium" | "low"
    impressions: integer("impressions").default(0).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    conversions: integer("conversions").default(0).notNull(),
    cost: decimal("cost", { precision: 10, scale: 2 }).default("0").notNull(),
    revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_ad_config_product_idx").on(table.productId),
  ]
);

export const productAdConfigRelations = relations(productAdConfig, ({ one }) => ({
  product: one(products, {
    fields: [productAdConfig.productId],
    references: [products.id],
  }),
  campaign: one(adCampaigns, {
    fields: [productAdConfig.campaignId],
    references: [adCampaigns.id],
  }),
}));
