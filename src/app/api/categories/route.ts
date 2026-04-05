import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const cats = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        parentId: categories.parentId,
        sortOrder: categories.sortOrder,
        productCount: sql<number>`cast(count(${products.id}) as integer)`,
      })
      .from(categories)
      .leftJoin(
        products,
        and(eq(products.categoryId, categories.id), eq(products.active, true))
      )
      .groupBy(
        categories.id,
        categories.name,
        categories.slug,
        categories.description,
        categories.parentId,
        categories.sortOrder,
      )
      .orderBy(asc(categories.sortOrder));

    return NextResponse.json({ categories: cats });
  } catch (error) {
    console.error("[Categories API]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kategorien" },
      { status: 500 }
    );
  }
}
