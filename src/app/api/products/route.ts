import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productVariants, categories, productRelations } from "@/lib/db/schema";
import { eq, and, desc, asc, ilike, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const featured = searchParams.get("featured");
    const sort = searchParams.get("sort") || "newest";
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [eq(products.active, true)];

    if (category) {
      conditions.push(eq(categories.slug, category));
    }
    if (search) {
      conditions.push(ilike(products.name, `%${search}%`));
    }
    if (featured === "true") {
      conditions.push(eq(products.featured, true));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)!;

    let query = db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        basePrice: products.basePrice,
        compareAtPrice: sql<string | null>`CASE WHEN ${products.saleEndsAt} IS NULL OR ${products.saleEndsAt} > NOW() THEN ${products.compareAtPrice} ELSE NULL END`,
        images: products.images,
        featured: products.featured,
        weight: products.weight,
        taxRate: products.taxRate,
        categoryId: products.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause)
      .$dynamic();

    // Count total with same filters
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause);
    const total = Number(countResult[0].count);

    // Sort
    switch (sort) {
      case "price_asc":
        query = query.orderBy(asc(products.basePrice));
        break;
      case "price_desc":
        query = query.orderBy(desc(products.basePrice));
        break;
      case "name_asc":
        query = query.orderBy(asc(products.name));
        break;
      case "oldest":
        query = query.orderBy(asc(products.createdAt));
        break;
      default:
        query = query.orderBy(desc(products.createdAt));
    }

    const items = await query.limit(limit).offset(offset);

    // Get variants for all products
    const productIds = items.map((p) => p.id);
    let allVariants: any[] = [];
    if (productIds.length > 0) {
      allVariants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.active, true),
            sql`${productVariants.productId} = ANY(ARRAY[${sql.join(productIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
          )
        )
        .orderBy(asc(productVariants.sortOrder));
    }

    const result = items.map((p) => ({
      ...p,
      images: (p.images as string[]) || [],
      category: p.categoryId
        ? { id: p.categoryId, name: p.categoryName, slug: p.categorySlug }
        : null,
      variants: allVariants.filter((v) => v.productId === p.id),
      minPrice:
        allVariants
          .filter((v) => v.productId === p.id && v.price)
          .reduce((min: number | null, v: any) => {
            const price = parseFloat(v.price);
            return min === null || price < min ? price : min;
          }, null) || parseFloat(p.basePrice),
      totalStock: allVariants
        .filter((v) => v.productId === p.id)
        .reduce((sum: number, v: any) => sum + v.stock, 0),
    }));

    return NextResponse.json({
      products: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Products API]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Produkte" },
      { status: 500 }
    );
  }
}
