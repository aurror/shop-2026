"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ContactRequest = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  fileNames: string[] | null;
  status: string;
  spamScore: number | null;
  spamReason: string | null;
  adminNotes: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "Neu", cls: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Bearbeitung", cls: "bg-yellow-100 text-yellow-800" },
  replied: { label: "Beantwortet", cls: "bg-green-100 text-green-800" },
  closed: { label: "Erledigt", cls: "bg-neutral-200 text-neutral-600" },
  ignored: { label: "Ignoriert", cls: "bg-neutral-100 text-neutral-400" },
  spam: { label: "Spam", cls: "bg-red-100 text-red-800" },
};

const TYPE_LABELS: Record<string, string> = {
  custom_print: "Maßanfertigung",
  contact: "Kontakt",
  general: "Allgemein",
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("limit", String(perPage));

    const res = await fetch(`/api/admin/requests?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [typeFilter, statusFilter, page]);

  const quickUpdate = async (id: string, status: string) => {
    await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Anfragen</h1>
        <span className="text-sm text-neutral-500">{total} Anfragen gesamt</span>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="all">Alle Typen</option>
          <option value="custom_print">Maßanfertigung</option>
          <option value="contact">Kontakt</option>
          <option value="general">Allgemein</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="all">Alle Status</option>
          <option value="new">Neu</option>
          <option value="in_progress">In Bearbeitung</option>
          <option value="replied">Beantwortet</option>
          <option value="closed">Erledigt</option>
          <option value="ignored">Ignoriert</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-neutral-400">Laden…</div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-neutral-400">Keine Anfragen gefunden.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Spam</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Nachricht</th>
                <th className="px-4 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {requests.map((req) => {
                const statusInfo = STATUS_LABELS[req.status] || { label: req.status, cls: "bg-neutral-100 text-neutral-600" };
                const isOpen = req.status === "new" || req.status === "in_progress";
                return (
                  <tr key={req.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isOpen && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Offen" />
                        )}
                        <div>
                          <Link href={`/admin/requests/${req.id}`} className="font-medium text-black hover:underline">
                            {req.name}
                          </Link>
                          <div className="text-xs text-neutral-500">{req.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{TYPE_LABELS[req.type] || req.type}</div>
                      {req.fileNames && req.fileNames.length > 0 && (
                        <div className="mt-0.5 text-neutral-400">📎 {req.fileNames.length}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {req.spamScore != null && req.spamScore >= 50 ? (
                        <span className="text-red-600" title={req.spamReason || ""}>
                          ⚠ {req.spamScore}%
                        </span>
                      ) : req.spamScore != null ? (
                        <span className="text-neutral-400">{req.spamScore}%</span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-neutral-500">
                      {req.message.slice(0, 80)}{req.message.length > 80 ? "…" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {req.status !== "closed" && req.status !== "replied" && (
                          <button
                            onClick={() => quickUpdate(req.id, "closed")}
                            title="Als erledigt markieren"
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            ✓ Erledigt
                          </button>
                        )}
                        {req.status !== "ignored" && (
                          <button
                            onClick={() => quickUpdate(req.id, "ignored")}
                            title="Ignorieren"
                            className="rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
                          >
                            ✕ Ignorieren
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            ←
          </button>
          <span className="text-sm text-neutral-600">
            Seite {page} von {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
