import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, users, adminNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendTemplateEmail } from "@/lib/email";
import { getDhlTrackingUrl } from "@/lib/shipping";
import { notifyTelegram } from "@/lib/telegram";

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

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [items, customer] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, id)),
      order.userId
        ? db
            .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
            .from(users)
            .where(eq(users.id, order.userId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      order: {
        ...order,
        items,
        customer: customer[0] || null,
      },
    });
  } catch (error) {
    console.error("[Admin Order GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    const validStatuses = [
      "pending", "awaiting_payment", "paid", "processing",
      "shipped", "delivered", "cancelled", "refunded",
    ];
    const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];

    if (body.status && validStatuses.includes(body.status)) {
      updateData.status = body.status;
    }
    if (body.paymentStatus && validPaymentStatuses.includes(body.paymentStatus)) {
      updateData.paymentStatus = body.paymentStatus;
    }
    if (body.trackingNumber !== undefined) {
      updateData.trackingNumber = body.trackingNumber;
      if (body.trackingNumber) {
        updateData.trackingUrl = getDhlTrackingUrl(body.trackingNumber);
      }
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();

    // Send shipping email when status changes to "shipped" with tracking number
    if (
      body.status === "shipped" &&
      existing.status !== "shipped" &&
      (body.trackingNumber || existing.trackingNumber)
    ) {
      const trackingNum = body.trackingNumber || existing.trackingNumber || "";
      const trackingUrl = getDhlTrackingUrl(trackingNum);

      try {
        await sendTemplateEmail(existing.customerEmail, "order_shipped", {
          orderNumber: existing.orderNumber,
          trackingNumber: trackingNum,
          trackingUrl: trackingUrl,
          firstName: (existing.shippingAddress as any)?.firstName || "Kunde",
        });
      } catch (emailError) {
        console.error("[Admin Order] Shipping email failed:", emailError);
      }

      // Create admin notification
      await db.insert(adminNotifications).values({
        type: "shipping_update",
        title: `Bestellung ${existing.orderNumber} versendet`,
        message: `Bestellung ${existing.orderNumber} wurde als versendet markiert. Tracking: ${trackingNum}`,
        data: {
          orderId: id,
          orderNumber: existing.orderNumber,
          trackingNumber: trackingNum,
          trackingUrl,
        },
      });
    }

    // Send payment received email when payment_status changes to "paid"
    if (
      body.paymentStatus === "paid" &&
      existing.paymentStatus !== "paid"
    ) {
      try {
        await sendTemplateEmail(existing.customerEmail, "payment_received", {
          orderNumber: existing.orderNumber,
          total: existing.total,
          firstName: (existing.shippingAddress as any)?.firstName || "Kunde",
        });
      } catch (emailError) {
        console.error("[Admin Order] Payment email failed:", emailError);
      }

      // Create admin notification
      await db.insert(adminNotifications).values({
        type: "payment_received",
        title: `Zahlung für ${existing.orderNumber} eingegangen`,
        message: `Zahlung von ${existing.total}€ für Bestellung ${existing.orderNumber} wurde bestätigt.`,
        data: {
          orderId: id,
          orderNumber: existing.orderNumber,
          amount: existing.total,
        },
      });
    }

    // Notify Telegram about status changes
    if (body.status && body.status !== existing.status) {
      notifyTelegram(
        "orders",
        `📦 *Status-Update: ${existing.orderNumber}*\n` +
          `${existing.status} → ${body.status}` +
          (body.status === "shipped" && (body.trackingNumber || existing.trackingNumber)
            ? `\nTracking: ${body.trackingNumber || existing.trackingNumber}`
            : ""),
      ).catch((e) => console.error("[telegram notify]", e));
    }

    if (body.paymentStatus === "paid" && existing.paymentStatus !== "paid") {
      notifyTelegram(
        "orders",
        `💳 *Zahlung bestätigt: ${existing.orderNumber}*\nBetrag: ${existing.total} €`,
      ).catch((e) => console.error("[telegram notify]", e));
    }

    // Create notification for general status changes
    if (body.status && body.status !== existing.status && body.status !== "shipped") {
      await db.insert(adminNotifications).values({
        type: "new_order",
        title: `Status von ${existing.orderNumber} geändert`,
        message: `Bestellung ${existing.orderNumber}: Status geändert von "${existing.status}" auf "${body.status}".`,
        data: {
          orderId: id,
          orderNumber: existing.orderNumber,
          oldStatus: existing.status,
          newStatus: body.status,
        },
      });
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("[Admin Order PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
