'use client';
import { useState } from 'react';
import { Alert, Anchor, Button, Card, Code, Group, Stack, Text, Title } from '@mantine/core';
import { QrCode, useClientOrigin } from '@/components/qr-code';
import { DEFAULT_PRIMARY, palette, readableShade } from '@/lib/appearance';
import type { TournamentConfiguration } from '@/lib/tournaments/contracts';

export function SharePanel({ data, origin }: { data: TournamentConfiguration; origin?: string }) {
  const clientOrigin = useClientOrigin();
  const [copied, setCopied] = useState('');
  const t = data.tournament;
  const base = origin ?? clientOrigin;
  if (t.status === 'DRAFT') return <Card><Title order={2} fz="xl" mb="xs">Partage</Title><Text c="dimmed">Le lien public et les QR codes seront disponibles après la publication du tournoi (section Calendrier). Un brouillon reste invisible.</Text></Card>;
  if (!base) return null;
  const tournamentUrl = `${base}/t/${t.slug}`;
  // QR code à la couleur du tournoi, dans une nuance assez foncée pour rester lisible par les téléphones.
  const shades = palette(t.primary_color ?? DEFAULT_PRIMARY);
  const qrColor = shades[Math.max(readableShade(shades), 7)];
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); }
    catch { setCopied(''); window.prompt('Copiez ce lien :', url); }
  };
  const loopback = /^(localhost|127\.|\[::1\])/.test(new URL(base).hostname);

  return <Stack>
    <Card>
      <Title order={2} fz="xl">Page publique du tournoi</Title>
      <Text fz="sm" c="dimmed" mb="md">Sans compte et en lecture seule : calendrier, terrains, résultats et classements, mis à jour en direct.</Text>
      {loopback ? <Alert color="orange" variant="light" mb="md">Adresse locale : un téléphone ne pourra pas l’ouvrir. Utilisez le domaine public ou <Code>npm run dev:lan</Code>.</Alert> : null}
      <Group align="center" gap="xl">
        <QrCode url={tournamentUrl} size={168} color={qrColor} />
        <Stack gap="sm" style={{ minWidth: 0, flex: '1 1 240px' }}>
          <Anchor href={tournamentUrl} target="_blank" rel="noopener noreferrer" fw={600} style={{ overflowWrap: 'anywhere' }}>{tournamentUrl}</Anchor>
          <Group><Button variant="light" size="sm" onClick={() => void copy(tournamentUrl)}>{copied === tournamentUrl ? 'Lien copié' : 'Copier le lien'}</Button></Group>
        </Stack>
      </Group>
    </Card>
    <Card>
      <Title order={2} fz="xl">Écran TV</Title>
      <Text fz="sm" c="dimmed" mb="md">Pour une télévision ou un projecteur dans la salle (format 16:9, 1920×1080) : terrains, prochains matchs, classements et derniers résultats, en direct et sans défilement. Ouvrez le lien sur l’ordinateur relié à l’écran, puis passez en plein écran.</Text>
      <Group gap="sm">
        <Button component="a" href={`${tournamentUrl}/tv`} target="_blank" rel="noopener noreferrer">Ouvrir l’écran TV</Button>
        <Button variant="subtle" size="sm" onClick={() => void copy(`${tournamentUrl}/tv`)}>{copied === `${tournamentUrl}/tv` ? 'Lien copié' : 'Copier le lien'}</Button>
      </Group>
    </Card>
  </Stack>;
}
