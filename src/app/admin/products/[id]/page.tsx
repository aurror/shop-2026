"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Textarea } from "@/components/shared/Textarea";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Select } from "@/components/shared/Select";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Variant state
  const [variants, setVariants] = useState<any[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [newVariant, setNewVariant] = useState({
    name: "", sku: "", price: "", stock: "0", weight: "", attributes: "{}",
  });

  // Relations state
  const [relations, setRelations] = useState<any[]>([]);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [relationSearch, setRelationSearch] = useState("");
  const [relationResults, setRelationResults] = useState<any[]>([]);

  // AI suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    name: "", slug: "", description: "", descriptionHtml: "", basePrice: "", compareAtPrice: "",
    categoryId: "", weight: "0", taxRate: "19.00", featured: false, active: true,
  });

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          const p = data.product;
          setProduct(p);
          setForm({
            name: p.name || "",
            slug: p.slug || "",
            description: p.description || "",
            descriptionHtml: p.descriptionHtml || "",
            basePrice: p.basePrice || "",
            compareAtPrice: p.compareAtPrice || "",
            categoryId: p.categoryId || "",
            weight: p.weight || "0",
            taxRate: p.taxRate || "19.00",
            featured: p.featured ?? false,
            active: p.active ?? true,
          });
          setImages(p.images || []);
          setVariants(p.variants || []);
          setRelations(p.relations || []);
        } else {
          addToast("error", "Produkt nicht gefunden");
          router.push("/admin/products");
        }
      } catch {
        addToast("error", "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id, router, addToast]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Fetch AI suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch(`/api/admin/ai?productId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch { /* ignore */ }
    }
    if (id) fetchSuggestions();
  }, [id]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && typeof value === "string" && !prev.slug) {
        updated.slug = slugify(value);
      }
      return updated;
    });
  };

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          setImages((prev) => [...prev, data.url]);
        } else {
          addToast("error", `Upload fehlgeschlagen: ${file.name}`);
        }
      }
    } catch {
      addToast("error", "Upload-Fehler");
    } finally {
      setUploading(false);
    }
  }, [addToast]);

  const handleVariantImageUpload = useCallback(async (variantId: string, files: FileList | File[]) => {
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          urls.push(data.url);
        }
      }
      if (urls.length > 0) {
        const variant = variants.find((v) => v.id === variantId);
        const currentImages = variant?.images || [];
        const newImages = [...currentImages, ...urls];
        await handleUpdateVariant(variantId, "images", newImages as any);
      }
    } catch {
      addToast("error", "Upload-Fehler");
    }
  }, [variants, addToast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images }),
      });
      if (res.ok) {
        addToast("success", t("saved"));
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler beim Speichern");
      }
    } catch {
      addToast("error", "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const [optimizingTitle, setOptimizingTitle] = useState(false);
  const handleAiOptimizeTitle = async () => {
    setOptimizingTitle(true);
    try {
      const res = await fetch("/api/admin/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "title", name: form.name }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        updateField("name", data.name);
        addToast("success", "Titel optimiert");
      } else {
        addToast("error", data.error || "KI-Fehler");
      }
    } catch {
      addToast("error", "Netzwerkfehler");
    } finally {
      setOptimizingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Produkt wirklich löschen? Dies kann nicht rückgängig gemacht werden.")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}?hard=true`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", "Produkt gelöscht");
        router.push("/admin/products");
      } else {
        addToast("error", "Fehler beim Löschen");
      }
    } catch {
      addToast("error", "Fehler beim Löschen");
    }
  };

  // Variant CRUD
  const handleAddVariant = async () => {
    try {
      let attrs = {};
      try { attrs = JSON.parse(newVariant.attributes); } catch { attrs = {}; }

      const res = await fetch(`/api/admin/products/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVariant.name,
          sku: newVariant.sku,
          price: newVariant.price || null,
          stock: parseInt(newVariant.stock) || 0,
          weight: newVariant.weight || null,
          attributes: attrs,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setVariants((prev) => [...prev, data.variant]);
        setShowVariantModal(false);
        setNewVariant({ name: "", sku: "", price: "", stock: "0", weight: "", attributes: "{}" });
        addToast("success", "Variante hinzugefügt");
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler");
      }
    } catch {
      addToast("error", "Fehler beim Hinzufügen");
    }
  };

  const handleUpdateVariant = async (variantId: string, field: string, value: string | number) => {
    try {
      const res = await fetch(`/api/admin/products/${id}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setVariants((prev) =>
          prev.map((v) => (v.id === variantId ? data.variant : v))
        );
      } else {
        addToast("error", "Fehler beim Aktualisieren");
      }
    } catch {
      addToast("error", "Fehler");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm("Variante wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}/variants?variantId=${variantId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVariants((prev) => prev.filter((v) => v.id !== variantId));
        addToast("success", "Variante gelöscht");
      }
    } catch {
      addToast("error", "Fehler");
    }
  };

  // Relation CRUD
  const searchProducts = async (query: string) => {
    if (!query) { setRelationResults([]); return; }
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRelationResults(
          (data.products || []).filter((p: any) => p.id !== id)
        );
      }
    } catch { /* ignore */ }
  };

  const handleAddRelation = async (relatedProductId: string) => {
    try {
      const res = await fetch(`/api/admin/products/${id}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedProductId, relationType: "related" }),
      });
      if (res.ok) {
        // Refresh relations
        const relRes = await fetch(`/api/admin/products/${id}/relations`);
        if (relRes.ok) {
          const relData = await relRes.json();
          setRelations(relData.relations || []);
        }
        setShowRelationModal(false);
        addToast("success", "Verknüpfung hinzugefügt");
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler");
      }
    } catch {
      addToast("error", "Fehler");
    }
  };

  const handleRemoveRelation = async (relationId: string) => {
    try {
      const res = await fetch(`/api/admin/products/${id}/relations?relationId=${relationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRelations((prev) => prev.filter((r) => r.id !== relationId));
        addToast("success", "Verknüpfung entfernt");
      }
    } catch {
      addToast("error", "Fehler");
    }
  };

  // AI suggestion actions
  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
      if (res.ok) {
        // Refresh suggestions
        const sugRes = await fetch(`/api/admin/ai?productId=${id}`);
        if (sugRes.ok) {
          const sugData = await sugRes.json();
          setSuggestions(sugData.suggestions || []);
        }
        addToast("success", "Vorschläge generiert");
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler");
      }
    } catch {
      addToast("error", "Fehler bei KI-Vorschlägen");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionAction = async (suggestionId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/admin/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        if (action === "approve") {
          const relRes = await fetch(`/api/admin/products/${id}/relations`);
          if (relRes.ok) {
            const relData = await relRes.json();
            setRelations(relData.relations || []);
          }
        }
        addToast("success", action === "approve" ? "Genehmigt" : "Abgelehnt");
      }
    } catch {
      addToast("error", "Fehler");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("editProduct")}</h1>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          {t("deleteProduct")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label={t("productName")} value={form.name} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <button
                  type="button"
                  onClick={handleAiOptimizeTitle}
                  disabled={optimizingTitle || !form.name}
                  title="Titel mit KI optimieren"
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-40 shrink-0"
                >
                  {optimizingTitle ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                  )}
                  {optimizingTitle ? "..." : "KI"}
                </button>
              </div>
              <Input label="Slug" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} />
              <RichTextEditor
                label={t("description")}
                value={form.descriptionHtml || form.description}
                productName={form.name}
                onChange={(html, text) => {
                  updateField("descriptionHtml", html);
                  updateField("description", text);
                }}
              />
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("images")}</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${dragOver ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"}`}
            >
              <p className="text-sm text-neutral-600">
                Bilder hierher ziehen oder{" "}
                <label className="cursor-pointer font-medium text-neutral-900 hover:underline">
                  auswählen
                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
                </label>
              </p>
              {uploading && <p className="mt-2 text-xs text-neutral-500">{t("loading")}</p>}
            </div>
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="group relative">
                    <img src={url} alt={`Bild ${idx + 1}`} className="h-20 w-20 rounded-lg border border-neutral-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variants */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("variants")}</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowVariantModal(true)}>
                {t("add")}
              </Button>
            </div>
            {variants.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-neutral-400">Keine Varianten vorhanden</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full">
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("sku")}</th>
                      <th className="text-right">{t("price")}</th>
                      <th className="text-right">{t("stock")}</th>
                      <th>Bilder</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant) => (
                      <tr key={variant.id}>
                        <td>
                          <input
                            className="w-full border-0 bg-transparent text-sm font-medium focus:outline-none focus:ring-0"
                            defaultValue={variant.name}
                            onBlur={(e) => {
                              if (e.target.value !== variant.name) {
                                handleUpdateVariant(variant.id, "name", e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="font-mono text-xs">{variant.sku}</td>
                        <td className="text-right">
                          <input
                            className="w-20 border-0 bg-transparent text-right text-sm focus:outline-none focus:ring-0"
                            defaultValue={variant.price || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (variant.price || "")) {
                                handleUpdateVariant(variant.id, "price", e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="w-16 border-0 bg-transparent text-right text-sm focus:outline-none focus:ring-0"
                            defaultValue={variant.stock}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (val !== variant.stock) {
                                handleUpdateVariant(variant.id, "stock", val);
                              }
                            }}
                          />
                        </td>
                        <td className="text-sm text-neutral-500">
                          <div className="flex items-center gap-1">
                            {(variant.images || []).map((img: string, i: number) => (
                              <div key={i} className="group relative h-8 w-8 overflow-hidden rounded border">
                                <img src={img} alt="" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newImgs = (variant.images || []).filter((_: string, j: number) => j !== i);
                                    handleUpdateVariant(variant.id, "images", newImgs as any);
                                  }}
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-500 hover:text-neutral-600">
                              <span className="text-lg leading-none">+</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.length) handleVariantImageUpload(variant.id, e.target.files);
                                }}
                              />
                            </label>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(variant.id)}
                            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Related Products */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("relatedProducts")}</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowRelationModal(true)}>
                {t("add")}
              </Button>
            </div>
            {relations.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-neutral-400">Keine verwandten Produkte</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {relations.map((rel) => (
                  <li key={rel.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {rel.relatedProduct?.name || rel.relatedProductId}
                      </p>
                      <p className="text-xs text-neutral-500">{rel.relationType}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRelation(rel.id)}
                      className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("aiSuggestions")}</h2>
              <Button
                variant="secondary"
                size="sm"
                loading={loadingSuggestions}
                onClick={handleGenerateSuggestions}
              >
                {t("getAiSuggestions")}
              </Button>
            </div>
            {suggestions.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-neutral-400">Keine ausstehenden Vorschläge</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {suggestions.map((sug) => (
                  <li key={sug.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">
                          {sug.suggestedProduct?.name || sug.suggestedProductId}
                        </p>
                        {sug.reasoning && (
                          <p className="mt-1 text-xs text-neutral-500">{sug.reasoning}</p>
                        )}
                        {sug.confidence && (
                          <Badge variant="default" className="mt-1">
                            {t("confidence")}: {Math.round(parseFloat(sug.confidence) * 100)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSuggestionAction(sug.id, "approve")}
                        >
                          {t("approve")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSuggestionAction(sug.id, "reject")}
                        >
                          {t("reject")}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("price")}</h2>
            <div className="space-y-4">
              <Input label={`${t("price")} (EUR)`} type="number" step="0.01" min="0" value={form.basePrice} onChange={(e) => updateField("basePrice", e.target.value)} />
              <Input label="Vergleichspreis" type="number" step="0.01" min="0" value={form.compareAtPrice} onChange={(e) => updateField("compareAtPrice", e.target.value)} />
              <Input label="MwSt.-Satz (%)" type="number" step="0.01" value={form.taxRate} onChange={(e) => updateField("taxRate", e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Details</h2>
            <div className="space-y-4">
              <Input label={`${t("weight")} (kg)`} type="number" step="0.01" min="0" value={form.weight} onChange={(e) => updateField("weight", e.target.value)} />
              <Select label={t("category")} value={form.categoryId} onChange={(e) => updateField("categoryId", e.target.value)} options={[{ value: "", label: "Keine Kategorie" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">{t("active")}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => updateField("featured", e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">{t("featured")}</span>
              </label>
            </div>
          </div>

          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>
            {t("save")}
          </Button>
        </div>
      </div>

      {/* Add Variant Modal */}
      <Modal isOpen={showVariantModal} onClose={() => setShowVariantModal(false)} title="Variante hinzufügen">
        <div className="space-y-4">
          <Input label={t("name")} value={newVariant.name} onChange={(e) => setNewVariant((p) => ({ ...p, name: e.target.value }))} placeholder="z.B. H0 / Rot" />
          <Input label={t("sku")} value={newVariant.sku} onChange={(e) => setNewVariant((p) => ({ ...p, sku: e.target.value }))} placeholder="z.B. BR01-H0-RED" />
          <Input label={t("price")} type="number" step="0.01" value={newVariant.price} onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))} placeholder="Leer = Basispreis" />
          <Input label={t("stock")} type="number" value={newVariant.stock} onChange={(e) => setNewVariant((p) => ({ ...p, stock: e.target.value }))} />
          <Input label={t("weight")} value={newVariant.weight} onChange={(e) => setNewVariant((p) => ({ ...p, weight: e.target.value }))} placeholder="kg" />
          <Textarea label="Attribute (JSON)" value={newVariant.attributes} onChange={(e) => setNewVariant((p) => ({ ...p, attributes: e.target.value }))} rows={3} placeholder='{"Maßstab": "H0", "Farbe": "Rot"}' />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowVariantModal(false)}>{t("cancel")}</Button>
            <Button variant="primary" onClick={handleAddVariant}>{t("add")}</Button>
          </div>
        </div>
      </Modal>

      {/* Add Relation Modal */}
      <Modal isOpen={showRelationModal} onClose={() => setShowRelationModal(false)} title="Verwandtes Produkt hinzufügen">
        <div className="space-y-4">
          <Input
            label={t("search")}
            value={relationSearch}
            onChange={(e) => {
              setRelationSearch(e.target.value);
              searchProducts(e.target.value);
            }}
            placeholder="Produkt suchen..."
          />
          {relationResults.length > 0 && (
            <ul className="max-h-60 overflow-y-auto divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {relationResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleAddRelation(p.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{p.name}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(p.basePrice)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
