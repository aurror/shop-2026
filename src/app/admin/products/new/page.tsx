"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Textarea } from "@/components/shared/Textarea";
import { Select } from "@/components/shared/Select";
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

export default function NewProductPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    basePrice: "",
    compareAtPrice: "",
    categoryId: "",
    weight: "0",
    taxRate: "19.00",
    featured: false,
    active: true,
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && typeof value === "string") {
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.basePrice) {
      addToast("error", "Name, Slug und Preis sind erforderlich");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          images,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        addToast("success", "Produkt erstellt");
        router.push(`/admin/products/${data.product.id}`);
      } else {
        const err = await res.json();
        addToast("error", err.error || "Fehler beim Erstellen");
      }
    } catch {
      addToast("error", "Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("addProduct")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <Input
                label={t("productName")}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="z.B. BR 01 Dampflok H0"
              />
              <Input
                label="Slug"
                value={form.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                helperText="URL-freundlicher Name, wird automatisch generiert"
              />
              <Textarea
                label={t("description")}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                placeholder="Produktbeschreibung..."
              />
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("images")}</h2>

            {/* Upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`
                flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors
                ${dragOver ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"}
              `}
            >
              <svg className="mb-2 h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-neutral-600">
                Bilder hierher ziehen oder{" "}
                <label className="cursor-pointer font-medium text-neutral-900 hover:underline">
                  auswählen
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  />
                </label>
              </p>
              {uploading && <p className="mt-2 text-xs text-neutral-500">{t("loading")}</p>}
            </div>

            {/* Image preview */}
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {images.map((url, idx) => (
                  <div key={idx} className="group relative">
                    <img
                      src={url}
                      alt={`Bild ${idx + 1}`}
                      className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
                    />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">{t("price")}</h2>
            <div className="space-y-4">
              <Input
                label={`${t("price")} (EUR)`}
                type="number"
                step="0.01"
                min="0"
                value={form.basePrice}
                onChange={(e) => updateField("basePrice", e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="Vergleichspreis (EUR)"
                type="number"
                step="0.01"
                min="0"
                value={form.compareAtPrice}
                onChange={(e) => updateField("compareAtPrice", e.target.value)}
                placeholder="0.00"
                helperText="Durchgestrichener Originalpreis"
              />
              <Input
                label="MwSt.-Satz (%)"
                type="number"
                step="0.01"
                value={form.taxRate}
                onChange={(e) => updateField("taxRate", e.target.value)}
              />
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Details</h2>
            <div className="space-y-4">
              <Input
                label={`${t("weight")} (kg)`}
                type="number"
                step="0.01"
                min="0"
                value={form.weight}
                onChange={(e) => updateField("weight", e.target.value)}
              />
              <Select
                label={t("category")}
                value={form.categoryId}
                onChange={(e) => updateField("categoryId", e.target.value)}
                options={[
                  { value: "", label: "Keine Kategorie" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => updateField("active", e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
                <span className="text-sm font-medium text-neutral-700">{t("active")}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => updateField("featured", e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
                <span className="text-sm font-medium text-neutral-700">{t("featured")}</span>
              </label>
            </div>
          </div>

          {/* Save */}
          <Button
            variant="primary"
            className="w-full"
            loading={saving}
            onClick={handleSave}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
