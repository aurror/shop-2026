import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Bestell-ID erforderlich" },
        { status: 400 }
      );
    }

    // Fetch order, ensuring the authenticated user owns it
    const order = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, id),
          eq(orders.userId, session.user.id)
        )
      )
      .limit(1);

    if (!order.length) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden" },
        { status: 404 }
      );
    }

    // Fetch order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    return NextResponse.json({
      ...order[0],
      items,
    });
  } catch (error) {
    console.error("[Order Detail]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Bestellung" },
      { status: 500 }
    );
  }
}
