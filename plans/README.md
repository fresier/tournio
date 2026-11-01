# Réalisation Tournio

Architecture active : **Next.js fullstack, PostgreSQL privé, Prisma 7 et Better Auth**. Le temps réel du prototype utilise PostgreSQL LISTEN/NOTIFY et SSE. Le cahier des charges métier reste [TOURNIO_SPEC.md](../TOURNIO_SPEC.md).

| Plan | État |
| --- | --- |
| [003 — PostgreSQL privé, Prisma et Better Auth](003-postgres-prisma-better-auth.md) | DONE — MVP réalisé et vérifié (lots A à H) ; essai sur vrai téléphone et mesure sur la production conseillés |

## Lots

| Lot | Contenu | État |
| --- | --- | --- |
| A | Architecture Prisma/Better Auth, prototype SSE | DONE sur PostgreSQL isolé et privé |
| B | Modèle, contraintes, migrations et fixtures 12/3/3 | DONE — modèle privé et fixtures en tests isolés |
| C | Connexion, dashboard et configuration avec isolation des organisateurs | DONE pour le code et les tests HTTP ; revue visuelle restante |
| Connexion privée | Migrations sur DATABASE_URL fournie | DONE — TLS require actif, tests HTTP et SSE réussis |
| Google | Connexion Google avant le calendrier | DONE — tests automatisés réussis ; connexion réelle sur localhost confirmée par l’utilisateur |
| D | Moteur round-robin, planification, classements et états | DONE — domaine pur `src/lib/domain/`, tests unitaires ; branchement en base et UI au lot E |
| E | Prévisualisation, commit et publication | DONE — section Calendrier du dashboard, API `/schedule`, tests unitaires et d’intégration ; revue visuelle restante |
| F | Pages publiques de tournoi/équipe et QR codes | DONE — `/t/[slug]`, pages équipe, API et SSE publics, onglet Partage (liens + QR) ; revue visuelle mobile restante |
| G | Résultats métier et actualisation publique | DONE — onglet Résultats, API `/matches/:matchId`, version par match, fin de tournoi ; revue visuelle restante |
| H | E2E navigateur, accessibilité visuelle, capacité et production | DONE — `test:e2e` (Chromium + WebKit iPhone, clavier, fuseau, stockage bloqué, réseau coupé, axe-core), `test:capacity` (1000 spectateurs), en-têtes de sécurité, `/api/health`, [déploiement](../docs/deploiement.md) |

Le [compte rendu courant](../docs/verification-prisma.md) précise les vérifications réalisées et leurs limites.

Statuts : TODO, IN PROGRESS, DONE, BLOCKED avec motif. Un test sur la base isolée ne vaut pas validation de la connexion privée ni livraison du MVP complet.
