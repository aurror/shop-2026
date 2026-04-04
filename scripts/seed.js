// Seed script: Add sample data for 3DPrintIt
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres",
});

const SCHEMA = process.env.DB_SCHEMA || "student_test";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create admin user
    const adminPasswordHash = await bcrypt.hash("admin123456", 12);
    const adminResult = await client.query(
      `INSERT INTO "${SCHEMA}"."users" ("email", "name", "password_hash", "role", "email_verified")
       VALUES ('admin@3dprintit.de', 'Admin', $1, 'admin', NOW())
       ON CONFLICT ("email") DO UPDATE SET "role" = 'admin'
       RETURNING "id"`,
      [adminPasswordHash]
    );
    const adminId = adminResult.rows[0].id;
    console.log("Admin user created:", adminId);

    // Assign Super Admin role
    const roleResult = await client.query(
      `SELECT "id" FROM "${SCHEMA}"."admin_roles" WHERE "name" = 'Super Admin' LIMIT 1`
    );
    if (roleResult.rows.length > 0) {
      await client.query(
        `INSERT INTO "${SCHEMA}"."user_role_assignments" ("user_id", "role_id")
         VALUES ($1, $2)
         ON CONFLICT ("user_id", "role_id") DO NOTHING`,
        [adminId, roleResult.rows[0].id]
      );
    }

    // Create demo customer
    const customerHash = await bcrypt.hash("customer123", 12);
    await client.query(
      `INSERT INTO "${SCHEMA}"."users" ("email", "name", "password_hash", "role", "email_verified")
       VALUES ('kunde@example.de', 'Max Mustermann', $1, 'customer', NOW())
       ON CONFLICT ("email") DO NOTHING`,
      [customerHash]
    );

    // Create categories
    const categories = [
      { name: "Modelleisenbahn H0", slug: "modelleisenbahn-h0", description: "Modelleisenbahn im Maßstab 1:87 (H0)" },
      { name: "Modelleisenbahn N", slug: "modelleisenbahn-n", description: "Modelleisenbahn im Maßstab 1:160 (N)" },
      { name: "Modelleisenbahn TT", slug: "modelleisenbahn-tt", description: "Modelleisenbahn im Maßstab 1:120 (TT)" },
      { name: "3D-Druck Gebäude", slug: "3d-druck-gebaeude", description: "3D-gedruckte Gebäude und Bauwerke" },
      { name: "3D-Druck Figuren", slug: "3d-druck-figuren", description: "3D-gedruckte Figuren und Details" },
      { name: "3D-Druck Zubehör", slug: "3d-druck-zubehoer", description: "3D-gedrucktes Zubehör und Kleinteile" },
    ];

    const categoryIds = {};
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const result = await client.query(
        `INSERT INTO "${SCHEMA}"."categories" ("name", "slug", "description", "sort_order")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("slug") DO UPDATE SET "name" = $1
         RETURNING "id"`,
        [cat.name, cat.slug, cat.description, i]
      );
      categoryIds[cat.slug] = result.rows[0].id;
    }
    console.log("Categories created:", Object.keys(categoryIds).length);

    // Create products
    const productData = [
      {
        name: "Bahnhof Friedrichstadt H0",
        slug: "bahnhof-friedrichstadt-h0",
        description: "Detailgetreues Modell des Bahnhofs Friedrichstadt im Maßstab H0. 3D-gedruckt aus hochwertigem PLA mit feinen Details an Fenstern, Türen und Dachkonstruktion.",
        descriptionHtml: "<p>Detailgetreues Modell des Bahnhofs Friedrichstadt im Maßstab H0. 3D-gedruckt aus hochwertigem PLA mit feinen Details an Fenstern, Türen und Dachkonstruktion.</p><h3>Merkmale</h3><ul><li>Maßstab 1:87 (H0)</li><li>Material: PLA</li><li>Handbemalt verfügbar</li><li>Modularer Aufbau</li></ul>",
        basePrice: "49.99",
        weight: "0.35",
        categorySlug: "3d-druck-gebaeude",
        featured: true,
        variants: [
          { name: "Unbemalt", sku: "BF-H0-UB", price: "49.99", stock: 15, attributes: { finish: "Unbemalt" } },
          { name: "Handbemalt", sku: "BF-H0-HB", price: "79.99", stock: 5, attributes: { finish: "Handbemalt" } },
        ],
      },
      {
        name: "Stellwerk Typ Jüdel N",
        slug: "stellwerk-juedel-n",
        description: "Klassisches Stellwerk Typ Jüdel für N-Spur. Feine Details, passend für jede Epoche III-V Anlage.",
        descriptionHtml: "<p>Klassisches Stellwerk Typ Jüdel für N-Spur. Feine Details, passend für jede Epoche III-V Anlage.</p>",
        basePrice: "29.99",
        weight: "0.12",
        categorySlug: "modelleisenbahn-n",
        featured: true,
        variants: [
          { name: "Standard", sku: "SJ-N-STD", price: "29.99", stock: 20, attributes: { color: "Ziegelrot" } },
          { name: "Sandstein", sku: "SJ-N-SS", price: "29.99", stock: 12, attributes: { color: "Sandstein" } },
        ],
      },
      {
        name: "Figurenset Bahnhofspersonal H0",
        slug: "figurenset-bahnhofspersonal-h0",
        description: "Set aus 12 detaillierten Figuren: Bahnhofsvorsteher, Schaffner, Reisende und Gepäckträger. Perfekt für die lebendige Gestaltung Ihrer H0-Anlage.",
        descriptionHtml: "<p>Set aus 12 detaillierten Figuren: Bahnhofsvorsteher, Schaffner, Reisende und Gepäckträger. Perfekt für die lebendige Gestaltung Ihrer H0-Anlage.</p><p><strong>Inhalt:</strong> 12 Figuren, unbemalt</p>",
        basePrice: "24.99",
        weight: "0.05",
        categorySlug: "3d-druck-figuren",
        featured: true,
        variants: [
          { name: "Unbemalt (12 Stk)", sku: "FBP-H0-12", price: "24.99", stock: 30, attributes: {} },
          { name: "Bemalt (12 Stk)", sku: "FBP-H0-12B", price: "44.99", stock: 8, attributes: {} },
        ],
      },
      {
        name: "Brückenpfeiler Set TT",
        slug: "brueckenpfeiler-set-tt",
        description: "Set aus 4 Brückenpfeilern im TT-Maßstab. Ideal für Talüberquerungen und mehrstöckige Gleisführungen.",
        descriptionHtml: "<p>Set aus 4 Brückenpfeilern im TT-Maßstab. Ideal für Talüberquerungen und mehrstöckige Gleisführungen.</p>",
        basePrice: "19.99",
        weight: "0.20",
        categorySlug: "modelleisenbahn-tt",
        featured: false,
        variants: [
          { name: "Beton (4 Stk)", sku: "BP-TT-B4", price: "19.99", stock: 25, attributes: { material: "Beton-Optik" } },
          { name: "Naturstein (4 Stk)", sku: "BP-TT-N4", price: "22.99", stock: 15, attributes: { material: "Naturstein-Optik" } },
        ],
      },
      {
        name: "Laternenset klassisch H0",
        slug: "laternenset-klassisch-h0",
        description: "6 klassische Straßenlaternen im H0-Maßstab. Hohlkörper für optionale LED-Beleuchtung vorbereitet.",
        descriptionHtml: "<p>6 klassische Straßenlaternen im H0-Maßstab. Hohlkörper für optionale LED-Beleuchtung vorbereitet.</p><p>Maße: ca. 25mm Höhe</p>",
        basePrice: "14.99",
        weight: "0.03",
        categorySlug: "3d-druck-zubehoer",
        featured: false,
        variants: [
          { name: "6er Set", sku: "LAT-H0-6", price: "14.99", stock: 40, attributes: {} },
          { name: "12er Set", sku: "LAT-H0-12", price: "24.99", stock: 20, attributes: {} },
        ],
      },
      {
        name: "Wasserkran Dampflok H0",
        slug: "wasserkran-dampflok-h0",
        description: "Detaillierter Wasserkran für Dampflok-Betriebswerke. Maßstab H0, drehbar.",
        descriptionHtml: "<p>Detaillierter Wasserkran für Dampflok-Betriebswerke. Maßstab H0, drehbar.</p>",
        basePrice: "12.99",
        weight: "0.04",
        categorySlug: "3d-druck-zubehoer",
        featured: true,
        variants: [
          { name: "Standard", sku: "WK-H0-STD", price: "12.99", stock: 35, attributes: {} },
        ],
      },
      {
        name: "Lokschuppen zweiständig H0",
        slug: "lokschuppen-zweistaendig-h0",
        description: "Zweiständiger Lokschuppen im H0-Maßstab. Modular erweiterbar, Tore zum Öffnen.",
        descriptionHtml: "<p>Zweiständiger Lokschuppen im H0-Maßstab. Modular erweiterbar, Tore zum Öffnen.</p><h3>Eigenschaften</h3><ul><li>2 Gleiszufahrten</li><li>Öffenbare Tore</li><li>Dachkonstruktion mit Lüftungsaufsätzen</li><li>Erweiterbar mit Zusatzmodulen</li></ul>",
        basePrice: "89.99",
        weight: "0.85",
        categorySlug: "3d-druck-gebaeude",
        featured: true,
        variants: [
          { name: "Unbemalt", sku: "LS-H0-2-UB", price: "89.99", stock: 8, attributes: { finish: "Unbemalt" } },
          { name: "Grundiert", sku: "LS-H0-2-GR", price: "99.99", stock: 4, attributes: { finish: "Grundiert" } },
          { name: "Handbemalt", sku: "LS-H0-2-HB", price: "149.99", stock: 2, attributes: { finish: "Handbemalt" } },
        ],
      },
      {
        name: "Empfangsgebäude Klein N",
        slug: "empfangsgebaeude-klein-n",
        description: "Kleines Empfangsgebäude für Nebenbahnen im N-Maßstab. Kompakt und detailliert.",
        descriptionHtml: "<p>Kleines Empfangsgebäude für Nebenbahnen im N-Maßstab. Kompakt und detailliert.</p>",
        basePrice: "34.99",
        weight: "0.08",
        categorySlug: "modelleisenbahn-n",
        featured: false,
        variants: [
          { name: "Standard", sku: "EG-N-KL", price: "34.99", stock: 18, attributes: {} },
        ],
      },
      {
        name: "Mauerwerk-Set Industriegebäude H0",
        slug: "mauerwerk-set-industrie-h0",
        description: "Wandelemente für individuelle Industriegebäude. 8 Wandsegmente, kombinierbar.",
        descriptionHtml: "<p>Wandelemente für individuelle Industriegebäude. 8 Wandsegmente, kombinierbar.</p>",
        basePrice: "39.99",
        weight: "0.30",
        categorySlug: "3d-druck-gebaeude",
        featured: false,
        variants: [
          { name: "8er Set Klinker", sku: "MW-H0-KL8", price: "39.99", stock: 12, attributes: { style: "Klinker" } },
          { name: "8er Set Putz", sku: "MW-H0-PZ8", price: "39.99", stock: 10, attributes: { style: "Verputzt" } },
        ],
      },
      {
        name: "Prellbock mit Puffer H0",
        slug: "prellbock-puffer-h0",
        description: "Detaillierter Prellbock mit Puffer für Gleisenden. 3er Set.",
        descriptionHtml: "<p>Detaillierter Prellbock mit Puffer für Gleisenden. 3er Set.</p>",
        basePrice: "9.99",
        weight: "0.02",
        categorySlug: "3d-druck-zubehoer",
        featured: false,
        variants: [
          { name: "3er Set", sku: "PB-H0-3", price: "9.99", stock: 50, attributes: {} },
        ],
      },
    ];

    const productIds = {};
    for (const p of productData) {
      const catId = categoryIds[p.categorySlug] || null;
      const result = await client.query(
        `INSERT INTO "${SCHEMA}"."products" ("name", "slug", "description", "description_html", "base_price", "weight", "category_id", "featured", "active", "images")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, '[]')
         ON CONFLICT ("slug") DO UPDATE SET "name" = $1
         RETURNING "id"`,
        [p.name, p.slug, p.description, p.descriptionHtml, p.basePrice, p.weight, catId, p.featured]
      );
      productIds[p.slug] = result.rows[0].id;

      // Insert variants
      for (const v of p.variants) {
        await client.query(
          `INSERT INTO "${SCHEMA}"."product_variants" ("product_id", "name", "sku", "price", "stock", "weight", "attributes", "active")
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT ("sku") DO UPDATE SET "stock" = $5
           RETURNING "id"`,
          [result.rows[0].id, v.name, v.sku, v.price, v.stock, p.weight, JSON.stringify(v.attributes || {})]
        );
      }
    }
    console.log("Products created:", Object.keys(productIds).length);

    // Create product relations
    const relations = [
      { from: "bahnhof-friedrichstadt-h0", to: "figurenset-bahnhofspersonal-h0", type: "accessory" },
      { from: "bahnhof-friedrichstadt-h0", to: "laternenset-klassisch-h0", type: "accessory" },
      { from: "lokschuppen-zweistaendig-h0", to: "wasserkran-dampflok-h0", type: "accessory" },
      { from: "lokschuppen-zweistaendig-h0", to: "prellbock-puffer-h0", type: "accessory" },
      { from: "stellwerk-juedel-n", to: "empfangsgebaeude-klein-n", type: "related" },
      { from: "mauerwerk-set-industrie-h0", to: "lokschuppen-zweistaendig-h0", type: "related" },
      { from: "figurenset-bahnhofspersonal-h0", to: "bahnhof-friedrichstadt-h0", type: "related" },
    ];

    for (const rel of relations) {
      const fromId = productIds[rel.from];
      const toId = productIds[rel.to];
      if (fromId && toId) {
        await client.query(
          `INSERT INTO "${SCHEMA}"."product_relations" ("product_id", "related_product_id", "relation_type")
           VALUES ($1, $2, $3)
           ON CONFLICT ("product_id", "related_product_id", "relation_type") DO NOTHING`,
          [fromId, toId, rel.type]
        );
      }
    }
    console.log("Relations created:", relations.length);

    await client.query("COMMIT");
    console.log("Seed completed successfully!");
    console.log("");
    console.log("=== Login Credentials ===");
    console.log("Admin:    admin@3dprintit.de / admin123456");
    console.log("Customer: kunde@example.de / customer123");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
