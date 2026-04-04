"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";
import { Modal } from "@/components/shared/Modal";

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getDiscountLabel(type: string, value: string | number): string {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (type === "percentage") return `${v}%`;
  if (type === "fixed") return formatCurrency(v);
  return "Kostenloser Versand";
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function AdminDiscountsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDiscounts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      const res = await fetch(`/api/admin/discounts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.discounts || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch discounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts(1);
  }, [fetchDiscounts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/discounts/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", t("delete") + " erfolgreich");
        setDeleteId(null);
        fetchDiscounts(pagination.page);
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler beim Löschen");
      }
    } catch {
      addToast("error", "Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        setDiscounts((prev) =>
          prev.map((d) => (d.id === id ? { ...d, active: !currentActive } : d))
        );
        addToast("success", !currentActive ? "Rabatt aktiviert" : "Rabatt deaktiviert");
      }
    } catch {
      addToast("error", "Fehler beim Aktualisieren");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("discounts")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pagination.total} {t("items")}
          </p>
        </div>
        <Link href="/admin/discounts/new">
          <Button variant="primary" size="md">
            {t("addDiscount")}
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : discounts.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            description="Keine Rabatte vorhanden."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{t("discountCode")}</th>
                  <th>{t("discountType")}</th>
                  <th>{t("discountValue")}</th>
                  <th>{t("minOrderAmount")}</th>
                  <th>{t("maxUses")}</th>
                  <th>{t("validFrom")}</th>
                  <th>{t("validUntil")}</th>
                  <th>{t("status")}</th>
                  <th className="text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => {
                  const expired = isExpired(discount.expiresAt);
                  return (
                    <tr key={discount.id}>
                      <td>
                        <span className="font-mono text-sm font-semibold text-neutral-900">
                          {discount.code}
                        </span>
                        {discount.description && (
                          <p className="mt-0.5 text-xs text-neutral-500">{discount.description}</p>
                        )}
                      </td>
                      <td className="text-sm text-neutral-600">{t(discount.type as any)}</td>
                      <td className="text-sm font-medium text-neutral-900">
                        {getDiscountLabel(discount.type, discount.value)}
                      </td>
                      <td className="text-sm text-neutral-600">
                        {formatCurrency(discount.minOrderAmount)}
                      </td>
                      <td className="text-sm text-neutral-600">
                        {discount.maxUses !== null ? (
                          <span>
                            {discount.currentUses}/{discount.maxUses}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="text-xs text-neutral-500">{formatDate(discount.startsAt)}</td>
                      <td className="text-xs text-neutral-500">{formatDate(discount.expiresAt)}</td>
                      <td>
                        {expired ? (
                          <Badge variant="danger">Abgelaufen</Badge>
                        ) : discount.active ? (
                          <Badge variant="success">{t("active")}</Badge>
                        ) : (
                          <Badge variant="default">{t("inactive")}</Badge>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(discount.id, discount.active)}
                          >
                            {discount.active ? t("inactive") : t("active")}
                          </Button>
                          <Link href={`/admin/discounts/${discount.id}`}>
                            <Button variant="outline" size="sm">
                              {t("edit")}
                            </Button>
                          </Link>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteId(discount.id)}
                          >
                            {t("delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-center border-t border-neutral-200 px-6 py-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchDiscounts(page)}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Rabatt löschen"
        size="sm"
      >
        <p className="text-sm text-neutral-600">
          Möchten Sie diesen Rabatt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>
            {t("cancel")}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            {t("delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
