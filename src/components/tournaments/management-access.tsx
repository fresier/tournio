'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Field, FormFeedback } from '@/components/forms/field';
import { FormError } from '@/lib/tournaments/client';
import { managersResponseSchema } from '@/lib/tournaments/contracts';

type Access = z.infer<typeof managersResponseSchema>;

async function accessRequest(url: string, init?: RequestInit): Promise<Access> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.object({ message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional() }) }).safeParse(body);
    throw new FormError(parsed.success ? parsed.data.error.message : 'Le service est momentanément indisponible.', parsed.success ? parsed.data.error.fieldErrors : {});
  }
  return z.object({ access: managersResponseSchema }).parse(body).access;
}

export function ManagementAccess({ tournamentId, archived }: { tournamentId: string; archived: boolean }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [success, setSuccess] = useState('');
  const endpoint = `/api/v1/admin/tournaments/${tournamentId}/managers`;

  useEffect(() => {
    const controller = new AbortController();
    void accessRequest(endpoint, { signal: controller.signal }).then(setAccess).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof FormError ? failure : new FormError('Impossible de charger les accès.'));
    });
    return () => controller.abort();
  }, [endpoint]);

  async function change(method: 'POST' | 'DELETE', address: string) {
    setBusy(true); setError(null); setSuccess('');
    try {
      setAccess(await accessRequest(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address }) }));
      if (method === 'POST') setEmail('');
      setSuccess(method === 'POST' ? 'Accès ajouté. Pensez à prévenir cette personne.' : 'Accès retiré.');
    } catch (failure) { setError(failure instanceof FormError ? failure : new FormError('Action impossible. Vérifiez votre connexion.')); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void change('POST', email); }

  async function copyDashboard() {
    const url = `${window.location.origin}/dashboard`;
    try { await navigator.clipboard.writeText(url); setSuccess('Lien de l’espace organisateur copié.'); }
    catch { window.prompt('Copiez ce lien :', url); }
  }

  return <Card>
    <Title order={2} fz="xl" mb="xs">Gestionnaires du tournoi</Title>
    <FormFeedback error={error} success={success} />
    {!access ? <Text c="dimmed" fz="sm">{error ? 'Les accès ne sont pas disponibles. Rechargez la page pour réessayer.' : 'Chargement des accès…'}</Text>
      : access.role === 'manager' ? <Text c="dimmed" fz="sm">Vous avez accès à ce tournoi. Seul son propriétaire peut ajouter ou retirer des gestionnaires.{archived ? ' Le tournoi est archivé et reste en lecture seule.' : ''}</Text>
        : <Stack gap="sm">
          <Text fz="sm" c="dimmed">Autorisez une personne avec l’adresse de son compte Google. Elle pourra {archived ? 'consulter ce tournoi archivé' : 'configurer le tournoi, gérer le calendrier et saisir les résultats'}, mais seul le propriétaire peut gérer les accès.</Text>
          <Text fz="sm" c="dimmed">La personne peut se connecter pour la première fois après l’ajout. Aucun e-mail n’est envoyé : prévenez-la et transmettez-lui le lien de l’espace organisateur.</Text>
          <form onSubmit={submit}><fieldset disabled={busy} className="bare-fieldset"><legend className="sr-only">Ajouter un gestionnaire</legend>
            <Group align="flex-end" gap="sm">
              <Field name="email" type="email" label="Adresse e-mail du gestionnaire" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required maxLength={254} error={error?.fields.email} style={{ flex: '1 1 240px' }} />
              <Button type="submit" loading={busy}>Ajouter l’accès</Button>
            </Group>
          </fieldset></form>
          {access.managers.length ? <ul className="plain-list">{access.managers.map((manager) => <li key={manager.id}>
            <Group justify="space-between" gap="xs" wrap="wrap"><Text style={{ overflowWrap: 'anywhere' }}>{manager.email}</Text>
              <Button size="compact-sm" variant="subtle" color="red" disabled={busy} aria-label={`Retirer l’accès à ${manager.email}`}
                onClick={() => { if (window.confirm(`Retirer l’accès de ${manager.email} à ce tournoi ?`)) void change('DELETE', manager.email); }}>Retirer l’accès</Button>
            </Group>
          </li>)}</ul> : <Text fz="sm" c="dimmed">Aucun autre gestionnaire pour le moment.</Text>}
          <Group><Button variant="light" size="sm" onClick={() => void copyDashboard()}>Copier le lien de l’espace organisateur</Button></Group>
        </Stack>}
  </Card>;
}
