"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

type Period = "today" | "week" | "month" | "30days";

export default function AdminAnalyticsPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30days");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/analytics?period=${period}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Analytics fetch error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [period]);

  const periods: { value: Period; labelKey: "today" | "thisWeek" | "thisMonth" | "last30Days" }[] = [
    { value: "today", labelKey: "today" },
    { value: "week", labelKey: "thisWeek" },
    { value: "month", labelKey: "thisMonth" },
    { value: "30days", labelKey: "last30Days" },
  ];

  const visitorTrends = data?.pageViews?.visitorTrends || [];
  const topPages = data?.pageViews?.topPages || [];
  const stockDemand = data?.stockDemand || [];
  const totals = data?.pageViews?.totals || { totalViews: 0, uniqueVisitors: 0, uniquePaths: 0 };
  const maxVisitors = Math.max(...visitorTrends.map((d: any) => d.uniqueVisitors), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("analytics")}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t("pageViewsLabel")} & {t("stockDemand")}</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{t("pageViewsLabel")}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{totals.totalViews.toLocaleString("de-DE")}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{t("visitors")}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{totals.uniqueVisitors.toLocaleString("de-DE")}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Seiten</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{totals.uniquePaths.toLocaleString("de-DE")}</p>
            </div>
          </div>

          {/* Visitor chart */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("visitors")}</h2>
            </div>
            <div className="px-6 py-6">
              {visitorTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
              ) : (
                <div className="flex items-end gap-1" style={{ height: 220 }}>
                  {visitorTrends.map((day: any) => {
                    const heightPercent = (day.uniqueVisitors / maxVisitors) * 100;
                    return (
                      <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                        <span className="text-[10px] font-medium text-neutral-500">
                          {day.uniqueVisitors}
                        </span>
                        <div
                          className="w-full rounded-t bg-neutral-900 transition-all"
                          style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: 4 }}
                        />
                        <span className="text-[10px] text-neutral-400">
                          {new Date(day.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top pages */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-neutral-900">{t("topPages")}</h2>
              </div>
              {topPages.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table w-full">
                    <thead>
                      <tr>
                        <th>Pfad</th>
                        <th className="text-right">{t("pageViewsLabel")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPages.slice(0, 15).map((page: any, idx: number) => (
                        <tr key={idx}>
                          <td className="font-mono text-xs">{page.path}</td>
                          <td className="text-right text-sm font-medium">{page.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Stock demand */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-neutral-900">{t("stockDemand")}</h2>
              </div>
              {stockDemand.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table w-full">
                    <thead>
                      <tr>
                        <th>{t("productName")}</th>
                        <th>{t("variants")}</th>
                        <th className="text-right">Anfragen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockDemand.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="text-sm font-medium">{item.productName}</td>
                          <td className="text-xs text-neutral-500">{item.variantName} ({item.variantSku})</td>
                          <td className="text-right text-sm font-semibold">{item.requestCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
