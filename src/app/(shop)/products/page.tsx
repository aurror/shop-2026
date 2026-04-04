import type { Metadata } from "next";
import { ProductsClient } from "@/components/shop/ProductsClient";

export const metadata: Metadata = {
  title: "Alle Produkte",
  description:
    "Entdecken Sie unser Sortiment an hochwertigen Modelleisenbahn-Zubehörteilen aus dem 3D-Drucker.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : "";
  const search = typeof sp.search === "string" ? sp.search : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "newest";
  const page = typeof sp.page === "string" ? parseInt(sp.page) || 1 : 1;

  return (
    <ProductsClient
      initialCategory={category}
      initialSearch={search}
      initialSort={sort}
      initialPage={page}
    />
  );
}
