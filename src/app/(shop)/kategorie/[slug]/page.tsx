import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { products, productVariants, categories } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { ProductCard } from "@/components/shop/ProductCard";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

async function getCategory(slug: string) {
  const cat = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return cat[0] || null;
}

async function getCategoryProducts(categoryId: string) {
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
    })
    .from(products)
    .where(
      and(eq(products.active, true), eq(products.categoryId, categoryId))
    )
    .orderBy(desc(products.createdAt));

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
      variants: vars.map((v: any) => ({
        id: v.id,
        price: v.price,
        stock: v.stock,
      })),
      minPrice:
        prices.length > 0 ? Math.min(...prices) : parseFloat(p.basePrice),
      totalStock: vars.reduce((sum: number, v: any) => sum + v.stock, 0),
    };
  });
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    return { title: "Kategorie nicht gefunden" };
  }

  return {
    title: category.name,
    description:
      category.description ||
      `${category.name} – Alle Produkte in dieser Kategorie bei 3DPrintIt`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = await getCategoryProducts(category.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-400">
          <li>
            <Link href="/" className="transition-colors hover:text-black">
              Startseite
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/products" className="transition-colors hover:text-black">
              Produkte
            </Link>
          </li>
          <li>/</li>
          <li className="text-neutral-600">{category.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {category.description}
          </p>
        )}
        <p className="mt-2 text-sm text-neutral-400">
          {categoryProducts.length}{" "}
          {categoryProducts.length === 1 ? "Produkt" : "Produkte"}
        </p>
      </div>

      {/* Products grid */}
      {categoryProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categoryProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
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
          <h2 className="mt-4 text-base font-semibold text-black">
            Noch keine Produkte
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            In dieser Kategorie gibt es aktuell keine Produkte.
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Alle Produkte ansehen
          </Link>
        </div>
      )}
    </div>
  );
}
