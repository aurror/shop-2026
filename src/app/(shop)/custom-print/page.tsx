"use client";

import { useState, useRef } from "react";

export default function CustomPrintPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    description: "",
    files: null as FileList | null,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("phone", form.phone);
      body.append("description", form.description);
      if (form.files) {
        Array.from(form.files).forEach((f) => body.append("files", f));
      }
      const res = await fetch("/api/custom-print-request", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Fehler beim Senden. Bitte versuchen Sie es erneut.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Hero with tinted background */}
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-800">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-amber-400">
            Maßgeschneidert
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ihr individueller 3D-Druck
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-300">
            Sie haben eine Idee, ein Maß oder eine CAD-Datei — wir drucken oder konstruieren und
            drucken für Sie. Ob Ersatzteil, Zubehör oder komplett neues Bauteil: Sprechen Sie uns an.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Steps */}
        <div className="-mt-8 mb-16 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Anfrage stellen",
              desc: "Beschreiben Sie Ihr Vorhaben. Skizze, CAD-Datei oder Foto — schicken Sie alles mit.",
              accent: "border-t-amber-500",
            },
            {
              step: "02",
              title: "Angebot erhalten",
              desc: "Wir prüfen Ihre Anfrage und melden uns zeitnah mit einem unverbindlichen Angebot.",
              accent: "border-t-amber-400",
            },
            {
              step: "03",
              title: "Wir drucken",
              desc: "Nach Ihrer Freigabe fertigen wir Ihr Teil und versenden es sicher per DHL.",
              accent: "border-t-amber-300",
            },
          ].map(({ step, title, desc, accent }) => (
            <div
              key={step}
              onClick={scrollToForm}
              className={`cursor-pointer rounded-xl border border-neutral-200 border-t-4 ${accent} bg-white p-6 shadow-sm transition-shadow hover:shadow-md`}
            >
              <p className="mb-3 font-mono text-2xl font-light text-amber-400">{step}</p>
              <h3 className="mb-2 font-semibold text-neutral-900">{title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* What we offer */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="font-semibold text-neutral-900">Was wir anbieten</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-neutral-600">
              {[
                "Fertigung nach Ihrer CAD-Datei (STL, STEP, …)",
                "Konstruktion & Druck nach Skizze oder Beschreibung",
                "Ersatzteile für Modellbahn-Fahrzeuge und -Anlagen",
                "Kleinserien und Einzelstücke",
                "Verschiedene Materialien (PLA, PETG, Resin, …)",
                "Lackiert oder unlackiert nach Wunsch",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="font-semibold text-neutral-900">Preise & Lieferzeit</h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-neutral-600">
              Der Preis richtet sich nach Komplexität, Material und Stückzahl. Einfache Teile starten
              ab wenigen Euro — komplexe Konstruktionsaufträge werden individuell kalkuliert.
            </p>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                Typische Lieferzeit: <span className="font-semibold">3–7 Werktage</span>{" "}
                nach Auftragsfreigabe.
              </p>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              Alle Preise inkl. 19 % MwSt. · Versandkosten werden separat ausgewiesen.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div ref={formRef} className="mb-16 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900">Anfrage senden</h2>
          <p className="mb-8 text-sm text-neutral-500">
            Kostenfrei und unverbindlich. Wir antworten in der Regel innerhalb von 24 Stunden.
          </p>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-7 w-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Anfrage erhalten!</h3>
            <p className="max-w-sm text-sm text-neutral-500">
              Vielen Dank. Wir haben Ihre Anfrage erhalten und melden uns so bald wie möglich bei
              Ihnen.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Max Mustermann"
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-4 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  E-Mail <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="max@beispiel.de"
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-4 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Telefon{" "}
                <span className="font-normal text-neutral-400">(optional, für Rückfragen)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+49 123 456789"
                className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-4 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Beschreibung Ihres Wunschteils <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Bitte beschreiben Sie so genau wie möglich, was Sie benötigen: Maße, Material, Funktion, Stückzahl, Farbwunsch …"
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Dateien{" "}
                <span className="font-normal text-neutral-400">
                  (optional — STL, STEP, Foto, Skizze, …)
                </span>
              </label>
              <input
                type="file"
                multiple
                accept=".stl,.step,.stp,.obj,.3mf,.jpg,.jpeg,.png,.pdf,.zip"
                onChange={(e) => setForm((f) => ({ ...f, files: e.target.files }))}
                className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
              />
              <p className="mt-1.5 text-xs text-neutral-400">Max. 100 MB pro Datei. Bei größeren Dateien nutzen Sie bitte einen Filehosting-Dienst (z.B. WeTransfer) und teilen den Link in der Beschreibung.</p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 sm:w-auto sm:px-12"
              >
                {sending ? "Wird gesendet…" : "Anfrage absenden"}
              </button>
              <p className="mt-3 text-xs text-neutral-400">
                Mit dem Absenden stimmen Sie zu, dass wir Ihre Daten zur Bearbeitung Ihrer Anfrage
                verwenden. Details in unserer{" "}
                <a href="/datenschutz" className="underline hover:text-neutral-700">
                  Datenschutzerklärung
                </a>
                .
              </p>
            </div>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
