// Migration script: Drop old tables and create new schema
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres",
});

const SCHEMA = "student_test";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Drop all existing tables in order (respecting foreign keys)
    const dropOrder = [
      "order_discounts",
      "order_status_history",
      "email_queue",
      "stock_requests",
      "page_views",
      "product_images",
      "product_relations",
      "order_items",
      "cart_items",
      "carts",
      "addresses",
      "sessions",
      "verification_tokens",
      "accounts",
      "user_roles",
      "settings",
      "discounts",
      "orders",
      "products",
      "categories",
      "roles",
      "users",
    ];

    for (const table of dropOrder) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${SCHEMA}"."${table}" CASCADE`);
        console.log(`Dropped ${table}`);
      } catch (e) {
        console.log(`Could not drop ${table}: ${e.message}`);
      }
    }

    // Create all new tables
    await client.query(`
      -- Users
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."users" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" text,
        "email" text NOT NULL UNIQUE,
        "email_verified" timestamp,
        "image" text,
        "password_hash" text,
        "role" text NOT NULL DEFAULT 'customer',
        "phone" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "users_email_idx" ON "${SCHEMA}"."users" ("email");
      CREATE INDEX IF NOT EXISTS "users_role_idx" ON "${SCHEMA}"."users" ("role");

      -- Accounts (NextAuth)
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."accounts" (
        "user_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "provider" text NOT NULL,
        "provider_account_id" text NOT NULL,
        "refresh_token" text,
        "access_token" text,
        "expires_at" integer,
        "token_type" text,
        "scope" text,
        "id_token" text,
        "session_state" text,
        PRIMARY KEY ("provider", "provider_account_id")
      );

      -- Sessions
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."sessions" (
        "session_token" text PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "expires" timestamp NOT NULL
      );

      -- Verification Tokens
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."verification_tokens" (
        "identifier" text NOT NULL,
        "token" text NOT NULL,
        "expires" timestamp NOT NULL,
        PRIMARY KEY ("identifier", "token")
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."categories" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "description" text,
        "parent_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      -- Products
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."products" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" text NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "description" text,
        "description_html" text,
        "base_price" decimal(10,2) NOT NULL,
        "compare_at_price" decimal(10,2),
        "category_id" uuid REFERENCES "${SCHEMA}"."categories"("id") ON DELETE SET NULL,
        "images" jsonb DEFAULT '[]',
        "weight" decimal(8,2) DEFAULT 0,
        "featured" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "tax_rate" decimal(5,2) NOT NULL DEFAULT 19.00,
        "meta_title" text,
        "meta_description" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "products_category_idx" ON "${SCHEMA}"."products" ("category_id");
      CREATE INDEX IF NOT EXISTS "products_featured_idx" ON "${SCHEMA}"."products" ("featured");
      CREATE INDEX IF NOT EXISTS "products_active_idx" ON "${SCHEMA}"."products" ("active");
      CREATE INDEX IF NOT EXISTS "products_slug_idx" ON "${SCHEMA}"."products" ("slug");

      -- Product Variants
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."product_variants" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "sku" text NOT NULL UNIQUE,
        "price" decimal(10,2),
        "stock" integer NOT NULL DEFAULT 0,
        "low_stock_threshold" integer NOT NULL DEFAULT 5,
        "weight" decimal(8,2),
        "attributes" jsonb DEFAULT '{}',
        "active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "images" jsonb DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "variants_product_idx" ON "${SCHEMA}"."product_variants" ("product_id");
      CREATE INDEX IF NOT EXISTS "variants_sku_idx" ON "${SCHEMA}"."product_variants" ("sku");

      -- Product Relations
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."product_relations" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "related_product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "relation_type" text NOT NULL DEFAULT 'related',
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("product_id", "related_product_id", "relation_type")
      );
      CREATE INDEX IF NOT EXISTS "relations_product_idx" ON "${SCHEMA}"."product_relations" ("product_id");

      -- Product Relation Suggestions (AI)
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."product_relation_suggestions" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "suggested_product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "reasoning" text,
        "confidence" decimal(3,2),
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "reviewed_at" timestamp
      );
      CREATE INDEX IF NOT EXISTS "suggestions_product_idx" ON "${SCHEMA}"."product_relation_suggestions" ("product_id");

      -- Discounts
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."discounts" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "code" text NOT NULL UNIQUE,
        "description" text,
        "type" text NOT NULL,
        "value" decimal(10,2) NOT NULL,
        "min_order_amount" decimal(10,2),
        "max_uses" integer,
        "current_uses" integer NOT NULL DEFAULT 0,
        "product_ids" jsonb,
        "category_ids" jsonb,
        "starts_at" timestamp,
        "expires_at" timestamp,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      -- Addresses
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."addresses" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "label" text DEFAULT 'Standard',
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "company" text,
        "street" text NOT NULL,
        "street_number" text NOT NULL,
        "address_extra" text,
        "zip" text NOT NULL,
        "city" text NOT NULL,
        "country" text NOT NULL DEFAULT 'DE',
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "addresses_user_idx" ON "${SCHEMA}"."addresses" ("user_id");

      -- Orders
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."orders" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "order_number" text NOT NULL UNIQUE,
        "user_id" uuid REFERENCES "${SCHEMA}"."users"("id") ON DELETE SET NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "payment_method" text NOT NULL,
        "payment_status" text NOT NULL DEFAULT 'pending',
        "stripe_session_id" text,
        "stripe_payment_intent_id" text,
        "subtotal" decimal(10,2) NOT NULL,
        "discount_amount" decimal(10,2) DEFAULT 0,
        "shipping_cost" decimal(10,2) NOT NULL,
        "tax_amount" decimal(10,2) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "discount_id" uuid REFERENCES "${SCHEMA}"."discounts"("id") ON DELETE SET NULL,
        "shipping_address" jsonb,
        "billing_address" jsonb,
        "tracking_number" text,
        "tracking_url" text,
        "notes" text,
        "customer_email" text NOT NULL,
        "customer_phone" text,
        "agreed_to_terms" boolean NOT NULL DEFAULT false,
        "agreed_to_withdrawal" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "${SCHEMA}"."orders" ("user_id");
      CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "${SCHEMA}"."orders" ("status");
      CREATE INDEX IF NOT EXISTS "orders_number_idx" ON "${SCHEMA}"."orders" ("order_number");
      CREATE INDEX IF NOT EXISTS "orders_created_idx" ON "${SCHEMA}"."orders" ("created_at");

      -- Order Items
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."order_items" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "${SCHEMA}"."orders"("id") ON DELETE CASCADE,
        "product_id" uuid REFERENCES "${SCHEMA}"."products"("id") ON DELETE SET NULL,
        "variant_id" uuid REFERENCES "${SCHEMA}"."product_variants"("id") ON DELETE SET NULL,
        "product_name" text NOT NULL,
        "variant_name" text,
        "sku" text,
        "quantity" integer NOT NULL,
        "unit_price" decimal(10,2) NOT NULL,
        "total_price" decimal(10,2) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "${SCHEMA}"."order_items" ("order_id");

      -- Cart Items
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."cart_items" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL REFERENCES "${SCHEMA}"."product_variants"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL DEFAULT 1,
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "variant_id")
      );
      CREATE INDEX IF NOT EXISTS "cart_user_idx" ON "${SCHEMA}"."cart_items" ("user_id");

      -- Stock Notifications
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."stock_notifications" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "email" text NOT NULL,
        "product_id" uuid NOT NULL REFERENCES "${SCHEMA}"."products"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL REFERENCES "${SCHEMA}"."product_variants"("id") ON DELETE CASCADE,
        "notified" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "notified_at" timestamp
      );
      CREATE INDEX IF NOT EXISTS "stock_notif_variant_idx" ON "${SCHEMA}"."stock_notifications" ("variant_id");
      CREATE INDEX IF NOT EXISTS "stock_notif_email_idx" ON "${SCHEMA}"."stock_notifications" ("email");

      -- Page Views
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."page_views" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "path" text NOT NULL,
        "referrer" text,
        "user_agent" text,
        "ip_hash" text,
        "session_id" text,
        "user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "page_views_path_idx" ON "${SCHEMA}"."page_views" ("path");
      CREATE INDEX IF NOT EXISTS "page_views_created_idx" ON "${SCHEMA}"."page_views" ("created_at");

      -- Admin Notifications
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."admin_notifications" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "data" jsonb,
        "read" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "admin_notif_read_idx" ON "${SCHEMA}"."admin_notifications" ("read");
      CREATE INDEX IF NOT EXISTS "admin_notif_created_idx" ON "${SCHEMA}"."admin_notifications" ("created_at");

      -- Settings
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."settings" (
        "key" text PRIMARY KEY,
        "value" jsonb NOT NULL,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      -- Backup Logs
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."backup_logs" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "filename" text NOT NULL,
        "location" text NOT NULL,
        "path" text NOT NULL,
        "size_bytes" integer,
        "status" text NOT NULL,
        "error" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "backup_logs_created_idx" ON "${SCHEMA}"."backup_logs" ("created_at");

      -- Admin Roles
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."admin_roles" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "name" text NOT NULL UNIQUE,
        "description" text,
        "permissions" jsonb NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );

      -- User Role Assignments
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."user_role_assignments" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "role_id" uuid NOT NULL REFERENCES "${SCHEMA}"."admin_roles"("id") ON DELETE CASCADE,
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "role_id")
      );

      -- Email Templates
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."email_templates" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "key" text NOT NULL UNIQUE,
        "subject" text NOT NULL,
        "body_html" text NOT NULL,
        "body_text" text,
        "variables" jsonb DEFAULT '[]',
        "updated_at" timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."order_returns" (
        "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        "order_id" uuid NOT NULL REFERENCES "${SCHEMA}"."orders"("id") ON DELETE CASCADE,
        "customer_id" uuid NOT NULL REFERENCES "${SCHEMA}"."users"("id") ON DELETE CASCADE,
        "reason" text NOT NULL DEFAULT 'other',
        "reason_detail" text,
        "status" text NOT NULL DEFAULT 'requested',
        "action" text,
        "admin_notes" text,
        "items" jsonb DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "returns_order_idx" ON "${SCHEMA}"."order_returns" ("order_id");
      CREATE INDEX IF NOT EXISTS "returns_customer_idx" ON "${SCHEMA}"."order_returns" ("customer_id");
    `);

    // Insert default settings
    await client.query(`
      INSERT INTO "${SCHEMA}"."settings" ("key", "value") VALUES
        ('shipping_base_fee', '"4.99"'),
        ('shipping_per_kg', '"1.50"'),
        ('shipping_free_threshold_enabled', 'true'),
        ('shipping_free_threshold', '"50.00"'),
        ('store_name', '"3DPrintIt"'),
        ('store_email', '"info@3dprintit.de"'),
        ('store_phone', '""'),
        ('store_address', '""'),
        ('bank_transfer_details', '{"bank": "", "iban": "", "bic": "", "accountHolder": ""}'),
        ('smtp_host', '""'),
        ('smtp_port', '587'),
        ('smtp_user', '""'),
        ('smtp_pass', '""'),
        ('smtp_from', '"noreply@3dprintit.de"'),
        ('ai_base_url', '"https://chat-ai.academiccloud.de/v1"'),
        ('ai_api_key', '""'),
        ('ai_model', '"gpt-4"'),
        ('backup_local_path', '"/var/backups/3dprintit"'),
        ('backup_s3_endpoint', '""'),
        ('backup_s3_region', '"eu-central-1"'),
        ('backup_s3_bucket', '""'),
        ('backup_s3_access_key', '""'),
        ('backup_s3_secret_key', '""'),
        ('backup_retention_count', '10'),
        ('low_stock_threshold', '5'),
        ('impressum_content', '"<p>Angaben gem&auml;&szlig; &sect; 5 TMG</p><p>Bitte f&uuml;llen Sie Ihr Impressum aus.</p>"'),
        ('datenschutz_content', '"<p>Datenschutzerkl&auml;rung - Bitte konfigurieren Sie diese Seite.</p>"'),
        ('agb_content', '"<p>Allgemeine Gesch&auml;ftsbedingungen - Bitte konfigurieren Sie diese Seite.</p>"'),
        ('widerruf_content', '"<p>Widerrufsbelehrung - Bitte konfigurieren Sie diese Seite.</p>"')
      ON CONFLICT ("key") DO NOTHING;
    `);

    // Insert default admin role
    await client.query(`
      INSERT INTO "${SCHEMA}"."admin_roles" ("name", "description", "permissions") VALUES
        ('Super Admin', 'Full access to all features', '${JSON.stringify({
          orders: { view: true, edit: true, delete: true },
          products: { view: true, edit: true, delete: true },
          customers: { view: true, edit: true },
          analytics: { view: true },
          discounts: { view: true, edit: true, delete: true },
          settings: { view: true, edit: true },
          backups: { view: true, create: true },
          roles: { view: true, edit: true },
        })}'),
        ('Staff', 'View orders and products, manage stock', '${JSON.stringify({
          orders: { view: true, edit: true, delete: false },
          products: { view: true, edit: true, delete: false },
          customers: { view: true, edit: false },
          analytics: { view: true },
          discounts: { view: true, edit: false, delete: false },
          settings: { view: false, edit: false },
          backups: { view: false, create: false },
          roles: { view: false, edit: false },
        })}')
      ON CONFLICT ("name") DO NOTHING;
    `);

    // Insert default email templates
    await client.query(`
      INSERT INTO "${SCHEMA}"."email_templates" ("key", "subject", "body_html", "body_text", "variables") VALUES
        ('order_confirmation', 'Bestellbestätigung - Bestellung {{orderNumber}}',
         '<h2>Vielen Dank für Ihre Bestellung!</h2><p>Ihre Bestellnummer: <strong>{{orderNumber}}</strong></p><p>Gesamtbetrag: {{total}} €</p><p>Wir bearbeiten Ihre Bestellung schnellstmöglich.</p>',
         'Vielen Dank für Ihre Bestellung! Ihre Bestellnummer: {{orderNumber}}. Gesamtbetrag: {{total}} €',
         '["orderNumber", "total", "customerName"]'),
        ('payment_received', 'Zahlung erhalten - Bestellung {{orderNumber}}',
         '<h2>Zahlung erhalten</h2><p>Wir haben die Zahlung für Ihre Bestellung <strong>{{orderNumber}}</strong> erhalten.</p><p>Ihre Bestellung wird nun bearbeitet.</p>',
         'Wir haben die Zahlung für Ihre Bestellung {{orderNumber}} erhalten.',
         '["orderNumber", "customerName"]'),
        ('shipping_notification', 'Ihre Bestellung {{orderNumber}} wurde versendet',
         '<h2>Ihre Bestellung ist unterwegs!</h2><p>Bestellung: <strong>{{orderNumber}}</strong></p><p>Sendungsnummer: {{trackingNumber}}</p><p><a href="{{trackingUrl}}">Sendung verfolgen</a></p>',
         'Ihre Bestellung {{orderNumber}} wurde versendet. Sendungsnummer: {{trackingNumber}}',
         '["orderNumber", "trackingNumber", "trackingUrl", "customerName"]'),
        ('stock_notification', '{{productName}} ist wieder verfügbar!',
         '<h2>Gute Neuigkeiten!</h2><p><strong>{{productName}}</strong> ({{variantName}}) ist wieder auf Lager.</p><p><a href="{{productUrl}}">Jetzt bestellen</a></p>',
         '{{productName}} ({{variantName}}) ist wieder verfügbar! Jetzt bestellen: {{productUrl}}',
         '["productName", "variantName", "productUrl"]'),
        ('welcome', 'Willkommen bei 3DPrintIt!',
         '<h2>Willkommen bei 3DPrintIt!</h2><p>Hallo {{name}},</p><p>vielen Dank für Ihre Registrierung. Wir freuen uns, Sie als Kunden begrüßen zu dürfen.</p>',
         'Willkommen bei 3DPrintIt! Hallo {{name}}, vielen Dank für Ihre Registrierung.',
         '["name"]'),
        ('magic_link', 'Ihr Anmelde-Link für 3DPrintIt',
         '<h2>Anmeldung bei 3DPrintIt</h2><p>Klicken Sie auf den folgenden Link, um sich anzumelden:</p><p><a href="{{url}}">Jetzt anmelden</a></p><p>Dieser Link ist 24 Stunden gültig.</p>',
         'Anmeldung bei 3DPrintIt. Link: {{url}} (24 Stunden gültig)',
         '["url"]'),
        ('bank_transfer_info', 'Bankverbindung für Bestellung {{orderNumber}}',
         '<h2>Bestellung {{orderNumber}}</h2><p>Bitte überweisen Sie <strong>{{total}} €</strong> an:</p><p>Kontoinhaber: {{accountHolder}}<br>IBAN: {{iban}}<br>BIC: {{bic}}<br>Bank: {{bank}}<br>Verwendungszweck: {{orderNumber}}</p>',
         'Bestellung {{orderNumber}}: Bitte überweisen Sie {{total}} € an IBAN {{iban}}, Verwendungszweck: {{orderNumber}}',
         '["orderNumber", "total", "accountHolder", "iban", "bic", "bank"]')
      ON CONFLICT ("key") DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("Migration completed successfully!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
