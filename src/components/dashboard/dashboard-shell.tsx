'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell, AppShellHeader, AppShellMain, AppShellNavbar, AppShellSection, Burger, Divider, Group, NavLink, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Brand } from '@/components/ui/links';
import { LogoutButton } from '@/components/auth/logout-button';

const links = [
  { href: '/dashboard', label: 'Mes tournois' },
  { href: '/dashboard/tournaments/new', label: 'Créer un tournoi' },
];

export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  return <AppShell header={{ height: { base: 60, sm: 0 } }} navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={{ base: 'md', sm: 'xl' }}>
    <AppShellHeader hiddenFrom="sm">
      <Group h="100%" px="md" justify="space-between">
        <Brand size={26} href="/dashboard" />
        <Burger opened={opened} onClick={toggle} size="sm" aria-label={opened ? 'Fermer le menu' : 'Ouvrir le menu'} />
      </Group>
    </AppShellHeader>
    <AppShellNavbar p="md" bg="var(--tournio-sidebar, var(--mantine-color-ink-0))">
      <AppShellSection visibleFrom="sm" pb="xl" pt="xs"><Brand size={30} href="/dashboard" /></AppShellSection>
      <AppShellSection grow component="nav" aria-label="Navigation organisateur">
        {links.map((link) => <NavLink key={link.href} component={Link} href={link.href} label={link.label} onClick={close} fw={600}
          active={link.href === '/dashboard' ? pathname === '/dashboard' || pathname.startsWith('/dashboard/tournaments/') && !pathname.endsWith('/new') : pathname === link.href} />)}
      </AppShellSection>
      <AppShellSection>
        <NavLink component={Link} href="/demo" label="Démonstration temps réel" onClick={close} c="dimmed" fz="sm" mb="sm" />
        <Divider mb="sm" />
        <Stack gap={4} align="flex-start"><Text fz="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{email}</Text><LogoutButton /></Stack>
      </AppShellSection>
    </AppShellNavbar>
    <AppShellMain><div className="dashboard-content">{children}</div></AppShellMain>
  </AppShell>;
}
