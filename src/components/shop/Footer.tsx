import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="text-xl font-semibold tracking-tight text-black">
              3DPrintIt
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              Ihr Spezialist für Modelleisenbahn-Zubehör aus dem 3D-Drucker.
              Hochwertige Modelle, präzise gefertigt.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Shop
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href="/products"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Alle Produkte
                </Link>
              </li>
              <li>
                <Link
                  href="/products?featured=true"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Empfehlungen
                </Link>
              </li>
              <li>
                <Link
                  href="/products?sort=newest"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Neuheiten
                </Link>
              </li>
            </ul>
          </div>

          {/* Kundenservice */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Kundenservice
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href="/account"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Mein Konto
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Warenkorb
                </Link>
              </li>
            </ul>
          </div>

          {/* Rechtliches */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Rechtliches
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link
                  href="/impressum"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Impressum
                </Link>
              </li>
              <li>
                <Link
                  href="/datenschutz"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link
                  href="/agb"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  AGB
                </Link>
              </li>
              <li>
                <Link
                  href="/widerruf"
                  className="text-sm text-neutral-500 transition-colors hover:text-black"
                >
                  Widerrufsbelehrung
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment methods */}
        <div className="border-t border-neutral-100 py-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              {[
                { src: "/payment/visa.svg", alt: "Visa" },
                { src: "/payment/mastercard.svg", alt: "Mastercard" },
                { src: "/payment/klarna.svg", alt: "Klarna" },
              ].map(({ src, alt }) => (
                <div
                  key={alt}
                  className="flex h-8 w-12 items-center justify-center overflow-hidden rounded border border-neutral-200 bg-white"
                >
                  <Image src={src} alt={alt} width={40} height={26} className="object-contain" unoptimized />
                </div>
              ))}
              {/* Bank Transfer */}
              <div className="flex h-8 w-12 items-center justify-center rounded border border-neutral-200 bg-white">
                <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              Alle Preise inkl. MwSt., zzgl. Versandkosten
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-neutral-100 py-6">
          <p className="text-center text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} 3DPrintIt. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  );
}
