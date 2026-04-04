"use client";

import { useState, useEffect } from "react";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept(level: "all" | "essential") {
    localStorage.setItem(
      "cookie-consent",
      JSON.stringify({ level, timestamp: new Date().toISOString() })
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-neutral-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-neutral-600">
          Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung auf unserer
          Website zu bieten.{" "}
          <a
            href="/datenschutz"
            className="font-medium text-black underline underline-offset-2 transition-colors hover:text-neutral-600"
          >
            Mehr erfahren
          </a>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => accept("essential")}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Nur essenzielle
          </button>
          <button
            type="button"
            onClick={() => accept("all")}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
