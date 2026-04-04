"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Textarea } from "@/components/shared/Textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";

type TabKey = "general" | "shipping" | "payment" | "email" | "legal" | "ai" | "backup" | "roles";

interface Tab {
  key: TabKey;
  labelKey: string;
}

const tabs: Tab[] = [
  { key: "general", labelKey: "general" },
  { key: "shipping", labelKey: "shipping" },
  { key: "payment", labelKey: "payment" },
  { key: "email", labelKey: "emailSettings" },
  { key: "legal", labelKey: "legal" },
  { key: "ai", labelKey: "ai" },
  { key: "backup", labelKey: "backupSettings" },
  { key: "roles", labelKey: "roleManagement" },
];

// Setting keys grouped by tab
const tabSettingKeys: Record<TabKey, string[]> = {
  general: ["store_name", "store_email", "store_phone", "store_address", "store_currency", "store_timezone"],
  shipping: ["shipping_base_fee", "shipping_per_kg", "free_shipping_threshold", "shipping_countries", "shipping_provider"],
  payment: ["payment_stripe_enabled", "payment_klarna_enabled", "payment_bank_transfer_enabled", "payment_stripe_key", "payment_stripe_secret"],
  email: ["email_from_address", "email_from_name", "email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_pass"],
  legal: ["legal_imprint", "legal_privacy", "legal_terms", "legal_revocation"],
  ai: ["ai_enabled", "ai_provider", "ai_model", "ai_api_key", "ai_auto_suggest"],
  backup: ["backup_auto_enabled", "backup_schedule", "backup_s3_bucket", "backup_s3_region", "backup_s3_key", "backup_s3_secret", "backup_retention_days"],
  roles: [],
};

const settingLabels: Record<string, { de: string; en: string }> = {
  store_name: { de: "Shopname", en: "Store Name" },
  store_email: { de: "Shop E-Mail", en: "Store Email" },
  store_phone: { de: "Shop Telefon", en: "Store Phone" },
  store_address: { de: "Shop Adresse", en: "Store Address" },
  store_currency: { de: "Währung", en: "Currency" },
  store_timezone: { de: "Zeitzone", en: "Timezone" },
  shipping_base_fee: { de: "Versandgrundgebühr", en: "Shipping Base Fee" },
  shipping_per_kg: { de: "Versand pro kg", en: "Shipping per kg" },
  free_shipping_threshold: { de: "Kostenloser Versand ab", en: "Free Shipping Threshold" },
  shipping_countries: { de: "Versandländer", en: "Shipping Countries" },
  shipping_provider: { de: "Versandanbieter", en: "Shipping Provider" },
  payment_stripe_enabled: { de: "Stripe aktiviert", en: "Stripe Enabled" },
  payment_klarna_enabled: { de: "Klarna aktiviert", en: "Klarna Enabled" },
  payment_bank_transfer_enabled: { de: "Banküberweisung aktiviert", en: "Bank Transfer Enabled" },
  payment_stripe_key: { de: "Stripe Public Key", en: "Stripe Public Key" },
  payment_stripe_secret: { de: "Stripe Secret Key", en: "Stripe Secret Key" },
  email_from_address: { de: "Absender E-Mail", en: "From Email" },
  email_from_name: { de: "Absender Name", en: "From Name" },
  email_smtp_host: { de: "SMTP Host", en: "SMTP Host" },
  email_smtp_port: { de: "SMTP Port", en: "SMTP Port" },
  email_smtp_user: { de: "SMTP Benutzer", en: "SMTP User" },
  email_smtp_pass: { de: "SMTP Passwort", en: "SMTP Password" },
  legal_imprint: { de: "Impressum", en: "Imprint" },
  legal_privacy: { de: "Datenschutzerklärung", en: "Privacy Policy" },
  legal_terms: { de: "AGB", en: "Terms & Conditions" },
  legal_revocation: { de: "Widerrufsbelehrung", en: "Revocation Policy" },
  ai_enabled: { de: "KI aktiviert", en: "AI Enabled" },
  ai_provider: { de: "KI Anbieter", en: "AI Provider" },
  ai_model: { de: "KI Modell", en: "AI Model" },
  ai_api_key: { de: "KI API Key", en: "AI API Key" },
  ai_auto_suggest: { de: "Auto-Vorschläge", en: "Auto Suggestions" },
  backup_auto_enabled: { de: "Auto-Backup aktiviert", en: "Auto Backup Enabled" },
  backup_schedule: { de: "Backup Zeitplan", en: "Backup Schedule" },
  backup_s3_bucket: { de: "S3 Bucket", en: "S3 Bucket" },
  backup_s3_region: { de: "S3 Region", en: "S3 Region" },
  backup_s3_key: { de: "S3 Access Key", en: "S3 Access Key" },
  backup_s3_secret: { de: "S3 Secret Key", en: "S3 Secret Key" },
  backup_retention_days: { de: "Aufbewahrung (Tage)", en: "Retention (Days)" },
};

const booleanSettings = new Set([
  "payment_stripe_enabled",
  "payment_klarna_enabled",
  "payment_bank_transfer_enabled",
  "ai_enabled",
  "ai_auto_suggest",
  "backup_auto_enabled",
]);

const textareaSettings = new Set([
  "legal_imprint",
  "legal_privacy",
  "legal_terms",
  "legal_revocation",
  "store_address",
  "shipping_countries",
]);

const secretSettings = new Set([
  "payment_stripe_secret",
  "email_smtp_pass",
  "ai_api_key",
  "backup_s3_secret",
]);

export default function AdminSettingsPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        // Convert settings array to object if needed
        const settingsObj: Record<string, any> = {};
        if (Array.isArray(data.settings)) {
          for (const s of data.settings) {
            settingsObj[s.key] = s.value;
          }
        } else if (typeof data.settings === "object") {
          Object.assign(settingsObj, data.settings);
        }
        setSettings(settingsObj);
        setFormValues(settingsObj);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateValue = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const keys = tabSettingKeys[activeTab];
    if (keys.length === 0) return;

    setSaving(true);
    try {
      // Only send changed values
      const payload: Record<string, any> = {};
      for (const key of keys) {
        const newVal = formValues[key];
        const oldVal = settings[key];
        if (newVal !== oldVal && newVal !== undefined) {
          payload[key] = newVal;
        }
      }

      if (Object.keys(payload).length === 0) {
        addToast("info", "Keine Änderungen");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local settings
        if (data.settings) {
          const settingsObj: Record<string, any> = {};
          if (Array.isArray(data.settings)) {
            for (const s of data.settings) {
              settingsObj[s.key] = s.value;
            }
          } else {
            Object.assign(settingsObj, data.settings);
          }
          setSettings(settingsObj);
          setFormValues(settingsObj);
        }
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

  const getLabel = (key: string): string => {
    const labels = settingLabels[key];
    if (!labels) return key;
    return locale === "en" ? labels.en : labels.de;
  };

  const renderSettingField = (key: string) => {
    const value = formValues[key];

    if (booleanSettings.has(key)) {
      return (
        <label key={key} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
          <span className="text-sm font-medium text-neutral-700">{getLabel(key)}</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => updateValue(key, !value)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 ${
              value ? "bg-neutral-900" : "bg-neutral-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                value ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      );
    }

    if (textareaSettings.has(key)) {
      return (
        <Textarea
          key={key}
          label={getLabel(key)}
          value={typeof value === "string" ? value : value ? JSON.stringify(value) : ""}
          onChange={(e) => updateValue(key, e.target.value)}
          rows={4}
        />
      );
    }

    return (
      <Input
        key={key}
        label={getLabel(key)}
        type={secretSettings.has(key) ? "password" : "text"}
        value={typeof value === "string" ? value : typeof value === "number" ? String(value) : value ? JSON.stringify(value) : ""}
        onChange={(e) => updateValue(key, e.target.value)}
        placeholder={getLabel(key)}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("settings")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {locale === "en" ? "Configure your store settings" : "Shop-Einstellungen konfigurieren"}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Tab Sidebar */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {t(tab.labelKey as any)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : activeTab === "roles" ? (
            <RolesTabContent locale={locale} />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-neutral-900">
                {t(tabs.find((tab) => tab.key === activeTab)?.labelKey as any)}
              </h2>

              {tabSettingKeys[activeTab].length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {locale === "en" ? "No settings for this section." : "Keine Einstellungen für diesen Bereich."}
                </p>
              ) : (
                <div className="space-y-4">
                  {tabSettingKeys[activeTab].map((key) => renderSettingField(key))}
                </div>
              )}

              {tabSettingKeys[activeTab].length > 0 && (
                <div className="mt-6 flex justify-end border-t border-neutral-100 pt-4">
                  <Button
                    variant="primary"
                    size="md"
                    loading={saving}
                    onClick={handleSave}
                  >
                    {t("save")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline roles tab content - shows a summary and links to full roles page
function RolesTabContent({ locale }: { locale: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/roles");
        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles || []);
        }
      } catch (err) {
        console.error("Failed to load roles:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          {locale === "en" ? "Role Management" : "Rollenverwaltung"}
        </h2>
        <a href="/admin/roles">
          <Button variant="outline" size="sm">
            {locale === "en" ? "Manage Roles" : "Rollen verwalten"}
          </Button>
        </a>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {locale === "en" ? "No roles configured." : "Keine Rollen konfiguriert."}
        </p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-neutral-500">{role.description}</p>
                )}
              </div>
              <span className="text-xs text-neutral-400">
                {role.userCount || 0} {locale === "en" ? "users" : "Benutzer"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
