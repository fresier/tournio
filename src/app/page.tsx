import { Badge, Box, Card, Container, Divider, Group, List, ListItem, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Brand, ButtonLink, TextLink } from '@/components/ui/links';

const steps = [
  { title: 'Préparez', text: 'Équipes, poules, terrains, disponibilités et règles de score : tout le tournoi se configure au même endroit, quel que soit le sport.' },
  { title: 'Planifiez', text: 'Les matchs de poule sont répartis sur vos terrains et vos créneaux, sans chevauchement. Vous gardez la main pour ajuster.' },
  { title: 'Suivez', text: 'Chaque score saisi met à jour les classements et s’affiche aussitôt chez les participants.' },
];

export default function HomePage() {
  return (
    <Container size="lg" px={{ base: 'md', sm: 'xl' }}>
      <Group component="header" justify="space-between" py="lg" wrap="nowrap">
        <Brand />
        <Group component="nav" aria-label="Navigation principale" gap="md" wrap="nowrap">
          <TextLink href="/demo" visibleFrom="xs">Démo en direct</TextLink>
          <ButtonLink href="/dashboard" size="sm">Espace organisateur</ButtonLink>
        </Group>
      </Group>
      <Divider />

      <SimpleGrid component="section" cols={{ base: 1, md: 2 }} spacing={48} py={{ base: 40, md: 72 }} style={{ alignItems: 'center' }}>
        <Stack gap="lg">
          <Text tt="uppercase" fw={700} fz="sm" c="accent.7" lts={1}>Tournois sportifs amateurs</Text>
          <Title order={1} fz={{ base: 40, md: 56 }} lh={1.05}>Votre tournoi.<br />Simplifié.</Title>
          <Text fz="lg" c="dimmed" maw={520}>Créez le tournoi, générez le calendrier, saisissez les scores. Les équipes suivent leurs matchs depuis leur téléphone, sans compte ni application.</Text>
          <Group gap="lg">
            <ButtonLink href="/dashboard" size="lg">Organiser un tournoi</ButtonLink>
            <TextLink href="/demo" fw={600}>Voir un score en direct</TextLink>
          </Group>
        </Stack>
        <Card component="aside" aria-label="Exemple de page équipe" shadow="md" maw={420} w="100%" mx={{ base: 0, md: 'auto' }}>
          <Badge color="teal" mb="md">En direct</Badge>
          <Text fz="sm" c="dimmed" fw={600}>Prochain match · Les Hiboux</Text>
          <Group gap="xs" my="sm" align="baseline"><Text fw={800} fz={26}>Les Hiboux</Text><Text c="dimmed">contre</Text><Text fw={800} fz={26}>FC Ixelles</Text></Group>
          <SimpleGrid cols={3} component="dl" my="md">
            {[['Heure', '14 h 20'], ['Terrain', '3'], ['Poule', 'B · 2e']].map(([term, value]) => <Box key={term}><Text component="dt" fz="xs" c="dimmed" tt="uppercase" fw={700}>{term}</Text><Text component="dd" m={0} fw={700} fz="lg">{value}</Text></Box>)}
          </SimpleGrid>
          <Divider mb="sm" />
          <Text fz="sm" c="dimmed">Dernier résultat : victoire 3 – 1</Text>
        </Card>
      </SimpleGrid>

      <Box component="section" aria-labelledby="steps-title" pb={56}>
        <Title order={2} id="steps-title" className="sr-only">Comment ça marche</Title>
        <SimpleGrid component="ol" cols={{ base: 1, sm: 3 }} spacing="lg" p={0} m={0} style={{ listStyle: 'none' }}>
          {steps.map((step, index) => <Card component="li" key={step.title}>
            <ThemeIcon size={36} radius="xl" color="accent.7" mb="sm" aria-hidden="true">{index + 1}</ThemeIcon>
            <Title order={3} fz="xl" mb={6}>{step.title}</Title>
            <Text c="dimmed">{step.text}</Text>
          </Card>)}
        </SimpleGrid>
      </Box>

      <SimpleGrid component="section" cols={{ base: 1, sm: 2 }} spacing="lg" pb={56}>
        {[
          ['Pour l’organisateur', ['Un espace privé, connexion avec Google', 'Calendrier modifiable à la main', 'Classements de poule calculés automatiquement']],
          ['Pour les équipes', ['Un lien ou un QR code, rien à installer', 'Prochain match, adversaire, heure et terrain', 'Résultats mis à jour en direct']],
        ].map(([title, items]) => <Card key={title as string} bg="ink.0">
          <Title order={2} fz="xl" mb="sm">{title}</Title>
          <List spacing={6}>{(items as string[]).map((item) => <ListItem key={item}>{item}</ListItem>)}</List>
        </Card>)}
      </SimpleGrid>

      <Divider />
      <Group component="footer" justify="space-between" py="lg">
        <Brand size={22} />
        <TextLink href="/login" fz="sm">Connexion organisateur</TextLink>
      </Group>
    </Container>
  );
}
