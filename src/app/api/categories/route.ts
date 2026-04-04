import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, sql, asc } from "drizzle-orm";

export async function GET() {
  try {
    const cats = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        sortOrder: categories.sortOrder,
        productCount: sql<number>`(
          SELECT count(*) FROM ${products}
          WHERE ${products.categoryId} = ${categories.id}
          AND ${products.active} = true
        )`,
      })
      .from(categories)
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
