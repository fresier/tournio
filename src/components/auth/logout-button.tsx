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
  return <><Button className="dashboard-logout" variant="subtle" size="compact-sm" px={0} onClick={logout} loading={busy} aria-label="Se déconnecter" title="Se déconnecter">
    <svg className="dashboard-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4H5v16h5m4-4 4-4-4-4m4 4H9" /></svg>
    <span className="dashboard-logout-label">Se déconnecter</span>
  </Button>{error ? <Text role="alert" c="red.8" fz="sm">{error}</Text> : null}</>;
}
