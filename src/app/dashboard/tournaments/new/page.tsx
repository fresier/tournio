import { NewTournament } from '@/components/tournaments/new-tournament';
import { requireOrganizer } from '@/lib/tournaments/server';
import { PageHeading } from '@/components/ui/page-heading';

export default async function NewTournamentPage() {
  await requireOrganizer();
  return <><PageHeading title="Créer un tournoi" description="Commencez par les informations essentielles. Les équipes et les terrains viennent ensuite." />
    <NewTournament /></>;
}
