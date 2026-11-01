import Link from 'next/link';
import { listTournaments } from '@/lib/tournaments/server';
import { formatTournamentDate } from '@/lib/tournaments/dates';

const labels = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', COMPLETED: 'Terminé', ARCHIVED: 'Archivé' };
export default async function DashboardPage() {
  const tournaments = await listTournaments();
  return <><header className="page-heading"><div><h1>Mes tournois</h1><p>Préparez les équipes, les terrains et les règles de vos événements.</p></div><Link className="button-link" href="/dashboard/tournaments/new">Créer un tournoi</Link></header>
    {tournaments.length ? <div className="tournament-list">{tournaments.map((tournament) => <article className="panel tournament-row" key={tournament.id}><div><div className="row-heading"><h2><Link href={`/dashboard/tournaments/${tournament.id}`}>{tournament.name}</Link></h2><span className="status-chip">{labels[tournament.status]}</span></div><p>{tournament.sport}{tournament.location ? ` · ${tournament.location}` : ''}</p><p className="hint">{formatTournamentDate(tournament.starts_at, tournament.timezone)} — {tournament.timezone}</p></div><div className="tournament-counts"><span><strong>{tournament.team_count}</strong> équipes</span><span><strong>{tournament.pool_count}</strong> poules</span><span><strong>{tournament.court_count}</strong> terrains</span></div><Link className="row-link" href={`/dashboard/tournaments/${tournament.id}`}>Configurer<span className="sr-only"> {tournament.name}</span></Link></article>)}</div> : <section className="panel empty-state"><h2>Votre premier tournoi commence ici.</h2><p>Créez un brouillon, puis ajoutez vos équipes, vos poules et vos terrains.</p><Link href="/dashboard/tournaments/new" className="button-link">Créer mon premier tournoi</Link></section>}
  </>;
}
