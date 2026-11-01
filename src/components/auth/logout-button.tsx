'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  return <><button type="button" className="text-button" onClick={logout} disabled={busy}>Se déconnecter</button>{error ? <p role="alert" className="form-error">{error}</p> : null}</>;
}
