import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { listTournaments } from '@/lib/tournaments/server';
import { formatTournamentDate } from '@/lib/tournaments/dates';
import { ButtonLink, TextLink } from '@/components/ui/links';
import { TournamentStatus } from '@/components/ui/status';
import { PageHeading } from '@/components/ui/page-heading';

export default async function DashboardPage() {
  const tournaments = await listTournaments();
  return <>
    <PageHeading title="Mes tournois" description="Préparez les équipes, les terrains et les règles de vos événements." action={<ButtonLink href="/dashboard/tournaments/new">Créer un tournoi</ButtonLink>} />
    {tournaments.length ? <Stack gap="md">{tournaments.map((tournament) => <Card key={tournament.id} component="article">
      <Group justify="space-between" align="flex-start" gap="lg">
        <Stack gap={4} style={{ minWidth: 0, flex: '1 1 260px' }}>
          <Group gap="sm"><Title order={2} fz="xl"><TextLink href={`/dashboard/tournaments/${tournament.id}`} underline="hover" c="ink.8">{tournament.name}</TextLink></Title><TournamentStatus status={tournament.status} />{tournament.access_role === 'manager' ? <Badge variant="light">Partagé avec vous</Badge> : null}</Group>
          <Text>{tournament.sport}{tournament.location ? ` · ${tournament.location}` : ''}</Text>
          <Text fz="sm" c="dimmed">{formatTournamentDate(tournament.starts_at, tournament.timezone)} — {tournament.timezone}</Text>
        </Stack>
        <SimpleGrid cols={3} spacing="lg">
          {[[tournament.team_count, 'équipes'], [tournament.pool_count, 'poules'], [tournament.court_count, 'terrains']].map(([count, label]) => <Stack key={label} gap={0} align="center"><Text fw={800} fz="xl">{count}</Text><Text fz="xs" c="dimmed">{label}</Text></Stack>)}
        </SimpleGrid>
        <ButtonLink href={`/dashboard/tournaments/${tournament.id}`} variant="light" size="sm">Configurer<span className="sr-only"> {tournament.name}</span></ButtonLink>
      </Group>
    </Card>)}</Stack> : <Card p="xl"><Title order={2} fz="xl" mb="xs">Votre premier tournoi commence ici.</Title><Text c="dimmed" mb="md">Créez un brouillon, puis ajoutez vos équipes, vos poules et vos terrains.</Text><ButtonLink href="/dashboard/tournaments/new">Créer mon premier tournoi</ButtonLink></Card>}
  </>;
}
