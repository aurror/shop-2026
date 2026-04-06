"use client";

import { useState, useEffect, useRef } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  productCount: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  images?: string[];
  categoryId?: string;
  categoryName?: string;
  sortOrder?: number;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[äöü]/g, c => ({ ä: "ae", ö: "oe", ü: "ue" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", parentId: "" });
  const [saving, setSaving] = useState(false);
  const [dragProduct, setDragProduct] = useState<Product | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      fetch("/api/admin/categories"),
      fetch("/api/admin/products?limit=200"),
    ]);
    const cData = await cRes.json();
    const pData = await pRes.json();
    setCategories(cData.categories || []);
    // Enrich products with category name
    const cats: Category[] = cData.categories || [];
    const prods: Product[] = (pData.products || []).map((p: Product) => ({
      ...p,
      categoryName: cats.find(c => c.id === p.categoryId)?.name,
    }));
    setProducts(prods);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditCat(null);
    setForm({ name: "", slug: "", description: "", parentId: "" });
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || "", parentId: cat.parentId || "" });
    setShowForm(true);
  }

  async function saveCategory() {
    setSaving(true);
    const body = { ...form, parentId: form.parentId || null };
    if (editCat) {
      await fetch(`/api/admin/categories/${editCat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Kategorie löschen? Produkte werden nicht gelöscht, nur aus der Kategorie entfernt.")) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    load();
  }

  async function assignProduct(productId: string, categoryId: string | null) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Remove from old, add to new
    const ops: { add?: string[], remove?: string[] } = {};
    if (product.categoryId) {
      ops.remove = [productId];
      await fetch(`/api/admin/categories/${product.categoryId}/products`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: [productId] }),
      });
    }
    if (categoryId) {
      await fetch(`/api/admin/categories/${categoryId}/products`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: [productId] }),
      });
    }
    load();
  }

  // Drag handlers
  function onDragStart(e: React.DragEvent, product: Product) {
    setDragProduct(product);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, catId: string) {
    e.preventDefault();
    setDragOverCat(catId);
  }

  function onDrop(e: React.DragEvent, catId: string) {
    e.preventDefault();
    if (dragProduct) {
      assignProduct(dragProduct.id, catId);
    }
    setDragProduct(null);
    setDragOverCat(null);
  }

  function onDragEnd() {
    setDragProduct(null);
    setDragOverCat(null);
  }

  async function moveCat(id: string, dir: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(c => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newOrder = sorted.map((c, i) => ({ id: c.id, sortOrder: i }));
    const tmp = newOrder[idx].sortOrder;
    newOrder[idx].sortOrder = newOrder[swapIdx].sortOrder;
    newOrder[swapIdx].sortOrder = tmp;
    await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: newOrder }),
    });
    load();
  }

  async function moveProduct(id: string, idx: number, dir: -1 | 1, arr: Product[]) {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    const newOrder = arr.map((p, i) => ({ id: p.id, sortOrder: i }));
    const tmp = newOrder[idx].sortOrder;
    newOrder[idx].sortOrder = newOrder[swapIdx].sortOrder;
    newOrder[swapIdx].sortOrder = tmp;
    await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: newOrder }),
    });
    load();
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const unassigned = filteredProducts.filter(p => !p.categoryId);
  const inSelectedCat = selectedCat ? filteredProducts.filter(p => p.categoryId === selectedCat) : [];

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Kategorien</h1>
            <p className="mt-1 text-sm text-neutral-500">Kategorien verwalten und Produkte per Drag & Drop zuweisen</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Neue Kategorie
          </button>
        </div>

        {/* Category Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-semibold text-neutral-900">{editCat ? "Kategorie bearbeiten" : "Neue Kategorie"}</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Name</label>
                  <input className="admin-input w-full" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: editCat ? f.slug : slugify(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Slug</label>
                  <input className="admin-input w-full" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Beschreibung</label>
                  <textarea className="admin-input w-full" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Übergeordnete Kategorie</label>
                  <select className="admin-input w-full" value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                    <option value="">— keine —</option>
                    {categories.filter(c => c.id !== editCat?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={saveCategory} disabled={saving || !form.name || !form.slug}
                  className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                  {saving ? "Speichern…" : "Speichern"}
                </button>
                <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Categories list */}
          <div className="space-y-1">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Kategorien</h2>
            {loading ? (
              <p className="text-sm text-neutral-400">Lade…</p>
            ) : categories.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400">
                Noch keine Kategorien
              </div>
            ) : (() => {
              // Build tree: parents first, then children under their parent
              const roots = categories.filter(c => !c.parentId);
              const childrenOf = (parentId: string) => categories.filter(c => c.parentId === parentId);

              const renderCat = (cat: Category, depth = 0) => {
                const isSelected = selectedCat === cat.id;
                const children = childrenOf(cat.id);
                return (
                  <div key={cat.id}>
                    <div
                      style={{ marginLeft: depth * 20 }}
                      onDragOver={e => onDragOver(e, cat.id)}
                      onDrop={e => onDrop(e, cat.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 mb-1 transition-all cursor-pointer ${
                        isSelected
                          ? "border-black bg-black text-white"
                          : dragOverCat === cat.id
                          ? "border-blue-400 bg-blue-50"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                      onClick={() => setSelectedCat(isSelected ? null : cat.id)}
                    >
                      {/* Tree connector */}
                      {depth > 0 && (
                        <svg className={`h-3 w-3 shrink-0 ${isSelected ? "text-white/40" : "text-neutral-300"}`} viewBox="0 0 12 12" fill="none">
                          <path d="M2 0 v6 h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                      {children.length > 0 && depth === 0 && (
                        <svg className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-white/60" : "text-neutral-400"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isSelected ? "text-white" : "text-neutral-900"}`}>{cat.name}</p>
                        <p className={`text-xs truncate ${isSelected ? "text-white/60" : "text-neutral-400"}`}>
                          {cat.productCount} Produkt{cat.productCount !== 1 ? "e" : ""} · /{cat.slug}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => moveCat(cat.id, -1)} className={`rounded p-1 ${isSelected ? "hover:bg-white/20 text-white/70" : "hover:bg-neutral-100 text-neutral-400"}`} title="Nach oben">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                        </button>
                        <button onClick={() => moveCat(cat.id, 1)} className={`rounded p-1 ${isSelected ? "hover:bg-white/20 text-white/70" : "hover:bg-neutral-100 text-neutral-400"}`} title="Nach unten">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                        </button>
                        <button onClick={() => openEdit(cat)} className={`rounded p-1 ${isSelected ? "hover:bg-white/20 text-white" : "hover:bg-neutral-100 text-neutral-500"}`} title="Bearbeiten">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                        </button>
                        <button onClick={() => deleteCategory(cat.id)} className={`rounded p-1 ${isSelected ? "hover:bg-white/20 text-red-300" : "hover:bg-neutral-100 text-red-400"}`} title="Löschen">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                      {dragOverCat === cat.id && (
                        <span className="text-[10px] text-blue-500 font-medium">ablegen</span>
                      )}
                    </div>
                    {children.map(child => renderCat(child, depth + 1))}
                  </div>
                );
              };

              return roots.map(cat => renderCat(cat, 0));
            })()}

            {/* Unassigned drop zone */}
            <div
              onDragOver={e => onDragOver(e, "__none__")}
              onDrop={e => { e.preventDefault(); if (dragProduct) assignProduct(dragProduct.id, null); setDragOverCat(null); }}
              className={`rounded-xl border-2 border-dashed p-4 text-center text-xs transition-all ${
                dragOverCat === "__none__" ? "border-neutral-400 bg-neutral-50 text-neutral-600" : "border-neutral-200 text-neutral-400"
              }`}
            >
              Hierher ziehen um Kategorie zu entfernen
            </div>
          </div>

          {/* Products panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <input
                className="admin-input flex-1"
                placeholder="Produkte suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {selectedCat && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
                  In „{categories.find(c => c.id === selectedCat)?.name}" ({inSelectedCat.length}) — Reihenfolge per ↑↓ ändern
                </h2>
                {inSelectedCat.length === 0 ? (
                  <p className="text-sm text-neutral-400 py-2">Keine Produkte in dieser Kategorie</p>
                ) : (
                  <div className="space-y-1 mb-6">
                    {[...inSelectedCat]
                      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                      .map((p, idx, arr) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveProduct(p.id, idx, -1, arr)}
                              disabled={idx === 0}
                              className="rounded p-0.5 hover:bg-neutral-100 disabled:opacity-30 text-neutral-400"
                              title="Nach oben"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                            </button>
                            <button
                              onClick={() => moveProduct(p.id, idx, 1, arr)}
                              disabled={idx === arr.length - 1}
                              className="rounded p-0.5 hover:bg-neutral-100 disabled:opacity-30 text-neutral-400"
                              title="Nach unten"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                            </button>
                          </div>
                          {p.images?.[0] && (
                            <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate text-neutral-900">{p.name}</p>
                          </div>
                          <button
                            onClick={() => assignProduct(p.id, null)}
                            className="text-xs text-neutral-400 hover:text-red-500 shrink-0"
                          >
                            Entfernen
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
                {selectedCat ? `Alle anderen Produkte` : `Alle Produkte`} — Auf Kategorie ziehen zum Zuweisen
              </h2>
              {loading ? <p className="text-sm text-neutral-400">Lade…</p> : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(selectedCat ? filteredProducts.filter(p => p.categoryId !== selectedCat) : filteredProducts).map(p => (
                    <ProductCard key={p.id} product={p} onDragStart={onDragStart} onDragEnd={onDragEnd}
                      onAssign={selectedCat ? () => assignProduct(p.id, selectedCat) : undefined}
                      onRemove={p.categoryId ? () => assignProduct(p.id, null) : undefined} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}

function ProductCard({ product, onDragStart, onDragEnd, onAssign, onRemove }: {
  product: Product;
  onDragStart: (e: React.DragEvent, p: Product) => void;
  onDragEnd: () => void;
  onAssign?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, product)}
      onDragEnd={onDragEnd}
      className="group relative flex flex-col rounded-lg border border-neutral-200 bg-white overflow-hidden cursor-grab active:cursor-grabbing hover:border-neutral-300 hover:shadow-sm transition-all select-none"
    >
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} className="h-24 w-full object-cover" />
      ) : (
        <div className="h-24 bg-neutral-100 flex items-center justify-center text-neutral-300">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
          </svg>
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-medium text-neutral-900 line-clamp-2">{product.name}</p>
        {product.categoryName && (
          <p className="mt-0.5 text-[10px] text-neutral-400">{product.categoryName}</p>
        )}
      </div>
      {/* Hover actions */}
      <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-white via-white/80 to-transparent pt-4">
        {onAssign && (
          <button onClick={onAssign} className="flex-1 rounded bg-black py-1 text-[10px] font-medium text-white hover:bg-neutral-800">
            Zuweisen
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="flex-1 rounded border border-neutral-200 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-50">
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}
