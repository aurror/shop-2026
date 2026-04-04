import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  products,
  productVariants,
  categories,
  productRelations,
} from "@/lib/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { ProductDetail } from "@/components/shop/ProductDetail";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  const product = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      descriptionHtml: products.descriptionHtml,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      images: products.images,
      featured: products.featured,
      weight: products.weight,
      taxRate: products.taxRate,
      categoryId: products.categoryId,
      metaTitle: products.metaTitle,
      metaDescription: products.metaDescription,
    })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);

  if (!product.length) return null;

  const p = product[0];

  // Get variants
  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, p.id),
        eq(productVariants.active, true)
      )
    )
    .orderBy(asc(productVariants.sortOrder));

  // Get category
  let category = null;
  if (p.categoryId) {
    const cat = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(eq(categories.id, p.categoryId))
      .limit(1);
    category = cat[0] || null;
  }

  // Get related products
  const relations = await db
    .select({
      relatedProductId: productRelations.relatedProductId,
      relationType: productRelations.relationType,
    })
    .from(productRelations)
    .where(eq(productRelations.productId, p.id))
    .orderBy(asc(productRelations.sortOrder));

  let relatedProducts: any[] = [];
  if (relations.length > 0) {
    const relatedIds = relations.map((r) => r.relatedProductId);

    // Fetch all related products in one query
    const rpRows = relatedIds.length > 0
      ? await db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            basePrice: products.basePrice,
            compareAtPrice: products.compareAtPrice,
            images: products.images,
            categoryId: products.categoryId,
          })
          .from(products)
          .where(
            and(
              eq(products.active, true),
              sql`${products.id} = ANY(ARRAY[${sql.join(relatedIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
            )
          )
      : [];

    if (rpRows.length > 0) {
      const rpIds = rpRows.map((r) => r.id);
      const rpCategoryIds = rpRows.map((r) => r.categoryId).filter(Boolean) as string[];

      // Fetch all variants and categories in bulk
      const [allRpVariants, allRpCategories] = await Promise.all([
        db
          .select({ id: productVariants.id, productId: productVariants.productId, price: productVariants.price, stock: productVariants.stock })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.active, true),
              sql`${productVariants.productId} = ANY(ARRAY[${sql.join(rpIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
            )
          ),
        rpCategoryIds.length > 0
          ? db
              .select({ id: categories.id, name: categories.name, slug: categories.slug })
              .from(categories)
              .where(
                sql`${categories.id} = ANY(ARRAY[${sql.join(rpCategoryIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
              )
          : Promise.resolve([]),
      ]);

      for (const rel of relations) {
        const rp = rpRows.find((r) => r.id === rel.relatedProductId);
        if (!rp) continue;

        const rpVariants = allRpVariants.filter((v) => v.productId === rp.id);
        const rpCategory = rp.categoryId
          ? allRpCategories.find((c) => c.id === rp.categoryId) || null
          : null;

        const minPrice = rpVariants.reduce((min: number | null, v) => {
          const price = v.price ? parseFloat(v.price) : null;
          if (price === null) return min;
          return min === null || price < min ? price : min;
        }, null) || parseFloat(rp.basePrice);

        const totalStock = rpVariants.reduce((sum, v) => sum + v.stock, 0);

        relatedProducts.push({
          ...rp,
          images: (rp.images as string[]) || [],
          relationType: rel.relationType,
          category: rpCategory,
          variants: rpVariants,
          minPrice,
          totalStock,
        });
      }
    }
  }

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    descriptionHtml: p.descriptionHtml,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    images: (p.images as string[]) || [],
    featured: p.featured,
    weight: p.weight,
    taxRate: p.taxRate,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    category,
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      weight: v.weight,
      attributes: (v.attributes as Record<string, string>) || {},
      images: (v.images as string[]) || [],
      active: v.active,
      sortOrder: v.sortOrder,
    })),
    relatedProducts,
  };
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Produkt nicht gefunden" };
  }

  const title = product.metaTitle || product.name;
  const description =
    product.metaDescription ||
    product.description?.slice(0, 160) ||
    `${product.name} – Jetzt bei 3DPrintIt kaufen`;
  const url = `https://3dprintit.de/products/${product.slug}`;
  const ogImage = product.images[0] || undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "3DPrintIt",
      locale: "de_DE",
      ...(ogImage ? { images: [{ url: ogImage, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

function ProductJsonLd({ product }: { product: NonNullable<Awaited<ReturnType<typeof getProduct>>> }) {
  const minPrice =
    product.variants.length > 0
      ? Math.min(
          ...product.variants.map((v) =>
            v.price ? parseFloat(v.price) : parseFloat(product.basePrice)
          )
        )
      : parseFloat(product.basePrice);

  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    image: product.images,
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "3DPrintIt" },
    offers: {
      "@type": "Offer",
      url: `https://3dprintit.de/products/${product.slug}`,
      priceCurrency: "EUR",
      price: minPrice.toFixed(2),
      availability:
        totalStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "3DPrintIt" },
    },
    ...(product.category
      ? {
          category: product.category.name,
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Produkte",
                item: "https://3dprintit.de/products",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: product.category.name,
                item: `https://3dprintit.de/kategorie/${product.category.slug}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: product.name,
              },
            ],
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetail product={product} />
    </>
  );
}
