"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

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

export default function AdminCustomersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers(1);
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("customers")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {pagination.total} {t("items")}
        </p>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t("search")}
              placeholder={`${t("name")}, ${t("email")}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            {t("search")}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState title={t("noResults")} description="Keine Kunden gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("email")}</th>
                  <th>{t("registeredAt")}</th>
                  <th className="text-right">{t("orderCount")}</th>
                  <th className="text-right">{t("totalSpent")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/customers/${customer.id}`)}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                          {customer.name ? customer.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <span className="text-sm font-medium text-neutral-900">
                          {customer.name || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-600">{customer.email}</td>
                    <td className="text-sm text-neutral-500">{formatDate(customer.createdAt)}</td>
                    <td className="text-right text-sm font-medium">{customer.orderCount}</td>
                    <td className="text-right text-sm font-medium">{formatCurrency(customer.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchCustomers(page)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
