"use client";

import { useState } from "react";

export function AccountSecurity() {
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<"form" | "verify">("form");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setPwMsg({ type: "error", text: "Neue Passwörter stimmen nicht überein" });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ type: "error", text: data.error || "Fehler" });
      } else {
        setPwMsg({ type: "success", text: "Passwort erfolgreich geändert" });
        setPwCurrent(""); setPwNew(""); setPwConfirm("");
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailMsg({ type: "error", text: data.error || "Fehler" });
      } else {
        setEmailStep("verify");
        setEmailMsg({ type: "success", text: `Bestätigungscode wurde an ${newEmail} gesendet.` });
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res = await fetch("/api/account/confirm-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailMsg({ type: "error", text: data.error || "Fehler" });
      } else {
        setEmailMsg({ type: "success", text: `E-Mail-Adresse erfolgreich zu ${data.newEmail} geändert. Bitte neu anmelden.` });
        setEmailStep("form");
        setNewEmail(""); setEmailCode("");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-neutral-900">Sicherheit</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Password change */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h3 className="mb-4 text-base font-medium text-neutral-900">Passwort ändern</h3>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Aktuelles Passwort</label>
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Neues Passwort</label>
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Neues Passwort bestätigen</label>
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            {pwMsg && (
              <p className={`text-sm ${pwMsg.type === "error" ? "text-red-600" : "text-green-700"}`}>{pwMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={pwLoading}
              className="mt-1 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-neutral-700 transition-colors"
            >
              {pwLoading ? "Wird gespeichert…" : "Passwort ändern"}
            </button>
          </form>
        </div>

        {/* Email change */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h3 className="mb-4 text-base font-medium text-neutral-900">E-Mail-Adresse ändern</h3>
          {emailStep === "form" ? (
            <form onSubmit={handleEmailRequest} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Neue E-Mail-Adresse</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              {emailMsg && (
                <p className={`text-sm ${emailMsg.type === "error" ? "text-red-600" : "text-green-700"}`}>{emailMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={emailLoading}
                className="mt-1 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-neutral-700 transition-colors"
              >
                {emailLoading ? "Wird gesendet…" : "Bestätigungscode senden"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailConfirm} className="space-y-3">
              {emailMsg && (
                <p className={`text-sm ${emailMsg.type === "error" ? "text-red-600" : "text-green-700"}`}>{emailMsg.text}</p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">6-stelliger Code aus der E-Mail</label>
                <input
                  type="text"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  required
                  maxLength={6}
                  placeholder="123456"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono tracking-widest focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-neutral-700 transition-colors"
                >
                  {emailLoading ? "Prüfe…" : "Bestätigen"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEmailStep("form"); setEmailMsg(null); }}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Zurück
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
