"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface OrderData {
  id: string;
  orderNumber: string;
  total: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }[];
  subtotal: string;
  discountAmount: string;
  shippingCost: string;
}

interface BankDetails {
  bankName: string;
  iban: string;
  bic: string;
  accountHolder: string;
}

const formatPrice = (price: number | string) => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
};

const DEFAULT_BANK_DETAILS: BankDetails = {
  bankName: "Sparkasse",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  accountHolder: "3DPrintIt GmbH",
};

export default function BankTransferPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails>(DEFAULT_BANK_DETAILS);
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
        const [orderRes, settingsRes] = await Promise.all([
          fetch(`/api/orders/${orderId}`),
          fetch("/api/admin/settings?key=bank_details").catch(() => null),
        ]);

        if (!orderRes.ok) {
          setError("Bestellung konnte nicht geladen werden.");
          setLoading(false);
          return;
        }

        const orderData = await orderRes.json();
        setOrder(orderData);

        if (settingsRes && settingsRes.ok) {
          try {
            const settingsData = await settingsRes.json();
            if (settingsData.value) {
              setBankDetails(settingsData.value as BankDetails);
            }
          } catch {
            // Use defaults
          }
        }
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Vielen Dank für Ihre Bestellung!
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Bitte überweisen Sie den Betrag an die unten stehende Bankverbindung.
          <br />
          Ihre Bestellung wird nach Zahlungseingang bearbeitet.
        </p>
      </div>

      {/* Bank Details */}
      <div className="mt-10 rounded-xl border-2 border-black bg-white p-6">
        <h2 className="text-base font-semibold text-neutral-900">Bankverbindung</h2>

        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-neutral-600">Kontoinhaber</span>
            <span className="text-sm font-medium text-neutral-900">{bankDetails.accountHolder}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-600">Bank</span>
            <span className="text-sm font-medium text-neutral-900">{bankDetails.bankName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-600">IBAN</span>
            <span className="font-mono text-sm font-medium text-neutral-900">{bankDetails.iban}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-600">BIC</span>
            <span className="font-mono text-sm font-medium text-neutral-900">{bankDetails.bic}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-600">Betrag</span>
            <span className="text-sm font-semibold text-neutral-900">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-neutral-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Verwendungszweck</p>
          <p className="mt-1 font-mono text-lg font-bold text-neutral-900">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Bitte geben Sie unbedingt den Verwendungszweck an, damit wir Ihre Zahlung zuordnen können.
          </p>
        </div>
      </div>

      {/* Order summary */}
      <div className="mt-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="text-base font-semibold text-neutral-900">Bestellübersicht</h2>
        <p className="mt-1 text-xs text-neutral-500">Bestellnummer: {order.orderNumber}</p>

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
