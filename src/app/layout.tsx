import type { Metadata, Viewport } from 'next';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';
import { mantineHtmlProps } from '@mantine/core';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Providers } from '@/components/ui/providers';

export const metadata: Metadata = {
  title: 'Tournio — Gestion de tournois',
  description: 'Organisez vos tournois, préparez vos équipes et suivez les résultats en direct.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#12304b' };

// Thème clair imposé : `mantineHtmlProps` pose data-mantine-color-scheme, aucun script de schéma n’est nécessaire.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" {...mantineHtmlProps}><body><NuqsAdapter><Providers>{children}</Providers></NuqsAdapter></body></html>;
}
