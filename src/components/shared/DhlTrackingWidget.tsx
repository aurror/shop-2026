"use client";

import { useEffect, useState } from "react";

interface TrackingEvent {
  timestamp: string;
  location: string;
  description: string;
}

interface TrackingData {
  trackingNumber: string;
  status: string;
  statusLabel: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  trackingUrl: string;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "text-green-700 bg-green-50 border-green-200",
  transit: "text-blue-700 bg-blue-50 border-blue-200",
  "pre-transit": "text-neutral-600 bg-neutral-50 border-neutral-200",
  failure: "text-red-700 bg-red-50 border-red-200",
  unknown: "text-neutral-500 bg-neutral-50 border-neutral-200",
};

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function DhlTrackingWidget({ trackingNumber }: { trackingNumber: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!trackingNumber) return;
    setLoading(true);
    fetch(`/api/tracking?trackingNumber=${encodeURIComponent(trackingNumber)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [trackingNumber]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Tracking wird geladen…
      </div>
    );
  }

  if (!data) {
    return (
      <a
        href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
      >
        Bei DHL verfolgen →
      </a>
    );
  }

  const statusColor = STATUS_COLORS[data.status] ?? STATUS_COLORS.unknown;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      {/* Status header */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          {/* DHL logo colours */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFCC00]">
            <span className="text-[9px] font-black text-[#D40511]">DHL</span>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Sendungsnummer</p>
            <p className="font-mono text-sm font-medium text-neutral-900">{trackingNumber}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>
          {data.statusLabel}
        </span>
      </div>

      {data.estimatedDelivery && (
        <div className="border-t border-neutral-100 px-4 py-2 text-sm text-neutral-600">
          Voraussichtliche Lieferung:{" "}
          <span className="font-medium">{formatDate(data.estimatedDelivery)}</span>
        </div>
      )}

      {/* Events */}
      {data.events.length > 0 && (
        <div className="border-t border-neutral-100">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <span>{expanded ? "Verlauf ausblenden" : `Sendungsverlauf (${data.events.length} Ereignisse)`}</span>
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {expanded && (
            <ol className="relative px-4 pb-4">
              {data.events.map((event, i) => (
                <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`mt-0.5 h-2.5 w-2.5 rounded-full border-2 ${i === 0 ? "border-neutral-900 bg-neutral-900" : "border-neutral-300 bg-white"}`} />
                    {i < data.events.length - 1 && <div className="w-px flex-1 bg-neutral-200" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-400">{formatDate(event.timestamp)}{event.location && ` · ${event.location}`}</p>
                    <p className="mt-0.5 text-sm text-neutral-700">{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* External link */}
      <div className="border-t border-neutral-100 px-4 py-2.5">
        <a
          href={data.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
        >
          Auf dhl.de öffnen
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>
    </div>
  );
}
