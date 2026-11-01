'use client';
import { useState, type FormEvent } from 'react';
import { Badge, Box, Button, Card, Group, List, ListItem, NativeSelect, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Field, FormFeedback } from '@/components/forms/field';
import { placementLabel } from '@/lib/domain/placement';
import { Disclosure } from '@/components/ui/disclosure';
import { scheduleCommandSchema, type ScheduleCommand, type SchedulePreview, type TournamentConfiguration } from '@/lib/tournaments/contracts';
import { configurationRequest, FormError, schedulePreviewRequest } from '@/lib/tournaments/client';
import { formatMatchTime, instantToLocal, localToInstant, spansSeveralDays } from '@/lib/tournaments/dates';

type Row = { key: string; pool_id: string | null; place_from?: number | null; place_to?: number | null; home_team_id: string; away_team_id: string; court_id: string | null; starts_at: string | null; status?: string; id?: string };
const statusLabel: Record<string, string> = { SCHEDULED: 'Prévu', IN_PROGRESS: 'En cours', COMPLETED: 'Terminé', POSTPONED: 'Reporté', CANCELLED: 'Annulé' };
const statusColor: Record<string, string> = { IN_PROGRESS: 'teal', COMPLETED: 'ink', POSTPONED: 'orange', CANCELLED: 'red' };

export function SchedulePanel({ data, onChange }: { data: TournamentConfiguration; onChange: (next: TournamentConfiguration) => void }) {
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [success, setSuccess] = useState('');
  const t = data.tournament;
  const endpoint = `/api/v1/admin/tournaments/${t.id}/schedule`;
  const names = new Map([...data.teams, ...data.pools, ...data.courts].map((row) => [row.id, row.name]));
  const multiDay = spansSeveralDays(t.starts_at, t.ends_at, t.timezone);
  const formatTime = (instant: string) => formatMatchTime(instant, t.timezone, multiDay);
  const hasSchedule = data.matches.length > 0;
  const movable = t.status === 'DRAFT' || t.status === 'PUBLISHED';

  async function run<T>(action: () => Promise<T>, done?: string) {
    setBusy(true); setError(null); setSuccess('');
    try { const result = await action(); if (done) setSuccess(done); return result; }
    catch (failure) { setError(failure instanceof FormError ? failure : new FormError('Action impossible. Vérifiez votre connexion.')); return undefined; }
    finally { setBusy(false); }
  }

  async function command(operation: ScheduleCommand['operation'], payload: object, done: string, version = t.version) {
    const body = scheduleCommandSchema.parse({ operation, payload, expected_version: version });
    const next = await run(() => configurationRequest(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), done);
    if (next) { onChange(next); setPreview(null); }
    return next;
  }

  const loadPreview = () => run(async () => setPreview(await schedulePreviewRequest(endpoint)));

  async function save() {
    if (!preview) return;
    if (hasSchedule && !window.confirm('Remplacer le calendrier enregistré par celui-ci ?')) return;
    // La version de la prévisualisation est envoyée : si le tournoi a changé entre-temps, le serveur refuse (409).
    await command('generate', { replace: hasSchedule }, 'Calendrier enregistré. Vérifiez-le, puis publiez le tournoi.', preview.version);
  }

  async function move(event: FormEvent<HTMLFormElement>, matchId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let startsAt: string;
    try { startsAt = localToInstant(String(form.get('starts_at')), t.timezone); }
    catch { setError(new FormError('Heure invalide ou ambiguë (changement d’heure).')); return; }
    await command('move_match', { match_id: matchId, court_id: String(form.get('court_id')), starts_at: startsAt }, 'Match déplacé.');
  }

  const list = (rows: Row[]) => <Stack component="ol" gap={6} p={0} m={0} style={{ listStyle: 'none' }}>{rows.map((row) => <Paper component="li" key={row.key} withBorder px="md" py="sm">
    <Group gap="md" wrap="wrap">
      <Text fw={800} w={110} style={{ fontVariantNumeric: 'tabular-nums' }}>{row.starts_at ? formatTime(row.starts_at) : '—'}</Text>
      <Text fz="sm" c="dimmed" w={110}>{row.court_id ? names.get(row.court_id) : 'À replanifier'}</Text>
      <Text style={{ flex: '1 1 220px' }}><strong>{names.get(row.home_team_id)}</strong> <Text span c="dimmed">contre</Text> <strong>{names.get(row.away_team_id)}</strong></Text>
      <Group gap={6}><Text fz="sm" c="dimmed">{row.pool_id ? names.get(row.pool_id) : placementLabel(row.place_from!, row.place_to!)}</Text>{row.status && row.status !== 'SCHEDULED' ? <Badge color={statusColor[row.status]}>{statusLabel[row.status]}</Badge> : null}</Group>
    </Group>
    {row.id && movable && (row.status === 'SCHEDULED' || row.status === 'POSTPONED') ? <Box mt={6}><Disclosure label="Déplacer">
      <form onSubmit={(event) => void move(event, row.id!)}><fieldset disabled={busy} className="bare-fieldset"><legend className="sr-only">Déplacer ce match</legend><Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NativeSelect name="court_id" label="Terrain" defaultValue={row.court_id ?? data.courts[0]?.id} data={data.courts.map((court) => ({ value: court.id, label: court.name }))} />
          <Field name="starts_at" label="Début" type="datetime-local" required defaultValue={instantToLocal(row.starts_at ?? t.starts_at, t.timezone)} />
        </SimpleGrid>
        <Group><Button type="submit" size="sm">Enregistrer le déplacement</Button></Group>
      </Stack></fieldset></form>
    </Disclosure></Box> : null}
  </Paper>)}</Stack>;

  const range = (rows: { starts_at: string | null; ends_at: string | null }[]) => {
    const starts = rows.flatMap((row) => row.starts_at ? [Date.parse(row.starts_at)] : []);
    const ends = rows.flatMap((row) => row.ends_at ? [Date.parse(row.ends_at)] : []);
    return starts.length ? `de ${formatTime(new Date(Math.min(...starts)).toISOString())} à ${formatTime(new Date(Math.max(...ends)).toISOString())}` : '';
  };

  return <Stack aria-busy={busy}>
    <Card>
      <Group justify="space-between" mb="xs"><Title order={2} fz="xl">Calendrier</Title><Text c="dimmed" fz="sm">{hasSchedule ? `${data.matches.length} matchs ${range(data.matches)}` : 'Aucun calendrier enregistré'}</Text></Group>
      <Text fz="sm" c="dimmed" mb="md">{t.status === 'DRAFT' ? (hasSchedule
        ? 'Le calendrier est enregistré mais reste privé. La configuration est verrouillée : supprimez le calendrier pour la modifier.'
        : 'Chaque équipe rencontre une fois les autres équipes de sa poule. Les matchs sont placés sur les disponibilités des terrains, avec la transition et le repos minimal définis dans les règles.')
        : t.status === 'PUBLISHED' ? 'Tournoi publié. Les matchs prévus ou reportés peuvent encore être déplacés ; chaque déplacement est revérifié. Les scores se saisissent dans la section Résultats.'
          : `Tournoi ${t.status === 'COMPLETED' ? 'terminé' : 'archivé'} : le calendrier est en lecture seule.`}</Text>
      <Stack gap="sm">
        <FormFeedback error={error} success={success} />
        <Group>
          {t.status === 'DRAFT' ? <Button onClick={() => void loadPreview()} loading={busy}>{hasSchedule ? 'Prévisualiser un nouveau calendrier' : 'Prévisualiser le calendrier'}</Button> : null}
          {t.status === 'DRAFT' && hasSchedule ? <Button variant="light" disabled={busy} onClick={() => { if (window.confirm('Publier le tournoi ? Le calendrier ne pourra plus être régénéré.')) void command('publish', {}, 'Tournoi publié.'); }}>Publier le tournoi</Button> : null}
          {t.status === 'DRAFT' && hasSchedule ? <Button variant="subtle" color="red" disabled={busy} onClick={() => { if (window.confirm('Supprimer le calendrier ? La configuration redeviendra modifiable.')) void command('clear', {}, 'Calendrier supprimé. La configuration est de nouveau modifiable.'); }}>Supprimer le calendrier</Button> : null}
          {t.status === 'PUBLISHED' || t.status === 'COMPLETED' ? <Button variant="default" disabled={busy} onClick={() => { if (window.confirm('Archiver le tournoi ? Plus aucune modification ne sera possible.')) void command('archive', {}, 'Tournoi archivé.'); }}>Archiver le tournoi</Button> : null}
        </Group>
      </Stack>
    </Card>

    {preview ? <Card aria-live="polite" style={{ borderColor: 'var(--mantine-color-ink-3)' }}>
      <Group justify="space-between" mb="xs"><Title order={2} fz="xl">Prévisualisation</Title><Text c="dimmed" fz="sm">{preview.status === 'ready' ? `${preview.matches.length} matchs ${range(preview.matches)}` : 'Aucun calendrier possible'}</Text></Group>
      {preview.status !== 'ready' ? <>
        <Text c="red.8" fw={600}>{preview.status === 'blocked' ? 'La configuration est incomplète :' : preview.status === 'impossible' ? 'Aucun calendrier ne peut respecter ces paramètres :' : 'Aucun calendrier n’a été trouvé avec ces paramètres :'}</Text>
        <List mt="xs">{preview.reasons.map((reason) => <ListItem key={reason}>{reason}</ListItem>)}</List>
      </> : <Stack gap="sm">
        <Text fz="sm" c="dimmed">Rien n’est encore enregistré. Vérifiez les horaires, puis enregistrez.</Text>
        {preview.save_blockers.length ? <Text c="red.8">{preview.save_blockers.join(' ')}</Text> : <Group><Button onClick={() => void save()} disabled={busy}>Enregistrer ce calendrier</Button><Button variant="subtle" onClick={() => setPreview(null)} disabled={busy}>Annuler</Button></Group>}
        {list(preview.matches.map((match, index) => ({ ...match, key: String(index) })))}
      </Stack>}
    </Card> : null}

    {hasSchedule ? <Card><Title order={2} fz="xl" mb="md">Calendrier enregistré</Title>{list(data.matches.map((match) => ({ ...match, key: match.id })))}</Card> : null}
  </Stack>;
}
