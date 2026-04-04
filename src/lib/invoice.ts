import PDFDocument from "pdfkit";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  streetNumber: string;
  addressExtra?: string;
  zip: string;
  city: string;
  country: string;
}

interface OrderItem {
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  createdAt: Date;
  customerEmail: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  items: OrderItem[];
  subtotal: string;
  taxAmount: string;
  shippingCost: string;
  discountAmount: string | null;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SELLER = {
  name: "3DPrintIt GmbH",
  street: "Musterstraße 1",
  city: "12345 Berlin",
  country: "Deutschland",
  taxId: "USt-IdNr: DE123456789",
  registerCourt: "Amtsgericht Berlin-Charlottenburg, HRB 123456",
  ceo: "Max Mustermann",
  bank: "Commerzbank AG",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  email: "info@3dprintit.de",
  web: "www.3dprintit.de",
};

const TAX_RATE = 0.19;

function euro(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function invoiceNumber(orderNumber: string, createdAt: Date): string {
  const yy = String(createdAt.getFullYear()).slice(2);
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0");
  const dd = String(createdAt.getDate()).padStart(2, "0");
  return `RE-${yy}${mm}${dd}-${orderNumber}`;
}

function formatAddress(a: Address): string[] {
  const lines: string[] = [];
  if (a.company) lines.push(a.company);
  lines.push(`${a.firstName} ${a.lastName}`);
  lines.push(`${a.street} ${a.streetNumber}`);
  if (a.addressExtra) lines.push(a.addressExtra);
  lines.push(`${a.zip} ${a.city}`);
  if (a.country && a.country !== "DE" && a.country !== "Deutschland") {
    lines.push(a.country);
  }
  return lines;
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    stripe: "Kreditkarte (Stripe)",
    klarna: "Klarna",
    bank_transfer: "Banküberweisung",
    paypal: "PayPal",
  };
  return map[method] || method;
}

// ─── Colors & Layout Constants ──────────────────────────────────────────────

const COLOR = {
  primary: "#1a1a2e" as const,
  accent: "#16213e" as const,
  muted: "#555555" as const,
  tableHeader: "#f0f0f5" as const,
  tableStripe: "#fafafa" as const,
  border: "#cccccc" as const,
  white: "#ffffff" as const,
};

const MARGIN = { left: 50, right: 50, top: 40, bottom: 60 };

// ─── PDF Generation ─────────────────────────────────────────────────────────

export async function generateInvoice(order: OrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
      info: {
        Title: `Rechnung ${invoiceNumber(order.orderNumber, order.createdAt)}`,
        Author: SELLER.name,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 595.28; // A4
    const contentWidth = pageWidth - MARGIN.left - MARGIN.right;
    const rightCol = MARGIN.left + contentWidth - 200;

    // ── Company Header ────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLOR.primary)
      .text(SELLER.name, MARGIN.left, MARGIN.top);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(
        `${SELLER.name} · ${SELLER.street} · ${SELLER.city}`,
        MARGIN.left,
        MARGIN.top + 25
      );

    // Thin separator
    const sepY = MARGIN.top + 38;
    doc
      .moveTo(MARGIN.left, sepY)
      .lineTo(MARGIN.left + contentWidth, sepY)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    // ── Customer Address Block ────────────────────────────────────────────
    const addr = order.billingAddress || order.shippingAddress;
    const addrStartY = sepY + 20;

    if (addr) {
      const addrLines = formatAddress(addr);
      doc.font("Helvetica").fontSize(10).fillColor("#000000");
      addrLines.forEach((line, i) => {
        doc.text(line, MARGIN.left, addrStartY + i * 14);
      });
    }

    // ── Invoice Meta (right side) ─────────────────────────────────────────
    const invNum = invoiceNumber(order.orderNumber, order.createdAt);
    const invDate = formatDate(order.createdAt);

    const metaStartY = addrStartY;
    const metaLabelX = rightCol;
    const metaValueX = rightCol + 100;

    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLOR.primary);
    doc.text("RECHNUNG", metaLabelX, metaStartY);

    const metaRows: [string, string][] = [
      ["Rechnungsnr.:", invNum],
      ["Rechnungsdatum:", invDate],
      ["Lieferdatum:", invDate],
      ["Bestellnr.:", order.orderNumber],
      ["Zahlungsart:", paymentMethodLabel(order.paymentMethod)],
    ];

    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    metaRows.forEach(([label, value], i) => {
      const y = metaStartY + 22 + i * 15;
      doc.font("Helvetica").text(label, metaLabelX, y);
      doc.font("Helvetica-Bold").text(value, metaValueX, y);
    });

    // ── Items Table ───────────────────────────────────────────────────────
    const tableTop = Math.max(addrStartY + 100, metaStartY + 22 + metaRows.length * 15 + 30);
    const colWidths = {
      pos: 30,
      desc: contentWidth - 30 - 50 - 90 - 90,
      qty: 50,
      unit: 90,
      total: 90,
    };
    const colX = {
      pos: MARGIN.left,
      desc: MARGIN.left + colWidths.pos,
      qty: MARGIN.left + colWidths.pos + colWidths.desc,
      unit: MARGIN.left + colWidths.pos + colWidths.desc + colWidths.qty,
      total: MARGIN.left + colWidths.pos + colWidths.desc + colWidths.qty + colWidths.unit,
    };

    const rowHeight = 22;

    // Table header background
    doc
      .rect(MARGIN.left, tableTop, contentWidth, rowHeight)
      .fillColor(COLOR.primary)
      .fill();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.white);
    doc.text("Pos.", colX.pos + 4, tableTop + 6);
    doc.text("Beschreibung", colX.desc + 4, tableTop + 6);
    doc.text("Menge", colX.qty + 4, tableTop + 6);
    doc.text("Einzelpreis", colX.unit + 4, tableTop + 6);
    doc.text("Gesamt", colX.total + 4, tableTop + 6);

    let y = tableTop + rowHeight;
    order.items.forEach((item, idx) => {
      // Stripe alternate rows
      if (idx % 2 === 0) {
        doc
          .rect(MARGIN.left, y, contentWidth, rowHeight)
          .fillColor(COLOR.tableStripe)
          .fill();
      }

      const desc = item.variantName
        ? `${item.productName} – ${item.variantName}`
        : item.productName;

      doc.fillColor("#000000").font("Helvetica").fontSize(9);
      doc.text(String(idx + 1), colX.pos + 4, y + 6, { width: colWidths.pos - 8 });
      doc.text(desc, colX.desc + 4, y + 6, {
        width: colWidths.desc - 8,
        ellipsis: true,
        lineBreak: false,
      });
      doc.text(String(item.quantity), colX.qty + 4, y + 6, {
        width: colWidths.qty - 8,
        align: "right",
      });
      doc.text(euro(item.unitPrice), colX.unit + 4, y + 6, {
        width: colWidths.unit - 8,
        align: "right",
      });
      doc.text(euro(item.totalPrice), colX.total + 4, y + 6, {
        width: colWidths.total - 8,
        align: "right",
      });
      y += rowHeight;
    });

    // Bottom border of table
    doc
      .moveTo(MARGIN.left, y)
      .lineTo(MARGIN.left + contentWidth, y)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    // ── Totals ────────────────────────────────────────────────────────────
    y += 15;
    const totalsX = colX.unit;
    const totalsValX = colX.total;
    const totalsWidth = colWidths.total - 8;

    const drawTotalRow = (label: string, value: string, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 9)
        .fillColor("#000000");
      doc.text(label, totalsX, y, { width: colWidths.unit - 8, align: "right" });
      doc.text(value, totalsValX + 4, y, { width: totalsWidth, align: "right" });
      y += bold ? 20 : 16;
    };

    drawTotalRow("Zwischensumme (netto):", euro(order.subtotal));

    if (order.shippingCost && parseFloat(order.shippingCost) > 0) {
      drawTotalRow("Versandkosten:", euro(order.shippingCost));
    }

    if (order.discountAmount && parseFloat(order.discountAmount) > 0) {
      drawTotalRow("Rabatt:", "−" + euro(order.discountAmount));
    }

    drawTotalRow(`MwSt. ${(TAX_RATE * 100).toFixed(0)}%:`, euro(order.taxAmount));

    // Bold separator before grand total
    doc
      .moveTo(totalsX, y - 4)
      .lineTo(MARGIN.left + contentWidth, y - 4)
      .strokeColor(COLOR.primary)
      .lineWidth(1)
      .stroke();

    y += 2;
    drawTotalRow("Gesamtbetrag (brutto):", euro(order.total), true);

    // ── Payment Note ──────────────────────────────────────────────────────
    y += 10;
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted);

    if (order.paymentMethod === "bank_transfer") {
      doc.text(
        "Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen auf das unten angegebene Konto.",
        MARGIN.left,
        y,
        { width: contentWidth }
      );
    } else if (order.paymentStatus === "paid") {
      doc.text(
        "Der Rechnungsbetrag wurde bereits beglichen. Vielen Dank für Ihren Einkauf!",
        MARGIN.left,
        y,
        { width: contentWidth }
      );
    } else {
      doc.text(
        "Der Rechnungsbetrag wird über die gewählte Zahlungsart eingezogen.",
        MARGIN.left,
        y,
        { width: contentWidth }
      );
    }

    // ── Footer ────────────────────────────────────────────────────────────
    const footerTop = 740;
    doc
      .moveTo(MARGIN.left, footerTop)
      .lineTo(MARGIN.left + contentWidth, footerTop)
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .stroke();

    const footerY = footerTop + 8;
    const footerColW = contentWidth / 3;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLOR.muted);
    doc.text(SELLER.name, MARGIN.left, footerY);
    doc.text("Bankverbindung", MARGIN.left + footerColW, footerY);
    doc.text("Kontakt", MARGIN.left + footerColW * 2, footerY);

    doc.font("Helvetica").fontSize(7);
    const footerLine = footerY + 10;
    const lineH = 9;

    // Column 1: Company info
    doc.text(SELLER.street, MARGIN.left, footerLine);
    doc.text(SELLER.city, MARGIN.left, footerLine + lineH);
    doc.text(SELLER.taxId, MARGIN.left, footerLine + lineH * 2);
    doc.text(SELLER.registerCourt, MARGIN.left, footerLine + lineH * 3);
    doc.text(`Geschäftsführer: ${SELLER.ceo}`, MARGIN.left, footerLine + lineH * 4);

    // Column 2: Bank details
    doc.text(`Bank: ${SELLER.bank}`, MARGIN.left + footerColW, footerLine);
    doc.text(`IBAN: ${SELLER.iban}`, MARGIN.left + footerColW, footerLine + lineH);
    doc.text(`BIC: ${SELLER.bic}`, MARGIN.left + footerColW, footerLine + lineH * 2);

    // Column 3: Contact
    doc.text(`E-Mail: ${SELLER.email}`, MARGIN.left + footerColW * 2, footerLine);
    doc.text(`Web: ${SELLER.web}`, MARGIN.left + footerColW * 2, footerLine + lineH);

    doc.end();
  });
}
