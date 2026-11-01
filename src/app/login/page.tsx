import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { headers } from 'next/headers';
import { LoginForm } from '@/components/auth/login-form';
import { googleProvider } from '@/lib/auth-config';

export const metadata = { title: 'Connexion organisateur — Tournio' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getAuth().api.getSession({ headers: await headers() })) redirect('/dashboard');
  const { error } = await searchParams;
  const initialError = error ? error === 'access_denied' ? 'La connexion Google a été annulée. Vous pouvez réessayer.' : 'La connexion Google n’a pas abouti. Réessayez.' : '';
  return <main className="login-shell"><Link className="brand" href="/">tournio<span>.</span></Link><section className="panel login-panel"><h1>Votre espace organisateur</h1><p>Retrouvez vos tournois et préparez le prochain rendez-vous de vos équipes.</p><LoginForm googleEnabled={Boolean(googleProvider())} initialError={initialError} /></section><Link href="/">Revenir à la démonstration</Link></main>;
}
