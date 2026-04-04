import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { products, productVariants, categories } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { ProductCard } from "@/components/shop/ProductCard";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

async function getFeaturedProducts() {
  const items = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      images: products.images,
      featured: products.featured,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.active, true), eq(products.featured, true)))
    .orderBy(desc(products.createdAt))
    .limit(8);

  const productIds = items.map((p) => p.id);
  let allVariants: any[] = [];
  if (productIds.length > 0) {
    allVariants = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.active, true),
          sql`${productVariants.productId} = ANY(${productIds})`
        )
      )
      .orderBy(asc(productVariants.sortOrder));
  }

  return items.map((p) => {
    const vars = allVariants.filter((v) => v.productId === p.id);
    const prices = vars
      .map((v) => (v.price ? parseFloat(v.price) : parseFloat(p.basePrice)))
      .filter((pr) => !isNaN(pr));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      images: (p.images as string[]) || [],
      featured: p.featured,
      category: p.categoryId
        ? { name: p.categoryName!, slug: p.categorySlug! }
        : null,
      variants: vars.map((v: any) => ({
        id: v.id,
        price: v.price,
        stock: v.stock,
      })),
      minPrice: prices.length > 0 ? Math.min(...prices) : parseFloat(p.basePrice),
      totalStock: vars.reduce((sum: number, v: any) => sum + v.stock, 0),
    };
  });
}

async function getNewArrivals() {
  const items = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      images: products.images,
      featured: products.featured,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.active, true))
    .orderBy(desc(products.createdAt))
    .limit(8);

  const productIds = items.map((p) => p.id);
  let allVariants: any[] = [];
  if (productIds.length > 0) {
    allVariants = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.active, true),
          sql`${productVariants.productId} = ANY(${productIds})`
        )
      )
      .orderBy(asc(productVariants.sortOrder));
  }

  return items.map((p) => {
    const vars = allVariants.filter((v) => v.productId === p.id);
    const prices = vars
      .map((v) => (v.price ? parseFloat(v.price) : parseFloat(p.basePrice)))
      .filter((pr) => !isNaN(pr));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      images: (p.images as string[]) || [],
      featured: p.featured,
      category: p.categoryId
        ? { name: p.categoryName!, slug: p.categorySlug! }
        : null,
      variants: vars.map((v: any) => ({
        id: v.id,
        price: v.price,
        stock: v.stock,
      })),
      minPrice: prices.length > 0 ? Math.min(...prices) : parseFloat(p.basePrice),
      totalStock: vars.reduce((sum: number, v: any) => sum + v.stock, 0),
    };
  });
}

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
  const [featuredProducts, newArrivals, allCategories] = await Promise.all([
    getFeaturedProducts(),
    getNewArrivals(),
    getCategories(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-neutral-100 bg-neutral-50">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            3DPrintIt
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black sm:text-5xl lg:text-6xl">
            Modelleisenbahn &amp; 3D-Druck
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500">
            Hochwertige Modellbauzubehörteile, präzise gefertigt mit modernster
            3D-Drucktechnik. Für Sammler und Modellbauer.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/products"
              className="inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Alle Produkte
            </Link>
            {allCategories.length > 0 && (
              <Link
                href={`/kategorie/${allCategories[0].slug}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-300 bg-white px-8 text-sm font-medium text-black transition-colors hover:bg-neutral-50"
              >
                Kategorien entdecken
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                Empfehlungen
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Unsere beliebtesten Produkte
              </p>
            </div>
            <Link
              href="/products?featured=true"
              className="hidden text-sm font-medium text-neutral-500 transition-colors hover:text-black sm:block"
            >
              Alle ansehen &rarr;
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/products?featured=true"
              className="text-sm font-medium text-neutral-500 transition-colors hover:text-black"
            >
              Alle ansehen &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* Category showcase */}
      {allCategories.length > 0 && (
        <section className="border-y border-neutral-100 bg-neutral-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                Kategorien
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
                    <h3 className="text-base font-semibold text-black">
                      {cat.name}
                    </h3>
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
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                Neuheiten
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Unsere neuesten Produkte
              </p>
            </div>
            <Link
              href="/products?sort=newest"
              className="hidden text-sm font-medium text-neutral-500 transition-colors hover:text-black sm:block"
            >
              Alle ansehen &rarr;
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/products?sort=newest"
              className="text-sm font-medium text-neutral-500 transition-colors hover:text-black"
            >
              Alle ansehen &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* If no products at all, show empty state */}
      {featuredProducts.length === 0 && newArrivals.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <svg
            className="mx-auto h-12 w-12 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
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
