import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function AGBPage() {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "agb_content"))
    .limit(1);

  const content = result.length
    ? String(result[0].value)
    : "<p>Allgemeine Geschäftsbedingungen werden noch erstellt.</p>";

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        Allgemeine Geschäftsbedingungen (AGB)
      </h1>
      <div
        className="prose prose-neutral max-w-none [&_p]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-3 [&_a]:underline [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
