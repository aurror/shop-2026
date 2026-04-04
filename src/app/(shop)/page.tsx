import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { ProductCard } from "@/components/shop/ProductCard";
import { evaluateHomepageRules } from "@/lib/homepage-rules";

async function getCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder));
}

export default async function HomePage() {
  const [{ sections }, allCategories] = await Promise.all([
    evaluateHomepageRules(),
    getCategories(),
  ]);

  const hasProducts = sections.some((s) => s.sectionType === "products");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-neutral-100">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero.avif')" }}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
            3DPrintIt
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
            Modelleisenbahn &amp; 3D-Druck
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
            Hochwertige Modellbauzubehörteile, präzise gefertigt mit modernster
            3D-Drucktechnik. Für Sammler und Modellbauer.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/products"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-medium text-black transition-colors hover:bg-neutral-100"
            >
              Alle Produkte
            </Link>
            {allCategories.length > 0 && (
              <Link
                href={`/kategorie/${allCategories[0].slug}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Kategorien entdecken
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Dynamic sections — order controlled in admin Frontpage Display */}
      {sections.map((section, i) => {
        if (section.sectionType === "products") {
          return (
            <section key={i} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
              <div className="flex items-end justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                  {section.label}
                </h2>
                <Link
                  href="/products"
                  className="hidden text-sm font-medium text-neutral-500 transition-colors hover:text-black sm:block"
                >
                  Alle ansehen &rarr;
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {section.products.map((product) => (
                  <ProductCard key={product.id} product={product as any} />
                ))}
              </div>
            </section>
          );
        }

        if (section.sectionType === "custom_3dprint") {
          return (
            <section key={i} className="border-y border-neutral-100 bg-neutral-50">
              <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
                <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
                  {/* Square image */}
                  <div className="h-64 w-64 flex-shrink-0 overflow-hidden rounded-2xl shadow-md">
                    <Image
                      src="/3dprint.jpg"
                      alt="Individueller 3D-Druck"
                      width={256}
                      height={256}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {/* Text */}
                  <div className="flex-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                      Maßanfertigung
                    </span>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                      {section.label}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-neutral-600">
                      Lassen Sie Ihre Idee Wirklichkeit werden. Wir fertigen präzise
                      3D-Drucke nach Ihren Maßen und Vorgaben — vom einfachen Ersatzteil
                      bis zum komplexen Modell.
                    </p>
                    <ul className="mt-4 space-y-1 text-sm text-neutral-500">
                      <li className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-neutral-400" />
                        Preis nach Aufwand und Material
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-neutral-400" />
                        Verschiedene Materialien &amp; Farben
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-neutral-400" />
                        Schnelle Lieferzeiten
                      </li>
                    </ul>
                    <div className="mt-6 flex items-center gap-4">
                      <Link
                        href="/custom-print"
                        className="inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                      >
                        Anfrage stellen
                      </Link>
                      <span className="text-sm text-neutral-400">Preis auf Anfrage</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (section.sectionType === "categories_showcase" && allCategories.length > 0) {
          return (
            <section key={i} className="border-y border-neutral-100 bg-neutral-50">
              <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                    {section.label}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500">
                    Finden Sie genau das, was Sie suchen
                  </p>
                </div>
                <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {allCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/kategorie/${cat.slug}`}
                      className="group flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 transition-all hover:border-neutral-300 hover:shadow-sm"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-black">{cat.name}</h3>
                        {cat.description && (
                          <p className="mt-2 text-sm leading-relaxed text-neutral-500 line-clamp-2">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <span className="mt-4 text-xs font-medium text-neutral-400 transition-colors group-hover:text-black">
                        Entdecken &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        return null;
      })}

      {/* Empty state */}
      {!hasProducts && (
        <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <svg className="mx-auto h-12 w-12 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-black">
            Noch keine Produkte
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Bald finden Sie hier unsere Produkte.
          </p>
        </section>
      )}
    </>
  );
}
