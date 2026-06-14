# 3DPrintIt — Model Railway E-Commerce Shop

A complete, professional German e-commerce shop for selling Modelleisenbahn (model railway) accessories and 3D-printed parts. Built with Next.js 16, featuring a customer-facing shop frontend, an admin dashboard, Stripe/Klarna/bank transfer payments, AI-powered product suggestions, Google Merchant Center feed, and full German legal compliance.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Running the Server](#running-the-server)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Features](#features)
  - [Customer Shop](#customer-shop)
  - [Admin Dashboard](#admin-dashboard)
  - [Payments](#payments)
  - [Email](#email)
  - [AI](#ai)
  - [Google Merchant Center](#google-merchant-center)
  - [Backups](#backups)
  - [Legal](#legal)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Known Technical Quirks](#known-technical-quirks)
- [Current State & TODO](#current-state--todo)
- [Credentials (seeded)](#credentials-seeded)

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Drizzle ORM 0.45.2 |
| Auth | NextAuth.js v5 beta (JWT strategy) |
| Payments | Stripe v22, Klarna, manual Bank Transfer |
| Email | Nodemailer v8 |
| AI | OpenAI-compatible SDK (openai@6) |
| Backups | Local filesystem + S3-compatible (AWS SDK) |
| Validation | Zod v4 |
| Image Processing | Sharp |
| Rich Text | Tiptap |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env   # if available, otherwise edit .env directly

# 3. Initialize database schema
node scripts/migrate.js

# 4. Seed sample data (idempotent)
node scripts/seed.js

# 5. Start dev server (use setsid to avoid blocking the shell)
setsid npx next dev --port 3000 > /tmp/next-dev.log 2>&1 < /dev/null &

# 6. Verify
tail -5 /tmp/next-dev.log   # look for "Ready"
```

---

## Environment Variables

All variables are in `.env` at the project root.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SCHEMA` | Database schema name (default: `student_test`) |
| `NEXTAUTH_SECRET` | Secret for signing JWT sessions |
| `NEXTAUTH_URL` | Base URL for auth callbacks |

### Payment

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (for card payments) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

### Email (SMTP)

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From email address |

### AI

| Variable | Description |
|---|---|
| `AI_BASE_URL` | OpenAI-compatible API base URL |
| `AI_API_KEY` | API key |
| `AI_MODEL` | Model name (e.g. `qwen3.5-397b-a17b`) |

### Google OAuth

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### Backups (S3)

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_REGION` | Region (e.g. `eu-central-1`) |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY` | Access key |
| `S3_SECRET_KEY` | Secret key |

### Other

| Variable | Description |
|---|---|
| `BASE_URL` | Base URL of the shop (e.g. `http://localhost:3000`) |
| `DHL_API_KEY` | DHL Tracking API key (free from developer.dhl.com) |

---

## Database

### Initialize / Reset

```bash
# Drop all tables and recreate the full schema with defaults
node scripts/migrate.js

# Insert sample products, categories, users (idempotent — ON CONFLICT DO NOTHING)
node scripts/seed.js
```

### Drizzle CLI

```bash
npm run db:generate   # Generate migration files
npm run db:push       # Push schema changes to DB
```

### Schema

All tables live in the `student_test` schema (configured via `DB_SCHEMA` env var).

---

## Running the Server

### Development

```bash
# Start dev server (non-blocking)
setsid npx next dev --port 3000 > /tmp/next-dev.log 2>&1 < /dev/null &

# Check it started
tail -5 /tmp/next-dev.log   # look for "Ready"

# Kill the server
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null
```

> **Never run `npx next dev` directly as a blocking command** — it will stall your shell.

### Production

```bash
# Build
npm run build
# or: npx next build

# Start
node .next/standalone/server.js
```

The project uses `output: "standalone"` in `next.config.ts`, which produces a minimal production bundle.

---

## Building for Production

```bash
npm run build
```

Must pass with 0 errors before deploying. Verify with:

```bash
npx tsc --noEmit
```

---

## Project Structure

```
/
├── src/
│   ├── proxy.ts                          # Next.js 16 middleware replacement (analytics, auth)
│   ├── app/
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Root redirect → (shop)
│   │   ├── globals.css                   # Tailwind v4 + custom styles
│   │   ├── (shop)/                       # Customer-facing shop
│   │   │   ├── layout.tsx                # Shop layout (Header + Footer)
│   │   │   ├── page.tsx                  # Homepage (hero, featured, categories)
│   │   │   ├── products/                 # Product listing + detail
│   │   │   ├── kategorie/[slug]/         # Category pages
│   │   │   ├── cart/                     # Shopping cart
│   │   │   ├── checkout/                 # 3-step checkout
│   │   │   ├── account/                  # Customer account
│   │   │   ├── auth/                     # Login, register, verify
│   │   │   ├── impressum/                # Legal imprint (§5 TMG)
│   │   │   ├── datenschutz/              # Privacy policy (DSGVO)
│   │   │   ├── agb/                      # Terms & conditions
│   │   │   ├── widerruf/                 # Revocation policy (§355 BGB)
│   │   │   ├── custom-print/             # 3D print request form
│   │   │   └── team/                     # About page
│   │   ├── admin/                        # Admin dashboard (auth-gated)
│   │   │   ├── layout.tsx
│   │   │   ├── AdminShell.tsx            # Client shell with sidebar
│   │   │   ├── page.tsx                  # Dashboard overview
│   │   │   ├── products/                 # Product CRUD + variants + AI
│   │   │   ├── orders/                   # Order management
│   │   │   ├── customers/                # Customer management
│   │   │   ├── analytics/                # Page view analytics
│   │   │   ├── discounts/                # Discount codes
│   │   │   ├── featured/                 # Homepage section rules
│   │   │   ├── ai-suggestions/           # AI product relation approval
│   │   │   ├── recommended/              # Manual product relations
│   │   │   ├── categories/               # Category management
│   │   │   ├── roles/                    # Role + permission management
│   │   │   ├── notifications/            # Admin notifications
│   │   │   ├── settings/                 # 11-tab settings panel
│   │   │   ├── backups/                  # DB backup management
│   │   │   ├── advertising/              # Google Ads management
│   │   │   ├── requests/                 # Custom print / contact requests
│   │   │   └── returns/                  # Return management
│   │   └── api/
│   │       ├── auth/                     # NextAuth handler, registration
│   │       ├── products/                 # Public product API
│   │       ├── categories/               # Public categories API
│   │       ├── cart/                     # Cart management
│   │       ├── checkout/                 # Order creation, Stripe sessions
│   │       ├── orders/                   # User order history
│   │       ├── addresses/                # Address book
│   │       ├── shipping/                 # Shipping calculation
│   │       ├── notifications/            # Stock notification signup
│   │       ├── analytics/                # Page view tracking
│   │       ├── upload/                   # Image upload
│   │       ├── uploads/[name]/           # Image serving
│   │       ├── feeds/google-merchant/    # Google Shopping feed
│   │       ├── webhooks/stripe/          # Stripe webhook handler
│   │       └── admin/                    # Admin API (role-gated)
│   │           ├── products/
│   │           ├── orders/
│   │           ├── customers/
│   │           ├── discounts/
│   │           ├── settings/
│   │           ├── notifications/
│   │           ├── analytics/
│   │           ├── backup/
│   │           ├── ai/
│   │           └── roles/
│   ├── components/
│   │   ├── shared/                       # Button, Input, Modal, Toast, etc.
│   │   ├── shop/                         # Header, Footer, ProductCard, etc.
│   │   └── admin/                        # Sidebar, Header, LocaleContext
│   ├── lib/
│   │   ├── db/                           # Schema + DB instance
│   │   ├── auth/                         # NextAuth config
│   │   ├── email/                        # Nodemailer + templates
│   │   ├── shipping/                     # Fee calculation, DHL tracking
│   │   ├── stripe/                       # Checkout sessions, webhooks
│   │   ├── ai/                           # OpenAI-compatible client
│   │   ├── backup/                       # pg_dump + S3 backups
│   │   ├── security/                     # Rate limiting, Zod schemas, sanitization
│   │   └── i18n/                         # DE/EN translations
│   └── types/                            # TypeScript type definitions
├── scripts/
│   ├── migrate.js                        # Drop+recreate schema + defaults
│   └── seed.js                           # Sample products/categories/users
├── public/                               # Static assets
├── data/uploads/                         # Uploaded product images (persistent)
├── next.config.ts                        # Standalone output, CSP, rewrites
├── drizzle.config.ts
├── tsconfig.json
├── package.json
└── .env
```

---

## Features

### Customer Shop

| Feature | Status |
|---|---|
| Homepage with hero, featured products, new arrivals, category grid | Done |
| Product listing with search, category filter, sort | Done |
| Product detail with variants, pricing, related products | Done |
| Shopping cart (localStorage guest cart + persistent logged-in cart) | Done |
| 3-step checkout (address → payment → review) | Done |
| Payment: Stripe (Visa, Mastercard, Amex), Klarna, Bank Transfer | Done |
| Discount codes (percentage, fixed, free shipping) | Done |
| Shipping calculation (base fee + per kg, free threshold) | Done |
| Stock warnings + back-in-stock email notifications | Done |
| Customer account: profile, orders, addresses | Done |
| Order history with DHL tracking links | Done |
| Custom 3D print request form with file upload | Done |
| Return management (requested → approved → received → completed) | Done |
| Contact / custom print requests | Done |
| Cookie consent banner | Done |
| Guest checkout (localStorage cart) | Done |

### Admin Dashboard

| Feature | Status |
|---|---|
| Dashboard overview (revenue, orders, customers, low stock alerts) | Done |
| Product CRUD with variants, images, SEO fields | Done |
| Product variants (SKU-level pricing, stock, attributes) | Done |
| Product relations (manual + AI-generated) | Done |
| Order management (list, detail, status updates, tracking) | Done |
| Customer management (list, detail, order history) | Done |
| Category management with drag-and-drop | Done |
| Discount codes (create, edit, product sales, coupon log) | Done |
| Homepage section rules (featured, bestsellers, on-sale, categories) | Done |
| Analytics (page views, top pages, stock demand) | Done |
| Role-based access control (granular permissions) | Done |
| Admin notifications (new orders, low stock, payments) | Done |
| Settings (11 tabs: general, shipping, payment, email, legal, AI, Telegram, backup, roles, updates, emergency) | Done |
| Database backups (local + S3, cron schedule) | Done |
| Google Ads management (per-product ad config, feed URL) | Done |
| AI product relation suggestions (generate, approve/reject) | Done |
| Contact / custom print request management | Done |
| Return management | Done |

### Payments

| Feature | Status |
|---|---|
| Stripe card payments (checkout sessions, webhook handling) | Code done, needs `STRIPE_*` keys |
| Klarna (Ratenkauf, Rechnung, Sofort) | Code done, needs Stripe Klarna config |
| Bank Transfer (manual, ships after payment received) | Done |
| Discount code validation at checkout | Done |
| Cart reservation system (checkout_reservations table) | Schema done, logic needs verification |

### Email

| Feature | Status |
|---|---|
| 7 email templates (order confirmation, payment received, shipping, stock notification, welcome, magic link, bank transfer) | Done |
| Template-based with `{{variable}}` substitution | Done |
| Professional HTML email layout | Done |
| SMTP delivery via Nodemailer | Code done, needs SMTP credentials |
| Fallback logging when SMTP not configured | Done |

### AI

| Feature | Status |
|---|---|
| Product relation suggestions (OpenAI-compatible API) | Code done, needs `AI_API_KEY` |
| Configurable model, base URL, writing style, language | Done |
| Per-feature prompt instructions (titles, descriptions, relations) | Done |
| Admin approval workflow with confidence scores | Done |

### Google Merchant Center

| Feature | Status |
|---|---|
| RSS 2.0 XML feed with Google namespace | Done |
| Per-variant items with `item_group_id` | Done |
| Custom title/description per product (from ad config) | Done |
| 1-hour cache header | Done |
| Auto-approve high-confidence AI suggestions | Not implemented |
| Automatic campaign sync via Google Ads API | Not implemented (needs env vars) |

### Backups

| Feature | Status |
|---|---|
| `pg_dump` to local filesystem (gzip) | Code done, needs `pg_dump` binary |
| Upload to S3-compatible storage | Code done, needs `S3_*` env vars |
| Backup history log | Done |
| Auto-cleanup (configurable retention) | Done |
| Cron schedule configuration | Done |
| Backup restore functionality | Not implemented |

### Legal

| Feature | Status |
|---|---|
| Impressum (§5 TMG) — admin-editable via `legal_impressum` setting | Done |
| Datenschutzerklärung (DSGVO) — admin-editable via `legal_datenschutz` | Done |
| AGB — admin-editable via `legal_agb` setting | Done |
| Widerrufsbelehrung (§355 BGB) — admin-editable via `legal_widerruf` | Done |
| Checkout requires AGB + Widerrufsrecht checkboxes | Done |
| Prices displayed as "inkl. MwSt." (19% VAT) | Done |
| Checkout button says "Zahlungspflichtig bestellen" | Done |

---

## API Reference

### Public Endpoints (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products. Params: `page`, `limit`, `category` (slug), `search`, `featured`, `sort` |
| GET | `/api/products/[slug]` | Product detail with variants, category, relatedProducts |
| GET | `/api/categories` | All categories with product counts |
| POST | `/api/auth/register` | Register: `{email, password, name}` → 201 |
| POST | `/api/analytics/track` | Track page view: `{path, referrer?, userAgent?, ip?}` |
| POST | `/api/shipping/calculate` | `{items:[{variantId, quantity}], subtotal}` → `{shippingFee, freeShippingThreshold}` |
| POST | `/api/notifications/stock` | Subscribe to back-in-stock: `{email, variantId}` |
| GET | `/api/feeds/google-merchant` | Google Shopping RSS feed |

### Auth-Required (customer)

| Method | Path | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/cart` | Cart management |
| GET/POST | `/api/orders` | Order history / create order |
| GET | `/api/orders/[id]` | Order detail |
| GET/POST/PUT/DELETE | `/api/addresses` | Address book |
| POST | `/api/checkout` | Create order from cart |
| POST | `/api/checkout/stripe` | Create Stripe checkout session |

### Admin (role: admin or staff)

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/admin/products` | List/create products |
| GET/PUT/DELETE | `/api/admin/products/[id]` | Product CRUD |
| GET/POST | `/api/admin/products/[id]/variants` | Variant management |
| GET/POST/DELETE | `/api/admin/products/[id]/relations` | Product relations |
| GET/PUT | `/api/admin/orders` | Order list/update |
| GET/PUT | `/api/admin/orders/[id]` | Order detail/update status |
| GET | `/api/admin/customers` | Customer list |
| GET/PUT | `/api/admin/customers/[id]` | Customer detail |
| GET/POST/PUT/DELETE | `/api/admin/discounts` | Discount codes |
| GET/PUT | `/api/admin/settings` | Settings key-value store |
| GET/PUT | `/api/admin/notifications` | Admin notifications |
| GET | `/api/admin/analytics` | Analytics data |
| POST | `/api/admin/backup` | Trigger pg_dump backup |
| POST | `/api/admin/ai` | Generate AI suggestions |
| GET/POST/PUT/DELETE | `/api/admin/roles` | Role management |
| POST | `/api/upload` | Upload product image (admin/staff) |
| POST | `/api/webhooks/stripe` | Stripe webhook (verified by signature) |

---

## Database Schema

30+ tables in the `student_test` schema.

### Auth
| Table | Purpose |
|---|---|
| `users` | All users (customers + admins). Columns: id, name, email, email_verified, image, password_hash, role, phone |
| `accounts` | OAuth provider accounts (NextAuth) |
| `sessions` | NextAuth sessions |
| `verification_tokens` | Magic link tokens |

### Products
| Table | Purpose |
|---|---|
| `categories` | Product categories. Columns: id, name, slug, description, parent_id, sort_order |
| `products` | Products. Columns: id, name, slug, description, description_html, base_price, compare_at_price, category_id, images (jsonb), weight, featured, active, tax_rate, meta_title, meta_description |
| `product_variants` | SKU-level variants. Columns: id, product_id, name, sku (unique), price, stock, low_stock_threshold, weight, attributes (jsonb), active, sort_order |
| `product_relations` | Manual + AI-approved relations. relation_type: related/accessory/bundle |
| `product_relation_suggestions` | AI-generated suggestions pending admin review |
| `categories` | Product categories with hierarchical parent_id support |

### Orders & Customers
| Table | Purpose |
|---|---|
| `orders` | Orders. status: pending/awaiting_payment/paid/processing/shipped/delivered/cancelled/refunded |
| `order_items` | Line items (snapshot: product_name, variant_name, sku, unit_price) |
| `cart_items` | Persisted cart (userId + variantId unique) |
| `checkout_reservations` | Cart item reservations during checkout |
| `addresses` | Customer shipping/billing addresses |
| `stock_notifications` | Email subscriptions for out-of-stock variants |

### Discounts & Returns
| Table | Purpose |
|---|---|
| `discounts` | Discount codes. type: percentage/fixed/free_shipping |
| `coupon_attempts` | Log of discount code usage attempts |
| `order_returns` | Return requests with status workflow |

### Content
| Table | Purpose |
|---|---|
| `email_templates` | Editable email templates (key, subject, body_html, body_text) |
| `homepage_rules` | Homepage section configuration |
| `contact_requests` | Custom print / contact form submissions |
| `contact_replies` | Replies to contact requests |
| `telegram_users` | Telegram bot user management |

### Admin & System
| Table | Purpose |
|---|---|
| `admin_roles` | Role definitions with granular permission JSON |
| `user_role_assignments` | Many-to-many users ↔ roles |
| `admin_notifications` | In-app admin notifications |
| `settings` | Key-value config store |
| `backup_logs` | pg_dump backup history |
| `page_views` | Analytics (path, referrer, user_agent, ip_hash, session_id) |
| `email_change_requests` | Pending email change requests |
| `ad_campaigns` | Google Ads campaign data |
| `product_ad_config` | Per-product ad configuration (title, description, keywords, CPC) |

---

## Known Technical Quirks

### Next.js 16
- `middleware.ts` is now `proxy.ts` — the export must be named `proxy`. File: `src/proxy.ts`.
- `params` and `searchParams` are Promises — always `await params` in page components and route handlers.
- `cookies()` and `headers()` are async — always await them.
- Turbopack is the default bundler — `next dev` uses Turbopack automatically.
- No `middleware.ts` — if you create one it will be silently ignored.

### Drizzle ORM 0.45.2
- `inArray()` generates broken SQL for UUID arrays in PostgreSQL.
- **NEVER use:** `inArray(table.uuidColumn, arrayOfIds)`
- **Always use:** `sql\`${table.uuidColumn} = ANY(ARRAY[${sql.join(arrayOfIds.map((id) => sql`${id}::uuid`), sql`, `)}])\``

### Zod v4
- `z.record()` requires two arguments: `z.record(z.string(), z.string())`
- Error access uses `.issues` not `.errors`

### Stripe v22
- `Stripe.Checkout.SessionCreateParams` is no longer exported as a namespace type.
- Workaround: use `Record<string, unknown>` with type casting.

### NextAuth v5 beta
- Session strategy is JWT (not database sessions).
- `auth()` can be called in Server Components and Route Handlers.
- The `proxy.ts` file checks for `authjs.session-token` or `__Secure-authjs.session-token` cookies.
- Admin role check in proxy is cookie-presence only — actual role verification happens in API routes.

### Tailwind v4
- Uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- Custom properties go in `@theme inline { }` block.
- See `src/app/globals.css`

### Image Storage
- Uploaded images are stored in `data/uploads/` (persistent, outside build output).
- Served via `/api/uploads/[name]` route.
- Old `/uploads/*` URLs are rewritten to `/api/uploads/*` for backward compatibility.
- Images are processed with Sharp: EXIF auto-rotate, resize to 1200px max, convert to WebP.

---

## Current State & TODO

### Working (verified)

- [x] Dev server starts and all routes return 200
- [x] Homepage renders (hero, featured, new arrivals, categories)
- [x] Product listing with filters, search, sort
- [x] Product detail with variants, related products, JSON-LD, SEO metadata
- [x] All category pages
- [x] Cart with guest support (localStorage)
- [x] 3-step checkout (address → payment → review)
- [x] All legal pages (impressum, datenschutz, agb, widerruf)
- [x] Admin auth redirect when unauthenticated
- [x] All protected API routes return 401 when unauthenticated
- [x] `npx tsc --noEmit` → 0 errors
- [x] Product CRUD with variants, images, relations
- [x] Order management (list, detail, status updates)
- [x] Customer management
- [x] Discount codes
- [x] Analytics (page views, top pages)
- [x] Role-based access control
- [x] Settings (11 tabs)
- [x] Google Merchant feed
- [x] Email templates (7 templates)
- [x] AI product relation suggestions
- [x] Homepage section rules
- [x] Backups (local + S3)
- [x] Custom print requests
- [x] Return management
- [x] Advertising / Google Ads management

### Needs configuration (code complete, just needs env vars)

| Feature | Required env vars |
|---|---|
| Stripe payments | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Klarna | Stripe Klarna enabled in dashboard |
| Email sending | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| AI suggestions | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` |
| S3 backups | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| DHL tracking | `DHL_API_KEY` |
| Google Ads auto-sync | `GOOGLE_MERCHANT_ID`, `GOOGLE_ADS_CUSTOMER_ID` |

### Needs testing / verification

| Item | Priority |
|---|---|
| Full login flow (credentials + Google OAuth) in browser | High |
| Admin dashboard with real data | High |
| Full purchase flow (cart → checkout → order) | High |
| Stripe webhook handling (payment confirmation, status updates) | High |
| Email delivery (order confirmation, welcome, shipping) | High |
| Discount code validation at checkout | Medium |
| Stock decrement on order placement | Medium |
| DHL tracking URL format | Medium |
| Telegram bot webhook handler | Medium |
| AI content generation (titles, descriptions) | Low |
| PDF invoice generation (`pdfkit` installed but no route found) | Low |
| Backup restore functionality | Low |
| Rate limiting middleware on API routes | Low |
| CSRF token validation | Low |
| Multi-language support (currently German-only) | Low |

### Known bugs / issues

| Issue | Status |
|---|---|
| `src/lib/db/schema.ts` line 16: stale fallback `"student_oc_test0404"` should be `"student_test"` | Low — works via `.env` |
| `drizzle.config.ts` line 8: same stale fallback | Low — works via `.env` |
| No middleware-level rate limiting (utility exists but not applied) | Low |
| No CSRF token validation (generation exists but no middleware) | Low |

---

## Credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@3dprintit.de` | `admin123456` |
| Customer | `kunde@example.de` | `customer123` |

---

## Design System

- **Palette:** Black (#000), white (#fff), neutral grays. No color gradients.
- **Typography:** System font stack, tight tracking, semibold headings
- **Radius:** `rounded-full` for buttons, `rounded-xl` for cards
- **Borders:** `border-neutral-100` or `border-neutral-200`
- **Shadows:** Subtle `shadow-sm` only
- **Button style:** `bg-black text-white rounded-full` (primary), `border border-neutral-300 rounded-full` (secondary)
- **Style:** Apple-inspired — generous whitespace, clean, no decorative elements
