'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import QRCode from 'qrcode';

/** QR code SVG d’une URL publique. Rendu côté navigateur uniquement (rien au premier rendu serveur). */
export function QrCode({ url, size = 132, color = '#12304b' }: { url: string; size?: number; color?: string }) {
  const [svg, setSvg] = useState<{ url: string; markup: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: color, light: '#ffffff' } })
      .then((markup) => { if (!cancelled) setSvg({ url, markup }); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [url, color]);
  if (!svg || svg.url !== url) return <div className="qr-code" style={{ width: size, height: size }} aria-hidden="true" />;
  return <div className="qr-code" style={{ width: size }} role="img" aria-label={`QR code vers ${url}`} dangerouslySetInnerHTML={{ __html: svg.markup }} />;
}

const noSubscription = () => () => {};
/** Origine du site vue par le navigateur ; null au rendu serveur et pendant l’hydratation. */
export function useClientOrigin() {
  return useSyncExternalStore(noSubscription, () => window.location.origin, () => null);
}
