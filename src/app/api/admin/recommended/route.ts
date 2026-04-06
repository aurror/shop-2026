import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productRelations } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) return null;
  return session;
}

// GET all relations for a product
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const relations = await db
    .select({
      id: productRelations.id,
      relatedProductId: productRelations.relatedProductId,
      relationType: productRelations.relationType,
      sortOrder: productRelations.sortOrder,
      name: products.name,
      slug: products.slug,
      images: products.images,
      basePrice: products.basePrice,
    })
    .from(productRelations)
    .innerJoin(products, eq(productRelations.relatedProductId, products.id))
    .where(eq(productRelations.productId, productId))
    .orderBy(productRelations.sortOrder);

  return NextResponse.json({ relations });
}

// POST add relation (always creates a reverse link too)
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, relatedProductId, relationType = "related" } = await req.json();

  if (!productId || !relatedProductId) {
    return NextResponse.json({ error: "productId and relatedProductId required" }, { status: 400 });
  }

  try {
    const [rel] = await db
      .insert(productRelations)
      .values({ productId, relatedProductId, relationType })
      .onConflictDoNothing()
      .returning();

    // Create reverse link so both products show each other
    await db
      .insert(productRelations)
      .values({ productId: relatedProductId, relatedProductId: productId, relationType })
      .onConflictDoNothing();

    return NextResponse.json({ relation: rel }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Already exists" }, { status: 409 });
  }
}

// DELETE remove relation (also removes the reverse link)
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  // Fetch the relation first so we know which reverse link to remove
  const [existing] = await db
    .select()
    .from(productRelations)
    .where(eq(productRelations.id, id))
    .limit(1);

  await db.delete(productRelations).where(eq(productRelations.id, id));

  // Remove the reverse link if it exists
  if (existing) {
    await db.delete(productRelations).where(
      and(
        eq(productRelations.productId, existing.relatedProductId),
        eq(productRelations.relatedProductId, existing.productId),
        eq(productRelations.relationType, existing.relationType)
      )
    );
  }

  return NextResponse.json({ success: true });
}
