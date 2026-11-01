import { Box, Group, Text, Title } from '@mantine/core';

/** En-tête de page de l’espace organisateur : titre, texte d’aide et action principale. */
export function PageHeading({ title, description, action, badge, children }: { title: string; description?: React.ReactNode; action?: React.ReactNode; badge?: React.ReactNode; children?: React.ReactNode }) {
  return <Group component="header" justify="space-between" align="flex-start" gap="lg" mb="xl">
    <Box style={{ minWidth: 0, flex: '1 1 320px' }}>
      <Group gap="sm"><Title order={1} fz={{ base: 28, sm: 36 }} style={{ overflowWrap: 'anywhere' }}>{title}</Title>{badge}</Group>
      {description ? <Text c="dimmed" mt={8} maw="64ch">{description}</Text> : null}
      {children}
    </Box>
    {action}
  </Group>;
}
