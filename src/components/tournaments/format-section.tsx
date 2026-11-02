'use client';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, Group, List, ListItem, NumberInput, Paper, RadioCard, RadioGroup, RadioIndicator, SimpleGrid, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';
import { blockSize, extraMatches, fairnessWarning, FINAL_FORMATS, firstRound, formatProblems, incompleteNote, type FinalFormat } from '@/lib/domain/placement';
import { poolsInOrder, scheduleRules } from '@/lib/tournaments/schedule';
import { estimateDuration, formatDuration } from '@/lib/domain/estimate';
import { poolAdvice, poolOptions } from '@/lib/domain/pool-advice';
import { Disclosure } from '@/components/ui/disclosure';
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
    how: ['Les deux meilleurs premiers de poule jouent la finale.', 'Les deux suivants jouent pour les places 3 et 4, et ainsi de suite jusqu’à la dernière place.', 'Nombre d’équipes pair, ou groupe incomplet autorisé (les 3 dernières jouent alors en groupe de 3).'],
    fit: 'Le plus court : idéal en fin de soirée.',
  },
  cross: {
    title: 'Croisé en deux tours',
    summary: 'Demi-finales croisées entre poules, puis un match pour chaque place.',
    how: ['Les équipes forment des groupes de 4 d’après le classement général (les 4 meilleures, puis les 4 suivantes…).', 'Tour 1 : dans chaque groupe, 1re contre 4e et 2e contre 3e.', 'Tour 2 : les gagnants jouent pour les deux meilleures places du groupe, les perdants pour les deux suivantes.', 'Nombre d’équipes multiple de 4, ou groupe incomplet autorisé (groupes de 3 pour les dernières places, chacune joue toujours 2 matchs).'],
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

export function FormatSection({ data, busy, feedback, onSave }: { data: TournamentConfiguration; busy: boolean; feedback: React.ReactNode; onSave: (format: FinalFormat, roundBreak: number, allowIncomplete: boolean) => Promise<boolean> }) {
  // Vide tant que l’organisateur n’a pas choisi (le calendrier attend ce choix).
  const [format, setFormat] = useState<FinalFormat | null>(data.rules.final_format);
  const [roundBreak, setRoundBreak] = useState<number>(data.rules.round_break_minutes);
  const [allowIncomplete, setAllowIncomplete] = useState<boolean>(data.rules.allow_incomplete);
  const breakValid = Number.isInteger(roundBreak) && roundBreak >= 0 && roundBreak <= 600;
  const pools = poolsInOrder(data);
  const sizes = pools.map((pool) => pool.teams.length);
  const teams = sizes.reduce((sum, size) => sum + size, 0);
  // Seules les équipes placées dans une poule jouent : les autres sont signalées.
  const unplaced = data.teams.length - new Set(data.pool_teams.map((row) => row.team_id)).size;
  const started = data.matches.some((match) => match.phase === 'FINAL');
  const status = data.tournament.status;
  const locked = started || (status !== 'DRAFT' && status !== 'PUBLISHED');
  const warning = format && format !== 'none' ? fairnessWarning(sizes) : null;
  const rules = scheduleRules(data);
  const t = data.tournament;
  const start = Date.parse(t.starts_at);
  const estimates = Object.fromEntries(FINAL_FORMATS.map((id) => [id, estimateDuration(pools, data.courts.length, rules, id, breakValid ? roundBreak : 0, data.rules.aligned_slots, allowIncomplete)]));
  const endLabel = (minutes: number) => formatMatchTime(new Date(start + minutes * 60_000).toISOString(), t.timezone, Date.parse(t.ends_at) - start > 20 * 3_600_000);
  const overruns = (minutes: number) => start + minutes * 60_000 > Date.parse(t.ends_at);

  const selectedProblems = format ? formatProblems(format, sizes, allowIncomplete) : [];
  const selected = format ? estimates[format] : null;
  const shortfall = format && !selectedProblems.length ? incompleteNote(format, teams) : null;
  const canChooseIncomplete = (['rank', 'cross'] as const).some((id) => formatProblems(id, sizes).length > 0 && !formatProblems(id, sizes, true).length);
  // Conseils sur le nombre de poules, pour le format choisi et la durée prévue du tournoi.
  const available = (Date.parse(t.ends_at) - start) / 60_000;
  const options = format && teams >= 4 && data.courts.length && !selectedProblems.length
    ? poolOptions({ teams, courts: data.courts.length, rules: { matchMinutes: rules.matchMinutes, transitionMinutes: rules.transitionMinutes, restMinutes: rules.restMinutes }, format, breakMinutes: breakValid ? roundBreak : 0, aligned: data.rules.aligned_slots, allowIncomplete, availableMinutes: available })
    : [];
  const advice = selected ? poolAdvice(options, pools.length, selected.totalMinutes, available) : { kind: 'ok' as const };
  const optionLabel = (option: (typeof options)[number]) => `${option.pools} poules (${option.smallest === option.largest ? `${option.smallest} équipes` : `${option.smallest} à ${option.largest} équipes`})`;
  const perTeamLabel = (range: [number, number]) => range[0] === range[1] ? `${range[0]} matchs par équipe` : `${range[0]} à ${range[1]} matchs par équipe`;
  const tinyPools = sizes.some((size) => size < 3) && pools.length > 1;
  const dirty = format !== data.rules.final_format || roundBreak !== data.rules.round_break_minutes || allowIncomplete !== data.rules.allow_incomplete;
  const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
  // Matchs par équipe : n − 1 en poule (fourchette si les poules sont inégales), plus la phase de classement.
  const poolMin = sizes.length ? Math.min(...sizes) - 1 : 0;
  const poolMax = sizes.length ? Math.max(...sizes) - 1 : 0;
  const perTeam = (id: FinalFormat) => {
    const extra = id === 'none' ? 0 : extraMatches(id, teams);
    const low = poolMin + extra; const high = poolMax + extra;
    return { total: low === high ? `${low} match${low > 1 ? 's' : ''} par équipe` : `${low} à ${high} matchs par équipe`,
      detail: `${poolMin === poolMax ? poolMin : `${poolMin} à ${poolMax}`} en poule${extra ? ` + ${extra} en classement` : ''}` };
  };

  return <Card>
    <Title order={2} fz="xl">Format du tournoi</Title>
    <Text c="dimmed" mt={2}>Que se passe-t-il quand toutes les poules sont jouées ?</Text>

    {/* Contexte des estimations : ce que l’organisateur a saisi dans les onglets précédents. */}
    <Group gap={6} mt="sm" mb="md" className="format-context">
      {[plural(teams, 'équipe'), plural(pools.length, 'poule'), plural(data.courts.length, 'terrain'), `matchs de ${rules.matchMinutes} min`, `repos ${rules.restMinutes} min`, data.rules.aligned_slots ? 'horaires alignés' : null]
        .filter(Boolean).map((label) => <Badge key={label} variant="default" radius="sm" tt="none" fw={500} size="lg">{label}</Badge>)}
    </Group>
    {unplaced ? <Alert color="orange" variant="light" mb="md">{unplaced} équipe{unplaced > 1 ? 's n’ont' : ' n’a'} pas encore de poule : {unplaced > 1 ? 'elles ne sont pas comptées et ne joueront' : 'elle n’est pas comptée et ne jouera'} pas. Placez-{unplaced > 1 ? 'les' : 'la'} dans l’onglet Équipes et poules.</Alert> : null}
    {!estimates.none ? <Text fz="sm" c="dimmed" mb="md">Ajoutez des équipes réparties en poules (au moins deux par poule) et des terrains : la durée de chaque format s’affichera ici.</Text> : null}

    {advice.kind !== 'ok' || tinyPools ? <Alert mb="md" variant="light" color={advice.kind === 'remove' ? 'teal' : 'orange'} title="Conseil">
      {advice.kind === 'add' ? <>Avec {pools.length} poules, le tournoi dépasse la durée prévue. <strong>Ajoutez des poules</strong> : avec {optionLabel(advice.option)}, il tiendrait en ≈ {formatDuration(advice.option.totalMinutes)} (fin vers {endLabel(advice.option.totalMinutes)}), {perTeamLabel(advice.option.matchesPerTeam)}.</>
        : advice.kind === 'remove' ? <>Il reste de la marge. <strong>Vous pouvez enlever des poules</strong> pour faire jouer davantage chaque équipe : avec {optionLabel(advice.option)}, {perTeamLabel(advice.option.matchesPerTeam)}, fin vers {endLabel(advice.option.totalMinutes)}.</>
          : advice.kind === 'impossible' ? <>Même avec {optionLabel(advice.option)}, le tournoi dépasse (≈ {formatDuration(advice.option.totalMinutes)} pour {formatDuration(available)} prévues). <strong>Ajoutez des terrains</strong>, raccourcissez les matchs ou le repos, ou prolongez le tournoi.</> : null}
      {tinyPools ? <>{advice.kind !== 'ok' ? ' ' : ''}Certaines poules n’ont que 2 équipes : elles ne jouent qu’un match de poule. Regroupez-les en <strong>enlevant une poule</strong>.</> : null}
    </Alert> : null}

    <RadioGroup value={format} onChange={(value) => setFormat(value as FinalFormat)} aria-label="Format du tournoi">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        {FINAL_FORMATS.map((id) => {
          const info = FORMAT_INFO[id];
          const problems = formatProblems(id, sizes, allowIncomplete);
          const estimate = !problems.length ? estimates[id] : null;
          const extra = extraMatches(id, teams);
          return <RadioCard key={id} value={id} radius="md" p="md" disabled={locked || busy || problems.length > 0} className="theme-card format-card" data-incompatible={problems.length > 0 || undefined}>
            <Stack gap={8} h="100%">
              <Group gap={8} wrap="nowrap" align="flex-start"><RadioIndicator mt={2} /><Text fw={800} lh={1.3}>{info.title}</Text></Group>
              <Text fz="sm" c="dimmed">{info.summary}</Text>
              {problems.length ? <Text fz="sm" fw={600} c="var(--tv-orange-text, #9a3412)" className="format-reason" mt="auto">{problems.join(' ')}</Text>
                : <Stack gap={2} mt="auto">
                  {teams ? <div className="format-per-team"><Text fz="sm" fw={800}>{perTeam(id).total}</Text><Text fz="xs" c="dimmed">{perTeam(id).detail}</Text></div>
                    : <Text fz="sm" fw={600}>{id === 'none' ? 'Aucun match en plus' : `+${plural(extra, 'match')} par équipe`}</Text>}
                  {estimate ? <Text fz="xl" fw={800} lh={1.2} className="format-duration" data-overrun={overruns(estimate.totalMinutes) || undefined}>≈ {formatDuration(estimate.totalMinutes)}</Text> : null}
                  {estimate ? <Text fz="xs" c={overruns(estimate.totalMinutes) ? 'var(--tv-orange-text, #9a3412)' : 'dimmed'} fw={overruns(estimate.totalMinutes) ? 700 : 400}>
                    fin vers {endLabel(estimate.totalMinutes)}{overruns(estimate.totalMinutes) ? ' · dépasse la fin prévue' : ''}</Text> : null}
                </Stack>}
            </Stack>
          </RadioCard>;
        })}
      </SimpleGrid>
    </RadioGroup>

    {/* Le format choisi, en détail (rien tant qu’aucun format n’est choisi). */}
    {!format ? <Alert mt="md" variant="light" color="orange" title="Format à choisir">Choisissez ce qui suit les poules : le calendrier ne pourra être généré qu’une fois le format enregistré.</Alert> : <Paper withBorder radius="md" p="md" mt="md" className="format-detail">
      <Group justify="space-between" gap="xs" mb={6}><Text fw={800}>{FORMAT_INFO[format].title}{teams && !selectedProblems.length ? ` · ${perTeam(format).total} (${perTeam(format).detail})` : ''}</Text><Text fz="sm" c="dimmed" fs="italic">{FORMAT_INFO[format].fit}</Text></Group>
      <List size="sm" spacing={2}>{FORMAT_INFO[format].how.map((line) => <ListItem key={line}>{line}</ListItem>)}</List>
      {format !== 'none' && !selectedProblems.length && pools.length > 1 ? <Text fz="sm" mt="sm"><Text span fw={700} fz="sm">Avec vos poules : </Text>{example(format, pools)}</Text> : null}
      {shortfall ? <Text fz="sm" mt="xs" fw={600} c="var(--tv-orange-text, #9a3412)">{shortfall}</Text> : null}
      {selected && !selectedProblems.length ? <Text fz="sm" mt="xs" c="dimmed">{format === 'none'
        ? `Durée : ${formatDuration(selected.totalMinutes)} pour ${plural(selected.poolMatches, 'match')} de poule.`
        : `Durée : poules ${formatDuration(selected.poolMinutes)} (${plural(selected.poolMatches, 'match')}) + classement ${formatDuration(selected.placementMinutes)} (${plural(selected.placementMatches, 'match')}).`} Estimation sans pause, terrains disponibles en continu dès {endLabel(0)}.</Text> : null}
      {options.length > 1 ? <Disclosure label="Comparer le nombre de poules">
        <Table fz="sm" verticalSpacing={4} horizontalSpacing="xs" tabularNums>
          <TableThead><TableTr><TableTh>Poules</TableTh><TableTh>Matchs par équipe</TableTh><TableTh>Durée</TableTh><TableTh>Fin vers</TableTh></TableTr></TableThead>
          <TableTbody>{options.map((option) => <TableTr key={option.pools} fw={option.pools === pools.length ? 800 : undefined} aria-current={option.pools === pools.length ? 'true' : undefined}>
            <TableTd>{optionLabel(option)}{option.pools === pools.length ? ' · actuel' : ''}</TableTd>
            <TableTd>{option.matchesPerTeam[0] === option.matchesPerTeam[1] ? option.matchesPerTeam[0] : `${option.matchesPerTeam[0]} à ${option.matchesPerTeam[1]}`}</TableTd>
            <TableTd>≈ {formatDuration(option.totalMinutes)}</TableTd>
            <TableTd c={option.totalMinutes > available ? 'var(--tv-orange-text, #9a3412)' : undefined}>{endLabel(option.totalMinutes)}{option.totalMinutes > available ? ' (dépasse)' : ''}</TableTd>
          </TableTr>)}</TableTbody>
        </Table>
        <Text fz="xs" c="dimmed" mt={4}>Équipes réparties au plus juste ; changez le nombre de poules dans l’onglet Équipes et poules.</Text>
      </Disclosure> : null}
      {format !== 'none' ? <Text fz="xs" c="dimmed" mt="sm">Personne n’est éliminé : chaque équipe joue le même nombre de matchs et toutes les places sont disputées. Le classement général prend tous les premiers de poule, puis tous les deuxièmes… ; à rang égal, la meilleure moyenne par match passe devant. Un match de classement ne peut pas finir à égalité. Vous lancez chaque tour depuis l’onglet Résultats.</Text> : null}
    </Paper>}

    {format && format !== 'none' ? <Stack gap="sm" mt="md">
      <Text fw={700}>Options</Text>
      {canChooseIncomplete || allowIncomplete
        ? <Checkbox checked={allowIncomplete} disabled={locked || busy} onChange={(event) => setAllowIncomplete(event.currentTarget.checked)} label="Autoriser un groupe incomplet"
          description="Quand le nombre d’équipes ne tombe pas juste : les dernières du classement général jouent en groupes de 3, chaque équipe garde le même nombre de matchs." /> : null}
      <NumberInput label="Pause entre les tours (min)" description={`Avant chaque tour de classement, y compris après les poules. Si elle est plus courte que le repos minimal (${rules.restMinutes} min), c’est le repos qui s’applique.`}
        value={roundBreak} onChange={(value) => setRoundBreak(typeof value === 'number' ? value : Number(value) || 0)} min={0} max={600} step={5} allowDecimal={false} allowNegative={false} clampBehavior="strict" maw={420} disabled={locked || busy}
        error={breakValid ? undefined : 'Entre 0 et 600 minutes.'} />
    </Stack> : null}

    {warning ? <Alert color="orange" variant="light" mt="md">{warning}</Alert> : null}
    {started ? <Text fz="sm" c="dimmed" mt="md">La phase de classement a commencé : annulez ses tours (onglet Résultats) pour changer de format.</Text> : null}
    {feedback}
    <Group mt="md" gap="sm">
      <Button disabled={!format || locked || !breakValid || selectedProblems.length > 0 || !dirty} loading={busy}
        onClick={() => { if (format) void onSave(format, format === 'none' ? data.rules.round_break_minutes : roundBreak, allowIncomplete); }}>Enregistrer le format</Button>
      {dirty && !locked ? <Text fz="sm" c="dimmed">Modifications non enregistrées.</Text> : null}
    </Group>
  </Card>;
}
