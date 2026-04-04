import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { variantSchema } from "@/lib/security";

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

    // Verify product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.sortOrder));

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("[Admin Variants GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const parsed = variantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check for duplicate SKU
    const [existingSku] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.sku, parsed.data.sku))
      .limit(1);

    if (existingSku) {
      return NextResponse.json(
        { error: "A variant with this SKU already exists" },
        { status: 409 }
      );
    }

    const data = parsed.data;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: id,
        name: data.name,
        sku: data.sku,
        price: data.price || null,
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold ?? 5,
        weight: data.weight || null,
        attributes: data.attributes || {},
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    console.error("[Admin Variants POST]", error);
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
    const { variantId, ...updateFields } = body;

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const parsed = variantSchema.partial().safeParse(updateFields);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify variant exists and belongs to product
    const [existing] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // If SKU is being changed, check for duplicates
    if (parsed.data.sku) {
      const [skuConflict] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.sku, parsed.data.sku))
        .limit(1);

      if (skuConflict && skuConflict.id !== variantId) {
        return NextResponse.json(
          { error: "A variant with this SKU already exists" },
          { status: 409 }
        );
      }
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.attributes !== undefined) updateData.attributes = data.attributes;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const [updated] = await db
      .update(productVariants)
      .set(updateData)
      .where(eq(productVariants.id, variantId))
      .returning();

    return NextResponse.json({ variant: updated });
  } catch (error) {
    console.error("[Admin Variants PUT]", error);
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
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      return NextResponse.json({ error: "variantId query parameter is required" }, { status: 400 });
    }

    // Verify variant exists and belongs to product
    const [existing] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    await db.delete(productVariants).where(eq(productVariants.id, variantId));

    return NextResponse.json({ message: "Variant deleted" });
  } catch (error) {
    console.error("[Admin Variants DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
