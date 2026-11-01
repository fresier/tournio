'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Field } from '@/components/forms/field';
import { authClient } from '@/lib/auth-client';

export function LoginForm({ googleEnabled, initialError = '' }: { googleEnabled: boolean; initialError?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState(initialError);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy('email'); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? 'Connexion indisponible.'); }
      router.replace('/dashboard'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Connexion impossible.'); }
    finally { setBusy(null); }
  }

  async function loginWithGoogle() {
    setBusy('google'); setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard', errorCallbackURL: '/login' });
      if (result.error || !result.data?.url) throw new Error('GOOGLE_SIGN_IN_FAILED');
    } catch {
      setError('Impossible de démarrer la connexion Google. Réessayez.');
      setBusy(null);
    }
  }

  return <div className="login-methods">
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <button className="google-button" type="button" disabled={!googleEnabled || busy !== null} aria-describedby={!googleEnabled ? 'google-unavailable' : undefined} onClick={loginWithGoogle}>
      <Image src="/brand/google-g.png" width={200} height={204} alt="" unoptimized />
      <span>{busy === 'google' ? 'Redirection vers Google…' : 'Continuer avec Google'}</span>
    </button>
    {!googleEnabled ? <p id="google-unavailable" className="auth-status">La connexion Google n’est pas encore disponible.</p> : null}
    <div className="auth-divider" aria-hidden="true"><span>ou par e-mail</span></div>
    <form onSubmit={login}>
      <Field name="email" label="Adresse e-mail" type="email" autoComplete="username" required />
      <Field name="password" label="Mot de passe" type="password" autoComplete="current-password" required />
      <button disabled={busy !== null} type="submit">{busy === 'email' ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  </div>;
}
