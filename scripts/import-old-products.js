/**
 * Import old shop products from shop.sql dump and images/ folder
 * 
 * Parses the MariaDB SQL dump, maps categories, processes images with sharp,
 * and inserts products into the new PostgreSQL schema.
 * 
 * Usage: node scripts/import-old-products.js
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres",
});
const SCHEMA = process.env.DB_SCHEMA || "student_test";

// Map old category IDs to new category UUIDs
// Old categories from shop.sql: 1=' 0', 2='H0', 3='Zubehör', 4='Wagen', 6='Spur N',
// 7='E-Lok', 8='Dampf Lok', 9='Güterwagen', 13='Triebwagen', 14='Diesellok',
// 16='Hilfsmittel', 17='Farben und Zubeör', 19='Eigene Modelle', 21='3D Druckteile',
// 30='Dampf-Lok', 31='Schienen- Weichen-Antriebe', 33='Bundeswehr', 34='Fahrzeuge', 41='H0-Zubehör'
//
// New categories:
// 3D-Druck Figuren, 3D-Druck Gebäude, 3D-Druck Zubehör,
// Modelleisenbahn H0, Modelleisenbahn N, Modelleisenbahn TT

// We'll query the new categories at runtime and map
const OLD_TO_NEW_CATEGORY = {
  // H0 scale stuff
  2: "modelleisenbahn-h0",      // H0
  4: "modelleisenbahn-h0",      // Wagen (carriages)
  7: "modelleisenbahn-h0",      // E-Lok
  8: "modelleisenbahn-h0",      // Dampf Lok
  9: "modelleisenbahn-h0",      // Güterwagen
  13: "modelleisenbahn-h0",     // Triebwagen
  14: "modelleisenbahn-h0",     // Diesellok
  30: "modelleisenbahn-h0",     // Dampf-Lok
  41: "modelleisenbahn-h0",     // H0-Zubehör
  // N scale
  6: "modelleisenbahn-n",       // Spur N
  // 3D print parts
  19: "3d-druck-zubehoer",      // Eigene Modelle
  21: "3d-druck-zubehoer",      // 3D Druckteile
  // Accessories / general
  3: "3d-druck-zubehoer",       // Zubehör
  16: "3d-druck-zubehoer",      // Hilfsmittel
  17: "3d-druck-zubehoer",      // Farben und Zubeör
  31: "3d-druck-zubehoer",      // Schienen/Weichen-Antriebe
  33: "modelleisenbahn-h0",     // Bundeswehr (military models)
  34: "modelleisenbahn-h0",     // Fahrzeuge (vehicles)
  1: "modelleisenbahn-h0",      // ' 0' (default/uncategorized)
};

/**
 * Parse a MariaDB SQL INSERT statement, handling quoted strings with escapes
 */
function parseInsertValues(sql, tableName) {
  // Find the INSERT INTO `tableName` ... VALUES block
  const pattern = new RegExp(
    `INSERT INTO \\\`${tableName}\\\`\\s*\\([^)]+\\)\\s*VALUES\\s*`,
    "i"
  );
  const match = sql.match(pattern);
  if (!match) return [];

  const startIdx = match.index + match[0].length;
  
  // Parse rows - each row is (...), separated by commas, terminated by ;
  const rows = [];
  let i = startIdx;
  
  while (i < sql.length) {
    // Skip whitespace
    while (i < sql.length && /[\s\t\n]/.test(sql[i])) i++;
    
    if (sql[i] === ";") break;
    if (sql[i] === ",") { i++; continue; }
    
    if (sql[i] !== "(") break;
    i++; // skip opening (
    
    const fields = [];
    let fieldStart = i;
    let inQuote = false;
    let current = "";
    
    while (i < sql.length) {
      if (inQuote) {
        if (sql[i] === "\\" && i + 1 < sql.length) {
          current += sql[i + 1];
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            current += "'";
            i += 2;
            continue;
          }
          inQuote = false;
          i++;
          continue;
        }
        current += sql[i];
        i++;
      } else {
        if (sql[i] === "'") {
          inQuote = true;
          i++;
          continue;
        }
        if (sql[i] === "," || sql[i] === ")") {
          const trimmed = current.trim();
          if (trimmed === "NULL") {
            fields.push(null);
          } else {
            // Try to parse as number
            const num = Number(trimmed);
            if (!isNaN(num) && trimmed !== "") {
              fields.push(num);
            } else {
              fields.push(trimmed);
            }
          }
          current = "";
          
          if (sql[i] === ")") {
            i++;
            break;
          }
          i++;
          continue;
        }
        current += sql[i];
        i++;
      }
    }
    
    if (fields.length > 0) {
      rows.push(fields);
    }
  }
  
  return rows;
}

/**
 * Process an image with sharp - resize, convert to webp, strip EXIF
 */
async function processImage(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();
  const hash = crypto.randomBytes(8).toString("hex");
  const filename = `imported_${hash}.webp`;
  const thumbFilename = `thumb_imported_${hash}.webp`;
  
  const outputPath = path.join(outputDir, filename);
  const thumbPath = path.join(outputDir, thumbFilename);
  
  try {
    // Full size
    await sharp(inputPath)
      .rotate() // auto-rotate based on EXIF
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);
    
    // Thumbnail
    await sharp(inputPath)
      .rotate()
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(thumbPath);
    
    return {
      url: `/uploads/${filename}`,
      thumbUrl: `/uploads/${thumbFilename}`,
    };
  } catch (err) {
    console.error(`  Failed to process image ${inputPath}: ${err.message}`);
    return null;
  }
}

/**
 * Generate a URL-friendly slug from a product name
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&[a-z]+;/g, "") // strip HTML entities
    .replace(/<[^>]*>/g, "")  // strip HTML tags
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

/**
 * Strip HTML tags and decode entities for plain text
 */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&auml;/g, "ä")
    .replace(/&#\d+;/g, "")
    .trim();
}

async function main() {
  console.log("=== Importing old shop products ===\n");
  
  // Read SQL dump
  const sql = fs.readFileSync(path.join(__dirname, "..", "shop.sql"), "utf-8");
  
  // Parse all relevant tables
  console.log("Parsing SQL dump...");
  
  const products = parseInsertValues(sql, "product");
  const descriptions = parseInsertValues(sql, "product_description");
  const images = parseInsertValues(sql, "product_image");
  const productToImage = parseInsertValues(sql, "product_to_image");
  const productToCategory = parseInsertValues(sql, "product_to_category");
  const categories = parseInsertValues(sql, "category");
  
  console.log(`  Products: ${products.length} rows`);
  console.log(`  Descriptions: ${descriptions.length} rows`);
  console.log(`  Images: ${images.length} rows`);
  console.log(`  Product-to-image: ${productToImage.length} rows`);
  console.log(`  Product-to-category: ${productToCategory.length} rows`);
  console.log(`  Categories: ${categories.length} rows`);
  
  // Build description map: id -> {name, description, metaTitle, metaDescription}
  const descMap = {};
  for (const row of descriptions) {
    // id, language_id, name, variantname, description, metaTitle, metaDescription, metaKeyword, automaticSEO
    const id = row[0];
    descMap[id] = {
      name: row[2] || "",
      variantName: row[3] || "",
      description: row[4] || "",
      metaTitle: row[5] || "",
      metaDescription: row[6] || "",
    };
  }
  
  // Build image map: image_id -> {path, pathSmall}
  const imgMap = {};
  for (const row of images) {
    // product_image_id, path, path_small, date_added, deprecated
    imgMap[row[0]] = {
      path: row[1],
      pathSmall: row[2],
    };
  }
  
  // Build product->images map (sorted by sort_order)
  const productImagesMap = {};
  for (const row of productToImage) {
    // product_id, image_id, sort_order, date_added
    const pid = row[0];
    const imgId = row[1];
    const sort = row[2];
    if (!productImagesMap[pid]) productImagesMap[pid] = [];
    productImagesMap[pid].push({ imgId, sort });
  }
  // Sort each product's images
  for (const pid of Object.keys(productImagesMap)) {
    productImagesMap[pid].sort((a, b) => a.sort - b.sort);
  }
  
  // Build product->category map
  const productCategoryMap = {};
  for (const row of productToCategory) {
    const pid = row[0];
    const catId = row[1];
    productCategoryMap[pid] = catId;
  }
  
  // Build latest revision map for products
  // product_id, revision, product_description_id, product_number, stock_quantity,
  // stock_status_id, price, tax_id, date_available, weight, weight_class_id,
  // length, width, height, length_class_id, quantity_per_lot, date_added, date_modified,
  // manufacturing_price, digital, viewed, public, status
  const productMap = {};
  for (const row of products) {
    const pid = row[0];
    const revision = row[1];
    if (!productMap[pid] || revision > productMap[pid].revision) {
      productMap[pid] = {
        revision,
        descId: row[2],
        sku: row[3],
        stock: row[4],
        price: row[6],
        weight: row[9],
        dateAdded: row[16],
        isPublic: row[21],
        status: row[22],
      };
    }
  }
  
  // Filter to public products only
  const publicProducts = Object.entries(productMap)
    .filter(([_, p]) => p.isPublic === 1)
    .map(([pid, p]) => ({ oldId: Number(pid), ...p }));
  
  console.log(`\nPublic products to import: ${publicProducts.length}`);
  
  // Get new categories from DB
  const client = await pool.connect();
  try {
    const catResult = await client.query(
      `SELECT id, slug FROM "${SCHEMA}".categories`
    );
    const newCatMap = {};
    for (const row of catResult.rows) {
      newCatMap[row.slug] = row.id;
    }
    console.log("New categories:", Object.keys(newCatMap).join(", "));
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Check which products already exist (by slug) to avoid duplicates
    const existingResult = await client.query(
      `SELECT slug FROM "${SCHEMA}".products`
    );
    const existingSlugs = new Set(existingResult.rows.map((r) => r.slug));
    
    // Check existing variant SKUs too
    const existingSkuResult = await client.query(
      `SELECT sku FROM "${SCHEMA}".product_variants`
    );
    const existingSkus = new Set(existingSkuResult.rows.map((r) => r.sku));
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const product of publicProducts) {
      const desc = descMap[product.descId];
      if (!desc) {
        console.log(`  Skipping product ${product.oldId}: no description found (desc_id=${product.descId})`);
        skipped++;
        continue;
      }
      
      const name = stripHtml(desc.name);
      if (!name) {
        console.log(`  Skipping product ${product.oldId}: empty name`);
        skipped++;
        continue;
      }
      
      // Generate SKU
      const sku = product.sku || `IMPORT-${product.oldId}`;
      
      if (existingSkus.has(sku)) {
        console.log(`  Skipping "${name}" (SKU ${sku}): already exists`);
        skipped++;
        continue;
      }
      
      // Also check slug
      let slug = slugify(name);
      if (existingSlugs.has(slug)) {
        slug = `${slug}-${product.oldId}`;
        if (existingSlugs.has(slug)) {
          console.log(`  Skipping "${name}" (slug ${slug}): already exists`);
          skipped++;
          continue;
        }
      }
      
      console.log(`\n  Importing: "${name}" (old ID: ${product.oldId}, SKU: ${sku})`);
      
      // Process images
      const productImages = productImagesMap[product.oldId] || [];
      const processedImages = [];
      
      for (const { imgId } of productImages) {
        const img = imgMap[imgId];
        if (!img) continue;
        
        // The path in the dump is like "6/upload_xxx.jpg"
        // Files are in images/ directory
        const imgPath = path.join(__dirname, "..", "images", img.path);
        
        if (!fs.existsSync(imgPath)) {
          console.log(`    Image not found: ${imgPath}`);
          continue;
        }
        
        const result = await processImage(imgPath, uploadsDir);
        if (result) {
          processedImages.push(result.url);
          console.log(`    Processed: ${img.path} -> ${result.url}`);
        }
      }
      
      // Map category
      const oldCatId = productCategoryMap[product.oldId];
      let categoryId = null;
      if (oldCatId && OLD_TO_NEW_CATEGORY[oldCatId]) {
        const newSlug = OLD_TO_NEW_CATEGORY[oldCatId];
        categoryId = newCatMap[newSlug] || null;
      }
      // Fallback: try to guess from name
      if (!categoryId) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes("3d") || lowerName.includes("druck")) {
          categoryId = newCatMap["3d-druck-zubehoer"];
        } else {
          categoryId = newCatMap["modelleisenbahn-h0"]; // default
        }
      }
      
      // Clean description
      const plainDesc = stripHtml(desc.description);
      const htmlDesc = desc.description || null;
      const metaTitle = desc.metaTitle || `${name} | 3DPrintIt`;
      const metaDesc = stripHtml(desc.metaDescription) || plainDesc.substring(0, 160);
      
      // Calculate price (stored as decimal string in the old system)
      const price = typeof product.price === "number" 
        ? product.price.toFixed(2) 
        : String(product.price);
      
      try {
        await client.query("BEGIN");
        
        const insertResult = await client.query(
          `INSERT INTO "${SCHEMA}".products 
           (name, slug, description, description_html, base_price, compare_at_price, 
            category_id, images, weight, active, featured, tax_rate,
            meta_title, meta_description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, true, false, '19.00', $9, $10, NOW(), NOW())
           RETURNING id`,
          [
            name,
            slug,
            plainDesc,
            htmlDesc,
            price,
            categoryId,
            JSON.stringify(processedImages),
            product.weight ? String(product.weight) : "0",
            metaTitle,
            metaDesc,
          ]
        );
        
        const newId = insertResult.rows[0].id;
        
        // Create a default variant with the SKU and stock
        const variantName = desc.variantName || "Standard";
        await client.query(
          `INSERT INTO "${SCHEMA}".product_variants
           (product_id, name, sku, price, stock, low_stock_threshold, weight, active, sort_order, images)
           VALUES ($1, $2, $3, $4, $5, 3, $6, true, 0, '[]')`,
          [
            newId,
            variantName,
            sku,
            null, // variant price null = use product base_price
            product.stock || 0,
            product.weight ? String(product.weight) : null,
          ]
        );
        
        await client.query("COMMIT");
        
        console.log(`    -> Created product ${newId} (slug: ${slug}, ${processedImages.length} images, variant: "${variantName}", stock: ${product.stock || 0})`);
        imported++;
        existingSkus.add(sku);
        existingSlugs.add(slug);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`    ERROR inserting "${name}": ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n=== Import complete ===`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
