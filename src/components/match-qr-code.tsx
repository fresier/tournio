'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function MatchQrCode({ matchId, origin }: { matchId: string; origin?: string }) {
  const [state, setState] = useState<{ url: string; svg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${origin ?? window.location.origin}/demo?match=${matchId}`;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#12304b', light: '#ffffff' } })
      .then((svg) => { if (!cancelled) setState({ url, svg }); })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
  }, [matchId, origin]);

  if (!state) return null;
  const loopback = /^(localhost|127\.|\[::1\])/.test(new URL(state.url).hostname);
  return (
    <figure className="qr-card">
      <div className="qr-code" role="img" aria-label={`QR code vers ${state.url}`} dangerouslySetInnerHTML={{ __html: state.svg }} />
      <figcaption>
        <strong>Scannez avec votre téléphone</strong>
        <span>Le score s’affichera sur votre écran et se mettra à jour à chaque modification, sans recharger la page.</span>
        {loopback && <span className="qr-warning">Cette adresse est locale : un téléphone ne pourra pas l’ouvrir. Utilisez le domaine public.</span>}
        {origin && <span className="qr-warning">Réseau local ({new URL(origin).host}) : le téléphone doit être sur le même Wi-Fi et le serveur lancé avec <code>npm run dev:lan</code>.</span>}
      </figcaption>
    </figure>
  );
}
