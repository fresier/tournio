'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { authClient } from '@/lib/auth-client';

export function LoginForm({ googleEnabled, initialError = '' }: { googleEnabled: boolean; initialError?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  async function loginWithGoogle() {
    setBusy(true); setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard', errorCallbackURL: '/login' });
      if (result.error || !result.data?.url) throw new Error('GOOGLE_SIGN_IN_FAILED');
    } catch {
      setError('Impossible de démarrer la connexion Google. Réessayez.');
      setBusy(false);
    }
  }

  return <Stack gap="sm">
    {error ? <Alert color="red" variant="light" role="alert">{error}</Alert> : null}
    <Button variant="default" size="lg" fullWidth disabled={!googleEnabled} loading={busy} loaderProps={{ type: 'dots' }}
      aria-describedby={!googleEnabled ? 'google-unavailable' : undefined} onClick={loginWithGoogle}
      leftSection={<Image src="/brand/google-g.png" width={20} height={20} alt="" unoptimized />}>
      Continuer avec Google
    </Button>
    {!googleEnabled ? <Text id="google-unavailable" fz="sm" c="dimmed">La connexion Google n’est pas encore disponible.</Text> : null}
  </Stack>;
}
