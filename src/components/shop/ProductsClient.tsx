"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/shop/ProductCard";

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice: string | null;
  images: string[];
  featured: boolean;
  category: { id: string; name: string; slug: string } | null;
  variants: { id: string; price: string | null; stock: number }[];
  minPrice: number;
  totalStock: number;
}

interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const SORT_OPTIONS = [
  { value: "newest", label: "Neueste" },
  { value: "price_asc", label: "Preis aufsteigend" },
  { value: "price_desc", label: "Preis absteigend" },
  { value: "name_asc", label: "Name" },
] as const;

export function ProductsClient({
  initialCategory,
  initialSearch,
  initialSort,
  initialPage,
}: {
  initialCategory: string;
  initialSearch: string;
  initialSort: string;
  initialPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: 24,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState(initialSort || "newest");
  const [search, setSearch] = useState(initialSearch || "");
  const [searchInput, setSearchInput] = useState(initialSearch || "");

  const category = searchParams.get("category") || initialCategory;
  const featured = searchParams.get("featured") || "";
  const page = parseInt(searchParams.get("page") || String(initialPage)) || 1;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("sort", sort);
      if (category) params.set("category", category);
      if (search) params.set("search", search);
      if (featured) params.set("featured", featured);

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data: ProductsResponse = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, [page, sort, category, search, featured]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function updateUrl(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
    }
    // Reset to page 1 when changing filters
    if (!params.page) {
      sp.delete("page");
    }
    router.push(`/products?${sp.toString()}`);
  }

  function handleSort(newSort: string) {
    setSort(newSort);
    updateUrl({ sort: newSort, page: "" });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    updateUrl({ search: searchInput, page: "" });
  }

  function handlePageChange(newPage: number) {
    updateUrl({ page: String(newPage) });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          {category ? `Kategorie` : search ? `Ergebnisse für "${search}"` : "Alle Produkte"}
        </h1>
        {pagination.total > 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            {pagination.total} {pagination.total === 1 ? "Produkt" : "Produkte"}
          </p>
        )}
      </div>

      {/* Filters bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Produkt suchen..."
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-black placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 sm:w-64"
          />
          <button
            type="submit"
            className="flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Suchen
          </button>
        </form>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-xs text-neutral-500">
            Sortierung:
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => handleSort(e.target.value)}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 pr-8 text-sm text-black outline-none transition-colors focus:border-neutral-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filters */}
      {(search || category || featured) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                updateUrl({ search: "", page: "" });
              }}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Suche: {search}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {category && (
            <button
              type="button"
              onClick={() => updateUrl({ category: "", page: "" })}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Kategorie: {category}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {featured && (
            <button
              type="button"
              onClick={() => updateUrl({ featured: "", page: "" })}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Empfohlen
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-xl bg-neutral-100" />
              <div className="mt-4 space-y-2 px-1">
                <div className="h-4 w-3/4 rounded bg-neutral-100" />
                <div className="h-4 w-1/4 rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center">
          <svg
            className="mx-auto h-12 w-12 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <h2 className="mt-4 text-base font-semibold text-black">
            Keine Produkte gefunden
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Versuchen Sie einen anderen Suchbegriff oder entfernen Sie Filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Zurück
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (pagination.totalPages <= 7) return true;
                if (p === 1 || p === pagination.totalPages) return true;
                if (Math.abs(p - page) <= 1) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push("ellipsis");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-2 py-2 text-sm text-neutral-400">
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p as number)}
                    className={`min-w-[36px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-black text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
          </div>

          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Weiter
            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
