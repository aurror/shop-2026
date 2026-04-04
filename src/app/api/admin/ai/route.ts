import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productRelationSuggestions, productRelations, products } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getRelatedProductSuggestions } from "@/lib/ai";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "productId query parameter is required" }, { status: 400 });
    }

    const suggestions = await db
      .select()
      .from(productRelationSuggestions)
      .where(
        and(
          eq(productRelationSuggestions.productId, productId),
          eq(productRelationSuggestions.status, "pending")
        )
      )
      .orderBy(desc(productRelationSuggestions.createdAt));

    // Enrich with suggested product info
    const enriched = [];
    for (const suggestion of suggestions) {
      const [suggestedProduct] = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          basePrice: products.basePrice,
          images: products.images,
          active: products.active,
        })
        .from(products)
        .where(eq(products.id, suggestion.suggestedProductId))
        .limit(1);

      enriched.push({
        ...suggestion,
        suggestedProduct: suggestedProduct || null,
      });
    }

    return NextResponse.json({ suggestions: enriched });
  } catch (error) {
    console.error("[Admin AI GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Verify product exists
    const [product] = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await getRelatedProductSuggestions(productId);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("[Admin AI POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { suggestionId, action } = body;

    if (!suggestionId) {
      return NextResponse.json({ error: "suggestionId is required" }, { status: 400 });
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the suggestion
    const [suggestion] = await db
      .select()
      .from(productRelationSuggestions)
      .where(eq(productRelationSuggestions.id, suggestionId))
      .limit(1);

    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "Suggestion has already been reviewed" },
        { status: 400 }
      );
    }

    // Update suggestion status
    const [updated] = await db
      .update(productRelationSuggestions)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
      })
      .where(eq(productRelationSuggestions.id, suggestionId))
      .returning();

    // If approved, create the product relation
    if (action === "approve") {
      try {
        await db.insert(productRelations).values({
          productId: suggestion.productId,
          relatedProductId: suggestion.suggestedProductId,
          relationType: "related",
          sortOrder: 0,
        });
      } catch (err: any) {
        // Relation might already exist (unique constraint), that's OK
        if (err?.code !== "23505") {
          throw err;
        }
      }
    }

    return NextResponse.json({
      suggestion: updated,
      message: action === "approve"
        ? "Suggestion approved and relation created"
        : "Suggestion rejected",
    });
  } catch (error) {
    console.error("[Admin AI PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
