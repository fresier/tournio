'use client';
import { useState, type FormEvent } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Alert, Anchor, Badge, Box, Button, Card, Checkbox, Group, Modal, Radio, RadioGroup, NativeSelect, SimpleGrid, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { Field, FormFeedback } from '@/components/forms/field';
import { PageHeading } from '@/components/ui/page-heading';
import { TournamentStatus } from '@/components/ui/status';
import { TournamentFields, tournamentFields } from './tournament-fields';
import { configurationCommandSchema, nextCourtName, nextPoolName, slugify, uniqueSlug, type ConfigurationCommand, type TournamentConfiguration } from '@/lib/tournaments/contracts';
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
import { DragHandle, DropZone, TeamsDnd } from './teams-dnd';
import { DeleteButton } from '@/components/ui/delete-button';
import { DemoTeamsButton } from './demo-teams-button';
import { placementState } from '@/lib/tournaments/placement';
import { demoTeams } from '@/lib/tournaments/demo-teams';

const sections = [['overview', 'Paramètres'], ['teams', 'Équipes et poules'], ['courts', 'Terrains'], ['rules', 'Format et règles'], ['schedule', 'Calendrier'], ['results', 'Résultats'], ['share', 'Partage']] as const;
type Section = typeof sections[number][0];
/** Onglet ouvert gardé dans l’URL (?onglet=resultats) : rechargement, lien partagé et bouton Retour le conservent. */
const tabSlugs: Record<Section, string> = { overview: 'parametres', teams: 'equipes', courts: 'terrains', rules: 'format-et-regles', schedule: 'calendrier', results: 'resultats', share: 'partage' };
const tabParser = parseAsStringLiteral(Object.values(tabSlugs)).withDefault('parametres').withOptions({ history: 'push', scroll: false });
/** Sous-onglets de Paramètres, gardés dans l’URL (?section=apparence). */
type Feedback = { context: string; error?: FormError; success?: string };
const numericRules = [
  ['match_duration_minutes', 'Durée d’un match (min)', 1], ['transition_minutes', 'Transition entre matchs (min)', 0],
  ['minimum_rest_minutes', 'Repos minimal d’une équipe (min)', 0], ['points_win', 'Points pour une victoire', -999],
  ['points_draw', 'Points pour un nul', -999], ['points_loss', 'Points pour une défaite', -999],
] as const;

/**
 * Nom renommable : un clic (ou Entrée / F2) ouvre l’édition, Entrée enregistre, Échap annule.
 * La suppression se fait par la corbeille placée à droite (DeleteButton).
 */
function EditableName({ name, label, locked, onRename, children, size = 'md' }: {
  name: string; label: string; locked: boolean; onRename: (name: string) => Promise<boolean>;
  children?: React.ReactNode; size?: 'md' | 'lg';
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const start = () => { if (!locked) { setValue(name); setEditing(true); } };
  const save = async () => {
    if (value.trim() === name) { setEditing(false); return; }
    if (await onRename(value.trim())) setEditing(false);
  };
  if (editing) return <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <Group gap="xs" align="flex-end">
      <TextInput aria-label={`Nouveau nom de ${name}`} value={value} onChange={(event) => setValue(event.currentTarget.value)} size="sm" required minLength={2} maxLength={80} autoFocus
        style={{ flex: '1 1 160px' }} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(false); }} />
      <Button type="submit" size="sm">Enregistrer</Button>
      <Button variant="subtle" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
    </Group>
  </form>;
  return <Group justify="space-between" gap="sm" wrap="nowrap">
    {/* preventDefault : sans lui, la même touche Entrée validerait aussitôt le champ qui vient de s’ouvrir. */}
    <UnstyledButton className="team-name" onClick={start} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); start(); } }}
      title={locked ? undefined : `Cliquez pour renommer ${label}`} aria-label={locked ? name : `${name} — renommer (Entrée)`} style={{ minWidth: 0 }}>
      <Text fw={size === 'lg' ? 800 : 700} fz={size === 'lg' ? 'lg' : undefined} truncate>{name}</Text>
    </UnstyledButton>
    {children}
  </Group>;
}

/** Ligne d’équipe : le nom renommable et sa poule. Le renommage garde l’identifiant du lien (liens et QR codes restent valables). */
function TeamRow({ team, poolId, pools, locked, draggable, renamable, feedback, onRename, onAssign, onDelete }: {
  team: { id: string; name: string; slug: string }; poolId: string; pools: { id: string; name: string }[]; locked: boolean; draggable: boolean; renamable: boolean; feedback: React.ReactNode;
  onRename: (name: string) => Promise<boolean>; onAssign: (poolId: string | null) => void; onDelete: () => Promise<void>;
}) {
  // Verrouillé : la poule en simple texte ; sinon un sélecteur sans cadre (le trait de la ligne suffit).
  const poolName = pools.find((pool) => pool.id === poolId)?.name ?? 'Sans poule';
  return <Box component="li" aria-label={`Équipe ${team.name}`}>
    <Group gap={6} wrap="nowrap" align="center"><DragHandle teamId={team.id} name={team.name} origin="list" disabled={!draggable} /><Box style={{ flex: 1, minWidth: 0 }}><EditableName name={team.name} label="l’équipe" locked={!renamable} onRename={onRename}>
      {locked ? <Text fz="sm" c="dimmed" style={{ flexShrink: 0 }}>{poolName}</Text>
        : <NativeSelect size="xs" variant="filled" aria-label={`Poule de ${team.name}`} value={poolId} w={140}
          onChange={(event) => onAssign(event.currentTarget.value || null)}
          data={[{ value: '', label: 'Sans poule' }, ...pools.map((pool) => ({ value: pool.id, label: pool.name }))]} />}
    </EditableName></Box>
      {!locked ? <DeleteButton name={team.name} message={`Supprimer l’équipe « ${team.name} » du tournoi ?`} onConfirm={onDelete} /> : null}
    </Group>
    {feedback}
  </Box>;
}

/** Formulaire en ligne : champs et bouton alignés sur grand écran, empilés sur téléphone. */
function InlineForm({ legend, disabled, onSubmit, children }: { legend: string; disabled: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) {
  return <form onSubmit={onSubmit}><fieldset disabled={disabled} className="bare-fieldset"><legend className="sr-only">{legend}</legend>
    <Group align="flex-end" gap="sm" className="inline-form">{children}</Group></fieldset></form>;
}

export function TournamentEditor({ initial, publicOrigin }: { initial: TournamentConfiguration; publicOrigin?: string }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useQueryState('onglet', tabParser);
  const section = (Object.keys(tabSlugs) as Section[]).find((key) => tabSlugs[key] === tab) ?? 'overview';
  // Le sous-onglet n’a de sens que dans Paramètres : il est retiré de l’URL en changeant d’onglet.
  const setSection = (next: Section) => { void setTab(next === 'overview' ? null : tabSlugs[next]); };
  const openFormat = () => { void setTab(tabSlugs.rules); };
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  /** Terrain dont la modale « Ajouter une indisponibilité » est ouverte. */
  const [unavailableCourt, setUnavailableCourt] = useState<string | null>(null);
  const t = data.tournament;
  const endpoint = `/api/v1/admin/tournaments/${t.id}`;
  const editable = t.status === 'DRAFT' && data.match_count === 0;
  const locked = busy || !editable;
  // Renommer reste possible après publication (affichage seulement), jusqu’à l’archivage.
  const renamable = !busy && t.status !== 'ARCHIVED';
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

  /** Affectation par glisser-déposer : affichée aussitôt, rétablie si le serveur refuse. */
  async function assign(teamId: string, poolId: string | null) {
    const current = data.pool_teams.find((row) => row.team_id === teamId)?.pool_id ?? null;
    if (current === poolId) return;
    const previous = data;
    setData({ ...data, pool_teams: [...data.pool_teams.filter((row) => row.team_id !== teamId), ...(poolId ? [{ tournament_id: t.id, pool_id: poolId, team_id: teamId }] : [])] });
    if (!await mutate('assign_team', { team_id: teamId, pool_id: poolId }, teamId)) setData(previous);
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
    // Nom laissé vide : le prochain de la suite (Poule A, B… ; Terrain 1, 2…).
    const typed = String(fields.get('name') ?? '').trim();
    const name = typed || (operation === 'create_pool' ? nextPoolName(data.pools.map((pool) => pool.name)) : operation === 'create_court' ? nextCourtName(data.courts.map((court) => court.name)) : typed);
    // À la création, l’identifiant du lien vient du nom ; un suffixe le rend unique (« les-lions-2 »).
    const slug = operation === 'update_team' ? String(fields.get('slug') || slugify(name)) : uniqueSlug(slugify(name) || 'equipe', data.teams.map((team) => team.slug));
    const payload = { name, ...(id ? { id } : {}), ...(['create_team', 'update_team'].includes(operation) ? { slug } : {}) };
    if (await mutate(operation, payload, context) && !id) form.reset();
  }

  /** Suppression déjà confirmée dans la bulle de la corbeille. */
  async function remove(operation: ConfigurationCommand['operation'], id: string, context: string) {
    await mutate(operation, { id }, context);
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
      try { dates[key] = localToInstant(String(form.get(key)), t.timezone); }
      catch { setFeedback({ context: courtId, error: new FormError('Vérifiez les horaires de l’indisponibilité.', { [key]: ['Heure invalide, ou qui n’existe pas ou se répète dans ce fuseau (nuit du changement d’heure) : choisissez une autre heure.'] }) }); return; }
    }
    if (await mutate('add_unavailability', { court_id: courtId, ...dates }, courtId)) setUnavailableCourt(null);
  }

  // Onglets complétés (coche ✓) : ce que l’organisateur a terminé, dans l’ordre du travail.
  const placementCheck = placementState(data);
  const completed: Record<Section, boolean> = {
    overview: Boolean(t.name && t.sport && t.starts_at && t.ends_at),
    teams: data.teams.length >= 2 && data.pools.length > 0 && data.pools.every((pool) => data.pool_teams.filter((row) => row.pool_id === pool.id).length >= 2)
      && data.teams.every((team) => data.pool_teams.some((row) => row.team_id === team.id)),
    courts: data.courts.length > 0 && data.courts.every((court) => data.availabilities.some((row) => row.court_id === court.id)),
    rules: placementCheck.chosen && !placementCheck.problems.length,
    schedule: t.status !== 'DRAFT',
    results: t.status === 'COMPLETED' || t.status === 'ARCHIVED',
    share: false,
  };

  return <>
    <TournamentTheme appearance={t} />
    <PageHeading title={t.name} badge={<TournamentStatus status={t.status} />} action={<Button variant="default" size="sm" onClick={reload} disabled={busy}>Recharger</Button>}
      description={<>{t.sport}{t.location ? ` · ${t.location}` : ''}<br />{formatTournamentDate(t.starts_at, t.timezone)} — {t.timezone}</>}>
      {t.status !== 'DRAFT' ? <Group gap="xs" mt="xs"><Anchor href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer" fw={600}>Voir la page publique</Anchor><Text c="dimmed">·</Text><Anchor component="button" type="button" onClick={() => setSection('share')} fw={600}>Liens et QR codes</Anchor></Group> : null}
    </PageHeading>

    <ConfigurationSummary data={data} onOpen={setSection} />
    <Alert variant="light" color={editable ? 'ink' : 'gray'} mb="md">
      {editable ? 'Votre brouillon est privé. Préparez les équipes, les poules et les disponibilités, puis générez le calendrier.'
        : t.status === 'DRAFT' ? 'Un calendrier est enregistré : la configuration est verrouillée. Supprimez-le depuis la section Calendrier pour la modifier.'
          : 'La configuration est en lecture seule après publication. Restent modifiables : les noms des équipes et des poules, l’apparence, le format de classement (avant son début) et la levée d’une indisponibilité de terrain.'}
    </Alert>
    {status('global')}

    <Tabs value={section} onChange={(value) => value && setSection(value as Section)} keepMounted={false}>
      <TabsList aria-label="Sections de configuration" mb="lg" className="section-tabs">
        {sections.map(([key, label]) => <TabsTab key={key} value={key} title={completed[key] ? `${label} : complété` : undefined}
          rightSection={completed[key] ? <span className="tab-done" aria-hidden="true">✓</span> : undefined}>{label}</TabsTab>)}
      </TabsList>

      <Box aria-busy={busy}>
        <TabsPanel value="overview"><Stack>
          <Card><Title order={2} fz="xl" mb="md">Informations du tournoi</Title>
            <form key={t.version} onSubmit={updateInformation}><fieldset disabled={locked} className="bare-fieldset"><legend className="sr-only">Modifier les informations</legend>
              <Stack><TournamentFields value={t} fields={errorFor('information')?.fields} />{status('information')}<Group><Button type="submit">Enregistrer les informations</Button></Group></Stack>
            </fieldset></form>
          </Card>
          <AppearancePanel key={`${t.theme}:${t.primary_color}:${t.accent_color}:${t.background_color}:${t.surface_color}:${t.text_color}`} data={data} busy={busy} feedback={status('appearance')}
            onSave={(payload) => mutate('update_appearance', payload, 'appearance')} />
        </Stack></TabsPanel>

        <TabsPanel value="rules"><Stack>
          <FormatSection key={`${data.rules.final_format}:${data.rules.round_break_minutes}:${data.rules.allow_incomplete}`} data={data} busy={busy} feedback={status('format')} onSave={(final_format, round_break_minutes, allow_incomplete) => mutate('set_final_format', { final_format, round_break_minutes, allow_incomplete }, 'format')} />
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

        <TabsPanel value="teams">
          {/* Deux colonnes égales : les équipes à gauche, les poules à droite (empilées sur téléphone). */}
          {/* Le glisser-déposer ne dépend que du verrouillage, pas d’un enregistrement en cours : une équipe saisie le reste. */}
          <TeamsDnd enabled={editable} teams={data.teams} pools={data.pools} onMove={(teamId, poolId) => void assign(teamId, poolId)}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" style={{ alignItems: 'start' }}>
            <Stack>
            <Card><Group justify="space-between" mb="md" gap="xs"><Title order={2} fz="xl">Ajouter une équipe</Title>{!locked ? <DemoTeamsButton disabled={busy} onGenerate={(count) => mutate('create_teams', { teams: demoTeams(count, data.teams) }, 'team-new')} /> : null}</Group>
              <InlineForm legend="Nouvelle équipe" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_team', 'team-new')}>
                <Field name="name" label="Nom de l’équipe" minLength={2} maxLength={80} required error={errorFor('team-new')?.fields.name} />
                <Button type="submit">Ajouter l’équipe</Button>
              </InlineForm>{status('team-new')}
            </Card>
            <Card><Group justify="space-between" mb="xs"><Title order={2} fz="xl">Équipes inscrites</Title><Text c="dimmed" fz="sm">{data.teams.length} équipe{data.teams.length !== 1 ? 's' : ''}</Text></Group>
              {data.teams.length && renamable ? <Text fz="xs" c="dimmed" mb="sm">Cliquez sur le nom d’une équipe ou d’une poule pour le modifier.</Text> : null}
              {!data.teams.length ? <Text c="dimmed">Ajoutez la première équipe pour commencer à composer les poules.</Text> : <ul className="plain-list">{data.teams.map((team) => <TeamRow key={team.id} team={team} renamable={renamable} draggable={editable}
                poolId={data.pool_teams.find((row) => row.team_id === team.id)?.pool_id ?? ''} pools={data.pools} locked={locked} feedback={status(team.id)}
                onRename={(name) => mutate('update_team', { id: team.id, name, slug: team.slug }, team.id)}
                onAssign={(pool_id) => void mutate('assign_team', { team_id: team.id, pool_id }, team.id)}
                onDelete={() => remove('delete_team', team.id, 'team-list')} />)}</ul>}{status('team-list')}
            </Card>
            </Stack>
            <Stack>
            <Card><Title order={2} fz="xl" mb="md">Ajouter une poule</Title>
              <InlineForm legend="Nouvelle poule" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_pool', 'pool-new')}>
                <Field name="name" label="Nom de la poule" placeholder={nextPoolName(data.pools.map((pool) => pool.name))} description="Laissé vide : le nom proposé." minLength={2} maxLength={80} error={errorFor('pool-new')?.fields.name} />
                <Button type="submit">Ajouter la poule</Button>
              </InlineForm>{status('pool-new')}
              {(() => {
                const assigned = new Set(data.pool_teams.map((row) => row.team_id)).size;
                const unassigned = data.teams.length - assigned;
                const small = data.pools.length ? Math.floor(data.teams.length / data.pools.length) : 0;
                const large = data.pools.length ? Math.ceil(data.teams.length / data.pools.length) : 0;
                const drawable = !locked && data.pools.length > 0 && data.teams.length > 0;
                return <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                  <Text fw={700} mb={4}>Répartir au hasard</Text>
                  <Text fz="sm" c="dimmed" mb="sm">{data.pools.length && data.teams.length
                    ? `${data.teams.length} équipes dans ${data.pools.length} poule${data.pools.length > 1 ? 's' : ''} : ${small === large ? `${small} équipes par poule` : `poules de ${small} ou ${large} équipes`}. Le tirage équilibre les poules à une équipe près ; vous pourrez ensuite ajuster à la main dans la liste des équipes.`
                    : 'Créez les poules et inscrivez les équipes, puis laissez le hasard les répartir.'}</Text>
                  <Group gap="sm">
                    <Button disabled={!drawable} onClick={() => { if (!assigned || window.confirm('Remplacer la répartition actuelle par un nouveau tirage au sort de toutes les équipes ?')) void mutate('draw_pools', { mode: 'all' }, 'draw'); }}>Répartir toutes les équipes au hasard</Button>
                    {assigned > 0 && unassigned > 0 ? <Button variant="light" disabled={!drawable} onClick={() => void mutate('draw_pools', { mode: 'unassigned' }, 'draw')}>Placer au hasard les {unassigned} équipe{unassigned > 1 ? 's' : ''} sans poule</Button> : null}
                  </Group>
                  {status('draw')}
                  {/* Équipes sans poule : à glisser vers une poule ; y déposer une équipe la retire de sa poule. */}
                  {editable && data.pools.length ? <Box mt="md"><DropZone poolId={null}><div className="drop-area">
                    <Group justify="space-between" mb={unassigned ? 6 : 0}><Text fw={700} fz="sm">Sans poule</Text><Text c="dimmed" fz="xs">{unassigned} équipe{unassigned !== 1 ? 's' : ''}</Text></Group>
                    {unassigned ? <ul className="pool-members">{data.teams.filter((team) => !data.pool_teams.some((row) => row.team_id === team.id)).map((team) => <li key={team.id}><DragHandle teamId={team.id} name={team.name} origin="free" /><span>{team.name}</span></li>)}</ul>
                      : <Text fz="xs" c="dimmed">Toutes les équipes ont une poule. Déposez-en une ici pour la retirer de sa poule.</Text>}
                  </div></DropZone>
                  {unassigned ? <Text fz="xs" c="dimmed" mt={6}>Glissez une équipe (⠿) vers une poule, ou placez-les au hasard.</Text> : null}</Box> : null}
                </Box>;
              })()}
            </Card>
            <Stack gap="sm">{data.pools.map((pool) => {
              const members = data.teams.filter((team) => data.pool_teams.some((row) => row.pool_id === pool.id && row.team_id === team.id));
              return <DropZone key={pool.id} poolId={pool.id} disabled={!editable}><Card>
                <Box mb="sm"><EditableName name={pool.name} label="la poule" size="lg" locked={!renamable}
                onRename={(name) => mutate('update_pool', { id: pool.id, name }, pool.id)}>
                <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}><Text c="dimmed" fz="sm">{members.length} équipe{members.length !== 1 ? 's' : ''}</Text>
                  {!locked ? <DeleteButton name={pool.name} message={`Supprimer « ${pool.name} » ? Ses équipes resteront inscrites, sans poule.`} onConfirm={() => remove('delete_pool', pool.id, 'pool-list')} /> : null}</Group>
              </EditableName></Box>
              {members.length ? <ul className="pool-members">{members.map((team) => <li key={team.id}><DragHandle teamId={team.id} name={team.name} origin="pool" disabled={!editable} /><span>{team.name}</span></li>)}</ul> : <Text c="dimmed">{locked ? 'Aucune équipe affectée.' : 'Déposez des équipes ici.'}</Text>}
                  {status(pool.id)}
              </Card></DropZone>;
            })}</Stack>
            {!data.pools.length ? <Text c="dimmed">Créez une poule, puis affectez-lui des équipes.</Text> : null}{status('pool-list')}
            </Stack>
          </SimpleGrid>
          </TeamsDnd>
        </TabsPanel>


        <TabsPanel value="courts"><Stack>
          <Card><Title order={2} fz="xl" mb="md">Ajouter un terrain</Title>
            <InlineForm legend="Nouveau terrain" disabled={locked} onSubmit={(event) => namedSubmit(event, 'create_court', 'court-new')}>
              <Field name="name" label="Nom du terrain" placeholder={nextCourtName(data.courts.map((court) => court.name))} description="Laissé vide : le nom proposé." minLength={2} maxLength={80} error={errorFor('court-new')?.fields.name} />
              <Button type="submit">Ajouter le terrain</Button>
            </InlineForm>{status('court-new')}
          </Card>
          {data.courts.map((court) => <Card key={court.id}>
            <EditableName name={court.name} label="le terrain" size="lg" locked={!renamable} onRename={(name) => mutate('update_court', { id: court.id, name }, court.id)}>
              {!locked ? <DeleteButton name={court.name} message={`Supprimer « ${court.name} » et ses indisponibilités ?`} onConfirm={() => remove('delete_court', court.id, 'court-list')} /> : null}
            </EditableName>
            {(() => {
              const off = gaps(period, data.availabilities.filter((row) => row.court_id === court.id).map((row) => ({ start: Date.parse(row.starts_at), end: Date.parse(row.ends_at) })));
              const restorable = !busy && (editable || t.status === 'PUBLISHED');
              return <Stack gap="xs" mt="xs" mb="md">
                {!off.length ? <Group gap="xs"><Badge color="teal">Disponible pendant tout le tournoi</Badge><Text fz="sm" c="dimmed">{formatTournamentDate(t.starts_at, t.timezone)} → {formatTournamentDate(t.ends_at, t.timezone)}</Text></Group>
                  : <ul className="plain-list">{off.map((slot) => <li key={slot.start}>
                    <Group justify="space-between" gap="xs">
                      <Text fz="sm"><Text span fw={700}>Indisponible</Text> · {formatTournamentDate(new Date(slot.start).toISOString(), t.timezone)} → {formatTournamentDate(new Date(slot.end).toISOString(), t.timezone)}</Text>
                      <Button variant="subtle" size="compact-sm" disabled={!restorable} onClick={() => void mutate('remove_unavailability', { court_id: court.id, starts_at: new Date(slot.start).toISOString(), ends_at: new Date(slot.end).toISOString() }, court.id)}>Rendre disponible</Button>
                    </Group>
                  </li>)}</ul>}
              </Stack>;
            })()}
            {!locked ? <Group><Button variant="light" size="sm" onClick={() => setUnavailableCourt(court.id)}>Ajouter une indisponibilité</Button></Group> : null}
            {status(court.id)}
          </Card>)}
          {!data.courts.length ? <Text c="dimmed">Ajoutez un terrain : il sera disponible pendant tout le tournoi, sauf indisponibilités que vous indiquerez.</Text> : null}{status('court-list')}
        </Stack></TabsPanel>


        <TabsPanel value="schedule"><SchedulePanel data={data} onChange={replace} /></TabsPanel>
        <TabsPanel value="results"><ResultsPanel data={data} onChange={replace} onShowSchedule={() => setSection('schedule')} onShowRules={openFormat} /></TabsPanel>
        <TabsPanel value="share"><SharePanel data={data} origin={publicOrigin} /></TabsPanel>
      </Box>
    </Tabs>

    {/* Une seule modale, pour le terrain choisi. */}
    {(() => {
      const modalCourt = data.courts.find((court) => court.id === unavailableCourt);
      return <Modal opened={Boolean(modalCourt)} onClose={() => setUnavailableCourt(null)} title={modalCourt ? `Indisponibilité · ${modalCourt.name}` : ''} centered size="lg">
        {modalCourt ? <>
              <form onSubmit={(event) => addUnavailability(event, modalCourt.id)}><fieldset disabled={locked} className="bare-fieldset"><legend className="sr-only">Nouvelle indisponibilité</legend><Stack gap="sm">
                <Text fz="sm" c="dimmed">Par défaut, le terrain est disponible pendant tout le tournoi. Indiquez seulement les périodes où il ne l’est pas : pause de midi, autre réservation… Horaires dans le fuseau {t.timezone}.</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Field name="starts_at" label="Début" type="datetime-local" defaultValue={instantToLocal(t.starts_at, t.timezone)} required error={errorFor(modalCourt.id)?.fields.starts_at} />
                  <Field name="ends_at" label="Fin" type="datetime-local" defaultValue={instantToLocal(new Date(Math.min(Date.parse(t.starts_at) + 3_600_000, Date.parse(t.ends_at))).toISOString(), t.timezone)} required error={errorFor(modalCourt.id)?.fields.ends_at} />
                </SimpleGrid>
                <Group justify="flex-end"><Button variant="default" onClick={() => setUnavailableCourt(null)}>Annuler</Button><Button type="submit" loading={busy}>Ajouter l’indisponibilité</Button></Group>
              </Stack></fieldset></form>
        </> : null}
      </Modal>;
    })()}
  </>;
}
