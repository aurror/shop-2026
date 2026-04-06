import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productVariants, categories, orderItems } from "@/lib/db/schema";
import { eq, desc, asc, sql, ilike, or, count, getTableColumns } from "drizzle-orm";
import { productSchema } from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.slug, `%${search}%`),
          ilike(products.description, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const sortColumn =
      sortBy === "name" ? products.name :
      sortBy === "basePrice" ? products.basePrice :
      sortBy === "updatedAt" ? products.updatedAt :
      products.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const [productList, totalResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(products),
          categoryName: categories.name,
          totalSold: sql<number>`COALESCE((SELECT SUM(oi.quantity) FROM ${orderItems} oi WHERE oi.product_id = ${products.id}), 0)`,
          totalRevenue: sql<string>`COALESCE((SELECT SUM(oi.total_price) FROM ${orderItems} oi WHERE oi.product_id = ${products.id}), 0)`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(products)
        .where(whereClause),
    ]);

    const total = totalResult[0].count;

    // Fetch variants for all returned products
    const productIds = productList.map((p) => p.id);
    let variants: (typeof productVariants.$inferSelect)[] = [];
    if (productIds.length > 0) {
      variants = await db
        .select()
        .from(productVariants)
        .where(sql`${productVariants.productId} IN ${productIds}`)
        .orderBy(asc(productVariants.sortOrder));
    }

    // Group variants by product
    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const existing = variantsByProduct.get(v.productId) || [];
      existing.push(v);
      variantsByProduct.set(v.productId, existing);
    }

    const productsWithVariants = productList.map((p) => ({
      ...p,
      variants: variantsByProduct.get(p.id) || [],
    }));

    return NextResponse.json({
      products: productsWithVariants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Products GET]", error);
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
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate slug
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, data.slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A product with this slug already exists" },
        { status: 409 }
      );
    }

    const [product] = await db
      .insert(products)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        descriptionHtml: data.descriptionHtml || null,
        basePrice: data.basePrice,
        compareAtPrice: data.compareAtPrice || null,
        categoryId: data.categoryId || null,
        weight: data.weight || "0",
        featured: data.featured ?? false,
        active: data.active ?? true,
        taxRate: data.taxRate || "19.00",
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        images: body.images || [],
        tags: body.tags || [],
      })
      .returning();

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("[Admin Products POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
