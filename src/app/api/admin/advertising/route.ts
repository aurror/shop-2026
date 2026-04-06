import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  adCampaigns,
  productAdConfig,
  products,
  productVariants,
  categories,
  orderItems,
  orders,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "overview";

    if (section === "overview") {
      // Campaigns summary
      const campaignList = await db
        .select()
        .from(adCampaigns)
        .orderBy(asc(adCampaigns.name));

      // Count advertised products
      const [{ count: advertisedCount }] = await db
        .select({ count: count() })
        .from(productAdConfig)
        .where(eq(productAdConfig.advertised, true));

      // Total products
      const [{ count: totalProducts }] = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.active, true));

      // Aggregate ad stats
      const totalSpent = campaignList.reduce((s, c) => s + parseFloat(c.totalSpent), 0);
      const totalImpressions = campaignList.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = campaignList.reduce((s, c) => s + c.clicks, 0);
      const totalConversions = campaignList.reduce((s, c) => s + c.conversions, 0);
      const totalRevenue = campaignList.reduce((s, c) => s + parseFloat(c.revenue), 0);
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      const avgCpc = totalClicks > 0 ? totalSpent / totalClicks : 0;
      const roas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

      const feedUrl = `${process.env.BASE_URL || "http://localhost:3000"}/api/feeds/google-merchant`;

      return NextResponse.json({
        campaigns: campaignList,
        stats: {
          advertisedProducts: advertisedCount,
          totalProducts,
          totalSpent,
          totalImpressions,
          totalClicks,
          totalConversions,
          totalRevenue,
          ctr,
          convRate,
          avgCpc,
          roas,
        },
        feedUrl,
      });
    }

    if (section === "products") {
      const page = parseInt(searchParams.get("page") || "1");
      const limit = 20;
      const offset = (page - 1) * limit;
      const filter = searchParams.get("filter") || "all"; // "all" | "advertised" | "not_advertised"

      // Build query: all active products left-joined with ad config
      let whereConditions: any = [eq(products.active, true)];
      if (filter === "advertised") {
        whereConditions.push(eq(productAdConfig.advertised, true));
      }

      const productList = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          basePrice: products.basePrice,
          images: products.images,
          tags: products.tags,
          categoryName: categories.name,
          // Ad config
          adConfigId: productAdConfig.id,
          advertised: productAdConfig.advertised,
          customTitle: productAdConfig.customTitle,
          customDescription: productAdConfig.customDescription,
          googleProductCategory: productAdConfig.googleProductCategory,
          adKeywords: productAdConfig.adKeywords,
          maxCpc: productAdConfig.maxCpc,
          priority: productAdConfig.priority,
          campaignId: productAdConfig.campaignId,
          adImpressions: productAdConfig.impressions,
          adClicks: productAdConfig.clicks,
          adConversions: productAdConfig.conversions,
          adCost: productAdConfig.cost,
          adRevenue: productAdConfig.revenue,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productAdConfig, eq(products.id, productAdConfig.productId))
        .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
        .orderBy(desc(sql`COALESCE(${productAdConfig.advertised}, false)`), asc(products.name))
        .limit(limit)
        .offset(offset);

      // Grab stock info
      const pIds = productList.map((p) => p.id);
      let variants: any[] = [];
      if (pIds.length > 0) {
        variants = await db
          .select({
            productId: productVariants.productId,
            totalStock: sql<number>`SUM(${productVariants.stock})`,
          })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.active, true),
              sql`${productVariants.productId} = ANY(ARRAY[${sql.join(
                pIds.map((id) => sql`${id}::uuid`),
                sql`, `
              )}])`
            )
          )
          .groupBy(productVariants.productId);
      }

      const stockMap = new Map(variants.map((v: any) => [v.productId, Number(v.totalStock)]));

      const [totalResult] = await db
        .select({ count: count() })
        .from(products)
        .leftJoin(productAdConfig, eq(products.id, productAdConfig.productId))
        .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions));

      return NextResponse.json({
        products: productList.map((p) => ({
          ...p,
          totalStock: stockMap.get(p.id) ?? 0,
          adKeywords: p.adKeywords || [],
        })),
        pagination: {
          page,
          limit,
          total: totalResult.count,
          totalPages: Math.ceil(totalResult.count / limit),
        },
      });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Advertising GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update campaign or product ad settings
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Update a campaign
    if (body.campaignId) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.dailyBudget !== undefined) updateData.dailyBudget = body.dailyBudget;

      const [updated] = await db
        .update(adCampaigns)
        .set(updateData)
        .where(eq(adCampaigns.id, body.campaignId))
        .returning();

      return NextResponse.json({ campaign: updated });
    }

    // Update product ad settings
    if (body.productId) {
      const existing = await db
        .select()
        .from(productAdConfig)
        .where(eq(productAdConfig.productId, body.productId))
        .limit(1);

      const adData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.advertised !== undefined) adData.advertised = body.advertised;
      if (body.customTitle !== undefined) adData.customTitle = body.customTitle || null;
      if (body.customDescription !== undefined) adData.customDescription = body.customDescription || null;
      if (body.googleProductCategory !== undefined) adData.googleProductCategory = body.googleProductCategory || null;
      if (body.adKeywords !== undefined) adData.adKeywords = body.adKeywords;
      if (body.maxCpc !== undefined) adData.maxCpc = body.maxCpc || null;
      if (body.priority !== undefined) adData.priority = body.priority;
      if (body.campaignId !== undefined) adData.campaignId = body.campaignId || null;

      if (existing.length > 0) {
        const [updated] = await db
          .update(productAdConfig)
          .set(adData)
          .where(eq(productAdConfig.productId, body.productId))
          .returning();
        return NextResponse.json({ adConfig: updated });
      } else {
        const [created] = await db
          .insert(productAdConfig)
          .values({
            productId: body.productId,
            ...adData,
          } as any)
          .returning();
        return NextResponse.json({ adConfig: created });
      }
    }

    // Bulk toggle
    if (body.bulkToggle) {
      const { productIds, advertised } = body.bulkToggle;
      for (const pid of productIds) {
        const existing = await db
          .select({ id: productAdConfig.id })
          .from(productAdConfig)
          .where(eq(productAdConfig.productId, pid))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(productAdConfig)
            .set({ advertised, updatedAt: new Date() })
            .where(eq(productAdConfig.productId, pid));
        } else {
          await db
            .insert(productAdConfig)
            .values({ productId: pid, advertised });
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Advertising PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
