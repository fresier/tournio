'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TournamentFields, tournamentFields } from './tournament-fields';
import { FormFeedback } from '@/components/forms/field';
import { configurationRequest, FormError } from '@/lib/tournaments/client';
import { slugify, tournamentInputSchema } from '@/lib/tournaments/contracts';

export function NewTournament() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [customSlug, setCustomSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true);
    try {
      const body = tournamentFields(new FormData(event.currentTarget));
      const parsed = tournamentInputSchema.safeParse(body);
      if (!parsed.success) {
        const fields: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) (fields[String(issue.path[0])] ??= []).push(issue.message);
        throw new FormError('Vérifiez les champs du formulaire.', fields);
      }
      const data = await configurationRequest('/api/v1/admin/tournaments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      router.push(`/dashboard/tournaments/${data.tournament.id}`);
      router.refresh();
    } catch (error) { setError(error instanceof FormError ? error : new FormError('Impossible de créer le tournoi. Réessayez.')); }
    finally { setBusy(false); }
  }
  return <form className="panel configuration-form" onSubmit={submit}>
    <fieldset disabled={busy}><legend className="sr-only">Informations du nouveau tournoi</legend>
      <TournamentFields fields={error?.fields} slug={slug} onSlugChange={(value) => { setCustomSlug(true); setSlug(value); }} onNameChange={(value) => { if (!customSlug) setSlug(slugify(value)); }} />
      <FormFeedback error={error} /><div className="form-actions"><button type="submit">{busy ? 'Création en cours…' : 'Créer le tournoi en brouillon'}</button><span className="hint">Visible uniquement par vous avant publication.</span></div>
    </fieldset>
  </form>;
}
