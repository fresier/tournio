# Plan 003 — PostgreSQL privé, Prisma et Better Auth

Mis à jour le 1er novembre 2026. Plan actif du MVP ; `TOURNIO_SPEC.md` reste la référence métier.

## Stack retenue

Next.js App Router / React / TypeScript ; PostgreSQL privé via `DATABASE_URL` ; Prisma 7.10.1 avec migrations versionnées ; Better Auth 1.7.14 ; validation Zod ; conversion des fuseaux avec Temporal. Temps réel : PostgreSQL `LISTEN/NOTIFY`, SSE Next.js et polling de secours.

L’application possède ses tables dans le schéma `tournio`. Les autorisations sont appliquées côté serveur avec les contrôles d’intégrité SQL complémentaires.

## État du socle

| Lot | Livrable | État |
| --- | --- | --- |
| A | Architecture Prisma, Better Auth et SSE | Réalisé et vérifié sur PostgreSQL isolé et privé |
| B | Modèle complet, contraintes, migrations et seed 12 équipes / 3 poules / 3 terrains | Réalisé et appliqué sur PostgreSQL privé |
| C | Dashboard, connexion, CRUD et affectations manuelles avec isolation propriétaire | Réalisé ; tests HTTP réussis, revue visuelle à effectuer |
| Connexion privée | Appliquer les migrations/seed à `DATABASE_URL` | Réalisé ; TLS actif en mode require, tests métier et SSE réussis |
| Google | Connexion Google avant le moteur de calendrier | Réalisé ; tests automatisés réussis et connexion réelle sur localhost confirmée par l’utilisateur |
| D | Domaine pur : rencontres, contraintes, classements et états | TODO |
| E | Prévisualisation, sauvegarde sûre du calendrier et publication | TODO après D |
| F | Pages publiques de tournoi/équipe, sélection persistante et QR | TODO après E |
| G | Résultats métier, corrections, classements et actualisation publique | TODO après D–F |
| H | Accessibilité visuelle, E2E navigateur, capacité et préparation de production | TODO |

La configuration est limitée aux brouillons sans matchs. Cette protection devra être précisée au lot E pour permettre les ajustements manuels autorisés après publication sans écraser de résultats. Le départage reste : points, différence de scores, scores marqués, identifiant stable.

## Vérifications présentes

- `npm run db:validate`, `npm run db:generate`, `npm run db:migrate` et `npm run db:status`.
- `npm run db:seed`, idempotent et sans remplacement des identifiants existants.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`.
- `npm run test:integration` et `npm run test:realtime` contre l’application locale.
- `npm run test:local` : PostgreSQL Docker jetable, migrations/seed relancés, build de production, API métier et vrai flux SSE, avec interruption et reconnexion du canal PostgreSQL. La base privée n’est pas utilisée pour ce scénario.

## Détails des prochains lots

- **D — Domaine indépendant.** Générer les rencontres par la méthode du cercle, avec ordre canonique, repos pour les effectifs impairs et aucune paire inversée. Un validateur distinct contrôle les intervalles semi-ouverts, l’occupation terrain incluant la transition, le repos depuis la fin du match et les disponibilités. Le placement est déterministe et borné ; distinguer une recherche infructueuse d’une impossibilité démontrée. Pour 3 poules de 4, le pilote faisable doit produire exactement 18 matchs acceptés par ce validateur. Les classements sont recalculés depuis les seuls résultats validés de matchs terminés.
- **E — Calendrier et publication.** Prévisualiser sans écriture métier. Sauvegarder en une transaction sous verrou du tournoi, avec contrôle de propriétaire/version et revalidation serveur ; rejeter une prévisualisation périmée avec 409. Employer le même verrou pour les changements d’entrées, les déplacements manuels et les reports. Aucun calendrier partiel ne peut être publié ; les matchs commencés et les résultats sont préservés. La publication revalide l’ensemble du tournoi ; l’archivage bloque les mutations.
- **F — Consultation publique.** Ajouter les vues tournoi/équipe, filtres, liens et QR codes. Les brouillons sont invisibles et les réponses excluent les données privées. L’URL d’équipe prime sur la préférence locale, enregistrée par tournoi. Afficher les horaires dans le fuseau du tournoi, avec états de retard, report et déconnexion explicites. Les flux et le polling ignorent les versions anciennes et rechargent un snapshot après reconnexion.
- **G — Résultats.** Valider et corriger les scores transactionnellement avec les contrôles de propriétaire, version, état et autorisation des nuls. Une correction conserve le match terminé et recalcule les classements. Diffuser les événements publics seulement après commit. Vérifier les doubles soumissions et les corrections concurrentes.
- **H — Validation de livraison.** Parcours navigateur complet du pilote 12/3/3, consultation mobile, clavier, fuseau différent, stockage local indisponible et perte/reprise du réseau. Mesurer la capacité et poser les limites serveur après mesure. Préparer HTTPS, cookies, migrations et exploitation sur la cible retenue.

Ces points conservent les exigences utiles du cadrage initial sans dépendre de son ancienne organisation en monorepo. Ils complètent le cahier des charges sans étendre le MVP.

## Connexion à la base privée

La connexion utilise l’URL fournie avec `sslmode=require`, complétée localement par `uselibpqcompat=true` pour retrouver la sémantique libpq dans `pg` 8. TLS est obligatoire ; sans CA, le certificat et l’identité du serveur ne sont pas vérifiés. Pour demander aussi cette vérification, fournir une chaîne reconnue ou une CA privée via `PG_SSL_CA_FILE`.

Le schéma `tournio` a été contrôlé vide avant application des deux migrations. Le seed et les tests métier/temps réel ont réussi sur cette base le 1er novembre 2026. Pour les évolutions suivantes : `npm run db:migrate`, puis si nécessaire `npm run db:seed` ; ne pas utiliser `migrate reset` ou `db push`. Si des tables non suivies par Prisma existent dans le schéma, examiner leur compatibilité avant migration. Voir le [compte rendu](../docs/verification-prisma.md) pour les preuves et limites.

Les fonctions hors MVP restent exclues. Les prochaines fonctionnalités doivent conserver les vérifications propriétaire sur chaque ressource enfant, les versions optimistes et les transactions de calendrier/résultat.
