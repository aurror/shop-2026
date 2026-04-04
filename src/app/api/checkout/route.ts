import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cartItems,
  products,
  productVariants,
  orders,
  orderItems,
  discounts,
  adminNotifications,
  users,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { addressSchema } from "@/lib/security";
import { notifyTelegram } from "@/lib/telegram";
import { generateOrderNumber } from "@/lib/security";
import { getShippingConfig, calculateShippingFee } from "@/lib/shipping";
import { sendTemplateEmail } from "@/lib/email";
import { z } from "zod";

const checkoutSchema = z.object({
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: z.enum(["stripe", "klarna", "bank_transfer"]),
  discountCode: z.string().optional(),
  agreedToTerms: z.literal(true, {
    message: "Sie müssen den AGB zustimmen",
  }),
  agreedToWithdrawal: z.literal(true, {
    message: "Sie müssen die Widerrufsbelehrung zur Kenntnis nehmen",
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      discountCode,
      agreedToTerms,
      agreedToWithdrawal,
    } = parsed.data;

    // Fetch cart items with product and variant info
    const cart = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        productName: products.name,
        productBasePrice: products.basePrice,
        productTaxRate: products.taxRate,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        variantPrice: productVariants.price,
        variantStock: productVariants.stock,
        variantWeight: productVariants.weight,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.userId, session.user.id));

    if (!cart.length) {
      return NextResponse.json(
        { error: "Ihr Warenkorb ist leer" },
        { status: 400 }
      );
    }

    // Validate stock for all items
    for (const item of cart) {
      if (item.variantStock < item.quantity) {
        return NextResponse.json(
          {
            error: `"${item.productName} - ${item.variantName}" ist nicht mehr in ausreichender Menge verfügbar (verfügbar: ${item.variantStock})`,
          },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    const itemDetails = cart.map((item) => {
      const unitPrice = item.variantPrice
        ? parseFloat(item.variantPrice)
        : parseFloat(item.productBasePrice);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      return {
        ...item,
        unitPrice,
        totalPrice,
      };
    });

    // Validate and apply discount
    let discountAmount = 0;
    let discountRecord: typeof discounts.$inferSelect | null = null;

    if (discountCode) {
      const disc = await db
        .select()
        .from(discounts)
        .where(
          and(
            eq(discounts.code, discountCode.toUpperCase().trim()),
            eq(discounts.active, true)
          )
        )
        .limit(1);

      if (!disc.length) {
        return NextResponse.json(
          { error: "Ungültiger Rabattcode" },
          { status: 400 }
        );
      }

      discountRecord = disc[0];

      // Check expiration
      if (discountRecord.expiresAt && new Date() > discountRecord.expiresAt) {
        return NextResponse.json(
          { error: "Dieser Rabattcode ist abgelaufen" },
          { status: 400 }
        );
      }

      // Check if not yet active
      if (discountRecord.startsAt && new Date() < discountRecord.startsAt) {
        return NextResponse.json(
          { error: "Dieser Rabattcode ist noch nicht gültig" },
          { status: 400 }
        );
      }

      // Check usage limits
      if (
        discountRecord.maxUses &&
        discountRecord.currentUses >= discountRecord.maxUses
      ) {
        return NextResponse.json(
          { error: "Dieser Rabattcode wurde bereits zu oft verwendet" },
          { status: 400 }
        );
      }

      // Check minimum order amount
      if (
        discountRecord.minOrderAmount &&
        subtotal < parseFloat(discountRecord.minOrderAmount)
      ) {
        return NextResponse.json(
          {
            error: `Mindestbestellwert von ${parseFloat(discountRecord.minOrderAmount).toFixed(2)} € nicht erreicht`,
          },
          { status: 400 }
        );
      }

      // Calculate discount
      switch (discountRecord.type) {
        case "percentage":
          discountAmount =
            subtotal * (parseFloat(discountRecord.value) / 100);
          break;
        case "fixed":
          discountAmount = Math.min(
            parseFloat(discountRecord.value),
            subtotal
          );
          break;
        case "free_shipping":
          // Handled during shipping calculation
          break;
      }

      discountAmount = Math.round(discountAmount * 100) / 100;
    }

    const subtotalAfterDiscount = subtotal - discountAmount;

    // Calculate shipping
    const shippingConfig = await getShippingConfig();
    let totalWeightKg = 0;
    for (const item of itemDetails) {
      const weight = item.variantWeight
        ? parseFloat(item.variantWeight)
        : 0;
      totalWeightKg += weight * item.quantity;
    }

    let shippingCost: number;
    if (discountRecord?.type === "free_shipping") {
      shippingCost = 0;
    } else {
      shippingCost = calculateShippingFee(
        shippingConfig,
        subtotalAfterDiscount,
        totalWeightKg
      );
    }

    // Calculate tax (19% MwSt included in price: tax = price * 19 / 119)
    const taxableAmount = subtotalAfterDiscount + shippingCost;
    const taxAmount = Math.round((taxableAmount * 19) / 119 * 100) / 100;

    // Total
    const total =
      Math.round((subtotalAfterDiscount + shippingCost) * 100) / 100;

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Get customer email
    const user = await db
      .select({ email: users.email, phone: users.phone, name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user.length) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 400 }
      );
    }

    // Determine initial status
    const initialStatus =
      paymentMethod === "bank_transfer" ? "awaiting_payment" : "pending";
    const paymentStatus =
      paymentMethod === "bank_transfer" ? "pending" : "pending";

    // Create order
    const orderValues = {
      orderNumber,
      userId: session.user.id,
      status: initialStatus,
      paymentMethod,
      paymentStatus,
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      discountId: discountRecord?.id ?? null,
      shippingAddress,
      billingAddress,
      customerEmail: user[0].email,
      customerPhone: user[0].phone ?? undefined,
      agreedToTerms,
      agreedToWithdrawal,
    } as typeof orders.$inferInsert;

    const [order] = await db
      .insert(orders)
      .values(orderValues)
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    // Create order items
    for (const item of itemDetails) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.variantSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        totalPrice: item.totalPrice.toFixed(2),
      });
    }

    // Decrement stock for each variant and check for low stock
    for (const item of itemDetails) {
      const [updatedVariant] = await db
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} - ${item.quantity}`,
        })
        .where(eq(productVariants.id, item.variantId))
        .returning({ stock: productVariants.stock, lowStockThreshold: productVariants.lowStockThreshold });

      if (updatedVariant && updatedVariant.stock <= updatedVariant.lowStockThreshold) {
        await db.insert(adminNotifications).values({
          type: "low_stock",
          title: `Niedriger Bestand: ${item.productName}`,
          message: `${item.productName} – ${item.variantName} (${item.variantSku}) hat nur noch ${updatedVariant.stock} Stück auf Lager.`,
          data: {
            productId: item.productId,
            variantId: item.variantId,
            stock: updatedVariant.stock,
            threshold: updatedVariant.lowStockThreshold,
          },
        });

        notifyTelegram(
          "orders",
          `⚠️ *Niedriger Bestand*\n${item.productName} – ${item.variantName} (${item.variantSku})\nNur noch ${updatedVariant.stock} Stück`,
        ).catch((e) => console.error("[telegram notify]", e));
      }
    }

    // Clear cart
    await db
      .delete(cartItems)
      .where(eq(cartItems.userId, session.user.id));

    // Increment discount usage if applicable
    if (discountRecord) {
      await db
        .update(discounts)
        .set({
          currentUses: sql`${discounts.currentUses} + 1`,
        })
        .where(eq(discounts.id, discountRecord.id));
    }

    // Create admin notification
    await db.insert(adminNotifications).values({
      type: "new_order",
      title: `Neue Bestellung ${orderNumber}`,
      message: `${user[0].name || user[0].email} hat eine Bestellung über ${total.toFixed(2)} € aufgegeben (${paymentMethod}).`,
      data: {
        orderId: order.id,
        orderNumber,
        total,
        paymentMethod,
        customerEmail: user[0].email,
      },
    });

    // Notify Telegram (fire-and-forget)
    notifyTelegram(
      "orders",
      `🛒 *Neue Bestellung ${orderNumber}*\n` +
        `Kunde: ${user[0].name || user[0].email}\n` +
        `Betrag: ${total.toFixed(2)} €\n` +
        `Zahlung: ${paymentMethod === "bank_transfer" ? "Banküberweisung" : paymentMethod}`,
    ).catch((e) => console.error("[telegram notify]", e));

    // Send emails based on payment method
    if (paymentMethod === "bank_transfer") {
      // Send bank transfer details email
      try {
        await sendTemplateEmail(user[0].email, "order_bank_transfer", {
          name: user[0].name || user[0].email,
          orderNumber,
          total: total.toFixed(2),
        });
      } catch (e) {
        console.error("[Checkout] Bank transfer email failed:", e);
      }
    }

    // Send order confirmation email
    try {
      await sendTemplateEmail(user[0].email, "order_confirmation", {
        name: user[0].name || user[0].email,
        orderNumber,
        total: total.toFixed(2),
        paymentMethod,
      });
    } catch (e) {
      console.error("[Checkout] Confirmation email failed:", e);
    }

    // Return response based on payment method
    if (paymentMethod === "bank_transfer") {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber,
        status: "awaiting_payment",
        total,
        message:
          "Bestellung erfolgreich erstellt. Bitte überweisen Sie den Betrag an die angegebene Bankverbindung.",
      });
    }

    // For stripe/klarna, return orderId for further processing
    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber,
      total,
      paymentMethod,
    });
  } catch (error) {
    console.error("[Checkout]", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Bestellung" },
      { status: 500 }
    );
  }
}
