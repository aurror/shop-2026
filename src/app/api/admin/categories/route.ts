import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { products } from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`(SELECT count(*) FROM ${products} WHERE ${products.categoryId} = ${categories.id})`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return NextResponse.json({ categories: cats });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, slug, description, parentId } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug required" }, { status: 400 });
  }

  const [cat] = await db
    .insert(categories)
    .values({ name, slug, description: description || null, parentId: parentId || null })
    .returning();

  return NextResponse.json({ category: cat }, { status: 201 });
}
