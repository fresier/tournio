import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { slugSchema } from '@/lib/tournaments/contracts';
import { publicTournamentBySlug } from '@/lib/public/store';
import { TvView } from '@/components/public/tv-view';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = slugSchema.safeParse(slug).success ? await publicTournamentBySlug(slug).catch(() => null) : null;
  return { title: found ? `${found.snapshot.tournament.name} — Écran TV` : 'Écran TV — Tournio' };
}

/** Affichage public pour un écran 16:9 (1920×1080) : terrains, classements et résultats, en direct et sans défilement. */
export default async function TvPage({ params }: Props) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  const found = await publicTournamentBySlug(slug);
  if (!found) notFound();
  return <TvView initial={found.snapshot} />;
}
