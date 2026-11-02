'use client';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { Badge, Box, Button, Card, ColorInput, ColorSwatch, FileButton, Group, List, ListItem, Paper, RadioCard, RadioGroup, RadioIndicator, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { COLOR_SWATCHES, customThemeProblem, HEX_COLOR, palette, readableShade, resolveAppearance, THEME_IDS, THEME_PRESETS, themePreset, type ThemeId } from '@/lib/appearance';
import type { TournamentConfiguration } from '@/lib/tournaments/contracts';
import { themedAppearance } from '@/lib/theme-variables';
import { exportThemeFile, importThemeFile } from '@/lib/tournaments/theme-file';

type Payload = { theme: ThemeId; primary_color: string | null; accent_color: string | null; background_color: string | null; surface_color: string | null; text_color: string | null };
type CustomColors = { background_color: string; surface_color: string; text_color: string };

/** Miniature d’un thème : fond, carte, texte et les deux couleurs. */
function ThemeThumbnail({ id }: { id: ThemeId }) {
  const preset = THEME_PRESETS[id];
  const { background } = resolveAppearance({ theme: id, primary_color: null, accent_color: null });
  return <Box aria-hidden="true" style={{ background, borderRadius: 8, padding: 8, border: '1px solid rgba(0,0,0,.08)' }}>
    <Box style={{ background: preset.primary, height: 10, borderRadius: 4, marginBottom: 6 }} />
    <Box style={{ background: preset.surface, borderRadius: 4, padding: '6px 8px' }}>
      <Group justify="space-between" gap={4} wrap="nowrap"><Box style={{ background: preset.text, height: 6, width: '55%', borderRadius: 3 }} /><Box style={{ background: preset.accent, height: 8, width: 18, borderRadius: 3 }} /></Group>
    </Box>
  </Box>;
}

/**
 * Apparence des pages publiques (et des QR codes) : un thème préconfiguré, puis la couleur principale
 * et l’accent personnalisables. Modifiable à tout moment avant l’archivage ; les spectateurs connectés
 * voient le changement en direct.
 */
export function AppearancePanel({ data, busy, feedback, onSave }: { data: TournamentConfiguration; busy: boolean; feedback: React.ReactNode; onSave: (payload: Payload) => Promise<boolean> }) {
  const t = data.tournament;
  const initialTheme = (THEME_IDS as string[]).includes(t.theme) ? t.theme as ThemeId : 'tournio';
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const preset = themePreset(theme);
  const [primary, setPrimary] = useState(t.primary_color ?? preset.primary);
  const [accent, setAccent] = useState(t.accent_color ?? preset.accent);
  const [custom, setCustom] = useState<CustomColors | null>(t.background_color && t.surface_color && t.text_color ? { background_color: t.background_color, surface_color: t.surface_color, text_color: t.text_color } : null);
  const [fileMessage, setFileMessage] = useState<{ text: string; error: boolean } | null>(null);
  const resetFile = useRef<() => void>(null);
  const colorValid = HEX_COLOR.test(primary.toLowerCase()) && HEX_COLOR.test(accent.toLowerCase());
  const current = { theme, primary_color: primary.toLowerCase(), accent_color: accent.toLowerCase(), ...custom };
  const problem = colorValid ? customThemeProblem(current) : null;
  const valid = colorValid && !problem;
  const appearance = themedAppearance(colorValid ? current : { theme, primary_color: null, accent_color: null });
  const adjusted = valid && readableShade(palette(primary.toLowerCase())) !== 6;
  const archived = t.status === 'ARCHIVED';
  // Une couleur identique à celle du thème est enregistrée comme « celle du thème » (null).
  const toPayload = (value: string, fallback: string) => value.toLowerCase() === fallback ? null : value.toLowerCase();
  const chooseTheme = (value: string) => {
    const next = value as ThemeId;
    setTheme(next); setPrimary(THEME_PRESETS[next].primary); setAccent(THEME_PRESETS[next].accent); setCustom(null); setFileMessage(null);
  };
  function exportFile() {
    const content = JSON.stringify(exportThemeFile(current), null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `theme-${t.slug}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function importFile(file: File | null) {
    if (!file) return;
    setFileMessage(null);
    try {
      if (file.size > 64 * 1024) throw new Error('Le fichier dépasse 64 Ko.');
      const value: unknown = JSON.parse(await file.text());
      const parsed = importThemeFile(value);
      setTheme(parsed.theme); setPrimary(parsed.primary_color!); setAccent(parsed.accent_color!);
      setCustom({ background_color: parsed.background_color!, surface_color: parsed.surface_color!, text_color: parsed.text_color! });
      setFileMessage({ text: 'Thème importé dans l’aperçu. Enregistrez l’apparence pour l’appliquer au tournoi.', error: false });
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(' ') : error instanceof SyntaxError ? 'Le fichier ne contient pas de JSON valide.' : error instanceof Error ? error.message : 'Impossible de lire le fichier.';
      setFileMessage({ text: message, error: true });
    } finally { resetFile.current?.(); }
  }
  const colorInput = (label: string, description: string, value: string, onChange: (value: string) => void) =>
    <ColorInput label={label} description={description} value={value} onChange={onChange} format="hex" eyeDropperButtonProps={{ 'aria-label': 'Prélever une couleur à l’écran' }}
      swatches={COLOR_SWATCHES} swatchesPerRow={10} disabled={archived || busy} error={HEX_COLOR.test(value.toLowerCase()) ? undefined : 'Format #rrggbb attendu.'} />;

  return <Card>
    <Title order={2} fz="xl">Apparence du tournoi</Title>
    <Text fz="sm" c="dimmed" mb="md">Appliquée au tableau de bord du tournoi, aux pages publiques, à l’écran TV et aux QR codes. Modifiable à tout moment avant l’archivage : les spectateurs voient le changement en direct.</Text>

    <Box mb="lg">
      <Title order={3} fz="md" mb="xs">Éléments personnalisables</Title>
      <List size="sm" spacing="xs">
        <ListItem><Text span fw={700}>Thème :</Text> fond, cartes, texte et couleurs de départ. Le fichier JSON permet aussi de modifier le fond, les cartes et le texte.</ListItem>
        <ListItem><Text span fw={700}>Couleur principale :</Text> bandeau, boutons, liens et équipe suivie.</ListItem>
        <ListItem><Text span fw={700}>Couleur d’accent :</Text> scores, titres de l’écran TV et détails de la marque.</ListItem>
      </List>
    </Box>

    <Box mb="lg">
      <Title order={3} fz="md" mb="xs">Créer ou partager un thème</Title>
      <Text fz="sm" c="dimmed" mb="sm">Exportez le thème affiché, modifiez les couleurs dans le fichier JSON, puis importez-le pour vérifier l’aperçu avant de l’enregistrer.</Text>
      <Group gap="sm">
        <Button variant="light" size="sm" disabled={!valid} onClick={exportFile}>Exporter le thème JSON</Button>
        <FileButton onChange={(file) => void importFile(file)} accept="application/json,.json" resetRef={resetFile} disabled={archived || busy}>
          {(props) => <Button {...props} variant="default" size="sm" disabled={archived || busy}>Importer un thème JSON</Button>}
        </FileButton>
      </Group>
      {fileMessage ? <Text mt="xs" fz="sm" c={fileMessage.error ? 'red.8' : 'dimmed'} role={fileMessage.error ? 'alert' : 'status'}>{fileMessage.text}</Text> : null}
    </Box>

    <RadioGroup value={theme} onChange={chooseTheme} label="Thème" description="Fond, cartes, texte et couleurs de départ. Les thèmes sombres conviennent aux écrans affichés en salle." mb="xl">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} mt="sm">
        {THEME_IDS.map((id) => <RadioCard key={id} value={id} radius="md" p="sm" disabled={archived || busy} className="theme-card">
          <Stack gap={8}>
            <ThemeThumbnail id={id} />
            <Group gap={8} wrap="nowrap" align="flex-start"><RadioIndicator size="sm" mt={2} /><Box><Text fw={700} fz="sm">{THEME_PRESETS[id].label}</Text><Text fz="xs" c="dimmed">{THEME_PRESETS[id].description}</Text></Box></Group>
          </Stack>
        </RadioCard>)}
      </SimpleGrid>
    </RadioGroup>

    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
      <Stack>
        {colorInput('Couleur principale', 'Bandeau, boutons, liens et équipe suivie', primary, setPrimary)}
        {colorInput('Couleur d’accent', 'Scores, titres de la TV et détails de la marque', accent, setAccent)}
        <Group gap="xs"><Text fz="sm" c="dimmed">Couleurs du thème :</Text>
          <Button variant="subtle" size="compact-sm" disabled={archived || busy} onClick={() => { setPrimary(preset.primary); setAccent(preset.accent); setCustom(null); setFileMessage(null); }}
            leftSection={<Group gap={2}><ColorSwatch color={preset.primary} size={14} /><ColorSwatch color={preset.accent} size={14} /></Group>}>Rétablir</Button>
        </Group>
        {custom ? <Text fz="sm" c="dimmed">Fond, cartes et texte personnalisés par le fichier JSON.</Text> : null}
        {problem ? <Text fz="sm" c="red.8" role="alert">{problem}</Text> : null}
        {adjusted ? <Text fz="sm" c="dimmed">Couleur principale claire : le bandeau la reprend telle quelle, les boutons utilisent une nuance plus foncée.</Text> : null}
        {feedback}
        <Group>
          <Button disabled={!valid || archived} loading={busy} onClick={() => void onSave({ theme, primary_color: toPayload(primary, preset.primary), accent_color: toPayload(accent, preset.accent), background_color: custom?.background_color ?? null, surface_color: custom?.surface_color ?? null, text_color: custom?.text_color ?? null })}>Enregistrer l’apparence</Button>
        </Group>
        {archived ? <Text fz="sm" c="dimmed">Tournoi archivé : l’apparence n’est plus modifiable.</Text> : null}
      </Stack>

      <Box>
        <Text fz="sm" fw={600} mb={6}>Aperçu de la page publique</Text>
        <Box data-mantine-color-scheme={appearance.scheme} style={{ ...appearance.vars, background: appearance.background, color: appearance.text, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--mantine-color-default-border)' }} aria-label="Aperçu de l’apparence" role="group">
          <Box className="public-banner" px="md" py="sm"><Text className="brand" fz={20} component="span">tournio<span>.</span></Text></Box>
          <Stack p="md" gap="sm">
            <Title order={3} fz="lg">{t.name}</Title>
            <Text fz="sm" c="dimmed">{t.sport}{t.location ? ` · ${t.location}` : ''}</Text>
            <Group gap="xs"><Badge>En direct</Badge><Badge color="ink" variant="outline">Poule A</Badge></Group>
            <Paper withBorder p="sm"><Group justify="space-between"><Text fw={700} fz="sm">Les Renards – Les Lions</Text><Text fw={800} c="var(--tournio-accent)">3 – 1</Text></Group></Paper>
            <Group><Button size="sm">Suivre cette équipe</Button><Text c="var(--mantine-color-anchor)" fz="sm" td="underline">Tout le tournoi</Text></Group>
          </Stack>
        </Box>
      </Box>
    </SimpleGrid>
  </Card>;
}
