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
| `save_rules` | `match_duration_minutes`, `transition_minutes`, `minimum_rest_minutes`, `allow_draw`, `points_win`, `points_draw`, `points_loss` |
| `create_team` | `name`, `slug` |
| `update_team` | `id`, `name`, `slug` |
| `delete_team` | `id` |
| `create_pool`, `create_court` | `name` |
| `update_pool`, `update_court` | `id`, `name` |
| `delete_pool`, `delete_court`, `delete_availability` | `id` |
| `assign_team` | `team_id`, `pool_id` ; `null` retire l’affectation |
| `create_availability` | `court_id`, `starts_at`, `ends_at` |

Les opérations ne sont autorisées que sur un brouillon sans matchs. Une suppression de poule désaffecte ses équipes ; une suppression de terrain retire ses disponibilités. Les équipes restent inscrites lors d’une suppression de poule.

`configuration` contient `tournament`, `rules`, `teams`, `pools`, `pool_teams`, `courts`, `availabilities`, `match_count`. Le propriétaire et les données d’authentification ne sont pas sérialisés.

Erreurs : `{ error: { code, message, fieldErrors?, requestId } }`.

- 400 : JSON invalide.
- 401 : session absente ou révoquée.
- 403 : origine refusée.
- 404 : ressource absente, d’un autre propriétaire ou enfant d’un autre tournoi.
- 409 : version périmée, doublon ou configuration verrouillée.
- 422 : validation de champs, disponibilité invalide ou référence incohérente.
- 503 : service/base indisponible.

Les routes d’authentification standard Better Auth sont sous `/api/auth/*`. Le point de compatibilité `/api/auth` fournit GET (session limitée à l’e-mail), POST (connexion) et DELETE (déconnexion) pour les formulaires existants.

Le prototype public utilise `GET /api/demo`, `POST /api/demo`, `PATCH /api/demo/:id` et `GET /api/demo/:id/events`. Le dernier renvoie `text/event-stream` pour un match publié : événements `ready`, `match.updated`, `retry`, `unavailable`, `removed`. Il vérifie la visibilité avant ouverture et avant diffusion d’un résultat. Aucun jeton de session n’est transmis dans le flux.
