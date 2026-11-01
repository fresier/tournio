'use client';
import { Code, Group, Paper, Stack, Text } from '@mantine/core';
import { QrCode, useClientOrigin } from './qr-code';

export function MatchQrCode({ matchId, origin }: { matchId: string; origin?: string }) {
  const clientOrigin = useClientOrigin();
  const base = origin ?? clientOrigin;
  if (!base) return null;
  const url = `${base}/demo?match=${matchId}`;
  const loopback = /^(localhost|127\.|\[::1\])/.test(new URL(url).hostname);
  return (
    <Paper component="figure" withBorder p="md" mt="lg" mx={0} mb={0} bg="ink.0">
      <Group align="center" gap="md" wrap="nowrap">
        <QrCode url={url} />
        <Stack component="figcaption" gap={4}>
          <Text fw={700}>Scannez avec votre téléphone</Text>
          <Text fz="sm" c="dimmed">Le score s’affichera sur votre écran et se mettra à jour à chaque modification, sans recharger la page.</Text>
          {loopback && <Text fz="sm" c="orange.9">Cette adresse est locale : un téléphone ne pourra pas l’ouvrir. Utilisez le domaine public.</Text>}
          {origin && <Text fz="sm" c="orange.9">Réseau local ({new URL(origin).host}) : le téléphone doit être sur le même Wi-Fi et le serveur lancé avec <Code>npm run dev:lan</Code>.</Text>}
        </Stack>
      </Group>
    </Paper>
  );
}
