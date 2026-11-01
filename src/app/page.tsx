import Link from 'next/link';

const steps = [
  { title: 'Préparez', text: 'Équipes, poules, terrains, disponibilités et règles de score : tout le tournoi se configure au même endroit, quel que soit le sport.' },
  { title: 'Planifiez', text: 'Les matchs de poule sont répartis sur vos terrains et vos créneaux, sans chevauchement. Vous gardez la main pour ajuster.' },
  { title: 'Suivez', text: 'Chaque score saisi met à jour les classements et s’affiche aussitôt chez les participants.' },
];

export default function HomePage() {
  return (
    <main className="shell landing">
      <header className="masthead">
        <Link href="/" className="brand">tournio<span>.</span></Link>
        <nav className="landing-nav" aria-label="Navigation principale">
          <Link href="/demo">Démo en direct</Link>
          <Link className="button-link" href="/dashboard">Espace organisateur</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Tournois sportifs amateurs</p>
          <h1>Votre tournoi.<br />Simplifié.</h1>
          <p className="hero-lead">Créez le tournoi, générez le calendrier, saisissez les scores. Les équipes suivent leurs matchs depuis leur téléphone, sans compte ni application.</p>
          <div className="hero-actions">
            <Link className="button-link" href="/dashboard">Organiser un tournoi</Link>
            <Link href="/demo">Voir un score en direct</Link>
          </div>
        </div>
        <aside className="team-card" aria-label="Exemple de page équipe">
          <span className="connection live">En direct</span>
          <p className="team-card-label">Prochain match · Les Hiboux</p>
          <div className="team-card-match"><strong>Les Hiboux</strong><span>contre</span><strong>FC Ixelles</strong></div>
          <dl>
            <div><dt>Heure</dt><dd>14 h 20</dd></div>
            <div><dt>Terrain</dt><dd>3</dd></div>
            <div><dt>Poule</dt><dd>B · 2<sup>e</sup></dd></div>
          </dl>
          <p className="team-card-last">Dernier résultat : victoire 3 – 1</p>
        </aside>
      </section>

      <section className="steps" aria-labelledby="steps-title">
        <h2 id="steps-title" className="sr-only">Comment ça marche</h2>
        <ol>
          {steps.map((step, index) => (
            <li key={step.title}><span className="step-number">{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>
          ))}
        </ol>
      </section>

      <section className="audiences">
        <div className="panel">
          <h2>Pour l’organisateur</h2>
          <ul>
            <li>Un espace privé, connexion avec Google</li>
            <li>Calendrier modifiable à la main</li>
            <li>Classements de poule calculés automatiquement</li>
          </ul>
        </div>
        <div className="panel">
          <h2>Pour les équipes</h2>
          <ul>
            <li>Un lien ou un QR code, rien à installer</li>
            <li>Prochain match, adversaire, heure et terrain</li>
            <li>Résultats mis à jour en direct</li>
          </ul>
        </div>
      </section>

      <footer className="landing-footer"><span>tournio<span>.</span></span><Link href="/login">Connexion organisateur</Link></footer>
    </main>
  );
}
