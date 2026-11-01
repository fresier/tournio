# Tournio

Application Next.js fullstack avec **PostgreSQL privé, Prisma 7 et Better Auth**. Le socle organisateur permet de créer des tournois en brouillon, configurer équipes, poules, terrains, disponibilités et règles de score. La démonstration de score en direct reste disponible à la racine.

La spécification métier est dans [TOURNIO_SPEC.md](TOURNIO_SPEC.md), le [plan actif](plans/003-postgres-prisma-better-auth.md) décrit la suite du MVP et le [compte rendu](docs/verification-prisma.md) précise ce qui a été vérifié.

## Prérequis et configuration

Node.js 24 ou supérieur, npm et une base PostgreSQL accessible. Docker est uniquement nécessaire pour les tests isolés ; l’application utilise directement `DATABASE_URL`.

Renseigner dans `.env.local` les variables de [.env.example](.env.example), puis :

```sh
npm ci
npm run setup
npm run db:migrate
npm run db:seed
npm run dev
```

- `DATABASE_URL` : connexion à votre PostgreSQL ; sa valeur reste dans l’environnement serveur.
- `PG_SSL_CA_FILE` : chemin absolu vers le certificat CA PEM pour vérifier un serveur utilisant une autorité privée. Ce réglage impose la vérification du certificat et du nom du serveur (`verify-full`).
- `BETTER_AUTH_SECRET` : généré par `npm run setup` s’il est absent, sans écraser une valeur existante.
- `BETTER_AUTH_URL` et `APP_ORIGIN` : même origine, par défaut `http://localhost:3000`. En développement, les adresses de bouclage sont aussi acceptées avec le même port et protocole. En production, seules les origines configurées sont autorisées.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : client OAuth Google de type Application Web ; ces variables restent sur le serveur.
- `DEMO_OWNER_*` et `DEMO_OTHER_*` : comptes du pilote, générés localement et utilisés par le seed/tests.

Les tables et l’historique Prisma sont isolés dans le schéma **tournio**. Le code complète la connexion en mémoire avec ce schéma ; il ne réécrit pas `DATABASE_URL`. Les migrations sont additives. Si ce schéma contient déjà des tables sans historique Prisma, la commande s’arrête pour demander une revue de compatibilité. Aucune commande de reset n’est prévue.

Le pilote `pg` 8 interprète encore `sslmode=require` comme `verify-full` par défaut. Pour retrouver la sémantique PostgreSQL/libpq de l’URL fournie, la configuration locale ajoute explicitement `uselibpqcompat=true` à cette URL. Avec `sslmode=require` sans CA, TLS reste obligatoire mais le certificat et l’identité du serveur ne sont pas vérifiés. Cela explique pourquoi une URL acceptée dans un autre client peut échouer dans Node.js avec `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Pour vérifier aussi l’identité du serveur, utiliser `sslmode=verify-full` avec une chaîne reconnue, ou renseigner `PG_SSL_CA_FILE` pour une CA privée. Aucun réglage TLS global n’est désactivé. Voir la [définition des modes PostgreSQL](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Utilisation

Ouvrir **http://localhost:3000/dashboard**. Sans session, l’application redirige vers `/login`. Les identifiants du pilote sont dans `.env.local` ; aucun mot de passe n’est affiché par les scripts. La création de comptes par mot de passe est fermée. La première connexion Google crée un compte organisateur.

Le dashboard propose :

- La liste des tournois de l’organisateur et la création d’un brouillon.
- Informations : nom, sport, lieu, lien public, dates et fuseau IANA.
- Ajout, modification, suppression et affectation manuelle des équipes aux poules.
- Ajout, modification et suppression des poules et des terrains.
- Disponibilités des terrains, avec refus des chevauchements et horaires hors tournoi.
- Durée des matchs, transition, repos, barème et autorisation des matchs nuls.

Les heures saisies sont interprétées dans le fuseau du tournoi et stockées comme instants UTC. Une heure inexistante est refusée ; une heure ambiguë exige un décalage UTC explicite.

Chaque mutation vérifie la session Better Auth, la propriété de toutes les ressources et la version du tournoi. Les opérations sont transactionnelles sous verrou du tournoi. Les clés étrangères composites et les contraintes SQL garantissent l’intégrité entre tournois, poules, équipes et matchs.

Le seed est relançable : il conserve les comptes et les données existantes et crée, au premier passage, un brouillon de **12 équipes, 3 poules de 4 et 3 terrains** avec disponibilités et règles. Les données de démonstration ne sont pas réinitialisées à chaque lancement.

## Connexion Google

Dans Google Cloud / Google Auth Platform, configurer l’écran de consentement et créer un client OAuth **Application Web**. Si l’application Google est en mode test externe, ajouter les comptes autorisés dans les utilisateurs de test. Enregistrer les URI de redirection exactes correspondant aux adresses utilisées :

```text
http://localhost:3000/api/auth/callback/google
```

L’adresse locale retenue est `localhost`. L’URI `http://127.0.0.1:3000/api/auth/callback/google` n’est à ajouter chez Google que si cet autre hôte est utilisé pour se connecter.

Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`, puis relancer le serveur si la configuration n’a pas été rechargée. Le bouton « Continuer avec Google » est activé lorsque les deux valeurs sont présentes. Aucun secret n’est transmis à la page. Sans configuration Google, la connexion par mot de passe reste disponible.

En développement, le retour OAuth utilise le même hôte que le départ : une connexion commencée sur `localhost` revient sur `localhost`, sans perdre son cookie d’état. Chaque URI utilisée doit être autorisée chez Google ; ajouter seulement une origine JavaScript ne remplace pas l’URI de redirection. En production, définir `BETTER_AUTH_URL` et `APP_ORIGIN` sur le domaine HTTPS public et autoriser `https://votre-domaine/api/auth/callback/google`.

La première connexion Google crée le profil local. Une adresse déjà associée à un compte local vérifié peut être reliée au même utilisateur si Google confirme aussi l’adresse ; aucun compte avec une autre adresse n’est relié automatiquement. Les jetons OAuth sont chiffrés en base par Better Auth avec `BETTER_AUTH_SECRET`. Les seules autorisations demandées sont `openid`, `email` et `profile`. Une annulation revient à la page de connexion avec un message en français. Voir la [configuration Google dans Better Auth](https://better-auth.com/docs/authentication/google).

## Temps réel

Sur `/`, le propriétaire peut modifier le score de son match de démonstration ; les autres visiteurs le consultent sans compte. Un trigger PostgreSQL émet un `NOTIFY` après la transaction. Le serveur Next.js maintient une connexion `LISTEN` et diffuse les nouvelles données publiques avec **Server-Sent Events (SSE)**.

Un onglet attend la confirmation du flux, recharge le snapshot à la connexion et se replie sur un polling de 15 secondes en cas d’interruption. Le serveur rétablit sa connexion PostgreSQL automatiquement. Les flux refusent les matchs non publiés et ne diffusent ni propriétaire ni donnée d’authentification.

Ce fonctionnement nécessite un processus Node capable de maintenir les flux HTTP et une connexion PostgreSQL de session pour `LISTEN`. L’hébergement définitif sera choisi ultérieurement. Les pages publiques des vrais tournois seront ajoutées avec le calendrier et les résultats.

## Commandes et vérifications

```sh
npm run db:validate
npm run db:generate
npm run db:status
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Avec l’application locale démarrée et le seed appliqué :

```sh
npm run test:integration
npm run test:realtime
npm run test:google
```

Ces tests créent puis nettoient uniquement leurs propres fixtures. Ils vérifient les accès A/B, la concurrence, les ressources enfants, les contraintes des matchs et la réception d’un score par SSE sans polling.

`test:google` vérifie le bouton, l’URL d’autorisation, PKCE, l’annulation, les états falsifiés et les origines/retours interdits. Avec le serveur de développement, `npm run test:google -- --local-aliases` vérifie aussi l’autre adresse locale. Ce test respecte les limitations de débit et ne se connecte à aucun compte Google. Le consentement et la connexion complète avec un compte réel sont à vérifier dans le navigateur.

Pour tout vérifier sur un PostgreSQL Docker jetable, **sans toucher à la base privée** :

```sh
npm run test:local
```

Ce scénario crée une base et des secrets temporaires, applique deux fois les migrations et le seed, compile la production, lance Next.js sur `127.0.0.1:3100`, puis exécute les contrôles métier, OAuth et temps réel. Les identifiants Google y sont fictifs et aucun appel au fournisseur n’est effectué. Il interrompt aussi le canal PostgreSQL du test pour vérifier la reconnexion. Serveur et conteneur de test sont arrêtés à la fin. Les secrets sont transmis dans l’environnement des processus et ne remplacent pas `.env.local`.

## État et limites

Le modèle Prisma inclut déjà les matchs et leurs contraintes, mais la génération du calendrier, la publication, les pages publiques des tournois et la saisie des résultats métier restent à développer. L’interface permet de préparer le tournoi ; elle ne présente pas ces fonctions futures comme disponibles.

Prisma 7.10.1 est verrouillé car l’adaptateur Better Auth 1.7.14 prend en charge cette version. Prisma est l’unique système actif de migrations. Les contraintes et triggers non exprimables dans le schéma Prisma sont dans la seconde migration SQL.

Aucun navigateur pilotable n’est disponible dans cette session : la vérification HTTP/SDK est automatisée, la revue visuelle du dashboard reste à effectuer. Voir [docs/api/organisation.md](docs/api/organisation.md) pour les contrats HTTP et [docs/decisions/003-postgres-prisma-better-auth.md](docs/decisions/003-postgres-prisma-better-auth.md) pour les choix techniques.
