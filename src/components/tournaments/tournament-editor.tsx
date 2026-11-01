'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field, FormFeedback } from '@/components/forms/field';
import { TournamentFields, tournamentFields } from './tournament-fields';
import { configurationCommandSchema, slugify, type ConfigurationCommand, type TournamentConfiguration } from '@/lib/tournaments/contracts';
import { configurationRequest, FormError } from '@/lib/tournaments/client';
import { formatTournamentDate, instantToLocal, localToInstant } from '@/lib/tournaments/dates';

const sections = [ ['overview', 'Informations'], ['teams', 'Équipes'], ['pools', 'Poules'], ['courts', 'Terrains'], ['rules', 'Règles'] ] as const;
type Section = typeof sections[number][0];
type Feedback = { context: string; error?: FormError; success?: string };
const numericRules = [
  ['match_duration_minutes', 'Durée d’un match (min)', 1], ['transition_minutes', 'Transition entre matchs (min)', 0],
  ['minimum_rest_minutes', 'Repos minimal d’une équipe (min)', 0], ['points_win', 'Points pour une victoire', -999],
  ['points_draw', 'Points pour un nul', -999], ['points_loss', 'Points pour une défaite', -999],
] as const;

export function TournamentEditor({ initial }: { initial: TournamentConfiguration }) {
  const [data, setData] = useState(initial);
  const [section, setSection] = useState<Section>('overview');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const t = data.tournament;
  const endpoint = `/api/v1/admin/tournaments/${t.id}`;
  const editable = t.status === 'DRAFT' && data.match_count === 0;
  const errorFor = (context: string) => feedback?.context === context ? feedback.error : undefined;
  const status = (context: string) => <FormFeedback error={errorFor(context)} success={feedback?.context === context ? feedback.success : undefined} />;

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

  async function addAvailability(event: FormEvent<HTMLFormElement>, courtId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const dates: Record<string, string> = {};
    for (const key of ['starts_at', 'ends_at']) {
      try { dates[key] = localToInstant(String(form.get(key)), t.timezone, String(form.get(`${key}_offset`) || '')); }
      catch { setFeedback({ context: courtId, error: new FormError('Vérifiez les horaires du terrain.', { [key]: ['Heure invalide ou ambiguë. Précisez le décalage UTC si nécessaire.'] }) }); return; }
    }
    await mutate('create_availability', { court_id: courtId, ...dates }, courtId);
  }

  return <>
    <Link className="back-link" href="/dashboard">Mes tournois</Link>
    <header className="page-heading"><div><div className="row-heading"><h1>{t.name}</h1><span className="status-chip">{t.status === 'DRAFT' ? 'Brouillon' : t.status === 'PUBLISHED' ? 'Publié' : t.status === 'COMPLETED' ? 'Terminé' : 'Archivé'}</span></div><p>{t.sport}{t.location ? ` · ${t.location}` : ''}</p><p className="hint">{formatTournamentDate(t.starts_at, t.timezone)} — {t.timezone}</p></div><button className="secondary compact" onClick={reload} disabled={busy}>Recharger</button></header>
    <div className="preparation-strip"><span><strong>{data.teams.length}</strong> équipes</span><span><strong>{data.pools.length}</strong> poules</span><span><strong>{data.pool_teams.length}</strong> équipes affectées</span><span><strong>{data.courts.length}</strong> terrains</span></div>
    {editable ? <p className="configuration-note">Votre brouillon est privé. Préparez les équipes, les poules et les disponibilités avant de générer le calendrier.</p> : <p className="configuration-note">La configuration est en lecture seule après publication ou création des matchs.</p>}
    {status('global')}
    <nav className="section-nav" aria-label="Sections de configuration">{sections.map(([key, label]) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{label}</button>)}</nav>
    <div className="configuration-content" aria-busy={busy}>
      {section === 'overview' ? <section className="panel"><h2>Informations du tournoi</h2><form key={t.version} onSubmit={updateInformation}><fieldset disabled={busy || !editable}><legend className="sr-only">Modifier les informations</legend><TournamentFields value={t} fields={errorFor('information')?.fields} />{status('information')}<button type="submit">Enregistrer les informations</button></fieldset></form></section> : null}

      {section === 'teams' ? <>
        <section className="panel"><h2>Ajouter une équipe</h2><form onSubmit={(event) => namedSubmit(event, 'create_team', 'team-new')}><fieldset className="inline-form" disabled={busy || !editable}><legend className="sr-only">Nouvelle équipe</legend><Field name="name" label="Nom de l’équipe" minLength={2} maxLength={80} required error={errorFor('team-new')?.fields.name} /><Field name="slug" label="Identifiant du lien (facultatif)" maxLength={100} placeholder="Généré à partir du nom" error={errorFor('team-new')?.fields.slug} /><button type="submit">Ajouter l’équipe</button></fieldset>{status('team-new')}</form></section>
        <section className="panel"><div className="section-heading"><h2>Équipes inscrites</h2><span>{data.teams.length} équipe{data.teams.length !== 1 ? 's' : ''}</span></div>
          {!data.teams.length ? <p className="empty-message">Ajoutez la première équipe pour commencer à composer les poules.</p> : <div className="resource-list">{data.teams.map((team) => {
            const membership = data.pool_teams.find((row) => row.team_id === team.id);
            return <article className="resource-row" key={team.id}><div className="team-main"><h3>{team.name}</h3><label className="pool-select">Poule<select aria-label={`Poule de ${team.name}`} disabled={busy || !editable} value={membership?.pool_id ?? ''} onChange={(event) => void mutate('assign_team', { team_id: team.id, pool_id: event.currentTarget.value || null }, team.id)}><option value="">Non affectée</option>{data.pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></label></div>
              <details className="resource-details"><summary>Modifier l’équipe</summary><form key={`${team.name}:${team.slug}`} onSubmit={(event) => namedSubmit(event, 'update_team', team.id, team.id)}><fieldset className="inline-form" disabled={busy || !editable}><legend className="sr-only">Modifier {team.name}</legend><Field name="name" label="Nom" defaultValue={team.name} required minLength={2} maxLength={80} error={errorFor(team.id)?.fields.name} /><Field name="slug" label="Identifiant du lien" defaultValue={team.slug} required maxLength={100} error={errorFor(team.id)?.fields.slug} /><button type="submit">Enregistrer</button></fieldset></form><button className="danger-link" onClick={() => void remove('delete_team', team.id, `Supprimer l’équipe « ${team.name} » du tournoi ?`, 'team-list')} disabled={busy || !editable}>Supprimer l’équipe</button></details>{status(team.id)}</article>;
          })}</div>}{status('team-list')}</section>
      </> : null}

      {section === 'pools' ? <>
        <section className="panel"><h2>Créer une poule</h2><form onSubmit={(event) => namedSubmit(event, 'create_pool', 'pool-new')}><fieldset className="inline-form" disabled={busy || !editable}><legend className="sr-only">Nouvelle poule</legend><Field name="name" label="Nom de la poule" placeholder="Ex. Poule A" required minLength={2} maxLength={80} error={errorFor('pool-new')?.fields.name} /><button type="submit">Ajouter la poule</button></fieldset>{status('pool-new')}</form></section>
        <p className="hint">Répartissez les équipes manuellement depuis la section Équipes. Chaque équipe peut appartenir à une seule poule.</p>
        <div className="resource-grid">{data.pools.map((pool) => {
          const members = data.teams.filter((team) => data.pool_teams.some((row) => row.pool_id === pool.id && row.team_id === team.id));
          return <section className="panel" key={pool.id}><div className="section-heading"><h2>{pool.name}</h2><span>{members.length} équipes</span></div>{members.length ? <ul className="pool-members">{members.map((team) => <li key={team.id}>{team.name}</li>)}</ul> : <p className="empty-message">Aucune équipe affectée.</p>}<details className="resource-details"><summary>Modifier la poule</summary><form onSubmit={(event) => namedSubmit(event, 'update_pool', pool.id, pool.id)}><fieldset disabled={busy || !editable}><legend className="sr-only">Modifier {pool.name}</legend><Field name="name" label="Nom" defaultValue={pool.name} required minLength={2} maxLength={80} error={errorFor(pool.id)?.fields.name} /><button type="submit">Enregistrer</button></fieldset></form><button className="danger-link" disabled={busy || !editable} onClick={() => void remove('delete_pool', pool.id, `Supprimer « ${pool.name} » ? Ses équipes resteront inscrites, sans poule.`, 'pool-list')}>Supprimer la poule</button></details>{status(pool.id)}</section>;
        })}</div>{!data.pools.length ? <p className="empty-message">Créez une poule, puis affectez-lui des équipes.</p> : null}{status('pool-list')}
      </> : null}

      {section === 'courts' ? <>
        <section className="panel"><h2>Ajouter un terrain</h2><form onSubmit={(event) => namedSubmit(event, 'create_court', 'court-new')}><fieldset className="inline-form" disabled={busy || !editable}><legend className="sr-only">Nouveau terrain</legend><Field name="name" label="Nom du terrain" placeholder="Ex. Terrain 1" required minLength={2} maxLength={80} error={errorFor('court-new')?.fields.name} /><button type="submit">Ajouter le terrain</button></fieldset>{status('court-new')}</form></section>
        {data.courts.map((court) => <section className="panel" key={court.id}><h2>{court.name}</h2><p className="hint">Horaires dans le fuseau {t.timezone}.</p>
          <ul className="availability-list">{data.availabilities.filter((row) => row.court_id === court.id).map((row) => <li key={row.id}><span>{formatTournamentDate(row.starts_at, t.timezone)}<br />{formatTournamentDate(row.ends_at, t.timezone)}</span><button className="danger-link" disabled={busy || !editable} onClick={() => void remove('delete_availability', row.id, 'Supprimer cette disponibilité du terrain ?', court.id)}>Supprimer<span className="sr-only"> cette disponibilité</span></button></li>)}</ul>
          <form onSubmit={(event) => addAvailability(event, court.id)}><fieldset disabled={busy || !editable}><legend className="availability-legend">Ajouter une plage disponible</legend><div className="form-grid"><Field name="starts_at" label="Début" type="datetime-local" defaultValue={instantToLocal(t.starts_at, t.timezone)} required error={errorFor(court.id)?.fields.starts_at} /><Field name="ends_at" label="Fin" type="datetime-local" defaultValue={instantToLocal(t.ends_at, t.timezone)} required error={errorFor(court.id)?.fields.ends_at} /></div><details className="time-details"><summary>Décalage UTC en cas d’heure ambiguë</summary><div className="form-grid"><Field name="starts_at_offset" label="Décalage UTC du début" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /><Field name="ends_at_offset" label="Décalage UTC de fin" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /></div></details><button type="submit">Ajouter la disponibilité</button></fieldset></form>
          <details className="resource-details"><summary>Modifier le terrain</summary><form onSubmit={(event) => namedSubmit(event, 'update_court', court.id, court.id)}><fieldset className="inline-form" disabled={busy || !editable}><legend className="sr-only">Modifier {court.name}</legend><Field name="name" label="Nom" defaultValue={court.name} required minLength={2} maxLength={80} error={errorFor(court.id)?.fields.name} /><button type="submit">Enregistrer le nom</button></fieldset></form><button className="danger-link" disabled={busy || !editable} onClick={() => void remove('delete_court', court.id, `Supprimer « ${court.name} » et toutes ses disponibilités ?`, 'court-list')}>Supprimer le terrain</button></details>{status(court.id)}</section>)}
        {!data.courts.length ? <p className="empty-message">Ajoutez un terrain puis définissez quand il est disponible.</p> : null}{status('court-list')}
      </> : null}

      {section === 'rules' ? <section className="panel"><h2>Durées et classement</h2><p className="hint">Score numérique simple, sans sets. Ces paramètres s’appliquent à toutes les poules.</p><form key={t.version} onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        const values = Object.fromEntries(numericRules.map(([key]) => [key, Number(form.get(key))]));
        void mutate('save_rules', { ...values, allow_draw: form.get('allow_draw') === 'on' }, 'rules');
      }}><fieldset disabled={busy || !editable}><legend className="sr-only">Règles du tournoi</legend><div className="form-grid">{numericRules.map(([key, label, min]) => <Field key={key} name={key} label={label} type="number" step="1" min={min} max={key.startsWith('points_') ? 999 : 2147483647} defaultValue={data.rules[key]} required error={errorFor('rules')?.fields[key]} />)}</div><label className="checkbox-field"><input name="allow_draw" type="checkbox" defaultChecked={data.rules.allow_draw} />Autoriser les matchs nuls</label><p className="hint">Départage : points, différence de scores, scores marqués, puis identifiant stable de l’équipe.</p>{status('rules')}<button type="submit">Enregistrer les règles</button></fieldset></form></section> : null}
    </div>
  </>;
}
