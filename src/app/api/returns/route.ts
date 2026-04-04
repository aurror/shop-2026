import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderReturns, orders } from "@/lib/db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const offset = (page - 1) * limit;

    const whereClause = eq(orderReturns.customerId, session.user.id);

    const [returnsList, totalResult] = await Promise.all([
      db
        .select({
          id: orderReturns.id,
          orderId: orderReturns.orderId,
          reason: orderReturns.reason,
          reasonDetail: orderReturns.reasonDetail,
          status: orderReturns.status,
          action: orderReturns.action,
          items: orderReturns.items,
          createdAt: orderReturns.createdAt,
          updatedAt: orderReturns.updatedAt,
          orderNumber: orders.orderNumber,
        })
        .from(orderReturns)
        .leftJoin(orders, eq(orderReturns.orderId, orders.id))
        .where(whereClause)
        .orderBy(desc(orderReturns.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(orderReturns)
        .where(whereClause),
    ]);

    const total = totalResult[0].count;

    return NextResponse.json({
      returns: returnsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Returns GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderId, reason, items, reasonDetail } = body;

    if (!orderId || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, reason, items" },
        { status: 400 }
      );
    }

    // Verify the order belongs to this customer
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or does not belong to you" },
        { status: 404 }
      );
    }

    const [newReturn] = await db
      .insert(orderReturns)
      .values({
        orderId,
        customerId: session.user.id,
        reason,
        items,
        reasonDetail: reasonDetail || null,
      })
      .returning();

    return NextResponse.json({ return: newReturn }, { status: 201 });
  } catch (error) {
    console.error("[Returns POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
