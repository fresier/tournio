'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, Box, Button, Card, Container, Divider, Group, SimpleGrid, Stack, Text, TextInput, Title, Anchor } from '@mantine/core';
import { Brand, ButtonLink, TextLink } from '@/components/ui/links';
import { matchSchema, type DemoMatch } from '@/lib/contracts';
import { MatchQrCode } from '@/components/match-qr-code';

type Connection = 'connecting' | 'live' | 'fallback';

export function RealtimeDemo({ initialMatch, initialError, qrOrigin }: { initialMatch: DemoMatch | null; initialError: string; qrOrigin?: string }) {
  const [match, setMatch] = useState(initialMatch);
  const [email, setEmail] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [events, setEvents] = useState(0);
  const [message, setMessage] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const live = useRef(false);
  const matchId = match?.id;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth', { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setEmail(data.user?.email ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let disposed = false;
    let refreshing = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (refreshing || disposed || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const response = await fetch(`/api/demo?id=${matchId}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        const parsed = matchSchema.safeParse(data.matches?.[0]);
        if (!disposed && parsed.success) {
          setMatch((current) => current?.id === parsed.data.id && parsed.data.version >= current.version ? parsed.data : current);
        }
      } catch { /* L’état de connexion est fourni par l’abonnement. */ }
      finally { refreshing = false; }
    };
    const source = new EventSource(`/api/demo/${matchId}/events`);
    source.addEventListener('ready', () => {
      if (disposed) return;
      live.current = true; setConnection('live'); void refresh();
    });
    source.addEventListener('match.updated', (event) => {
      if (disposed) return;
      try {
        const parsed = matchSchema.safeParse(JSON.parse(event.data).match);
        if (!parsed.success) return;
        setMatch((current) => current?.id === parsed.data.id && parsed.data.version >= current.version ? parsed.data : current);
        setEvents((count) => count + 1);
      } catch { /* Les données serveur restent l’autorité. */ }
    });
    const fallback = () => { if (!disposed) { live.current = false; setConnection('fallback'); } };
    source.onerror = fallback;
    source.addEventListener('retry', fallback);
    source.addEventListener('unavailable', fallback);
    source.addEventListener('removed', () => { if (!disposed) { setMatch(null); setMessage('Ce match n’est plus public.'); } });
    const interval = window.setInterval(() => { if (!live.current) void refresh(); }, 15000);
    const onResume = () => { void refresh(); };
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
      source.close();
    };
  }, [matchId]);

  async function createMatch() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/demo', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = matchSchema.parse(data.match);
      setMatch(next); setEvents(0); setConnection('connecting'); live.current = false;
      window.history.replaceState(null, '', `/demo?match=${next.id}`);
      setMessage('Match créé. Ouvrez la vue publique dans un second onglet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }

  async function saveScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/demo/${match.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_score: Number(form.get('home_score')), away_score: Number(form.get('away_score')), expected_version: match.version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = matchSchema.parse(data.match);
      setMatch((current) => current?.id === next.id && next.version >= current.version ? next : current);
      setMessage('Score enregistré. Vérifiez sa réception dans l’autre onglet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('Déconnexion impossible.');
      setEmail(null); setMessage('Déconnexion effectuée.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Déconnexion impossible.'); }
    finally { setBusy(false); }
  }

  const badge = !match ? ['En attente d’un match', 'gray.8'] : connection === 'live' ? ['Temps réel connecté', 'teal.9'] : connection === 'connecting' ? ['Connexion en cours…', 'gray.8'] : ['Reconnexion · repli toutes les 15 s', 'orange.9'];
  return (
    <Container component="main" size="lg" px={{ base: 'md', sm: 'xl' }}>
      <Group component="header" justify="space-between" py="lg"><Brand /><TextLink href="/dashboard">Mes tournois</TextLink></Group>
      <Divider />
      <Box py="xl" maw={680}><Title order={1} fz={{ base: 34, sm: 46 }} lh={1.1} mb="sm">Le match, en direct.</Title><Text fz="lg" c="dimmed">Un score saisi ici, reçu dans l’autre onglet. Ce premier essai vérifie la connexion de Tournio au serveur temps réel.</Text></Box>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ alignItems: 'start' }}>
        <Card component="section" aria-labelledby="match-title" p="xl">
          <Stack gap="xs"><Title order={2} id="match-title" fz="lg">Match de démonstration</Title><Badge role="status" color={badge[1]} variant="light" size="lg" tt="none">{badge[0]}</Badge></Stack>
          {match ? <>
            <Group justify="center" align="center" gap="xl" py="xl" aria-live="polite" aria-atomic="true" wrap="nowrap">
              <Stack gap={0} align="center"><Text fw={700}>{match.home_team}</Text><Text fw={800} fz={{ base: 56, sm: 84 }} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={`${match.home_score} points`}>{match.home_score}</Text></Stack>
              <Text fz={36} c="dimmed" pt={24}>:</Text>
              <Stack gap={0} align="center"><Text fw={700}>{match.away_team}</Text><Text fw={800} fz={{ base: 56, sm: 84 }} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={`${match.away_score} points`}>{match.away_score}</Text></Stack>
            </Group>
            <Divider mb="sm" />
            <Group justify="space-between" fz="sm" c="dimmed"><Text fz="sm" c="dimmed" aria-live="polite">{events} événement{events !== 1 ? 's' : ''} reçu{events !== 1 ? 's' : ''} dans cet onglet</Text><Text fz="sm" c="dimmed">Version {match.version}</Text></Group>
            <Anchor href={`/demo?match=${match.id}`} target="_blank" rel="noopener noreferrer" fw={600} fz="sm" mt="md" display="inline-block">Ouvrir la vue dans un second onglet</Anchor>
            <MatchQrCode matchId={match.id} origin={qrOrigin} />
          </> : <Stack py="xl" gap={4}><Text c="dimmed">Aucun match chargé.</Text><Text c="dimmed">Connectez-vous pour créer un match de démonstration.</Text></Stack>}
        </Card>
        <Box component="section" aria-labelledby="editor-title">
          <Title order={2} id="editor-title" fz="lg" mb="sm">Côté organisateur</Title>
          {email ? <Stack>
            <Text c="dimmed">Connecté : {email}</Text>
            {match && <form key={`${match.id}:${match.version}`} onSubmit={saveScore}><Stack>
              <SimpleGrid cols={2}><TextInput label={match.home_team} name="home_score" type="number" min="0" max="999" step="1" defaultValue={match.home_score} required /><TextInput label={match.away_team} name="away_score" type="number" min="0" max="999" step="1" defaultValue={match.away_score} required /></SimpleGrid>
              <Button type="submit" disabled={busy}>Enregistrer le score</Button>
            </Stack></form>}
            <Button variant="default" onClick={createMatch} disabled={busy}>Créer mon match de test</Button>
            <Group><Button variant="subtle" onClick={logout} disabled={busy}>Se déconnecter</Button></Group>
            <Text fz="sm" c="dimmed">La modification est réservée au propriétaire du match. Créez le vôtre si celui affiché appartient à un autre compte.</Text>
          </Stack> : <Stack align="flex-start">
            <Text c="dimmed">La consultation reste publique. Connectez-vous pour créer et modifier votre match.</Text>
            <ButtonLink href="/login">Se connecter</ButtonLink>
          </Stack>}
        </Box>
      </SimpleGrid>
      <Text role="status" mih={25} my="lg" c="accent.8">{message}</Text>
      <Divider />
      <Text component="footer" fz="sm" c="dimmed" py="lg">Démonstration du suivi de score en direct. Préparez vos tournois dans l’espace organisateur.</Text>
    </Container>
  );
}
