import { getConfiguration } from '@/lib/tournaments/server';
import { headers } from 'next/headers';
import { TournamentEditor } from '@/components/tournaments/tournament-editor';
import { lanOrigin } from '@/lib/lan-address';

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configuration = await getConfiguration(id);
  return <TournamentEditor key={configuration.tournament.id} initial={configuration} publicOrigin={lanOrigin((await headers()).get('host'))} />;
}
