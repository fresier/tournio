import type { NextConfig } from 'next';
import { lanAddresses } from './src/lib/lan-address';

/**
 * En-têtes de sécurité appliqués à toutes les réponses. HSTS n’a d’effet qu’en HTTPS (ignoré en local).
 * Pas de CSP de scripts à nonce : elle rendrait toutes les pages dynamiques ; on interdit au moins
 * l’inclusion en iframe, les plugins et la modification de l’URL de base.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

// En développement, autorise un téléphone du réseau local à charger les ressources du serveur de dev.
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanAddresses(),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
};
export default config;
