# Déploiement et exploitation

Cible retenue : **Coolify** (build Nixpacks), une instance Node.js et un PostgreSQL privé. Domaine de production : `https://tourn.rfonline.be`.

## Configuration Coolify

| Réglage | Valeur |
| --- | --- |
| Build pack | Nixpacks, `NIXPACKS_NODE_VERSION=24` |
| Commande de démarrage | `npx next start --hostname 0.0.0.0 --port 3000` (jamais `127.0.0.1` : Bad Gateway) |
| Port exposé | `3000` |
| Pre-deployment command | `npm run db:migrate` (applique uniquement les migrations versionnées) |
| Healthcheck | chemin `/api/health`, port `3000` : 200 si l’application joint PostgreSQL, 503 sinon |
| Instances | **une seule** (voir « Temps réel ») |

## Variables d’environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | URL **interne** du PostgreSQL Coolify (port 5432, hôte du service), schéma `tournio` géré par l’application |
| `BETTER_AUTH_URL` | `https://tourn.rfonline.be` : origine de confiance, base OAuth, cookies `Secure` |
| `BETTER_AUTH_SECRET` | secret long et aléatoire, propre à la production |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | client OAuth Google ; URI de redirection `https://tourn.rfonline.be/api/auth/callback/google` |
| `PG_SSL_CA_FILE` | uniquement si la base exige TLS avec une autorité privée |
| `TOURNIO_MAX_STREAMS` | facultatif, plafond de flux temps réel par processus (2000 par défaut) |

**Ne jamais définir `TOURNIO_ISOLATED_TEST`** en production : cette variable réactive la connexion par mot de passe réservée aux tests isolés.

## Sécurité HTTP

- HTTPS par Coolify (Let’s Encrypt). Les cookies de session sont `HttpOnly`, `Secure` et `SameSite=Lax` dès que `BETTER_AUTH_URL` est en `https`.
- En-têtes appliqués à toutes les réponses (`next.config.ts`) : HSTS un an, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `Permissions-Policy`.
- Écritures protégées par session, contrôle d’origine et versions optimistes ; limitation de débit Better Auth stockée en base.

## Temps réel et proxy

Les pages publiques reçoivent les mises à jour par SSE (`/api/v1/tournaments/:slug/events`). Le flux envoie `X-Accel-Buffering: no` et un événement `ping` toutes les 15 s. Le navigateur tient le flux pour coupé après 40 s sans signal, ou dès l’événement `offline`. Il passe alors au polling toutes les 20 s, puis rouvre le flux.

Chaque processus maintient **une** connexion PostgreSQL `LISTEN`. Plusieurs instances fonctionneraient, puisque chacune écoute, mais ce n’a pas été mesuré. Le passage à plusieurs instances reste donc à valider.

## Capacité mesurée

Mesure locale du 1er novembre 2026 : build de production, un processus, PostgreSQL Docker sur la même machine, avec `npm run test:capacity`.

| Scénario | Résultat |
| --- | --- |
| 300 spectateurs en direct, 5 scores | diffusion p95 ≈ 0,4 s, saisie p95 ≈ 60 ms, 0 erreur |
| 1000 spectateurs en direct, 3 scores | diffusion p95 ≈ 0,8 s, saisie p95 ≈ 60 ms, 0 erreur |
| Rafale de 1000 ouvertures de page publique | ≈ 1500 req/s, p95 ≈ 0,6 s, 0 échec |

La diffusion recharge l’instantané complet chez chaque spectateur : son coût croît avec l’audience. Une seule lecture de version par changement est partagée par tous les flux. Au-delà de `TOURNIO_MAX_STREAMS` flux, le serveur répond 503 et les navigateurs passent au polling.

Ces chiffres valent pour un poste de développement : un VPS plus modeste et une base distante donneront des valeurs plus élevées. Le pilote visé (un tournoi de 12 équipes, quelques centaines de téléphones) garde une large marge.

## Exploitation

- **Migrations** : uniquement `npm run db:migrate`. Ne jamais utiliser `migrate reset` ni `db push` sur la base de production.
- **Sauvegardes** : activer les sauvegardes planifiées du PostgreSQL dans Coolify, au minimum une par jour pendant la saison.
- **Arrêt** : Next.js termine les requêtes en cours sur `SIGTERM` ; les flux SSE sont coupés et les navigateurs se reconnectent seuls.
- **Avertissement connu** : `DeprecationWarning: Calling client.query() when the client is already executing a query`. Il vient de l’adaptateur `@prisma/adapter-pg`, qui envoie des requêtes concurrentes dans une transaction, et non du code Tournio. Il est sans effet avec `pg` 8, épinglé en 8.23.1. À revoir avant toute montée vers `pg` 9.
