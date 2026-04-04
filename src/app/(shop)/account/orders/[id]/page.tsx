"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ORDER_STATUSES } from "@/types";

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  streetNumber: string;
  addressExtra?: string;
  zip: string;
  city: string;
  country: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  discountAmount: string;
  shippingCost: string;
  taxAmount: string;
  total: string;
  shippingAddress: ShippingAddress | null;
  billingAddress: ShippingAddress | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const formatPrice = (price: number | string) => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

function getStatusBadge(status: string) {
  const s = ORDER_STATUSES.find((os) => os.value === status);
  if (!s) return <Badge>{status}</Badge>;

  const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    pending: "warning",
    awaiting_payment: "warning",
    paid: "success",
    processing: "info",
    shipped: "info",
    delivered: "success",
    cancelled: "danger",
    refunded: "default",
  };

  return <Badge variant={variantMap[status] || "default"}>{s.label}</Badge>;
}

const STATUS_STEPS = [
  { key: "pending", label: "Bestellt" },
  { key: "paid", label: "Bezahlt" },
  { key: "processing", label: "In Bearbeitung" },
  { key: "shipped", label: "Versendet" },
  { key: "delivered", label: "Zugestellt" },
];

function getStepIndex(status: string): number {
  const mapping: Record<string, number> = {
    pending: 0,
    awaiting_payment: 0,
    paid: 1,
    processing: 2,
    shipped: 3,
    delivered: 4,
    cancelled: -1,
    refunded: -1,
  };
  return mapping[status] ?? 0;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setOrderId(id));
  }, [params]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/account/orders");
      return;
    }
    if (authStatus !== "authenticated" || !orderId) return;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (res.status === 404) {
          setError("Bestellung nicht gefunden.");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setOrder(data);
      } catch {
        setError("Fehler beim Laden der Bestellung.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authStatus, orderId, router]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error || "Bestellung nicht gefunden."}</p>
        <Link href="/account/orders" className="mt-4 inline-block text-sm text-neutral-600 underline hover:text-black">
          Zurück zu Bestellungen
        </Link>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Link href="/account/orders" className="mb-4 inline-flex items-center text-xs text-neutral-500 hover:text-black">
          <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Bestellungen
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Bestellung {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{formatDate(order.createdAt)}</p>
          </div>
          {getStatusBadge(order.status)}
        </div>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isCompleted
                          ? "bg-black text-white"
                          : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {isCompleted && !isCurrent ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`mt-1.5 text-xs ${isCompleted ? "font-medium text-neutral-900" : "text-neutral-500"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`mx-2 h-px flex-1 ${i < currentStep ? "bg-black" : "bg-neutral-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tracking */}
      {order.trackingNumber && (
        <div className="mb-8 rounded-xl border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Sendungsverfolgung</h2>
          <div className="mt-2 flex items-center gap-3">
            <p className="font-mono text-sm text-neutral-700">{order.trackingNumber}</p>
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-neutral-900 underline hover:text-black"
              >
                Bei DHL verfolgen
              </a>
            ) : (
              <a
                href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${order.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-neutral-900 underline hover:text-black"
              >
                Bei DHL verfolgen
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Items */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-neutral-200 p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Artikel</h2>
            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                    {item.variantName && (
                      <p className="text-xs text-neutral-500">{item.variantName}</p>
                    )}
                    {item.sku && (
                      <p className="text-xs text-neutral-400">SKU: {item.sku}</p>
                    )}
                    <p className="text-xs text-neutral-500">
                      {item.quantity} &times; {formatPrice(item.unitPrice)}
                    </p>
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
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">davon MwSt.</span>
                <span className="text-neutral-900">{formatPrice(order.taxAmount)}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-between border-t border-neutral-900 pt-3">
              <span className="font-semibold text-neutral-900">Gesamt</span>
              <span className="font-semibold text-neutral-900">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        {order.shippingAddress && (
          <div className="rounded-xl border border-neutral-200 p-5">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Lieferadresse</h2>
            <div className="text-sm text-neutral-600">
              <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
              {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
              <p>{order.shippingAddress.street} {order.shippingAddress.streetNumber}</p>
              {order.shippingAddress.addressExtra && <p>{order.shippingAddress.addressExtra}</p>}
              <p>{order.shippingAddress.zip} {order.shippingAddress.city}</p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>
        )}

        {/* Billing Address */}
        {order.billingAddress && (
          <div className="rounded-xl border border-neutral-200 p-5">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Rechnungsadresse</h2>
            <div className="text-sm text-neutral-600">
              <p>{order.billingAddress.firstName} {order.billingAddress.lastName}</p>
              {order.billingAddress.company && <p>{order.billingAddress.company}</p>}
              <p>{order.billingAddress.street} {order.billingAddress.streetNumber}</p>
              {order.billingAddress.addressExtra && <p>{order.billingAddress.addressExtra}</p>}
              <p>{order.billingAddress.zip} {order.billingAddress.city}</p>
              <p>{order.billingAddress.country}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
