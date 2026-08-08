# Bloc — app d'entraînement personnelle (V2)

PWA statique, sans backend : journal d'activités + quotas hebdomadaires par type
+ guide de séance renfo (déroulé exercice par exercice, timers, saisie des charges).
Les données utilisateur vivent dans le localStorage du navigateur.

## Modèle V2 : journal + quotas

La V1 validait des créneaux prévus (mardi = vélo, une coche par jour). La V2
journalise ce qui a été fait : plusieurs entrées par jour (`{date, type, note}`),
saisie rétroactive (Aujourd'hui/Hier ou tap sur un jour du rail), et l'adhérence
se mesure en quotas hebdomadaires par type (`quotas_hebdo` du bloc). La
`semaine_type` reste affichée comme plan indicatif, sans validation. Un type
sans quota (muscu, boxe…) est un « extra », compté à part.

**Migration V1 → V2** : au premier lancement, les anciennes `validations`
(fait/swap/minimale) et `bonus` sont converties en entrées de journal, puis
supprimées ; `charges`, `backlog_idees` et `bloc_actif` sont conservés tels
quels. La clé `schema_version` (= 2) empêche de rejouer la migration.
L'import d'un export V1 passe par la même conversion.

## Déployer

L'app doit être servie en HTTP(S) — le protocole `file://` ne fonctionne pas (fetch + service worker).

**Option 1 — GitHub Pages (recommandé)** : pousser ce dossier dans un repo, activer Pages
(Settings → Pages → branche main, racine). L'URL obtenue s'ouvre sur le téléphone →
menu Chrome → « Ajouter à l'écran d'accueil ». Après la première visite, tout fonctionne hors ligne.

**Option 2 — test local** : `python3 -m http.server 8080` dans ce dossier, puis http://localhost:8080

## Ajouter du contenu (zéro modification de code)

- **Nouvelle séance renfo** : créer `seances/ma-seance.json` (schéma : voir `renfo-reprise.json`),
  la référencer dans le bloc (`seance_id`) ou dans `config.json` (`seances_libres`).
- **Nouveau bloc (mois 2)** : créer `blocs/bloc-2.json`, pointer `config.json` dessus.
  Les variantes marquées `"bloc_min": 2` (swings, TGU) se déverrouillent automatiquement.
- **Nouvelle fiche exercice** : `exercices/mon-exo.json` — champs `nom`, `images` (peut être vide),
  `rappel_technique`, `pourquoi` (obligatoire).
- **Nouveau type d'activité** : ajouter une entrée `{ "id": "natation", "label": "Natation" }`
  dans `types_activite` du bloc actif — le bouton apparaît dans « J'ai fait… ». Pour qu'il
  compte dans l'adhérence, ajouter aussi son quota dans `quotas_hebdo` (sinon c'est un extra).
  Un champ `seance_id` optionnel propose « Séance guidée / Juste noter » (comme le renfo).
- Après tout ajout de fichier : régénérer la liste du précache dans `sw.js` (ajouter le chemin
  dans `FICHIERS`) et incrémenter `CACHE` (« bloc-v2 ») pour forcer la mise à jour offline.

## Sauvegarde

Réglages → Exporter : télécharge un JSON avec tout (journal, charges, idées, date de bloc,
`schema_version`). Import : restaure ce fichier ; un export V1 (validations/bonus) est
converti automatiquement. Export mensuel conseillé — Android peut purger le localStorage.

## Structure

```
index.html            vues (semaine, séance, charges, bilan, idées, réglages)
css/style.css         thème sombre, accent ambre, cibles tactiles ≥48px
js/app.js             moteur : état, rendu, séance, graphique canvas
config.json           pointeurs vers le bloc actif et les séances libres
blocs/                programmes mensuels
seances/              séances (renfo du programme + libres/)
exercices/            fiches (rappel + pourquoi + images)
assets/exercices/     images (free-exercise-db, domaine public)
sw.js                 offline (précache complet, cache-first)
```
