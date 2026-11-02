# Tournio — Cahier des charges

Version : 1.0 — 2 novembre 2026
Statut : description du logiciel **tel qu’il est réalisé et vérifié**. Remplace la spécification initiale 0.1 du 31 octobre 2026.
Production : `https://tourn.rfonline.be` (Coolify). Marque affichée sur l’écran TV : « tournio. by rfonline ».

---

## 1. Vision

**Tournio** est une application web de gestion de tournois sportifs amateurs, indépendante du sport. Un organisateur crée un tournoi, inscrit des équipes, les répartit en poules, configure ses terrains, choisit le format de la suite du tournoi, génère et publie le calendrier, puis saisit les scores. Les participants suivent tout **sans compte**, sur une page publique en lecture seule, depuis leur téléphone. Un écran TV peut afficher le tournoi dans la salle.

**Promesse :** « Votre tournoi. Simplifié. »

### Principes

- **Personne n’est éliminé.** Après les poules, chaque équipe joue le même nombre de matchs et toutes les places sont disputées.
- Mobile-first pour les participants ; le dashboard organisateur est utilisable sur ordinateur, tablette et téléphone, au bord du terrain.
- Interface en français.
- Aucune authentification pour consulter un tournoi publié ; connexion Google uniquement pour les organisateurs.
- Toute mutation est contrôlée côté serveur (propriétaire, origine, version, état), jamais seulement dans l’interface.
- Mises à jour en direct, avec fonctionnement dégradé en cas de perte de connexion.
- Score numérique simple, sans figer un sport.
- Accessibilité WCAG 2.1 AA vérifiée automatiquement.

---

## 2. Périmètre

### Réalisé

1. Connexion des organisateurs par Google ; isolation stricte entre organisateurs.
2. Création et configuration d’un tournoi : informations, apparence, équipes, poules, terrains, format, règles.
3. Répartition des équipes en poules : manuelle (glisser-déposer ou sélecteur), tirage au sort, équipes de test.
4. Terrains disponibles par défaut sur toute la période ; saisie des seules indisponibilités.
5. Choix du format après les poules : poules uniquement, un match par rang, croisé en deux tours, tableau complet ; groupe incomplet géré à nombre de matchs égal.
6. Estimation de durée par format, matchs par équipe, conseils sur le nombre de poules.
7. Génération déterministe du calendrier des poules, prévisualisation (phase de classement prévisionnelle comprise), déplacements manuels revalidés, publication.
8. Saisie des résultats, lancement groupé d’un créneau, report, annulation, rétablissement, correction.
9. Phase de classement : tours générés à la demande, classement provisoire puis final.
10. Pages publiques du tournoi et de chaque équipe, écran TV 16:9, QR codes.
11. Thèmes et couleurs par tournoi, appliqués aux pages publiques, à la TV et au dashboard du tournoi.
12. Mises à jour en direct (SSE), polling de secours, rechargement automatique après un déploiement.
13. Démonstration temps réel publique (`/demo`) avec QR code.

### Hors périmètre actuel

- Notifications push, SMS, e-mail (idée validée, reportée).
- Plusieurs organisateurs par tournoi, interface arbitre.
- Décalage automatique de tous les matchs après un retard.
- Scores par set, tie-breaks spécifiques à une discipline, forfaits.
- Inscriptions publiques, paiements, statistiques historiques.
- Application native, internationalisation.

---

## 3. Rôles et droits

| Action | Visiteur / équipe | Organisateur propriétaire |
| --- | --- | --- |
| Voir un tournoi publié, une page équipe, l’écran TV | Oui | Oui |
| Choisir et suivre une équipe | Oui | Oui |
| Créer, configurer un tournoi | Non | Oui |
| Générer, déplacer, publier le calendrier | Non | Oui |
| Saisir, corriger un score ; lancer un tour | Non | Oui |
| Terminer, archiver un tournoi | Non | Oui |

- Un brouillon n’est jamais public : il répond comme un tournoi inexistant (404).
- Les liens publics et les QR codes ne donnent aucun droit d’écriture et ne contiennent aucune donnée personnelle.
- Un organisateur ne voit ni ne modifie les tournois d’un autre (404 sur toute ressource étrangère).

---

## 4. Parcours

### Organisateur

Le dashboard d’un tournoi suit l’ordre du travail, en sept onglets (gardés dans l’URL : `?onglet=…`). Un onglet complété porte une coche ✓.

| Onglet | Contenu | Coché quand |
| --- | --- | --- |
| **Paramètres** | Informations du tournoi, puis apparence | informations saisies |
| **Équipes et poules** | Équipes à gauche, poules à droite | ≥ 2 équipes par poule, toutes placées |
| **Terrains** | Terrains et indisponibilités | ≥ 1 terrain, chacun avec des créneaux |
| **Format et règles** | Format après les poules, puis règles | format choisi et compatible |
| **Calendrier** | Prévisualisation, enregistrement, publication, déplacements, archivage | tournoi publié |
| **Résultats** | Saisie par créneau, phase de classement, fin du tournoi | tournoi terminé |
| **Partage** | Lien public, QR code, écran TV | — |

Au-dessus des onglets : quatre indicateurs cliquables (matchs joués, équipes placées, poules, terrains et heures de créneaux), avec les points à régler en orange. Les retours d’action s’affichent en **notifications** (en haut à droite) ; les erreurs propres à un champ restent sous le champ.

### Participant

1. Ouvrir le lien ou scanner le QR code.
2. Choisir son équipe ; le choix est mémorisé sur l’appareil (stockage local, facultatif).
3. Voir en priorité le **prochain match** : adversaire, heure, terrain, poule ou libellé du match de classement, compte à rebours.
4. Suivre ses matchs, ses résultats et le classement, mis à jour en direct.

### Salle

Ouvrir l’écran TV (`/t/:slug/tv`) sur l’ordinateur relié à la télévision, passer en plein écran.

---

## 5. Écrans

### Public

| Route | Contenu |
| --- | --- |
| `/` | Page d’accueil (présentation, accès organisateur, démo) |
| `/demo` | Match de démonstration temps réel, QR code (adresse du réseau local en développement) |
| `/login` | Connexion Google uniquement |
| `/t/:slug` | Tournoi : choix d’équipe, calendrier filtrable par poule (`?poule=…`), classements |
| `/t/:slug/teams/:teamSlug` | Page équipe : prochain match, à venir, résultats, classement |
| `/t/:slug/tv` | Écran TV 16:9 |

**Page tournoi.** Bandeau aux couleurs du tournoi, badge « En direct » ou « Hors ligne ». Calendrier : heure, affiche, terrain, poule ou libellé (« Finale », « Places 3 et 4 », « Demi-finale »), état, score. Classements de poule (J, V, N, D, Diff., Pts) ; pendant la phase de classement, ils sont remplacés par le **classement du tournoi** provisoire (« en lice pour les places 1 à 4 »), puis par le **classement final**.

**Page équipe.** Carte « Prochain match » (en cours, prévu, reporté). Si l’équipe a fini ses matchs de poule et que la phase de classement n’est pas encore générée : « Phase de classement à venir — encore N matchs ; l’adversaire, le terrain et l’horaire seront annoncés à la fin des poules / du tour N ». « Plus aucun match prévu » seulement quand c’est vrai.

**Écran TV.** Sans défilement, taille de texte proportionnelle à l’écran (conçu pour 1920×1080, valable en 720p et 4K). Trois colonnes :
- *Sur les terrains* : un terrain par ligne (en cours, prochain, ou libre), puis *À suivre* ;
- *Classements* en rotation automatique (toutes les 12 s), ou les matchs du tour de classement en cours, ou le classement final ;
- *Derniers résultats*, QR code vers la page publique, puis la marque « tournio. by rfonline ».
En-tête : nom du tournoi, horloge dans le fuseau du tournoi, état de connexion, bouton plein écran. L’écran est maintenu allumé (Wake Lock) quand le navigateur le permet.

### Organisateur

| Route | Contenu |
| --- | --- |
| `/dashboard` | Mes tournois |
| `/dashboard/tournaments/new` | Création (nom, sport, lien public, lieu, fuseau, début, fin) |
| `/dashboard/tournaments/:id` | Configuration et suivi, en onglets |

Le dashboard d’un tournoi adopte le thème de ce tournoi. Navigation au clavier, confirmations avant les actions destructrices (bulle de confirmation sur la corbeille, confirmations de publication, archivage, tours).

---

## 6. Configuration d’un tournoi

### Paramètres

- **Informations** : nom, sport, identifiant du lien public, lieu, fuseau horaire IANA, début, fin. Une heure inexistante ou ambiguë (nuit du changement d’heure) est refusée avec un message clair.
- **Apparence** : 8 thèmes (Tournio, Sable, Forêt, Océan, Contraste élevé, Nuit, Halloween, Stade), clairs ou sombres, puis couleur principale et couleur d’accent personnalisables. Toutes les nuances dérivées garantissent un contraste AA ; une couleur trop claire garde sa teinte avec un texte noir. Aperçu en direct. Modifiable à tout moment avant l’archivage ; les spectateurs voient le changement en direct.

### Équipes et poules

- **Ajouter une équipe** : le nom seul ; l’identifiant du lien est généré (suffixe `-2`, `-3`… en cas de doublon).
- **Équipes de test** : génération de 1 à 64 équipes aux noms aléatoires et uniques (« Les Faucons », « Les Ours bleus »…), en une opération.
- **Ajouter une poule** : nom proposé automatiquement si le champ est vide (Poule A, B, C… puis AA).
- **Répartir au hasard** : toutes les équipes (équilibre à une équipe près, hasard cryptographique) ou seulement les équipes sans poule (vers les plus petites poules). La zone « Sans poule » liste les équipes à placer.
- **Glisser-déposer** (poignée ⠿) : d’une liste ou d’une poule vers une poule ou « Sans poule » ; souris, appui long sur téléphone, clavier (Espace, flèches, Espace, Échap) avec annonces pour les lecteurs d’écran. Affichage immédiat, rétabli si le serveur refuse.
- **Renommer** équipes, poules et terrains d’un clic (Entrée ou F2 au clavier ; Entrée enregistre, Échap annule). Le renommage garde l’identifiant du lien et reste permis après publication, jusqu’à l’archivage.
- **Supprimer** : corbeille avec bulle de confirmation, seulement sur un brouillon sans calendrier.

### Terrains

- Nom proposé automatiquement (Terrain 1, 2…).
- Un terrain est **disponible pendant toute la période du tournoi** ; l’organisateur ne saisit que les **indisponibilités** (fenêtre modale). Les indisponibilités se cumulent et se fusionnent ; « Rendre disponible » annule une indisponibilité, aussi après publication.
- Quand les dates du tournoi changent, les indisponibilités sont conservées et le reste suit la nouvelle période.

### Format et règles

**Format** (obligatoire, vide à la création ; le calendrier ne peut pas être généré tant qu’il n’est pas choisi) :

| Format | Principe | Matchs de classement par équipe | Condition |
| --- | --- | --- | --- |
| Poules uniquement | Classement par poule | 0 | — |
| Un match par rang | Les deux meilleurs premiers jouent la finale, etc. | 1 | nombre pair, ou groupe incomplet |
| Croisé en deux tours | Groupes de 4 : 1re–4e et 2e–3e, puis gagnants et perdants pour leurs places | 2 | multiple de 4, ou groupe incomplet |
| Tableau complet | Gagnants contre gagnants, perdants contre perdants | log₂ N | 4, 8, 16 ou 32 équipes |

Chaque carte de format affiche : matchs par équipe (« 5 matchs par équipe — 3 en poule + 2 en classement »), durée estimée, heure de fin, alerte si la fin prévue est dépassée. Les formats incompatibles sont grisés avec leur raison. Sous les cartes : le détail du format choisi (fonctionnement, exemple avec les vraies poules, répartition poules / classement).

**Conseils** : pour le format choisi, chaque nombre de poules est simulé (équipes réparties au plus juste) ; Tournio conseille d’**ajouter des poules** (le plus petit ajout qui fait tenir le tournoi), d’**en enlever** (s’il reste de la marge, sans descendre sous 3 équipes par poule), ou d’**ajouter des terrains / raccourcir les matchs** si rien ne tient. Un tableau compare toutes les options.

**Options** : groupe incomplet autorisé (voir § 7) ; pause minimale entre les tours de classement (0 à 600 min, après les poules comprise).

Le format reste modifiable après publication, tant que la phase de classement n’a pas commencé.

**Règles** (verrouillées une fois le calendrier créé) : durée d’un match, transition entre deux matchs sur un terrain, repos minimal d’une équipe, matchs nuls autorisés ou non, points victoire / nul / défaite, **horaires alignés**, départage à égalité de points (« points marqués d’abord » ou « différence d’abord »).

---

## 7. Règles sportives

### Poules

- Tous contre tous, aller simple (méthode du cercle, ordre canonique, repos pour les poules impaires) : `n × (n − 1) / 2` matchs par poule.
- Classement recalculé à la demande depuis les seuls résultats validés : points, puis départage choisi (points marqués ou différence), puis l’autre critère, puis un ordre stable.

### Phase de classement

- **Classement général** à l’issue des poules : tous les premiers, puis tous les deuxièmes… ; à rang égal, la meilleure moyenne par match (points, puis différence, puis points marqués).
- Moteur unique : tableau de classement par blocs de 2ᵏ places. Dans un bloc, les gagnants d’un tour se disputent la moitié haute des places, les perdants la moitié basse, jusqu’aux matchs qui fixent chaque place.
- **Groupe incomplet** (option, formats « un match par rang » et « croisé ») : les dernières équipes du classement général jouent des **mini-championnats à 3** (3 matchs, chacune en joue 2), pour que **chaque équipe joue le même nombre de matchs** :
  - croisé, reste 3 → 1 groupe de 3 ; reste 2 → les 6 dernières en 2 groupes de 3 ; reste 1 → les 9 dernières en 3 groupes de 3 ; 5 équipes → 1 groupe de 3 et un aller-retour ; 2 équipes → aller-retour ;
  - un match par rang, nombre impair → les 3 dernières en mini-championnat (2 matchs au lieu de 1 : personne ne joue moins).
  - Un mini-championnat se classe aux victoires, puis à la différence, puis aux points marqués, puis au classement général.
- Un match de classement **ne peut pas finir à égalité** (contrôle serveur et base).
- Les tours sont lancés par l’organisateur (onglet Résultats) ; le tour 1 dès que les poules sont jouées, le tour N+1 dès que le tour N est terminé. Un tour pas encore commencé peut être annulé.
- Verrous : dès le tour 1, les matchs de poule sont figés ; un tour est figé dès que le suivant existe ; un match de classement ne peut pas être annulé (seulement reporté).
- Le tournoi ne peut être terminé que lorsque toutes les places sont jouées (ou en « poules uniquement » quand tous les matchs sont clos).

---

## 8. Planification

### Contraintes dures

- Un terrain n’accueille pas deux matchs qui se chevauchent, transition comprise (intervalles semi-ouverts).
- Une équipe ne joue pas deux matchs sans le repos minimal (compté depuis la fin du match).
- Un match est entièrement dans une plage de disponibilité.
- Deux équipes ne se rencontrent qu’une fois par poule (une rencontre de classement peut rejouer une affiche de poule).
- Les matchs annulés ne bloquent ni terrain ni équipe.

### Moteur

- Placement **déterministe et borné** : à chaque étape, le match qui peut commencer le plus tôt, sur le premier terrain disponible.
- Impossibilités démontrées (capacité, durée des créneaux, horizon d’une équipe) distinguées d’une recherche infructueuse ; aucun calendrier partiel ou invalide n’est enregistré.
- **Horaires alignés** (option) : tous les matchs démarrent sur une grille commune à tous les terrains, de pas « durée + plus long des délais (transition, repos) », ancrée au début du tournoi.
- Instants stockés en UTC, affichés dans le fuseau du tournoi.

### Calendrier

- **Prévisualisation** sans écriture, puis enregistrement de la version prévisualisée (refus si le tournoi a changé entre-temps).
- La prévisualisation et le calendrier enregistré montrent la **phase de classement prévisionnelle** : tours numérotés, affiches indicatives (« 1er Poule A – 2e Poule B », « Vainqueur du match 3 – Vainqueur du match 4 »), terrains et horaires estimés après les poules et la pause.
- Déplacement manuel d’un match prévu ou reporté, revalidé par les mêmes contraintes.
- Après publication, seuls restent modifiables : noms des équipes, poules et terrains ; apparence ; format (avant la phase de classement) ; levée d’indisponibilités ; déplacements de matchs.
- Les tours de classement sont placés après le dernier match planifié, plus la pause entre les tours ; s’il manque des créneaux, l’erreur l’explique.

---

## 9. Déroulement et résultats

- Onglet Résultats : matchs regroupés **par créneau** (« 09:35 · 3 matchs ») ; filtre « À saisir / Tous » (`?matchs=tous`).
- **Lancer les N matchs** d’un créneau en une opération (tout ou rien, une seule mise à jour publique).
- Par match : marquer en cours, remettre à « prévu », valider le score (0 à 999), reporter (libère l’horaire et le terrain), annuler, rétablir (reprend son ancien créneau s’il est libre), corriger un résultat (le match reste terminé, le classement est recalculé).
- Carte « Phase de classement » : étape suivante, attente, génération et annulation de tour, classement final.
- **Terminer le tournoi**, puis **archiver** (lecture seule ; les pages publiques restent consultables).

### États

- Tournoi : `DRAFT` → `PUBLISHED` → `COMPLETED` → `ARCHIVED`.
- Match : `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `POSTPONED`, `CANCELLED` ; transitions vérifiées côté serveur.
- Un score n’est public qu’une fois validé ; un match annulé ne compte pas au classement ; un match reporté n’affiche pas d’horaire.

---

## 10. Modèle de données (schéma PostgreSQL `tournio`)

- **User, Session, Account, Verification** (Better Auth).
- **Tournament** : `id`, `owner_id`, `name`, `slug` (unique), `sport`, `location`, `timezone`, `starts_at`, `ends_at`, `status`, `published_at`, `theme`, `primary_color`, `accent_color`, `version`, dates.
- **TournamentRules** : `match_duration_minutes`, `transition_minutes`, `minimum_rest_minutes`, `allow_draw`, `aligned_slots`, `points_win`, `points_draw`, `points_loss`, `tie_break_order`, `final_format` (null tant que non choisi), `round_break_minutes`, `allow_incomplete`.
- **Team** : `id`, `tournament_id`, `name`, `slug` (unique dans le tournoi).
- **Pool**, **PoolTeam** (une poule au plus par équipe).
- **Court**, **CourtAvailability** (plages disponibles, sans chevauchement, dans les dates du tournoi).
- **Match** : `id`, `tournament_id`, `phase` (`POOL` ou `FINAL`), `pool_id` (null en phase de classement), `final_round`, `place_from`, `place_to`, `slot`, `home_team_id`, `away_team_id`, `court_id`, `starts_at`, `ends_at`, `status`, `home_score`, `away_score`, `result_validated_at`, `version`.
- **DemoMatch** (démonstration).

Contraintes en base : références au même tournoi, équipes distinctes, scores non négatifs, cohérence score / état, cohérence des phases, couleurs `#rrggbb`, formats connus, pas de nul en phase de classement, un tour de classement ne peut être généré deux fois. Les classements ne sont jamais stockés : ils sont recalculés.

---

## 11. API (`/api/v1`, JSON, validation Zod stricte)

### Publique (lecture seule)

- `GET /tournaments/:slug` — instantané public (liste blanche stricte : ni propriétaire, ni e-mail, ni disponibilités) : tournoi, apparence, poules, équipes, terrains, matchs, classements, `placement { format, rounds, ranking, standing }`.
- `GET /tournaments/:slug/events` — flux SSE : `ready`, `tournament.updated { version }`, `ping` (15 s), `retry`, `unavailable`, `removed`.

### Organisateur (session + contrôle d’origine)

- `GET|POST /admin/tournaments` ; `GET|PATCH /admin/tournaments/:id` (commandes de configuration : informations, règles, équipes, équipes en lot, poules, tirage au sort, terrains, disponibilités et indisponibilités, apparence, format).
- `GET|POST /admin/tournaments/:id/schedule` (prévisualisation ; générer, effacer, déplacer, publier, générer / annuler un tour de classement, terminer, archiver).
- `POST /admin/tournaments/:id/matches` (lancement groupé) ; `POST /admin/tournaments/:id/matches/:matchId` (état et résultat d’un match).
- `GET /health` — sonde de santé (200 si PostgreSQL répond, 503 sinon).

Chaque écriture porte une **version attendue** (tournoi, ou match pour les résultats) : une version périmée est refusée (409). Erreurs : `{ error: { code, message, fieldErrors?, requestId } }` ; 400, 401, 403 (origine), 404, 409, 422, 503. Détail : `docs/api/organisation.md`.

---

## 12. Temps réel et cohérence

- Triggers PostgreSQL sur `tournaments` et `matches` → `NOTIFY tournio_tournaments` ; une connexion `LISTEN` par processus ; diffusion SSE après commit.
- Les événements ne portent que la version : le client recharge l’instantané public, seule source de vérité, et ignore une version plus ancienne.
- Coupure détectée par l’erreur du flux, l’événement `offline` ou 40 s sans `ping` : polling toutes les 20 s, puis réouverture du flux.
- Si l’instantané reçu ne correspond plus au code de la page (déploiement), la page se recharge (au plus une fois par minute).
- Plafond de flux par processus (`TOURNIO_MAX_STREAMS`, 2000) ; une seule lecture de version par changement, partagée par tous les flux.
- Transactions avec verrou du tournoi (`SELECT … FOR UPDATE`) ; versions optimistes contre les écrasements concurrents.

---

## 13. Stack technique

- **Next.js 16** (App Router, Route Handlers, Node.js), **React 19**, TypeScript.
- **Mantine 9** (`@mantine/core`, `@mantine/notifications`), **nuqs** (état d’URL), **@dnd-kit/core** (glisser-déposer), `qrcode`.
- **PostgreSQL** privé, **Prisma 7** (adaptateur `pg`), migrations versionnées.
- **Better Auth** : sessions en base, cookies HTTP-only, Google uniquement (mot de passe réservé aux tests isolés, `TOURNIO_ISOLATED_TEST`).
- **Zod 4**, **Temporal** (fuseaux horaires).
- Domaine métier pur et testé dans `src/lib/domain/` (round-robin, planification, classements, phase de classement, disponibilités, estimations, conseils, tirage).

---

## 14. Sécurité, confidentialité, accessibilité

- Contrôle propriétaire sur chaque route et chaque ressource enfant ; contrôle d’origine (CSRF) sur toutes les écritures.
- Limitation de débit Better Auth ; journalisation sans données sensibles.
- En-têtes : HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `Permissions-Policy`.
- Aucune donnée personnelle de participant publiée ; instantané public en liste blanche.
- **Accessibilité** : WCAG 2.1 AA vérifiée par axe-core sur tout le parcours (contrastes, noms accessibles, clavier), contraste garanti pour tous les thèmes et couleurs, navigation clavier complète (onglets ARIA, renommage, glisser-déposer annoncé), préférence de mouvement réduit respectée.

---

## 15. Déploiement et exploitation

- Coolify (Nixpacks, Node 24), démarrage `next start --hostname 0.0.0.0 --port 3000`, healthcheck `/api/health`, une instance.
- Avant chaque déploiement : `npm run db:migrate`. **Jamais `prisma db push`** (il ignore triggers et contraintes, et désynchronise l’historique) ; une base déjà touchée se répare avec `scripts/reconcile-migrations.ts`.
- Variables : `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PG_SSL_CA_FILE` (facultatif), `TOURNIO_MAX_STREAMS` (facultatif). Ne jamais définir `TOURNIO_ISOLATED_TEST` en production.
- Capacité mesurée (un processus, poste local) : 1000 spectateurs en direct, diffusion d’un score en moins d’une seconde (p95) ; ~1500 ouvertures de page par seconde. Détail : `docs/deploiement.md`.

---

## 16. Qualité et tests

`npm run test:local` crée un PostgreSQL Docker jetable, applique les migrations, compile la production et exécute :
- **unitaires** (`test:unit`) : round-robin, placement, validation, classements, transitions, phase de classement (tous les nombres d’équipes de 2 à 40 : chaque équipe joue le même nombre de matchs), disponibilités, estimations, conseils, tirage, thèmes et contrastes, horaires alignés, TV ;
- **métier** (`test:integration`, `test:placement`) : isolation, CSRF, concurrence, calendrier, publication, résultats, phase de classement (complète et incomplète), lancement groupé, verrous ;
- **OAuth** (`test:google`), **temps réel** (`test:realtime`) ;
- **navigateur** (`test:e2e`, Playwright, Chromium et WebKit iPhone) : parcours complet au clavier, onglets cochés, glisser-déposer, renommage, thèmes (sombre compris), page publique sur iPhone dans un autre fuseau sans stockage local, perte et reprise du réseau, écran TV 1080p / 720p, accessibilité axe-core et contraste au survol, aucune erreur console ;
- **capacité** (`test:capacity`).

---

## 17. Critères d’acceptation (atteints)

1. Un organisateur crée un tournoi de 12 équipes, 3 poules de 4 et 3 terrains, choisit son format et génère 18 matchs valides.
2. Aucun match ne viole les contraintes de terrain, d’équipe, de disponibilité et de repos ; une planification impossible est expliquée et rien n’est enregistré.
3. Le calendrier ne peut pas être généré tant que le format n’est pas choisi.
4. Un brouillon n’est pas consultable ; un tournoi publié l’est sans connexion, sur téléphone, dans le fuseau du tournoi.
5. Un participant retrouve son équipe et son prochain match ; il est prévenu des matchs de classement à venir.
6. Un score saisi apparaît en direct sur les téléphones et la TV, ou par polling en cas de coupure.
7. La phase de classement fait jouer à chaque équipe le même nombre de matchs et produit un classement final complet.
8. Un visiteur ne peut rien modifier ; deux organisateurs ne peuvent pas modifier les tournois l’un de l’autre.
9. L’application est accessible (WCAG 2.1 AA) et utilisable au clavier.

---

## 18. Limites connues

- Les estimations supposent des terrains disponibles sans interruption entre le début et la fin du tournoi (indisponibilités non prises en compte).
- Avant le tour 1, une page équipe annonce le nombre de tours du format, sans tenir compte d’un éventuel groupe incomplet.
- Une seule instance validée ; capacité mesurée en local, à confirmer en production.
- Connexion Google réelle et rendu sur un vrai téléphone vérifiés manuellement.
- L’adaptateur Prisma émet un avertissement `pg` sans effet (requêtes concurrentes dans une transaction).

## 19. Évolutions envisagées

- Notifications push aux appareils qui suivent une équipe.
- Aller-retour optionnel quand deux équipes restent seules en « un match par rang ».
- Décalage automatique des matchs après un retard ; forfaits.
- Plusieurs organisateurs, rôle arbitre.
