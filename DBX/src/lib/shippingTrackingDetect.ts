/** Deteção heurística de transportadora + número a partir do texto extraído do PDF da etiqueta (melhor esforço). */

export type ShippingTrackingMatch = {
  carrierId: string;
  carrierLabel: string;
  tracking: string;
  trackingUrl: string;
};

export function buildCarrierTrackingUrl(carrierId: string, tracking: string): string {
  const q = encodeURIComponent(tracking.trim());
  switch (carrierId) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${q}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
    case "dhl":
      return `https://www.dhl.com/en/express/tracking.html?AWB=${q}`;
    case "amazon":
      return `https://track.amazon.com/tracking/${q}`;
    default:
      return `https://www.google.com/search?q=${q}+tracking`;
  }
}

function pick(m: RegExpMatchArray, group = 1): string {
  return (m[group] ?? m[0] ?? "").trim();
}

/**
 * Procura padrões conhecidos (UPS, FedEx, USPS, Amazon TBA, DHL quando a marca aparece no texto).
 */
export function detectTrackingInText(raw: string): ShippingTrackingMatch | null {
  const text = raw.replace(/\s+/g, " ").slice(0, 400_000);
  if (!text.trim()) return null;

  const ups = text.match(/\b(1Z[0-9A-Z]{16})\b/i);
  if (ups) {
    const tracking = pick(ups);
    return {
      carrierId: "ups",
      carrierLabel: "UPS",
      tracking,
      trackingUrl: buildCarrierTrackingUrl("ups", tracking),
    };
  }

  const amazon = text.match(/\b(TBA[0-9]{10,})\b/i);
  if (amazon) {
    const tracking = pick(amazon);
    return {
      carrierId: "amazon",
      carrierLabel: "Amazon",
      tracking,
      trackingUrl: buildCarrierTrackingUrl("amazon", tracking),
    };
  }

  const fedex14 = text.match(/\b(\d{14})\b/);
  if (fedex14) {
    const tracking = pick(fedex14);
    return {
      carrierId: "fedex",
      carrierLabel: "FedEx",
      tracking,
      trackingUrl: buildCarrierTrackingUrl("fedex", tracking),
    };
  }

  const fedex12 = text.match(/\b(\d{12})\b/);
  if (fedex12) {
    const tracking = pick(fedex12);
    return {
      carrierId: "fedex",
      carrierLabel: "FedEx",
      tracking,
      trackingUrl: buildCarrierTrackingUrl("fedex", tracking),
    };
  }

  const usps = text.match(/\b(9[2345][0-9]{21})\b/) ?? text.match(/\b(92[0-9]{20})\b/);
  if (usps) {
    const tracking = pick(usps);
    return {
      carrierId: "usps",
      carrierLabel: "USPS",
      tracking,
      trackingUrl: buildCarrierTrackingUrl("usps", tracking),
    };
  }

  if (/\bDHL\b|DHLExpress|Waybill/i.test(text)) {
    const dhl = text.match(/\b(\d{10,11})\b/);
    if (dhl) {
      const tracking = pick(dhl);
      return {
        carrierId: "dhl",
        carrierLabel: "DHL",
        tracking,
        trackingUrl: buildCarrierTrackingUrl("dhl", tracking),
      };
    }
  }

  return null;
}

/**
 * Usa o texto extraído do PDF e, se não houver match, o nome do ficheiro (muitas etiquetas vêm como
 * `data---CARRIER---1ZK....pdf` quando o PDF é imagem e `pdf-parse` não extrai texto).
 */
export function detectTrackingWithFilenameHint(pdfText: string, fileName?: string | null): ShippingTrackingMatch | null {
  const fromPdf = detectTrackingInText(pdfText);
  if (fromPdf) return fromPdf;
  if (!fileName?.trim()) return null;
  let n = fileName.trim();
  try {
    n = decodeURIComponent(n);
  } catch {
    /* manter n */
  }
  n = n.replace(/_/g, " ");
  return detectTrackingInText(n);
}
