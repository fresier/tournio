'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActionIcon, AppShell, AppShellHeader, AppShellMain, AppShellNavbar, AppShellSection, Burger, Divider, Group, NavLink, Stack, Text } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { Brand } from '@/components/ui/links';
import { LogoutButton } from '@/components/auth/logout-button';

const links = [
  { href: '/dashboard', label: 'Mes tournois', icon: 'trophy' },
  { href: '/dashboard/tournaments/new', label: 'Créer un tournoi', icon: 'add' },
  { href: '/dashboard/guide', label: 'Guide du gestionnaire', icon: 'book' },
];

function MenuIcon({ name }: { name: string }) {
  return <svg className="dashboard-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'trophy' ? <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3M12 12v5m-4 3h8m-6-3h4" /></>
      : name === 'add' ? <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8m-4-4h8" /></>
        : name === 'book' ? <><path d="M12 6c-2-2-5-2-8-1v14c3-1 6-1 8 1m0-14c2-2 5-2 8-1v14c-3-1-6-1-8 1V6Z" /></>
          : <><circle cx="12" cy="12" r="8" /><path d="m10 8 6 4-6 4V8Z" /></>}
  </svg>;
}

const navClasses = { root: 'dashboard-nav-item', body: 'dashboard-nav-body', section: 'dashboard-nav-section' };

export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const [compact, setCompact] = useLocalStorage({ key: 'tournio:menu-compact', defaultValue: false, deserialize: (value) => value === 'true' });
  const pathname = usePathname();
  return <AppShell header={{ height: { base: 60, sm: 0 } }} navbar={{ width: { base: 250, sm: compact ? 68 : 250 }, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={{ base: 'md', sm: 'xl' }}>
    <AppShellHeader hiddenFrom="sm">
      <Group h="100%" px="md" justify="space-between">
        <Brand size={26} href="/dashboard" />
        <Burger opened={opened} onClick={toggle} size="sm" aria-label={opened ? 'Fermer le menu' : 'Ouvrir le menu'} />
      </Group>
    </AppShellHeader>
    <AppShellNavbar p="md" bg="var(--tournio-sidebar, var(--mantine-color-ink-0))" className="dashboard-navbar" data-compact={compact || undefined}>
      <AppShellSection visibleFrom="sm" pb="xl" pt="xs"><Group className="dashboard-navbar-top" justify="space-between" wrap="nowrap">
        <span className="dashboard-navbar-brand"><Brand size={30} href="/dashboard" /></span>
        <ActionIcon variant="subtle" size="lg" onClick={() => setCompact(!compact)} aria-label={compact ? 'Agrandir le menu' : 'Réduire le menu'} title={compact ? 'Agrandir le menu' : 'Réduire le menu'} aria-controls="dashboard-navigation">
          <svg className="dashboard-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d={compact ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} /></svg>
        </ActionIcon>
      </Group></AppShellSection>
      <AppShellSection grow component="nav" id="dashboard-navigation" aria-label="Navigation organisateur">
        {links.map((link) => {
          const active = link.href === '/dashboard' ? pathname === '/dashboard' || pathname.startsWith('/dashboard/tournaments/') && !pathname.endsWith('/new') : pathname === link.href;
          return <NavLink key={link.href} component={Link} href={link.href} label={link.label} aria-label={link.label} title={compact ? link.label : undefined} leftSection={<MenuIcon name={link.icon} />} classNames={navClasses} onClick={close} fw={600} active={active} aria-current={active ? 'page' : undefined} />;
        })}
      </AppShellSection>
      <AppShellSection>
        <NavLink component={Link} href="/demo" label="Démonstration temps réel" aria-label="Démonstration temps réel" title={compact ? 'Démonstration temps réel' : undefined} leftSection={<MenuIcon name="demo" />} classNames={navClasses} onClick={close} c="dimmed" fz="sm" mb="sm" />
        <Divider mb="sm" />
        <Stack gap={4} align="flex-start"><Text className="dashboard-account-email" fz="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{email}</Text><LogoutButton /></Stack>
      </AppShellSection>
    </AppShellNavbar>
    <AppShellMain><div className="dashboard-content">{children}</div></AppShellMain>
  </AppShell>;
}
