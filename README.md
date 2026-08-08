# Bloc — app d'entraînement personnelle (V4, gelée pour le bloc 1)

PWA statique, sans backend, vanilla : journal d'activités + quotas hebdomadaires
par type + guide de séance renfo (déroulé exercice par exercice, timers, saisie
des charges) + bilans hebdo et de bloc. Les données utilisateur vivent dans le
localStorage du navigateur.

**Règle de gel** : plus aucun changement de code pendant le bloc 1. Les idées
vont dans l'écran Idées de l'app ; tri au bilan de bloc, avec le bloc 2.
Historique des décisions : `CHANGELOG-V3.md` (boucle V3) et `AUDIT.md` (audit
de clôture V4).

## Architecture V4

- **Accueil** : ligne du jour (plan + reste de la semaine), saisie « J'ai
  fait… » (2 taps, Aujourd'hui/Hier ou tap sur un jour du rail), quotas de la
  semaine, rail plan-indicatif (pastilles du journal, créneaux couverts),
  séances libres, règles du bloc + échéance du bloc suivant.
- **Bilan** : Lecture hebdo (phrases par règles, ton factuel), quotas vs semaine
  précédente, tendance 4 semaines, extras, charges. En dernière semaine et
  après la fin : **Bilan de bloc** (quotas semaine par semaine + cumul, charges
  du premier au dernier enregistrement, extras/signaux/minimales, Lecture de
  bloc).
- **Fin de bloc** : l'accueil affiche l'accès direct au bilan de bloc et la
  marche à suivre ; journal et quotas continuent de fonctionner.
- **Bloc à venir** (`date_debut` future) : « Le bloc démarre dans X j », pas de
  « reste » avant le départ, le journal compte déjà.
- **Raccourcis PWA** : appui long sur l'icône → « J'ai fait vélo / course »
  (`?fait=velo|course`), saisie du jour en un geste.

## Modèle de données (localStorage, préfixe `bloc.`)

| Clé | Contenu |
|---|---|
| `journal` | `[{ date: "AAAA-MM-JJ", type, note }]` — plusieurs entrées par jour ; source unique de l'adhérence |
| `charges` | `{ exercice_id: [{ date, kg, ressenti }] }` — alimenté par la séance guidée |
| `backlog_idees` | `[{ date, texte }]` |
| `bloc_actif` | `{ id, date_debut }` — date modifiable dans Réglages |
| `schema_version` | `2` — marqueur de la migration V1→V2 (validations/bonus → journal, rejouée aussi à l'import d'un export V1) |

**Types d'activité** (`types_activite` du bloc) : chaque type a `id` + `label` ;
`seance_id` optionnel propose « Séance guidée / Juste noter » ; `"signal": true`
marque le type **Signal** (gêne, repos forcé) — ni quota, ni extra, compté à
part, pastille neutre, lu comme de la prudence appliquée dans les Lectures.
Un type sans quota est un « extra ». Les quotas (`quotas_hebdo`) priment pour
l'adhérence ; la `semaine_type` n'est qu'un plan indicatif.

## Déployer

L'app doit être servie en HTTP(S) — `file://` ne fonctionne pas (fetch + service worker).

**Option 1 — GitHub Pages (recommandé)** : Settings → Pages → branche main,
racine. L'URL s'ouvre sur le téléphone → « Ajouter à l'écran d'accueil ».
Après la première visite, tout fonctionne hors ligne.

**Option 2 — test local** : `python3 -m http.server 8080` puis http://localhost:8080

## Procédure de fin de bloc (bloc 2)

1. Faire le bilan de bloc dans l'app (accessible dès la dernière semaine).
2. Créer `blocs/bloc-2.json` (schéma : `bloc-1.json` — semaine type, quotas,
   types, règles). Le contenu vient de l'utilisateur, à partir du bilan.
3. Pointer `config.json` → `"bloc_actif_fichier": "blocs/bloc-2.json"`.
4. `node generate-sw.mjs` (nouveaux fichiers → précache), bump de `CACHE`
   dans `sw.js`, tests, push.
5. Dans l'app : Réglages → date de début du bloc 2. Les variantes
   `"bloc_min": 2` (Turkish Get-Up, Swings KB) se déverrouillent d'elles-mêmes.

## Procédure de mise à jour (après le gel)

modifier → `cd tests && npm test` (tout vert, voir `tests/README.md`) →
`node generate-sw.mjs` si des fichiers ont été ajoutés/retirés → incrémenter
`CACHE` dans `sw.js` → push sur main (Pages redéploie).

## Ajouter du contenu (zéro modification de code)

- **Nouvelle séance renfo** : `seances/ma-seance.json` (schéma :
  `renfo-reprise.json`), référencée par `seance_id` ou dans `seances_libres`.
- **Nouvelle fiche exercice** : `exercices/mon-exo.json` — `nom`, `images`
  (peut être vide), `rappel_technique`, `pourquoi`.
- **Nouveau type d'activité** : une entrée dans `types_activite` (+ quota dans
  `quotas_hebdo` pour compter dans l'adhérence).
- Après tout ajout de fichier : `node generate-sw.mjs` + bump de `CACHE`.

## Sauvegarde

Réglages → Exporter : JSON complet (journal, charges, idées, date de bloc,
`schema_version`). Import : restaure ; un export V1 est converti ; tout autre
fichier est rejeté sans toucher aux données. Export mensuel conseillé —
Android peut purger le localStorage.

## Structure

```
index.html            vues (accueil, séance, charges, bilan, idées, réglages)
css/style.css         thème sombre, accent ambre, cibles tactiles ≥48px
js/app.js             moteur : état, migration, rendu, séance, lectures, canvas
config.json           pointeurs vers le bloc actif et les séances libres
blocs/                programmes mensuels (quotas, types, semaine type, règles)
seances/              séances (renfo du programme + libres/)
exercices/            fiches (rappel + pourquoi + images)
assets/exercices/     images (free-exercise-db, domaine public)
sw.js                 offline (précache complet, cache-first)
generate-sw.mjs       régénère FICHIERS de sw.js depuis l'arborescence
tests/                suite Playwright (hors précache) — voir tests/README.md
CHANGELOG-V3.md       journal de la boucle d'amélioration V3
AUDIT.md              audit de clôture V4 (P0/P1 corrigés, P2 assumés)
```
