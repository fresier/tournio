'use client';
import { useEffect } from 'react';
import { Alert, Anchor, Group, Text } from '@mantine/core';
import Link from 'next/link';
import type { PublicTournament } from '@/lib/public/contracts';
import { nextMatch, pendingPlacement, teamMatches } from '@/lib/public/view';
import { setTeamPreference } from './client-stores';
import { usePublicTournament } from './use-public-tournament';
import { MatchList, NextMatchCard, PublicShell, Section, StandingsTable, TournamentRanking } from './public-parts';

export function TeamView({ initial, teamSlug }: { initial: PublicTournament; teamSlug: string }) {
  const { snapshot, connection, now } = usePublicTournament(initial);
  const slug = snapshot.tournament.slug;
  const team = snapshot.teams.find((row) => row.slug === teamSlug);

  // L’URL de l’équipe prime : elle devient la préférence mémorisée pour ce tournoi.
  useEffect(() => {
    setTeamPreference(slug, teamSlug);
  }, [slug, teamSlug]);

  if (!team) return <PublicShell snapshot={snapshot} connection={connection}>
    <Alert color="orange" variant="light">Cette équipe ne fait plus partie du tournoi.</Alert>
    <Anchor component={Link} href={`/t/${slug}`}>Voir le tournoi</Anchor>
  </PublicShell>;
  const matches = teamMatches(snapshot, team.id);
  const upcoming = matches.filter((match) => match.status !== 'COMPLETED' && match.status !== 'CANCELLED');
  const played = matches.filter((match) => match.status === 'COMPLETED' || match.status === 'CANCELLED');
  const pending = upcoming.length ? null : pendingPlacement(snapshot, team.id);

  return <PublicShell snapshot={snapshot} connection={connection} eyebrow={<Text fw={800} fz="sm" tt="uppercase" c="var(--tournio-accent)" mb={2}>{team.name}</Text>}>
    {snapshot.placement.ranking ? <Section title="Classement final"><TournamentRanking snapshot={snapshot} highlight={team.id} /></Section> : null}
    <NextMatchCard snapshot={snapshot} teamId={team.id} match={nextMatch(snapshot, team.id)} now={now} />
    <Group component="nav" gap="lg"><Anchor component={Link} href={`/t/${slug}`} fw={600}>Tout le tournoi</Anchor><Anchor component={Link} href={`/t/${slug}?changer`} onClick={() => setTeamPreference(slug, null)} fw={600}>Changer d’équipe</Anchor></Group>
    <Section title="À venir"><MatchList snapshot={snapshot} matches={upcoming} teamId={team.id} now={now} showPool={false}
      empty={pending ? `${pending.remaining} match${pending.remaining > 1 ? 's' : ''} de classement à venir : programmé${pending.remaining > 1 ? 's' : ''} ${pending.waitingFor === 'pools' ? 'à la fin des poules' : `à la fin du tour ${pending.waitingFor}`}.` : 'Aucun match à venir.'} /></Section>
    <Section title="Résultats"><MatchList snapshot={snapshot} matches={played} teamId={team.id} now={now} showPool={false} /></Section>
    {snapshot.placement.ranking ? null : snapshot.placement.standing
      ? <Section title="Classement du tournoi"><Text fz="sm" c="dimmed" mb="xs">Provisoire : il se précise à chaque tour de la phase de classement.</Text><TournamentRanking snapshot={snapshot} highlight={team.id} /></Section>
      : team.pool_id ? <Section title="Classement de la poule"><StandingsTable snapshot={snapshot} poolId={team.pool_id} highlight={team.id} /></Section> : null}
  </PublicShell>;
}
