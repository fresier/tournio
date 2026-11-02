# Tournio

Application Next.js fullstack avec **PostgreSQL privé, Prisma 7 et Better Auth**. Le socle organisateur permet de créer des tournois en brouillon, configurer équipes, poules, terrains, disponibilités et règles de score. La démonstration de score en direct est disponible sur `/demo`.

La spécification métier est dans [TOURNIO_SPEC.md](TOURNIO_SPEC.md), le [plan actif](plans/003-postgres-prisma-better-auth.md) décrit la suite du MVP et le [compte rendu](docs/verification-prisma.md) précise ce qui a été vérifié.

Pour préparer et gérer un tournoi, consultez le [guide du gestionnaire](docs/guide-gestionnaire.md) : configuration, publication, partage, résultats, phase de classement et archivage.

## Prérequis et configuration

Node.js 24 ou supérieur, npm et une base PostgreSQL accessible. Docker est uniquement nécessaire pour les tests isolés ; l’application utilise directement `DATABASE_URL`.

Renseigner dans `.env.local` les variables de [.env.example](.env.example), puis :

```sh
npm ci
npm run setup
npm run db:migrate
npm run dev
```

- `DATABASE_URL` : connexion à votre PostgreSQL ; sa valeur reste dans l’environnement serveur.
- `PG_SSL_CA_FILE` : chemin absolu vers le certificat CA PEM pour vérifier un serveur utilisant une autorité privée. Ce réglage impose la vérification du certificat et du nom du serveur (`verify-full`).
- `BETTER_AUTH_SECRET` : généré par `npm run setup` s’il est absent, sans écraser une valeur existante.
- `BETTER_AUTH_URL` : origine de l’application, par défaut `http://localhost:3000`. En développement, les adresses de bouclage sont aussi acceptées avec le même port et protocole. En production, seules les origines configurées sont autorisées.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : client OAuth Google de type Application Web ; ces variables restent sur le serveur.

Les tables et l’historique Prisma sont isolés dans le schéma **tournio**. Le code complète la connexion en mémoire avec ce schéma ; il ne réécrit pas `DATABASE_URL`. Les migrations sont additives. Si ce schéma contient déjà des tables sans historique Prisma, la commande s’arrête pour demander une revue de compatibilité. Aucune commande de reset n’est prévue.

Le pilote `pg` 8 interprète encore `sslmode=require` comme `verify-full` par défaut. Pour retrouver la sémantique PostgreSQL/libpq de l’URL fournie, la configuration locale ajoute explicitement `uselibpqcompat=true` à cette URL. Avec `sslmode=require` sans CA, TLS reste obligatoire mais le certificat et l’identité du serveur ne sont pas vérifiés. Cela explique pourquoi une URL acceptée dans un autre client peut échouer dans Node.js avec `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Pour vérifier aussi l’identité du serveur, utiliser `sslmode=verify-full` avec une chaîne reconnue, ou renseigner `PG_SSL_CA_FILE` pour une CA privée. Aucun réglage TLS global n’est désactivé. Voir la [définition des modes PostgreSQL](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Utilisation

Ouvrir **http://localhost:3000/dashboard**. Sans session, l’application redirige vers `/login`. La première connexion Google crée un compte organisateur. La connexion se fait uniquement avec Google : il n’y a ni inscription ni connexion par e-mail et mot de passe. `npm run setup` prépare uniquement la configuration ; il ne génère aucun compte ni identifiant de démonstration.

Le dashboard propose :

- La liste des tournois de l’organisateur et la création d’un brouillon.
- Informations : nom, sport, lieu, lien public, dates et fuseau IANA.
- Ajout, modification, suppression et affectation manuelle des équipes aux poules.
- Ajout, modification et suppression des poules et des terrains.
- Disponibilités des terrains, avec refus des chevauchements et horaires hors tournoi.
- Durée des matchs, transition, repos, barème et autorisation des matchs nuls.
- Partage de la gestion avec d’autres comptes Google, par adresse vérifiée ; ajout et retrait des accès réservés au propriétaire.

Les heures saisies sont interprétées dans le fuseau du tournoi et stockées comme instants UTC. Une heure inexistante est refusée ; une heure ambiguë exige un décalage UTC explicite.

Chaque mutation vérifie la session Better Auth, les droits sur le tournoi et ses ressources, ainsi que la version du tournoi ou du match lorsqu’elle s’applique. Les opérations sont transactionnelles sous verrou du tournoi. Les clés étrangères composites et les contraintes SQL garantissent l’intégrité entre tournois, poules, équipes et matchs.

Le scénario de tests isolés fournit un brouillon de **12 équipes, 3 poules de 4 et 3 terrains**, avec disponibilités et règles. Ces fixtures sont créées uniquement dans sa base PostgreSQL jetable.

## Connexion Google

Dans Google Cloud / Google Auth Platform, configurer l’écran de consentement et créer un client OAuth **Application Web**. Si l’application Google est en mode test externe, ajouter les comptes autorisés dans les utilisateurs de test. Enregistrer les URI de redirection exactes correspondant aux adresses utilisées :

```text
http://localhost:3000/api/auth/callback/google
```

L’adresse locale retenue est `localhost`. L’URI `http://127.0.0.1:3000/api/auth/callback/google` n’est à ajouter chez Google que si cet autre hôte est utilisé pour se connecter.

Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`, puis relancer le serveur si la configuration n’a pas été rechargée. Le bouton « Continuer avec Google » est activé lorsque les deux valeurs sont présentes. Aucun secret n’est transmis à la page. Sans configuration Google, aucune connexion n’est possible. La connexion par mot de passe n’existe que dans les tests isolés (`TOURNIO_ISOLATED_TEST=1`, utilisé par `npm run test:local`).

En développement, le retour OAuth utilise le même hôte que le départ : une connexion commencée sur `localhost` revient sur `localhost`, sans perdre son cookie d’état. Chaque URI utilisée doit être autorisée chez Google ; ajouter seulement une origine JavaScript ne remplace pas l’URI de redirection. En production, définir `BETTER_AUTH_URL` sur le domaine HTTPS public et autoriser `https://votre-domaine/api/auth/callback/google`.

La première connexion Google crée le profil local. Une adresse déjà associée à un compte local vérifié peut être reliée au même utilisateur si Google confirme aussi l’adresse ; aucun compte avec une autre adresse n’est relié automatiquement. Les jetons OAuth sont chiffrés en base par Better Auth avec `BETTER_AUTH_SECRET`. Les seules autorisations demandées sont `openid`, `email` et `profile`. Une annulation revient à la page de connexion avec un message en français. Voir la [configuration Google dans Better Auth](https://better-auth.com/docs/authentication/google).

## Temps réel

Les pages publiques (`/t/:slug`, pages équipe) et la démo `/demo` reçoivent les changements par **Server-Sent Events (SSE)**. Après chaque transaction, un trigger PostgreSQL émet un `NOTIFY`. Le serveur Next.js maintient une connexion `LISTEN` et signale la nouvelle version ; le navigateur recharge alors l’instantané public, qui reste la seule source de vérité.

En cas de coupure, le navigateur bascule sur un polling périodique et rouvre le flux. Il détecte la coupure par l’erreur du flux, par l’événement `offline`, ou par 40 s sans `ping`. Le serveur rétablit seul sa connexion PostgreSQL.

Exploitation, capacité mesurée et configuration Coolify : [docs/deploiement.md](docs/deploiement.md).

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

Avec l’application locale démarrée, pour vérifier le démarrage OAuth Google :

```sh
npm run test:google
```

Les scénarios métier, temps réel, navigateur (`test:e2e`) et capacité (`test:capacity`) sont lancés par `npm run test:local`. La première fois, installer les navigateurs de test avec `npx playwright install chromium webkit`. Ils vérifient les accès A/B, la concurrence, les ressources enfants, les contraintes des matchs et la réception d’un score par SSE sans polling.

`test:google` vérifie le bouton, l’URL d’autorisation, PKCE, l’annulation, les états falsifiés et les origines/retours interdits. Avec le serveur de développement, `npm run test:google -- --local-aliases` vérifie aussi l’autre adresse locale. Ce test respecte les limitations de débit et ne se connecte à aucun compte Google. Le consentement et la connexion complète avec un compte réel s’effectuent dans le navigateur.

Pour tout vérifier sur un PostgreSQL Docker jetable, **sans toucher à la base privée** :

```sh
npm run test:local
```

Ce scénario crée une base et des secrets temporaires, applique deux fois les migrations et `test:seed`, compile la production, lance Next.js sur `127.0.0.1:3100`, puis exécute les contrôles métier, OAuth, temps réel, le parcours navigateur et la mesure de capacité. Les comptes `TEST_OWNER_*` et `TEST_OTHER_*` existent seulement dans cet environnement ; leurs mots de passe ne sont pas écrits dans `.env.local`. `test:seed` et les tests utilisant ces comptes refusent toute base autre que le PostgreSQL local `tournio_test` marqué comme isolé. Les identifiants Google y sont fictifs et aucun appel au fournisseur n’est effectué. Il interrompt aussi le canal PostgreSQL du test pour vérifier la reconnexion. Serveur et conteneur de test sont arrêtés à la fin.

## État et limites

L’interface utilise **Mantine 9** (thème dans `src/lib/theme.ts`). Le MVP est fonctionnel :
- configuration du tournoi, avec un thème clair ou sombre et des couleurs propres à chaque tournoi (onglet Apparence), repris par le dashboard du tournoi ;
- génération et publication du calendrier ;
- phase de classement au choix après les poules (un match par rang, croisé en deux tours, tableau complet), classement final ;
- écran TV 1080p pour la salle (`/t/:slug/tv`) ;
- pages publiques avec QR codes ;
- saisie des résultats et classements en direct.

Le parcours complet du pilote 12 équipes / 3 poules / 3 terrains est vérifié dans de vrais navigateurs. Chromium sert à l’organisateur, au bureau et sur téléphone. WebKit sert au spectateur iPhone, dans un autre fuseau, sans stockage local et avec une perte puis une reprise du réseau. Le parcours couvre aussi :
- le clavier ;
- l’accessibilité (axe-core, WCAG 2.1 AA : aucune violation grave) ;
- l’absence de défilement horizontal ;
- l’absence d’erreur console ou d’hydratation.

Prisma 7.10.1 est verrouillé car l’adaptateur Better Auth 1.7.14 prend en charge cette version. Prisma est l’unique système actif de migrations. Les contraintes et triggers non exprimables dans le schéma Prisma sont dans les migrations SQL.

Limites connues :
- la connexion Google réelle se vérifie à la main ;
- la capacité est mesurée en local, pas sur le serveur de production ;
- une seule instance est validée ;
- les notifications push sont reportées.

Voir [docs/api/organisation.md](docs/api/organisation.md) pour les contrats HTTP et [docs/decisions/003-postgres-prisma-better-auth.md](docs/decisions/003-postgres-prisma-better-auth.md) pour les choix techniques.
