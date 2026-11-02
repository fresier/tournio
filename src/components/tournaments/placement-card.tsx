'use client';
import { Alert, Badge, Button, Card, Group, List, ListItem, Progress, Stack, Text, Title } from '@mantine/core';
import { placementState } from '@/lib/tournaments/placement';
import type { TournamentConfiguration } from '@/lib/tournaments/contracts';
import { FORMAT_INFO } from './format-section';

const ordinal = (place: number) => place === 1 ? '1er' : `${place}e`;

/**
 * Guide de la phase de classement dans la section Résultats : où en est-on, que faut-il faire ensuite.
 * Les tours sont lancés par l’organisateur ; le serveur revérifie chaque condition.
 */
export function PlacementCard({ data, busy, onCommand, onShowRules }: {
  data: TournamentConfiguration; busy: boolean;
  onCommand: (operation: 'generate_final_round' | 'cancel_final_round', confirm: string, success: string) => void;
  onShowRules: () => void;
}) {
  const state = placementState(data);
  const names = new Map(data.teams.map((team) => [team.id, team.name]));
  const status = data.tournament.status;
  if (state.format === 'none') {
    if (status !== 'PUBLISHED') return null;
    return <Card><Group justify="space-between" gap="sm">
      <Stack gap={2}><Title order={2} fz="lg">Après les poules</Title><Text fz="sm" c="dimmed">Format choisi : poules uniquement. Le tournoi se termine sur les classements de poule.</Text></Stack>
      <Button variant="subtle" size="sm" onClick={onShowRules}>Choisir une phase de classement</Button>
    </Group></Card>;
  }

  const info = FORMAT_INFO[state.format];
  const nextRound = state.round + 1;
  const canGenerate = !state.problems.length && !state.waiting.length && status === 'PUBLISHED';
  const lastRoundUntouched = state.round > 0 && data.matches.filter((match) => match.phase === 'FINAL' && match.final_round === state.round).every((match) => match.status === 'SCHEDULED' || match.status === 'POSTPONED');

  return <Card>
    <Group justify="space-between" mb={4}><Title order={2} fz="lg">Phase de classement</Title><Badge color="ink">{info.title}</Badge></Group>
    <Text fz="sm" c="dimmed" mb="sm">{info.summary} {state.totalRounds} tour{state.totalRounds > 1 ? 's' : ''}, chaque équipe joue {state.totalRounds} match{state.totalRounds > 1 ? 's' : ''} de plus.</Text>
    <Progress value={state.finished ? 100 : (state.round - (state.waiting.length && state.round ? 0.5 : 0)) / state.totalRounds * 100} size="sm" radius="xl" mb="sm" color={state.finished ? 'teal' : 'ink'} aria-hidden="true" />

    {state.finished && state.ranking ? <Stack gap="xs">
      <Text fw={700}>Classement final</Text>
      <List type="ordered" spacing={2}>{state.ranking.map((team, index) => <ListItem key={team}><Text span fw={index < 3 ? 800 : 500}>{ordinal(index + 1)} · {names.get(team)}</Text></ListItem>)}</List>
      <Text fz="sm" c="dimmed">Toutes les places sont jouées. Vous pouvez terminer le tournoi ci-dessous.</Text>
    </Stack> : state.problems.length ? <Alert color="orange" variant="light">Ce format ne convient plus à vos poules : {state.problems.join(' ')} Changez de format dans l’onglet Format et règles.</Alert>
      : <Stack gap="xs">
        <Text fw={700}>{state.round === 0 ? 'Étape suivante : lancer la phase de classement' : `Tour ${state.round} sur ${state.totalRounds} en cours`}</Text>
        {state.waiting.length ? <Text fz="sm" c="dimmed">En attente : {state.waiting.join(' ')}</Text>
          : <Text fz="sm" c="dimmed">{state.round === 0
            ? 'Les poules sont terminées. Le tour 1 est construit à partir du classement général, puis placé sur les terrains après le dernier match joué.'
            : `Le tour ${state.round} est terminé. Le tour ${nextRound} oppose les gagnants entre eux et les perdants entre eux.`}</Text>}
        <Group gap="sm">
          {canGenerate ? <Button loading={busy} onClick={() => onCommand('generate_final_round', `Générer le tour ${nextRound} de la phase de classement ? Les matchs seront visibles aussitôt sur les pages publiques.`, `Tour ${nextRound} généré : ses matchs sont dans la liste ci-dessous et dans le calendrier.`)}>Générer le tour {nextRound}</Button> : null}
          {state.round > 0 && lastRoundUntouched && status === 'PUBLISHED' ? <Button variant="subtle" color="red" size="sm" disabled={busy}
            onClick={() => onCommand('cancel_final_round', `Annuler le tour ${state.round} ? Ses matchs, pas encore commencés, seront supprimés.`, `Tour ${state.round} annulé.`)}>Annuler le tour {state.round}</Button> : null}
        </Group>
        {state.round > 0 ? <Text fz="xs" c="dimmed">Les horaires sont proposés juste après les matchs précédents ; déplacez un match depuis la section Calendrier si besoin.</Text> : null}
      </Stack>}
  </Card>;
}
