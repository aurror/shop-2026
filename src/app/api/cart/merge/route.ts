import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartItems, products, productVariants } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface GuestCartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

// POST /api/cart/merge — merge guest cart items (from localStorage) into DB cart
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const body = await request.json();
    const items: GuestCartItem[] = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ merged: 0 });
    }

    let merged = 0;

    for (const item of items) {
      if (!item.productId || !item.variantId || !Number.isInteger(item.quantity) || item.quantity < 1) {
        continue;
      }

      // Validate product/variant exists and is active
      const [variant] = await db
        .select({ id: productVariants.id, stock: productVariants.stock })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            eq(productVariants.id, item.variantId),
            eq(products.id, item.productId),
            eq(products.active, true)
          )
        )
        .limit(1);

      if (!variant || variant.stock < 1) continue;

      const qty = Math.min(item.quantity, variant.stock);

      // Upsert: if already in cart, add quantities (capped at stock)
      await db
        .insert(cartItems)
        .values({
          userId: session.user.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qty,
        })
        .onConflictDoUpdate({
          target: [cartItems.userId, cartItems.variantId],
          set: {
            quantity: sql`LEAST(${cartItems.quantity} + ${qty}, ${variant.stock})`,
          },
        });

      merged++;
    }

    return NextResponse.json({ merged });
  } catch (error) {
    console.error("[Cart Merge]", error);
    return NextResponse.json({ error: "Fehler beim Zusammenführen des Warenkorbs" }, { status: 500 });
  }
}
