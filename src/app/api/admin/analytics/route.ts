import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageViews, stockNotifications, products, productVariants } from "@/lib/db/schema";
import { sql, gte, desc, eq, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";

    // Calculate the start date based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "30days":
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    // Daily page view counts
    const dailyCounts = await db
      .select({
        date: sql<string>`DATE(${pageViews.createdAt})::text`,
        views: count(),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate))
      .groupBy(sql`DATE(${pageViews.createdAt})`)
      .orderBy(sql`DATE(${pageViews.createdAt}) ASC`);

    // Top pages
    const topPages = await db
      .select({
        path: pageViews.path,
        views: count(),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate))
      .groupBy(pageViews.path)
      .orderBy(desc(count()))
      .limit(20);

    // Unique visitor trends (by sessionId)
    const visitorTrends = await db
      .select({
        date: sql<string>`DATE(${pageViews.createdAt})::text`,
        uniqueVisitors: sql<number>`COUNT(DISTINCT ${pageViews.sessionId})::int`,
        totalViews: count(),
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate))
      .groupBy(sql`DATE(${pageViews.createdAt})`)
      .orderBy(sql`DATE(${pageViews.createdAt}) ASC`);

    // Total stats for the period
    const [totalStats] = await db
      .select({
        totalViews: count(),
        uniqueVisitors: sql<number>`COUNT(DISTINCT ${pageViews.sessionId})::int`,
        uniquePaths: sql<number>`COUNT(DISTINCT ${pageViews.path})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate));

    // Stock notification demand: count of notifications per product/variant
    const stockDemand = await db
      .select({
        productId: stockNotifications.productId,
        variantId: stockNotifications.variantId,
        productName: products.name,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        requestCount: count(),
      })
      .from(stockNotifications)
      .innerJoin(products, eq(stockNotifications.productId, products.id))
      .innerJoin(productVariants, eq(stockNotifications.variantId, productVariants.id))
      .where(eq(stockNotifications.notified, false))
      .groupBy(
        stockNotifications.productId,
        stockNotifications.variantId,
        products.name,
        productVariants.name,
        productVariants.sku
      )
      .orderBy(desc(count()))
      .limit(20);

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      pageViews: {
        dailyCounts,
        topPages,
        visitorTrends,
        totals: totalStats,
      },
      stockDemand,
    });
  } catch (error) {
    console.error("[Admin Analytics GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
