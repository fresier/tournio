# Tournio — Cahier des charges pour Codex

Version : 0.1 — 31 octobre 2026  
Statut : spécification initiale du MVP, à affiner avant mise en production.

## 1. Vision

**Tournio** est une application web responsive de gestion de tournois sportifs amateurs, indépendante du sport. Elle permet à un organisateur de créer un tournoi, d'inscrire des équipes, de générer un calendrier, d'affecter des terrains et des horaires, puis de saisir les scores. Les participants accèdent **sans compte** à une page publique en **lecture seule**, sélectionnent leur équipe et suivent leurs matchs, leurs horaires, leurs terrains et leurs résultats.

**Promesse :** « Your tournament. Simplified. »

### Principes

- Mobile-first pour les participants ; interface desktop et tablette pour l'organisation.
- Interface en français au lancement ; architecture prête pour l'internationalisation.
- Aucune authentification requise pour consulter un tournoi public.
- Séparation stricte des autorisations : seuls les organisateurs habilités peuvent modifier les données.
- Mise à jour rapide des informations, avec fonctionnement dégradé en cas de perte de connexion.
- Ne pas supposer que tous les sports utilisent le même système de score.

## 2. Périmètre MVP

### Inclus (P0)

1. Authentification des organisateurs.
2. Création, modification, publication et archivage d'un tournoi.
3. Configuration des terrains, équipes, format et règles de score.
4. Génération des matchs **en poules / round-robin**, avec attribution des horaires et terrains.
5. Modification manuelle des matchs par l'organisateur.
6. Saisie, correction et validation des résultats.
7. Classement des poules calculé automatiquement.
8. Page publique du tournoi et page personnalisée de chaque équipe, sans connexion.
9. Affichage du prochain match, de l'adversaire, de l'heure, du terrain, du statut et des résultats.
10. Actualisation automatique des données (temps réel si disponible, repli par polling).
11. QR code ou lien partageable vers le tournoi / l'équipe.
12. Gestion explicite des fuseaux horaires et des conflits de planification.

### Hors MVP (P1/P2)

- Phases finales à élimination directe, et formats mixtes poules + tableau.
- Notifications push, SMS et e-mail.
- Interface arbitre et multi-organisateurs avancée.
- Écran TV / affichage public dédié.
- Décalage automatique de tous les matchs après un retard.
- Inscriptions publiques, paiements, billetterie, statistiques historiques avancées.
- Application native iOS/Android.

Ne pas implémenter ces fonctionnalités dans le MVP sans demande explicite.

## 3. Rôles et droits

| Action                           | Visiteur / équipe | Organisateur propriétaire |
| -------------------------------- | ----------------- | ------------------------- |
| Voir un tournoi publié           | Oui               | Oui                       |
| Sélectionner une équipe          | Oui               | Oui                       |
| Consulter matchs et résultats    | Oui               | Oui                       |
| Créer / configurer un tournoi    | Non               | Oui                       |
| Générer / modifier le calendrier | Non               | Oui                       |
| Encoder / corriger un score      | Non               | Oui                       |
| Publier / archiver               | Non               | Oui                       |

- Les liens publics ne sont **pas** des jetons d'écriture.
- Une page d'équipe est une vue filtrée d'un tournoi public, pas un espace privé.
- Un tournoi en brouillon n'est pas visible publiquement.
- Toute mutation doit être contrôlée côté serveur, jamais seulement dans l'interface.

## 4. Parcours utilisateur

### Organisateur

1. Se connecter.
2. Créer un tournoi : nom, sport, lieu, dates, fuseau horaire.
3. Définir les terrains et les plages horaires disponibles.
4. Ajouter les équipes, puis les répartir en poules (manuellement dans le MVP).
5. Paramétrer durée des matchs, intervalle entre matchs, repos minimal et règles de classement.
6. Prévisualiser le calendrier généré et ses éventuels conflits.
7. Valider et publier le tournoi.
8. Pendant l'événement : ajuster les horaires / terrains et saisir les scores.
9. Consulter le classement et archiver le tournoi après la compétition.

### Équipe / participant

1. Ouvrir un lien ou scanner un QR code.
2. Sélectionner son équipe dans la liste.
3. Retrouver automatiquement cette sélection lors des visites suivantes (stockage local).
4. Voir en priorité le **prochain match** : heure locale, adversaire, terrain et compte à rebours indicatif.
5. Voir les matchs passés, en cours et à venir, ainsi que les scores et le classement.
6. Pouvoir changer d'équipe à tout moment.

## 5. Écrans attendus

### Public

- `/t/[slug]` : présentation du tournoi, choix de l'équipe, calendrier général, classements.
- `/t/[slug]/teams/[teamSlug]` : tableau de bord de l'équipe.
- États : chargement, tournoi non publié, introuvable, aucun match, match reporté, connexion perdue.

**Carte « Prochain match » :** adversaire, date/heure, terrain, statut et délai restant. Si aucun match futur n'existe, afficher un message explicite et les résultats.

**Liste des matchs :** date/heure, adversaire, terrain, état et score éventuel. Une équipe ne doit pas apparaître comme jouant contre elle-même.

### Administration

- `/login` : connexion.
- `/dashboard` : tournois de l'organisateur.
- `/dashboard/tournaments/new` : création.
- `/dashboard/tournaments/[id]` : aperçu et configuration.
- Sous-vues : équipes, poules, terrains, calendrier, résultats, classement, publication.

L'interface doit rester utilisable au clavier, afficher les erreurs de validation près des champs et demander confirmation avant les actions destructrices.

## 6. Formats et règles sportives

### MVP : poules round-robin

- Chaque équipe rencontre une fois les autres équipes de sa poule (aller simple).
- Pour une poule de `n` équipes, le nombre de matchs est `n × (n - 1) / 2`.
- Exemple : 3 poules de 4 équipes → 3 × 6 = **18 matchs**.
- Supporter un nombre impair d'équipes avec des tours de repos.
- Interdire les doublons de rencontre dans une même phase, sauf option future explicite.

### Score et classement

Le modèle doit permettre des **règles configurables par tournoi**, sans figer le volley comme seul sport. Pour le MVP, prévoir un mode simple :

- score numérique de chaque équipe ;
- résultat gagné / perdu / nul si autorisé ;
- points de classement configurables pour victoire, nul et défaite ;
- départage déterministe : points de classement, différence de scores, scores marqués, puis ordre stable documenté.

Les scores par set, les tie-breaks sportifs particuliers et les règles complexes de départage sont hors MVP. L'organisateur doit pouvoir corriger un score, ce qui recalcule immédiatement le classement.

## 7. Planification des matchs

### Entrées

- Matchs générés par poule.
- Terrains disponibles et leurs plages horaires.
- Heure de début, durée estimée d'un match et intervalle de transition.
- Repos minimal d'une équipe entre deux matchs.
- Fuseau horaire du tournoi (identifiant IANA, par ex. `Europe/Brussels`).

### Contraintes dures

- Aucun terrain ne peut accueillir deux matchs dont les créneaux se chevauchent.
- Une équipe ne peut pas jouer deux matchs simultanément.
- Un match ne peut pas commencer hors d'une plage disponible.
- Le repos minimal configuré doit être respecté.
- Les matchs annulés ne bloquent pas un terrain.

### Comportement attendu

- Algorithme **déterministe** à entrées identiques ; priorité à une solution simple et testable plutôt qu'à une optimisation complexe.
- Prévisualiser les affectations avant sauvegarde.
- Si toutes les contraintes ne peuvent pas être satisfaites, **ne pas publier un calendrier invalide** : retourner les conflits et proposer de modifier les paramètres.
- Les modifications manuelles sont soumises aux mêmes validations.
- Une régénération ne doit pas écraser silencieusement les scores ou les modifications déjà validées : exiger une confirmation et définir une stratégie explicite.
- Stocker les instants en UTC, afficher dans le fuseau horaire du tournoi.

## 8. États métier

### Tournoi

`DRAFT` → `PUBLISHED` → `COMPLETED` → `ARCHIVED`.

### Match

`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `POSTPONED`, `CANCELLED`.

- Un score validé appartient normalement à un match `COMPLETED`.
- Un match `CANCELLED` n'entre pas dans le classement.
- Un match `POSTPONED` n'affiche pas un ancien horaire comme confirmé.
- Définir les transitions autorisées et les vérifier côté API.

## 9. Modèle de données conceptuel

- **User** : `id`, `email`, `passwordHash` ou identifiant de fournisseur, dates.
- **Tournament** : `id`, `ownerId`, `name`, `slug`, `sport`, `location`, `timezone`, `startsAt`, `endsAt`, `status`, `publishedAt`, dates.
- **Court** : `id`, `tournamentId`, `name`, `sortOrder`.
- **CourtAvailability** : `id`, `courtId`, `startsAt`, `endsAt`.
- **Team** : `id`, `tournamentId`, `name`, `slug`, dates.
- **Pool** : `id`, `tournamentId`, `name`, `sortOrder`.
- **PoolTeam** : `poolId`, `teamId` (unicité selon la phase MVP).
- **Match** : `id`, `tournamentId`, `poolId`, `homeTeamId`, `awayTeamId`, `courtId?`, `startsAt?`, `endsAt?`, `status`, `homeScore?`, `awayScore?`, `resultValidatedAt?`, dates.
- **TournamentRules** : `tournamentId`, `matchDurationMinutes`, `transitionMinutes`, `minimumRestMinutes`, `allowDraw`, `pointsWin`, `pointsDraw`, `pointsLoss`, `tieBreakOrder`.

### Contraintes importantes

- Toutes les références entre équipes, poules, terrains et matchs doivent appartenir au **même tournoi**.
- `homeTeamId != awayTeamId`.
- Slug de tournoi unique globalement ; slug d'équipe unique **dans son tournoi**.
- Scores non négatifs ; validation cohérente avec le statut et l'autorisation des matchs nuls.
- Index sur `tournamentId`, `startsAt`, `status`, `teamId` et clés de jointure.
- Préférer des identifiants opaques (UUID/CUID) ; ne jamais faire reposer la sécurité sur leur imprévisibilité.
- Les classements peuvent être calculés à la demande pour le MVP ; éviter de stocker une deuxième vérité désynchronisable.

## 10. API indicative

Convention : `/api/v1`, JSON, erreurs structurées, validation stricte des entrées.

### Publique (lecture seule)

- `GET /tournaments/:slug`
- `GET /tournaments/:slug/teams`
- `GET /tournaments/:slug/teams/:teamSlug`
- `GET /tournaments/:slug/matches`
- `GET /tournaments/:slug/standings`

### Authentifiée (organisateur)

- `POST /admin/tournaments`
- `PATCH /admin/tournaments/:id`
- `POST /admin/tournaments/:id/teams`
- `PATCH /admin/tournaments/:id/teams/:teamId`
- `POST /admin/tournaments/:id/pools`
- `POST /admin/tournaments/:id/schedule/preview`
- `POST /admin/tournaments/:id/schedule/commit`
- `PATCH /admin/tournaments/:id/matches/:matchId`
- `PUT /admin/tournaments/:id/matches/:matchId/result`
- `POST /admin/tournaments/:id/publish`
- `POST /admin/tournaments/:id/archive`

Ces routes sont une proposition de contrat, pas une obligation de nommage. Documenter les schémas de requête/réponse et les codes d'erreur. Prévoir pagination ou filtres pour les calendriers volumineux.

## 11. Temps réel et cohérence

- Événements à diffuser : `match.updated`, `result.updated`, `standings.updated`, `tournament.updated`.
- Les événements ne doivent contenir que des données publiquement consultables pour les clients publics.
- Après reconnexion, recharger l'état serveur : les événements temps réel ne sont pas la source de vérité.
- Repli par polling (par exemple toutes les 15–30 secondes) si le canal temps réel est indisponible.
- Prévenir les écrasements concurrents côté administration (champ `updatedAt` ou version optimiste).
- Les mises à jour de score et les éventuelles opérations dépendantes doivent être atomiques.

## 12. Stack technique retenue

Architecture du dépôt, conformément aux choix validés :

- **Frontend** : Next.js (App Router), React, TypeScript.
- **Backend** : Route Handlers Next.js, API REST côté serveur Node.js.
- **Base** : PostgreSQL privé, Prisma 7 et migrations versionnées.
- **UI** : CSS et composants React accessibles et responsive.
- **Authentification** : Better Auth, sessions en base, cookies HTTP-only, connexion Google et connexion locale par mot de passe.
- **Validation** : schémas Zod partagés ; conversion des fuseaux avec Temporal.
- **Temps réel** : PostgreSQL `LISTEN/NOTIFY`, Server-Sent Events et polling de secours.
- **Tests** : unitaires et intégration API ; E2E navigateur à compléter.

**Attention au déploiement :** choisir un runtime capable de maintenir les flux SSE et une connexion PostgreSQL de session pour `LISTEN`. Documenter les origines autorisées, l'authentification et les variables d'environnement sur la cible retenue.

## 13. Sécurité, confidentialité et accessibilité

- Contrôle d'accès propriétaire sur chaque route de mutation et chaque ressource enfant.
- Mots de passe hachés avec une méthode adaptée si authentification locale ; cookies sécurisés, protection CSRF selon le mécanisme retenu.
- Limitation de débit sur login et API exposées ; journalisation des erreurs sans données sensibles.
- Validation serveur systématique, protections contre XSS et injections.
- Ne pas publier d'e-mails, téléphones ou autres données personnelles des participants.
- QR codes publics : n'inclure aucune information sensible.
- Accessibilité visée : WCAG 2.2 AA (contrastes, navigation clavier, annonces de changements importantes).
- Respect du RGPD : minimisation, durée de conservation documentée, suppression/export à définir avant production.

## 14. Critères d'acceptation du MVP

1. Un organisateur peut créer un tournoi en brouillon avec 12 équipes, 3 poules de 4 et 3 terrains.
2. Le moteur produit exactement 18 rencontres distinctes, sans équipe contre elle-même.
3. Aucun match planifié ne viole les contraintes de terrain, d'équipe, de disponibilité et de repos.
4. Si la planification est impossible, l'interface explique les conflits et n'enregistre pas de calendrier invalide.
5. Un tournoi non publié n'est pas consultable par un visiteur.
6. Une fois publié, son URL publique fonctionne sans connexion.
7. Un participant peut sélectionner son équipe et retrouver cette sélection après rechargement sur le même appareil.
8. La page équipe montre le prochain match avec adversaire, horaire, terrain et statut.
9. Une saisie ou correction de résultat met à jour le score et le classement sans rechargement manuel lorsque le temps réel fonctionne ; sinon via polling.
10. Un visiteur ne peut ni modifier les scores ni accéder aux endpoints d'administration.
11. Deux organisateurs distincts ne peuvent pas modifier les tournois l'un de l'autre.
12. L'application reste lisible et utilisable sur smartphone ; dates affichées dans le fuseau du tournoi.

## 15. Tests à implémenter

### Unitaires

- Génération round-robin pour tailles paires et impaires.
- Unicité des rencontres et nombre de matchs attendu.
- Détection de chevauchement de terrain et de double affectation d'équipe.
- Respect des disponibilités et du repos minimal.
- Calcul de classement, égalités et départages.
- Transitions de statut, scores invalides, matchs annulés.

### Intégration

- Isolation entre tournois et propriétaires.
- Publication / dépublication selon règles retenues.
- Saisie et correction de résultat ; recalcul du classement.
- Concurrence de modification ; intégrité référentielle.

### E2E

- Parcours complet organisateur : création → équipes → poules → génération → publication → résultats.
- Parcours public sur viewport mobile : sélection équipe → prochain match → résultats.
- Cas de calendrier impossible et d'absence de connexion temps réel.

## 16. Livrables attendus de Codex

- Code source organisé, typé, lisible et documenté.
- Schéma Prisma et migrations reproductibles.
- Jeu de données de démonstration (12 équipes, 3 poules, 3 terrains).
- Variables d'environnement décrites dans `.env.example`, sans secrets.
- README : prérequis, installation, démarrage, migrations, seed, tests, build et déploiement.
- Tests automatisés des règles métier critiques.
- Documentation courte des décisions techniques et des limites connues.
- UI responsive avec états vides, chargement et erreurs.

## 17. Ordre d'implémentation conseillé

1. Initialiser / inspecter le dépôt, fixer les conventions et l'architecture.
2. Créer le schéma de données, migrations et seed.
3. Implémenter l'authentification et l'isolation des organisateurs.
4. Implémenter les CRUD tournoi, terrains, équipes et poules.
5. Développer **et tester** le moteur de génération / planification indépendant de l'UI.
6. Ajouter la prévisualisation et la publication du calendrier.
7. Développer les pages publiques mobile-first et la sélection d'équipe persistante.
8. Ajouter les résultats, classements et rafraîchissement.
9. Ajouter les QR codes, contrôles de sécurité et tests E2E.
10. Finaliser la documentation et les scripts de déploiement.

## 18. Instructions de travail pour Codex

> Tu développes **Tournio** en suivant ce cahier des charges. Commence par inspecter le dépôt et expliquer brièvement l'architecture existante. Propose un plan d'implémentation par étapes, puis réalise le MVP de façon incrémentale. Priorise la fiabilité des règles métier, la sécurité des mutations, l'expérience mobile et les tests. Ne développe pas les fonctionnalités hors MVP. Ne supprime pas de code existant sans justification. Après chaque étape, exécute les vérifications pertinentes (lint, typecheck, tests, build) et signale précisément ce qui fonctionne et ce qui reste à faire. Si un choix métier bloque l'implémentation, pose une question ciblée plutôt que d'inventer une règle silencieusement.

## 19. Décisions à confirmer

Ces éléments sont volontairement paramétrables ou non figés :

- Sport(s) du premier tournoi pilote et mode de score exact (points simples ou sets).
- Nombre maximal d'équipes, de terrains et de matchs.
- Répartition manuelle ou automatique des équipes en poules (manuel en MVP).
- Politique de modification du calendrier une fois les matchs commencés.
- Méthode d'authentification et fournisseur d'hébergement.
- Règles de départage spécifiques aux disciplines.
- Gestion des matchs nuls et des forfaits.

**Règle de priorité :** si une décision non confirmée est indispensable, implémenter un comportement simple, configurable et documenté, ou demander confirmation avant de coder une logique difficile à modifier.
