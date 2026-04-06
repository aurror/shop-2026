"use client";

import { useLocale } from "./LocaleContext";

interface MobileFooterControlsProps {
  a11yMode: boolean;
  onToggleA11y: () => void;
}

export function MobileFooterControls({ a11yMode, onToggleA11y }: MobileFooterControlsProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div className="mt-8 flex items-center justify-center gap-4 border-t border-neutral-200 py-4 sm:hidden">
      <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50">
        <button
          type="button"
          onClick={() => setLocale("de")}
          className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${locale === "de" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"}`}
        >
          DE
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${locale === "en" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"}`}
        >
          EN
        </button>
      </div>
      <button
        type="button"
        onClick={onToggleA11y}
        aria-pressed={a11yMode}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${a11yMode ? "bg-blue-600 text-white" : "border border-neutral-200 bg-neutral-50 text-neutral-600"}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Barrierefreiheit
      </button>
    </div>
  );
}
