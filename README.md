# Bloc — app d'entraînement personnelle (V1)

PWA statique, sans backend : tableau de bord d'adhérence (semaine type, validation)
+ guide de séance renfo (déroulé exercice par exercice, timers, saisie des charges).
Les données utilisateur vivent dans le localStorage du navigateur.

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
- Après tout ajout de fichier : régénérer la liste du précache dans `sw.js` (ajouter le chemin
  dans `FICHIERS`) et incrémenter `CACHE` (« bloc-v2 ») pour forcer la mise à jour offline.

## Sauvegarde

Réglages → Exporter : télécharge un JSON avec tout (validations, bonus, charges, idées, date de bloc).
Import : restaure ce fichier. Export mensuel conseillé — Android peut purger le localStorage.

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
