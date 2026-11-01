import Link from 'next/link';
export default function TournamentNotFound() {
  return <section className="panel empty-state"><h1>Tournoi introuvable</h1><p>Ce tournoi n’existe pas ou n’est pas accessible depuis votre compte.</p><Link href="/dashboard">Revenir à mes tournois</Link></section>;
}
