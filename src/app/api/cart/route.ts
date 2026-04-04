import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cartItems,
  products,
  productVariants,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const items = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        quantity: cartItems.quantity,
        createdAt: cartItems.createdAt,
        productName: products.name,
        productSlug: products.slug,
        productImages: products.images,
        productBasePrice: products.basePrice,
        productTaxRate: products.taxRate,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        variantPrice: productVariants.price,
        variantStock: productVariants.stock,
        variantWeight: productVariants.weight,
        variantAttributes: productVariants.attributes,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.userId, session.user.id));

    const result = items.map((item) => {
      const unitPrice = item.variantPrice
        ? parseFloat(item.variantPrice)
        : parseFloat(item.productBasePrice);
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        product: {
          name: item.productName,
          slug: item.productSlug,
          images: (item.productImages as string[]) || [],
          basePrice: item.productBasePrice,
          taxRate: item.productTaxRate,
        },
        variant: {
          name: item.variantName,
          sku: item.variantSku,
          price: item.variantPrice,
          stock: item.variantStock,
          weight: item.variantWeight,
          attributes: item.variantAttributes,
        },
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotal = result.reduce((sum, item) => sum + item.totalPrice, 0);

    return NextResponse.json({
      items: result,
      itemCount: result.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Math.round(subtotal * 100) / 100,
    });
  } catch (error) {
    console.error("[Cart GET]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Warenkorbs" },
      { status: 500 }
    );
  }
}

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
    const { productId, variantId, quantity = 1 } = body;

    if (!productId || !variantId) {
      return NextResponse.json(
        { error: "Produkt und Variante erforderlich" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Ungültige Menge" },
        { status: 400 }
      );
    }

    // Check product exists and is active
    const product = await db
      .select({ id: products.id, active: products.active })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.active, true)))
      .limit(1);

    if (!product.length) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden" },
        { status: 404 }
      );
    }

    // Check variant exists, is active, and has stock
    const variant = await db
      .select({
        id: productVariants.id,
        stock: productVariants.stock,
        active: productVariants.active,
      })
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

    // Check if item already exists in cart
    const existing = await db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, session.user.id),
          eq(cartItems.variantId, variantId)
        )
      )
      .limit(1);

    const newQuantity = existing.length
      ? existing[0].quantity + quantity
      : quantity;

    // Check stock availability
    if (variant[0].stock < newQuantity) {
      return NextResponse.json(
        {
          error: `Nicht genügend Bestand. Verfügbar: ${variant[0].stock}`,
        },
        { status: 400 }
      );
    }

    if (existing.length) {
      // Update existing cart item quantity
      await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      // Insert new cart item
      await db.insert(cartItems).values({
        userId: session.user.id,
        productId,
        variantId,
        quantity,
      });
    }

    return NextResponse.json(
      { success: true, quantity: newQuantity },
      { status: existing.length ? 200 : 201 }
    );
  } catch (error) {
    console.error("[Cart POST]", error);
    return NextResponse.json(
      { error: "Fehler beim Hinzufügen zum Warenkorb" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cartItemId, quantity } = body;

    if (!cartItemId) {
      return NextResponse.json(
        { error: "Warenkorb-Artikel ID erforderlich" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Ungültige Menge" },
        { status: 400 }
      );
    }

    // Get cart item and verify ownership
    const item = await db
      .select({
        id: cartItems.id,
        variantId: cartItems.variantId,
        userId: cartItems.userId,
      })
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, cartItemId),
          eq(cartItems.userId, session.user.id)
        )
      )
      .limit(1);

    if (!item.length) {
      return NextResponse.json(
        { error: "Artikel nicht gefunden" },
        { status: 404 }
      );
    }

    // Check stock availability
    const variant = await db
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, item[0].variantId))
      .limit(1);

    if (!variant.length || variant[0].stock < quantity) {
      return NextResponse.json(
        {
          error: `Nicht genügend Bestand. Verfügbar: ${variant[0]?.stock ?? 0}`,
        },
        { status: 400 }
      );
    }

    await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, cartItemId));

    return NextResponse.json({ success: true, quantity });
  } catch (error) {
    console.error("[Cart PUT]", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Warenkorbs" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const cartItemId = searchParams.get("id");

    if (!cartItemId) {
      return NextResponse.json(
        { error: "Warenkorb-Artikel ID erforderlich" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.id, cartItemId),
          eq(cartItems.userId, session.user.id)
        )
      )
      .returning({ id: cartItems.id });

    if (!deleted.length) {
      return NextResponse.json(
        { error: "Artikel nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Cart DELETE]", error);
    return NextResponse.json(
      { error: "Fehler beim Entfernen aus dem Warenkorb" },
      { status: 500 }
    );
  }
}
