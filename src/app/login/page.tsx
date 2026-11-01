import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Card, Center, Stack, Text, Title } from '@mantine/core';
import { getAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';
import { googleProvider } from '@/lib/auth-config';
import { Brand, TextLink } from '@/components/ui/links';

export const metadata = { title: 'Connexion organisateur — Tournio' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getAuth().api.getSession({ headers: await headers() })) redirect('/dashboard');
  const { error } = await searchParams;
  const initialError = error ? error === 'access_denied' ? 'La connexion Google a été annulée. Vous pouvez réessayer.' : 'La connexion Google n’a pas abouti. Réessayez.' : '';
  return <Center component="main" mih="100vh" p="md">
    <Stack align="center" gap="xl" w="100%" maw={440}>
      <Brand />
      <Card w="100%" shadow="sm" p="xl">
        <Title order={1} fz={28} mb="xs">Votre espace organisateur</Title>
        <Text c="dimmed" mb="lg">Retrouvez vos tournois et préparez le prochain rendez-vous de vos équipes.</Text>
        <LoginForm googleEnabled={Boolean(googleProvider())} initialError={initialError} />
      </Card>
      <TextLink href="/">Revenir à l’accueil</TextLink>
    </Stack>
  </Center>;
}
