# Vérification PostgreSQL, Prisma et Better Auth

Mis à jour le 1er novembre 2026. Périmètre : PostgreSQL privé / Prisma 7.10.1 / Better Auth 1.7.14 et socle métier organisateur.

## Contrôles réussis

- Schéma Prisma valide et génération du client réussie.
- Lint sans avertissement, TypeScript et build de production réussis.
- Douze tests unitaires : dates/fuseaux, heure inexistante, heure ambiguë avec décalage explicite, validation stricte des mutations, configuration de connexion, contrôle des origines, configuration Google et protection des comptes de test sur une base privée.
- Migrations appliquées à une base PostgreSQL 17 Docker jetable ; seconde application sans changement.
- Seed relancé : mêmes comptes, même match et même tournoi ; 12 équipes, 3 poules, 3 terrains et 12 affectations.
- Connexion Better Auth avec cookies HTTP-only, accès dashboard et formulaires rendus en HTTP.
- Création et mise à jour des équipes, poules, terrains, disponibilités et règles.
- Refus des références entre tournois, des accès d’un autre propriétaire, des origines étrangères, chevauchements et horaires hors tournoi.
- Deux modifications simultanées : un succès et un conflit de version, sans écrasement.
- Contraintes SQL des matchs : auto-rencontre, paire inversée et nul interdit refusés.
- Suppression d’une poule sans suppression de ses équipes ; suppression d’un terrain avec ses disponibilités.
- Score diffusé par PostgreSQL NOTIFY puis SSE public sans polling ; passage final observé en 9 ms sur la base isolée.
- Connexion PostgreSQL d’écoute interrompue volontairement dans le scénario isolé ; reconnexion et réception du score suivant réussies.
- Match non publié inaccessible par HTTP et SSE ; session révoquée après déconnexion.

Le scénario `npm run test:local` compile la production et exécute les tests HTTP réels. Il utilise des identifiants et une base temporaires, sans lire ni modifier les données de la base privée. Le serveur Next.js et le conteneur jetables sont arrêtés après le scénario. Les latences indiquées sont des observations locales ponctuelles.

## Base privée

La connexion à PostgreSQL **18.6** fonctionne avec la `DATABASE_URL` fournie. Le contrôle initial en lecture seule a confirmé TLS actif, le droit de créer le schéma et l’absence de tables `tournio`.

L’erreur initiale `UNABLE_TO_VERIFY_LEAF_SIGNATURE` provenait du certificat émis par « Coolify CA Certificate » et de l’interprétation stricte de `sslmode=require` par `pg` 8. La configuration locale ajoute explicitement `uselibpqcompat=true` à l’URL, en conservant ses identifiants, son hôte et sa base. Le mode `require` exige une connexion chiffrée mais, sans CA, ne vérifie pas le certificat ni l’identité du serveur. Aucun `NODE_TLS_REJECT_UNAUTHORIZED` ni réglage TLS global n’est utilisé. Un certificat CA n’est donc pas requis pour reproduire ce mode ; `PG_SSL_CA_FILE` permet de demander `verify-full`. Voir les [modes SSL PostgreSQL](https://www.postgresql.org/docs/current/libpq-ssl.html).

Contrôles effectués le 1er novembre sur cette base privée, via l’application locale :

- Les deux migrations versionnées ont été appliquées ; `npm run db:status` confirme un schéma à jour.
- Le seed a créé les deux comptes, le match public et le tournoi de démonstration avec 12 équipes, 3 poules et 3 terrains.
- `npm run test:integration` a réussi : connexion, dashboard, CRUD, intégrité SQL, isolation propriétaire, CSRF et concurrence.
- `npm run test:realtime` a réussi : permissions, mise à jour de score reçue par NOTIFY/SSE en **290 ms**, conflit de version, confidentialité et révocation de session.

Les tests ont supprimé uniquement les tournois et matchs qu’ils avaient créés. L’interruption volontaire du canal PostgreSQL reste limitée au scénario Docker isolé. Les vérifications privées ont réutilisé le serveur local existant sur le port 3000 sans l’arrêter.

## Origines locales

L’erreur « Origine refusée. » a été reproduite sur `http://localhost:3000/login` : seule l’origine configurée `http://127.0.0.1:3000` était admise. Les API et Better Auth partagent désormais une liste d’origines. En développement, les alias de bouclage `localhost`, `127.0.0.1` et `[::1]` sont acceptés avec le port et le protocole configurés. En production, cette extension automatique est désactivée.

Vérification HTTP sur `localhost:3000` et `127.0.0.1:3000` : connexion, session, dashboard, création d’un tournoi et déconnexion réussies, avec cookies HTTP-only sans attribut Domain. Les routes natives Better Auth ont aussi été testées. Les origines étrangères, les autres ports, un domaine trompeur et l’origine `null` restent refusés. Les tournois créés par ce contrôle ont été supprimés. Les tests unitaires couvrent aussi le maintien de la restriction en production.

## Google OAuth

Intégré le 1er novembre 2026 avec le fournisseur natif Better Auth, sans nouvelle table ni migration. Le bouton de connexion utilise le SDK client Better Auth, revient au dashboard après succès et affiche les erreurs d’annulation en français. Les jetons sont chiffrés en base ; les scopes demandés sont uniquement openid/email/profile.

- Les deux variables Google ont été détectées dans `.env.local`, sans affichage de leurs valeurs.
- `npm run test:google -- --local-aliases` réussit contre le serveur de développement et la base privée : bouton actif, URL Google avec le bon hôte de retour, PKCE S256, annulation, état falsifié, origine étrangère et URL de retour étrangère. Le test respecte la limitation de débit native.
- `npm run test:local` réussit aussi après l’ajout Google : migrations/seed idempotents, build de production, parcours organisateur, OAuth et temps réel avec reconnexion. Les identifiants Google y sont fictifs ; ce scénario ne contacte pas Google.
- Un contrôle distant sans session Google a atteint la page de connexion Google avec le client réel et l’URI `http://localhost:3000/api/auth/callback/google`. L’utilisateur a choisi de conserver uniquement `localhost` pour OAuth : `BETTER_AUTH_URL` et les valeurs locales par défaut sont alignées sur `http://localhost:3000`. Le retour `127.0.0.1`, refusé par Google lors du contrôle, ne nécessite donc aucune configuration supplémentaire.

Le 1er novembre 2026, l’utilisateur a confirmé que la connexion Google complète fonctionne sur `localhost`. Cette validation manuelle complète les contrôles automatisés du démarrage OAuth. La liaison à un compte local préexistant n’a pas été testée séparément avec un compte réel. La configuration autorise la création d’un organisateur à la première connexion ; elle conserve les règles de vérification d’adresse avant une liaison implicite.

## Nettoyage du projet

Le 1er novembre 2026, retrait de l’ancienne infrastructure Supabase, des scripts et migrations associés, des plans remplacés et du rapport historique. Les trois variables d’environnement obsolètes et les exclusions de configuration devenues inutiles ont été retirées. Les éléments métier encore utiles du cadrage sont conservés dans le plan actif ; seule la section technique du cahier des charges a été alignée sur l’architecture actuelle.

Aucun conteneur, volume ni réseau de l’ancien projet Docker ne reste. Les 11 images de son ancienne configuration ont été supprimées après contrôle qu’aucun conteneur ne les utilisait. Une archive temporaire des anciens fichiers et données locales est conservée hors du dépôt, dans `/private/tmp/tournio-legacy-lSoeMV/supabase.tar.gz`, avec accès restreint.

Contrôles après nettoyage : lint, TypeScript, 11 tests unitaires et scénario `test:local` réussis. Ce dernier revalide migrations/seed, build de production, parcours organisateur, démarrage OAuth et temps réel avec reconnexion sur une base jetable. L’analyse des imports n’a détecté aucun fichier source inutilisé.

Le build temporaire `.next-test` a été retiré après génération du build final ; TypeScript reste valide. Un serveur de production temporaire utilisant la configuration locale actuelle a répondu 200 sur `/`, `/login` et `/api/auth`, sans ancien message d’infrastructure. Ce serveur de vérification a ensuite été arrêté.

## Comptes de démonstration

Le 1er novembre 2026, les deux utilisateurs correspondant à `DEMO_OWNER_EMAIL` et `DEMO_OTHER_EMAIL` ont été supprimés de la base privée à la demande de l’utilisateur, avec leurs deux identifiants par mot de passe et leurs quatre sessions. Leur tournoi de démonstration et leur match ont été transférés transactionnellement à l’unique compte Google existant. Les identifiants du tournoi et du match, les scores et les ressources enfants sont conservés ; le compte Google est préservé.

Les quatre variables de démonstration ont été retirées de `.env.local` et du fichier d’exemple. Le setup ne les génère plus. L’ancien seed courant est remplacé par `test:seed`, réservé au PostgreSQL local `tournio_test` marqué comme isolé. Les scénarios métier et temps réel appliquent la même restriction. Leurs comptes `TEST_OWNER_*` et `TEST_OTHER_*` sont générés uniquement dans l’environnement du conteneur jetable. La démonstration publique utilise désormais la page de connexion commune.

Contrôle final en lecture seule : aucun utilisateur ni session des deux anciens comptes, un compte Google conservé, tournoi avec 12 équipes / 3 poules / 3 terrains / 12 affectations et score du match inchangé. Le setup a été relancé sans recréer les variables supprimées ; l’exécution de `test:seed` avec la configuration privée est refusée avant connexion à la base.

Les 12 tests unitaires, le lint, TypeScript et le scénario complet `test:local` passent après cette séparation. Le seed de test reste idempotent ; les tests métier, OAuth et temps réel avec reconnexion restent fonctionnels.

## Limites

Aucun navigateur pilotable n’est disponible : inventaire vide lors de cette session. Le rendu et les actions HTTP sont vérifiés, la présentation visuelle mobile/desktop et les interactions réelles des formulaires restent à vérifier manuellement.

Le moteur de calendrier, la publication, les pages publiques de tournoi et les résultats sportifs ne sont pas encore réalisés. Le temps réel vérifié concerne le match de démonstration.

