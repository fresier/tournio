import Link from 'next/link';
import { requireOrganizer } from '@/lib/tournaments/server';
import { LogoutButton } from '@/components/auth/logout-button';
import { SessionMonitor } from '@/components/auth/session-monitor';

export const metadata = { title: 'Organisation — Tournio' };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOrganizer();
  return <div className="app-frame"><SessionMonitor /><aside className="app-sidebar"><Link href="/dashboard" className="brand">tournio<span>.</span></Link><nav aria-label="Navigation organisateur"><Link href="/dashboard">Mes tournois</Link><Link href="/dashboard/tournaments/new">Créer un tournoi</Link><Link href="/demo">Démonstration temps réel</Link></nav><div className="sidebar-account"><span>{user.email}</span><LogoutButton /></div></aside><main className="app-content">{children}</main></div>;
}
