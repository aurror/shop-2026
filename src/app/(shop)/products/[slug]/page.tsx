import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  products,
  productVariants,
  categories,
  productRelations,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
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
    for (const rel of relations) {
      const rp = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          basePrice: products.basePrice,
          compareAtPrice: products.compareAtPrice,
          images: products.images,
        })
        .from(products)
        .where(
          and(eq(products.id, rel.relatedProductId), eq(products.active, true))
        )
        .limit(1);

      if (rp.length) {
        relatedProducts.push({
          ...rp[0],
          images: (rp[0].images as string[]) || [],
          relationType: rel.relationType,
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

  return {
    title: product.metaTitle || product.name,
    description:
      product.metaDescription ||
      product.description?.slice(0, 160) ||
      `${product.name} – Jetzt bei 3DPrintIt kaufen`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetail product={product} />;
}
