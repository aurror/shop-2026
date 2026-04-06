"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useCart, getGuestCart, saveGuestCart } from "@/components/shop/CartContext";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: string;
    compareAtPrice?: string | null;
    images: string[];
    tags?: string[] | null;
    featured?: boolean;
    category?: {
      name: string;
      slug: string;
    } | null;
    variants?: {
      id: string;
      name?: string;
      price: string | null;
      stock: number;
    }[];
    minPrice?: number;
    totalStock?: number;
  };
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function ProductCard({ product }: ProductCardProps) {
  const { incrementCartCount } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const variants = product.variants || [];
  const totalStock =
    product.totalStock ?? variants.reduce((sum, v) => sum + v.stock, 0);
  const isOutOfStock = variants.length > 0 && totalStock === 0;

  // Calculate price range
  const prices = variants
    .map((v) => (v.price ? parseFloat(v.price) : parseFloat(product.basePrice)))
    .filter((p) => !isNaN(p));

  const basePrice = parseFloat(product.basePrice);
  const minPrice = product.minPrice ?? (prices.length > 0 ? Math.min(...prices) : basePrice);
  const maxPrice = prices.length > 0 ? Math.max(...prices) : basePrice;
  const hasVariantPrices = minPrice !== maxPrice;

  const compareAtPrice = product.compareAtPrice
    ? parseFloat(product.compareAtPrice)
    : null;

  const imageUrl = product.images?.[0] || null;
  const tags = product.tags?.filter(Boolean) ?? [];

  // Can add directly if exactly 1 variant with stock
  const singleVariant = variants.length === 1 ? variants[0] : null;
  const canDirectAdd = singleVariant != null && singleVariant.stock > 0 && !isOutOfStock;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!singleVariant) return;
    setAdding(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, variantId: singleVariant.id, quantity: 1 }),
      });
      if (res.status === 401) {
        // Guest: save to localStorage
        const cart = getGuestCart();
        const existing = cart.find(
          (i) => i.productId === product.id && i.variantId === singleVariant.id
        );
        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({
            productId: product.id,
            variantId: singleVariant.id,
            quantity: 1,
            productName: product.name,
            variantName: singleVariant.name,
            productSlug: product.slug,
            productImage: imageUrl ?? undefined,
            unitPrice: singleVariant.price ? parseFloat(singleVariant.price) : basePrice,
          });
        }
        saveGuestCart(cart);
      }
      incrementCartCount(1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-xl bg-neutral-50 transition-all duration-300 group-hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100">
              <svg
                className="h-12 w-12 text-neutral-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
              </svg>
            </div>
          )}

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                Ausverkauft
              </span>
            </div>
          )}

          {/* Category badge */}
          {product.category && (
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-700 backdrop-blur-sm">
                {product.category.name}
              </span>
            </div>
          )}

          {/* Sale badge */}
          {compareAtPrice && compareAtPrice > minPrice && !isOutOfStock && (
            <div className="absolute right-3 top-3">
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                −{Math.round(((compareAtPrice - minPrice) / compareAtPrice) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-black line-clamp-2 leading-snug">
            {product.name}
          </h3>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-baseline gap-2">
            {hasVariantPrices ? (
              <span className="text-sm font-semibold text-black">
                ab {formatPrice(minPrice)}
              </span>
            ) : (
              <span className="text-sm font-semibold text-black">
                {formatPrice(minPrice)}
              </span>
            )}

            {compareAtPrice && compareAtPrice > minPrice && (
              <span className="text-xs text-neutral-400 line-through">
                {formatPrice(compareAtPrice)}
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] text-neutral-400">inkl. MwSt.</p>

          {/* Add to cart — mobile: always visible; desktop: on hover */}
          {!isOutOfStock && (
            <div className="mt-3">
              {canDirectAdd ? (
                <button
                  onClick={handleAddToCart}
                  disabled={adding}
                  className={`
                    w-full rounded-lg py-2 text-xs font-medium transition-colors
                    sm:opacity-0 sm:group-hover:opacity-100
                    ${added
                      ? "bg-green-600 text-white"
                      : "bg-black text-white hover:bg-neutral-800 active:bg-neutral-700"
                    }
                  `}
                >
                  {added ? "✓ Hinzugefügt" : adding ? "…" : "In den Warenkorb"}
                </button>
              ) : variants.length !== 1 ? (
                <span className="block w-full rounded-lg bg-neutral-900 py-2 text-center text-xs font-medium text-white sm:opacity-0 sm:group-hover:opacity-100">
                  Variante wählen →
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
