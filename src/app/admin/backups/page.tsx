"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/Select";
import { Input } from "@/components/shared/Input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const CRON_PRESETS = [
  { label: "Täglich 02:00", value: "0 2 * * *" },
  { label: "Täglich 03:00", value: "0 3 * * *" },
  { label: "Stündlich", value: "0 * * * *" },
  { label: "Alle 6 Std.", value: "0 */6 * * *" },
  { label: "Wöchentlich Mo", value: "0 2 * * 1" },
  { label: "Monatlich 1.", value: "0 2 1 * *" },
];

/** Describe a cron expression in plain German */
function describeCron(expr: string): string {
  if (!expr) return "";
  const presetMatch = CRON_PRESETS.find((p) => p.value === expr);
  if (presetMatch) return presetMatch.label;
  return expr;
}

const locationOptions = [
  { value: "local", label: "Lokal" },
  { value: "s3", label: "S3" },
  { value: "both", label: "Beide" },
];

function BackupIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function AdminBackupsPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  // Manual backup
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [backupLocation, setBackupLocation] = useState("local");

  // Expanded error rows
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  // Cron schedule
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [cronExpression, setCronExpression] = useState("");
  const [cronLocation, setCronLocation] = useState("local");
  const [cronEnabled, setCronEnabled] = useState(false);
  const [installedLine, setInstalledLine] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error("Failed to fetch backups:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/admin/backup/schedule");
      if (res.ok) {
        const data = await res.json();
        setCronExpression(data.expression || "");
        setCronLocation(data.location || "local");
        setCronEnabled(!!data.expression);
        setInstalledLine(data.installedLine || "");
      }
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchSchedule();
  }, [fetchBackups, fetchSchedule]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: backupLocation }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("success", locale === "en" ? "Backup created successfully" : "Backup erfolgreich erstellt");
        fetchBackups();
      } else if (data.partial) {
        addToast("warning", locale === "en" ? "Backup partially succeeded" : "Backup teilweise erfolgreich");
        fetchBackups();
      } else {
        addToast("error", data.error || (locale === "en" ? "Backup failed" : "Backup fehlgeschlagen"));
      }
    } catch {
      addToast("error", locale === "en" ? "Backup failed" : "Backup fehlgeschlagen");
    } finally {
      setCreating(false);
    }
  };

  const saveSchedule = async () => {
    if (cronEnabled && !cronExpression.trim()) {
      addToast("error", "Bitte einen Cron-Ausdruck eingeben");
      return;
    }
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/admin/backup/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expression: cronExpression.trim(),
          location: cronLocation,
          enabled: cronEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInstalledLine(data.installedLine || "");
        addToast("success", locale === "en" ? "Schedule saved" : "Zeitplan gespeichert");
      } else {
        addToast("error", data.error || "Fehler beim Speichern");
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const removeSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/admin/backup/schedule", { method: "DELETE" });
      if (res.ok) {
        setCronEnabled(false);
        setCronExpression("");
        setInstalledLine("");
        addToast("success", "Zeitplan entfernt");
      }
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const successCount = backups.filter((b) => b.status === "success").length;
  const failedCount = backups.filter((b) => b.status === "failed").length;
  const totalSize = backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("backups")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {backups.length} {locale === "en" ? "backups" : "Backups"} &middot; {formatSize(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36">
            <Select options={locationOptions} value={backupLocation} onChange={(e) => setBackupLocation(e.target.value)} />
          </div>
          <Button variant="primary" size="md" loading={creating} onClick={createBackup}>
            {t("createBackup")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">{locale === "en" ? "Total Backups" : "Backups gesamt"}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{backups.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">{locale === "en" ? "Successful" : "Erfolgreich"}</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">{successCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">{locale === "en" ? "Failed" : "Fehlgeschlagen"}</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{failedCount}</p>
        </div>
      </div>

      {/* Cron Schedule */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            {locale === "en" ? "Automatic Schedule" : "Automatischer Zeitplan"}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {locale === "en"
              ? "System cron job — runs on the server (node must be in PATH)"
              : "System-Cronjob — läuft auf dem Server (node muss im PATH sein)"}
          </p>
        </div>

        {scheduleLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-5 p-6">
            {/* Enable toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cronEnabled}
                onChange={(e) => setCronEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-900">
                {locale === "en" ? "Enable automatic backups" : "Automatische Backups aktivieren"}
              </span>
            </label>

            {cronEnabled && (
              <div className="space-y-4">
                {/* Presets */}
                <div>
                  <p className="mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    {locale === "en" ? "Quick Presets" : "Schnellauswahl"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCronExpression(preset.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          cronExpression === preset.value
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom expression */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                    {locale === "en" ? "Cron Expression" : "Cron-Ausdruck"}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        value={cronExpression}
                        onChange={(e) => setCronExpression(e.target.value)}
                        placeholder="0 2 * * *"
                        className="font-mono"
                      />
                    </div>
                    {cronExpression && (
                      <span className="text-sm text-neutral-500 whitespace-nowrap">
                        → {describeCron(cronExpression)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">
                    {locale === "en"
                      ? "Format: min hour day month weekday — e.g. 0 2 * * * = daily at 02:00"
                      : "Format: Min Std Tag Monat Wochentag — z.B. 0 2 * * * = täglich um 02:00"}
                  </p>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                    {locale === "en" ? "Backup Location" : "Speicherort"}
                  </label>
                  <div className="w-40">
                    <Select
                      options={locationOptions}
                      value={cronLocation}
                      onChange={(e) => setCronLocation(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Installed line */}
            {installedLine && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-medium text-green-700 mb-1">
                  {locale === "en" ? "Installed crontab entry:" : "Installierter Crontab-Eintrag:"}
                </p>
                <code className="block text-xs text-green-800 break-all font-mono">{installedLine}</code>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button variant="primary" size="sm" loading={savingSchedule} onClick={saveSchedule}>
                {locale === "en" ? "Save Schedule" : "Zeitplan speichern"}
              </Button>
              {installedLine && (
                <Button variant="ghost" size="sm" loading={savingSchedule} onClick={removeSchedule}>
                  {locale === "en" ? "Remove" : "Entfernen"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{t("backupHistory")}</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : backups.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            description={locale === "en" ? "No backups have been created yet." : "Noch keine Backups erstellt."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Filename" : "Dateiname"}</th>
                  <th>{t("backupLocation")}</th>
                  <th>{t("backupSize")}</th>
                  <th>{t("backupStatus")}</th>
                  <th>{t("date")}</th>
                  <th>{locale === "en" ? "Error" : "Fehler"}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <>
                    <tr key={backup.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="text-neutral-400">
                            <BackupIcon />
                          </div>
                          <span className="font-mono text-xs text-neutral-900">
                            {backup.filename}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={backup.location === "s3" ? "info" : "default"}>
                          {backup.location === "s3" ? t("s3") : t("local")}
                        </Badge>
                      </td>
                      <td className="text-sm text-neutral-600">{formatSize(backup.sizeBytes)}</td>
                      <td>
                        <Badge variant={backup.status === "success" ? "success" : "danger"}>
                          {backup.status === "success"
                            ? (locale === "en" ? "Success" : "Erfolgreich")
                            : (locale === "en" ? "Failed" : "Fehlgeschlagen")}
                        </Badge>
                      </td>
                      <td className="text-xs text-neutral-500">{formatDate(backup.createdAt)}</td>
                      <td>
                        {backup.error ? (
                          <button
                            type="button"
                            onClick={() => toggleError(backup.id)}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors"
                          >
                            <span className="max-w-[180px] truncate">
                              {expandedErrors.has(backup.id) ? "" : backup.error}
                            </span>
                            <ChevronDown open={expandedErrors.has(backup.id)} />
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                    {backup.error && expandedErrors.has(backup.id) && (
                      <tr key={`${backup.id}-error`} className="bg-red-50">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="whitespace-pre-wrap break-all rounded-lg bg-red-100 p-3 text-xs text-red-800 font-mono">
                            {backup.error}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
