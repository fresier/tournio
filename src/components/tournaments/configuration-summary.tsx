'use client';
import { Group, Paper, Progress, SimpleGrid, Text, UnstyledButton } from '@mantine/core';
import type { TournamentConfiguration } from '@/lib/tournaments/contracts';

type Target = 'results' | 'schedule' | 'teams' | 'pools' | 'courts';
type Kpi = { key: string; label: string; value: string; detail: string; warn?: boolean; progress?: number; target: Target; action: string };

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
function hours(minutes: number) {
  const h = Math.floor(minutes / 60); const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Indicateurs de l’éditeur : avancement et points à régler, chacun ouvre la section concernée. */
export function kpis(data: TournamentConfiguration): Kpi[] {
  const total = data.matches.length;
  const closed = data.matches.filter((match) => match.status === 'COMPLETED' || match.status === 'CANCELLED').length;
  const live = data.matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const postponed = data.matches.filter((match) => match.status === 'POSTPONED').length;
  const assigned = new Set(data.pool_teams.map((row) => row.team_id)).size;
  const unassigned = data.teams.length - assigned;
  const sizes = data.pools.map((pool) => data.pool_teams.filter((row) => row.pool_id === pool.id).length);
  const [smallest, largest] = sizes.length ? [Math.min(...sizes), Math.max(...sizes)] : [0, 0];
  const minutes = data.availabilities.reduce((sum, row) => sum + (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000, 0);
  const idleCourts = data.courts.filter((court) => !data.availabilities.some((row) => row.court_id === court.id)).length;

  return [
    total ? {
      key: 'matches', label: 'Matchs', value: `${closed} / ${total}`, progress: closed / total * 100, target: 'results', action: 'Voir les résultats',
      detail: live ? `${plural(live, 'match')} en cours` : postponed ? `${plural(postponed, 'match')} à replanifier` : closed === total ? 'Tous joués' : 'joués ou annulés', warn: postponed > 0 && !live,
    } : { key: 'matches', label: 'Matchs', value: '—', detail: 'Calendrier à générer', warn: data.teams.length > 0, target: 'schedule', action: 'Ouvrir le calendrier' },
    {
      key: 'teams', label: 'Équipes', value: String(data.teams.length), progress: data.teams.length ? assigned / data.teams.length * 100 : 0, target: 'teams', action: 'Gérer les équipes',
      detail: !data.teams.length ? 'Aucune équipe inscrite' : unassigned ? `${unassigned} sans poule` : 'Toutes dans une poule', warn: !data.teams.length || unassigned > 0,
    },
    {
      key: 'pools', label: 'Poules', value: String(data.pools.length), target: 'pools', action: 'Gérer les poules',
      detail: !data.pools.length ? 'Aucune poule' : smallest === largest ? `${plural(smallest, 'équipe')} chacune` : `${smallest} à ${largest} équipes`, warn: !data.pools.length || smallest < 2,
    },
    {
      key: 'courts', label: 'Terrains', value: String(data.courts.length), target: 'courts', action: 'Gérer les terrains',
      detail: !data.courts.length ? 'Aucun terrain' : idleCourts ? `${idleCourts} sans disponibilité` : `${hours(minutes)} de créneaux`, warn: !data.courts.length || idleCourts > 0,
    },
  ];
}

export function ConfigurationSummary({ data, onOpen }: { data: TournamentConfiguration; onOpen: (target: Target) => void }) {
  return <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm" mb="md" component="section" aria-label="Résumé du tournoi">
    {kpis(data).map((kpi) => <UnstyledButton key={kpi.key} onClick={() => onOpen(kpi.target)} className="kpi-card">
      <Paper withBorder p="md" h="100%">
        <Text fz="xs" fw={700} tt="uppercase" c="dimmed" lts={0.5}>{kpi.label}</Text>
        <Text fz={30} fw={800} lh={1.15} mt={2} style={{ fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</Text>
        {kpi.progress !== undefined ? <Progress value={kpi.progress} size="sm" radius="xl" mt={8} color={kpi.progress >= 100 ? 'teal' : 'ink'} aria-hidden="true" /> : null}
        <Group gap={6} mt={8} wrap="nowrap">
          {kpi.warn ? <span className="kpi-warn" aria-hidden="true" /> : null}
          <Text fz="sm" fw={kpi.warn ? 600 : 400} c={kpi.warn ? 'var(--tv-orange-text, #9a3412)' : 'dimmed'} lineClamp={1}>{kpi.detail}</Text>
        </Group>
        <span className="sr-only">. {kpi.action}</span>
      </Paper>
    </UnstyledButton>)}
  </SimpleGrid>;
}
