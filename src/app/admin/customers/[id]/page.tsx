"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
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
};

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/admin/customers/${id}`);
        if (res.ok) {
          const data = await res.json();
          setCustomer(data.customer);
        } else {
          addToast("error", "Kunde nicht gefunden");
          router.push("/admin/customers");
        }
      } catch {
        addToast("error", "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    fetchCustomer();
  }, [id, router, addToast]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/customers"
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {customer.name || "Unbekannt"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{customer.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer info */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("customer")}</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-neutral-500">{t("name")}</p>
              <p className="text-sm font-medium">{customer.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("email")}</p>
              <p className="text-sm font-medium">{customer.email}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("phone")}</p>
              <p className="text-sm font-medium">{customer.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("registeredAt")}</p>
              <p className="text-sm font-medium">{formatDate(customer.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Adressen</h2>
          {(!customer.addresses || customer.addresses.length === 0) ? (
            <p className="text-sm text-neutral-400">Keine Adressen gespeichert</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {customer.addresses.map((addr: any) => (
                <div key={addr.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <p className="mb-1 text-xs font-medium text-neutral-500">
                    {addr.label || "Adresse"} {addr.isDefault && <Badge variant="info">Standard</Badge>}
                  </p>
                  <p className="font-medium">{addr.firstName} {addr.lastName}</p>
                  {addr.company && <p className="text-neutral-600">{addr.company}</p>}
                  <p className="text-neutral-600">{addr.street} {addr.streetNumber}</p>
                  {addr.addressExtra && <p className="text-neutral-600">{addr.addressExtra}</p>}
                  <p className="text-neutral-600">{addr.zip} {addr.city}</p>
                  <p className="text-neutral-600">{addr.country}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order history */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">{t("orders")} ({customer.orders?.length || 0})</h2>
        </div>
        {(!customer.orders || customer.orders.length === 0) ? (
          <p className="px-6 py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{t("orderNumber")}</th>
                  <th>{t("date")}</th>
                  <th>{t("status")}</th>
                  <th className="text-right">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order: any) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                  >
                    <td className="font-mono text-xs font-medium">{order.orderNumber}</td>
                    <td className="text-sm text-neutral-500">{formatDate(order.createdAt)}</td>
                    <td>
                      <Badge variant={statusVariant[order.status] || "default"}>
                        {t(order.status as any)}
                      </Badge>
                    </td>
                    <td className="text-right text-sm font-medium">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
