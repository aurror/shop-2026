import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  stockNotifications,
  products,
  productVariants,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { emailSchema, rateLimit } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success } = rateLimit(`stock-notify:${ip}`, 5, 300000);
    if (!success) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, productId, variantId } = body;

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Ungültige E-Mail-Adresse" },
        { status: 400 }
      );
    }

    if (!productId || !variantId) {
      return NextResponse.json(
        { error: "Produkt und Variante erforderlich" },
        { status: 400 }
      );
    }

    // Verify product and variant exist
    const product = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.active, true)))
      .limit(1);

    if (!product.length) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden" },
        { status: 404 }
      );
    }

    const variant = await db
      .select({ id: productVariants.id, stock: productVariants.stock })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
          eq(productVariants.active, true)
        )
      )
      .limit(1);

    if (!variant.length) {
      return NextResponse.json(
        { error: "Variante nicht gefunden" },
        { status: 404 }
      );
    }

    // Check if variant is actually out of stock
    if (variant[0].stock > 0) {
      return NextResponse.json(
        { error: "Dieser Artikel ist aktuell auf Lager" },
        { status: 400 }
      );
    }

    // Check if notification already exists for this email + variant
    const existing = await db
      .select({ id: stockNotifications.id })
      .from(stockNotifications)
      .where(
        and(
          eq(stockNotifications.email, email.toLowerCase().trim()),
          eq(stockNotifications.variantId, variantId),
          eq(stockNotifications.notified, false)
        )
      )
      .limit(1);

    if (existing.length) {
      return NextResponse.json({
        success: true,
        message:
          "Sie werden bereits benachrichtigt, wenn dieser Artikel wieder verfügbar ist.",
      });
    }

    // Create stock notification
    await db.insert(stockNotifications).values({
      email: email.toLowerCase().trim(),
      productId,
      variantId,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Sie werden benachrichtigt, sobald der Artikel wieder verfügbar ist.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Stock Notification]", error);
    return NextResponse.json(
      { error: "Fehler beim Registrieren der Benachrichtigung" },
      { status: 500 }
    );
  }
}
