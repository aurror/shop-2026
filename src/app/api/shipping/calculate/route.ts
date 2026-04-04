import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getShippingConfig, calculateShippingFee } from "@/lib/shipping";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, subtotal } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Keine Artikel angegeben" },
        { status: 400 }
      );
    }

    if (typeof subtotal !== "number" || subtotal < 0) {
      return NextResponse.json(
        { error: "Ungültiger Zwischensumme" },
        { status: 400 }
      );
    }

    // Calculate total weight from variants
    let totalWeightKg = 0;

    for (const item of items) {
      if (!item.variantId || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          { error: "Ungültige Artikeldaten" },
          { status: 400 }
        );
      }

      const variant = await db
        .select({ weight: productVariants.weight })
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);

      if (!variant.length) {
        return NextResponse.json(
          { error: `Variante ${item.variantId} nicht gefunden` },
          { status: 404 }
        );
      }

      const weight = variant[0].weight
        ? parseFloat(variant[0].weight)
        : 0;
      totalWeightKg += weight * item.quantity;
    }

    const config = await getShippingConfig();
    const shippingFee = calculateShippingFee(config, subtotal, totalWeightKg);

    return NextResponse.json({
      shippingFee,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      freeShippingThreshold: config.freeThresholdEnabled
        ? config.freeThreshold
        : null,
      freeShippingEligible:
        config.freeThresholdEnabled && subtotal >= config.freeThreshold,
    });
  } catch (error) {
    console.error("[Shipping Calculate]", error);
    return NextResponse.json(
      { error: "Fehler bei der Versandkostenberechnung" },
      { status: 500 }
    );
  }
}
