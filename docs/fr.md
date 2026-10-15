# Enigma2

Suivez et pilotez vos **démodulateurs satellite, câble ou TNT sous Enigma2**
(VU+, Dreambox, Zgemma, Octagon, GigaBlue, Edision…) depuis Gladys, sur votre
réseau local, par leur interface web **OpenWebif** : allumez-les ou mettez-les
en veille, réglez le volume, changez de chaîne parmi vos favoris, voyez la
chaîne et le programme à l'écran, sachez quand un enregistrement tourne, et
affichez un message sur la télé quand on sonne à la porte.

> **Développée sans le matériel : vos retours sont les bienvenus.** Cette
> intégration a été écrite et testée sur les réponses documentées par OpenWebif
> et sur de vraies réponses publiées par les projets Home Assistant et
> openwebifpy, pas sur un vrai démodulateur. Si quelque chose ne marche pas
> comme décrit, dites-le sur le
> [forum Gladys](https://community.gladysassistant.com) ou dans les
> [issues](https://github.com/guim31/gladys-enigma2/issues).

Cette intégration n'est liée à aucun fabricant de démodulateurs.

## Ce qu'il faut

- Gladys Assistant 5.1.0 ou plus récent.
- Un démodulateur sous une image **Enigma2** (openATV, OpenPLi, OpenViX, VTi,
  Dreambox OS avec OpenWebif…) avec le plugin **OpenWebif**, installé et actif
  sur la plupart des images. Ouvrez `http://<adresse du démodulateur>/` dans un
  navigateur : si la page OpenWebif s'affiche, l'intégration pourra la joindre.
- Le démodulateur et Gladys sur le même réseau. Une adresse IP fixe pour le
  démodulateur (réservation DHCP dans votre box) évite les surprises.
- Si OpenWebif demande un identifiant : l'utilisateur (en général `root`) et
  son mot de passe.

## Configuration

Dans Gladys, **Intégrations → Installer depuis GitHub**, puis ouvrez
l'intégration **Enigma2** et son onglet **Configuration**. Jusqu'à trois
démodulateurs, chacun avec :

- **Adresse** : l'adresse IP ou le nom du démodulateur, par exemple
  `192.168.1.20`. Ajoutez `https://` devant pour le HTTPS, et `:port` derrière
  si OpenWebif n'écoute pas sur le port standard (`192.168.1.20:8080`).
- **Utilisateur** et **Mot de passe** : seulement si OpenWebif demande un
  identifiant. Avec le seul mot de passe, l'utilisateur `root` est utilisé.
- **Nom** : le nom de l'appareil dans Gladys ; vide, la marque et le modèle
  annoncés par le démodulateur.

Les options sont communes à tous les démodulateurs :

- **Accepter un certificat auto-signé** : OpenWebif sert le HTTPS avec un
  certificat auto-signé. À cocher seulement pour vos propres démodulateurs.
- **Bouquet des favoris** : le bouquet TV proposé comme liste de chaînes, par
  son nom tel que le démodulateur l'affiche. Vide : le premier bouquet TV.
- **Intervalle de rafraîchissement** : 10 secondes, 30 secondes (par défaut)
  ou 1 minute.
- **Langue des textes** : les noms des fonctionnalités donnés à l'ajout d'un
  appareil, et les textes publiés comme états (chaîne, programme). Français
  par défaut.

Enregistrez, puis appuyez sur **Tester les démodulateurs** : une ligne par
démodulateur, avec son modèle, sa version d'OpenWebif et le nombre de chaînes
trouvées, ou ce qui ne va pas. Allez ensuite dans l'onglet **Découverte** et
ajoutez chaque démodulateur à Gladys.

## L'appareil de chaque démodulateur

Un appareil par démodulateur, reconnu par l'adresse MAC qu'il annonce (le même
appareil même quand son adresse change).

| Fonctionnalité                 | Ce qu'elle fait                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Marche / veille                | Allumé, ou **en veille**. La veille profonde n'est jamais utilisée : on ne pourrait plus le réveiller. |
| Volume                         | Le volume du démodulateur, de 0 à 100 %.                                                               |
| Augmenter / diminuer le volume | Des boutons, un cran à chaque appui.                                                                   |
| Muet                           | Un bouton : chaque appui coupe ou rétablit le son.                                                     |
| Chaîne suivante / précédente   | Des boutons, dans le bouquet des favoris (de la dernière chaîne on revient à la première).             |
| Dernière chaîne                | Un bouton : retour à la chaîne regardée juste avant.                                                   |
| Numéro de chaîne               | La position de la chaîne dans le bouquet des favoris ; saisir un numéro y passe.                       |
| Chaînes favorites              | La liste des chaînes du bouquet : en choisir une y passe.                                              |
| Chaîne en cours                | Son nom, « En veille » ou « Injoignable ».                                                             |
| Programme en cours             | Début, fin et titre, d'après le guide des programmes du démodulateur.                                  |
| Programme suivant              | La même chose pour le programme d'après.                                                               |
| Enregistrement en cours        | Oui pendant que le démodulateur enregistre (y compris depuis sa veille).                               |

Un démodulateur qui ne répond pas à deux lectures de suite (éteint, en veille
profonde, coupé du réseau) est montré en veille, avec la chaîne
« Injoignable », jusqu'à ce qu'il réponde de nouveau.

## Tableau de bord

Le widget **Démodulateur Enigma2** montre, pour le démodulateur choisi dans ses
réglages : la chaîne et les programmes en cours et suivant, le volume (en
direct), l'état, l'enregistrement et le son, et quatre boutons :
**Marche / veille**, **Chaîne −**, **Chaîne +** et **Muet**. En veille, seul
le bouton de marche reste.

Les fonctionnalités de l'appareil se placent aussi dans les widgets
d'appareils habituels : le curseur de volume, la liste des chaînes, les
boutons de télécommande.

## Scènes

### Déclencheurs

Aucun, volontairement : tout changement qui vaut d'être attendu est un état de
l'appareil, que l'éditeur de scènes propose déjà (« le démodulateur
s'allume », « l'enregistrement commence », « la chaîne en cours est… »).

### Actions

- **Afficher un message sur la TV** : un texte par-dessus l'image, comme
  information, avertissement ou alerte, pendant un nombre de secondes donné
  (0 : jusqu'à fermeture avec la télécommande). Le texte accepte les variables
  de scène.
- **Changer de chaîne** : par son numéro dans le bouquet des favoris ou par
  son nom (sans tenir compte des majuscules ni des accents, le début du nom
  suffit). Sa sortie, le nom de la chaîne, sert aux actions suivantes de la
  scène.

L'action habituelle **Contrôler un appareil** pilote la marche et le volume.

### Idées de scènes

- **Sonnette** : quand on sonne, afficher « Quelqu'un sonne à la porte » sur
  la TV pendant 15 secondes, en avertissement.
- **Bonne nuit** : à 1 h, si le démodulateur est encore allumé, le mettre en
  veille.
- **L'heure des infos** : à 20 h en semaine, si le démodulateur est allumé,
  passer sur votre chaîne d'information.
- **Machine à laver** : quand la puissance de la prise du lave-linge retombe,
  afficher « La lessive est finie » sur la TV.

## Rafraîchissement et charge

L'intégration lit elle-même chaque démodulateur, à l'intervalle choisi : un
appel à `/api/statusinfo`, plus `/api/getcurrent` (guide des programmes)
quand il est allumé — deux petites requêtes vers un appareil de votre réseau
local, sans quota ni cloud. Le bouquet des favoris est relu toutes les heures
(et à chaque **Tester les démodulateurs**). Seuls les changements partent vers
Gladys, plus une valeur inchangée toutes les six heures. Un démodulateur n'est
lu qu'une fois son appareil ajouté à Gladys.

## Dépannage

- **« Aucun démodulateur ne répond »** : vérifiez l'adresse dans un navigateur
  depuis un ordinateur du même réseau ; vérifiez qu'OpenWebif est actif sur le
  démodulateur (Menu → Plugins). Un démodulateur en veille profonde ne répond
  pas.
- **« Un démodulateur refuse l'utilisateur ou le mot de passe »** : OpenWebif
  demande un identifiant ; renseignez l'utilisateur (en général `root`) et le
  mot de passe du démodulateur.
- **Le HTTPS échoue** : cochez **Accepter un certificat auto-signé**, ou
  utilisez l'adresse HTTP.
- **Liste de chaînes vide ou fausse** : renseignez le **Bouquet des favoris**
  avec le nom exact d'un bouquet TV du démodulateur, appuyez sur **Tester les
  démodulateurs**, puis mettez à jour l'appareil dans l'onglet Découverte.
- **« Pas de guide des programmes »** : le démodulateur n'a pas de données
  EPG pour cette chaîne (fréquent sur certaines chaînes locales ou de radio).
- Journaux détaillés : `LOG_LEVEL=debug` sur le conteneur de l'intégration.

## Limites

- Développée sans le matériel : testée sur des réponses OpenWebif documentées
  et publiées, pas sur un vrai démodulateur.
- Jusqu'à trois démodulateurs. Seuls les bouquets TV sont proposés, 200
  chaînes au plus.
- Un démodulateur en **veille profonde** ne peut pas être réveillé par le
  réseau (la plupart ne gèrent pas le Wake-on-LAN) : utilisez la veille.
- Les démodulateurs ne sont pas découverts automatiquement : saisissez leur
  adresse.
- Pas de logo de chaîne (picon) ni de capture d'écran, pas de gestion des
  programmations.
- Les noms des fonctionnalités sont figés à l'ajout de l'appareil : changez la
  langue avant de l'ajouter.
