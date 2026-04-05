"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/shared/Toast";
import { Modal } from "@/components/shared/Modal";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  emailVerified: string | null;
  hasPassword: boolean;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-100 text-red-700" },
  staff: { label: "Mitarbeiter", color: "bg-blue-100 text-blue-700" },
  customer: { label: "Kunde", color: "bg-neutral-100 text-neutral-600" },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export default function AdminUsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "admin">("staff");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ tempPassword?: string; action?: string } | null>(null);

  // Edit modal
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Remove confirm
  const [removeUser, setRemoveUser] = useState<AdminUser | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Invite ──────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Fehler beim Einladen");
        return;
      }
      if (data.action === "promoted") {
        addToast("success", "Benutzer wurde befördert.");
        setShowInvite(false);
        fetchUsers();
      } else {
        setInviteResult(data);
        fetchUsers();
      }
    } finally {
      setInviting(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role);
    setEditPassword("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: editName,
        email: editEmail,
        role: editRole,
      };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Fehler beim Speichern");
        return;
      }
      addToast("success", "Gespeichert.");
      setEditUser(null);
      fetchUsers();
    } finally {
      setSaving(false);
    }
  };

  // ── Remove (downgrade) ──────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeUser) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/users/${removeUser.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Fehler");
        return;
      }
      addToast("success", "Zugriff entzogen (zu Kunde degradiert).");
      setRemoveUser(null);
      fetchUsers();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Benutzer & Rollen</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Dashboard-Zugriff verwalten, Benutzer einladen und Passwörter zurücksetzen.
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteEmail(""); setInviteName(""); setInviteRole("staff"); }}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Einladen
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nach Name oder E-Mail suchen…"
        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 sm:w-72"
      />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="py-16 text-center text-sm text-neutral-400">Lädt…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-400">
            Keine Mitarbeiter oder Admins gefunden.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Benutzer</th>
                <th className="px-4 py-3">Rolle</th>
                <th className="px-4 py-3 hidden sm:table-cell">Anmeldung</th>
                <th className="px-4 py-3 hidden sm:table-cell">Erstellt</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{u.name || "—"}</div>
                    <div className="text-xs text-neutral-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_LABELS[u.role]?.color ?? "bg-neutral-100 text-neutral-600"}`}>
                      {ROLE_LABELS[u.role]?.label ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-neutral-500">
                    {u.hasPassword ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                        </svg>
                        Passwort
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">OAuth</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-neutral-400">
                    {u.createdAt ? formatDate(u.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setRemoveUser(u)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Entfernen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showInvite} onClose={() => { setShowInvite(false); setInviteResult(null); }} title="Benutzer einladen">
        {inviteResult ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
              <p className="font-medium">Einladung gesendet!</p>
              {inviteResult.tempPassword && (
                <>
                  <p className="mt-2">Falls die E-Mail nicht ankommt, hier das temporäre Passwort:</p>
                  <code className="mt-1 block rounded bg-green-100 px-2 py-1 font-mono text-xs">{inviteResult.tempPassword}</code>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => { setShowInvite(false); setInviteResult(null); }} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
                Schließen
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">E-Mail <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                placeholder="mitarbeiter@beispiel.de"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Existiert bereits ein Konto mit dieser E-Mail, wird es befördert.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Rolle <span className="text-red-500">*</span></label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "staff" | "admin")}
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="staff">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowInvite(false)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                Abbrechen
              </button>
              <button type="submit" disabled={inviting} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {inviting ? "Einladen…" : "Einladen"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Bearbeiten: ${editUser?.name || editUser?.email}`}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">E-Mail</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Rolle</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            >
              <option value="staff">Mitarbeiter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {editUser?.hasPassword && (
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Neues Passwort</label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leer lassen = nicht ändern"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
              <p className="mt-1 text-xs text-neutral-400">Mindestens 8 Zeichen. Leer lassen, um das Passwort nicht zu ändern.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditUser(null)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Remove Confirm Modal ──────────────────────────────────────────── */}
      <Modal isOpen={!!removeUser} onClose={() => setRemoveUser(null)} title="Zugriff entziehen?">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            <strong>{removeUser?.name || removeUser?.email}</strong> wird auf die Rolle &ldquo;Kunde&rdquo; gesetzt und verliert den Dashboard-Zugriff.
            Bestell- und Kontodaten bleiben erhalten.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRemoveUser(null)} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
              Abbrechen
            </button>
            <button onClick={handleRemove} disabled={removing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
              {removing ? "Entziehe…" : "Zugriff entziehen"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
