import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, users } from "@/lib/db/schema";
import { eq, desc, and, or, ilike, gte, lte, sql, count } from "drizzle-orm";

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
    const status = searchParams.get("status") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(orders.customerEmail, `%${search}%`)
        )
      );
    }

    if (status) {
      conditions.push(eq(orders.status, status));
    }

    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
      sortBy === "orderNumber" ? orders.orderNumber :
      sortBy === "total" ? orders.total :
      sortBy === "status" ? orders.status :
      sortBy === "updatedAt" ? orders.updatedAt :
      orders.createdAt;
    const orderFn = sortOrder === "asc" ? sql`${sortColumn} ASC` : sql`${sortColumn} DESC`;

    const [orderList, totalResult] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? sql`${sortColumn} asc` : desc(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(orders)
        .where(whereClause),
    ]);

    const total = totalResult[0].count;

    // Fetch order items and customer info for all orders
    const ordersWithItems = [];
    for (const order of orderList) {
      const [items, customer] = await Promise.all([
        db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id)),
        order.userId
          ? db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(eq(users.id, order.userId))
              .limit(1)
          : Promise.resolve([]),
      ]);

      ordersWithItems.push({
        ...order,
        items,
        customer: customer[0] || null,
      });
    }

    return NextResponse.json({
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Orders GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
