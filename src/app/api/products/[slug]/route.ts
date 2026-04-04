import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  products,
  productVariants,
  categories,
  productRelations,
} from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const product = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        descriptionHtml: products.descriptionHtml,
        basePrice: products.basePrice,
        compareAtPrice: sql<string | null>`CASE WHEN ${products.saleEndsAt} IS NULL OR ${products.saleEndsAt} > NOW() THEN ${products.compareAtPrice} ELSE NULL END`,
        images: products.images,
        featured: products.featured,
        weight: products.weight,
        taxRate: products.taxRate,
        categoryId: products.categoryId,
        metaTitle: products.metaTitle,
        metaDescription: products.metaDescription,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.active, true)))

    if (!product.length) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden" },
        { status: 404 }
      );
    }

    const p = product[0];

    // Get variants
    const variants = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, p.id),
          eq(productVariants.active, true)
        )
      )
      .orderBy(asc(productVariants.sortOrder));

    // Get category
    let category = null;
    if (p.categoryId) {
      const cat = await db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, p.categoryId))
        .limit(1);
      category = cat[0] || null;
    }

    // Get related products
    const relations = await db
      .select({
        relatedProductId: productRelations.relatedProductId,
        relationType: productRelations.relationType,
      })
      .from(productRelations)
      .where(eq(productRelations.productId, p.id))
      .orderBy(asc(productRelations.sortOrder));

    let relatedProducts: any[] = [];
    if (relations.length > 0) {
      const relatedIds = relations.map((r) => r.relatedProductId);
      for (const relId of relatedIds) {
        const rp = await db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            basePrice: products.basePrice,
            compareAtPrice: sql<string | null>`CASE WHEN ${products.saleEndsAt} IS NULL OR ${products.saleEndsAt} > NOW() THEN ${products.compareAtPrice} ELSE NULL END`,
            images: products.images,
          })
          .from(products)
          .where(and(eq(products.id, relId), eq(products.active, true)))
          .limit(1);

        if (rp.length) {
          const relation = relations.find((r) => r.relatedProductId === relId);
          relatedProducts.push({
            ...rp[0],
            images: (rp[0].images as string[]) || [],
            relationType: relation?.relationType || "related",
          });
        }
      }
    }

    return NextResponse.json({
      ...p,
      images: (p.images as string[]) || [],
      variants,
      category,
      relatedProducts,
    });
  } catch (error) {
    console.error("[Product Detail API]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Produkts" },
      { status: 500 }
    );
  }
}
