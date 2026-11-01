import { getConfiguration } from '@/lib/tournaments/server';
import { TournamentEditor } from '@/components/tournaments/tournament-editor';

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configuration = await getConfiguration(id);
  return <TournamentEditor key={configuration.tournament.id} initial={configuration} />;
}
