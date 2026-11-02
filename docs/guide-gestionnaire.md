# Tournio — Guide du gestionnaire de tournoi

Version du 2 novembre 2026, basée sur le [cahier des charges Tournio 1.0](../TOURNIO_SPEC.md).

Ce guide s’adresse à la personne qui prépare et gère un tournoi dans Tournio. Dans l’application, ce rôle est appelé **organisateur**. Il explique comment configurer le tournoi, publier son calendrier, gérer les résultats et communiquer avec les équipes. Aucune connaissance technique n’est nécessaire.

**Accès à l’application : [tourn.rfonline.be](https://tourn.rfonline.be).** Un compte Google est nécessaire pour gérer un tournoi. Les équipes et les spectateurs consultent les informations sans compte.

## Sommaire

- [1. Se connecter et se repérer](#1-se-connecter-et-se-repérer)
- [2. Créer le tournoi et régler les paramètres](#2-créer-le-tournoi-et-régler-les-paramètres)
- [3. Inscrire les équipes et composer les poules](#3-inscrire-les-équipes-et-composer-les-poules)
- [4. Préparer les terrains](#4-préparer-les-terrains)
- [5. Choisir le format et les règles](#5-choisir-le-format-et-les-règles)
- [6. Prévisualiser, enregistrer et publier le calendrier](#6-prévisualiser-enregistrer-et-publier-le-calendrier)
- [7. Partager le tournoi et installer la TV](#7-partager-le-tournoi-et-installer-la-tv)
- [8. Gérer les matchs et les résultats](#8-gérer-les-matchs-et-les-résultats)
- [9. Organiser la phase de classement](#9-organiser-la-phase-de-classement)
- [10. Terminer puis archiver le tournoi](#10-terminer-puis-archiver-le-tournoi)
- [11. Savoir ce qui reste modifiable](#11-savoir-ce-qui-reste-modifiable)
- [12. Résoudre les difficultés courantes](#12-résoudre-les-difficultés-courantes)
- [13. Fiche pratique du jour J](#13-fiche-pratique-du-jour-j)

## 1. Se connecter et se repérer

1. Ouvrez [l’espace organisateur](https://tourn.rfonline.be/dashboard).
2. Si nécessaire, cliquez sur **Continuer avec Google** et connectez-vous.
3. Dans **Mes tournois**, créez un tournoi ou cliquez sur **Configurer** pour reprendre un tournoi existant.

La première connexion crée votre compte organisateur. Utilisez ensuite le même compte Google pour retrouver vos tournois. Chaque tournoi appartient à son créateur : la gestion à plusieurs organisateurs et le rôle d’arbitre ne sont pas disponibles actuellement.

Le tableau de bord d’un tournoi suit l’ordre de préparation en sept onglets :

| Onglet | À quoi sert-il ? |
| --- | --- |
| **Paramètres** | Renseigner les informations et choisir l’apparence. |
| **Équipes et poules** | Inscrire les équipes et les répartir. |
| **Terrains** | Créer les terrains et indiquer leurs indisponibilités. |
| **Format et règles** | Choisir la suite des poules, les durées et le barème. |
| **Calendrier** | Prévisualiser, enregistrer, publier et déplacer les matchs ; archiver le tournoi. |
| **Résultats** | Lancer les matchs, saisir les scores, générer les tours de classement et terminer le tournoi. |
| **Partage** | Retrouver le lien public, le QR code et l’écran TV. |

Les coches ✓ signalent les étapes complétées. Les indicateurs en haut de page sont cliquables ; les points à régler apparaissent en orange. Après une action, vérifiez la notification de confirmation en haut à droite. Les erreurs de saisie apparaissent sous les champs concernés.

## 2. Créer le tournoi et régler les paramètres

Dans **Mes tournois**, cliquez sur **Créer un tournoi**, puis renseignez :

| Champ | Ce qu’il faut saisir |
| --- | --- |
| **Nom du tournoi** | Le nom affiché aux participants. |
| **Sport** | La discipline ou une description, par exemple « Badminton » ou « Multisport ». |
| **Identifiant du lien public** | La partie personnalisée de l’adresse du tournoi. Utilisez des lettres minuscules sans accent, des chiffres et des tirets, par exemple `tournoi-du-club`. |
| **Lieu** | La salle, le club ou l’adresse, si utile. |
| **Fuseau horaire** | Le fuseau du lieu du tournoi, par exemple `Europe/Brussels`. |
| **Début / Fin** | La période dans laquelle les matchs doivent se dérouler. |

L’identifiant du lien est proposé à partir du nom ; vous pouvez l’ajuster avant la création. Il doit être disponible. Avec l’identifiant `tournoi-du-club`, le lien public sera `https://tourn.rfonline.be/t/tournoi-du-club`.

Cliquez sur **Créer le tournoi en brouillon**. À ce stade, vous seul pouvez le consulter. Les participants n’y auront accès qu’après publication.

Toutes les heures sont interprétées et affichées dans le fuseau du tournoi, y compris sur les téléphones des spectateurs. Si une heure est refusée pendant un changement d’heure, choisissez une heure qui ne se répète pas et qui existe dans ce fuseau.

Dans **Paramètres**, vous pouvez ensuite :

- modifier les informations, puis cliquer sur **Enregistrer les informations** ;
- choisir l’un des huit thèmes : Tournio, Sable, Forêt, Océan, Contraste élevé, Nuit, Halloween ou Stade ;
- personnaliser les couleurs principale et d’accent et vérifier l’aperçu avant d’enregistrer l’apparence.

L’apparence s’applique au tableau de bord du tournoi, aux pages publiques et à la TV. Vous pouvez encore la modifier après publication, jusqu’à l’archivage.

## 3. Inscrire les équipes et composer les poules

### Ajouter les équipes et les poules

1. Dans **Équipes et poules**, saisissez un nom puis cliquez sur **Ajouter l’équipe** pour chaque équipe inscrite.
2. Créez les poules avec **Ajouter la poule**. Si vous laissez le nom vide, Tournio propose « Poule A », « Poule B », etc.
3. Répartissez toutes les équipes. Chaque poule doit contenir au moins deux équipes.

L’adresse de chaque équipe est créée automatiquement. Pour découvrir l’application, vous pouvez générer de 1 à 64 **équipes de test** aux noms aléatoires. Retirez-les ou remplacez leurs noms avant de publier un vrai tournoi.

### Répartir les équipes

Trois méthodes sont disponibles :

- **Manuellement, avec le sélecteur de poule** dans la liste des équipes.
- **Par glisser-déposer**, avec la poignée ⠿, vers une poule ou vers **Sans poule**. Sur téléphone, utilisez un appui long sur la poignée.
- **Au hasard**, avec **Répartir toutes les équipes au hasard**. Cette action remplace la répartition existante après confirmation. Si certaines équipes sont déjà placées, un second bouton permet de placer seulement celles qui restent sans poule.

Le tirage au sort équilibre les poules à une équipe près. Vous pouvez ajuster le résultat à la main.

Dans chaque poule, chaque équipe rencontre une seule fois chacune des autres équipes.

**Pour donner le même nombre de matchs de poule à chaque équipe, composez des poules de même taille.** Dans une poule de quatre équipes, chacune joue trois matchs ; la poule compte six rencontres. Des poules de tailles différentes donnent des nombres de matchs différents, même si une phase de classement est prévue ensuite.

### Renommer ou supprimer

Cliquez sur le nom d’une équipe ou d’une poule pour le modifier. **Entrée** enregistre et **Échap** annule. Le renommage reste possible après publication et conserve le lien de l’équipe.

La corbeille demande confirmation. Les suppressions sont disponibles uniquement sur un brouillon sans calendrier. Supprimer une poule conserve ses équipes inscrites et les replace dans **Sans poule**.

Au clavier, vous pouvez ouvrir le renommage avec **Entrée** ou **F2**. Pour déplacer une équipe, placez le focus sur sa poignée, appuyez sur **Espace**, utilisez les flèches, puis **Espace** pour déposer ou **Échap** pour annuler.

## 4. Préparer les terrains

Dans **Terrains**, ajoutez les surfaces de jeu utilisées. Sans nom saisi, Tournio propose « Terrain 1 », « Terrain 2 », etc. Choisissez des noms faciles à retrouver dans la salle.

**Un terrain est disponible pendant toute la période du tournoi par défaut.** Vous devez seulement signaler les moments où il ne peut pas être utilisé :

1. Sur le terrain concerné, cliquez sur **Ajouter une indisponibilité**.
2. Indiquez le début et la fin de la période indisponible.
3. Validez avec **Ajouter l’indisponibilité**.

Pour une pause commune, indiquez l’indisponibilité sur chaque terrain concerné. Les périodes qui se recouvrent sont fusionnées. **Rendre disponible** supprime une indisponibilité ; cette possibilité reste ouverte après publication.

Vous pouvez cliquer sur le nom d’un terrain pour le renommer. Si vous modifiez les dates du tournoi avant de créer le calendrier, les indisponibilités sont conservées et les disponibilités s’adaptent à la nouvelle période.

## 5. Choisir le format et les règles

### Choisir ce qui suit les poules

Dans **Format et règles**, choisissez obligatoirement un format, puis cliquez sur **Enregistrer le format**. Même si vous ne souhaitez pas de phase supplémentaire, vous devez sélectionner **Poules uniquement**.

| Format | Déroulement après les poules | Matchs supplémentaires par équipe, hors groupe incomplet |
| --- | --- | --- |
| **Poules uniquement** | Le tournoi s’arrête sur les classements de poule, sans finale ni classement général final. | 0 |
| **Un match par rang** | Les équipes sont appariées dans l’ordre du classement général : les deux meilleures jouent la finale, les deux suivantes les places 3 et 4, etc. | 1 |
| **Croisé en deux tours** | Par groupes de quatre : 1re contre 4e et 2e contre 3e, puis gagnants entre eux et perdants entre eux pour fixer les places. | 2 |
| **Tableau complet** | Toutes les places sont disputées ; à chaque tour, les gagnants se rencontrent et les perdants aussi. | 2 avec 4 équipes, 3 avec 8, 4 avec 16, 5 avec 32. |

Les formats de classement demandent au moins deux poules. Sans option de groupe incomplet, **Un match par rang** demande un nombre pair d’équipes, **Croisé en deux tours** un multiple de quatre et **Tableau complet** 4, 8, 16 ou 32 équipes. Une carte grisée explique pourquoi le format n’est pas compatible.

Personne n’est éliminé pendant la phase de classement : les équipes qui perdent continuent à jouer pour déterminer leur place.

### Si le nombre d’équipes ne tombe pas juste

L’option **Autoriser un groupe incomplet** peut rendre compatibles les formats **Un match par rang** et **Croisé en deux tours**. Les dernières équipes du classement général jouent alors des mini-championnats de trois : chacune y rencontre les deux autres.

- En **Croisé en deux tours**, ces groupes permettent à chacune de jouer deux matchs de classement, comme les autres équipes. Selon l’effectif, plusieurs groupes de trois sont nécessaires ; avec cinq équipes, les deux dernières jouent un aller-retour en complément du groupe de trois.
- En **Un match par rang** avec un effectif impair, les trois dernières jouent deux matchs chacune, tandis que les autres en jouent un. Tenez compte de cette différence dans l’organisation de fin de tournoi.

Le détail affiché sous le format précise l’organisation prévue pour votre effectif.

### Vérifier la durée et les pauses

Les cartes indiquent le nombre de matchs par équipe, une durée estimée et l’heure de fin. La rubrique **Comparer le nombre de poules** permet d’évaluer d’autres répartitions. Les conseils peuvent proposer d’ajouter ou d’enlever des poules, d’ajouter des terrains ou de raccourcir les matchs.

Ces conseils ne changent pas la configuration : appliquez vous-même les ajustements dans les onglets concernés.

**Les estimations supposent des terrains disponibles en continu et ne prennent pas en compte leurs indisponibilités.** Vérifiez donc le calendrier réel avant publication.

La **Pause entre les tours (min)** s’applique avant chaque tour de classement, y compris après les poules. Elle peut aller de 0 à 600 minutes. Le repos minimal d’une équipe reste respecté si cette pause est plus courte.

### Enregistrer les règles

Réglez ensuite les paramètres communs à toutes les poules, puis cliquez sur **Enregistrer les règles** :

| Règle | Effet |
| --- | --- |
| Durée d’un match | Durée réservée à chaque rencontre. |
| Transition | Temps laissé entre deux matchs sur un même terrain. |
| Repos minimal | Temps laissé à une équipe entre la fin d’un match et le début du suivant. |
| Matchs nuls | Autorise ou interdit l’égalité en poule. Un match de classement doit toujours désigner un vainqueur. |
| Points victoire / nul / défaite | Barème du classement de poule. |
| Départage à égalité de points | Priorité aux points marqués ou à la différence entre points marqués et encaissés, puis à l’autre critère. |
| Horaires alignés | Fait commencer les matchs sur une grille commune à tous les terrains. |

Avec les horaires alignés, l’écart entre deux départs possibles est la durée du match augmentée du plus long délai entre transition et repos. Par exemple, 10 minutes de match, 2 de transition et 5 de repos donnent une grille de 15 minutes, à partir du début du tournoi.

Le score est numérique et simple : Tournio ne gère pas les scores par set ni les départages propres à un sport. Fixez vos modalités sportives avec les équipes avant le tournoi.

## 6. Prévisualiser, enregistrer et publier le calendrier

### Prévisualiser

1. Ouvrez **Calendrier** et cliquez sur **Prévisualiser le calendrier**.
2. Vérifiez les heures, les terrains et les rencontres de poule.
3. Si vous avez choisi une phase de classement, examinez aussi la partie **Phase de classement · prévisionnel**.

La prévisualisation n’enregistre rien. Les affiches de classement sont indicatives : « 1er Poule A », « Vainqueur du match… », etc. Les équipes exactes et les horaires définitifs seront établis lors de la génération de chaque tour dans **Résultats**.

Si aucun calendrier n’est proposé, lisez les raisons affichées, corrigez la configuration puis prévisualisez à nouveau. Aucun calendrier partiel n’est enregistré.

### Enregistrer

Cliquez sur **Enregistrer ce calendrier**. Le calendrier reste privé tant que le tournoi est en brouillon.

**L’enregistrement verrouille les informations, les règles, la composition des poules et la configuration des terrains.** Si vous devez les revoir avant publication, cliquez sur **Supprimer le calendrier**, modifiez la configuration et recommencez. Cette suppression conserve les équipes, les poules et les terrains.

Vous pouvez aussi prévisualiser un nouveau calendrier et confirmer le remplacement de l’ancien tant que le tournoi reste en brouillon.

### Publier

Avant de publier, contrôlez :

- les noms des équipes, leur présence dans les bonnes poules et l’absence d’équipes de test ;
- les dates, le fuseau, les durées, le barème et les indisponibilités ;
- le format enregistré et la place disponible pour les matchs de classement ;
- les horaires et les terrains du calendrier enregistré.

Cliquez sur **Publier le tournoi** et confirmez. Le tournoi devient consultable sans compte ; la saisie des résultats et les outils de partage deviennent disponibles.

**Après publication, vous ne pouvez plus supprimer ni régénérer le calendrier pour reprendre la configuration.** Les déplacements de matchs restent possibles dans les conditions ci-dessous.

### Déplacer un match

Dans le calendrier enregistré, ouvrez **Déplacer** sous un match prévu ou reporté. Choisissez un terrain et une heure, puis cliquez sur **Enregistrer le déplacement**.

Tournio vérifie la disponibilité du terrain, la transition, le repos des équipes et l’absence de chevauchement. Un déplacement refusé laisse le calendrier précédent en place. Un match reporté replanifié repasse à l’état **Prévu**.

## 7. Partager le tournoi et installer la TV

### Donner accès aux équipes

Après publication, ouvrez **Partage** pour retrouver le lien et le QR code de la page publique. Utilisez **Copier le lien** pour le diffuser. Le QR code peut être scanné directement depuis l’écran.

Les participants peuvent ensuite :

1. ouvrir le lien ou scanner le QR code ;
2. choisir leur équipe ;
3. consulter leur prochain match, l’adversaire, l’heure et le terrain ;
4. suivre le calendrier, les résultats et les classements en direct.

Le choix d’équipe est mémorisé sur leur appareil lorsque le navigateur le permet. Ils peuvent également partager l’adresse de leur page équipe. Aucun de ces liens ne donne le droit de modifier le tournoi.

### Installer l’écran de salle

1. Reliez un ordinateur à la télévision ou au projecteur et vérifiez sa connexion Internet.
2. Depuis **Partage**, cliquez sur **Ouvrir l’écran TV**, ou ouvrez le lien TV sur cet ordinateur.
3. Passez en plein écran avec le bouton de la page.

La TV est conçue pour un écran 16:9. Elle affiche les terrains, les matchs à suivre, les classements et les derniers résultats sans défilement. Les classements de poule tournent automatiquement toutes les 12 secondes. Le QR code renvoie à la page publique.

L’heure affichée suit le fuseau du tournoi. Le navigateur essaie de maintenir l’écran allumé lorsqu’il le permet ; vérifiez aussi les réglages de veille de l’ordinateur et du téléviseur.

## 8. Gérer les matchs et les résultats

### Lancer un créneau

Dans **Résultats**, les rencontres sont regroupées par heure de début. Le filtre **À saisir** montre les matchs encore ouverts ; **Tous** permet aussi de retrouver les matchs terminés ou annulés.

Au début d’un créneau, cliquez sur **Lancer les N matchs** pour marquer les rencontres prévues comme **En cours**. Le lancement groupé réussit pour tous les matchs concernés ou est refusé pour l’ensemble. Vous pouvez aussi utiliser **Marquer en cours** sur un seul match.

Si vous avez lancé un match trop tôt, utilisez **Remettre à « prévu »**. Ces actions changent l’état affiché aux spectateurs, sans déplacer l’horaire réservé.

### Valider un score

1. Repérez la rencontre et vérifiez les deux noms d’équipe.
2. Saisissez les scores entiers, de **0 à 999**, dans les champs correspondants.
3. Cliquez sur **Valider le résultat**.
4. Vérifiez la notification de confirmation.

Le match passe à **Terminé**. Son score devient public et le classement est recalculé. La saisie seule, sans validation, ne publie pas le résultat. L’égalité est refusée si les nuls sont interdits et dans tous les matchs de classement.

Les tableaux de poule utilisent les abréviations suivantes : **J** = joués, **V** = victoires, **N** = nuls, **D** = défaites, **Diff.** = points marqués moins points encaissés, **Pts** = points du barème.

### Corriger un résultat

Passez sur **Tous**, trouvez le match terminé, ouvrez **Corriger le résultat**, puis cliquez sur **Enregistrer la correction** après avoir ajusté les scores. Le match reste terminé et le classement est recalculé.

Cette correction reste possible après la fin du tournoi et avant l’archivage, **sous réserve des verrous de la phase de classement** décrits à la section suivante.

### Reporter, annuler ou rétablir

| Action | Conséquence | Suite à donner |
| --- | --- | --- |
| **Reporter** | Le match reste à jouer ; son horaire et son terrain sont libérés. La page publique n’affiche plus d’horaire pour cette rencontre. | Replanifiez-le dans **Calendrier → Déplacer**. |
| **Annuler le match** | Le match ne compte pas au classement et ne bloque plus le terrain ni les équipes. | Réservez cette action aux rencontres de poule qui ne seront pas jouées. |
| **Rétablir le match** | Un match annulé reprend son ancien créneau si celui-ci est encore libre. Sans ancien horaire, il revient comme reporté. | Si le créneau est occupé, libérez-le avant de rétablir ; si le match revient reporté, replanifiez-le. |

Un match de classement peut être reporté, mais **ne peut pas être annulé** : toutes les places doivent être disputées.

Tournio ne décale pas automatiquement les matchs suivants en cas de retard. Déplacez les rencontres concernées une par une et vérifiez les nouveaux horaires. La gestion des forfaits n’est pas disponible.

## 9. Organiser la phase de classement

Cette étape ne concerne pas le format **Poules uniquement**.

### Vérifier le classement issu des poules

Le classement général place d’abord tous les premiers de poule, puis tous les deuxièmes, et ainsi de suite. À rang égal, Tournio compare les moyennes par match : points du barème, puis différence de points, puis points marqués.

Avant de générer le premier tour, vérifiez les scores de poule : ils détermineront les rencontres de classement. Tous les matchs de poule doivent être terminés ou annulés ; un match reporté reste à régler.

### Générer et jouer les tours

1. Dans **Résultats**, consultez la carte **Phase de classement**. Elle indique ce qui reste à faire.
2. Lorsque les poules sont closes, cliquez sur **Générer le tour 1** et confirmez.
3. Vérifiez les rencontres ajoutées au calendrier. Elles sont immédiatement visibles sur les pages publiques.
4. Lancez les matchs, puis validez tous leurs résultats.
5. Lorsque le tour est terminé, générez le suivant si le format en prévoit un.
6. Continuez jusqu’au classement final, où toutes les places sont fixées.

Les tours sont générés à votre demande. Ils sont placés après le dernier match planifié, avec la pause entre les tours et les contraintes de repos et de terrain. Si vous avez pris du retard, vérifiez les heures proposées et déplacez les matchs si nécessaire.

Dans un mini-championnat de trois, les trois rencontres peuvent être regroupées dans un même tour à générer. Leur classement dépend des victoires, puis de la différence de points, puis des points marqués et enfin du classement général issu des poules.

Avant la génération des rencontres, les pages équipe annoncent une **Phase de classement à venir**. Les adversaires, terrains et horaires apparaissent après génération. En présence d’un groupe incomplet, le nombre de matchs annoncé avant le premier tour peut ne pas refléter ce cas particulier.

### Comprendre les verrous avant de confirmer

- **Dès que le tour 1 est généré, les résultats de poule sont figés.**
- **Dès que le tour suivant existe, les résultats du tour précédent sont figés.**
- **Annuler le tour N** supprime les rencontres du dernier tour généré, seulement si aucune n’a commencé ni reçu de résultat. Un match reporté ne bloque pas à lui seul cette annulation.

Si un tour généré par erreur n’a pas commencé, annulez-le avant de corriger les résultats dont il dépend. Pour revenir aux poules ou changer de format, il faut pouvoir annuler tous les tours de classement, en partant du dernier. Un tour déjà commencé ne peut plus être annulé.

### Exemple : 12 équipes, 3 poules de 4, 3 terrains

Avec le format **Croisé en deux tours**, chaque équipe joue trois matchs de poule puis deux matchs de classement. Cela donne :

- **18 matchs de poule** : six dans chacune des trois poules ;
- **12 matchs de classement** : six par tour ;
- **30 matchs au total**, soit cinq par équipe.

Après validation des poules, générez le tour 1 ; après validation de ses six résultats, générez le tour 2. Les gagnants jouent pour la moitié haute des places de leur groupe de quatre, les perdants pour la moitié basse. La durée totale dépend des règles et des disponibilités : vérifiez-la dans votre calendrier.

## 10. Terminer puis archiver le tournoi

### Terminer

Dans **Résultats**, cliquez sur **Terminer le tournoi** lorsque le bouton devient disponible, puis confirmez.

- En **Poules uniquement**, tous les matchs doivent être terminés ou annulés.
- Avec une phase de classement, tous ses tours doivent être joués et toutes les places déterminées ; aucun match ne doit rester ouvert.

Le tournoi passe à **Terminé**. Vous ne pouvez plus jouer de nouvelles rencontres ni déplacer les matchs. Les corrections de résultats autorisées par les verrous restent possibles jusqu’à l’archivage. Les pages publiques restent consultables.

### Archiver

Après votre dernière vérification, ouvrez **Calendrier**, cliquez sur **Archiver le tournoi** et confirmez.

**L’archivage rend tout le tournoi non modifiable**, y compris les scores, les noms et l’apparence. L’application ne propose pas de retour à un état modifiable. Les pages publiques restent accessibles.

Le bouton d’archivage est également disponible sur un tournoi publié qui n’est pas encore terminé. Pour clôturer normalement un tournoi, terminez-le d’abord ; archiver directement bloque aussi la saisie des rencontres restantes.

## 11. Savoir ce qui reste modifiable

| Modification | Quand est-elle possible ? |
| --- | --- |
| Informations, dates, fuseau, identifiant du lien ; règles de durée et de score | En brouillon, avant l’enregistrement du calendrier. Supprimez le calendrier du brouillon pour les revoir. |
| Ajouter ou supprimer des équipes, des poules ou des terrains ; changer la répartition ; ajouter des indisponibilités | En brouillon, sans calendrier enregistré. |
| Renommer les équipes, les poules ou les terrains ; modifier l’apparence | Jusqu’à l’archivage, y compris après la fin du tournoi. |
| Changer le format, la pause entre les tours ou l’option de groupe incomplet | En brouillon ou après publication, tant qu’aucun tour de classement n’existe. |
| Lever une indisponibilité de terrain | En brouillon sans calendrier, ou après publication tant que le tournoi n’est pas terminé. |
| Déplacer un match prévu ou reporté | En brouillon ou après publication, avant la fin du tournoi, si le déplacement respecte les contraintes. |
| Saisir les premiers résultats, lancer ou reporter des matchs | Après publication et avant la fin du tournoi, sous réserve des verrous de classement. |
| Corriger un résultat terminé | Après publication, y compris après la fin du tournoi, avant archivage et sous réserve des verrous de classement. |

## 12. Résoudre les difficultés courantes

| Situation | Que faire ? |
| --- | --- |
| Je ne retrouve pas mon tournoi. | Vérifiez que vous utilisez le compte Google qui l’a créé. Un autre compte n’y a pas accès. |
| Le lien public affiche une page introuvable. | Vérifiez le lien copié depuis **Partage** et l’état **Publié**, **Terminé** ou **Archivé**. Un brouillon reste invisible aux visiteurs. |
| Le calendrier ne peut pas être généré. | Vérifiez que toutes les équipes sont placées, que chaque poule a au moins deux équipes, qu’un terrain est disponible et qu’un format compatible est enregistré. Lisez ensuite les raisons détaillées. |
| La durée semble suffisante, mais aucun calendrier n’est trouvé. | Vérifiez les indisponibilités, les plages trop courtes, le repos, la transition et les horaires alignés. L’estimation ne tient pas compte des indisponibilités. Avant publication, ajustez ces paramètres ou les dates et prévisualisez à nouveau. |
| Un tour de classement manque de créneaux. | Vérifiez les horaires déjà planifiés et la pause. Vous pouvez lever une indisponibilité avec **Rendre disponible**, puis réessayer. Les dates, durées et nouveaux terrains restent verrouillés après publication. |
| Un déplacement ou un rétablissement est refusé. | Le créneau entre en conflit avec un terrain ou une équipe, ou ne respecte pas une disponibilité ou le repos. Choisissez un autre créneau ; pour rétablir un match, libérez d’abord son ancien créneau si nécessaire. |
| Un score à égalité est refusé. | Vérifiez les règles. Les matchs de classement exigent toujours un vainqueur ; saisissez le score qui départage les équipes selon votre règlement sportif. |
| Une correction de score est refusée. | Vérifiez si le tournoi est archivé ou si un tour de classement a figé ce résultat. Un tour suivant peut être annulé seulement s’il n’a pas commencé. |
| Le tournoi ou le match a changé dans un autre onglet. | Cliquez sur **Recharger**, vérifiez l’état actuel puis reprenez l’action. Pour une prévisualisation devenue périmée, générez-en une nouvelle avant d’enregistrer. |
| Une action échoue pendant une coupure de réseau. | Rétablissez la connexion, rechargez et vérifiez si l’action a été enregistrée avant de la refaire. La saisie hors connexion n’est pas disponible. |
| Le badge public indique **Hors ligne** ou les résultats semblent anciens. | Vérifiez la connexion Internet du téléphone ou de la TV. Les pages essaient de se reconnecter ; lorsque le direct est indisponible mais que le réseau fonctionne, elles vérifient les mises à jour toutes les 20 secondes. Rechargez au besoin. |
| **Terminer le tournoi** reste désactivé. | Dans **À saisir**, cherchez les rencontres prévues, en cours ou reportées. Vérifiez aussi si un tour de classement reste à générer ou à jouer. |

Les notifications individuelles par push, SMS ou e-mail ne sont pas disponibles. Demandez aux équipes de consulter leur page et prévoyez vos annonces de salle pour les changements urgents.

## 13. Fiche pratique du jour J

### Avant l’arrivée des équipes

- [ ] Vérifier les inscriptions, la répartition en poules et les noms des terrains.
- [ ] Contrôler les règles, le format et le temps prévu pour la phase de classement.
- [ ] Enregistrer puis publier le calendrier après sa dernière vérification.
- [ ] Tester le lien public et le QR code depuis un téléphone sans compte organisateur.
- [ ] Ouvrir la TV en plein écran et vérifier sa connexion ainsi que la veille.

### À chaque créneau

- [ ] Dans **Résultats**, lancer les matchs qui commencent.
- [ ] Vérifier les équipes avant de saisir chaque score et valider les résultats.
- [ ] Replanifier les reports et les retards dans **Calendrier**.
- [ ] Vérifier la confirmation des actions et, si nécessaire, l’affichage public.

### À la fin des poules et de chaque tour

- [ ] Contrôler tous les scores avant de générer le tour suivant : ils seront ensuite figés.
- [ ] Générer le prochain tour dans **Résultats** et vérifier ses horaires.
- [ ] Annoncer aux équipes que leurs nouvelles rencontres sont consultables.

### À la clôture

- [ ] Vérifier que toutes les rencontres et toutes les places prévues sont réglées.
- [ ] Terminer le tournoi dans **Résultats**.
- [ ] Faire les dernières corrections encore autorisées.
- [ ] Archiver seulement lorsque plus aucune modification n’est nécessaire.
