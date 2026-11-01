'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { slugify } from '@/lib/tournaments/contracts';
import { Box, Button, Group, NativeSelect, Paper, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, Title } from '@mantine/core';
import type { PublicTournament } from '@/lib/public/contracts';
import { nextMatch } from '@/lib/public/view';
import { setTeamPreference, useTeamPreference } from './client-stores';
import { usePublicTournament } from './use-public-tournament';
import { MatchList, NextMatchCard, PublicShell, Section, StandingsTable, TournamentRanking } from './public-parts';

export function TournamentView({ initial }: { initial: PublicTournament }) {
  const { snapshot, connection, now } = usePublicTournament(initial);
  const router = useRouter();
  const slug = snapshot.tournament.slug;
  const myTeamSlug = useTeamPreference(slug);
  // Poule affichée gardée dans l’URL (?poule=poule-b) : un lien peut ouvrir directement une poule.
  const [poolParam, setPoolParam] = useQueryState('poule', parseAsString.withOptions({ scroll: false }));
  const pool = snapshot.pools.find((row) => slugify(row.name) === poolParam)?.id ?? 'all';
  const setPool = (id: string) => { const target = snapshot.pools.find((row) => row.id === id); void setPoolParam(target ? slugify(target.name) : null); };

  const myTeam = snapshot.teams.find((team) => team.slug === myTeamSlug);
  const forget = () => setTeamPreference(slug, null);
  const choose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('team') ?? '');
    if (value) router.push(`/t/${slug}/teams/${value}`);
  };
  const pools = pool === 'all' ? snapshot.pools : snapshot.pools.filter((row) => row.id === pool);
  const matches = pool === 'all' ? snapshot.matches : snapshot.matches.filter((match) => match.pool_id === pool);

  const content = <>
    <Section title="Calendrier"><MatchList snapshot={snapshot} matches={matches} now={now} showPool={pool === 'all'} /></Section>
    {/* Pendant la phase de classement, le classement du tournoi remplace ceux des poules. */}
    {snapshot.placement.ranking ? null : snapshot.placement.standing
      ? <Section title="Classement du tournoi"><Text fz="sm" c="dimmed" mb="xs">Provisoire : il se précise à chaque tour de la phase de classement.</Text><TournamentRanking snapshot={snapshot} highlight={myTeam?.id} /></Section>
      : <Section title="Classements"><Stack gap="md">
        {pools.map((p) => <Box key={p.id}><Title order={3} fz="md" mb={6}>{p.name}</Title><StandingsTable snapshot={snapshot} poolId={p.id} highlight={myTeam?.id} /></Box>)}
      </Stack></Section>}
  </>;

  return <PublicShell snapshot={snapshot} connection={connection}>
    {snapshot.placement.ranking ? <Section title="Classement final"><TournamentRanking snapshot={snapshot} highlight={myTeam?.id} /></Section> : null}
    {myTeam ? <Stack gap="xs">
      <NextMatchCard snapshot={snapshot} teamId={myTeam.id} match={nextMatch(snapshot, myTeam.id)} now={now} compact />
      <Group><Button component={Link} href={`/t/${slug}/teams/${myTeam.slug}`}>Page de {myTeam.name}</Button><Button variant="subtle" onClick={forget}>Changer d’équipe</Button></Group>
    </Stack> : <Paper component="section" withBorder p="lg" aria-labelledby="picker-title">
      <Title order={2} id="picker-title" fz="xl">Quelle est votre équipe ?</Title>
      <Text fz="sm" c="dimmed" mt={4} mb="md">Retrouvez son prochain match, son terrain et ses résultats. Votre choix est mémorisé sur cet appareil.</Text>
      <form onSubmit={choose}><Group align="flex-end" gap="sm">
        <NativeSelect name="team" required defaultValue="" aria-label="Équipe" style={{ flex: '1 1 220px' }}>
          <option value="" disabled>Choisir une équipe</option>
          {snapshot.pools.map((p) => <optgroup key={p.id} label={p.name}>{snapshot.teams.filter((team) => team.pool_id === p.id).map((team) => <option key={team.id} value={team.slug}>{team.name}</option>)}</optgroup>)}
        </NativeSelect>
        <Button type="submit">Suivre cette équipe</Button>
      </Group></form>
    </Paper>}

    {snapshot.pools.length > 1 ? <Tabs value={pool} onChange={(value) => value && setPool(value)} keepMounted={false}>
      <TabsList aria-label="Filtrer par poule" mb="lg" className="section-tabs">
        <TabsTab value="all">Toutes les poules</TabsTab>{snapshot.pools.map((p) => <TabsTab key={p.id} value={p.id}>{p.name}</TabsTab>)}
      </TabsList>
      {['all', ...snapshot.pools.map((p) => p.id)].map((value) => <TabsPanel key={value} value={value}><Stack gap="lg">{content}</Stack></TabsPanel>)}
    </Tabs> : content}
  </PublicShell>;
}
