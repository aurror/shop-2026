"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getConfidenceVariant(confidence: string | number | null): "success" | "warning" | "danger" | "default" {
  if (!confidence) return "default";
  const c = typeof confidence === "string" ? parseFloat(confidence) : confidence;
  if (c >= 0.8) return "success";
  if (c >= 0.5) return "warning";
  return "danger";
}

function formatConfidence(confidence: string | number | null): string {
  if (!confidence) return "-";
  const c = typeof confidence === "string" ? parseFloat(confidence) : confidence;
  return `${Math.round(c * 100)}%`;
}

export default function AdminAiSuggestionsPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch products for the selector
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/admin/products?limit=100");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    }
    loadProducts();
  }, []);

  // Fetch suggestions when product is selected
  const fetchSuggestions = useCallback(async (productId: string) => {
    if (!productId) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchSuggestions(selectedProduct);
    }
  }, [selectedProduct, fetchSuggestions]);

  const generateSuggestions = async () => {
    if (!selectedProduct) {
      addToast("error", locale === "en" ? "Please select a product first" : "Bitte zuerst ein Produkt auswählen");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("success", locale === "en" ? "Suggestions generated" : "Vorschläge generiert");
        fetchSuggestions(selectedProduct);
      } else {
        addToast("error", data.error || (locale === "en" ? "Failed to generate suggestions" : "Fehler beim Generieren"));
      }
    } catch {
      addToast("error", locale === "en" ? "Failed to generate suggestions" : "Fehler beim Generieren");
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (suggestionId: string, action: "approve" | "reject") => {
    setActionLoading(suggestionId);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        addToast(
          "success",
          action === "approve"
            ? (locale === "en" ? "Suggestion approved" : "Vorschlag genehmigt")
            : (locale === "en" ? "Suggestion rejected" : "Vorschlag abgelehnt")
        );
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler");
      }
    } catch {
      addToast("error", "Fehler");
    } finally {
      setActionLoading(null);
    }
  };

  const productOptions = [
    { value: "", label: locale === "en" ? "Select a product..." : "Produkt auswählen..." },
    ...products
      .filter((p) =>
        searchQuery
          ? p.name.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
      .map((p) => ({
        value: p.id,
        label: p.name,
      })),
  ];

  const selectedProductData = products.find((p) => p.id === selectedProduct);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("aiSuggestions")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {locale === "en"
            ? "Review AI-generated product relation suggestions"
            : "KI-generierte Produktzuordnungs-Vorschläge prüfen"}
        </p>
      </div>

      {/* Product Selector */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          {locale === "en" ? "Select Product" : "Produkt auswählen"}
        </h2>
        <div className="flex items-end gap-4">
          <div className="min-w-[300px] flex-1">
            <Input
              label={t("search")}
              placeholder={locale === "en" ? "Filter products..." : "Produkte filtern..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[300px] flex-1">
            <Select
              label={t("products")}
              options={productOptions}
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            loading={generating}
            onClick={generateSuggestions}
            disabled={!selectedProduct}
          >
            {t("getAiSuggestions")}
          </Button>
        </div>

        {selectedProductData && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
            {selectedProductData.images?.[0] && (
              <img
                src={selectedProductData.images[0]}
                alt={selectedProductData.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="text-sm font-medium text-neutral-900">{selectedProductData.name}</p>
              <p className="text-xs text-neutral-500">
                {formatCurrency(selectedProductData.basePrice)} &middot;{" "}
                {selectedProductData.variants?.length || 0} {t("variants")}
              </p>
            </div>
            <Link href={`/admin/products/${selectedProduct}`} className="ml-auto">
              <Button variant="ghost" size="sm">{t("editProduct")}</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {t("suggestedRelations")}
            {suggestions.length > 0 && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                ({suggestions.length})
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : !selectedProduct ? (
          <EmptyState
            title={locale === "en" ? "No product selected" : "Kein Produkt ausgewählt"}
            description={
              locale === "en"
                ? "Select a product above to view or generate AI suggestions."
                : "Wählen Sie oben ein Produkt aus, um KI-Vorschläge anzuzeigen oder zu generieren."
            }
          />
        ) : suggestions.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            description={
              locale === "en"
                ? "No pending suggestions for this product. Click 'Get AI Suggestions' to generate new ones."
                : "Keine ausstehenden Vorschläge für dieses Produkt. Klicken Sie auf 'KI-Vorschläge abrufen', um neue zu generieren."
            }
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  {/* Suggested product image */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                    {suggestion.suggestedProduct?.images?.[0] ? (
                      <img
                        src={suggestion.suggestedProduct.images[0]}
                        alt={suggestion.suggestedProduct?.name || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-300">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-neutral-900">
                        {suggestion.suggestedProduct?.name || suggestion.suggestedProductId}
                      </h3>
                      <Badge variant={getConfidenceVariant(suggestion.confidence)}>
                        {t("confidence")}: {formatConfidence(suggestion.confidence)}
                      </Badge>
                      {suggestion.suggestedProduct && !suggestion.suggestedProduct.active && (
                        <Badge variant="danger">{t("inactive")}</Badge>
                      )}
                    </div>
                    {suggestion.suggestedProduct && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatCurrency(suggestion.suggestedProduct.basePrice)}
                      </p>
                    )}
                    {suggestion.reasoning && (
                      <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2">
                        <p className="text-xs font-medium text-neutral-500">{t("reasoning")}:</p>
                        <p className="mt-0.5 text-sm text-neutral-700">{suggestion.reasoning}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-neutral-400">
                      {formatDate(suggestion.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={actionLoading === suggestion.id}
                      onClick={() => handleAction(suggestion.id, "approve")}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={actionLoading === suggestion.id}
                      onClick={() => handleAction(suggestion.id, "reject")}
                    >
                      {t("reject")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
