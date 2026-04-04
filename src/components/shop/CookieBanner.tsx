"use client";

import { useState, useEffect } from "react";

interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: number;
}

const CONSENT_VERSION = 1;

function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem("cookie-consent");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function saveConsent(consent: Omit<CookieConsent, "timestamp" | "version" | "essential">) {
    const full: CookieConsent = {
      essential: true,
      analytics: consent.analytics,
      marketing: consent.marketing,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(full));
    setVisible(false);
  }

  function acceptAll() {
    saveConsent({ analytics: true, marketing: true });
  }

  function acceptSelected() {
    saveConsent({ analytics, marketing });
  }

  function acceptEssentialOnly() {
    saveConsent({ analytics: false, marketing: false });
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-neutral-200 bg-white px-4 py-5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <p className="text-sm leading-relaxed text-neutral-600">
              Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung auf unserer
              Website zu bieten. Essenzielle Cookies sind für den Betrieb der Website
              notwendig. Darüber hinaus nutzen wir optionale Cookies für Analyse und Marketing.{" "}
              <a
                href="/datenschutz"
                className="font-medium text-black underline underline-offset-2 transition-colors hover:text-neutral-600"
              >
                Datenschutzerklärung
              </a>
            </p>

            {showDetails && (
              <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Essenzielle Cookies</p>
                    <p className="text-xs text-neutral-500">Für den Betrieb der Website notwendig (Warenkorb, Anmeldung)</p>
                  </div>
                  <span className="text-xs font-medium text-neutral-400">Immer aktiv</span>
                </div>
                <div className="border-t border-neutral-200" />
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Analyse-Cookies</p>
                    <p className="text-xs text-neutral-500">Helfen uns, die Nutzung der Website zu verstehen</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                  />
                </label>
                <div className="border-t border-neutral-200" />
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Marketing-Cookies</p>
                    <p className="text-xs text-neutral-500">Für personalisierte Inhalte und Werbung</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {showDetails ? "Weniger" : "Einstellungen"}
            </button>
            {showDetails ? (
              <button
                type="button"
                onClick={acceptSelected}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Auswahl speichern
              </button>
            ) : (
              <button
                type="button"
                onClick={acceptEssentialOnly}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Nur essenzielle
              </button>
            )}
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Alle akzeptieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Check if user has consented to a specific cookie category */
export function hasConsent(category: "analytics" | "marketing"): boolean {
  const consent = getStoredConsent();
  if (!consent) return false;
  return consent[category];
}

/** Allow user to revoke consent (call from settings/footer) */
export function revokeCookieConsent() {
  localStorage.removeItem("cookie-consent");
}
