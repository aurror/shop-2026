"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/admin/LocaleContext";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";

type Tab = "overview" | "products" | "feed";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  dailyBudget: string;
  totalSpent: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: string;
}

interface Stats {
  advertisedProducts: number;
  totalProducts: number;
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  ctr: number;
  convRate: number;
  avgCpc: number;
  roas: number;
}

interface ProductAd {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  images: string[];
  tags: string[];
  categoryName: string | null;
  totalStock: number;
  adConfigId: string | null;
  advertised: boolean | null;
  customTitle: string | null;
  customDescription: string | null;
  googleProductCategory: string | null;
  adKeywords: string[];
  maxCpc: string | null;
  priority: string | null;
  campaignId: string | null;
  adImpressions: number | null;
  adClicks: number | null;
  adConversions: number | null;
  adCost: string | null;
  adRevenue: string | null;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("de-DE").format(n);
}

export default function AdvertisingPage() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  // Overview state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedUrl, setFeedUrl] = useState("");

  // Products state
  const [adProducts, setAdProducts] = useState<ProductAd[]>([]);
  const [adPage, setAdPage] = useState(1);
  const [adTotal, setAdTotal] = useState(0);
  const [adFilter, setAdFilter] = useState<"all" | "advertised" | "not_advertised">("all");
  const [editingProduct, setEditingProduct] = useState<ProductAd | null>(null);
  const [editForm, setEditForm] = useState({
    advertised: false,
    customTitle: "",
    customDescription: "",
    googleProductCategory: "",
    adKeywords: "",
    maxCpc: "",
    priority: "medium",
    campaignId: "",
  });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/advertising?section=overview");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns);
        setStats(data.stats);
        setFeedUrl(data.feedUrl);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/advertising?section=products&page=${adPage}&filter=${adFilter}`
      );
      if (res.ok) {
        const data = await res.json();
        setAdProducts(data.products);
        setAdTotal(data.pagination.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [adPage, adFilter]);

  useEffect(() => {
    if (tab === "overview") fetchOverview();
    else if (tab === "products") fetchProducts();
    else setLoading(false);
  }, [tab, fetchOverview, fetchProducts]);

  async function updateCampaign(campaignId: string, data: Record<string, unknown>) {
    const res = await fetch("/api/admin/advertising", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, ...data }),
    });
    if (res.ok) {
      addToast("success", t("saved"));
      fetchOverview();
    } else {
      addToast("error", "Fehler");
    }
  }

  async function saveProductAd() {
    if (!editingProduct) return;
    const res = await fetch("/api/admin/advertising", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: editingProduct.id,
        advertised: editForm.advertised,
        customTitle: editForm.customTitle,
        customDescription: editForm.customDescription,
        googleProductCategory: editForm.googleProductCategory,
        adKeywords: editForm.adKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        maxCpc: editForm.maxCpc || null,
        priority: editForm.priority,
        campaignId: editForm.campaignId || null,
      }),
    });
    if (res.ok) {
      addToast("success", t("saved"));
      setEditingProduct(null);
      fetchProducts();
    } else {
      addToast("error", "Fehler");
    }
  }

  async function toggleAdvertised(product: ProductAd) {
    await fetch("/api/admin/advertising", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        advertised: !(product.advertised ?? false),
      }),
    });
    fetchProducts();
  }

  function openEdit(p: ProductAd) {
    setEditingProduct(p);
    setEditForm({
      advertised: p.advertised ?? false,
      customTitle: p.customTitle || "",
      customDescription: p.customDescription || "",
      googleProductCategory: p.googleProductCategory || "",
      adKeywords: (p.adKeywords || []).join(", "),
      maxCpc: p.maxCpc || "",
      priority: p.priority || "medium",
      campaignId: p.campaignId || "",
    });
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? "bg-neutral-900 text-white"
        : "text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{t("advertising")}</h1>
        <div className="flex gap-1 rounded-xl bg-neutral-50 p-1">
          <button onClick={() => setTab("overview")} className={tabClass("overview")}>
            Übersicht
          </button>
          <button onClick={() => setTab("products")} className={tabClass("products")}>
            {t("products")}
          </button>
          <button onClick={() => setTab("feed")} className={tabClass("feed")}>
            {t("merchantFeed")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : tab === "overview" ? (
        <OverviewTab
          stats={stats}
          campaigns={campaigns}
          onUpdateCampaign={updateCampaign}
          feedUrl={feedUrl}
        />
      ) : tab === "products" ? (
        <ProductsTab
          products={adProducts}
          page={adPage}
          total={adTotal}
          filter={adFilter}
          campaigns={campaigns}
          editingProduct={editingProduct}
          editForm={editForm}
          onFilterChange={(f) => { setAdFilter(f); setAdPage(1); }}
          onPageChange={setAdPage}
          onToggle={toggleAdvertised}
          onEdit={openEdit}
          onEditFormChange={(field, val) => setEditForm((p) => ({ ...p, [field]: val }))}
          onSaveEdit={saveProductAd}
          onCancelEdit={() => setEditingProduct(null)}
          t={t}
        />
      ) : (
        <FeedTab feedUrl={feedUrl} />
      )}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  campaigns,
  onUpdateCampaign,
  feedUrl,
}: {
  stats: Stats | null;
  campaigns: Campaign[];
  onUpdateCampaign: (id: string, data: Record<string, unknown>) => void;
  feedUrl: string;
}) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Beworben" value={`${stats.advertisedProducts} / ${stats.totalProducts}`} sub="Produkte" />
        <StatCard label="Ausgaben" value={fmt(stats.totalSpent)} />
        <StatCard label="Impressionen" value={fmtNum(stats.totalImpressions)} />
        <StatCard label="Klicks" value={fmtNum(stats.totalClicks)} sub={`CTR: ${fmtPct(stats.ctr)}`} />
        <StatCard label="Conversions" value={fmtNum(stats.totalConversions)} sub={`Rate: ${fmtPct(stats.convRate)}`} />
        <StatCard label="ROAS" value={stats.roas > 0 ? `${stats.roas.toFixed(1)}x` : "—"} sub={stats.totalRevenue > 0 ? `Umsatz: ${fmt(stats.totalRevenue)}` : undefined} />
      </div>

      {/* Campaigns */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Kampagnen</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} campaign={c} onUpdate={onUpdateCampaign} />
          ))}
        </div>
      </div>

      {/* Feed info */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Google Merchant Center Feed</h3>
        <p className="text-xs text-neutral-500 mb-3">
          Trage diese URL im Google Merchant Center als Produkt-Feed ein. Der Feed enthält alle aktiven Produkte mit Bestand &gt; 0.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700 break-all">
            {feedUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(feedUrl);
            }}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700"
          >
            Kopieren
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">💡 Tipps für Google Ads</h3>
        <ul className="space-y-2 text-xs text-blue-800">
          <li><strong>Shopping-Kampagnen:</strong> Höchste Priorität. Produkte erscheinen mit Bild & Preis in der Google-Suche. Betone &quot;3D-gedruckt&quot; oder &quot;Limitiert&quot; im Titel.</li>
          <li><strong>Suchanzeigen:</strong> Biete auf spezifische Artikelnummern und seltene Bezeichnungen (z.B. &quot;Preußischer Abteilwagen 41163 3D Druck&quot;). Geringe Klickkosten bei hoher Kaufabsicht.</li>
          <li><strong>Remarketing:</strong> Zeige Besuchern, die nicht gekauft haben, genau die angesehenen Artikel wieder an.</li>
          <li><strong>⚠️ Budget-Start:</strong> Beginne mit 5–10 € Tagesbudget und fokussiere auf Produkte mit Bestand &gt; 0.</li>
          <li><strong>⚠️ Lagerbestand:</strong> Produkte mit 0 Bestand werden automatisch aus dem Feed ausgeschlossen.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Campaign Row ────────────────────────────────────────────────────────────

function CampaignRow({
  campaign: c,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(c.dailyBudget);

  const typeLabels: Record<string, string> = {
    shopping: "🛒 Shopping",
    search: "🔍 Suchanzeigen",
    remarketing: "🔁 Remarketing",
  };

  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">{typeLabels[c.type] || c.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              c.status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {c.status === "active" ? "Aktiv" : "Pausiert"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
          <span>{fmtNum(c.impressions)} Impr.</span>
          <span>{fmtNum(c.clicks)} Klicks</span>
          <span>{fmtNum(c.conversions)} Conv.</span>
          <span>Ausgaben: {fmt(parseFloat(c.totalSpent))}</span>
          <span>Umsatz: {fmt(parseFloat(c.revenue))}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              step="0.50"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-neutral-400">€/Tag</span>
            <button
              onClick={() => {
                onUpdate(c.id, { dailyBudget: budget });
                setEditing(false);
              }}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            >
              ✓
            </button>
            <button
              onClick={() => { setBudget(c.dailyBudget); setEditing(false); }}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              ✗
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-neutral-700">{fmt(parseFloat(c.dailyBudget))}/Tag</span>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
          </>
        )}

        <button
          onClick={() => onUpdate(c.id, { status: c.status === "active" ? "paused" : "active" })}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            c.status === "active"
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-green-50 text-green-600 hover:bg-green-100"
          }`}
        >
          {c.status === "active" ? "Pausieren" : "Aktivieren"}
        </button>
      </div>
    </div>
  );
}

// ─── Products Tab ────────────────────────────────────────────────────────────

function ProductsTab({
  products,
  page,
  total,
  filter,
  campaigns,
  editingProduct,
  editForm,
  onFilterChange,
  onPageChange,
  onToggle,
  onEdit,
  onEditFormChange,
  onSaveEdit,
  onCancelEdit,
  t,
}: {
  products: ProductAd[];
  page: number;
  total: number;
  filter: string;
  campaigns: Campaign[];
  editingProduct: ProductAd | null;
  editForm: any;
  onFilterChange: (f: "all" | "advertised" | "not_advertised") => void;
  onPageChange: (p: number) => void;
  onToggle: (p: ProductAd) => void;
  onEdit: (p: ProductAd) => void;
  onEditFormChange: (field: string, val: any) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  t: (key: any) => string;
}) {
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(["all", "advertised", "not_advertised"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f === "all" ? "Alle" : f === "advertised" ? "Beworben" : "Nicht beworben"}
          </button>
        ))}
        <span className="self-center text-xs text-neutral-400">{total} Produkte</span>
      </div>

      {/* Edit modal */}
      {editingProduct && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">
            Anzeigeneinstellungen: {editingProduct.name}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={editForm.advertised}
                onChange={(e) => onEditFormChange("advertised", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900"
              />
              <span className="text-sm font-medium text-neutral-700">Produkt bewerben</span>
            </label>
            <Input
              label={t("adCustomTitle")}
              value={editForm.customTitle}
              onChange={(e) => onEditFormChange("customTitle", e.target.value)}
              placeholder="Leer = Produktname"
            />
            <Input
              label={t("adCustomDescription")}
              value={editForm.customDescription}
              onChange={(e) => onEditFormChange("customDescription", e.target.value)}
              placeholder="Leer = Produktbeschreibung"
            />
            <Input
              label={t("adGoogleCategory")}
              value={editForm.googleProductCategory}
              onChange={(e) => onEditFormChange("googleProductCategory", e.target.value)}
              placeholder="z.B. Spielzeug & Spiele > Modellbau"
            />
            <Input
              label={t("adKeywords")}
              value={editForm.adKeywords}
              onChange={(e) => onEditFormChange("adKeywords", e.target.value)}
              placeholder="Kommagetrennt: BR 01, Dampflok, H0"
            />
            <Input
              label={t("adMaxCpc") + " (€)"}
              type="number"
              step="0.01"
              min="0"
              value={editForm.maxCpc}
              onChange={(e) => onEditFormChange("maxCpc", e.target.value)}
              placeholder="z.B. 0.50"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">{t("adPriority")}</label>
              <select
                value={editForm.priority}
                onChange={(e) => onEditFormChange("priority", e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
              </select>
            </div>
            {campaigns.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Kampagne</label>
                <select
                  value={editForm.campaignId}
                  onChange={(e) => onEditFormChange("campaignId", e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Keine Zuordnung</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={onSaveEdit}>{t("save")}</Button>
            <Button variant="ghost" onClick={onCancelEdit}>{t("cancel")}</Button>
          </div>
        </div>
      )}

      {/* Product table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Produkt</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Bestand</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Preis</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Impr.</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Klicks</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500">Conv.</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-neutral-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
                        <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-neutral-900 line-clamp-1">{p.name}</p>
                      {p.categoryName && (
                        <p className="text-xs text-neutral-400">{p.categoryName}</p>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <div className="mt-0.5 flex gap-1">
                          {(p.tags as string[]).slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${p.totalStock === 0 ? "text-red-500" : p.totalStock <= 3 ? "text-amber-500" : "text-green-600"}`}>
                    {p.totalStock}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-700">
                  {fmt(parseFloat(p.basePrice))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.advertised
                        ? "bg-green-100 text-green-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {p.advertised ? "Beworben" : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {fmtNum(p.adImpressions ?? 0)}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {fmtNum(p.adClicks ?? 0)}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {fmtNum(p.adConversions ?? 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onToggle(p)}
                      title={p.advertised ? "Werbung stoppen" : "Bewerben"}
                      className={`rounded-lg p-1.5 text-xs transition-colors ${
                        p.advertised
                          ? "text-green-600 hover:bg-green-50"
                          : "text-neutral-400 hover:bg-neutral-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill={p.advertised ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a.75.75 0 0 1-1.021-.27l-.112-.192a24.425 24.425 0 0 1-1.314-2.66m2.582-1.552c3.297-.292 6.404-1.182 9.16-2.54V6.59a24.524 24.524 0 0 1-9.16-2.54m0 12.79v-12.79" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEdit(p)}
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-neutral-400">
                  Keine Produkte gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs disabled:opacity-30"
          >
            ←
          </button>
          <span className="self-center text-xs text-neutral-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Feed Tab ────────────────────────────────────────────────────────────────

function FeedTab({ feedUrl }: { feedUrl: string }) {
  const [preview, setPreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function loadPreview() {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/feeds/google-merchant");
      if (res.ok) {
        const text = await res.text();
        setPreview(text);
      }
    } catch { /* ignore */ }
    setLoadingPreview(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Google Merchant Center Feed</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-1">Feed-URL</h3>
            <p className="text-xs text-neutral-500 mb-2">
              Diese URL im Google Merchant Center unter &quot;Feeds&quot; → &quot;Geplanter Abruf&quot; eintragen.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700 break-all">
                {feedUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(feedUrl)}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700"
              >
                Kopieren
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Einrichtungsanleitung</h3>
            <ol className="space-y-2 text-xs text-neutral-600 list-decimal list-inside">
              <li>Gehe zu <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Merchant Center</a></li>
              <li>Klicke auf &quot;Produkte&quot; → &quot;Feeds&quot; → &quot;Neuen Feed erstellen&quot;</li>
              <li>Wähle &quot;Geplanter Abruf&quot; und füge die Feed-URL ein</li>
              <li>Setze den Abrufintervall auf &quot;Täglich&quot;</li>
              <li>Der Feed enthält automatisch nur Produkte mit Bestand &gt; 0</li>
              <li>Benutzerdefinierte Titel/Beschreibungen können pro Produkt im Tab &quot;Produkte&quot; gesetzt werden</li>
            </ol>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Feed-Spezifikationen</h3>
            <ul className="space-y-1 text-xs text-neutral-600">
              <li>• Format: RSS 2.0 mit Google-Namespace</li>
              <li>• Enthaltene Felder: id, title, description, link, image_link, price, sale_price, availability, condition, google_product_category, brand, mpn, item_group_id, shipping_weight</li>
              <li>• Benutzerdefinierte Labels (custom_label_0/1) werden aus Produkt-Tags generiert</li>
              <li>• Varianten werden als separate Items mit item_group_id exportiert</li>
              <li>• Ausverkaufte Varianten/Produkte werden automatisch ausgeschlossen</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feed preview */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-neutral-900">Feed-Vorschau</h3>
          <button
            onClick={loadPreview}
            disabled={loadingPreview}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
          >
            {loadingPreview ? "Laden…" : "Feed laden"}
          </button>
        </div>
        {preview && (
          <pre className="max-h-96 overflow-auto p-4 text-xs text-neutral-600 bg-neutral-50">
            {preview}
          </pre>
        )}
      </div>

      {/* Google Ads connection placeholder */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">⚡ Google Ads API-Anbindung</h3>
        <p className="text-xs text-amber-700 mb-3">
          Für automatische Kampagnensteuerung und Performance-Daten direkt im Dashboard werden folgende Umgebungsvariablen benötigt:
        </p>
        <ul className="space-y-1 text-xs text-amber-700 font-mono">
          <li>GOOGLE_MERCHANT_ID=&lt;deine Merchant Center ID&gt;</li>
          <li>GOOGLE_ADS_CUSTOMER_ID=&lt;deine Google Ads Kundennummer&gt;</li>
          <li>GOOGLE_ADS_DEVELOPER_TOKEN=&lt;Developer Token&gt;</li>
          <li>GOOGLE_ADS_CLIENT_ID=&lt;OAuth Client ID&gt;</li>
          <li>GOOGLE_ADS_CLIENT_SECRET=&lt;OAuth Client Secret&gt;</li>
          <li>GOOGLE_ADS_REFRESH_TOKEN=&lt;OAuth Refresh Token&gt;</li>
        </ul>
        <p className="mt-3 text-xs text-amber-600">
          Diese in <code className="bg-amber-100 px-1 rounded">.env</code> eintragen. Sobald konfiguriert, werden Performance-Daten automatisch synchronisiert.
        </p>
      </div>
    </div>
  );
}
