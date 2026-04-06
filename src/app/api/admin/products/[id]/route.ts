import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productVariants, productRelations, discounts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { productSchema } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const [variants, relations] = await Promise.all([
      db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, id))
        .orderBy(asc(productVariants.sortOrder)),
      db
        .select()
        .from(productRelations)
        .where(eq(productRelations.productId, id))
        .orderBy(asc(productRelations.sortOrder)),
    ]);

    // Fetch related product details
    const relatedProductIds = relations.map((r) => r.relatedProductId);
    let relatedProducts: (typeof products.$inferSelect)[] = [];
    if (relatedProductIds.length > 0) {
      relatedProducts = await db
        .select()
        .from(products)
        .where(
          eq(products.id, relatedProductIds[0]) // Will be replaced below
        );
      // Re-fetch properly for all IDs
      relatedProducts = [];
      for (const relId of relatedProductIds) {
        const [rp] = await db.select().from(products).where(eq(products.id, relId)).limit(1);
        if (rp) relatedProducts.push(rp);
      }
    }

    const relationsWithProducts = relations.map((r) => ({
      ...r,
      relatedProduct: relatedProducts.find((p) => p.id === r.relatedProductId) || null,
    }));

    return NextResponse.json({
      product: {
        ...product,
        variants,
        relations: relationsWithProducts,
      },
    });
  } catch (error) {
    console.error("[Admin Product GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = productSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check product exists
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // If slug is being changed, check for duplicates
    if (parsed.data.slug) {
      const [slugConflict] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, parsed.data.slug))
        .limit(1);

      if (slugConflict && slugConflict.id !== id) {
        return NextResponse.json(
          { error: "A product with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.descriptionHtml !== undefined) updateData.descriptionHtml = data.descriptionHtml;
    if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
    if (data.compareAtPrice !== undefined) updateData.compareAtPrice = data.compareAtPrice;
    if (body.saleEndsAt !== undefined) updateData.saleEndsAt = body.saleEndsAt ? new Date(body.saleEndsAt) : null;
    if (body.saleDiscountCode !== undefined) updateData.saleDiscountCode = body.saleDiscountCode || null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.tags !== undefined) updateData.tags = body.tags;

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    // Auto-sync discount code if a product-level sale code is set
    if (body.saleDiscountCode !== undefined) {
      const code = (body.saleDiscountCode as string)?.trim().toUpperCase();
      if (code && updated.compareAtPrice && updated.basePrice) {
        const baseP = parseFloat(updated.basePrice);
        const saleP = parseFloat(updated.compareAtPrice as string);
        const pctOff = baseP > 0 ? Math.round(((baseP - saleP) / baseP) * 100) : 0;
        // Upsert discount record for this code
        await db
          .insert(discounts)
          .values({
            code,
            description: `Produktrabatt: ${updated.name}`,
            type: "percentage",
            value: String(pctOff),
            productIds: [id],
            expiresAt: body.saleEndsAt ? new Date(body.saleEndsAt) : null,
            active: true,
          } as any)
          .onConflictDoUpdate({
            target: discounts.code,
            set: {
              description: `Produktrabatt: ${updated.name}`,
              value: String(pctOff),
              productIds: [id],
              expiresAt: body.saleEndsAt ? new Date(body.saleEndsAt) : null,
              active: true,
            } as any,
          });
      } else if (!code) {
        // Code removed — deactivate any existing discount with this code tied to this product
        // (we can't easily find it without storing the old code, so just leave it)
      }
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("[Admin Product PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get("hard") === "true";

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (hard) {
      await db.delete(products).where(eq(products.id, id));
      return NextResponse.json({ message: "Product permanently deleted" });
    } else {
      const [updated] = await db
        .update(products)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      return NextResponse.json({ message: "Product deactivated", product: updated });
    }
  } catch (error) {
    console.error("[Admin Product DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
