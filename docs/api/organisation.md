# API organisateur — socle métier

Toutes les réponses sont JSON et `Cache-Control: no-store`. Les lectures et mutations administratives exigent une session Better Auth valide. Les mutations exigent également une origine égale à celle de `BETTER_AUTH_URL`.

| Route | Action | Réponse |
| --- | --- | --- |
| `GET /api/v1/admin/tournaments` | Tournois du propriétaire connecté | `{ tournaments: [...] }` |
| `POST /api/v1/admin/tournaments` | Création d’un brouillon avec règles par défaut | 201 `{ configuration: ... }` |
| `GET /api/v1/admin/tournaments/:id` | Configuration complète d’un tournoi du propriétaire | `{ configuration: ... }` |
| `PATCH /api/v1/admin/tournaments/:id` | Modification transactionnelle de configuration | `{ configuration: ... }` |

Création et opération `update_tournament` : `name`, `slug`, `sport`, `location`, `timezone`, `starts_at`, `ends_at`. Les dates sont ISO 8601 avec décalage explicite. `owner_id`, statut, version et dates de publication ne peuvent pas être définis par le client.

Une commande PATCH contient `expected_version`, `operation` et `payload` strict :

| Opération | Payload |
| --- | --- |
| `update_tournament` | Informations complètes ci-dessus |
| `save_rules` | `match_duration_minutes`, `transition_minutes`, `minimum_rest_minutes`, `allow_draw`, `aligned_slots` (facultatif, `false` par défaut : départs sur une grille commune, pas = durée + plus long délai entre transition et repos, ancrée au début du tournoi), `points_win`, `points_draw`, `points_loss`, `tie_break_order` (`[points, score_difference, scores_for, team_id]` ou `[points, scores_for, score_difference, team_id]`) |
| `set_final_format` | `final_format` : `none`, `rank`, `cross` ou `bracket` (voir « Phase de classement ») ; `round_break_minutes` (0 à 600) : pause minimale avant chaque tour de classement, après les poules comprises |
| `create_team` | `name`, `slug` |
| `update_team` | `id`, `name`, `slug` |
| `delete_team` | `id` |
| `create_pool`, `create_court` | `name` |
| `update_pool`, `update_court` | `id`, `name` |
| `delete_pool`, `delete_court`, `delete_availability` | `id` |
| `assign_team` | `team_id`, `pool_id` ; `null` retire l’affectation |
| `draw_pools` | `mode` : `all` (nouveau tirage de toutes les équipes) ou `unassigned` (seulement les équipes sans poule, vers les poules les plus petites) ; poules équilibrées à une équipe près, hasard cryptographique côté serveur |
| `create_availability` | `court_id`, `starts_at`, `ends_at` (bas niveau ; l’interface utilise les indisponibilités) |
| `add_unavailability`, `remove_unavailability` | `court_id`, `starts_at`, `ends_at` : retire ou rend disponible une période ; les plages sont recalculées et fusionnées |
| `update_appearance` | `theme` (`tournio`, `sable`, `foret`, `ocean`, `contraste`, `nuit`, `halloween`, `stade`), `primary_color`, `accent_color` : `#rrggbb` ou `null` (couleurs du thème) |

Un terrain créé est disponible pendant toute la période du tournoi ; l’organisateur n’indique que ses indisponibilités. Quand les dates du tournoi changent, les indisponibilités sont conservées et le reste des plages suit la nouvelle période.

Les opérations ne sont autorisées que sur un brouillon sans matchs, sauf : `set_final_format` (brouillon ou publié, tant que la phase de classement n’a pas commencé ; 422 si le format ne convient pas aux poules), `create_availability` et `remove_unavailability` (aussi après publication : ajoutent de la capacité sans déplacer de match) et `update_appearance` : purement visuelle, elle reste possible après publication et jusqu’à l’archivage (409 ensuite). Le thème et les couleurs sont publics (`tournament.theme`, `primary_color` et `accent_color` dans l’instantané) et s’appliquent en direct. Toutes les nuances dérivées (texte secondaire, liens, boutons, badges en thème sombre) sont calculées pour garder un contraste AA. Le dashboard d’un tournoi ouvert adopte aussi son thème. Une suppression de poule désaffecte ses équipes ; une suppression de terrain retire ses disponibilités. Les équipes restent inscrites lors d’une suppression de poule.

`configuration` contient `tournament`, `rules`, `teams`, `pools`, `pool_teams`, `courts`, `availabilities`, `matches`, `match_count`. Le propriétaire et les données d’authentification ne sont pas sérialisés.

## Calendrier

- `GET /api/v1/admin/tournaments/:id/schedule` : prévisualisation, **sans écriture**. Réponse `{ preview: { version, status, reasons, matches, save_blockers } }`. `status` vaut `ready`, `blocked` (configuration incomplète), `impossible` (impossibilité démontrée : capacité des terrains, durée des plages, repos) ou `not_found` (aucune solution trouvée sans preuve d’impossibilité).
- `POST /api/v1/admin/tournaments/:id/schedule` : `{ operation, expected_version, payload }`, sous verrou du tournoi. Réponse `{ configuration }`.
  - `generate` `{ replace }` : recalcule côté serveur le calendrier de la configuration relue sous verrou et l’enregistre. Passer la `version` de la prévisualisation : si le tournoi a changé, 409. `replace: true` est exigé si un calendrier existe. Refusé (409) après publication ou dès qu’un match a commencé ou reçu un score.
  - `clear` `{}` : supprime le calendrier d’un brouillon (mêmes conditions) ; la configuration redevient modifiable.
  - `move_match` `{ match_id, court_id, starts_at }` : brouillon ou tournoi publié ; match prévu ou reporté uniquement. La fin est recalculée avec la durée des règles ; terrain, disponibilité, transition et repos sont revérifiés (422 sinon).
  - `publish` `{}` : brouillon avec un calendrier complet et sans conflit → `PUBLISHED`.
  - `complete` `{}` : tournoi publié dont tous les matchs sont terminés ou annulés → `COMPLETED`. Seules les corrections de résultats restent possibles.
  - `archive` `{}` : tournoi publié ou terminé → `ARCHIVED` ; toute mutation est ensuite refusée (409).

## Phase de classement

Après les poules, aucune équipe n’est éliminée : chacune joue le même nombre de matchs supplémentaires et toutes les places sont disputées. Le format est choisi dans les règles (`set_final_format`) :

| Format | Principe | Matchs en plus | Condition |
| --- | --- | --- | --- |
| `none` | Poules uniquement | 0 | — |
| `rank` | Un match par rang : les deux meilleurs premiers jouent la finale, etc. | 1 | nombre d’équipes pair |
| `cross` | Groupes de 4 du classement général : 1re–4e et 2e–3e, puis gagnants et perdants jouent pour leurs places | 2 | multiple de 4 |
| `bracket` | Tableau complet : à chaque tour, gagnants contre gagnants, perdants contre perdants | log₂ N | 4, 8, 16 ou 32 équipes |

Classement général à l’issue des poules : tous les premiers, puis tous les deuxièmes… ; à rang égal, la meilleure moyenne par match (points, différence, scores marqués). Moteur pur : `src/lib/domain/placement.ts`.

Commandes `POST /schedule` (version du tournoi) :

- `generate_final_round` : génère le tour suivant (tour 1 quand toutes les poules sont jouées, tour N+1 quand le tour N est entièrement terminé), placé sur les terrains après le dernier match planifié. 409 si une condition manque, 422 s’il ne reste pas assez de créneaux (ajouter une disponibilité).
- `cancel_final_round` : supprime le dernier tour tant qu’aucun de ses matchs n’a commencé.
- `complete` : refusé tant que la phase de classement choisie n’a pas fixé toutes les places.

Verrous : dès le tour 1, les matchs de poule sont figés ; un tour est figé dès que le suivant existe ; un match de classement ne peut ni finir à égalité (422) ni être annulé (409). Les matchs de classement ont `phase = FINAL`, `pool_id = null`, `final_round`, `place_from`, `place_to` (plage de places disputée) et `slot`. L’instantané public expose ces champs et `placement { format, rounds, ranking }` (classement final, ou `null`).

## Résultats et états des matchs

`POST /api/v1/admin/tournaments/:id/matches` avec `{ matches: [{ id, expected_version }] }` (1 à 32) lance plusieurs matchs prévus d’un coup, typiquement tout un créneau : tout ou rien (409 si l’un est périmé ou n’est plus prévu), une seule version de tournoi donc une seule mise à jour publique. L’onglet Résultats regroupe les matchs par créneau et propose « Lancer les N matchs ».

`POST /api/v1/admin/tournaments/:id/matches/:matchId` : `{ operation, expected_version, payload }`, où `expected_version` est la **version du match**. Deux matchs différents peuvent donc être saisis en parallèle ; une double soumission ou une correction concurrente du même match reçoit 409. Chaque commande verrouille le tournoi, contrôle propriétaire, état et nuls, incrémente la version du match et celle du tournoi (ordre des instantanés publics). La notification publique part au commit. Réponse `{ configuration }`.

- `start` `{}` : prévu → en cours.
- `reset` `{}` : en cours → prévu.
- `record_result` `{ home_score, away_score }` (entiers 0–999) : prévu ou en cours → terminé. Sur un match terminé, c’est une **correction** : le match reste terminé et les classements sont recalculés. Nul refusé (422) si le tournoi ne l’autorise pas.
- `postpone` `{}` : prévu ou en cours → reporté ; terrain et horaire sont libérés. Replanifier avec `move_match`.
- `cancel` `{}` : le match ne compte plus au classement et ne bloque plus son créneau.
- `reinstate` `{}` : annulé → prévu sur son ancien créneau s’il est encore libre (422 sinon), ou reporté s’il n’en avait pas.

Autorisé sur un tournoi publié ; sur un tournoi terminé, seule la correction de résultat est acceptée ; brouillon et archive : 409.

La configuration (`PATCH`) est verrouillée dès qu’un calendrier existe ou après publication.

## Consultation publique (sans authentification)

- `GET /api/v1/tournaments/:slug` : `{ tournament }`, instantané d’un tournoi `PUBLISHED`, `COMPLETED` ou `ARCHIVED`. Un brouillon répond 404, comme un tournoi inexistant. Liste blanche stricte (`src/lib/public/contracts.ts`) : nom, sport, lieu, fuseau, dates et version ; poules, équipes (nom, lien, poule), terrains ; matchs (horaire, terrain, état, score uniquement s’il est validé) ; classements recalculés à chaque requête. Aucun propriétaire, e-mail, disponibilité ou date interne.
- `GET /api/v1/tournaments/:slug/events` : flux SSE. Événements `ready` (aussi après reconnexion : recharger l’instantané), `tournament.updated { version }`, `retry`, `unavailable`, `removed`. Le signal ne transporte aucune donnée ; le client recharge l’instantané et ignore une version plus ancienne que celle affichée. Repli par polling toutes les 20 s.
- Pages : `/t/:slug` (choix de l’équipe, calendrier filtrable par poule, classements) et `/t/:slug/teams/:teamSlug` (prochain match, matchs à venir, résultats, classement de la poule). L’équipe ouverte par URL devient la préférence mémorisée sur l’appareil pour ce tournoi.
- Écran TV : `/t/:slug/tv`, pour une télévision ou un projecteur 16:9 (conçu pour 1920×1080, sans défilement). Terrains (match en cours ou prochain), matchs à suivre, classements en rotation automatique, derniers résultats, QR code vers la page publique, horloge du fuseau du tournoi. Thème du tournoi, mises à jour en direct, écran maintenu allumé (Wake Lock) et bouton plein écran. Lien dans l’onglet Partage.

Les notifications viennent de triggers PostgreSQL sur `tournaments` et `matches` (canal `tournio_tournaments`, migration `202611010001_public_tournament_events`).

Erreurs : `{ error: { code, message, fieldErrors?, requestId } }`.

- 400 : JSON invalide.
- 401 : session absente ou révoquée.
- 403 : origine refusée.
- 404 : ressource absente, d’un autre propriétaire ou enfant d’un autre tournoi.
- 409 : version périmée, doublon, configuration verrouillée, régénération refusée ou tournoi archivé.
- 422 : validation de champs, disponibilité invalide, référence incohérente, calendrier impossible ou déplacement en conflit.
- 503 : service/base indisponible.

Les routes d’authentification standard Better Auth sont sous `/api/auth/*`. Le point de compatibilité `/api/auth` fournit GET (session limitée à l’e-mail), POST (connexion par mot de passe, uniquement dans les tests isolés ; 404 sinon) et DELETE (déconnexion) pour les formulaires existants.

Le prototype public utilise `GET /api/demo`, `POST /api/demo`, `PATCH /api/demo/:id` et `GET /api/demo/:id/events`. Le dernier renvoie `text/event-stream` pour un match publié : événements `ready`, `match.updated`, `retry`, `unavailable`, `removed`. Il vérifie la visibilité avant ouverture et avant diffusion d’un résultat. Aucun jeton de session n’est transmis dans le flux.
