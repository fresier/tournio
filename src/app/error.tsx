'use client';
import { Button, Card, Center, Text, Title } from '@mantine/core';

export default function ApplicationError() {
  return <Center component="main" mih="100vh" p="md"><Card maw={480} shadow="sm" p="xl">
    <Title order={1} fz={28} mb="xs">Connexion indisponible</Title>
    <Text c="dimmed" mb="lg">Impossible de charger votre espace. Vérifiez la connexion PostgreSQL et réessayez.</Text>
    <Button onClick={() => window.location.reload()}>Réessayer</Button>
  </Card></Center>;
}
