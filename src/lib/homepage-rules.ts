import { db } from "@/lib/db";
import {
  products,
  productVariants,
  categories,
  orderItems,
  homepageRules,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, isNotNull } from "drizzle-orm";

export interface HomepageProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice?: string | null;
  images?: string[] | null;
  tags?: string[] | null;
  featured: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  minPrice?: number;
  ruleLabel?: string;
}

export type HomepageSection =
  | { sectionType: "products"; label: string; products: HomepageProduct[] }
  | { sectionType: "custom_3dprint"; label: string }
  | { sectionType: "categories_showcase"; label: string };

const BASE_SELECT = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  basePrice: products.basePrice,
  compareAtPrice: products.compareAtPrice,
  images: products.images,
  tags: products.tags,
  featured: products.featured,
  categoryId: products.categoryId,
  categoryName: categories.name,
  categorySlug: categories.slug,
};

async function enrichWithVariantPrices(items: HomepageProduct[]): Promise<HomepageProduct[]> {
  if (items.length === 0) return items;
  const ids = items.map((p) => p.id);
  const variants = await db
    .select({ productId: productVariants.productId, price: productVariants.price })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.active, true),
        sql`${productVariants.productId} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`
      )
    );
  return items.map((p) => {
    const vPrices = variants
      .filter((v) => v.productId === p.id && v.price)
      .map((v) => parseFloat(v.price!));
    return { ...p, minPrice: vPrices.length > 0 ? Math.min(...vPrices) : parseFloat(p.basePrice) };
  });
}

async function getManualProducts(limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.active, true), eq(products.featured, true)))
    .orderBy(desc(products.updatedAt))
    .limit(limit);
  return items as HomepageProduct[];
}

async function getOnSaleProducts(limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.active, true), isNotNull(products.compareAtPrice)))
    .orderBy(desc(products.updatedAt))
    .limit(limit);
  return items as HomepageProduct[];
}

async function getMostBoughtProducts(limit: number): Promise<HomepageProduct[]> {
  const bestsellers = await db
    .select({
      productId: orderItems.productId,
      totalQty: sql<number>`sum(${orderItems.quantity})`,
    })
    .from(orderItems)
    .where(isNotNull(orderItems.productId))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(limit);

  if (bestsellers.length === 0) return [];

  const ids = bestsellers.map((b) => b.productId as string);
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(products.active, true),
        sql`${products.id} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`
      )
    );
  // Re-sort by bestseller order
  return ids
    .map((id) => items.find((p) => p.id === id))
    .filter(Boolean) as HomepageProduct[];
}

async function getNewestProducts(limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.active, true))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return items as HomepageProduct[];
}

async function getCategoryProducts(categoryId: string, limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.active, true), eq(products.categoryId, categoryId)))
    .orderBy(desc(products.updatedAt))
    .limit(limit);
  return items as HomepageProduct[];
}

async function getLowStockProducts(threshold: number, limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(products.active, true),
        sql`(SELECT COALESCE(SUM(stock), 0) FROM ${productVariants} WHERE product_id = ${products.id}) <= ${threshold}`,
        sql`(SELECT COALESCE(SUM(stock), 0) FROM ${productVariants} WHERE product_id = ${products.id}) > 0`
      )
    )
    .orderBy(asc(products.createdAt))
    .limit(limit);
  return items as HomepageProduct[];
}

async function getRemainingProducts(excludeIds: Set<string>, limit: number): Promise<HomepageProduct[]> {
  const items = await db
    .select(BASE_SELECT)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.active, true))
    .orderBy(asc(products.name));

  return (items as HomepageProduct[]).filter((p) => !excludeIds.has(p.id)).slice(0, limit);
}

export async function evaluateHomepageRules(): Promise<{
  sections: HomepageSection[];
}> {
  const rules = await db
    .select()
    .from(homepageRules)
    .where(eq(homepageRules.active, true))
    .orderBy(asc(homepageRules.sortOrder));

  const sections: HomepageSection[] = [];
  const seenIds = new Set<string>();

  for (const rule of rules) {
    const cfg = rule.config as Record<string, unknown>;
    const limit = (cfg.limit as number) || 8;

    // Special static sections — just insert a marker at this position
    if (rule.type === "custom_3dprint") {
      sections.push({ sectionType: "custom_3dprint", label: rule.label });
      continue;
    }
    if (rule.type === "categories_showcase") {
      sections.push({ sectionType: "categories_showcase", label: rule.label });
      continue;
    }

    let items: HomepageProduct[] = [];

    switch (rule.type) {
      case "manual":
        items = await getManualProducts(limit);
        break;
      case "on_sale":
        items = await getOnSaleProducts(limit);
        break;
      case "most_bought":
        items = await getMostBoughtProducts(limit);
        break;
      case "newest":
        items = await getNewestProducts(limit);
        break;
      case "category":
        if (cfg.categoryId) items = await getCategoryProducts(cfg.categoryId as string, limit);
        break;
      case "low_stock":
        items = await getLowStockProducts((cfg.threshold as number) || 5, limit);
        break;
      case "remaining":
        items = await getRemainingProducts(seenIds, limit);
        break;
    }

    // Deduplicate across sections
    if (cfg.deduplicate !== false) {
      items = items.filter((p) => !seenIds.has(p.id));
    }

    if (items.length > 0) {
      items.forEach((p) => seenIds.add(p.id));
      const enriched = await enrichWithVariantPrices(items);
      sections.push({ sectionType: "products", label: rule.label, products: enriched });
    }
  }

  return { sections };
}
