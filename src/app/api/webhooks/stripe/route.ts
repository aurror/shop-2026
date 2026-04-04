import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, adminNotifications, checkoutReservations, productVariants } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { constructWebhookEvent } from "@/lib/stripe";
import { sendTemplateEmail } from "@/lib/email";
import { notifyTelegram } from "@/lib/telegram";

async function releaseReservations(orderId: string) {
  await db
    .update(checkoutReservations)
    .set({ releasedAt: new Date() })
    .where(and(eq(checkoutReservations.orderId, orderId), isNull(checkoutReservations.releasedAt)));
}

async function fulfillReservations(orderId: string) {
  const reservations = await db
    .select()
    .from(checkoutReservations)
    .where(and(eq(checkoutReservations.orderId, orderId), isNull(checkoutReservations.releasedAt)));

  for (const res of reservations) {
    const [updatedVariant] = await db
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} - ${res.quantity}` })
      .where(eq(productVariants.id, res.variantId))
      .returning({ stock: productVariants.stock, lowStockThreshold: productVariants.lowStockThreshold });

    if (updatedVariant && updatedVariant.stock <= updatedVariant.lowStockThreshold) {
      await db.insert(adminNotifications).values({
        type: "low_stock",
        title: "Niedriger Bestand",
        message: `Variante ${res.variantId} hat nur noch ${updatedVariant.stock} Stück auf Lager.`,
        data: { variantId: res.variantId, stock: updatedVariant.stock },
      });
      notifyTelegram("orders", `⚠️ *Niedriger Bestand*\nVariante ${res.variantId}\nNur noch ${updatedVariant.stock} Stück`).catch(() => {});
    }
  }

  // Mark all reservations as released (fulfilled)
  await db
    .update(checkoutReservations)
    .set({ releasedAt: new Date() })
    .where(eq(checkoutReservations.orderId, orderId));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    let event;
    try {
      event = await constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const orderId = session.metadata?.orderId;
        const orderNumber = session.metadata?.orderNumber;

        if (!orderId) {
          console.error("[Stripe Webhook] No orderId in metadata");
          break;
        }

        // Update order status
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "paid",
            stripePaymentIntentId: session.payment_intent,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));

        // Fulfill reservations (decrement actual stock)
        await fulfillReservations(orderId);

        // Get order for email
        const order = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (order.length) {
          // Send payment confirmation email
          await sendTemplateEmail(order[0].customerEmail, "payment_received", {
            orderNumber: order[0].orderNumber,
            customerName: (order[0].shippingAddress as any)?.firstName || "",
          });

          // Admin notification
          await db.insert(adminNotifications).values({
            type: "payment_received",
            title: "Zahlung erhalten",
            message: `Zahlung für Bestellung ${order[0].orderNumber} über ${order[0].total} € erhalten.`,
            data: { orderId: order[0].id, orderNumber: order[0].orderNumber },
          });
        }

        // Notify Telegram
        if (order.length) {
          notifyTelegram(
            "orders",
            `💳 *Zahlung eingegangen*\nBestellung: ${order[0].orderNumber}\nBetrag: ${order[0].total} €`,
          ).catch((e) => console.error("[telegram notify]", e));
        }

        console.log(`[Stripe Webhook] Order ${orderNumber} paid`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as any;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          // The checkout session expired — release reservations and mark order as cancelled
          await releaseReservations(orderId);
          await db
            .update(orders)
            .set({
              paymentStatus: "failed",
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));

          console.log(`[Stripe Webhook] Checkout expired for order ${orderId}`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as any;
        const orderId = paymentIntent.metadata?.orderId;

        if (orderId) {
          await releaseReservations(orderId);
          await db
            .update(orders)
            .set({
              paymentStatus: "failed",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));

          console.log(`[Stripe Webhook] Payment failed for order ${orderId}`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
