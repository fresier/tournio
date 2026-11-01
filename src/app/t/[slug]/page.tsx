import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { slugSchema } from '@/lib/tournaments/contracts';
import { publicTournamentBySlug } from '@/lib/public/store';
import { TournamentView } from '@/components/public/tournament-view';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!slugSchema.safeParse(slug).success) notFound();
  const found = await publicTournamentBySlug(slug);
  if (!found) notFound();
  return found.snapshot;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = slugSchema.safeParse(slug).success ? await publicTournamentBySlug(slug).catch(() => null) : null;
  return { title: found ? `${found.snapshot.tournament.name} — Tournio` : 'Tournoi — Tournio' };
}

export default async function PublicTournamentPage({ params }: Props) {
  const snapshot = await load((await params).slug);
  return <TournamentView initial={snapshot} />;
}
