import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unser Team – 3DPrintIt",
  description:
    "Lernen Sie das Team hinter 3DPrintIt kennen. Leidenschaft für Modelleisenbahn, 3D-Druck und handwerkliche Präzision seit Jahrzehnten.",
};

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      {/* Header */}
      <div className="mb-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Wer wir sind
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
          Menschen mit Leidenschaft
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
          Hinter jedem Bauteil steckt echte Begeisterung. Wir sind keine anonyme
          Fabrik — wir sind Enthusiasten, die wissen, worauf es ankommt.
        </p>
      </div>

      {/* Mathias Horn — main profile */}
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-20">
        {/* Round portrait */}
        <div className="flex-shrink-0">
          <div className="relative h-56 w-56 overflow-hidden rounded-full border-4 border-neutral-100 shadow-lg sm:h-64 sm:w-64">
            {/* Placeholder avatar — replace src with real photo */}
            <div className="flex h-full w-full items-center justify-center bg-neutral-200">
              <svg
                className="h-28 w-28 text-neutral-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          </div>
          {/* Subtle decorative ring */}
          <div className="mt-4 text-center">
            <span className="inline-block rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
              Maker
            </span>
          </div>
        </div>

        {/* Bio text */}
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
            Mathias Horn
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-400">
            Modellbahn-Enthusiast · 3D-Druck-Pioneer · Maker
          </p>

          <div className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600">
            <p>
              Modelleisenbahn begleitet mich, seitdem ich denken kann. Was
              als Kind bei meinen Großeltern begann, ist heute ein echter Teil
              meines Lebens — Technik, Handwerk und ein bisschen Nostalgie in
              einem.
            </p>
            <p>
              Als 3D-Druck präzise genug für Modellbahn-Maßstäbe wurde, war
              ich sofort dabei. Ich habe viel ausprobiert, viel gelernt, und
              dieses Wissen steckt heute in jedem Teil, das 3DPrintIt verlässt.
            </p>
            <p>
              Ich habe viel ausprobiert, viel gelernt, und dieses Wissen
              steckt heute in jedem Teil, das 3DPrintIt verlässt.
            </p>
          </div>

          {/* Stats / highlights */}
          <div className="mt-8 grid grid-cols-3 gap-6 border-t border-neutral-100 pt-8">
            <div>
              <p className="text-2xl font-semibold text-black">25+</p>
              <p className="mt-0.5 text-xs text-neutral-500 leading-snug">
                Jahre Modellbahn-Erfahrung
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-black">1000+</p>
              <p className="mt-0.5 text-xs text-neutral-500 leading-snug">
                Teile gedruckt &amp; verschickt
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/custom-print"
              className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Maßanfertigung anfragen
            </Link>
            <Link
              href="/products"
              className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 px-6 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              Produkte entdecken
            </Link>
          </div>
        </div>
      </div>

      {/* Community quote */}
      <div className="mt-20 rounded-2xl border border-neutral-100 bg-neutral-50 px-8 py-10 text-center">
        <svg
          className="mx-auto mb-4 h-8 w-8 text-neutral-300"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-neutral-600 italic">
          "Modellbahn ist nicht nur ein Hobby. Es ist Erinnerung, Handwerk
          und Gemeinschaft in einem. Jedes Teil, das ich drucke, soll diesem
          Anspruch gerecht werden."
        </p>
        <p className="mt-4 text-sm font-medium text-neutral-900">Mathias Horn</p>
        <p className="text-xs text-neutral-400">Maker, 3DPrintIt</p>
      </div>
    </div>
  );
}
