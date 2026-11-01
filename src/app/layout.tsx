import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tournio — Gestion de tournois',
  description: 'Organisez vos tournois, préparez vos équipes et suivez les résultats en direct.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
