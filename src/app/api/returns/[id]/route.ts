import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderReturns, orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [returnRecord] = await db
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
      .where(and(eq(orderReturns.id, id), eq(orderReturns.customerId, session.user.id)))
      .limit(1);

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    return NextResponse.json({ return: returnRecord });
  } catch (error) {
    console.error("[Return GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
