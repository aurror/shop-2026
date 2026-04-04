import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, orders, orderItems, addresses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

    const [customer] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch order history with items
    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt));

    const ordersWithItems = [];
    for (const order of customerOrders) {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      ordersWithItems.push({
        ...order,
        items,
      });
    }

    // Fetch addresses
    const customerAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, id));

    return NextResponse.json({
      customer: {
        ...customer,
        orders: ordersWithItems,
        addresses: customerAddresses,
      },
    });
  } catch (error) {
    console.error("[Admin Customer GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
