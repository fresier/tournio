'use client';
import { useState, type FormEvent } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Alert, Anchor, Badge, Box, Button, Card, Checkbox, Group, Radio, RadioGroup, List, ListItem, NativeSelect, Paper, SimpleGrid, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, Title } from '@mantine/core';
import { Field, FormFeedback } from '@/components/forms/field';
import { Disclosure } from '@/components/ui/disclosure';
import { TextLink } from '@/components/ui/links';
import { PageHeading } from '@/components/ui/page-heading';
import { TournamentStatus } from '@/components/ui/status';
import { TournamentFields, tournamentFields } from './tournament-fields';
import { configurationCommandSchema, slugify, type ConfigurationCommand, type TournamentConfiguration } from '@/lib/tournaments/contracts';
import { configurationRequest, FormError } from '@/lib/tournaments/client';
import { formatTournamentDate, instantToLocal, localToInstant } from '@/lib/tournaments/dates';
import { gaps } from '@/lib/domain/availability';
import { SchedulePanel } from './schedule-panel';
import { SharePanel } from './share-panel';
import { ResultsPanel } from './results-panel';
import { AppearancePanel } from './appearance-panel';
import { TournamentTheme } from './tournament-theme';
import { ConfigurationSummary } from './configuration-summary';
import { FormatSection } from './format-section';

const sections = [['overview', 'Informations'], ['teams', 'Équipes'], ['pools', 'Poules'], ['courts', 'Terrains'], ['rules', 'Règles'], ['appearance', 'Apparence'], ['schedule', 'Calendrier'], ['results', 'Résultats'], ['share', 'Partage']] as const;
type Section = typeof sections[number][0];
/** Onglet ouvert gardé dans l’URL (?onglet=resultats) : rechargement, lien partagé et bouton Retour le conservent. */
const tabSlugs: Record<Section, string> = { overview: 'informations', teams: 'equipes', pools: 'poules', courts: 'terrains', rules: 'regles', appearance: 'apparence', schedule: 'calendrier', results: 'resultats', share: 'partage' };
const tabParser = parseAsStringLiteral(Object.values(tabSlugs)).withDefault('informations').withOptions({ history: 'push', scroll: false });
type Feedback = { context: string; error?: FormError; success?: string };
const numericRules = [
  ['match_duration_minutes', 'Durée d’un match (min)', 1], ['transition_minutes', 'Transition entre matchs (min)', 0],
  ['minimum_rest_minutes', 'Repos minimal d’une équipe (min)', 0], ['points_win', 'Points pour une victoire', -999],
  ['points_draw', 'Points pour un nul', -999], ['points_loss', 'Points pour une défaite', -999],
] as const;

/** Formulaire en ligne : champs et bouton alignés sur grand écran, empilés sur téléphone. */
function InlineForm({ legend, disabled, onSubmit, children }: { legend: string; disabled: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return <form onSubmit={onSubmit}><fieldset disabled={disabled} className="bare-fieldset"><legend className="sr-only">{legend}</legend>
    <Group align="flex-end" gap="sm" className="inline-form">{children}</Group></fieldset></form>;
}

export function TournamentEditor({ initial, publicOrigin }: { initial: TournamentConfiguration; publicOrigin?: string }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useQueryState('onglet', tabParser);
  const section = (Object.keys(tabSlugs) as Section[]).find((key) => tabSlugs[key] === tab) ?? 'overview';
  const setSection = (next: Section) => { void setTab(next === 'overview' ? null : tabSlugs[next]); };
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const t = data.tournament;
  const endpoint = `/api/v1/admin/tournaments/${t.id}`;
  const editable = t.status === 'DRAFT' && data.match_count === 0;
  const locked = busy || !editable;
  const period = { start: Date.parse(t.starts_at), end: Date.parse(t.ends_at) };
  const errorFor = (context: string) => feedback?.context === context ? feedback.error : undefined;
  const status = (context: string) => <FormFeedback error={errorFor(context)} success={feedback?.context === context ? feedback.success : undefined} />;
  const replace = (next: TournamentConfiguration) => { setData(next); setFeedback(null); };

  async function mutate(operation: ConfigurationCommand['operation'], payload: unknown, context: string) {
    setBusy(true); setFeedback(null);
    try {
      const parsed = configurationCommandSchema.safeParse({ operation, payload, expected_version: data.tournament.version });
      if (!parsed.success) {
        const fields: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) (fields[String(issue.path.at(-1))] ??= []).push(issue.message);
        throw new FormError('Vérifiez les champs du formulaire.', fields);
      }
      const updated = await configurationRequest(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      setData(updated); setFeedback({ context, success: 'Modification enregistrée.' });
      return true;
    } catch (error) {
      setFeedback({ context, error: error instanceof FormError ? error : new FormError('Enregistrement impossible. Vérifiez votre connexion.') });
      return false;
    } finally { setBusy(false); }
  }

  async function reload() {
    setBusy(true);
    try { setData(await configurationRequest(endpoint)); setFeedback({ context: 'global', success: 'Dernière version chargée.' }); }
    catch { setFeedback({ context: 'global', error: new FormError('Impossible de recharger le tournoi.') }); }
    finally { setBusy(false); }
  }

  async function namedSubmit(event: FormEvent<HTMLFormElement>, operation: ConfigurationCommand['operation'], context: string, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get('name') ?? '');
    const payload = { name, ...(id ? { id } : {}), ...(['create_team', 'update_team'].includes(operation) ? { slug: String(fields.get('slug') || slugify(name)) } : {}) };
    if (await mutate(operation, payload, context) && !id) form.reset();
  }

  async function remove(operation: ConfigurationCommand['operation'], id: string, message: string, context: string) {
    if (window.confirm(message)) await mutate(operation, { id }, context);
  }

  async function updateInformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await mutate('update_tournament', tournamentFields(new FormData(event.currentTarget)), 'information'); }
    catch (error) { setFeedback({ context: 'information', error: error instanceof FormError ? error : new FormError('Vérifiez les informations du tournoi.') }); }
  }

  async function addUnavailability(event: FormEvent<HTMLFormElement>, courtId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const dates: Record<string, string> = {};
    for (const key of ['starts_at', 'ends_at']) {
      try { dates[key] = localToInstant(String(form.get(key)), t.timezone, String(form.get(`${key}_offset`) || '')); }
      catch { setFeedback({ context: courtId, error: new FormError('Vérifiez les horaires de l’indisponibilité.', { [key]: ['Heure invalide ou ambiguë. Précisez le décalage UTC si nécessaire.'] }) }); return; }
    }
    await mutate('add_unavailability', { court_id: courtId, ...dates }, courtId);
  }

  return <>
    <TournamentTheme appearance={t} />
    <TextLink href="/dashboard" fz="sm" mb="sm" display="inline-block">← Mes tournois</TextLink>
    <PageHeading title={t.name} badge={<TournamentStatus status={t.status} />} action={<Button variant="default" size="sm" onClick={reload} disabled={busy}>Recharger</Button>}
      description={<>{t.sport}{t.location ? ` · ${t.location}` : ''}<br />{formatTournamentDate(t.starts_at, t.timezone)} — {t.timezone}</>}>
      {t.status !== 'DRAFT' ? <Group gap="xs" mt="xs"><Anchor href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer" fw={600}>Voir la page publique</Anchor><Text c="dimmed">·</Text><Anchor component="button" type="button" onClick={() => setSection('share')} fw={600}>Liens et QR codes</Anchor></Group> : null}
    </PageHeading>

    <ConfigurationSummary data={data} onOpen={setSection} />
    <Alert variant="light" color={editable ? 'ink' : 'gray'} mb="md">
      {editable ? 'Votre brouillon est privé. Préparez les équipes, les poules et les disponibilités, puis générez le calendrier.'
        : t.status === 'DRAFT' ? 'Un calendrier est enregistré : la configuration est verrouillée. Supprimez-le depuis la section Calendrier pour la modifier.'
          : 'La configuration est en lecture seule après publication. Restent modifiables : l’apparence, le format de classement (avant son début) et la levée d’une indisponibilité de terrain.'}
    </Alert>
    {status('global')}

    <Tabs value={section} onChange={(value) => value && setSection(value as Section)} keepMounted={false}>
      <TabsList aria-label="Sections de configuration" mb="lg" className="section-tabs">
        {sections.map(([key, label]) => <TabsTab key={key} value={key}>{label}</TabsTab>)}
      </TabsList>

      <Box aria-busy={busy}>
        <TabsPanel value="overview">
          <Card><Title order={2} fz="xl" mb="md">Informations du tournoi</Title>
            <form key={t.version} onSubmit={updateInformation}><fieldset disabled={locked} className="bare-fieldset"><legend className="sr-only">Modifier les informations</legend>
              <Stack><TournamentFields value={t} fields={errorFor('information')?.fields} />{status('information')}<Group><Button type="submit">Enregistrer les informations</Button></Group></Stack>
            </fieldset></form>
          </Card>
        </TabsPanel>

        <TabsPanel value="teams"><Stack>
          <Card><Title order={2} fz="xl" mb="md">Ajouter une équipe</Title>
            <InlineForm legend="Nouvelle équipe" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_team', 'team-new')}>
              <Field name="name" label="Nom de l’équipe" minLength={2} maxLength={80} required error={errorFor('team-new')?.fields.name} />
              <Field name="slug" label="Identifiant du lien (facultatif)" maxLength={100} placeholder="Généré à partir du nom" error={errorFor('team-new')?.fields.slug} />
              <Button type="submit">Ajouter l’équipe</Button>
            </InlineForm>{status('team-new')}
          </Card>
          <Card><Group justify="space-between" mb="md"><Title order={2} fz="xl">Équipes inscrites</Title><Text c="dimmed" fz="sm">{data.teams.length} équipe{data.teams.length !== 1 ? 's' : ''}</Text></Group>
            {!data.teams.length ? <Text c="dimmed">Ajoutez la première équipe pour commencer à composer les poules.</Text> : <Stack gap="sm">{data.teams.map((team) => {
              const membership = data.pool_teams.find((row) => row.team_id === team.id);
              return <Paper key={team.id} withBorder p="md" component="article">
                <Group justify="space-between" gap="sm"><Title order={3} fz="lg">{team.name}</Title>
                  <NativeSelect size="sm" aria-label={`Poule de ${team.name}`} disabled={locked} value={membership?.pool_id ?? ''} w={200}
                    onChange={(event) => void mutate('assign_team', { team_id: team.id, pool_id: event.currentTarget.value || null }, team.id)}
                    data={[{ value: '', label: 'Non affectée' }, ...data.pools.map((pool) => ({ value: pool.id, label: pool.name }))]} />
                </Group>
                <Disclosure label="Modifier l’équipe"><Stack gap="sm">
                  <InlineForm key={`${team.name}:${team.slug}`} legend={`Modifier ${team.name}`} disabled={locked} onSubmit={(event) => namedSubmit(event, 'update_team', team.id, team.id)}>
                    <Field name="name" label="Nom" defaultValue={team.name} required minLength={2} maxLength={80} error={errorFor(team.id)?.fields.name} />
                    <Field name="slug" label="Identifiant du lien" defaultValue={team.slug} required maxLength={100} error={errorFor(team.id)?.fields.slug} />
                    <Button type="submit">Enregistrer</Button>
                  </InlineForm>
                  <Group><Button variant="subtle" color="red" size="sm" onClick={() => void remove('delete_team', team.id, `Supprimer l’équipe « ${team.name} » du tournoi ?`, 'team-list')} disabled={locked}>Supprimer l’équipe</Button></Group>
                </Stack></Disclosure>
                {status(team.id)}
              </Paper>;
            })}</Stack>}{status('team-list')}
          </Card>
        </Stack></TabsPanel>

        <TabsPanel value="pools"><Stack>
          <Card><Title order={2} fz="xl" mb="md">Créer une poule</Title>
            <InlineForm legend="Nouvelle poule" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_pool', 'pool-new')}>
              <Field name="name" label="Nom de la poule" placeholder="Ex. Poule A" required minLength={2} maxLength={80} error={errorFor('pool-new')?.fields.name} />
              <Button type="submit">Ajouter la poule</Button>
            </InlineForm>{status('pool-new')}
          </Card>
          {(() => {
            const assigned = new Set(data.pool_teams.map((row) => row.team_id)).size;
            const unassigned = data.teams.length - assigned;
            const small = data.pools.length ? Math.floor(data.teams.length / data.pools.length) : 0;
            const large = data.pools.length ? Math.ceil(data.teams.length / data.pools.length) : 0;
            const drawable = !locked && data.pools.length > 0 && data.teams.length > 0;
            return <Card>
              <Title order={2} fz="xl">Tirage au sort</Title>
              <Text fz="sm" c="dimmed" mb="md">{data.pools.length && data.teams.length
                ? `${data.teams.length} équipes dans ${data.pools.length} poule${data.pools.length > 1 ? 's' : ''} : ${small === large ? `${small} équipes par poule` : `poules de ${small} ou ${large} équipes`}. Le tirage équilibre les poules à une équipe près ; vous pourrez ensuite ajuster à la main depuis la section Équipes.`
                : 'Créez les poules et inscrivez les équipes, puis laissez le hasard les répartir.'}</Text>
              <Group gap="sm">
                <Button disabled={!drawable} onClick={() => { if (!assigned || window.confirm('Remplacer la répartition actuelle par un nouveau tirage au sort de toutes les équipes ?')) void mutate('draw_pools', { mode: 'all' }, 'draw'); }}>Répartir toutes les équipes au hasard</Button>
                {assigned > 0 && unassigned > 0 ? <Button variant="light" disabled={!drawable} onClick={() => void mutate('draw_pools', { mode: 'unassigned' }, 'draw')}>Placer au hasard les {unassigned} équipe{unassigned > 1 ? 's' : ''} sans poule</Button> : null}
              </Group>
              {status('draw')}
            </Card>;
          })()}
          <Text fz="sm" c="dimmed">Vous pouvez aussi répartir les équipes manuellement depuis la section Équipes. Chaque équipe appartient à une seule poule.</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>{data.pools.map((pool) => {
            const members = data.teams.filter((team) => data.pool_teams.some((row) => row.pool_id === pool.id && row.team_id === team.id));
            return <Card key={pool.id}>
              <Group justify="space-between" mb="sm"><Title order={2} fz="lg">{pool.name}</Title><Text c="dimmed" fz="sm">{members.length} équipes</Text></Group>
              {members.length ? <List spacing={4} mb="sm">{members.map((team) => <ListItem key={team.id}>{team.name}</ListItem>)}</List> : <Text c="dimmed" mb="sm">Aucune équipe affectée.</Text>}
              <Disclosure label="Modifier la poule"><Stack gap="sm">
                <InlineForm legend={`Modifier ${pool.name}`} disabled={locked} onSubmit={(event) => namedSubmit(event, 'update_pool', pool.id, pool.id)}>
                  <Field name="name" label="Nom" defaultValue={pool.name} required minLength={2} maxLength={80} error={errorFor(pool.id)?.fields.name} /><Button type="submit">Enregistrer</Button>
                </InlineForm>
                <Group><Button variant="subtle" color="red" size="sm" disabled={locked} onClick={() => void remove('delete_pool', pool.id, `Supprimer « ${pool.name} » ? Ses équipes resteront inscrites, sans poule.`, 'pool-list')}>Supprimer la poule</Button></Group>
              </Stack></Disclosure>
              {status(pool.id)}
            </Card>;
          })}</SimpleGrid>
          {!data.pools.length ? <Text c="dimmed">Créez une poule, puis affectez-lui des équipes.</Text> : null}{status('pool-list')}
        </Stack></TabsPanel>

        <TabsPanel value="courts"><Stack>
          <Card><Title order={2} fz="xl" mb="md">Ajouter un terrain</Title>
            <InlineForm legend="Nouveau terrain" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_court', 'court-new')}>
              <Field name="name" label="Nom du terrain" placeholder="Ex. Terrain 1" required minLength={2} maxLength={80} error={errorFor('court-new')?.fields.name} />
              <Button type="submit">Ajouter le terrain</Button>
            </InlineForm>{status('court-new')}
          </Card>
          {data.courts.map((court) => <Card key={court.id}>
            <Title order={2} fz="xl">{court.name}</Title>
            {(() => {
              const off = gaps(period, data.availabilities.filter((row) => row.court_id === court.id).map((row) => ({ start: Date.parse(row.starts_at), end: Date.parse(row.ends_at) })));
              const restorable = !busy && (editable || t.status === 'PUBLISHED');
              return <Stack gap="xs" mt="xs" mb="md">
                {!off.length ? <Group gap="xs"><Badge color="teal">Disponible pendant tout le tournoi</Badge><Text fz="sm" c="dimmed">{formatTournamentDate(t.starts_at, t.timezone)} → {formatTournamentDate(t.ends_at, t.timezone)}</Text></Group>
                  : off.map((slot) => <Paper key={slot.start} withBorder p="sm">
                    <Group justify="space-between" gap="xs">
                      <Text fz="sm"><Text span fw={700}>Indisponible</Text> · {formatTournamentDate(new Date(slot.start).toISOString(), t.timezone)} → {formatTournamentDate(new Date(slot.end).toISOString(), t.timezone)}</Text>
                      <Button variant="subtle" size="compact-sm" disabled={!restorable} onClick={() => void mutate('remove_unavailability', { court_id: court.id, starts_at: new Date(slot.start).toISOString(), ends_at: new Date(slot.end).toISOString() }, court.id)}>Rendre disponible</Button>
                    </Group>
                  </Paper>)}
              </Stack>;
            })()}
            <form onSubmit={(event) => addUnavailability(event, court.id)}><fieldset disabled={locked} className="bare-fieldset"><legend><Text fw={700} mb={2}>Ajouter une indisponibilité</Text></legend><Stack gap="sm">
              <Text fz="sm" c="dimmed">Par défaut, le terrain est disponible pendant tout le tournoi. Indiquez seulement les périodes où il ne l’est pas : pause de midi, autre réservation… Horaires dans le fuseau {t.timezone}.</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Field name="starts_at" label="Début" type="datetime-local" defaultValue={instantToLocal(t.starts_at, t.timezone)} required error={errorFor(court.id)?.fields.starts_at} />
                <Field name="ends_at" label="Fin" type="datetime-local" defaultValue={instantToLocal(new Date(Math.min(Date.parse(t.starts_at) + 3_600_000, Date.parse(t.ends_at))).toISOString(), t.timezone)} required error={errorFor(court.id)?.fields.ends_at} />
              </SimpleGrid>
              <Disclosure label="Décalage UTC en cas d’heure ambiguë"><SimpleGrid cols={{ base: 1, sm: 2 }}><Field name="starts_at_offset" label="Décalage UTC du début" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /><Field name="ends_at_offset" label="Décalage UTC de fin" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /></SimpleGrid></Disclosure>
              <Group><Button type="submit" variant="light">Ajouter l’indisponibilité</Button></Group>
            </Stack></fieldset></form>
            <Box mt="md"><Disclosure label="Modifier le terrain"><Stack gap="sm">
              <InlineForm legend={`Modifier ${court.name}`} disabled={locked} onSubmit={(event) => namedSubmit(event, 'update_court', court.id, court.id)}>
                <Field name="name" label="Nom" defaultValue={court.name} required minLength={2} maxLength={80} error={errorFor(court.id)?.fields.name} /><Button type="submit">Enregistrer le nom</Button>
              </InlineForm>
              <Group><Button variant="subtle" color="red" size="sm" disabled={locked} onClick={() => void remove('delete_court', court.id, `Supprimer « ${court.name} » et toutes ses disponibilités ?`, 'court-list')}>Supprimer le terrain</Button></Group>
            </Stack></Disclosure></Box>
            {status(court.id)}
          </Card>)}
          {!data.courts.length ? <Text c="dimmed">Ajoutez un terrain : il sera disponible pendant tout le tournoi, sauf indisponibilités que vous indiquerez.</Text> : null}{status('court-list')}
        </Stack></TabsPanel>

        <TabsPanel value="rules"><Stack>
          <FormatSection key={`${data.rules.final_format}:${data.rules.round_break_minutes}`} data={data} busy={busy} feedback={status('format')} onSave={(final_format, round_break_minutes) => mutate('set_final_format', { final_format, round_break_minutes }, 'format')} />
          <Card><Title order={2} fz="xl">Durées et classement</Title><Text fz="sm" c="dimmed" mb="md">Score numérique simple, sans sets. Ces paramètres s’appliquent à toutes les poules.</Text>
            <form key={t.version} onSubmit={(event) => {
              event.preventDefault(); const form = new FormData(event.currentTarget);
              const values = Object.fromEntries(numericRules.map(([key]) => [key, Number(form.get(key))]));
              const tie_break_order = form.get('tie_break') === 'scored' ? ['points', 'scores_for', 'score_difference', 'team_id'] : ['points', 'score_difference', 'scores_for', 'team_id'];
              void mutate('save_rules', { ...values, allow_draw: form.get('allow_draw') === 'on', aligned_slots: form.get('aligned_slots') === 'on', tie_break_order }, 'rules');
            }}><fieldset disabled={locked} className="bare-fieldset"><legend className="sr-only">Règles du tournoi</legend><Stack>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>{numericRules.map(([key, label, min]) => <Field key={key} name={key} label={label} type="number" step="1" min={min} max={key.startsWith('points_') ? 999 : 2147483647} defaultValue={data.rules[key]} required error={errorFor('rules')?.fields[key]} />)}</SimpleGrid>
              <Checkbox name="allow_draw" defaultChecked={data.rules.allow_draw} label="Autoriser les matchs nuls" />
              <Checkbox name="aligned_slots" defaultChecked={data.rules.aligned_slots} label="Horaires alignés"
                description={`Tous les matchs démarrent en même temps sur tous les terrains, toutes les ${data.rules.match_duration_minutes + Math.max(data.rules.transition_minutes, data.rules.minimum_rest_minutes)} min (durée d’un match + le plus long des délais de transition et de repos). Horaires ronds et lancement groupé ; le tournoi peut durer un peu plus longtemps.`} />
              <RadioGroup name="tie_break" defaultValue={data.rules.tie_break_order[1] === 'scores_for' ? 'scored' : 'difference'} label="Égalité de points en poule"
                description="Quand deux équipes ont le même nombre de points au classement de poule, qui passe devant ?">
                <Stack gap="xs" mt="xs">
                  <Radio value="scored" label="Le plus de points marqués dans ses sets" description="Puis la différence de points (marqués moins encaissés)." />
                  <Radio value="difference" label="La meilleure différence de points" description="Points marqués moins points encaissés, puis les points marqués." />
                </Stack>
              </RadioGroup>
              <Text fz="xs" c="dimmed">En dernier recours, un ordre fixe et stable départage les équipes (jamais d’égalité parfaite).</Text>
              {status('rules')}<Group><Button type="submit">Enregistrer les règles</Button></Group>
            </Stack></fieldset></form>
          </Card>
        </Stack></TabsPanel>

        <TabsPanel value="appearance">
          <AppearancePanel key={`${t.primary_color}:${t.accent_color}`} data={data} busy={busy} feedback={status('appearance')}
            onSave={(payload) => mutate('update_appearance', payload, 'appearance')} />
        </TabsPanel>
        <TabsPanel value="schedule"><SchedulePanel data={data} onChange={replace} /></TabsPanel>
        <TabsPanel value="results"><ResultsPanel data={data} onChange={replace} onShowSchedule={() => setSection('schedule')} onShowRules={() => setSection('rules')} /></TabsPanel>
        <TabsPanel value="share"><SharePanel data={data} origin={publicOrigin} /></TabsPanel>
      </Box>
    </Tabs>
  </>;
}
