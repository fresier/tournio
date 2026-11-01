# Réalisation Tournio

Architecture active : **Next.js fullstack, PostgreSQL privé, Prisma 7 et Better Auth**. Le temps réel du prototype utilise PostgreSQL LISTEN/NOTIFY et SSE. Le cahier des charges métier reste [TOURNIO_SPEC.md](../TOURNIO_SPEC.md).

| Plan | État |
| --- | --- |
| [003 — PostgreSQL privé, Prisma et Better Auth](003-postgres-prisma-better-auth.md) | IN PROGRESS — migration privée et socle organisateur validés ; fonctionnalités MVP suivantes à réaliser |

## Lots

| Lot | Contenu | État |
| --- | --- | --- |
| A | Architecture Prisma/Better Auth, prototype SSE | DONE sur PostgreSQL isolé et privé |
| B | Modèle, contraintes, migrations et seed 12/3/3 | DONE sur PostgreSQL isolé et privé |
| C | Connexion, dashboard et configuration avec isolation des organisateurs | DONE pour le code et les tests HTTP ; revue visuelle restante |
| Connexion privée | Migration et seed sur DATABASE_URL fournie | DONE — TLS require actif, tests HTTP et SSE réussis |
| Google | Connexion Google avant le calendrier | DONE — tests automatisés réussis ; connexion réelle sur localhost confirmée par l’utilisateur |
| D | Moteur round-robin, planification, classements et états | TODO |
| E | Prévisualisation, commit et publication | TODO |
| F | Pages publiques de tournoi/équipe et QR codes | TODO |
| G | Résultats métier et actualisation publique | TODO |
| H | E2E navigateur, accessibilité visuelle, capacité et production | TODO |

Le [compte rendu courant](../docs/verification-prisma.md) précise les vérifications réalisées et leurs limites.

Statuts : TODO, IN PROGRESS, DONE, BLOCKED avec motif. Un test sur la base isolée ne vaut pas validation de la connexion privée ni livraison du MVP complet.
