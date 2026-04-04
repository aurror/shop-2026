import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, paymentMethod } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Bestellnummer fehlt" },
        { status: 400 }
      );
    }

    if (!["stripe", "klarna"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Ungültige Zahlungsmethode" },
        { status: 400 }
      );
    }

    // Get order
    const order = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order.length) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden" },
        { status: 404 }
      );
    }

    const o = order[0];

    // Verify ownership
    if (o.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Nicht autorisiert" },
        { status: 403 }
      );
    }

    // Get order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const checkoutResult = await createCheckoutSession({
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail,
      items: items.map((item) => ({
        name: item.productName,
        description: item.variantName || undefined,
        unitPrice: Math.round(parseFloat(item.unitPrice) * 100),
        quantity: item.quantity,
      })),
      shippingCost: Math.round(parseFloat(o.shippingCost) * 100),
      discountAmount: Math.round(parseFloat(o.discountAmount || "0") * 100),
      paymentMethod: paymentMethod as "stripe" | "klarna",
      successUrl: `${baseUrl}/checkout/success`,
      cancelUrl: `${baseUrl}/checkout?orderId=${orderId}`,
    });

    // Update order with Stripe session ID
    await db
      .update(orders)
      .set({
        stripeSessionId: checkoutResult.sessionId,
        paymentMethod,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      sessionId: checkoutResult.sessionId,
      url: checkoutResult.url,
    });
  } catch (error) {
    console.error("[Stripe Checkout]", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Checkout-Sitzung" },
      { status: 500 }
    );
  }
}
