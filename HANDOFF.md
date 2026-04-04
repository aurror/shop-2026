# 3DPrintIt — Agent Handoff Document

**Last updated:** 2026-04-04  
**Status:** Development server runs, all routes 200, TypeScript clean.  
**Dev server:** `http://localhost:3000` (may need restart — see "Running the server" below)

---

## What this project is

A complete, professional German e-commerce shop called **3DPrintIt** for selling Modelleisenbahn (model railway) accessories and 3D-printed parts. It is a single Next.js 16 monorepo:

- Shop frontend at `/` (customer-facing)
- Admin dashboard at `/admin/*`
- REST API at `/api/*`
- German legal compliance built-in (Impressum, AGB, DSGVO, Widerruf)

---

## Tech stack

| Concern | Technology |
|---|---|
| Framework | Next.js **16.2.2** (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via `pg` driver |
| ORM | Drizzle ORM 0.45.2 |
| Auth | NextAuth.js v5 beta (next-auth@5.0.0-beta.30) |
| Payments | Stripe v22, manual Banküberweisung |
| Email | Nodemailer v8 |
| AI | OpenAI-compatible SDK (openai@6) |
| Backups | Local filesystem + S3-compatible |
| Validation | Zod v4 |

---

## Environment

### Database
```
DATABASE_URL=postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres
DB_SCHEMA=student_test
```
The schema is `student_test`. The `test` user only has CREATE+USAGE on this schema — no other schemas.

**Important:** `src/lib/db/schema.ts` line 16 has a stale fallback:
```ts
const SCHEMA_NAME = process.env.DB_SCHEMA || "student_oc_test0404";
```
The `student_oc_test0404` fallback is wrong — it doesn't exist. Same in `drizzle.config.ts`. Both should be `"student_test"` but since `.env` sets `DB_SCHEMA=student_test` it works fine in practice. Fix these if you ever need the fallback.

### Auth credentials (seeded)
| Role | Email | Password |
|---|---|---|
| Admin | admin@3dprintit.de | admin123456 |
| Customer | kunde@example.de | customer123 |

### Unfilled env vars (features degraded without them)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth won't work
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — emails won't send
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe payments won't work
- `AI_API_KEY` — AI product suggestions won't work
- `S3_*` vars — S3 backup won't work (local backup still works)

---

## Next.js 16 breaking changes (critical to know)

1. **`middleware.ts` is now `proxy.ts`** — the export must be named `proxy`, not `middleware`. The file is at `src/proxy.ts`.
2. **`params` and `searchParams` are Promises** — always `await params` in page components and route handlers.
3. **`cookies()`, `headers()` must be awaited** — they return Promises in Next.js 16.
4. **Turbopack is the default bundler** — `next dev` uses Turbopack automatically.
5. **No `middleware.ts`** — if you create one it will be silently ignored.

---

## Running the server

**Never use `npx next dev` or `npm run dev` directly as a blocking command.** It stalls the shell. Use:

```bash
setsid npx next dev --port 3000 > /tmp/next-dev.log 2>&1 < /dev/null &
```

Then check startup with:
```bash
tail -5 /tmp/next-dev.log
# Should show: ✓ Ready in Xms
```

Kill the server:
```bash
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null
```

**Build:**
```bash
npx next build
# Must pass with 0 errors before deploying
```

**Type check (fast validation):**
```bash
npx tsc --noEmit
# Currently: 0 errors
```

---

## Database scripts

```bash
node scripts/migrate.js   # Drop+recreate all tables, seed default settings/roles/email templates
node scripts/seed.js      # Insert sample products, categories, users (idempotent — ON CONFLICT DO NOTHING)
```

The seed script has already been run. The database contains:
- 6 categories
- 10 products with 18 variants
- 7 product relations
- 2 users (admin + customer)
- Default settings, roles, email templates (from migrate.js)

---

## Known bug: Drizzle `inArray` with PostgreSQL UUID arrays

**Symptom:** `error: op ANY/ALL (array) requires array on right side`

**Root cause:** Drizzle ORM 0.45.2 generates `= ANY(($1, $2, ...))` for `inArray()` with the `pg` driver. PostgreSQL interprets the parenthesized list as a row constructor, not an array.

**Fix applied in these files:**
- `src/app/api/products/route.ts` (line ~93)
- `src/app/(shop)/page.tsx` (lines ~44, ~106)
- `src/app/(shop)/kategorie/[slug]/page.tsx` (line ~50)

**Pattern used:**
```ts
// WRONG — Drizzle inArray generates broken SQL:
inArray(productVariants.productId, productIds)

// CORRECT — explicit ARRAY[] constructor with ::uuid cast:
sql`${productVariants.productId} = ANY(ARRAY[${sql.join(
  productIds.map((id) => sql`${id}::uuid`),
  sql`, `
)}])`
```

**If you add new queries that filter by a list of UUIDs, always use the ARRAY[] pattern above.** Do not use `inArray()` with UUID columns.

---

## Project structure

```
/home/flo/shop/
├── src/
│   ├── proxy.ts                          # Next.js 16 middleware replacement
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (minimal, just <html>)
│   │   ├── page.tsx                      # Root redirect → (shop)
│   │   ├── globals.css                   # Tailwind v4 + custom styles
│   │   ├── (shop)/                       # Route group: customer-facing shop
│   │   │   ├── layout.tsx                # Shop layout with Header + Footer
│   │   │   ├── page.tsx                  # Homepage (hero, featured, new arrivals, categories)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx              # Product listing with filters/search/sort
│   │   │   │   └── [slug]/page.tsx       # Product detail (variants, stock, related)
│   │   │   ├── kategorie/[slug]/page.tsx # Category page
│   │   │   ├── cart/page.tsx             # Cart
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx              # 3-step checkout (address → payment → review)
│   │   │   │   ├── success/page.tsx      # Order success
│   │   │   │   └── bank-transfer/page.tsx# Bank transfer instructions
│   │   │   ├── account/
│   │   │   │   ├── page.tsx              # Account overview
│   │   │   │   ├── orders/page.tsx       # Order history
│   │   │   │   ├── orders/[id]/page.tsx  # Order detail + DHL tracking
│   │   │   │   └── addresses/page.tsx    # Address management
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   ├── verify/page.tsx       # Magic link verify
│   │   │   │   └── error/page.tsx
│   │   │   ├── impressum/page.tsx        # §5 TMG
│   │   │   ├── datenschutz/page.tsx      # DSGVO
│   │   │   ├── agb/page.tsx
│   │   │   └── widerruf/page.tsx         # §355 BGB
│   │   ├── admin/                        # Admin dashboard
│   │   │   ├── layout.tsx                # Admin layout (auth-gated)
│   │   │   ├── AdminShell.tsx            # Client shell with sidebar
│   │   │   ├── page.tsx                  # Dashboard overview with stats
│   │   │   ├── orders/                   # Order management
│   │   │   ├── products/                 # Product CRUD + variants + AI
│   │   │   ├── customers/                # Customer management
│   │   │   ├── analytics/                # Page view analytics
│   │   │   ├── discounts/                # Discount code management
│   │   │   ├── notifications/            # Admin notification center
│   │   │   ├── settings/page.tsx         # 8-tab settings (shop, email, shipping, legal, etc.)
│   │   │   ├── backups/page.tsx          # DB backup management
│   │   │   ├── ai-suggestions/page.tsx   # AI product relation approval workflow
│   │   │   └── roles/page.tsx            # Role + permission management
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts # NextAuth handler
│   │       │   └── register/route.ts      # POST: create account
│   │       ├── products/
│   │       │   ├── route.ts               # GET: list products (public)
│   │       │   └── [slug]/route.ts        # GET: product detail (public)
│   │       ├── categories/route.ts        # GET: list categories (public)
│   │       ├── cart/route.ts              # GET/POST/PUT/DELETE: cart (auth required)
│   │       ├── checkout/
│   │       │   ├── route.ts               # POST: create order
│   │       │   └── stripe/route.ts        # POST: create Stripe session
│   │       ├── orders/
│   │       │   ├── route.ts               # GET: list user orders (auth required)
│   │       │   └── [id]/route.ts          # GET: order detail (auth required)
│   │       ├── addresses/route.ts         # GET/POST/PUT/DELETE addresses (auth required)
│   │       ├── shipping/calculate/route.ts # POST: calculate shipping fee
│   │       ├── notifications/stock/route.ts # POST: register stock notification
│   │       ├── analytics/track/route.ts   # POST: track page view (public)
│   │       ├── upload/route.ts            # POST: upload product image
│   │       ├── webhooks/stripe/route.ts   # POST: Stripe webhook handler
│   │       └── admin/                     # Admin API (role: admin or staff)
│   │           ├── products/[id]/
│   │           │   ├── route.ts           # GET/PUT/DELETE product
│   │           │   ├── variants/route.ts  # GET/POST variants
│   │           │   └── relations/route.ts # GET/POST/DELETE relations
│   │           ├── orders/[id]/route.ts
│   │           ├── customers/[id]/route.ts
│   │           ├── discounts/[id]/route.ts
│   │           ├── settings/route.ts      # GET/PUT settings key-value store
│   │           ├── notifications/route.ts
│   │           ├── analytics/route.ts
│   │           ├── backup/route.ts        # POST: trigger backup
│   │           ├── ai/route.ts            # POST: generate AI suggestions
│   │           └── roles/route.ts
│   ├── components/
│   │   ├── shared/                        # Button, Input, Modal, Toast, Pagination,
│   │   │                                  # Badge, Select, Textarea, LoadingSpinner, EmptyState
│   │   ├── shop/
│   │   │   ├── Header.tsx                 # Responsive nav, search, cart icon, user menu
│   │   │   ├── Footer.tsx                 # Legal links, payment icons
│   │   │   ├── ProductCard.tsx            # Used in grids
│   │   │   ├── ProductDetail.tsx          # Full product detail (Client Component)
│   │   │   ├── ProductsClient.tsx         # Filterable product listing (Client Component)
│   │   │   └── CookieBanner.tsx           # GDPR cookie consent
│   │   └── admin/
│   │       ├── LocaleContext.tsx          # DE/EN toggle context
│   │       ├── AdminSidebar.tsx           # Nav sidebar
│   │       └── AdminHeader.tsx            # Top bar with locale toggle + notifications
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts                  # 22-table Drizzle schema (see below)
│   │   │   └── index.ts                   # pg Pool + drizzle() instance
│   │   ├── auth/index.ts                  # NextAuth config (Google, Credentials, Nodemailer)
│   │   ├── email/index.ts                 # Nodemailer + DB template system
│   │   ├── shipping/index.ts              # Fee calculation, DHL tracking URL helper
│   │   ├── stripe/index.ts                # Checkout session creation, webhook handling
│   │   ├── ai/index.ts                    # OpenAI-compatible client for suggestions
│   │   ├── backup/index.ts                # pg_dump → local + S3
│   │   ├── security/index.ts              # Rate limiting, Zod schemas, sanitization
│   │   └── i18n/translations.ts           # DE/EN strings for admin dashboard
│   ├── types/
│   │   ├── index.ts                       # CartItem, ShopProduct, OrderStatus, etc.
│   │   └── next-auth.d.ts                 # Augments Session with role field
│   └── ...
├── scripts/
│   ├── migrate.js                         # Drop+recreate schema + seed defaults
│   └── seed.js                            # Sample products/categories/users
├── next.config.ts                         # output: standalone, CSP headers
├── drizzle.config.ts
├── tsconfig.json
├── .env                                   # All env vars (see above)
└── package.json
```

---

## Database schema (22 tables in `student_test` schema)

| Table | Purpose |
|---|---|
| `users` | All users (customers + admins). Columns: id, name, email, email_verified, image, password_hash, role (customer/staff/admin), phone |
| `accounts` | OAuth provider accounts (NextAuth) |
| `sessions` | NextAuth sessions |
| `verification_tokens` | Magic link tokens |
| `categories` | Product categories. Columns: id, name, slug, description, parent_id, sort_order |
| `products` | Products. Columns: id, name, slug, description, description_html, base_price, compare_at_price, category_id, images (jsonb), weight, featured, active, tax_rate (default 19.00), meta_title, meta_description |
| `product_variants` | SKU-level variants. Columns: id, product_id, name, sku (unique), price, stock, low_stock_threshold (default 5), weight, attributes (jsonb), active, sort_order |
| `product_relations` | Manual + AI-approved relations. relation_type: related/accessory/bundle |
| `product_relation_suggestions` | AI-generated suggestions pending admin review. status: pending/approved/rejected |
| `addresses` | Customer shipping/billing addresses |
| `orders` | Orders. status: pending/awaiting_payment/paid/processing/shipped/delivered/cancelled/refunded |
| `order_items` | Line items (snapshot: product_name, variant_name, sku, unit_price) |
| `cart_items` | Persisted cart (userId + variantId unique) |
| `discounts` | Discount codes. type: percentage/fixed/free_shipping |
| `stock_notifications` | Email subscriptions for out-of-stock variants |
| `page_views` | Analytics. Columns: path, referrer, user_agent, ip_hash (anonymized), session_id |
| `admin_notifications` | In-app admin notifications. type: new_order/payment_received/low_stock/etc. |
| `settings` | Key-value config store (shop info, SMTP, shipping, legal content, etc.) |
| `backup_logs` | pg_dump backup history |
| `admin_roles` | Role definitions with granular permission JSON |
| `user_role_assignments` | Many-to-many users ↔ roles |
| `email_templates` | Editable email templates (key, subject, body_html, body_text) |

---

## API reference

### Public endpoints (no auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products. Params: page, limit, category (slug), search, featured, sort (newest/price_asc/price_desc/name_asc/oldest) |
| GET | `/api/products/[slug]` | Product detail with variants, category, relatedProducts |
| GET | `/api/categories` | All categories with product counts |
| POST | `/api/auth/register` | Register: `{email, password, name}` → 201 |
| POST | `/api/analytics/track` | Track page view: `{path, referrer?, userAgent?, ip?}` |
| POST | `/api/shipping/calculate` | `{items:[{variantId, quantity}], subtotal}` → `{shippingFee, freeShippingThreshold, freeShippingEligible}` |
| POST | `/api/notifications/stock` | Subscribe to back-in-stock: `{email, variantId}` |

### Auth-required (customer)
| Method | Path | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/cart` | Cart management |
| GET/POST | `/api/orders` | Order history / create order |
| GET | `/api/orders/[id]` | Order detail |
| GET/POST/PUT/DELETE | `/api/addresses` | Address book |
| POST | `/api/checkout` | Create order from cart |
| POST | `/api/checkout/stripe` | Create Stripe checkout session |

### Admin-only (role: admin or staff)
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
| POST | `/api/admin/ai` | Generate AI product suggestions |
| GET/POST/PUT/DELETE | `/api/admin/roles` | Role management |
| POST | `/api/webhooks/stripe` | Stripe webhook (no auth — verified by signature) |

---

## Design system

- **Palette:** Black (#000), white (#fff), neutral grays. NO color gradients.
- **Typography:** System font stack, tight tracking, semibold headings
- **Radius:** Rounded-full for buttons, rounded-xl for cards
- **Borders:** `border-neutral-100` or `border-neutral-200`
- **Shadows:** Subtle `shadow-sm` only
- **Button style:** `bg-black text-white rounded-full` primary, `border border-neutral-300 rounded-full` secondary
- Apple-style — generous whitespace, clean, no decorative elements

---

## German legal compliance

The following are already implemented and admin-editable via Settings:
- **Impressum** (`/impressum`) — §5 TMG, content loaded from DB settings key `legal_impressum`
- **Datenschutzerklärung** (`/datenschutz`) — DSGVO, content from `legal_datenschutz`
- **AGB** (`/agb`) — content from `legal_agb`
- **Widerrufsbelehrung** (`/widerruf`) — §355 BGB, content from `legal_widerruf`
- Prices displayed as "inkl. MwSt." (19% VAT)
- Checkout button says **"Zahlungspflichtig bestellen"**
- Checkout requires AGB checkbox + Widerrufsrecht checkbox before order

---

## What works (verified in this session)

- [x] Dev server starts and all 22+ routes return 200
- [x] Homepage renders (hero, featured section, new arrivals, category grid)
- [x] `/products` — full product listing
- [x] `/products/[slug]` — product detail with variants, price, related products
- [x] All 6 category pages (`/kategorie/[slug]`)
- [x] `/cart`, `/checkout`, `/checkout/success`, `/checkout/bank-transfer`
- [x] `/auth/login`, `/auth/register`
- [x] All legal pages (impressum, datenschutz, agb, widerruf)
- [x] `/api/products` — returns 10 products with variants (the UUID array bug was fixed)
- [x] `/api/categories` — returns 6 categories
- [x] `/api/products/[slug]` — returns product with 2 related products
- [x] `/api/shipping/calculate` — returns correct fee (€5.52 for 350g order, free ≥ €50)
- [x] `/api/auth/register` — creates user (tested: returns 201)
- [x] All admin routes redirect to login when unauthenticated (307)
- [x] All protected API routes return 401 when unauthenticated
- [x] `npx tsc --noEmit` → 0 errors

---

## What has NOT been tested / may need work

### High priority
- **Login flow in browser** — the full NextAuth credentials flow (CSRF token fetch → POST to callback → cookie set) has not been tested end-to-end in a real browser session. It's implemented correctly but untested.
- **Admin dashboard functionality** — all admin pages return 200 (redirecting to login), but the actual data-fetching and mutations once logged in as admin have not been exercised.
- **Cart → Checkout → Order creation** — the full purchase flow requires a logged-in session and has not been tested end-to-end.
- **Stripe payment flow** — requires real `STRIPE_SECRET_KEY`. The code is complete but untested.
- **Email sending** — requires SMTP credentials. The Nodemailer code is complete but untested.

### Medium priority
- **Image uploads** — `/api/upload` stores to `/public/uploads/`. Directory may not exist. Create it: `mkdir -p /home/flo/shop/public/uploads`
- **Stock management** — decrementing stock on order, low-stock admin notifications
- **Discount code validation at checkout** — the discount endpoint exists but the checkout page's discount input integration needs verification
- **DHL tracking links** — the `tracking_url` field and display in order detail are implemented; link format may need adjustment for production
- **AI suggestions** — requires `AI_API_KEY`. The OpenAI-compatible endpoint is `https://chat-ai.academiccloud.de/v1`

### Low priority
- **Backup via pg_dump** — requires `pg_dump` binary available on server
- **S3 backups** — requires `S3_*` env vars
- **Google OAuth** — requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **Magic link email login** — requires SMTP
- **Admin analytics charts** — data collection is working (page_views table gets rows), visualization may need a charting library or is table-only

---

## Known technical quirks

### Zod v4
- `z.record()` requires **two** arguments: `z.record(z.string(), z.string())`
- Error access uses `.issues` not `.errors`

### Stripe v22
- `Stripe.Checkout.SessionCreateParams` is no longer exported as a namespace type
- Workaround used: `Record<string, unknown>` with type casting

### NextAuth v5 beta
- Session strategy is JWT (not database sessions)
- `auth()` can be called in Server Components and Route Handlers
- The `proxy.ts` file checks for `authjs.session-token` or `__Secure-authjs.session-token` cookies
- Admin role check is cookie-presence only in the proxy (no JWT decode) — actual role verification happens in API routes

### Tailwind v4
- Uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- Custom properties go in `@theme inline { }` block
- See `src/app/globals.css`

### Drizzle ORM 0.45.2
- `inArray()` generates broken SQL for UUID arrays (see bug section above)
- Use `ARRAY[$1::uuid, ...]` pattern instead
- `pgSchema()` is used for the configurable schema name

---

## Suggested next tasks (in priority order)

1. **Create `/public/uploads` directory** — needed for image upload feature
   ```bash
   mkdir -p /home/flo/shop/public/uploads
   ```

2. **Test admin login + dashboard** — open `http://localhost:3000/auth/login`, log in as `admin@3dprintit.de` / `admin123456`, verify dashboard loads with real data

3. **Test full purchase flow** — log in as `kunde@example.de`, add product to cart, go through checkout with bank transfer payment method (doesn't need Stripe)

4. **Add product images** — currently all products have `images: []`. Either:
   - Add placeholder images to `/public/uploads/` and update DB
   - Or verify the "no image" fallback rendering is correct in `ProductCard.tsx`

5. **Set up SMTP** — fill in `SMTP_HOST/USER/PASS` in `.env` to enable order confirmation emails, welcome emails, magic link login

6. **Fix the schema fallback** — change `"student_oc_test0404"` to `"student_test"` in:
   - `src/lib/db/schema.ts` line 16
   - `drizzle.config.ts` line 8

7. **Verify stock decrement on order** — when an order is placed, `product_variants.stock` should decrease. Check `src/app/api/checkout/route.ts` and `src/app/api/webhooks/stripe/route.ts`

8. **Test discount codes** — seed a discount code and verify it applies correctly at checkout

9. **Configure Stripe** — add keys to `.env`, test card payment flow end-to-end

10. **Production deployment** — the build output is `standalone`. Deploy with:
    ```bash
    npm run build
    node .next/standalone/server.js
    ```
