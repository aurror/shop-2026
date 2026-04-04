import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discounts, couponAttempts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body;
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Rabattcode erforderlich" },
        { status: 400 }
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    const disc = await db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.code, normalizedCode),
          eq(discounts.active, true)
        )
      )
      .limit(1);

    if (!disc.length) {
      await db.insert(couponAttempts).values({
        code: normalizedCode,
        valid: false,
        subtotal: subtotal != null ? String(subtotal) : null,
        error: "Ungültiger Rabattcode",
        ip,
      }).catch(() => {}); // non-blocking, best-effort
      return NextResponse.json(
        { error: "Ungültiger Rabattcode" },
        { status: 400 }
      );
    }

    const discount = disc[0];

    if (discount.expiresAt && new Date() > discount.expiresAt) {
      await db.insert(couponAttempts).values({ code: normalizedCode, valid: false, subtotal: subtotal != null ? String(subtotal) : null, error: "Abgelaufen", ip }).catch(() => {});
      return NextResponse.json(
        { error: "Dieser Rabattcode ist abgelaufen" },
        { status: 400 }
      );
    }

    if (discount.startsAt && new Date() < discount.startsAt) {
      await db.insert(couponAttempts).values({ code: normalizedCode, valid: false, subtotal: subtotal != null ? String(subtotal) : null, error: "Noch nicht gültig", ip }).catch(() => {});
      return NextResponse.json(
        { error: "Dieser Rabattcode ist noch nicht gültig" },
        { status: 400 }
      );
    }

    if (discount.maxUses && discount.currentUses >= discount.maxUses) {
      await db.insert(couponAttempts).values({ code: normalizedCode, valid: false, subtotal: subtotal != null ? String(subtotal) : null, error: "Zu oft verwendet", ip }).catch(() => {});
      return NextResponse.json(
        { error: "Dieser Rabattcode wurde bereits zu oft verwendet" },
        { status: 400 }
      );
    }

    const orderSubtotal = typeof subtotal === "number" ? subtotal : 0;

    if (
      discount.minOrderAmount &&
      orderSubtotal < parseFloat(discount.minOrderAmount)
    ) {
      const errMsg = `Mindestbestellwert von ${parseFloat(discount.minOrderAmount).toFixed(2)} € nicht erreicht`;
      await db.insert(couponAttempts).values({ code: normalizedCode, valid: false, subtotal: subtotal != null ? String(subtotal) : null, error: errMsg, ip }).catch(() => {});
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    let discountAmount = 0;
    let description = "";

    switch (discount.type) {
      case "percentage":
        discountAmount =
          orderSubtotal * (parseFloat(discount.value) / 100);
        description = `${parseFloat(discount.value)}% Rabatt`;
        break;
      case "fixed":
        discountAmount = Math.min(parseFloat(discount.value), orderSubtotal);
        description = `${parseFloat(discount.value).toFixed(2)} € Rabatt`;
        break;
      case "free_shipping":
        description = "Kostenloser Versand";
        break;
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    // Log successful attempt
    await db.insert(couponAttempts).values({
      code: normalizedCode,
      valid: true,
      subtotal: subtotal != null ? String(subtotal) : null,
      discountAmount: String(discountAmount),
      ip,
    }).catch(() => {});

    return NextResponse.json({
      valid: true,
      code: discount.code,
      type: discount.type,
      description,
      discountAmount,
      freeShipping: discount.type === "free_shipping",
    });
  } catch (error) {
    console.error("[Discount Validate]", error);
    return NextResponse.json(
      { error: "Fehler bei der Überprüfung" },
      { status: 500 }
    );
  }
}
