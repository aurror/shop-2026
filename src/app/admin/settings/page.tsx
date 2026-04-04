"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Textarea } from "@/components/shared/Textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";

type TabKey = "general" | "shipping" | "payment" | "email" | "legal" | "ai" | "telegram" | "backup" | "roles" | "updates";

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
  { key: "telegram", labelKey: "telegram" },
  { key: "backup", labelKey: "backupSettings" },
  { key: "roles", labelKey: "roleManagement" },
  { key: "updates", labelKey: "updates" as any },
];

// Setting keys grouped by tab
const tabSettingKeys: Record<TabKey, string[]> = {
  general: ["store_name", "store_email", "store_phone", "store_address", "store_currency", "store_timezone"],
  shipping: ["shipping_base_fee", "shipping_per_kg", "free_shipping_threshold", "shipping_countries", "shipping_provider"],
  payment: ["payment_stripe_enabled", "payment_klarna_enabled", "payment_bank_transfer_enabled", "payment_stripe_key", "payment_stripe_secret"],
  email: ["email_from_address", "email_from_name", "email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_pass"],
  legal: ["legal_imprint", "legal_privacy", "legal_terms", "legal_revocation"],
  ai: [
    "ai_enabled", "ai_provider", "ai_model", "ai_api_key", "ai_base_url", "ai_auto_suggest",
    "ai_writing_style", "ai_no_emojis", "ai_language", "ai_custom_instructions",
    "ai_title_instructions", "ai_description_instructions", "ai_related_instructions",
  ],
  backup: ["backup_auto_enabled", "backup_schedule", "backup_s3_bucket", "backup_s3_region", "backup_s3_key", "backup_s3_secret", "backup_retention_days"],
  telegram: ["telegram_bot_token"],
  roles: [],
  updates: [],
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
  ai_base_url: { de: "KI API Base URL", en: "AI API Base URL" },
  ai_auto_suggest: { de: "Auto-Vorschläge (verwandte Produkte)", en: "Auto Suggestions (related products)" },
  ai_writing_style: { de: "Schreibstil", en: "Writing Style" },
  ai_no_emojis: { de: "Keine Emojis", en: "No Emojis" },
  ai_language: { de: "Sprache (z.B. Deutsch)", en: "Language (e.g. German)" },
  ai_custom_instructions: { de: "Globale Anweisungen (gilt für alle KI-Funktionen)", en: "Global Instructions (applies to all AI features)" },
  ai_title_instructions: { de: "Zusatz für Titeloptimierung", en: "Title optimization additions" },
  ai_description_instructions: { de: "Zusatz für Beschreibungsoptimierung", en: "Description optimization additions" },
  ai_related_instructions: { de: "Zusatz für verwandte Produkte", en: "Related products additions" },
  backup_auto_enabled: { de: "Auto-Backup aktiviert", en: "Auto Backup Enabled" },
  backup_schedule: { de: "Backup Zeitplan", en: "Backup Schedule" },
  backup_s3_bucket: { de: "S3 Bucket", en: "S3 Bucket" },
  backup_s3_region: { de: "S3 Region", en: "S3 Region" },
  backup_s3_key: { de: "S3 Access Key", en: "S3 Access Key" },
  backup_s3_secret: { de: "S3 Secret Key", en: "S3 Secret Key" },
  backup_retention_days: { de: "Aufbewahrung (Tage)", en: "Retention (Days)" },
  telegram_bot_token: { de: "Telegram Bot Token", en: "Telegram Bot Token" },
};

const booleanSettings = new Set([
  "payment_stripe_enabled",
  "payment_klarna_enabled",
  "payment_bank_transfer_enabled",
  "ai_enabled",
  "ai_auto_suggest",
  "ai_no_emojis",
  "backup_auto_enabled",
]);

const textareaSettings = new Set([
  "legal_imprint",
  "legal_privacy",
  "legal_terms",
  "legal_revocation",
  "store_address",
  "shipping_countries",
  "ai_custom_instructions",
  "ai_title_instructions",
  "ai_description_instructions",
  "ai_related_instructions",
]);

const secretSettings = new Set([
  "payment_stripe_secret",
  "email_smtp_pass",
  "ai_api_key",
  "backup_s3_secret",
  "telegram_bot_token",
]);

const selectSettings: Record<string, { label: string; value: string }[]> = {
  ai_writing_style: [
    { label: "Professionell", value: "professional" },
    { label: "Freundlich", value: "friendly" },
    { label: "Technisch", value: "technical" },
    { label: "Prägnant / Knapp", value: "concise" },
  ],
};

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

    if (selectSettings[key]) {
      const options = selectSettings[key];
      const current = typeof value === "string" ? value : (options[0]?.value ?? "");
      return (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">{getLabel(key)}</label>
          <select
            value={current}
            onChange={(e) => updateValue(key, e.target.value)}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-400"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (textareaSettings.has(key)) {
      const placeholders: Record<string, string> = {
        ai_custom_instructions: "z.B. Verwende keine Fachbegriffe. Halte die Texte kurz.",
        ai_title_instructions: "z.B. Erwähne immer die Spurweite am Anfang des Titels.",
        ai_description_instructions: "z.B. Füge immer einen Abschnitt 'Technische Details' mit ul-Liste ein.",
        ai_related_instructions: "z.B. Bevorzuge Produkte der gleichen Marke oder des gleichen Maßstabs.",
      };
      return (
        <Textarea
          key={key}
          label={getLabel(key)}
          value={typeof value === "string" ? value : value ? JSON.stringify(value) : ""}
          onChange={(e) => updateValue(key, e.target.value)}
          rows={key.startsWith("ai_") ? 2 : 4}
          placeholder={placeholders[key]}
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
          ) : activeTab === "updates" ? (
            <UpdatesTabContent locale={locale} />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-neutral-900">
                {t(tabs.find((tab) => tab.key === activeTab)?.labelKey as any)}
              </h2>

              {tabSettingKeys[activeTab].length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {locale === "en" ? "No settings for this section." : "Keine Einstellungen für diesen Bereich."}
                </p>
              ) : activeTab === "ai" ? (
                /* AI tab — grouped sections */
                <div className="space-y-8">
                  {/* Connection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {locale === "en" ? "Connection" : "Verbindung"}
                    </h3>
                    {["ai_enabled", "ai_provider", "ai_model", "ai_api_key", "ai_base_url", "ai_auto_suggest"].map((k) => renderSettingField(k))}
                  </div>

                  <div className="border-t border-neutral-100" />

                  {/* Global writing style */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {locale === "en" ? "Writing Style (global)" : "Schreibstil (global)"}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {locale === "en"
                        ? "These apply to all AI text generation features."
                        : "Diese Einstellungen gelten für alle KI-Textfunktionen."}
                    </p>
                    {["ai_writing_style", "ai_no_emojis", "ai_language", "ai_custom_instructions"].map((k) => renderSettingField(k))}
                  </div>

                  <div className="border-t border-neutral-100" />

                  {/* Per-feature prompt additions */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {locale === "en" ? "Per-feature Prompt Additions" : "Zusatzanweisungen je Funktion"}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {locale === "en"
                        ? "Optional extra instructions appended to the prompt for each specific AI feature, in addition to the global settings above."
                        : "Optionale zusätzliche Anweisungen, die je nach KI-Funktion an den Prompt angehängt werden – ergänzend zu den globalen Einstellungen oben."}
                    </p>
                    {["ai_title_instructions", "ai_description_instructions", "ai_related_instructions"].map((k) => renderSettingField(k))}
                  </div>
                </div>
              ) : activeTab === "telegram" ? (
                <TelegramTabContent
                  renderSettingField={renderSettingField}
                  handleSave={handleSave}
                  saving={saving}
                  locale={locale}
                  t={t}
                />
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

// Telegram tab — bot token + user management
function TelegramTabContent({
  renderSettingField,
  handleSave,
  saving,
  locale,
  t,
}: {
  renderSettingField: (key: string) => React.ReactNode;
  handleSave: () => void;
  saving: boolean;
  locale: string;
  t: (key: any) => string;
}) {
  const [telegramUsers, setTelegramUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/telegram-users")
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((data) => setTelegramUsers(data.users || []))
      .finally(() => setLoadingUsers(false));

    // Check current webhook status
    fetch("/api/telegram/setup")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.result) setWebhookInfo(data.result); })
      .catch(() => {});
  }, []);

  const toggleAck = async (chatId: string, acknowledged: boolean) => {
    const res = await fetch("/api/admin/telegram-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, acknowledged }),
    });
    if (res.ok) {
      setTelegramUsers((prev) =>
        prev.map((u) => (u.chatId === chatId ? { ...u, acknowledged } : u)),
      );
    }
  };

  const setupWebhook = async () => {
    setSettingWebhook(true);
    setWebhookMsg(null);
    const host = window.location.origin;
    const res = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host }),
    });
    const data = await res.json();
    if (data.ok) {
      setWebhookMsg(locale === "en" ? "Webhook set successfully!" : "Webhook erfolgreich gesetzt!");
      setWebhookInfo({ url: `${host}/api/telegram` });
    } else {
      setWebhookMsg(data.description || data.error || "Fehler");
    }
    setSettingWebhook(false);
  };

  return (
    <div className="space-y-8">
      {/* Bot Token */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {locale === "en" ? "Bot Configuration" : "Bot-Konfiguration"}
        </h3>
        <p className="text-xs text-neutral-500">
          {locale === "en"
            ? "Get a bot token from @BotFather on Telegram, paste it here, save, then click 'Set Webhook'."
            : "Bot-Token von @BotFather auf Telegram holen, hier eintragen, speichern, dann 'Webhook setzen' klicken."}
        </p>
        {renderSettingField("telegram_bot_token")}
        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
            {t("save")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            loading={settingWebhook}
            onClick={setupWebhook}
          >
            {locale === "en" ? "Set Webhook" : "Webhook setzen"}
          </Button>
        </div>
        {webhookMsg && (
          <p className={`text-sm ${webhookMsg.includes("erfolg") || webhookMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>
            {webhookMsg}
          </p>
        )}
        {webhookInfo?.url && (
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            {locale === "en" ? "Active webhook:" : "Aktiver Webhook:"}{" "}
            <span className="font-mono text-neutral-700">{webhookInfo.url}</span>
            {webhookInfo.last_error_message && (
              <span className="ml-2 text-red-500">⚠ {webhookInfo.last_error_message}</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-100" />

      {/* Telegram Users */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {locale === "en" ? "Connected Users" : "Verbundene Benutzer"}
        </h3>
        <p className="text-xs text-neutral-500">
          {locale === "en"
            ? "Users who sent /start to the bot. Acknowledge them to grant access to bot commands and notifications."
            : "Benutzer, die /start an den Bot gesendet haben. Bestätigen Sie sie, um Zugriff auf Bot-Befehle und Benachrichtigungen zu gewähren."}
        </p>
        {loadingUsers ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : telegramUsers.length === 0 ? (
          <p className="text-sm text-neutral-400">
            {locale === "en" ? "No users yet." : "Noch keine Benutzer."}
          </p>
        ) : (
          <div className="space-y-2">
            {telegramUsers.map((user: any) => (
              <div
                key={user.chatId}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {user.firstName || user.username || user.chatId}
                    {user.username && <span className="ml-1 text-xs text-neutral-400">@{user.username}</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Chat ID: {user.chatId}
                    {user.isGroup && " (Gruppe)"}
                  </p>
                </div>
                <button
                  onClick={() => toggleAck(user.chatId, !user.acknowledged)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    user.acknowledged
                      ? "bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800"
                      : "bg-neutral-100 text-neutral-600 hover:bg-green-100 hover:text-green-800"
                  }`}
                >
                  {user.acknowledged
                    ? (locale === "en" ? "Revoke" : "Widerrufen")
                    : (locale === "en" ? "Acknowledge" : "Bestätigen")}
                </button>
              </div>
            ))}
          </div>
        )}
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

// Updates tab

// Updates tab — check for new commits, apply deploy, stream log
function UpdatesTabContent({ locale }: { locale: string }) {
  const [status, setStatus] = useState<{
    updateAvailable: boolean;
    currentCommit: string;
    remoteCommit: string;
    lastDeployAt: string;
    commits: { hash: string; message: string; author: string; age: string }[];
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [deployDone, setDeployDone] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollLog() {
    try {
      const res = await fetch("/api/admin/updates/log");
      const data = await res.json();
      setLogLines(data.lines || []);
      if (data.finished) {
        setDeploying(false);
        setDeployDone(true);
        stopPolling();
      }
    } catch {}
  }

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  useEffect(() => () => stopPolling(), []);

  async function checkForUpdates() {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/admin/updates");
      if (!res.ok) throw new Error();
      setStatus(await res.json());
    } catch {
      setError(locale === "en" ? "Could not check for updates." : "Konnte nicht nach Updates suchen.");
    } finally {
      setChecking(false);
    }
  }

  async function applyUpdate() {
    setDeploying(true);
    setDeployDone(false);
    setLogLines([]);
    setError("");
    try {
      const res = await fetch("/api/admin/updates", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      // Start polling log every 2s
      pollRef.current = setInterval(pollLog, 2000);
      // Initial poll immediately
      await pollLog();
    } catch (e: any) {
      setError(e.message || (locale === "en" ? "Deploy failed." : "Deploy fehlgeschlagen."));
      setDeploying(false);
    }
  }

  function lineColor(line: string) {
    if (line.includes("error") || line.includes("Error")) return "text-red-400";
    if (line.includes("warn") || line.includes("Warn")) return "text-yellow-400";
    if (line.includes("finished")) return "text-green-400";
    if (line.match(/^\[(\d)\/5\]/)) return "text-blue-300 font-semibold";
    if (line.startsWith("===")) return "text-neutral-300 font-semibold";
    return "text-neutral-400";
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-neutral-900">Updates</h2>
      <p className="mb-6 text-sm text-neutral-500">
        {locale === "en"
          ? "Check for new versions on the main branch and deploy them."
          : "Neue Versionen auf dem main-Branch prüfen und einspielen."}
      </p>

      {/* Check button */}
      <button
        type="button"
        onClick={checkForUpdates}
        disabled={checking || deploying}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
      >
        {checking ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        )}
        {checking
          ? (locale === "en" ? "Checking..." : "Prüfe...")
          : (locale === "en" ? "Check for updates" : "Nach Updates suchen")}
      </button>

      {error && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {status && !deploying && !logLines.length && (
        <div className="mt-6 space-y-6">
          {/* Version cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">{locale === "en" ? "Installed" : "Installiert"}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-neutral-900">{status.currentCommit}</p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">{locale === "en" ? "Latest on main" : "Aktuell auf main"}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-neutral-900">{status.remoteCommit}</p>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">{locale === "en" ? "Last deployed" : "Zuletzt deployed"}</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{status.lastDeployAt || "–"}</p>
            </div>
          </div>

          {/* Status + deploy */}
          <div className="flex flex-wrap items-center gap-4">
            {status.updateAvailable ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {locale === "en" ? "Update available" : "Update verfügbar"}
                </span>
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {locale === "en" ? "Deploy now" : "Jetzt deployen"}
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === "en" ? "Up to date" : "Aktuell"}
              </span>
            )}
          </div>

          {/* Recent commits */}
          {status.commits.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {locale === "en" ? "Recent commits on main" : "Letzte Commits auf main"}
              </h3>
              <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {status.commits.map((c) => (
                  <div key={c.hash} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 font-mono text-xs text-neutral-400">{c.hash.slice(0, 7)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-800">{c.message}</p>
                      <p className="text-xs text-neutral-400">{c.author} · {c.age}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live log output */}
      {(deploying || logLines.length > 0) && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {locale === "en" ? "Deploy log" : "Deploy-Protokoll"}
            </h3>
            {deploying && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                {locale === "en" ? "Running..." : "Läuft..."}
              </span>
            )}
            {deployDone && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {locale === "en" ? "Done" : "Fertig"}
              </span>
            )}
          </div>
          <div
            ref={logRef}
            className="h-72 overflow-y-auto rounded-lg bg-neutral-900 p-4 font-mono text-xs leading-relaxed"
          >
            {logLines.length === 0 ? (
              <span className="text-neutral-500">
                {locale === "en" ? "Waiting for output..." : "Warte auf Ausgabe..."}
              </span>
            ) : (
              logLines.map((line, i) => (
                <div key={i} className={lineColor(line)}>
                  {line}
                </div>
              ))
            )}
          </div>
          {deployDone && (
            <p className="mt-3 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
              {locale === "en"
                ? "Deploy finished. The server has restarted — reload this page in a few seconds."
                : "Deploy abgeschlossen. Der Server wurde neu gestartet — lade die Seite in wenigen Sekunden neu."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
