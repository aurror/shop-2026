"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  subtotal: string;
  discountAmount: string;
  shippingCost: string;
  taxAmount: string;
  total: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }[];
}

const formatPrice = (price: number | string) => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
};

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("Keine Bestell-ID angegeben.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          setError("Bestellung konnte nicht geladen werden.");
          return;
        }
        const data = await res.json();
        setOrder(data);
      } catch {
        setError("Ein Fehler ist aufgetreten.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error || "Bestellung nicht gefunden."}</p>
        <Link href="/account/orders" className="mt-4 inline-block text-sm text-neutral-600 underline hover:text-black">
          Zu meinen Bestellungen
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-black">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Vielen Dank für Ihre Bestellung!
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Ihre Bestellung <span className="font-mono font-semibold">{order.orderNumber}</span> wurde erfolgreich aufgegeben.
        </p>
      </div>

      {/* Order summary */}
      <div className="mt-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="text-base font-semibold text-neutral-900">Bestellübersicht</h2>

        <div className="mt-4 divide-y divide-neutral-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                {item.variantName && (
                  <p className="text-xs text-neutral-500">{item.variantName}</p>
                )}
                <p className="text-xs text-neutral-500">Menge: {item.quantity}</p>
              </div>
              <p className="text-sm font-medium text-neutral-900">{formatPrice(item.totalPrice)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Zwischensumme</span>
            <span className="text-neutral-900">{formatPrice(order.subtotal)}</span>
          </div>
          {parseFloat(order.discountAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Rabatt</span>
              <span className="text-green-700">-{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Versand</span>
            <span className="text-neutral-900">
              {parseFloat(order.shippingCost) === 0 ? "Kostenlos" : formatPrice(order.shippingCost)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex justify-between border-t border-neutral-900 pt-3">
          <span className="font-semibold text-neutral-900">Gesamt</span>
          <span className="font-semibold text-neutral-900">{formatPrice(order.total)}</span>
        </div>
        <p className="mt-1 text-right text-xs text-neutral-500">inkl. MwSt.</p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/account/orders">
          <Button variant="primary" size="lg">
            Zu meinen Bestellungen
          </Button>
        </Link>
        <Link href="/products" className="text-sm text-neutral-500 hover:text-neutral-700">
          Weiter einkaufen
        </Link>
      </div>
    </div>
  );
}
