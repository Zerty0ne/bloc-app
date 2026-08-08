# Tests de Bloc

Suite Playwright headless — hors précache du service worker (le dossier
`tests/` est exclu par `generate-sw.mjs`).

## Lancer

```
cd tests
npm install
CHROMIUM_PATH=/chemin/vers/chromium npm test
```

`CHROMIUM_PATH` est optionnel si Playwright trouve un navigateur ; le serveur
statique éphémère (port 8123) est lancé automatiquement.

## Couverture

- `suite-regression.js` — les 10 critères d'acceptation V2 : saisie 2 taps,
  multi-entrées par jour, quotas/extras, séance renfo guidée complète (charges
  incluses), migration V1→V2 (types, notes, non-rejeu), export → effacement →
  import, import d'un export V1, offline (précache complet, rechargement réseau
  coupé).
- `suite-fonctionnalites.js` — V4 : entrée Signal (à part, pastille, lecture
  « prudence appliquée », rappel 24h enrichi), état « bloc à venir » (compteur,
  pas de « reste », bascule futur→présent), bilan de bloc (cumuls, charges
  premier→dernier, lecture) et transition de fin de bloc.
- `suite-personas.js` — les 5 semaines-personas : vocabulaire punitif absent
  (scan automatique), rien ne récompense la consultation répétée.
- `suite-robustesse.js` — journal corrompu, stockage plein, imports invalides,
  bloc/fiche manquants, entrées futures.
- `suite-dates.js` — formats JJ/MM (charges, idées, puces).
- `generate-sw.mjs --check` (lancé d'office) — échoue si la liste FICHIERS du
  service worker diverge de l'arborescence.

## Procédure avant tout push

modifier → `npm test` (tout vert) → `node ../generate-sw.mjs` si fichiers
ajoutés/retirés → bump de `CACHE` dans `sw.js` → push.
