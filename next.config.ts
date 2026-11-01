import type { NextConfig } from 'next';
import { lanAddresses } from './src/lib/lan-address';

// En développement, autorise un téléphone du réseau local à charger les ressources du serveur de dev.
const config: NextConfig = { poweredByHeader: false, allowedDevOrigins: lanAddresses(), distDir: process.env.NEXT_DIST_DIR || '.next' };
export default config;
