import { requireOrganizer } from '@/lib/tournaments/server';
import { SessionMonitor } from '@/components/auth/session-monitor';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const metadata = { title: 'Organisation — Tournio' };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOrganizer();
  return <><SessionMonitor /><DashboardShell email={user.email}>{children}</DashboardShell></>;
}
