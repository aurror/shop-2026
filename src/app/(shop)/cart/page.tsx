"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { getGuestCart, saveGuestCart, clearGuestCart, getGuestCartCount, useCart, type GuestCartItem } from "@/components/shop/CartContext";

interface CartItemData {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    name: string;
    slug: string;
    images: string[];
    basePrice: string;
    taxRate: string;
  };
  variant: {
    name: string;
    sku: string;
    price: string | null;
    stock: number;
    weight: string | null;
    attributes: Record<string, string>;
  };
  unitPrice: number;
  totalPrice: number;
}

interface CartData {
  items: CartItemData[];
  itemCount: number;
  subtotal: number;
}

interface ShippingData {
  shippingFee: number;
  freeShippingThreshold: number | null;
  freeShippingEligible: boolean;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [shipping, setShipping] = useState<ShippingData | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [discountInfo, setDiscountInfo] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<Array<{
    cartItemId: string; productName: string; variantName: string;
    type: "stock_reduced" | "out_of_stock"; requestedQty: number; availableStock: number;
  }>>([]);
  const { setCartCount } = useCart();
  const [isGuest, setIsGuest] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyVariantId, setNotifyVariantId] = useState<string | null>(null);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (res.status === 401) {
        // Not logged in — show guest cart from localStorage
        setIsGuest(true);
        const guestItems = getGuestCart();
        const items: CartItemData[] = guestItems.map((g) => ({
          id: `guest-${g.variantId}`,
          productId: g.productId,
          variantId: g.variantId,
          quantity: g.quantity,
          product: {
            name: g.productName ?? "",
            slug: g.productSlug ?? "",
            images: g.productImage ? [g.productImage] : [],
            basePrice: String(g.unitPrice ?? 0),
            taxRate: "0.19",
          },
          variant: { name: g.variantName ?? "", sku: "", price: null, stock: 99, weight: null, attributes: {} },
          unitPrice: g.unitPrice ?? 0,
          totalPrice: (g.unitPrice ?? 0) * g.quantity,
        }));
        const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
        const data: CartData = {
          items,
          itemCount: items.reduce((s, i) => s + i.quantity, 0),
          subtotal: Math.round(subtotal * 100) / 100,
        };
        setCart(data);
        return data;
      }
      if (!res.ok) throw new Error();
      setIsGuest(false);
      const data: CartData = await res.json();
      setCart(data);
      return data;
    } catch {
      setCart({ items: [], itemCount: 0, subtotal: 0 });
    }
  }, []);

  const fetchShipping = useCallback(async (cartData: CartData) => {
    if (!cartData.items.length) {
      setShipping(null);
      return;
    }
    setShippingLoading(true);
    try {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartData.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          subtotal: cartData.subtotal,
        }),
      });
      if (res.ok) {
        const data: ShippingData = await res.json();
        setShipping(data);
      }
    } catch {
      // ignore
    } finally {
      setShippingLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchCart();
      if (data && data.items.length > 0) {
        await fetchShipping(data);
        // Only validate stock for logged-in users
        if (!data.items[0]?.id.startsWith("guest-")) {
          try {
            const vRes = await fetch("/api/cart/validate");
            if (vRes.ok) {
              const vData = await vRes.json();
              setStockWarnings(vData.warnings || []);
            }
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
    })();
  }, [fetchCart, fetchShipping]);

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity < 1) return;
    setUpdatingId(cartItemId);
    try {
      if (cartItemId.startsWith("guest-")) {
        // Update localStorage guest cart
        const variantId = cartItemId.replace("guest-", "");
        const guestCart = getGuestCart();
        const idx = guestCart.findIndex((i) => i.variantId === variantId);
        if (idx >= 0) { guestCart[idx].quantity = quantity; saveGuestCart(guestCart); }
        setCartCount(getGuestCartCount());
        const data = await fetchCart();
        if (data) await fetchShipping(data);
        return;
      }
      const res = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItemId, quantity }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Fehler beim Aktualisieren");
        return;
      }
      const data = await fetchCart();
      if (data) await fetchShipping(data);
    } finally {
      setUpdatingId(null);
    }
  };

  const removeItem = async (cartItemId: string) => {
    setRemovingId(cartItemId);
    try {
      if (cartItemId.startsWith("guest-")) {
        const variantId = cartItemId.replace("guest-", "");
        const guestCart = getGuestCart().filter((i) => i.variantId !== variantId);
        saveGuestCart(guestCart);
        setCartCount(getGuestCartCount());
        const data = await fetchCart();
        if (data) await fetchShipping(data);
        return;
      }
      const res = await fetch(`/api/cart?id=${cartItemId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Fehler beim Entfernen");
        return;
      }
      const data = await fetchCart();
      if (data) await fetchShipping(data);
    } finally {
      setRemovingId(null);
    }
  };

  const handleNotify = async () => {
    if (!notifyVariantId || !notifyEmail) return;
    setNotifyLoading(true);
    setNotifyMessage(null);
    try {
      const res = await fetch("/api/notifications/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: notifyVariantId, email: notifyEmail }),
      });
      const data = await res.json();
      setNotifyMessage(res.ok ? "Wir benachrichtigen Sie, sobald der Artikel wieder verfügbar ist." : (data.error || "Fehler"));
      if (res.ok) { setNotifyVariantId(null); setNotifyEmail(""); }
    } finally {
      setNotifyLoading(false);
    }
  };

  const validateDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountError("");
    setDiscountInfo("");
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode.trim(),
          subtotal: cart?.subtotal ?? 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscountError(data.error || "Ungültiger Rabattcode");
      } else {
        setDiscountInfo(`✓ ${data.description}`);
      }
    } catch {
      setDiscountError("Fehler bei der Überprüfung");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4 py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-neutral-900">
          Warenkorb
        </h1>
        <EmptyState
          title="Ihr Warenkorb ist leer"
          description="Entdecken Sie unsere Produkte und finden Sie das Passende."
          icon={
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          }
          action={
            <Link href="/products">
              <Button variant="primary" size="lg">
                Produkte entdecken
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const total = cart.subtotal + (shipping?.shippingFee ?? 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-neutral-900">
        Warenkorb
      </h1>

      {/* Stock warnings banner */}
      {stockWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-semibold text-yellow-800">
            Verfügbarkeit hat sich geändert
          </p>
          <ul className="space-y-2">
            {stockWarnings.map((w) => (
              <li key={w.cartItemId} className="text-sm text-yellow-700">
                {w.type === "out_of_stock" ? (
                  <span>
                    <strong>{w.productName}</strong> ({w.variantName}) ist derzeit nicht auf Lager.
                  </span>
                ) : (
                  <span>
                    <strong>{w.productName}</strong> ({w.variantName}): Nur noch {w.availableStock} verfügbar (Sie haben {w.requestedQty} im Warenkorb).
                  </span>
                )}
                {" "}
                <button
                  className="underline hover:no-underline"
                  onClick={() => {
                    const item = cart?.items.find((i) => i.id === w.cartItemId);
                    if (item) setNotifyVariantId(item.variantId);
                  }}
                >
                  Benachrichtigen wenn verfügbar
                </button>
                {" · "}
                <Link href="/custom-print" className="underline hover:no-underline">
                  Anfrage stellen
                </Link>
              </li>
            ))}
          </ul>
          {/* Inline notify form */}
          {notifyVariantId && (
            <div className="mt-3 flex items-center gap-2 border-t border-yellow-200 pt-3">
              <Input
                type="email"
                placeholder="Ihre E-Mail-Adresse"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                className="h-9 max-w-xs text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleNotify}
                disabled={notifyLoading || !notifyEmail}
              >
                {notifyLoading ? "..." : "Eintragen"}
              </Button>
              <button className="text-xs text-yellow-600 hover:underline" onClick={() => setNotifyVariantId(null)}>
                Abbrechen
              </button>
            </div>
          )}
          {notifyMessage && (
            <p className="mt-2 text-sm text-yellow-700">{notifyMessage}</p>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-7">
          <div className="divide-y divide-neutral-200">
            {cart.items.map((item) => {
              const isUpdating = updatingId === item.id;
              const isRemoving = removingId === item.id;
              const itemWarning = stockWarnings.find((w) => w.cartItemId === item.id);

              return (
                <div
                  key={item.id}
                  className={`flex gap-4 py-6 transition-opacity ${isRemoving ? "opacity-40" : ""}`}
                >
                  {/* Thumbnail */}
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100"
                  >
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.name}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-300">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex flex-1 flex-col">
                    {itemWarning && (
                      <p className="mb-1 text-xs font-medium text-yellow-700">
                        {itemWarning.type === "out_of_stock"
                          ? "Nicht auf Lager"
                          : `Nur noch ${itemWarning.availableStock} verfügbar`}
                      </p>
                    )}
                    <div className="flex justify-between">
                      <div>
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="text-sm font-medium text-neutral-900 hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {item.variant.name}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-neutral-900">
                        {formatPrice(item.totalPrice)}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      {/* Quantity selector */}
                      <div className="flex items-center rounded-lg border border-neutral-300">
                        <button
                          type="button"
                          disabled={isUpdating || item.quantity <= 1}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2.5 py-1 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Menge verringern"
                        >
                          &minus;
                        </button>
                        <span className="min-w-[2rem] px-1 text-center text-sm font-medium text-neutral-900">
                          {isUpdating ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            item.quantity
                          )}
                        </span>
                        <button
                          type="button"
                          disabled={isUpdating || item.quantity >= item.variant.stock}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2.5 py-1 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Menge erhöhen"
                        >
                          +
                        </button>
                      </div>

                      {/* Unit price & Remove */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-500">
                          {formatPrice(item.unitPrice)} / Stk.
                        </span>
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-neutral-400 transition-colors hover:text-red-600"
                          aria-label="Entfernen"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 lg:col-span-5 lg:mt-0">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Zusammenfassung</h2>

            {/* Discount Code — collapsible */}
            <div className="mt-5">
              {discountInfo ? (
                /* Applied state */
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <span className="flex-1 text-xs font-medium text-green-800">{discountInfo}</span>
                  <button
                    type="button"
                    onClick={() => { setDiscountCode(""); setDiscountInfo(""); setDiscountError(""); setDiscountOpen(false); }}
                    className="text-xs text-green-700 hover:text-green-900"
                  >
                    Entfernen
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDiscountOpen((o) => !o)}
                    className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${discountOpen ? "rotate-90" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                    Rabattcode eingeben
                  </button>
                  {discountOpen && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={discountCode}
                        onChange={(e) => {
                          setDiscountCode(e.target.value);
                          setDiscountError("");
                          setDiscountInfo("");
                        }}
                        placeholder="Code eingeben"
                        className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validateDiscount(); } }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={validateDiscount}
                        disabled={!discountCode.trim()}
                      >
                        Anwenden
                      </Button>
                    </div>
                  )}
                  {discountError && (
                    <p className="mt-1 text-xs text-red-600">{discountError}</p>
                  )}
                </>
              )}
            </div>

            {/* Price breakdown */}
            <div className="mt-6 space-y-3 border-t border-neutral-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Zwischensumme</span>
                <span className="font-medium text-neutral-900">{formatPrice(cart.subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Versand</span>
                <span className="font-medium text-neutral-900">
                  {shippingLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : shipping ? (
                    shipping.shippingFee === 0 ? (
                      <span className="text-green-700">Kostenlos</span>
                    ) : (
                      formatPrice(shipping.shippingFee)
                    )
                  ) : (
                    "Wird berechnet"
                  )}
                </span>
              </div>

              {shipping?.freeShippingThreshold && !shipping.freeShippingEligible && (
                <p className="text-xs text-neutral-500">
                  Noch {formatPrice(shipping.freeShippingThreshold - cart.subtotal)} bis zum kostenlosen Versand
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-between border-t border-neutral-900 pt-4">
              <span className="text-base font-semibold text-neutral-900">Gesamt</span>
              <span className="text-base font-semibold text-neutral-900">
                {formatPrice(total)}
              </span>
            </div>
            <p className="mt-1 text-right text-xs text-neutral-500">inkl. MwSt.</p>

            {isGuest ? (
              <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-center">
                <p className="text-sm font-medium text-neutral-900">Zum Bezahlen anmelden</p>
                <p className="mt-1 text-xs text-neutral-500">Ihr Warenkorb wird nach der Anmeldung übernommen.</p>
                <Link
                  href="/auth/login?callbackUrl=/checkout"
                  className="mt-3 block w-full rounded-full bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-neutral-700"
                >
                  Anmelden & zur Kasse
                </Link>
                <Link
                  href="/auth/register?callbackUrl=/checkout"
                  className="mt-2 block text-xs text-neutral-500 underline hover:text-neutral-700"
                >
                  Noch kein Konto? Registrieren
                </Link>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full"
                onClick={() => router.push("/checkout")}
              >
                Zur Kasse
              </Button>
            )}

            <Link
              href="/products"
              className="mt-3 block text-center text-xs text-neutral-500 transition-colors hover:text-neutral-700"
            >
              Weiter einkaufen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
