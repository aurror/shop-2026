"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Textarea } from "@/components/shared/Textarea";
import { useToast } from "@/components/shared/Toast";

const typeOptions = [
  { value: "percentage", label: "Prozent" },
  { value: "fixed", label: "Festbetrag" },
  { value: "free_shipping", label: "Kostenloser Versand" },
];

export default function NewDiscountPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

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

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.code.trim()) {
      addToast("error", "Rabattcode ist erforderlich");
      return;
    }
    if (!form.value && form.type !== "free_shipping") {
      addToast("error", "Rabattwert ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        type: form.type,
        value: form.type === "free_shipping" ? "0" : form.value,
        active: form.active,
      };
      if (form.minOrderAmount) payload.minOrderAmount = form.minOrderAmount;
      if (form.maxUses) payload.maxUses = parseInt(form.maxUses);
      if (form.startsAt) payload.startsAt = form.startsAt;
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        addToast("success", "Rabatt erstellt");
        router.push(`/admin/discounts/${data.discount.id}`);
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler beim Erstellen");
      }
    } catch {
      addToast("error", "Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/discounts">
          <Button variant="ghost" size="sm">{t("back")}</Button>
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("addDiscount")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
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
          <div className="space-y-4">
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
    </div>
  );
}
