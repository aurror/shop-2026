"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/shop/ProductCard";

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: string | null;
  stock: number;
  weight: string | null;
  attributes: Record<string, string>;
  active: boolean;
  sortOrder: number;
}

interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice: string | null;
  images: string[];
  relationType: string;
}

interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  descriptionHtml: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  images: string[];
  featured: boolean;
  weight: string | null;
  taxRate: string;
  category: { id: string; name: string; slug: string } | null;
  variants: Variant[];
  relatedProducts: RelatedProduct[];
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function ProductDetail({ product }: { product: ProductData }) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    product.variants.length > 0 ? product.variants[0] : null
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const currentPrice = selectedVariant?.price
    ? parseFloat(selectedVariant.price)
    : parseFloat(product.basePrice);

  const compareAtPrice = product.compareAtPrice
    ? parseFloat(product.compareAtPrice)
    : null;

  const stock = selectedVariant?.stock ?? 0;
  const isOutOfStock = product.variants.length > 0 && stock === 0;
  const isLowStock = stock > 0 && stock <= 5;

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant || isOutOfStock) return;
    setAddingToCart(true);
    setCartMessage(null);

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          quantity: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCartMessage({ type: "error", text: data.error || "Fehler beim Hinzufügen" });
      } else {
        setCartMessage({ type: "success", text: "Zum Warenkorb hinzugefügt" });
        // Clear message after 3s
        setTimeout(() => setCartMessage(null), 3000);
      }
    } catch {
      setCartMessage({ type: "error", text: "Netzwerkfehler. Bitte versuchen Sie es erneut." });
    } finally {
      setAddingToCart(false);
    }
  }, [selectedVariant, isOutOfStock, product.id]);

  const handleNotify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedVariant || !notifyEmail) return;
      setNotifyLoading(true);
      setNotifyMessage(null);

      try {
        const res = await fetch("/api/notifications/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: notifyEmail,
            productId: product.id,
            variantId: selectedVariant.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setNotifyMessage(data.error || "Fehler bei der Registrierung");
        } else {
          setNotifyMessage(data.message);
          setNotifyEmail("");
        }
      } catch {
        setNotifyMessage("Netzwerkfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setNotifyLoading(false);
      }
    },
    [selectedVariant, notifyEmail, product.id]
  );

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-400">
          <li>
            <Link href="/" className="transition-colors hover:text-black">
              Startseite
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/products" className="transition-colors hover:text-black">
              Produkte
            </Link>
          </li>
          {product.category && (
            <>
              <li>/</li>
              <li>
                <Link
                  href={`/kategorie/${product.category.slug}`}
                  className="transition-colors hover:text-black"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <li>/</li>
          <li className="text-neutral-600">{product.name}</li>
        </ol>
      </nav>

      {/* Product main */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Image gallery */}
          <div>
            {/* Main image */}
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-50">
              {product.images.length > 0 ? (
                <Image
                  src={product.images[selectedImageIndex] || product.images[0]}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg
                    className="h-20 w-20 text-neutral-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={0.75}
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
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      idx === selectedImageIndex
                        ? "border-black"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} – Bild ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col">
            {/* Category */}
            {product.category && (
              <Link
                href={`/kategorie/${product.category.slug}`}
                className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400 transition-colors hover:text-black"
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-semibold text-black">
                {formatPrice(currentPrice)}
              </span>
              {compareAtPrice && compareAtPrice > currentPrice && (
                <span className="text-base text-neutral-400 line-through">
                  {formatPrice(compareAtPrice)}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-neutral-400">
              Inkl. MwSt., zzgl.{" "}
              <Link href="/agb" className="underline underline-offset-2">
                Versandkosten
              </Link>
            </p>

            {/* Variant selector */}
            {product.variants.length > 1 && (
              <div className="mt-6">
                <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Variante
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      disabled={v.stock === 0}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                        selectedVariant?.id === v.id
                          ? "border-black bg-black text-white"
                          : v.stock === 0
                          ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300 line-through"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock indicator */}
            <div className="mt-6">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <span className="h-2 w-2 rounded-full bg-neutral-300" />
                  Ausverkauft
                </div>
              ) : isLowStock ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Nur noch {stock} auf Lager
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Auf Lager
                </div>
              )}
            </div>

            {/* Add to cart or Notify */}
            <div className="mt-6">
              {isOutOfStock ? (
                <div>
                  <p className="mb-3 text-sm text-neutral-500">
                    Lassen Sie sich benachrichtigen, sobald der Artikel wieder
                    verfügbar ist:
                  </p>
                  <form onSubmit={handleNotify} className="flex gap-2">
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="Ihre E-Mail-Adresse"
                      required
                      className="h-12 flex-1 rounded-lg border border-neutral-200 bg-white px-4 text-sm text-black placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400"
                    />
                    <button
                      type="submit"
                      disabled={notifyLoading}
                      className="h-12 rounded-lg bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {notifyLoading ? "..." : "Benachrichtigen"}
                    </button>
                  </form>
                  {notifyMessage && (
                    <p className="mt-2 text-xs text-neutral-500">{notifyMessage}</p>
                  )}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addingToCart || !selectedVariant}
                    className="flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 sm:w-auto sm:px-12"
                  >
                    {addingToCart ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      "In den Warenkorb"
                    )}
                  </button>
                  {cartMessage && (
                    <p
                      className={`mt-3 text-sm ${
                        cartMessage.type === "success"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {cartMessage.text}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {(product.descriptionHtml || product.description) && (
              <div className="mt-8 border-t border-neutral-100 pt-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Beschreibung
                </h2>
                {product.descriptionHtml ? (
                  <div
                    className="prose prose-sm prose-neutral mt-4 max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                  />
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-neutral-600 whitespace-pre-line">
                    {product.description}
                  </p>
                )}
              </div>
            )}

            {/* Product details */}
            <div className="mt-8 border-t border-neutral-100 pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Details
              </h2>
              <dl className="mt-4 space-y-3">
                {selectedVariant?.sku && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Artikelnummer</dt>
                    <dd className="font-medium text-black">{selectedVariant.sku}</dd>
                  </div>
                )}
                {(selectedVariant?.weight || product.weight) && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-neutral-500">Gewicht</dt>
                    <dd className="font-medium text-black">
                      {selectedVariant?.weight || product.weight} g
                    </dd>
                  </div>
                )}
                {selectedVariant?.attributes &&
                  Object.entries(selectedVariant.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <dt className="text-neutral-500">{key}</dt>
                      <dd className="font-medium text-black">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {product.relatedProducts.length > 0 && (
        <section className="border-t border-neutral-100 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-black">
              Ähnliche Produkte
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {product.relatedProducts.map((rp) => (
                <ProductCard
                  key={rp.id}
                  product={{
                    id: rp.id,
                    name: rp.name,
                    slug: rp.slug,
                    basePrice: rp.basePrice,
                    compareAtPrice: rp.compareAtPrice,
                    images: rp.images,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
