import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderReturns, orders, users } from "@/lib/db/schema";
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
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      );
    }

    if (status) {
      conditions.push(eq(orderReturns.status, status));
    }

    if (dateFrom) {
      conditions.push(gte(orderReturns.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(orderReturns.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [returnsList, totalResult] = await Promise.all([
      db
        .select({
          id: orderReturns.id,
          orderId: orderReturns.orderId,
          customerId: orderReturns.customerId,
          reason: orderReturns.reason,
          reasonDetail: orderReturns.reasonDetail,
          status: orderReturns.status,
          action: orderReturns.action,
          adminNotes: orderReturns.adminNotes,
          items: orderReturns.items,
          createdAt: orderReturns.createdAt,
          updatedAt: orderReturns.updatedAt,
          orderNumber: orders.orderNumber,
          customerName: users.name,
          customerEmail: users.email,
        })
        .from(orderReturns)
        .leftJoin(orders, eq(orderReturns.orderId, orders.id))
        .leftJoin(users, eq(orderReturns.customerId, users.id))
        .where(whereClause)
        .orderBy(desc(orderReturns.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(orderReturns)
        .leftJoin(orders, eq(orderReturns.orderId, orders.id))
        .leftJoin(users, eq(orderReturns.customerId, users.id))
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
    console.error("[Admin Returns GET]", error);
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
    const { orderId, customerId, reason, items, reasonDetail, adminNotes } = body;

    if (!orderId || !customerId || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, customerId, reason, items" },
        { status: 400 }
      );
    }

    const [newReturn] = await db
      .insert(orderReturns)
      .values({
        orderId,
        customerId,
        reason,
        items,
        reasonDetail: reasonDetail || null,
        adminNotes: adminNotes || null,
      })
      .returning();

    return NextResponse.json({ return: newReturn }, { status: 201 });
  } catch (error) {
    console.error("[Admin Returns POST]", error);
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
    const { id, status, action, adminNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(orderReturns)
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    const validStatuses = ["requested", "approved", "received", "completed", "rejected"];
    const validActions = ["refunded", "replacement_sent", "credit_issued"];

    if (status && validStatuses.includes(status)) {
      updateData.status = status;
    }
    if (action && validActions.includes(action)) {
      updateData.action = action;
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const [updated] = await db
      .update(orderReturns)
      .set(updateData)
      .where(eq(orderReturns.id, id))
      .returning();

    return NextResponse.json({ return: updated });
  } catch (error) {
    console.error("[Admin Returns PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
