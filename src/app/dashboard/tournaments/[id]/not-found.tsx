import { Card, Text, Title } from '@mantine/core';
import { TextLink } from '@/components/ui/links';

export default function TournamentNotFound() {
  return <Card p="xl"><Title order={1} fz={28} mb="xs">Tournoi introuvable</Title>
    <Text c="dimmed" mb="md">Ce tournoi n’existe pas ou n’est pas accessible depuis votre compte.</Text>
    <TextLink href="/dashboard">Revenir à mes tournois</TextLink></Card>;
}
