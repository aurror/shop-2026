"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

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

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(value));
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

const statusOptions = [
  { value: "", label: "Alle Status" },
  { value: "pending", label: "Ausstehend" },
  { value: "awaiting_payment", label: "Warte auf Zahlung" },
  { value: "paid", label: "Bezahlt" },
  { value: "processing", label: "In Bearbeitung" },
  { value: "shipped", label: "Versendet" },
  { value: "delivered", label: "Zugestellt" },
  { value: "cancelled", label: "Storniert" },
  { value: "refunded", label: "Erstattet" },
];

const paymentLabels: Record<string, string> = {
  stripe: "Kreditkarte",
  klarna: "Klarna",
  bank_transfer: "Banküberweisung",
};

export default function AdminOrdersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("orders")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pagination.total} {t("items")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t("search")}
              placeholder={`${t("orderNumber")}, ${t("email")}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              label={t("status")}
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label={t("validFrom")}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label={t("validUntil")}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            {t("filter")}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title={t("noResults")} description="Keine Bestellungen gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{t("orderNumber")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("date")}</th>
                  <th>{t("status")}</th>
                  <th>{t("paymentMethod")}</th>
                  <th className="text-right">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                  >
                    <td className="font-mono text-xs font-medium">{order.orderNumber}</td>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {order.customer?.name || "-"}
                        </p>
                        <p className="text-xs text-neutral-500">{order.customerEmail}</p>
                      </div>
                    </td>
                    <td className="text-xs text-neutral-500">{formatDate(order.createdAt)}</td>
                    <td>
                      <Badge variant={statusVariant[order.status] || "default"}>
                        {t(order.status as any)}
                      </Badge>
                    </td>
                    <td className="text-sm text-neutral-600">
                      {paymentLabels[order.paymentMethod] || order.paymentMethod}
                    </td>
                    <td className="text-right text-sm font-medium">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchOrders(page)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
