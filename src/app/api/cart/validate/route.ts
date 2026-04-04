import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartItems, products, productVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface CartValidationWarning {
  cartItemId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  type: "stock_reduced" | "out_of_stock";
  requestedQty: number;
  availableStock: number;
}

/**
 * GET /api/cart/validate
 * Returns warnings for stock issues in the current cart.
 * Called when opening the cart and at checkout start.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ warnings: [] });
  }

  const items = await db
    .select({
      cartItemId: cartItems.id,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      productName: products.name,
      variantName: productVariants.name,
      variantStock: productVariants.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.userId, session.user.id));

  const warnings: CartValidationWarning[] = [];

  for (const item of items) {
    if (item.variantStock === 0) {
      warnings.push({
        cartItemId: item.cartItemId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        type: "out_of_stock",
        requestedQty: item.quantity,
        availableStock: 0,
      });
    } else if (item.quantity > item.variantStock) {
      warnings.push({
        cartItemId: item.cartItemId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        type: "stock_reduced",
        requestedQty: item.quantity,
        availableStock: item.variantStock,
      });
    }
  }

  return NextResponse.json({ warnings });
}
