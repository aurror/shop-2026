"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Textarea } from "@/components/shared/Textarea";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Modal } from "@/components/shared/Modal";
import { useToast } from "@/components/shared/Toast";

const typeOptions = [
  { value: "percentage", label: "Prozent" },
  { value: "fixed", label: "Festbetrag" },
  { value: "free_shipping", label: "Kostenloser Versand" },
];

function formatDateTime(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  // Format as datetime-local compatible string
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    code: "",
    description: "",
    type: "percentage",
    value: "",
    minOrderAmount: "",
    maxUses: "",
    startsAt: "",
    expiresAt: "",
    active: true,
  });

  const [currentUses, setCurrentUses] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/discounts/${id}`);
        if (!res.ok) {
          addToast("error", "Rabatt nicht gefunden");
          router.push("/admin/discounts");
          return;
        }
        const data = await res.json();
        const d = data.discount;
        setForm({
          code: d.code || "",
          description: d.description || "",
          type: d.type || "percentage",
          value: d.value || "",
          minOrderAmount: d.minOrderAmount || "",
          maxUses: d.maxUses !== null ? String(d.maxUses) : "",
          startsAt: formatDateTime(d.startsAt),
          expiresAt: formatDateTime(d.expiresAt),
          active: d.active,
        });
        setCurrentUses(d.currentUses || 0);
      } catch {
        addToast("error", "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router, addToast]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      addToast("error", "Rabattcode ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        type: form.type,
        value: form.type === "free_shipping" ? "0" : form.value,
        active: form.active,
        minOrderAmount: form.minOrderAmount || null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
      };

      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast("success", t("saved"));
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler beim Speichern");
      }
    } catch {
      addToast("error", "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", "Rabatt gelöscht");
        router.push("/admin/discounts");
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler beim Löschen");
      }
    } catch {
      addToast("error", "Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/discounts">
            <Button variant="ghost" size="sm">{t("back")}</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              {t("edit")}: {form.code}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {currentUses} Verwendung{currentUses !== 1 ? "en" : ""}
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
          {t("delete")}
        </Button>
      </div>

      <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6">
        {/* Code & Type */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            {t("discountCode")}
          </h2>
          <div className="space-y-4">
            <Input
              label={t("discountCode")}
              placeholder="z.B. SOMMER2025"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
              required
            />
            <Textarea
              label={t("description")}
              placeholder="Optionale Beschreibung..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("discountType")}
                options={typeOptions}
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
              />
              {form.type !== "free_shipping" && (
                <Input
                  label={t("discountValue")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={form.type === "percentage" ? "z.B. 10" : "z.B. 5.00"}
                  value={form.value}
                  onChange={(e) => updateField("value", e.target.value)}
                  required
                />
              )}
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Bedingungen
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("minOrderAmount")}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.minOrderAmount}
              onChange={(e) => updateField("minOrderAmount", e.target.value)}
            />
            <Input
              label={t("maxUses")}
              type="number"
              min="0"
              placeholder="Unbegrenzt"
              value={form.maxUses}
              onChange={(e) => updateField("maxUses", e.target.value)}
            />
          </div>
          <div className="mt-3">
            <p className="text-xs text-neutral-500">
              Bisherige Verwendungen: <span className="font-medium">{currentUses}</span>
            </p>
          </div>
        </div>

        {/* Validity */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Gültigkeit
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("validFrom")}
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateField("startsAt", e.target.value)}
            />
            <Input
              label={t("validUntil")}
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => updateField("expiresAt", e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateField("active", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
              />
              <span className="font-medium text-neutral-700">{t("active")}</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/admin/discounts">
            <Button variant="secondary" size="md" type="button">
              {t("cancel")}
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="md" loading={saving}>
            {t("save")}
          </Button>
        </div>
      </form>

      {/* Delete Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Rabatt löschen"
        size="sm"
      >
        <p className="text-sm text-neutral-600">
          Möchten Sie den Rabatt <strong>{form.code}</strong> wirklich löschen?
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowDelete(false)}>
            {t("cancel")}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            {t("delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
