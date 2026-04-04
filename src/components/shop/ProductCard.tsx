"use client";

import Link from "next/link";
import Image from "next/image";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: string;
    compareAtPrice?: string | null;
    images: string[];
    featured?: boolean;
    category?: {
      name: string;
      slug: string;
    } | null;
    variants?: {
      id: string;
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

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block"
    >
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
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-black line-clamp-2 leading-snug">
            {product.name}
          </h3>

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

          <p className="mt-1 text-[11px] text-neutral-400">
            inkl. MwSt.
          </p>
        </div>
      </div>
    </Link>
  );
}
