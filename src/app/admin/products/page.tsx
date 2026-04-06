"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(parseFloat(value));
}

export default function AdminProductsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const getTotalStock = (product: any): number => {
    return (product.variants || []).reduce(
      (sum: number, v: any) => sum + (v.stock || 0),
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("products")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pagination.total} {t("items")}
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button variant="primary">{t("addProduct")}</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t("search")}
              placeholder={`${t("productName")}, Slug...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            {t("search")}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            description="Keine Produkte gefunden."
            action={
              <Link href="/admin/products/new">
                <Button variant="primary">{t("addProduct")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[700px] w-full">
              <thead>
                <tr>
                  <th className="w-36"></th>
                  <th>{t("productName")}</th>
                  <th>{t("category")}</th>
                  <th className="text-right">{t("price")}</th>
                  <th className="text-right">{t("stock")}</th>
                  <th className="text-right">Verkauft</th>
                  <th className="text-right">Umsatz</th>
                  <th>{t("status")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/products/${product.id}`)}
                  >
                    <td>
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-20 w-32 rounded-lg border border-neutral-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td>
                      <p className="text-sm font-medium text-neutral-900">{product.name}</p>
                      <p className="text-xs text-neutral-500">{product.slug}</p>
                    </td>
                    <td className="text-sm text-neutral-600">{product.categoryName || "-"}</td>
                    <td className="text-right text-sm font-medium">{formatCurrency(product.basePrice)}</td>
                    <td className="text-right">
                      <span className={`text-sm font-medium ${getTotalStock(product) === 0 ? "text-red-600" : getTotalStock(product) <= 5 ? "text-yellow-600" : "text-neutral-900"}`}>
                        {getTotalStock(product)}
                      </span>
                    </td>
                    <td className="text-right text-sm text-neutral-600">
                      {product.totalSold > 0 ? product.totalSold : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="text-right text-sm font-medium text-neutral-900">
                      {product.totalRevenue > 0 ? formatCurrency(String(product.totalRevenue)) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td>
                      <Badge variant={product.active ? "success" : "default"}>
                        {product.active ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td>
                      {product.featured && (
                        <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                    </td>
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
              onPageChange={(page) => fetchProducts(page)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
