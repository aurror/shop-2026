import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productRelations } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

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

    const relations = await db
      .select()
      .from(productRelations)
      .where(eq(productRelations.productId, id))
      .orderBy(asc(productRelations.sortOrder));

    // Fetch related product details
    const relationsWithProducts = [];
    for (const relation of relations) {
      const [relatedProduct] = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          basePrice: products.basePrice,
          images: products.images,
          active: products.active,
        })
        .from(products)
        .where(eq(products.id, relation.relatedProductId))
        .limit(1);

      relationsWithProducts.push({
        ...relation,
        relatedProduct: relatedProduct || null,
      });
    }

    return NextResponse.json({ relations: relationsWithProducts });
  } catch (error) {
    console.error("[Admin Relations GET]", error);
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
    const { relatedProductId, relationType } = body;

    if (!relatedProductId) {
      return NextResponse.json({ error: "relatedProductId is required" }, { status: 400 });
    }

    if (relatedProductId === id) {
      return NextResponse.json({ error: "Cannot relate a product to itself" }, { status: 400 });
    }

    const validTypes = ["related", "accessory", "bundle"];
    const type = validTypes.includes(relationType) ? relationType : "related";

    // Verify both products exist
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const [related] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, relatedProductId))
      .limit(1);

    if (!related) {
      return NextResponse.json({ error: "Related product not found" }, { status: 404 });
    }

    // Check for existing relation
    const [existing] = await db
      .select({ id: productRelations.id })
      .from(productRelations)
      .where(
        and(
          eq(productRelations.productId, id),
          eq(productRelations.relatedProductId, relatedProductId),
          eq(productRelations.relationType, type)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "This relation already exists" }, { status: 409 });
    }

    const [relation] = await db
      .insert(productRelations)
      .values({
        productId: id,
        relatedProductId,
        relationType: type,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json({ relation }, { status: 201 });
  } catch (error) {
    console.error("[Admin Relations POST]", error);
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
    const relationId = searchParams.get("relationId");

    if (!relationId) {
      return NextResponse.json({ error: "relationId query parameter is required" }, { status: 400 });
    }

    // Verify relation exists and belongs to product
    const [existing] = await db
      .select()
      .from(productRelations)
      .where(
        and(
          eq(productRelations.id, relationId),
          eq(productRelations.productId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Relation not found" }, { status: 404 });
    }

    await db.delete(productRelations).where(eq(productRelations.id, relationId));

    return NextResponse.json({ message: "Relation removed" });
  } catch (error) {
    console.error("[Admin Relations DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
