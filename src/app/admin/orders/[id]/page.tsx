"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Textarea } from "@/components/shared/Textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  pending: "warning",
  awaiting_payment: "warning",
  paid: "success",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  refunded: "default",
  failed: "danger",
};

const statusOptions = [
  { value: "pending", label: "Ausstehend" },
  { value: "awaiting_payment", label: "Warte auf Zahlung" },
  { value: "paid", label: "Bezahlt" },
  { value: "processing", label: "In Bearbeitung" },
  { value: "shipped", label: "Versendet" },
  { value: "delivered", label: "Zugestellt" },
  { value: "cancelled", label: "Storniert" },
  { value: "refunded", label: "Erstattet" },
];

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function AddressBlock({ address, title }: { address: any; title: string }) {
  if (!address) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">{title}</h3>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p className="font-medium">{address.firstName} {address.lastName}</p>
        {address.company && <p className="text-neutral-600">{address.company}</p>}
        <p className="text-neutral-600">{address.street} {address.streetNumber}</p>
        {address.addressExtra && <p className="text-neutral-600">{address.addressExtra}</p>}
        <p className="text-neutral-600">{address.zip} {address.city}</p>
        <p className="text-neutral-600">{address.country}</p>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [statusValue, setStatusValue] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
          setStatusValue(data.order.status);
          setTrackingNumber(data.order.trackingNumber || "");
          setNotes(data.order.notes || "");
        } else {
          addToast("error", "Bestellung nicht gefunden");
          router.push("/admin/orders");
        }
      } catch {
        addToast("error", "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id, router, addToast]);

  const updateOrder = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setOrder((prev: any) => ({ ...prev, ...data.order }));
        addToast("success", t("saved"));
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler");
      }
    } catch {
      addToast("error", "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/orders"
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {t("orderNumber")} {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{formatDate(order.createdAt)}</p>
        </div>
        <Badge variant={statusVariant[order.status] || "default"}>
          {t(order.status as any)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("customer")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-neutral-500">{t("name")}</p>
                <p className="text-sm font-medium">{order.customer?.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">{t("email")}</p>
                <p className="text-sm font-medium">{order.customerEmail}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">{t("phone")}</p>
                <p className="text-sm font-medium">{order.customerPhone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">{t("paymentMethod")}</p>
                <p className="text-sm font-medium">
                  {order.paymentMethod === "stripe" ? "Kreditkarte" :
                   order.paymentMethod === "klarna" ? "Klarna" :
                   order.paymentMethod === "bank_transfer" ? "Banküberweisung" : order.paymentMethod}
                </p>
              </div>
            </div>
          </div>

          {/* Order items */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("products")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-table w-full">
                <thead>
                  <tr>
                    <th>{t("productName")}</th>
                    <th>{t("sku")}</th>
                    <th className="text-right">Menge</th>
                    <th className="text-right">{t("price")}</th>
                    <th className="text-right">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <p className="text-sm font-medium">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-xs text-neutral-500">{item.variantName}</p>
                        )}
                      </td>
                      <td className="font-mono text-xs">{item.sku || "-"}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price summary */}
            <div className="border-t border-neutral-200 px-6 py-4">
              <div className="ml-auto max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Zwischensumme</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {parseFloat(order.discountAmount || "0") > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Rabatt</span>
                    <span className="text-red-600">-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Versand</span>
                  <span>{formatCurrency(order.shippingCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">MwSt.</span>
                  <span>{formatCurrency(order.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
                  <span>{t("total")}</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <AddressBlock address={order.shippingAddress} title={t("shippingAddress")} />
            <AddressBlock address={order.billingAddress} title="Rechnungsadresse" />
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6">
          {/* Status update */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">{t("actions")}</h3>
            <div className="space-y-4">
              <Select
                label={t("status")}
                options={statusOptions}
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                loading={saving}
                onClick={() => updateOrder({ status: statusValue })}
              >
                Status aktualisieren
              </Button>
            </div>
          </div>

          {/* Tracking */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">{t("trackingNumber")}</h3>
            <div className="space-y-3">
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="z.B. 00340434161094012345"
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                loading={saving}
                onClick={() => updateOrder({ trackingNumber })}
              >
                {t("save")}
              </Button>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
                >
                  DHL Tracking &rarr;
                </a>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                loading={saving}
                onClick={() => updateOrder({ paymentStatus: "paid" })}
                disabled={order.paymentStatus === "paid"}
              >
                {t("markAsPaid")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                loading={saving}
                onClick={() => {
                  if (confirm("Bestellung wirklich stornieren?")) {
                    updateOrder({ status: "cancelled" });
                  }
                }}
                disabled={order.status === "cancelled"}
              >
                {t("cancelOrder")}
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Notizen</h3>
            <div className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Interne Notizen..."
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                loading={saving}
                onClick={() => updateOrder({ notes })}
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
