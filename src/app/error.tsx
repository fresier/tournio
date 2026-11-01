'use client';

export default function ApplicationError() {
  return <main className="login-shell"><section className="panel"><h1>Connexion indisponible</h1><p>Impossible de charger votre espace. Vérifiez la connexion PostgreSQL et réessayez.</p><button type="button" onClick={() => window.location.reload()}>Réessayer</button></section></main>;
}
