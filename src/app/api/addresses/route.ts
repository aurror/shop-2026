import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { addressSchema } from "@/lib/security";
import { z } from "zod";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const userAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, session.user.id));

    return NextResponse.json({ addresses: userAddresses });
  } catch (error) {
    console.error("[Addresses GET]", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Adressen" },
      { status: 500 }
    );
  }
}

const createAddressSchema = addressSchema.extend({
  label: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If this address is default, unset other defaults
    if (data.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, session.user.id));
    }

    // Check if user has no addresses yet – make this one default
    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, session.user.id))
      .limit(1);

    const isDefault = data.isDefault || existing.length === 0;

    const [newAddress] = await db
      .insert(addresses)
      .values({
        userId: session.user.id,
        label: data.label || "Standard",
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company || null,
        street: data.street,
        streetNumber: data.streetNumber,
        addressExtra: data.addressExtra || null,
        zip: data.zip,
        city: data.city,
        country: data.country,
        isDefault,
      })
      .returning();

    return NextResponse.json({ address: newAddress }, { status: 201 });
  } catch (error) {
    console.error("[Addresses POST]", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Adresse" },
      { status: 500 }
    );
  }
}

const updateAddressSchema = createAddressSchema.extend({
  id: z.string().uuid(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify ownership
    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(
        and(eq(addresses.id, data.id), eq(addresses.userId, session.user.id))
      )
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Adresse nicht gefunden" },
        { status: 404 }
      );
    }

    // If setting as default, unset others
    if (data.isDefault) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, session.user.id));
    }

    const [updated] = await db
      .update(addresses)
      .set({
        label: data.label || "Standard",
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company || null,
        street: data.street,
        streetNumber: data.streetNumber,
        addressExtra: data.addressExtra || null,
        zip: data.zip,
        city: data.city,
        country: data.country,
        isDefault: data.isDefault ?? false,
      })
      .where(eq(addresses.id, data.id))
      .returning();

    return NextResponse.json({ address: updated });
  } catch (error) {
    console.error("[Addresses PUT]", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Adresse" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const addressId = searchParams.get("id");

    if (!addressId) {
      return NextResponse.json(
        { error: "Adress-ID erforderlich" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(addresses)
      .where(
        and(eq(addresses.id, addressId), eq(addresses.userId, session.user.id))
      )
      .returning({ id: addresses.id });

    if (!deleted.length) {
      return NextResponse.json(
        { error: "Adresse nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Addresses DELETE]", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Adresse" },
      { status: 500 }
    );
  }
}
