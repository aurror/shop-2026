"use client";

import { useState, useEffect } from "react";

interface Product {
  id: string;
  name: string;
  slug: string;
  images?: string[];
  basePrice: string;
  compareAtPrice?: string;
  featured: boolean;
  categoryId?: string;
}

interface Relation {
  id: string;
  relatedProductId: string;
  relationType: string;
  sortOrder: number;
  name: string;
  images?: string[];
  basePrice: string;
}

const RELATION_TYPES = [
  { value: "related", label: "Ähnliche Produkte" },
  { value: "accessory", label: "Zubehör" },
  { value: "bundle", label: "Bundle" },
];

export default function RecommendedPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);
  const [relLoading, setRelLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [relationType, setRelationType] = useState("related");
  const [saving, setSaving] = useState(false);
  const [autoMode, setAutoMode] = useState<"manual" | "hot" | "sale" | "featured">("manual");

  useEffect(() => {
    fetch("/api/admin/products?limit=200")
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); });
  }, []);

  async function selectProduct(p: Product) {
    setSelectedProduct(p);
    setRelLoading(true);
    const res = await fetch(`/api/admin/recommended?productId=${p.id}`);
    const data = await res.json();
    setRelations(data.relations || []);
    setRelLoading(false);
  }

  async function addRelation(relatedProductId: string) {
    if (!selectedProduct) return;
    setSaving(true);
    await fetch("/api/admin/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selectedProduct.id, relatedProductId, relationType }),
    });
    const res = await fetch(`/api/admin/recommended?productId=${selectedProduct.id}`);
    const data = await res.json();
    setRelations(data.relations || []);
    setSaving(false);
  }

  async function removeRelation(id: string) {
    await fetch("/api/admin/recommended", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRelations(r => r.filter(rel => rel.id !== id));
  }

  async function applyAutoMode(mode: string) {
    if (!selectedProduct) return;
    setSaving(true);

    let autoProducts: Product[] = [];
    if (mode === "hot") {
      // Most viewed / bestsellers — use featured as proxy
      autoProducts = products.filter(p => p.featured && p.id !== selectedProduct.id).slice(0, 6);
    } else if (mode === "sale") {
      autoProducts = products.filter(p => p.compareAtPrice && p.id !== selectedProduct.id).slice(0, 6);
    } else if (mode === "featured") {
      autoProducts = products.filter(p => p.featured && p.id !== selectedProduct.id).slice(0, 6);
    }

    for (const ap of autoProducts) {
      if (!relations.find(r => r.relatedProductId === ap.id)) {
        await fetch("/api/admin/recommended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: selectedProduct.id, relatedProductId: ap.id, relationType }),
        });
      }
    }

    const res = await fetch(`/api/admin/recommended?productId=${selectedProduct.id}`);
    const data = await res.json();
    setRelations(data.relations || []);
    setSaving(false);
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const alreadyLinkedIds = new Set(relations.map(r => r.relatedProductId));

  const addCandidates = products.filter(p =>
    p.id !== selectedProduct?.id &&
    !alreadyLinkedIds.has(p.id) &&
    (!addSearch || p.name.toLowerCase().includes(addSearch.toLowerCase()))
  );

  const onSale = products.filter(p => p.compareAtPrice).length;
  const featured = products.filter(p => p.featured).length;

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Empfohlene Produkte</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Konfiguriere welche Produkte als „Passende Produkte" bei einem Artikel angezeigt werden
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Product selector */}
          <div className="space-y-3">
            <div>
              <input
                className="admin-input w-full"
                placeholder="Produkt suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loading ? (
              <p className="text-sm text-neutral-400">Lade…</p>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      selectedProduct?.id === p.id
                        ? "bg-black text-white"
                        : "hover:bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="h-10 w-10 flex-shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 rounded-md bg-neutral-200" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${selectedProduct?.id === p.id ? "text-white" : "text-neutral-900"}`}>
                        {p.name}
                      </p>
                      <p className={`text-[10px] ${selectedProduct?.id === p.id ? "text-white/60" : "text-neutral-400"}`}>
                        {parseFloat(p.basePrice).toFixed(2)} €
                        {p.featured && " · ⭐"}
                        {p.compareAtPrice && " · Sale"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Relations config */}
          {selectedProduct ? (
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center gap-4">
                {selectedProduct.images?.[0] && (
                  <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="h-14 w-20 rounded-lg object-cover border border-neutral-200" />
                )}
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{selectedProduct.name}</h2>
                  <p className="text-sm text-neutral-500">Empfehlungen konfigurieren</p>
                </div>
              </div>

              {/* Auto-add modes */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Automatisch hinzufügen</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyAutoMode("featured")}
                    disabled={saving || featured === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Featured ({featured})
                  </button>
                  <button
                    onClick={() => applyAutoMode("sale")}
                    disabled={saving || onSale === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" /></svg>
                    Im Sale ({onSale})
                  </button>
                  <button
                    onClick={() => applyAutoMode("hot")}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /></svg>
                    Beliebt / Hot
                  </button>
                </div>
              </div>

              {/* Relation type selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">Beziehungstyp für neue Einträge</label>
                <div className="flex gap-2">
                  {RELATION_TYPES.map(rt => (
                    <button
                      key={rt.value}
                      onClick={() => setRelationType(rt.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        relationType === rt.value
                          ? "bg-black text-white"
                          : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current relations */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
                  Aktuelle Empfehlungen ({relations.length})
                </p>
                {relLoading ? (
                  <p className="text-sm text-neutral-400">Lade…</p>
                ) : relations.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
                    Noch keine Empfehlungen konfiguriert
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relations.map(rel => (
                      <div key={rel.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                        {rel.images?.[0] ? (
                          <img src={rel.images[0]} alt={rel.name} className="h-12 w-16 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-12 w-16 flex-shrink-0 rounded bg-neutral-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-900 truncate">{rel.name}</p>
                          <p className="text-xs text-neutral-400">
                            {RELATION_TYPES.find(r => r.value === rel.relationType)?.label || rel.relationType}
                            {" · "}{parseFloat(rel.basePrice).toFixed(2)} €
                          </p>
                        </div>
                        <button
                          onClick={() => removeRelation(rel.id)}
                          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-500 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add manually */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Manuell hinzufügen</p>
                <input
                  className="admin-input w-full mb-3"
                  placeholder="Produkt suchen…"
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                />
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {addCandidates.slice(0, 30).map(p => (
                    <button
                      key={p.id}
                      onClick={() => addRelation(p.id)}
                      disabled={saving}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-100 transition-colors disabled:opacity-50"
                    >
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-8 w-10 flex-shrink-0 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-10 flex-shrink-0 rounded bg-neutral-200" />
                      )}
                      <span className="min-w-0 flex-1 text-xs font-medium text-neutral-900 truncate">{p.name}</span>
                      <svg className="h-4 w-4 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                  ))}
                  {addCandidates.length === 0 && (
                    <p className="text-xs text-neutral-400 py-2 text-center">Keine weiteren Produkte verfügbar</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 p-16">
              <div className="text-center">
                <svg className="mx-auto h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <p className="mt-3 text-sm font-medium text-neutral-500">Produkt auswählen</p>
                <p className="mt-1 text-xs text-neutral-400">Wähle links ein Produkt aus um dessen Empfehlungen zu konfigurieren</p>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
