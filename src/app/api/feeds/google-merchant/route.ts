import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productVariants, categories, productAdConfig } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const shopName = "3DPrintIt";
    const shopDescription = "Modelleisenbahn &amp; 3D-Druck — hochwertige Modellbauzubehörteile";

    // Fetch all active products with their ad config
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        basePrice: products.basePrice,
        compareAtPrice: products.compareAtPrice,
        images: products.images,
        weight: products.weight,
        taxRate: products.taxRate,
        tags: products.tags,
        categoryName: categories.name,
        adCustomTitle: productAdConfig.customTitle,
        adCustomDescription: productAdConfig.customDescription,
        adGoogleCategory: productAdConfig.googleProductCategory,
        adAdvertised: productAdConfig.advertised,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(productAdConfig, eq(products.id, productAdConfig.productId))
      .where(eq(products.active, true))
      .orderBy(asc(products.name));

    // Get variants for stock info
    const productIds = allProducts.map((p) => p.id);
    let allVariants: any[] = [];
    if (productIds.length > 0) {
      allVariants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.active, true),
            sql`${productVariants.productId} = ANY(ARRAY[${sql.join(
              productIds.map((id) => sql`${id}::uuid`),
              sql`, `
            )}])`
          )
        )
        .orderBy(asc(productVariants.sortOrder));
    }

    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const list = variantsByProduct.get(v.productId) || [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    function esc(s: string) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    const items = allProducts
      .map((p) => {
        const variants = variantsByProduct.get(p.id) || [];
        const totalStock = variants.reduce((sum: number, v: any) => sum + v.stock, 0);
        if (variants.length > 0 && totalStock === 0) return null;

        const images = (p.images as string[]) || [];
        const makeUrl = (img: string) => img.startsWith("http") ? img : `${baseUrl}${img}`;
        const primaryImage = images[0] ? makeUrl(images[0]) : null;
        const additionalImages = images.slice(1).map(makeUrl);

        const title = esc(p.adCustomTitle || p.name).slice(0, 150);
        const desc = esc(
          (p.adCustomDescription || p.description || p.name).replace(/<[^>]*>/g, "")
        ).slice(0, 5000);
        const price = parseFloat(p.basePrice);
        const salePrice = p.compareAtPrice ? parseFloat(p.compareAtPrice) : null;
        const gcat = esc(p.adGoogleCategory || "Spielzeug & Spiele > Modellbau > Modelleisenbahn");
        const ptype = esc(p.categoryName || "3D-Druck");
        const tags = (p.tags as string[]) || [];
        const weight = p.weight ? parseFloat(p.weight) : 0;
        const availability = totalStock > 0 || variants.length === 0 ? "in_stock" : "out_of_stock";

        if (variants.length > 0) {
          return variants
            .filter((v: any) => v.stock > 0)
            .map((v: any) => {
              const vp = v.price ? parseFloat(v.price) : price;
              return `    <item>
      <g:id>${p.id}_${v.id}</g:id>
      <g:title>${title} — ${esc(v.name)}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${baseUrl}/products/${p.slug}</g:link>
${primaryImage ? `      <g:image_link>${primaryImage}</g:image_link>\n` : ""}${additionalImages.map((u: string) => `      <g:additional_image_link>${u}</g:additional_image_link>`).join("\n")}
      <g:price>${vp.toFixed(2)} EUR</g:price>
${salePrice && salePrice < vp ? `      <g:sale_price>${salePrice.toFixed(2)} EUR</g:sale_price>\n` : ""}      <g:availability>${v.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
      <g:condition>new</g:condition>
      <g:google_product_category>${gcat}</g:google_product_category>
      <g:product_type>${ptype}</g:product_type>
      <g:brand>${shopName}</g:brand>
${v.sku ? `      <g:mpn>${esc(v.sku)}</g:mpn>\n` : ""}      <g:item_group_id>${p.id}</g:item_group_id>
${weight > 0 ? `      <g:shipping_weight>${weight} kg</g:shipping_weight>\n` : ""}${tags[0] ? `      <g:custom_label_0>${esc(tags[0])}</g:custom_label_0>\n` : ""}${tags[1] ? `      <g:custom_label_1>${esc(tags[1])}</g:custom_label_1>\n` : ""}    </item>`;
            })
            .join("\n");
        }

        return `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${baseUrl}/products/${p.slug}</g:link>
${primaryImage ? `      <g:image_link>${primaryImage}</g:image_link>\n` : ""}${additionalImages.map((u: string) => `      <g:additional_image_link>${u}</g:additional_image_link>`).join("\n")}
      <g:price>${price.toFixed(2)} EUR</g:price>
${salePrice && salePrice < price ? `      <g:sale_price>${salePrice.toFixed(2)} EUR</g:sale_price>\n` : ""}      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:google_product_category>${gcat}</g:google_product_category>
      <g:product_type>${ptype}</g:product_type>
      <g:brand>${shopName}</g:brand>
${weight > 0 ? `      <g:shipping_weight>${weight} kg</g:shipping_weight>\n` : ""}${tags[0] ? `      <g:custom_label_0>${esc(tags[0])}</g:custom_label_0>\n` : ""}${tags[1] ? `      <g:custom_label_1>${esc(tags[1])}</g:custom_label_1>\n` : ""}    </item>`;
      })
      .filter(Boolean)
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${shopName}</title>
    <link>${baseUrl}</link>
    <description>${shopDescription}</description>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[Google Merchant Feed]", error);
    return NextResponse.json({ error: "Feed generation failed" }, { status: 500 });
  }
}
