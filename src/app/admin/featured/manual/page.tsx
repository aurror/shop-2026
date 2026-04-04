"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  slug: string;
  images?: string[];
  basePrice: string;
  compareAtPrice?: string;
  featured: boolean;
}

export default function ManualFeaturedPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "featured" | "unfeatured">("all");

  useEffect(() => {
    fetch("/api/admin/products?limit=200")
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); });
  }, []);

  async function toggleFeatured(product: Product) {
    setSaving(product.id);
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !product.featured }),
    });
    setProducts(ps => ps.map(p => p.id === product.id ? { ...p, featured: !p.featured } : p));
    setSaving(null);
  }

  const filtered = products.filter(p => {
    if (filter === "featured" && !p.featured) return false;
    if (filter === "unfeatured" && p.featured) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const featuredCount = products.filter(p => p.featured).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/featured" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Manuell ausgewählte Produkte</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            <span className="font-medium text-neutral-900">{featuredCount}</span> Produkte werden in der Regel „Manuell ausgewählte Produkte" angezeigt
          </p>
        </div>
      </div>

      {/* Featured grid */}
      {featuredCount > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-4">Aktuell markiert ({featuredCount})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {products.filter(p => p.featured).map(p => (
              <div key={p.id} className="relative group rounded-xl border border-neutral-200 overflow-hidden">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="h-24 w-full object-cover" />
                  : <div className="h-24 bg-neutral-100" />
                }
                <div className="p-2">
                  <p className="text-xs font-medium text-neutral-900 line-clamp-2">{p.name}</p>
                </div>
                <button
                  onClick={() => toggleFeatured(p)}
                  disabled={saving === p.id}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow">Entfernen</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All products */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-3 border-b border-neutral-100 p-4">
          <input className="admin-input flex-1" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-1">
            {(["all", "featured", "unfeatured"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
                {f === "all" ? "Alle" : f === "featured" ? "⭐ Markiert" : "Nicht markiert"}
              </button>
            ))}
          </div>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-neutral-400">Lade…</div> : (
          <div className="divide-y divide-neutral-100">
            {filtered.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="h-14 w-20 flex-shrink-0 rounded-lg object-cover border border-neutral-200" />
                  : <div className="h-14 w-20 flex-shrink-0 rounded-lg bg-neutral-100" />
                }
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                  <p className="text-xs text-neutral-400">{parseFloat(p.basePrice).toFixed(2)} €</p>
                </div>
                <button onClick={() => toggleFeatured(p)} disabled={saving === p.id}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    p.featured ? "bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                  }`}>
                  {p.featured ? "⭐ Markiert" : "+ Markieren"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
