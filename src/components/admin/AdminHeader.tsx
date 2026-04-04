"use client";

import { useLocale } from "./LocaleContext";

interface AdminHeaderProps {
  unreadCount: number;
  userName?: string | null;
  onMenuToggle: () => void;
  onLogout: () => void;
}

export function AdminHeader({
  unreadCount,
  userName,
  onMenuToggle,
  onLogout,
}: AdminHeaderProps) {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-6">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-neutral-900 lg:text-base">
          3DPrintIt Admin
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={() => setLocale("de")}
            className={`rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              locale === "de"
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            DE
          </button>
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={`rounded-r-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              locale === "en"
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            EN
          </button>
        </div>

        {/* Notification bell */}
        <a
          href="/admin/notifications"
          className="relative rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label={t("notifications")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </a>

        {/* User menu */}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
            {userName ? userName.charAt(0).toUpperCase() : "A"}
          </div>
          <span className="hidden text-sm font-medium text-neutral-700 sm:block">
            {userName || "Admin"}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="ml-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            title={t("logout")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
