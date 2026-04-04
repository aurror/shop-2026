import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Rabattcode erforderlich" },
        { status: 400 }
      );
    }

    const disc = await db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.code, code.toUpperCase().trim()),
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

    const discount = disc[0];

    if (discount.expiresAt && new Date() > discount.expiresAt) {
      return NextResponse.json(
        { error: "Dieser Rabattcode ist abgelaufen" },
        { status: 400 }
      );
    }

    if (discount.startsAt && new Date() < discount.startsAt) {
      return NextResponse.json(
        { error: "Dieser Rabattcode ist noch nicht gültig" },
        { status: 400 }
      );
    }

    if (discount.maxUses && discount.currentUses >= discount.maxUses) {
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
      return NextResponse.json(
        {
          error: `Mindestbestellwert von ${parseFloat(discount.minOrderAmount).toFixed(2)} € nicht erreicht`,
        },
        { status: 400 }
      );
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
