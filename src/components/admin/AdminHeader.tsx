"use client";

import { useLocale } from "./LocaleContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AdminHeaderProps {
  unreadCount: number;
  userName?: string | null;
  onMenuToggle: () => void;
  onLogout: () => void;
  a11yMode: boolean;
  onToggleA11y: () => void;
}

interface SearchResult {
  id: string;
  label: string;
  href: string;
  type: string;
}

interface SearchResults {
  products?: SearchResult[];
  orders?: SearchResult[];
  users?: SearchResult[];
  categories?: SearchResult[];
  discounts?: SearchResult[];
  requests?: SearchResult[];
}

const GROUP_LABELS: Record<string, string> = {
  products: "Produkte",
  orders: "Bestellungen",
  users: "Kunden",
  categories: "Kategorien",
  discounts: "Rabatte",
  requests: "Anfragen",
};

export function AdminHeader({ unreadCount, userName, onMenuToggle, onLogout, a11yMode, onToggleA11y }: AdminHeaderProps) {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({});
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults({}); setShowResults(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setShowResults(true);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, doSearch]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allGroups = Object.entries(searchResults).filter(([, v]) => v && v.length > 0);
  const hasResults = allGroups.length > 0;

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenuToggle} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:hidden" aria-label="Toggle menu">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="hidden text-xs font-medium text-neutral-400 lg:block">Admin</span>
      </div>

      {/* Search — takes all available space */}
      <div ref={searchRef} className="relative mx-4 flex-1">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (hasResults) setShowResults(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") { setShowResults(false); setSearchQuery(""); } }}
            placeholder="Suchen…"
            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-8 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 focus:bg-white"
          />
          {searching && (
            <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        {showResults && searchQuery.length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
            {!hasResults && !searching && (
              <p className="px-4 py-6 text-center text-sm text-neutral-400">Keine Ergebnisse für „{searchQuery}"</p>
            )}
            {allGroups.map(([group, results]) => (
              <div key={group}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {GROUP_LABELS[group] || group}
                </p>
                {(results as SearchResult[]).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setShowResults(false); setSearchQuery(""); router.push(r.href); }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="flex-1 truncate text-neutral-900">{r.label}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{r.href.split("/").slice(2, 3).join("")}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — language + a11y hidden on mobile (shown in bottom bar) */}
      <div className="flex items-center gap-2">
        {/* Language toggle — desktop only */}
        <div className="hidden items-center rounded-lg border border-neutral-200 bg-neutral-50 sm:flex">
          <button type="button" onClick={() => setLocale("de")} className={`rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${locale === "de" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"}`}>DE</button>
          <button type="button" onClick={() => setLocale("en")} className={`rounded-r-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${locale === "en" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"}`}>EN</button>
        </div>

        {/* Accessibility toggle — desktop only */}
        <button type="button" onClick={onToggleA11y} title={a11yMode ? "Barrierefreiheit deaktivieren" : "Barrierefreiheit aktivieren"} aria-pressed={a11yMode} className={`hidden rounded-lg p-2 transition-colors sm:block ${a11yMode ? "bg-blue-600 text-white hover:bg-blue-700" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Notification bell */}
        <a href="/admin/notifications" className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label={t("notifications")}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </a>

        {/* User */}
        <div className="group relative flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
            {userName ? userName.charAt(0).toUpperCase() : "A"}
          </div>
          <span className="hidden text-sm font-medium text-neutral-700 sm:block">{userName || "Admin"}</span>
          {/* "Zum Shop" — appears on hover */}
          <a
            href="/"
            className="hidden items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-all hover:border-neutral-300 hover:text-black group-hover:flex"
            title="Zum Shop"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
            </svg>
            Zum Shop
          </a>
          <button type="button" onClick={onLogout} className="ml-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" title={t("logout")}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
