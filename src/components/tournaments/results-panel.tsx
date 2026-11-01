'use client';
import { useState, type FormEvent } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Box, Button, Card, Group, Paper, Stack, Tabs, TabsList, TabsPanel, TabsTab, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, TextInput, Title } from '@mantine/core';
import { FormFeedback } from '@/components/forms/field';
import { Disclosure } from '@/components/ui/disclosure';
import { MatchStatus } from '@/components/ui/status';
import { matchCommandSchema, scheduleCommandSchema, startMatchesSchema, type MatchCommand, type TournamentConfiguration } from '@/lib/tournaments/contracts';
import { configurationRequest, FormError } from '@/lib/tournaments/client';
import { formatMatchTime, spansSeveralDays } from '@/lib/tournaments/dates';
import { standings } from '@/lib/domain/standings';
import { poolsInOrder } from '@/lib/tournaments/schedule';
import { placementLabel } from '@/lib/domain/placement';
import { placementState } from '@/lib/tournaments/placement';
import { PlacementCard } from './placement-card';

type Match = TournamentConfiguration['matches'][number];

export function ResultsPanel({ data, onChange, onShowSchedule, onShowRules }: { data: TournamentConfiguration; onChange: (next: TournamentConfiguration) => void; onShowSchedule: () => void; onShowRules: () => void }) {
  // Filtre gardé dans l’URL (?matchs=tous) ; « à saisir » par défaut.
  const [filterParam, setFilterParam] = useQueryState('matchs', parseAsStringLiteral(['a-saisir', 'tous'] as const).withDefault('a-saisir').withOptions({ scroll: false }));
  const filter: 'open' | 'all' = filterParam === 'tous' ? 'all' : 'open';
  const setFilter = (value: 'open' | 'all') => { void setFilterParam(value === 'all' ? 'tous' : null); };
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; error?: FormError; success?: string } | null>(null);
  const t = data.tournament;
  const names = new Map([...data.teams, ...data.pools, ...data.courts].map((row) => [row.id, row.name]));
  const name = (id: string | null) => (id ? names.get(id) : undefined) ?? '—';
  const group = (match: Match) => match.pool_id ? name(match.pool_id) : placementLabel(match.place_from!, match.place_to!);
  const placement = placementState(data);
  const placementPending = placement.format !== 'none' && !placement.finished;
  const multiDay = spansSeveralDays(t.starts_at, t.ends_at, t.timezone);
  const open = data.matches.filter((match) => match.status !== 'COMPLETED' && match.status !== 'CANCELLED');
  const shown = filter === 'open' ? open : data.matches;

  if (t.status === 'DRAFT') return <Card><Title order={2} fz="xl" mb="xs">Résultats</Title><Text c="dimmed">La saisie des résultats s’ouvre après la publication du tournoi (section Calendrier).</Text></Card>;

  async function send(match: Match, command: Omit<MatchCommand, 'expected_version'>, success: string) {
    setBusy(match.id); setFeedback(null);
    try {
      const body = matchCommandSchema.parse({ ...command, expected_version: match.version });
      const next = await configurationRequest(`/api/v1/admin/tournaments/${t.id}/matches/${match.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onChange(next); setFeedback({ id: match.id, success });
    } catch (error) {
      setFeedback({ id: match.id, error: error instanceof FormError ? error : new FormError('Enregistrement impossible. Vérifiez votre connexion puis réessayez.') });
    } finally { setBusy(null); }
  }

  function record(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const home_score = Number(form.get('home_score'));
    const away_score = Number(form.get('away_score'));
    if (home_score === away_score && match.phase === 'FINAL') { setFeedback({ id: match.id, error: new FormError('Un match de classement doit désigner un vainqueur : saisissez le score qui départage les équipes.') }); return; }
    if (home_score === away_score && !data.rules.allow_draw) { setFeedback({ id: match.id, error: new FormError('Les matchs nuls ne sont pas autorisés dans ce tournoi.') }); return; }
    const summary = `${name(match.home_team_id)} ${home_score} – ${away_score} ${name(match.away_team_id)}`;
    void send(match, { operation: 'record_result', payload: { home_score, away_score } }, match.status === 'COMPLETED' ? `Résultat corrigé : ${summary}. Classement recalculé.` : `Résultat enregistré : ${summary}.`);
  }

  /** Créneaux : les matchs à saisir regroupés par heure de début (les matchs sans horaire à la fin). */
  const groups: { key: string; label: string; matches: Match[] }[] = [];
  for (const match of shown) {
    const key = match.starts_at ? `slot:${match.starts_at}` : 'slot:none';
    const group = groups.find((row) => row.key === key);
    if (group) group.matches.push(match);
    else groups.push({ key, label: match.starts_at ? formatMatchTime(match.starts_at, t.timezone, multiDay) : 'Sans horaire', matches: [match] });
  }

  async function startGroup(key: string, matches: Match[]) {
    setBusy(key); setFeedback(null);
    try {
      const body = startMatchesSchema.parse({ matches: matches.map((match) => ({ id: match.id, expected_version: match.version })) });
      onChange(await configurationRequest(`/api/v1/admin/tournaments/${t.id}/matches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      setFeedback({ id: key, success: `${matches.length} matchs lancés : ils sont « en cours » sur les pages publiques.` });
    } catch (error) {
      setFeedback({ id: key, error: error instanceof FormError ? error : new FormError('Lancement impossible. Vérifiez votre connexion puis réessayez.') });
    } finally { setBusy(null); }
  }

  async function tournamentCommand(operation: 'complete' | 'generate_final_round' | 'cancel_final_round', message: string, success = 'Tournoi terminé. Les corrections de résultats restent possibles jusqu’à l’archivage.') {
    if (!window.confirm(message)) return;
    setBusy('tournament'); setFeedback(null);
    try {
      const body = scheduleCommandSchema.parse({ operation, payload: {}, expected_version: t.version });
      onChange(await configurationRequest(`/api/v1/admin/tournaments/${t.id}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      setFeedback({ id: 'tournament', success });
    } catch (error) { setFeedback({ id: 'tournament', error: error instanceof FormError ? error : new FormError('Action impossible.') }); }
    finally { setBusy(null); }
  }

  const scoreForm = (match: Match, label: string) => <form key={`${match.id}:${match.version}`} onSubmit={(event) => record(event, match)}>
    <fieldset disabled={busy !== null || t.status === 'ARCHIVED'} className="bare-fieldset"><legend className="sr-only">Score de {name(match.home_team_id)} contre {name(match.away_team_id)}</legend>
      <Group align="flex-end" gap="sm" className="score-form">
        <TextInput name="home_score" label={name(match.home_team_id)} type="number" inputMode="numeric" min={0} max={999} step={1} required defaultValue={match.home_score ?? ''} w={130} styles={{ input: { fontSize: 22, fontWeight: 700, textAlign: 'center' } }} />
        <TextInput name="away_score" label={name(match.away_team_id)} type="number" inputMode="numeric" min={0} max={999} step={1} required defaultValue={match.away_score ?? ''} w={130} styles={{ input: { fontSize: 22, fontWeight: 700, textAlign: 'center' } }} />
        <Button type="submit" loading={busy === match.id}>{label}</Button>
      </Group>
    </fieldset>
  </form>;

  const action = (match: Match, label: string, command: Omit<MatchCommand, 'expected_version'>, success: string, confirm?: string, variant: 'light' | 'subtle' = 'subtle', color?: string) =>
    <Button size="sm" variant={variant} color={color} disabled={busy !== null} onClick={() => { if (!confirm || window.confirm(confirm)) void send(match, command, success); }}>{label}</Button>;

  return <Stack>
    <PlacementCard data={data} busy={busy !== null} onShowRules={onShowRules} onCommand={(operation, confirm, success) => void tournamentCommand(operation, confirm, success)} />
    {feedback?.id === 'tournament' ? <FormFeedback error={feedback.error} success={feedback.success} /> : null}
    <Card>
      <Group justify="space-between" mb="xs"><Title order={2} fz="xl">Résultats</Title><Text c="dimmed" fz="sm">{data.matches.length - open.length} / {data.matches.length} matchs clos</Text></Group>
      <Text fz="sm" c="dimmed" mb="md">Chaque résultat est visible immédiatement sur les pages publiques et met à jour le classement. Un résultat peut être corrigé à tout moment avant l’archivage.</Text>
      {t.status === 'PUBLISHED' ? <Group mb="md"><Button variant="default" size="sm" disabled={busy !== null || open.length > 0 || placementPending} onClick={() => void tournamentCommand('complete', 'Terminer le tournoi ? Plus aucun match ne pourra être joué ; les corrections de résultats resteront possibles.')}>Terminer le tournoi</Button>{open.length ? <Text fz="sm" c="dimmed">Disponible quand tous les matchs ont un résultat ou sont annulés.</Text> : placementPending ? <Text fz="sm" c="dimmed">Disponible quand la phase de classement est terminée.</Text> : null}</Group> : null}
      {t.status === 'COMPLETED' ? <Text mb="md" fw={600}>Tournoi terminé : seules les corrections de résultats restent possibles.</Text> : null}
      {t.status === 'ARCHIVED' ? <Text mb="md" fw={600}>Tournoi archivé : les résultats sont en lecture seule.</Text> : null}
      <Tabs value={filter} onChange={(value) => value && setFilter(value as 'open' | 'all')} keepMounted={false}>
        <TabsList aria-label="Filtrer les matchs" mb="md"><TabsTab value="open">À saisir ({open.length})</TabsTab><TabsTab value="all">Tous ({data.matches.length})</TabsTab></TabsList>
        {(['open', 'all'] as const).map((value) => <TabsPanel key={value} value={value}>
      {/* Un match qui vient de sortir du filtre (score validé, annulé…) garde son message ici. */}
      {feedback && feedback.id !== 'tournament' && !feedback.id.startsWith('slot:') && !shown.some((match) => match.id === feedback.id) ? <Box mb="md"><FormFeedback error={feedback.error} success={feedback.success} /></Box> : null}
      {!shown.length ? <Text c="dimmed">{filter === 'open' ? 'Tous les matchs ont un résultat ou sont annulés.' : 'Aucun match.'}</Text> : null}
      <Stack gap="lg">{groups.map((slot) => {
        const ready = slot.matches.filter((match) => match.status === 'SCHEDULED');
        return <Box key={slot.key} component="section" aria-label={`Matchs ${slot.label}`}>
          <Group justify="space-between" gap="xs" mb="xs" className="slot-header">
            <Group gap="xs"><Text fw={800}>{slot.label}</Text><Text fz="sm" c="dimmed">{slot.matches.length} match{slot.matches.length > 1 ? 's' : ''}</Text></Group>
            {t.status === 'PUBLISHED' && ready.length > 1 ? <Button size="sm" variant="light" loading={busy === slot.key} disabled={busy !== null && busy !== slot.key}
              onClick={() => void startGroup(slot.key, ready)}>Lancer les {ready.length} matchs</Button> : null}
          </Group>
          {feedback?.id === slot.key ? <Box mb="xs"><FormFeedback error={feedback.error} success={feedback.success} /></Box> : null}
          <Stack component="ol" gap="sm" p={0} m={0} style={{ listStyle: 'none' }}>{slot.matches.map((match) => <Paper component="li" key={match.id} withBorder p="md" className="result-row">
        <Group justify="space-between" gap="xs" mb={6}>
          <Text fz="sm" c="dimmed">{match.starts_at ? formatMatchTime(match.starts_at, t.timezone, multiDay) : 'Sans horaire'} · {match.court_id ? name(match.court_id) : 'à replanifier'} · {group(match)}</Text>
          <MatchStatus status={match.status} />
        </Group>
        {match.status === 'COMPLETED' ? <Text className="result-final" fz="lg" mb="xs"><strong>{name(match.home_team_id)}</strong> <Text span fw={800} mx={6}>{match.home_score} – {match.away_score}</Text> <strong>{name(match.away_team_id)}</strong></Text>
          : <Text className="result-final" fz="lg" mb="xs"><strong>{name(match.home_team_id)}</strong> <Text span c="dimmed">contre</Text> <strong>{name(match.away_team_id)}</strong></Text>}

        {t.status === 'PUBLISHED' && (match.status === 'SCHEDULED' || match.status === 'IN_PROGRESS') ? <Stack gap="xs">
          {scoreForm(match, 'Valider le résultat')}
          <Group gap={4}>
            {match.status === 'SCHEDULED' ? action(match, 'Marquer en cours', { operation: 'start', payload: {} }, 'Match en cours.', undefined, 'light') : action(match, 'Remettre à « prévu »', { operation: 'reset', payload: {} }, 'Match remis à « prévu ».')}
            {action(match, 'Reporter', { operation: 'postpone', payload: {} }, 'Match reporté. Replanifiez-le depuis le calendrier.', 'Reporter ce match ? Son horaire et son terrain seront libérés.')}
            {action(match, 'Annuler le match', { operation: 'cancel', payload: {} }, 'Match annulé : il ne compte plus au classement.', 'Annuler ce match ? Il ne comptera pas au classement.', 'subtle', 'red')}
          </Group>
        </Stack> : null}
        {match.status === 'COMPLETED' && (t.status === 'PUBLISHED' || t.status === 'COMPLETED') ? <Disclosure label="Corriger le résultat">{scoreForm(match, 'Enregistrer la correction')}</Disclosure> : null}
        {t.status === 'PUBLISHED' && match.status === 'POSTPONED' ? <Group gap={4}><Button size="sm" variant="light" onClick={onShowSchedule}>Replanifier dans le calendrier</Button>{action(match, 'Annuler le match', { operation: 'cancel', payload: {} }, 'Match annulé.', 'Annuler ce match ? Il ne comptera pas au classement.', 'subtle', 'red')}</Group> : null}
        {t.status === 'PUBLISHED' && match.status === 'CANCELLED' ? <Group>{action(match, 'Rétablir le match', { operation: 'reinstate', payload: {} }, 'Match rétabli.', undefined, 'light')}</Group> : null}
        {feedback?.id === match.id ? <Box mt="xs"><FormFeedback error={feedback.error} success={feedback.success} /></Box> : null}
      </Paper>)}</Stack>
        </Box>;
      })}</Stack>
        </TabsPanel>)}
      </Tabs>
    </Card>

    <Card><Title order={2} fz="xl">Classements</Title><Text fz="sm" c="dimmed" mb="md">Recalculés à partir des résultats validés : points, différence, scores marqués.</Text>
      <Stack gap="lg">{poolsInOrder(data).map((pool) => {
        const { table } = standings(pool.teams, data.matches.filter((match) => match.pool_id === pool.id).map((match) => ({
          id: match.id, home: match.home_team_id, away: match.away_team_id, status: match.status,
          homeScore: match.home_score, awayScore: match.away_score, validatedAt: match.status === 'COMPLETED' ? 'validé' : null,
        })), { allowDraw: data.rules.allow_draw, pointsWin: data.rules.points_win, pointsDraw: data.rules.points_draw, pointsLoss: data.rules.points_loss, tieBreakOrder: data.rules.tie_break_order });
        return <Box key={pool.id}><Title order={3} fz="md" mb={6}>{pool.name}</Title><Table striped tabularNums horizontalSpacing="xs">
          <TableThead><TableTr><TableTh scope="col">#</TableTh><TableTh scope="col">Équipe</TableTh><TableTh scope="col">J</TableTh><TableTh scope="col" visibleFrom="xs">V</TableTh><TableTh scope="col" visibleFrom="xs">N</TableTh><TableTh scope="col" visibleFrom="xs">D</TableTh><TableTh scope="col">Diff.</TableTh><TableTh scope="col">Pts</TableTh></TableTr></TableThead>
          <TableTbody>{table.map((row) => <TableTr key={row.team}><TableTd>{row.position}</TableTd><TableTh scope="row">{name(row.team)}</TableTh><TableTd>{row.played}</TableTd><TableTd visibleFrom="xs">{row.won}</TableTd><TableTd visibleFrom="xs">{row.drawn}</TableTd><TableTd visibleFrom="xs">{row.lost}</TableTd><TableTd>{row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}</TableTd><TableTd fw={800}>{row.points}</TableTd></TableTr>)}</TableTbody>
        </Table></Box>;
      })}</Stack>
    </Card>
  </Stack>;
}
