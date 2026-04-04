import { NextRequest, NextResponse } from "next/server";

export interface TrackingEvent {
  timestamp: string;
  location: string;
  description: string;
  status: string;
}

export interface TrackingResult {
  trackingNumber: string;
  status: string;
  statusLabel: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  "pre-transit": "Versandlabel erstellt",
  transit: "In Zustellung",
  delivered: "Zugestellt",
  failure: "Zustellproblem",
  unknown: "Unbekannt",
};

export async function GET(request: NextRequest) {
  const trackingNumber = request.nextUrl.searchParams.get("trackingNumber");
  if (!trackingNumber) {
    return NextResponse.json({ error: "trackingNumber required" }, { status: 400 });
  }

  const apiKey = process.env.DHL_API_KEY;
  if (!apiKey) {
    // Without a key, return a link-only response so UI can still show the DHL link
    return NextResponse.json({
      trackingNumber,
      status: "unknown",
      statusLabel: "Kein DHL API-Key konfiguriert",
      estimatedDelivery: null,
      events: [],
      trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`,
    });
  }

  try {
    const res = await fetch(
      `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`,
      {
        headers: {
          "DHL-API-Key": apiKey,
          Accept: "application/json",
        },
        next: { revalidate: 300 }, // cache 5 min
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[DHL tracking] API error", res.status, text.slice(0, 200));
      return NextResponse.json(
        {
          trackingNumber,
          status: "unknown",
          statusLabel: "Tracking nicht verfügbar",
          estimatedDelivery: null,
          events: [],
          trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`,
        },
        { status: 200 }, // return 200 so UI shows graceful fallback
      );
    }

    const data = await res.json();
    const shipment = data.shipments?.[0];

    if (!shipment) {
      return NextResponse.json({
        trackingNumber,
        status: "unknown",
        statusLabel: "Sendung nicht gefunden",
        estimatedDelivery: null,
        events: [],
        trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`,
      });
    }

    const rawStatus: string = shipment.status?.status ?? "unknown";
    const events: TrackingEvent[] = (shipment.events ?? []).map((e: any) => ({
      timestamp: e.timestamp,
      location: [e.location?.address?.addressLocality, e.location?.address?.countryCode]
        .filter(Boolean)
        .join(", "),
      description: e.description ?? "",
      status: e.status ?? "",
    }));

    return NextResponse.json({
      trackingNumber,
      status: rawStatus,
      statusLabel: STATUS_LABELS[rawStatus] ?? shipment.status?.description ?? rawStatus,
      estimatedDelivery: shipment.estimatedTimeOfDelivery ?? null,
      events,
      trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`,
    } satisfies TrackingResult & { trackingUrl: string });
  } catch (err) {
    console.error("[DHL tracking]", err);
    return NextResponse.json({
      trackingNumber,
      status: "unknown",
      statusLabel: "Tracking temporär nicht verfügbar",
      estimatedDelivery: null,
      events: [],
      trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`,
    });
  }
}
