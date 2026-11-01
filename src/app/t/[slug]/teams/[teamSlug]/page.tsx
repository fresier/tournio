import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { slugSchema } from '@/lib/tournaments/contracts';
import { publicTournamentBySlug } from '@/lib/public/store';
import { TeamView } from '@/components/public/team-view';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string; teamSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, teamSlug } = await params;
  const found = slugSchema.safeParse(slug).success ? await publicTournamentBySlug(slug).catch(() => null) : null;
  const team = found?.snapshot.teams.find((row) => row.slug === teamSlug);
  return { title: found && team ? `${team.name} · ${found.snapshot.tournament.name} — Tournio` : 'Équipe — Tournio' };
}

export default async function PublicTeamPage({ params }: Props) {
  const { slug, teamSlug } = await params;
  if (!slugSchema.safeParse(slug).success || !slugSchema.safeParse(teamSlug).success) notFound();
  const found = await publicTournamentBySlug(slug);
  if (!found || !found.snapshot.teams.some((team) => team.slug === teamSlug)) notFound();
  return <TeamView initial={found.snapshot} teamSlug={teamSlug} />;
}
