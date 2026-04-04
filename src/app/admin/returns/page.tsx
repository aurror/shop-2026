"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { Textarea } from "@/components/shared/Textarea";

// ─── Labels & mappings ──────────────────────────────────────────────────────

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  requested: "warning",
  approved: "info",
  received: "info",
  completed: "success",
  rejected: "danger",
};

const statusLabels: Record<string, string> = {
  requested: "Angefragt",
  approved: "Genehmigt",
  received: "Erhalten",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
};

const actionLabels: Record<string, string> = {
  refunded: "Erstattet",
  replacement_sent: "Ersatz versendet",
  credit_issued: "Gutschrift",
};

const reasonLabels: Record<string, string> = {
  damaged: "Beschädigt",
  wrong_item: "Falscher Artikel",
  other: "Anderes",
};

const statusFilterOptions = [
  { value: "", label: "Alle" },
  { value: "requested", label: "Angefragt" },
  { value: "approved", label: "Genehmigt" },
  { value: "received", label: "Erhalten" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "rejected", label: "Abgelehnt" },
];

const statusEditOptions = [
  { value: "requested", label: "Angefragt" },
  { value: "approved", label: "Genehmigt" },
  { value: "received", label: "Erhalten" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "rejected", label: "Abgelehnt" },
];

const actionOptions = [
  { value: "", label: "— Keine —" },
  { value: "refunded", label: "Erstattet" },
  { value: "replacement_sent", label: "Ersatz versendet" },
  { value: "credit_issued", label: "Gutschrift" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReturnItem {
  productName: string;
  variantName?: string;
  quantity: number;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  reasonDetail: string | null;
  status: string;
  action: string | null;
  adminNotes: string | null;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminReturnsPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail modal state
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editAction, setEditAction] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/returns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch returns:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchReturns(1);
  }, [fetchReturns]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReturns(1);
  };

  const openDetail = (ret: ReturnRequest) => {
    setSelectedReturn(ret);
    setEditStatus(ret.status);
    setEditAction(ret.action || "");
    setEditNotes(ret.adminNotes || "");
  };

  const closeDetail = () => {
    setSelectedReturn(null);
  };

  const handleSave = async () => {
    if (!selectedReturn) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReturn.id,
          status: editStatus,
          action: editAction,
          adminNotes: editNotes,
        }),
      });
      if (res.ok) {
        closeDetail();
        fetchReturns(pagination.page);
      }
    } catch (error) {
      console.error("Failed to update return:", error);
    } finally {
      setSaving(false);
    }
  };

  const itemsSummary = (items: ReturnItem[]) => {
    if (!items || items.length === 0) return "-";
    if (items.length === 1) {
      return `${items[0].quantity}× ${items[0].productName}`;
    }
    return `${items.length} Artikel`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Retouren</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pagination.total} {pagination.total === 1 ? "Retoure" : "Retouren"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Suche"
              placeholder="Bestellnummer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              label="Status"
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Filtern
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : returns.length === 0 ? (
          <EmptyState title="Keine Ergebnisse" description="Keine Retouren gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Bestellnummer</th>
                  <th>Kunde</th>
                  <th>Grund</th>
                  <th>Status</th>
                  <th>Artikel</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr
                    key={ret.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(ret)}
                  >
                    <td className="font-mono text-xs font-medium text-neutral-500">
                      {shortId(ret.id)}
                    </td>
                    <td className="font-mono text-xs font-medium">{ret.orderNumber}</td>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{ret.customerName}</p>
                        <p className="text-xs text-neutral-500">{ret.customerEmail}</p>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-600">
                      {reasonLabels[ret.reason] || ret.reason}
                    </td>
                    <td>
                      <Badge variant={statusVariant[ret.status] || "default"}>
                        {statusLabels[ret.status] || ret.status}
                      </Badge>
                    </td>
                    <td className="text-sm text-neutral-600">{itemsSummary(ret.items)}</td>
                    <td className="text-xs text-neutral-500">{formatDate(ret.createdAt)}</td>
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
              onPageChange={(page) => fetchReturns(page)}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedReturn} onClose={closeDetail} title="Retoure bearbeiten" size="lg">
        {selectedReturn && (
          <div className="space-y-6">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-neutral-500">Retoure-ID</p>
                <p className="mt-0.5 font-mono text-sm">{shortId(selectedReturn.id)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Bestellnummer</p>
                <p className="mt-0.5 font-mono text-sm">{selectedReturn.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Kunde</p>
                <p className="mt-0.5 text-sm font-medium text-neutral-900">
                  {selectedReturn.customerName}
                </p>
                <p className="text-xs text-neutral-500">{selectedReturn.customerEmail}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Erstellt am</p>
                <p className="mt-0.5 text-sm">{formatDate(selectedReturn.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Grund</p>
                <p className="mt-0.5 text-sm">
                  {reasonLabels[selectedReturn.reason] || selectedReturn.reason}
                </p>
              </div>
              {selectedReturn.reasonDetail && (
                <div>
                  <p className="text-xs font-medium text-neutral-500">Details zum Grund</p>
                  <p className="mt-0.5 text-sm">{selectedReturn.reasonDetail}</p>
                </div>
              )}
            </div>

            {/* Items */}
            {selectedReturn.items && selectedReturn.items.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">Artikel</p>
                <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                  {selectedReturn.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-xs text-neutral-500">{item.variantName}</p>
                        )}
                      </div>
                      <span className="text-sm text-neutral-600">{item.quantity}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div className="space-y-4 border-t border-neutral-200 pt-4">
              <Select
                label="Status"
                options={statusEditOptions}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              />
              <Select
                label="Aktion"
                options={actionOptions}
                value={editAction}
                onChange={(e) => setEditAction(e.target.value)}
              />
              <Textarea
                label="Admin-Notizen"
                placeholder="Interne Notizen zur Retoure..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
              <Button variant="secondary" size="md" onClick={closeDetail}>
                Abbrechen
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                {saving ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
