'use client';
import { Field } from '@/components/forms/field';
import { FormError } from '@/lib/tournaments/client';
import { timezoneSchema, type TournamentInput } from '@/lib/tournaments/contracts';
import { instantToLocal, localToInstant } from '@/lib/tournaments/dates';

export function tournamentFields(form: FormData): TournamentInput {
  const value = (key: string) => String(form.get(key) ?? '');
  const timezone = value('timezone');
  if (!timezoneSchema.safeParse(timezone).success) throw new FormError('Vérifiez le fuseau horaire.', { timezone: ['Utilisez un identifiant IANA, par exemple Europe/Brussels.'] });
  const instant = (key: string) => {
    try { return localToInstant(value(key), timezone, value(`${key}_offset`)); }
    catch { throw new FormError('Vérifiez les horaires du tournoi.', { [key]: ['Heure invalide, inexistante ou ambiguë dans ce fuseau. Pour une heure ambiguë, précisez le décalage UTC ci-dessous.'] }); }
  };
  return { name: value('name'), slug: value('slug'), sport: value('sport'), location: value('location'), timezone, starts_at: instant('starts_at'), ends_at: instant('ends_at') };
}

export function TournamentFields({ value, fields = {}, slug, onSlugChange, onNameChange }: {
  value?: TournamentInput; fields?: Record<string, string[]>; slug?: string;
  onSlugChange?: (value: string) => void; onNameChange?: (value: string) => void;
}) {
  const timezone = value?.timezone ?? 'Europe/Brussels';
  return <>
    <div className="form-grid">
      <Field name="name" label="Nom du tournoi" defaultValue={value?.name} required minLength={2} maxLength={120} error={fields.name} onChange={onNameChange ? (event) => onNameChange(event.currentTarget.value) : undefined} />
      <Field name="sport" label="Sport" defaultValue={value?.sport} placeholder="Ex. football, badminton, multisport" required minLength={2} maxLength={80} error={fields.sport} />
      <Field name="slug" label="Identifiant du lien public" {...(onSlugChange ? { value: slug, onChange: (event) => onSlugChange(event.currentTarget.value) } : { defaultValue: value?.slug })} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} error={fields.slug} />
      <Field name="location" label="Lieu" defaultValue={value?.location} maxLength={240} placeholder="Salle, club ou adresse" error={fields.location} />
      <Field name="timezone" label="Fuseau horaire" defaultValue={timezone} required list="tournament-timezones" error={fields.timezone} />
      <datalist id="tournament-timezones"><option value="Europe/Brussels" /><option value="Europe/Paris" /><option value="Europe/London" /><option value="UTC" /><option value="America/Montreal" /></datalist>
    </div>
    <p className="hint">Les horaires ci-dessous sont ceux du fuseau choisi pour le tournoi.</p>
    <div className="form-grid">
      <Field name="starts_at" label="Début" type="datetime-local" defaultValue={value ? instantToLocal(value.starts_at, timezone) : undefined} required error={fields.starts_at} />
      <Field name="ends_at" label="Fin" type="datetime-local" defaultValue={value ? instantToLocal(value.ends_at, timezone) : undefined} required error={fields.ends_at} />
    </div>
    <details className="time-details"><summary>Préciser le décalage UTC lors d’un changement d’heure</summary><p className="hint">Uniquement si une heure existe deux fois : saisissez par exemple +01:00 ou +02:00. Le décalage doit correspondre au fuseau et à la date.</p><div className="form-grid"><Field name="starts_at_offset" label="Décalage UTC du début" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /><Field name="ends_at_offset" label="Décalage UTC de fin" placeholder="+01:00" pattern="[+-][0-9]{2}:[0-9]{2}" /></div></details>
  </>;
}
