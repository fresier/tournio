'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@mantine/core';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      router.replace('/login'); router.refresh();
    } catch { setError('Déconnexion impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  return <><Button variant="subtle" size="compact-sm" px={0} onClick={logout} loading={busy}>Se déconnecter</Button>{error ? <Text role="alert" c="red.8" fz="sm">{error}</Text> : null}</>;
}
