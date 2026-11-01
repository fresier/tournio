'use client';
import { useState } from 'react';
import { Alert, Badge, Box, Button, Card, Group, List, ListItem, NumberInput, RadioCard, RadioGroup, RadioIndicator, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { blockSize, extraMatches, fairnessWarning, FINAL_FORMATS, firstRound, formatProblems, type FinalFormat } from '@/lib/domain/placement';
import { poolsInOrder, scheduleRules } from '@/lib/tournaments/schedule';
import { estimateDuration, formatDuration } from '@/lib/domain/estimate';
import { formatMatchTime } from '@/lib/tournaments/dates';
import type { TournamentConfiguration } from '@/lib/tournaments/contracts';

/** Textes destinés à l’organisateur : ce que fait chaque format, pour qui, et ce qu’il demande. */
export const FORMAT_INFO: Record<FinalFormat, { title: string; summary: string; how: string[]; fit: string }> = {
  none: {
    title: 'Poules uniquement',
    summary: 'Le tournoi s’arrête après les poules.',
    how: ['Chaque poule a son propre classement.', 'Il n’y a pas de classement général ni de finale.'],
    fit: 'Pour un tournoi court ou une seule poule.',
  },
  rank: {
    title: 'Un match par rang',
    summary: 'Les équipes de même rang s’affrontent pour une place.',
    how: ['Les deux meilleurs premiers de poule jouent la finale.', 'Les deux suivants jouent pour les places 3 et 4, et ainsi de suite jusqu’à la dernière place.', 'Exige un nombre pair d’équipes.'],
    fit: 'Le plus court : idéal en fin de soirée.',
  },
  cross: {
    title: 'Croisé en deux tours',
    summary: 'Demi-finales croisées entre poules, puis un match pour chaque place.',
    how: ['Les équipes forment des groupes de 4 d’après le classement général (les 4 meilleures, puis les 4 suivantes…).', 'Tour 1 : dans chaque groupe, 1re contre 4e et 2e contre 3e.', 'Tour 2 : les gagnants jouent pour les deux meilleures places du groupe, les perdants pour les deux suivantes.', 'Exige un nombre d’équipes multiple de 4.'],
    fit: 'Le bon équilibre : chacun a une seconde chance.',
  },
  bracket: {
    title: 'Tableau complet',
    summary: 'Toutes les équipes dans un même tableau, toutes les places disputées.',
    how: ['Avec 8 équipes : quarts, demies, puis finales pour chaque place.', 'À chaque tour, les gagnants rencontrent les gagnants et les perdants les perdants.', 'Exige 4, 8, 16 ou 32 équipes.'],
    fit: 'Le plus long : le classement le plus fin.',
  },
};

const ordinal = (rank: number) => rank === 1 ? '1er' : `${rank}e`;

/** Exemple concret sur les poules du tournoi : « 1er Poule A – 2e Poule B ». */
function example(format: FinalFormat, pools: { name: string; teams: string[] }[]) {
  const depth = Math.max(0, ...pools.map((pool) => pool.teams.length));
  const seeds: string[] = [];
  for (let rank = 1; rank <= depth; rank++) for (const pool of pools) if (pool.teams.length >= rank) seeds.push(`${ordinal(rank)} ${pool.name}`);
  const pairs = firstRound(seeds, blockSize(format, seeds.length));
  return pairs.slice(0, 4).map((pair) => `${pair.home} – ${pair.away}`).join(' · ') + (pairs.length > 4 ? ' · …' : '');
}

export function FormatSection({ data, busy, feedback, onSave }: { data: TournamentConfiguration; busy: boolean; feedback: React.ReactNode; onSave: (format: FinalFormat, roundBreak: number) => Promise<boolean> }) {
  const [format, setFormat] = useState<FinalFormat>(data.rules.final_format);
  const [roundBreak, setRoundBreak] = useState<number>(data.rules.round_break_minutes);
  const breakValid = Number.isInteger(roundBreak) && roundBreak >= 0 && roundBreak <= 600;
  const pools = poolsInOrder(data);
  const sizes = pools.map((pool) => pool.teams.length);
  const teams = sizes.reduce((sum, size) => sum + size, 0);
  const started = data.matches.some((match) => match.phase === 'FINAL');
  const status = data.tournament.status;
  const locked = started || (status !== 'DRAFT' && status !== 'PUBLISHED');
  const warning = format !== 'none' ? fairnessWarning(sizes) : null;
  const rules = scheduleRules(data);
  const t = data.tournament;
  const start = Date.parse(t.starts_at);
  const estimates = Object.fromEntries(FINAL_FORMATS.map((id) => [id, estimateDuration(pools, data.courts.length, rules, id, breakValid ? roundBreak : 0, data.rules.aligned_slots)]));
  const endLabel = (minutes: number) => formatMatchTime(new Date(start + minutes * 60_000).toISOString(), t.timezone, Date.parse(t.ends_at) - start > 20 * 3_600_000);
  const overruns = (minutes: number) => start + minutes * 60_000 > Date.parse(t.ends_at);

  return <Card>
    <Title order={2} fz="xl">Format du tournoi</Title>
    <Text fz="sm" c="dimmed" mb="md">Que se passe-t-il quand toutes les poules sont jouées ? Dans les formats avec phase de classement, aucune équipe n’est éliminée : chacune joue le même nombre de matchs supplémentaires et toutes les places sont disputées. Ce choix reste modifiable après la publication, tant que la phase de classement n’a pas commencé.</Text>
    <Text fz="sm" mb="sm">{estimates.none
      ? <>Durées estimées pour <strong>{teams} équipes</strong>, <strong>{pools.length} poule{pools.length > 1 ? 's' : ''}</strong> et <strong>{data.courts.length} terrain{data.courts.length > 1 ? 's' : ''}</strong>, avec des matchs de {rules.matchMinutes} min, {rules.transitionMinutes} min de transition et {rules.restMinutes} min de repos minimal{data.rules.aligned_slots ? `, horaires alignés toutes les ${rules.matchMinutes + Math.max(rules.transitionMinutes, rules.restMinutes)} min` : ''}. {format !== 'none' && roundBreak > rules.restMinutes ? ` Pause de ${roundBreak} min avant chaque tour de classement.` : ''} Terrains supposés disponibles sans interruption dès le début ({endLabel(0)}).</>
      : <Text span c="dimmed" fz="sm">Ajoutez des équipes réparties en poules (au moins deux par poule) et des terrains pour obtenir une estimation de durée.</Text>}</Text>
    <RadioGroup value={format} onChange={(value) => setFormat(value as FinalFormat)} aria-label="Format du tournoi">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {FINAL_FORMATS.map((id) => {
          const info = FORMAT_INFO[id];
          const problems = formatProblems(id, sizes);
          const extra = extraMatches(id, teams);
          return <RadioCard key={id} value={id} radius="md" p="md" disabled={locked || busy || problems.length > 0} className="theme-card">
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <RadioIndicator mt={3} />
              <Stack gap={6} style={{ minWidth: 0 }}>
                <Group gap="xs"><Text fw={800}>{info.title}</Text>{id !== 'none' && !problems.length ? <Badge size="sm" color="ink">+{extra} match{extra > 1 ? 's' : ''} par équipe</Badge> : null}</Group>
                <Text fz="sm">{info.summary}</Text>
                <List size="sm" spacing={2}>{info.how.map((line) => <ListItem key={line}>{line}</ListItem>)}</List>
                {id !== 'none' && !problems.length && pools.length > 1 ? <Text fz="xs" c="dimmed"><Text span fw={700} fz="xs">Exemple avec vos poules : </Text>{example(id, pools)}</Text> : null}
                {!problems.length && estimates[id] ? <Box className="estimate" data-overrun={overruns(estimates[id]!.totalMinutes) || undefined}>
                  <Text fz="sm" fw={800}>≈ {formatDuration(estimates[id]!.totalMinutes)} · fin vers {endLabel(estimates[id]!.totalMinutes)}</Text>
                  <Text fz="xs" c="dimmed">{id === 'none' ? `${estimates[id]!.poolMatches} matchs de poule` : `Poules ${formatDuration(estimates[id]!.poolMinutes)} (${estimates[id]!.poolMatches} matchs) + classement ${formatDuration(estimates[id]!.placementMinutes)} (${estimates[id]!.placementMatches} matchs)`}</Text>
                  {overruns(estimates[id]!.totalMinutes) ? <Text fz="xs" fw={700} c="var(--tv-orange-text, #9a3412)">Dépasse la fin prévue du tournoi ({endLabel((Date.parse(t.ends_at) - start) / 60_000)}).</Text> : null}
                </Box> : null}
                {problems.length ? <Text fz="sm" fw={600} c="var(--tv-orange-text, #9a3412)">Indisponible : {problems.join(' ')}</Text> : <Text fz="xs" c="dimmed" fs="italic">{info.fit}</Text>}
              </Stack>
            </Group>
          </RadioCard>;
        })}
      </SimpleGrid>
    </RadioGroup>
    <Stack gap="sm" mt="md">
      {format !== 'none' ? <Box><Text fz="sm" fw={700}>Bon à savoir</Text>
        <List size="sm" spacing={2}>
          <ListItem>Classement général : tous les premiers de poule, puis tous les deuxièmes… À rang égal, la meilleure moyenne de points par match passe devant.</ListItem>
          <ListItem>Un match de classement ne peut pas finir à égalité : saisissez le score qui départage les équipes.</ListItem>
          <ListItem>Vous lancez chaque tour vous-même depuis la section Résultats, une fois le tour précédent joué.</ListItem>
        </List>
      </Box> : null}
      {format !== 'none' ? <NumberInput label="Pause entre les tours (min)" description={`Avant chaque tour de la phase de classement, y compris après les poules : aucun match pendant la pause. Si elle est plus courte que le repos minimal (${rules.restMinutes} min), c’est le repos qui s’applique.`}
        value={roundBreak} onChange={(value) => setRoundBreak(typeof value === 'number' ? value : Number(value) || 0)} min={0} max={600} step={5} allowDecimal={false} allowNegative={false} clampBehavior="strict" maw={420} disabled={locked || busy}
        error={breakValid ? undefined : 'Entre 0 et 600 minutes.'} /> : null}
      {warning ? <Alert color="orange" variant="light">{warning}</Alert> : null}
      {started ? <Text fz="sm" c="dimmed">La phase de classement a commencé : annulez ses tours (section Résultats) pour changer de format.</Text> : null}
      {feedback}
      <Group><Button disabled={locked || !breakValid || (format === data.rules.final_format && roundBreak === data.rules.round_break_minutes)} loading={busy} onClick={() => void onSave(format, format === 'none' ? data.rules.round_break_minutes : roundBreak)}>Enregistrer le format</Button></Group>
    </Stack>
  </Card>;
}
