"use client";

import { useState, useEffect, useCallback } from "react";
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

interface ReturnRequest {
  id: string;
  reason: string;
  reasonDetail: string | null;
  status: string;
  action: string | null;
  items: { productName: string; variantName?: string; quantity: number }[];
  createdAt: string;
}

const RETURN_REASONS = [
  { value: "damaged", label: "Beschädigt" },
  { value: "wrong_item", label: "Falscher Artikel" },
  { value: "other", label: "Anderes" },
];

const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Angefragt",
  approved: "Genehmigt",
  received: "Erhalten",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
};

const RETURN_STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  requested: "warning",
  approved: "info",
  received: "info",
  completed: "success",
  rejected: "danger",
};

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

  // Return request state
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("damaged");
  const [returnDetail, setReturnDetail] = useState("");
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);

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

  // Fetch existing returns for this order
  const fetchReturns = useCallback(async () => {
    try {
      const res = await fetch("/api/returns");
      if (res.ok) {
        const data = await res.json();
        setReturns((data.returns || []).filter((r: ReturnRequest) => order && data.returns.length > 0));
      }
    } catch { /* ignore */ }
  }, [order]);

  useEffect(() => {
    if (!orderId || !order) return;
    (async () => {
      try {
        const res = await fetch("/api/returns");
        if (res.ok) {
          const data = await res.json();
          const orderReturns = (data.returns || []).filter(
            (r: any) => r.orderId === orderId
          );
          setReturns(orderReturns);
        }
      } catch { /* ignore */ }
    })();
  }, [orderId, order]);

  const handleSubmitReturn = async () => {
    if (!order || !orderId) return;
    const items = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = order.items.find((i) => i.id === itemId);
        return {
          productName: item?.productName || "",
          variantName: item?.variantName || undefined,
          quantity: qty,
        };
      });

    if (items.length === 0) return;

    setSubmittingReturn(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: returnReason,
          reasonDetail: returnDetail || undefined,
          items,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReturns((prev) => [data.return, ...prev]);
        setShowReturnForm(false);
        setReturnReason("damaged");
        setReturnDetail("");
        setReturnItems({});
      }
    } catch { /* ignore */ }
    finally {
      setSubmittingReturn(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!orderId) return;
    window.open(`/api/account/orders/${orderId}/invoice`, "_blank");
  };

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

      {/* Actions: Invoice + Return */}
      <div className="mt-8 flex flex-wrap gap-3">
        {(order.status === "paid" || order.status === "processing" || order.status === "shipped" || order.status === "delivered") && (
          <Button variant="secondary" size="sm" onClick={handleDownloadInvoice}>
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Rechnung herunterladen
          </Button>
        )}
        {(order.status === "delivered" || order.status === "shipped") && (
          <Button variant="secondary" size="sm" onClick={() => setShowReturnForm(true)}>
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Retoure anfordern
          </Button>
        )}
      </div>

      {/* Existing Returns */}
      {returns.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Retouren</h2>
          <div className="space-y-3">
            {returns.map((ret) => (
              <div key={ret.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {RETURN_REASONS.find((r) => r.value === ret.reason)?.label || ret.reason}
                      </span>
                      <Badge variant={RETURN_STATUS_VARIANT[ret.status] || "default"}>
                        {RETURN_STATUS_LABELS[ret.status] || ret.status}
                      </Badge>
                    </div>
                    {ret.reasonDetail && (
                      <p className="mt-1 text-xs text-neutral-500">{ret.reasonDetail}</p>
                    )}
                    <div className="mt-2 text-xs text-neutral-500">
                      {ret.items.map((item, i) => (
                        <span key={i}>
                          {item.quantity}× {item.productName}
                          {item.variantName ? ` (${item.variantName})` : ""}
                          {i < ret.items.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400">{formatDate(ret.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return Request Form */}
      {showReturnForm && (
        <div className="mt-8 rounded-xl border border-neutral-200 p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Retoure anfordern</h2>
          
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-neutral-700">Grund</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            >
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-neutral-700">Beschreibung (optional)</label>
            <textarea
              value={returnDetail}
              onChange={(e) => setReturnDetail(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
              placeholder="Bitte beschreiben Sie den Grund für die Retoure..."
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-neutral-700">Artikel auswählen</label>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3">
                  <div>
                    <p className="text-sm text-neutral-900">{item.productName}</p>
                    {item.variantName && <p className="text-xs text-neutral-500">{item.variantName}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-neutral-500">Anzahl:</label>
                    <select
                      value={returnItems[item.id] || 0}
                      onChange={(e) => setReturnItems((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                      className="rounded border border-neutral-300 px-2 py-1 text-sm"
                    >
                      {Array.from({ length: item.quantity + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitReturn}
              disabled={submittingReturn || Object.values(returnItems).every((v) => v === 0)}
            >
              {submittingReturn ? "Wird gesendet..." : "Retoure einreichen"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowReturnForm(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
