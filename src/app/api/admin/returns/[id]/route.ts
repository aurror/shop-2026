import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderReturns, orders, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [returnRecord] = await db
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
        orderStatus: orders.status,
        orderTotal: orders.total,
        customerName: users.name,
        customerEmail: users.email,
      })
      .from(orderReturns)
      .leftJoin(orders, eq(orderReturns.orderId, orders.id))
      .leftJoin(users, eq(orderReturns.customerId, users.id))
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    return NextResponse.json({ return: returnRecord });
  } catch (error) {
    console.error("[Admin Return GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(orderReturns)
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    await db.delete(orderReturns).where(eq(orderReturns.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Return DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
