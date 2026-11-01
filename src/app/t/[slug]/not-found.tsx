import { Card, Container, Text, Title } from '@mantine/core';
import { Brand, TextLink } from '@/components/ui/links';

export default function PublicNotFound() {
  return <Container component="main" size="sm" py="xl"><Brand size={26} />
    <Card mt="xl" p="xl"><Title order={1} fz={28} mb="xs">Tournoi introuvable</Title>
      <Text c="dimmed" mb="md">Ce lien ne correspond à aucun tournoi publié. L’organisateur ne l’a peut-être pas encore publié : réessayez plus tard ou vérifiez le lien reçu.</Text>
      <TextLink href="/">Découvrir Tournio</TextLink></Card>
  </Container>;
}
