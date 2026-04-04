"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Select } from "@/components/shared/Select";
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

export default function AdminBackupsPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [backupLocation, setBackupLocation] = useState("local");

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

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

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

  const successCount = backups.filter((b) => b.status === "success").length;
  const failedCount = backups.filter((b) => b.status === "failed").length;
  const totalSize = backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("backups")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {backups.length} {locale === "en" ? "backups" : "Backups"} &middot; {formatSize(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36">
            <Select
              options={locationOptions}
              value={backupLocation}
              onChange={(e) => setBackupLocation(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            loading={creating}
            onClick={createBackup}
          >
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
                      <Badge
                        variant={backup.location === "s3" ? "info" : "default"}
                      >
                        {backup.location === "s3" ? t("s3") : t("local")}
                      </Badge>
                    </td>
                    <td className="text-sm text-neutral-600">
                      {formatSize(backup.sizeBytes)}
                    </td>
                    <td>
                      <Badge
                        variant={backup.status === "success" ? "success" : "danger"}
                      >
                        {backup.status === "success"
                          ? (locale === "en" ? "Success" : "Erfolgreich")
                          : (locale === "en" ? "Failed" : "Fehlgeschlagen")}
                      </Badge>
                    </td>
                    <td className="text-xs text-neutral-500">
                      {formatDate(backup.createdAt)}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-red-600">
                      {backup.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
