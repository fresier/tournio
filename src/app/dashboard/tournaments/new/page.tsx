import Link from 'next/link';
import { NewTournament } from '@/components/tournaments/new-tournament';
import { requireOrganizer } from '@/lib/tournaments/server';

export default async function NewTournamentPage() {
  await requireOrganizer();
  return <><Link className="back-link" href="/dashboard">Mes tournois</Link><header className="page-heading"><div><h1>Créer un tournoi</h1><p>Commencez par les informations essentielles. Les équipes et les terrains viennent ensuite.</p></div></header><NewTournament /></>;
}
