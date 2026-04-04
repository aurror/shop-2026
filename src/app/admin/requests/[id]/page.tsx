"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";

type Reply = {
  id: string;
  message: string;
  sentBy: string;
  createdAt: string;
};

type ContactRequest = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  fileNames: string[] | null;
  filePaths: string[] | null;
  status: string;
  spamScore: number | null;
  spamReason: string | null;
  adminNotes: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "replied", label: "Beantwortet" },
  { value: "closed", label: "Erledigt" },
  { value: "ignored", label: "Ignoriert" },
  { value: "spam", label: "Spam" },
];

export default function AdminRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [req, setReq] = useState<ContactRequest | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/requests/${id}`);
    if (res.ok) {
      const data = await res.json();
      setReq(data.request);
      setReplies(data.replies || []);
      setNotes(data.request.adminNotes || "");
      setStatus(data.request.status || "new");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const saveNotes = async () => {
    await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes: notes }),
    });
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    const res = await fetch(`/api/admin/requests/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: replyText }),
    });
    if (res.ok) {
      const data = await res.json();
      setReplies((prev) => [data.reply, ...prev]);
      setReplyText("");
      setStatus("replied");
    }
    setSending(false);
  };

  if (loading) {
    return <div className="py-12 text-center text-neutral-400">Laden…</div>;
  }

  if (!req) {
    return <div className="py-12 text-center text-neutral-400">Anfrage nicht gefunden.</div>;
  }

  const isSpammy = req.spamScore != null && req.spamScore >= 50;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/requests" className="text-sm text-neutral-500 hover:text-black">
          ← Zurück zu Anfragen
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spam warning */}
          {isSpammy && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 font-medium text-red-800">
                <span>⚠️</span>
                <span>Spam-Verdacht: {req.spamScore}%</span>
              </div>
              {req.spamReason && (
                <p className="mt-1 text-sm text-red-600">{req.spamReason}</p>
              )}
            </div>
          )}

          {/* Message */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Nachricht</h2>
            <div className="whitespace-pre-wrap text-sm text-neutral-700 leading-relaxed">
              {req.message}
            </div>
          </div>

          {/* Files */}
          {req.fileNames && req.fileNames.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Anhänge</h2>
              <ul className="space-y-2">
                {req.fileNames.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-400">📎</span>
                    <a
                      href={`/api/admin/requests/${req.id}/file?name=${encodeURIComponent(name)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reply */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Antworten</h2>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Antwort schreiben…"
              className="w-full rounded-lg border border-neutral-200 p-3 text-sm focus:border-black focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {sending ? "Senden…" : "Antwort senden"}
              </button>
            </div>

            {/* Reply history */}
            {replies.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-neutral-100 pt-4">
                {replies.map((reply) => (
                  <div key={reply.id} className="rounded-lg bg-neutral-50 p-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>{reply.sentBy}</span>
                      <span>{new Date(reply.createdAt).toLocaleString("de-DE")}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{reply.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact info */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h3 className="mb-3 font-semibold">Kontaktdaten</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Name</dt>
                <dd className="font-medium">{req.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">E-Mail</dt>
                <dd>
                  <a href={`mailto:${req.email}`} className="text-blue-600 hover:underline">{req.email}</a>
                </dd>
              </div>
              {req.phone && (
                <div>
                  <dt className="text-xs text-neutral-500">Telefon</dt>
                  <dd>{req.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-neutral-500">Typ</dt>
                <dd>{req.type === "custom_print" ? "Maßanfertigung" : req.type === "contact" ? "Kontakt" : req.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Eingegangen</dt>
                <dd>{new Date(req.createdAt).toLocaleString("de-DE")}</dd>
              </div>
            </dl>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h3 className="mb-3 font-semibold">Status</h3>
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Admin notes */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h3 className="mb-3 font-semibold">Interne Notizen</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-neutral-200 p-3 text-sm focus:border-black focus:outline-none"
              placeholder="Notizen…"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={saveNotes}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50"
              >
                Speichern
              </button>
            </div>
          </div>

          {/* Error */}
          {req.errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-red-800">Fehler</h3>
              <p className="text-xs text-red-600">{req.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
