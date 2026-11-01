'use client';
import Link from 'next/link';
import { Alert, Anchor, Badge, Box, Container, Group, Paper, SimpleGrid, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';
import type { PublicMatch, PublicTournament } from '@/lib/public/contracts';
import { themedAppearance } from '@/lib/theme-variables';
import { formatMatchTime, formatTournamentDate, spansSeveralDays } from '@/lib/tournaments/dates';
import { countdown, matchState, pendingPlacement, scoreFor, type MatchTone } from '@/lib/public/view';
import { placementLabel } from '@/lib/domain/placement';
import type { Connection } from './use-public-tournament';

export function useNames(snapshot: PublicTournament) {
  const names = new Map([...snapshot.teams, ...snapshot.pools, ...snapshot.courts].map((row) => [row.id, row.name]));
  const t = snapshot.tournament;
  const multiDay = spansSeveralDays(t.starts_at, t.ends_at, t.timezone);
  return {
    name: (id: string | null) => (id ? names.get(id) : undefined) ?? '—',
    time: (instant: string | null) => instant ? formatMatchTime(instant, t.timezone, multiDay) : 'Horaire à venir',
    /** Poule, ou libellé du match de classement (« Finale », « Places 3 et 4 »…). */
    group: (match: PublicMatch) => match.pool_id ? (names.get(match.pool_id) ?? '—') : placementLabel(match.place_from ?? 1, match.place_to ?? 2),
  };
}

/**
 * Cadre des pages publiques : les couleurs du tournoi sont posées en variables CSS sur la racine,
 * si bien que tous les composants Mantine en dessous les reprennent (et changent en direct).
 */
export function PublicShell({ snapshot, connection, eyebrow, children }: { snapshot: PublicTournament; connection: Connection; eyebrow?: React.ReactNode; children: React.ReactNode }) {
  const t = snapshot.tournament;
  const appearance = themedAppearance(t);
  return <Box component="main" className="public-root" data-mantine-color-scheme={appearance.scheme} style={appearance.vars}>
    <Box className="public-banner">
      <Container size="sm" py="sm"><Group justify="space-between" wrap="nowrap">
        <Anchor component={Link} href={`/t/${t.slug}`} className="brand" underline="never" fz={24}>tournio<span>.</span></Anchor>
        <ConnectionBadge connection={connection} />
      </Group></Container>
    </Box>
    <Container size="sm" py="lg" px="md">
      <Stack gap="lg">
        <Box component="header">
          {eyebrow}
          <Title order={1} fz={{ base: 28, sm: 34 }} lh={1.15} style={{ overflowWrap: 'anywhere' }}>{t.name}</Title>
          <Text c="dimmed" mt={4}>{t.sport}{t.location ? ` · ${t.location}` : ''} · {formatTournamentDate(t.starts_at, t.timezone)}</Text>
          {t.status === 'COMPLETED' ? <Alert mt="sm" variant="light" color="ink">Tournoi terminé. Merci à toutes les équipes !</Alert> : null}
          {t.status === 'ARCHIVED' ? <Alert mt="sm" variant="light" color="gray">Ce tournoi est archivé. Les résultats restent consultables.</Alert> : null}
        </Box>
        {connection === 'removed' ? <Alert color="orange" variant="light" role="alert">Ce tournoi n’est plus publié. Les informations affichées peuvent être dépassées.</Alert> : null}
        {children}
        <Text component="footer" fz="sm" c="dimmed" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>Horaires dans le fuseau {t.timezone}. Page en lecture seule, mise à jour automatiquement.</Text>
      </Stack>
    </Container>
  </Box>;
}

export function ConnectionBadge({ connection }: { connection: Connection }) {
  const label = connection === 'live' ? 'En direct' : connection === 'connecting' ? 'Connexion…' : connection === 'removed' ? 'Indisponible' : 'Hors ligne · actualisation toutes les 20 s';
  return <Badge role="status" variant="white" color={connection === 'live' ? 'teal.9' : connection === 'connecting' ? 'gray.8' : 'orange.9'} size="lg" tt="none" fw={600}
    leftSection={connection === 'live' ? <span className="live-dot" aria-hidden="true" /> : undefined}>{label}</Badge>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return <Box component="section" aria-labelledby={id}><Title order={2} id={id} fz="xl" mb="sm">{title}</Title>{children}</Box>;
}

const toneColor: Record<MatchTone, string> = { scheduled: 'gray', late: 'orange', live: 'teal', done: 'ink', postponed: 'orange', cancelled: 'red' };

export function MatchList({ snapshot, matches, teamId, now, showPool = true, empty = 'Aucun match à afficher.' }: { snapshot: PublicTournament; matches: PublicMatch[]; teamId?: string; now?: number; showPool?: boolean; empty?: string }) {
  const { name, time, group } = useNames(snapshot);
  if (!matches.length) return <Text c="dimmed">{empty}</Text>;
  return <Stack component="ol" gap={6} p={0} m={0} style={{ listStyle: 'none' }}>{matches.map((match) => {
    const state = matchState(match, now);
    const score = scoreFor(match, teamId);
    const [first, second] = teamId === match.away_team_id ? [match.away_team_id, match.home_team_id] : [match.home_team_id, match.away_team_id];
    return <Paper component="li" key={match.id} withBorder px="md" py="sm" className={`public-match tone-${state.tone}`} data-tone={state.tone}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Text className="public-match-time" fw={800} w={58} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{match.status === 'POSTPONED' ? '—' : time(match.starts_at)}</Text>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} style={{ overflowWrap: 'anywhere' }}>{teamId ? <>contre <strong>{name(second)}</strong></> : <><strong>{name(first)}</strong> <Text span c="dimmed">–</Text> <strong>{name(second)}</strong></>}</Text>
          <Group gap={6} mt={2}>
            <Text fz="sm" c="dimmed">{[match.status === 'POSTPONED' ? null : name(match.court_id), showPool || match.phase === 'FINAL' ? group(match) : null].filter(Boolean).join(' · ')}</Text>
            {state.tone !== 'scheduled' ? <Badge size="sm" color={toneColor[state.tone]}>{state.label}</Badge> : null}
            {score?.outcome ? <Badge size="sm" variant="light" color={score.outcome === 'Victoire' ? 'teal' : score.outcome === 'Défaite' ? 'gray' : 'ink'}>{score.outcome}</Badge> : null}
          </Group>
        </Box>
        <Text className="public-match-score" fw={800} fz="lg" c="var(--tournio-accent)" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{score ? score.text : ''}</Text>
      </Group>
    </Paper>;
  })}</Stack>;
}

export function StandingsTable({ snapshot, poolId, highlight }: { snapshot: PublicTournament; poolId: string; highlight?: string }) {
  const { name } = useNames(snapshot);
  const rows = snapshot.standings.find((row) => row.pool_id === poolId)?.rows ?? [];
  return <Paper withBorder radius="md" style={{ overflow: 'hidden' }}><Table tabularNums verticalSpacing={8} horizontalSpacing="sm">
    <caption className="sr-only">Classement de {name(poolId)}</caption>
    <TableThead><TableTr><TableTh scope="col">#</TableTh><TableTh scope="col">Équipe</TableTh><TableTh scope="col" title="Matchs joués">J</TableTh><TableTh scope="col" title="Victoires" visibleFrom="xs">V</TableTh><TableTh scope="col" title="Nuls" visibleFrom="xs">N</TableTh><TableTh scope="col" title="Défaites" visibleFrom="xs">D</TableTh><TableTh scope="col" title="Différence">Diff.</TableTh><TableTh scope="col">Pts</TableTh></TableTr></TableThead>
    <TableTbody>{rows.map((row) => <TableTr key={row.team_id} bg={row.team_id === highlight ? 'var(--mantine-primary-color-light)' : undefined} aria-current={row.team_id === highlight ? 'true' : undefined}>
      <TableTd>{row.position}</TableTd><TableTh scope="row" fw={row.team_id === highlight ? 800 : 600}>{name(row.team_id)}</TableTh><TableTd>{row.played}</TableTd><TableTd visibleFrom="xs">{row.won}</TableTd><TableTd visibleFrom="xs">{row.drawn}</TableTd><TableTd visibleFrom="xs">{row.lost}</TableTd><TableTd>{row.score_difference > 0 ? `+${row.score_difference}` : row.score_difference}</TableTd><TableTd fw={800}>{row.points}</TableTd>
    </TableTr>)}</TableTbody>
  </Table></Paper>;
}

export function NextMatchCard({ snapshot, teamId, match, now, compact = false }: { snapshot: PublicTournament; teamId: string; match: PublicMatch | undefined; now?: number; compact?: boolean }) {
  const { name, time, group } = useNames(snapshot);
  if (!match) {
    const pending = pendingPlacement(snapshot, teamId);
    if (pending) return <Paper component="section" withBorder p="lg" aria-labelledby="next-title" className="next-pending">
      <Text id="next-title" fz="sm" fw={700} tt="uppercase" c="dimmed">{compact ? `Prochain match · ${name(teamId)}` : 'Prochain match'}</Text>
      <Text fw={800} fz="lg" mt={4}>Phase de classement à venir</Text>
      <Text mt={4}>Encore {pending.remaining} match{pending.remaining > 1 ? 's' : ''} pour {name(teamId)}. L’adversaire, le terrain et l’horaire seront annoncés {pending.waitingFor === 'pools' ? 'à la fin des poules' : `à la fin du tour ${pending.waitingFor}`}, selon les classements.</Text>
      <Text fz="sm" c="dimmed" mt={4}>Cette page se met à jour automatiquement : restez à proximité.</Text>
    </Paper>;
    return <Paper component="section" withBorder p="lg" aria-labelledby="next-title">
      <Text id="next-title" fz="sm" fw={700} tt="uppercase" c="dimmed">Prochain match</Text>
      <Text fw={700} fz="lg" mt={4}>Plus aucun match prévu pour {name(teamId)}.</Text>
      <Text fz="sm" c="dimmed">Les résultats et le classement sont ci-dessous.</Text>
    </Paper>;
  }
  const state = matchState(match, now);
  const opponent = match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
  const timing = match.status === 'IN_PROGRESS' ? 'Match en cours'
    : match.status === 'POSTPONED' ? 'Reporté · nouvel horaire à venir'
      : now !== undefined && match.starts_at ? (state.tone === 'late' ? 'En attente du coup d’envoi' : `Coup d’envoi ${countdown(match.starts_at, now)}`) : '';
  return <Paper component="section" p="lg" radius="lg" className="next-match" data-tone={state.tone} aria-labelledby="next-title">
    <Text id="next-title" fz="sm" fw={700} tt="uppercase" className="next-label">{compact ? `Prochain match · ${name(teamId)}` : 'Prochain match'}</Text>
    <Text fz={{ base: 26, sm: 30 }} fw={800} lh={1.2} mt={4} style={{ overflowWrap: 'anywhere' }}><Text span fz="md" fw={500}>contre</Text> {name(opponent)}</Text>
    <SimpleGrid cols={3} component="dl" mt="md" mb={0}>
      {[['Heure', match.status === 'POSTPONED' ? '—' : time(match.starts_at)], ['Terrain', match.status === 'POSTPONED' ? '—' : name(match.court_id)], [match.phase === 'FINAL' ? 'Match' : 'Poule', group(match)]].map(([term, value]) => <Box key={term}>
        <Text component="dt" fz="xs" tt="uppercase" fw={700} className="next-label">{term}</Text><Text component="dd" m={0} fw={800} fz="lg">{value}</Text>
      </Box>)}
    </SimpleGrid>
    <Text mt="sm" fw={600} aria-live="polite">{timing}</Text>
  </Paper>;
}

const ordinal = (place: number) => place === 1 ? '1er' : `${place}e`;

/**
 * Classement du tournoi pendant la phase de classement : chaque équipe avec sa place, ou la plage de places
 * qu’elle dispute encore ; il devient le classement final quand toutes les places sont jouées.
 */
export function TournamentRanking({ snapshot, highlight }: { snapshot: PublicTournament; highlight?: string }) {
  const { name } = useNames(snapshot);
  const rows = snapshot.placement.ranking
    ? snapshot.placement.ranking.map((team, index) => ({ team_id: team, place_from: index + 1, place_to: index + 1 }))
    : snapshot.placement.standing;
  if (!rows) return null;
  return <Paper withBorder radius="md" component="ol" m={0} p={0} style={{ listStyle: 'none', overflow: 'hidden' }}>
    {rows.map((row, index) => {
      const exact = row.place_from === row.place_to;
      return <Group key={row.team_id} component="li" gap="sm" px="md" py={8} wrap="nowrap" aria-current={row.team_id === highlight ? 'true' : undefined}
        style={{ borderTop: index ? '1px solid var(--mantine-color-default-border)' : undefined, background: row.team_id === highlight ? 'var(--mantine-primary-color-light)' : undefined }}>
        <Text fw={800} w={52} c={exact && row.place_from <= 3 ? 'var(--tournio-accent)' : undefined} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{exact ? ordinal(row.place_from) : `${row.place_from}–${row.place_to}`}</Text>
        <div style={{ minWidth: 0 }}>
          <Text fw={exact && row.place_from <= 3 ? 800 : 600} style={{ overflowWrap: 'anywhere' }}>{name(row.team_id)}</Text>
          {!exact ? <Text fz="xs" c="dimmed">En lice pour les places {row.place_from} à {row.place_to}</Text> : null}
        </div>
      </Group>;
    })}
  </Paper>;
}
