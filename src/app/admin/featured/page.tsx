"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Rule {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  sortOrder: number;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
}

const RULE_TYPES = [
  { value: "manual", label: "Manuell ausgewählte Produkte", icon: "⭐", desc: "Zeigt Produkte, die du als Featured markiert hast." },
  { value: "most_bought", label: "Bestseller", icon: "🏆", desc: "Zeigt die am häufigsten gekauften Produkte." },
  { value: "on_sale", label: "Aktuelle Angebote", icon: "🏷️", desc: "Zeigt Produkte mit einem Vergleichspreis (Sale)." },
  { value: "newest", label: "Neuheiten", icon: "🆕", desc: "Zeigt die zuletzt hinzugefügten Produkte." },
  { value: "category", label: "Kategorie", icon: "📁", desc: "Zeigt Produkte aus einer bestimmten Kategorie." },
  { value: "low_stock", label: "Letzte Exemplare", icon: "⚡", desc: "Zeigt Produkte mit niedrigem Lagerbestand (Dringlichkeit erzeugen)." },
  { value: "remaining", label: "Alle weiteren Produkte", icon: "📦", desc: "Zeigt alle Produkte, die von keiner anderen aktiven Regel erfasst wurden. Ideal als letzte Regel." },
  { value: "custom_3dprint", label: "Individueller 3D-Druck", icon: "🖨️", desc: "Zeigt den Maßanfertigungs-Abschnitt mit Bild und Link zur Anfrage-Seite." },
  { value: "categories_showcase", label: "Kategorien-Übersicht", icon: "🗂️", desc: "Zeigt alle Shop-Kategorien als Kachelraster." },
];

export default function FeaturedPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [form, setForm] = useState({ type: "manual", label: "", limit: "8", categoryId: "", threshold: "5" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [rRes, cRes] = await Promise.all([
      fetch("/api/admin/homepage-rules"),
      fetch("/api/admin/categories"),
    ]);
    const rData = await rRes.json();
    const cData = await cRes.json();
    setRules(rData.rules || []);
    setCategories(cData.categories || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditRule(null);
    setForm({ type: "manual", label: RULE_TYPES[0].label, limit: "8", categoryId: "", threshold: "5" });
    setShowAdd(true);
  }

  function openEdit(rule: Rule) {
    setEditRule(rule);
    setForm({
      type: rule.type,
      label: rule.label,
      limit: String((rule.config.limit as number) || 8),
      categoryId: (rule.config.categoryId as string) || "",
      threshold: String((rule.config.threshold as number) || 5),
    });
    setShowAdd(true);
  }

  async function saveRule() {
    setSaving(true);
    const config: Record<string, unknown> = { limit: parseInt(form.limit) || 8 };
    if (form.type === "category") config.categoryId = form.categoryId;
    if (form.type === "low_stock") config.threshold = parseInt(form.threshold) || 5;

    if (editRule) {
      await fetch(`/api/admin/homepage-rules/${editRule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: form.label, config }),
      });
    } else {
      await fetch("/api/admin/homepage-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, label: form.label, config, sortOrder: rules.length }),
      });
    }
    setSaving(false);
    setShowAdd(false);
    load();
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/admin/homepage-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
  }

  async function deleteRule(id: string) {
    if (!confirm("Regel löschen?")) return;
    await fetch(`/api/admin/homepage-rules/${id}`, { method: "DELETE" });
    setRules(rs => rs.filter(r => r.id !== id));
  }

  async function moveRule(id: string, dir: -1 | 1) {
    const idx = rules.findIndex(r => r.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rules.length) return;
    const reordered = [...rules];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setRules(reordered);
    await Promise.all([
      fetch(`/api/admin/homepage-rules/${reordered[idx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: idx }),
      }),
      fetch(`/api/admin/homepage-rules/${reordered[newIdx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newIdx }),
      }),
    ]);
  }

  const selectedType = RULE_TYPES.find(t => t.value === form.type);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Frontpage Display</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Abschnitte der Startseite — Reihenfolge und Inhalt hier konfigurieren.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/featured/manual" className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            ⭐ Manuell verwalten
          </Link>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Neue Regel
          </button>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-neutral-900">{editRule ? "Regel bearbeiten" : "Neue Regel"}</h2>

            <div className="mt-4 space-y-4">
              {!editRule && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-2">Regeltyp</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RULE_TYPES.map(rt => (
                      <button
                        key={rt.value}
                        onClick={() => setForm(f => ({ ...f, type: rt.value, label: rt.label }))}
                        className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                          form.type === rt.value ? "border-black bg-black text-white" : "border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <span className="text-lg leading-none">{rt.icon}</span>
                        <span className={`text-xs font-medium ${form.type === rt.value ? "text-white" : "text-neutral-900"}`}>{rt.label}</span>
                      </button>
                    ))}
                  </div>
                  {selectedType && (
                    <p className="mt-2 text-xs text-neutral-500">{selectedType.desc}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Abschnittstitel (auf der Startseite)</label>
                <input className="admin-input w-full" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Max. Anzahl Produkte</label>
                <input type="number" min={1} max={20} className="admin-input w-full" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} />
              </div>

              {form.type === "category" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Kategorie</label>
                  <select className="admin-input w-full" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">— auswählen —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {form.type === "low_stock" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Lagerbestand-Schwellenwert (≤ X Stück)</label>
                  <input type="number" min={1} className="admin-input w-full" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={saveRule}
                disabled={saving || !form.label || (form.type === "category" && !form.categoryId)}
                className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <p className="text-sm text-neutral-400">Lade…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 p-12 text-center">
          <p className="text-sm font-medium text-neutral-500">Noch keine Regeln</p>
          <p className="mt-1 text-xs text-neutral-400">Erstelle deine erste Regel um Produkte auf der Startseite anzuzeigen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => {
            const rt = RULE_TYPES.find(t => t.value === rule.type);
            const cat = rule.config.categoryId ? categories.find(c => c.id === rule.config.categoryId) : null;
            return (
              <div
                key={rule.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                  rule.active ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50 opacity-60"
                }`}
              >
                {/* Order controls */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveRule(rule.id, -1)} disabled={i === 0} className="rounded p-0.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-20">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                  </button>
                  <button onClick={() => moveRule(rule.id, 1)} disabled={i === rules.length - 1} className="rounded p-0.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-20">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                </div>

                <span className="text-2xl">{rt?.icon || "📋"}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{rule.label}</p>
                  <p className="text-xs text-neutral-400">
                    {rt?.label}
                    {cat && ` · ${cat.name}`}
                    {rule.config.limit != null && ` · max. ${String(rule.config.limit)} Produkte`}
                    {rule.config.threshold != null && ` · ≤ ${String(rule.config.threshold)} Stück`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      rule.active ? "bg-black" : "bg-neutral-200"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.active ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  <button onClick={() => openEdit(rule)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-500">
        <p className="font-medium text-neutral-700 mb-1">Hinweis</p>
        <p>Regeln werden in der angezeigten Reihenfolge auf der Startseite dargestellt. Jedes Produkt erscheint nur einmal, auch wenn es mehreren Regeln entspricht. Deaktivierte Regeln werden auf der Startseite nicht angezeigt.</p>
      </div>
    </div>
  );
}
