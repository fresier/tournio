'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { matchSchema, type DemoMatch } from '@/lib/contracts';

type Connection = 'connecting' | 'live' | 'fallback';

export function RealtimeDemo({ initialMatch, initialError }: { initialMatch: DemoMatch | null; initialError: string }) {
  const [match, setMatch] = useState(initialMatch);
  const [email, setEmail] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [events, setEvents] = useState(0);
  const [message, setMessage] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const live = useRef(false);
  const matchId = match?.id;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth', { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setEmail(data.user?.email ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let disposed = false;
    let refreshing = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (refreshing || disposed || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const response = await fetch(`/api/demo?id=${matchId}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        const parsed = matchSchema.safeParse(data.matches?.[0]);
        if (!disposed && parsed.success) {
          setMatch((current) => current?.id === parsed.data.id && parsed.data.version >= current.version ? parsed.data : current);
        }
      } catch { /* L’état de connexion est fourni par l’abonnement. */ }
      finally { refreshing = false; }
    };
    const source = new EventSource(`/api/demo/${matchId}/events`);
    source.addEventListener('ready', () => {
      if (disposed) return;
      live.current = true; setConnection('live'); void refresh();
    });
    source.addEventListener('match.updated', (event) => {
      if (disposed) return;
      try {
        const parsed = matchSchema.safeParse(JSON.parse(event.data).match);
        if (!parsed.success) return;
        setMatch((current) => current?.id === parsed.data.id && parsed.data.version >= current.version ? parsed.data : current);
        setEvents((count) => count + 1);
      } catch { /* Les données serveur restent l’autorité. */ }
    });
    const fallback = () => { if (!disposed) { live.current = false; setConnection('fallback'); } };
    source.onerror = fallback;
    source.addEventListener('retry', fallback);
    source.addEventListener('unavailable', fallback);
    source.addEventListener('removed', () => { if (!disposed) { setMatch(null); setMessage('Ce match n’est plus public.'); } });
    const interval = window.setInterval(() => { if (!live.current) void refresh(); }, 15000);
    const onResume = () => { void refresh(); };
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
      source.close();
    };
  }, [matchId]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmail(data.user.email);
      setMessage('Connexion établie. Vous pouvez modifier votre match de démonstration.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }

  async function createMatch() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/demo', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = matchSchema.parse(data.match);
      setMatch(next); setEvents(0); setConnection('connecting'); live.current = false;
      window.history.replaceState(null, '', `/?match=${next.id}`);
      setMessage('Match créé. Ouvrez la vue publique dans un second onglet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }

  async function saveScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/demo/${match.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_score: Number(form.get('home_score')), away_score: Number(form.get('away_score')), expected_version: match.version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = matchSchema.parse(data.match);
      setMatch((current) => current?.id === next.id && next.version >= current.version ? next : current);
      setMessage('Score enregistré. Vérifiez sa réception dans l’autre onglet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('Déconnexion impossible.');
      setEmail(null); setMessage('Déconnexion effectuée.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Déconnexion impossible.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="shell">
      <header className="masthead"><Link href="/" className="brand">tournio<span>.</span></Link><Link href="/dashboard">Mes tournois</Link></header>
      <div className="intro"><h1>Le match, en direct.</h1><p>Un score saisi ici, reçu dans l’autre onglet. Ce premier essai vérifie la connexion de Tournio au serveur temps réel.</p></div>
      <div className="workspace">
        <section className="scoreboard" aria-labelledby="match-title">
          <div className="board-top"><h2 id="match-title">Match de démonstration</h2><span className={`connection ${connection}`} role="status">{!match ? 'En attente d’un match' : connection === 'live' ? 'Temps réel connecté' : connection === 'connecting' ? 'Connexion en cours…' : 'Reconnexion · repli toutes les 15 s'}</span></div>
          {match ? <>
            <div className="teams" aria-live="polite" aria-atomic="true"><div><h3>{match.home_team}</h3><strong aria-label={`${match.home_score} points`}>{match.home_score}</strong></div><span className="separator">:</span><div><h3>{match.away_team}</h3><strong aria-label={`${match.away_score} points`}>{match.away_score}</strong></div></div>
            <div className="board-bottom"><span aria-live="polite">{events} événement{events !== 1 ? 's' : ''} reçu{events !== 1 ? 's' : ''} dans cet onglet</span><span>Version {match.version}</span></div>
            <a className="public-link" href={`/?match=${match.id}`} target="_blank" rel="noopener noreferrer">Ouvrir la vue dans un second onglet</a>
          </> : <div className="empty"><p>Aucun match chargé.</p><p>Connectez-vous pour créer un match de démonstration.</p></div>}
        </section>
        <section className="editor" aria-labelledby="editor-title">
          <h2 id="editor-title">Côté organisateur</h2>
          {email ? <>
            <p className="account">Connecté : {email}</p>
            {match && <form key={`${match.id}:${match.version}`} onSubmit={saveScore}>
              <div className="score-fields"><label>{match.home_team}<input name="home_score" type="number" min="0" max="999" step="1" defaultValue={match.home_score} required /></label><label>{match.away_team}<input name="away_score" type="number" min="0" max="999" step="1" defaultValue={match.away_score} required /></label></div>
              <button type="submit" disabled={busy}>Enregistrer le score</button>
            </form>}
            <button className="secondary" onClick={createMatch} disabled={busy}>Créer mon match de test</button>
            <button className="text-button" onClick={logout} disabled={busy}>Se déconnecter</button>
            <p className="hint">La modification est réservée au propriétaire du match. Créez le vôtre si celui affiché appartient à un autre compte.</p>
          </> : <>
            <p>La consultation reste publique. Connectez-vous au compte local pour modifier son score.</p>
            <form onSubmit={authenticate}><label>Adresse e-mail<input name="email" type="email" autoComplete="username" placeholder="organisateur@tournio.test" required /></label><label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label><button type="submit" disabled={busy}>Se connecter</button></form>
            <p className="hint">Les identifiants générés pour cet essai sont dans le fichier local <code>.env.local</code>.</p>
          </>}
        </section>
      </div>
      <p className="feedback" role="status">{message}</p>
      <footer>Démonstration du suivi de score en direct. Préparez vos tournois dans l’espace organisateur.</footer>
    </main>
  );
}
