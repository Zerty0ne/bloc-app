# Audit de clôture — Bloc V3 → V4 (avant gel)

Méthode : chaque cas est **constaté** par un test automatisé (Playwright headless ou
Node), jamais supposé. Sondes dans `tests/`. Classement : P0 casse l'usage,
P1 dégrade, P2 cosmétique.

## 1. Robustesse — constats

| Cas | Comportement constaté | Gravité | Action |
|---|---|---|---|
| `bloc.journal` corrompu (JSON invalide) | L'app charge, le journal repart du fallback `[]`, la saisie refonctionne. Perte des données corrompues, pas de crash. | P2 | Aucune (comportement V1 : `LS.get` catch). L'export régulier est la protection. |
| localStorage plein (`setItem` lance) | **Avant** : la saisie était perdue en silence — tap sans effet, aucun message. **Corrigé** : `LS.set` attrape l'erreur et affiche « Sauvegarde impossible — stockage plein ? Exporte tes données (Réglages). » L'UI reste cohérente (elle ne montre jamais une entrée non persistée). | **P1 → corrigé** | try/catch + toast |
| Import d'un fichier non-JSON | Rejeté : « Fichier illisible — export Bloc attendu. » Données intactes. | — | OK (V2) |
| Import d'un JSON valide mais étranger (`{"foo":1}`) | **Avant** : pris pour un export V1 → le journal était **effacé**. **Corrigé** : un export doit contenir `journal` (V2+) ou `validations` (V1), sinon rejet sans toucher au stockage. | **P1 → corrigé** | validation de forme |
| `config.json` → bloc absent | Écran d'erreur propre, l'app ne rend rien de cassé. Le message générique mentionne file:// (cause la plus probable en pratique) ; « Failed to fetch » est affiché tel quel. | P2 | Message générique conservé — le seul scénario réel est une faute de frappe au dépôt du bloc 2, et l'erreur est visible immédiatement au premier test. |
| Fiche exercice manquante | La séance continue avec une fiche fallback (l'id sert de nom, pas d'images). | P2 | Comportement voulu (V1). |
| Changement d'heure Europe/Brussels (mars) | **Avant** : `joursEntre` en `floor` brut → la semaine du bloc restait fausse (« Semaine 1 » au lieu de 2) **toute la semaine** suivant le passage à l'heure d'été, et le compte à rebours du bloc 2 était décalé d'un jour. Octobre était correct par chance d'arrondi. **Corrigé** : `joursEntre` compte de minuit à minuit avec arrondi — testé sur les deux transitions 2026 (29 mars, 25 octobre), y compris à 00h30 le lendemain. | **P1 → corrigé** | minuit-à-minuit + `Math.round` |
| `date_debut` modifiée en cours de bloc | Semaine, compte à rebours et bilan de bloc se recalent immédiatement (testé). | — | OK |
| Entrées de journal à date future (via import) | Comptées dans les quotas de leur semaine, visibles sur le rail (carte non cliquable au-delà d'aujourd'hui). Pas de crash. | P2 | Non corrigé : la saisie de l'app ne produit jamais de date future (Aujourd'hui/Hier/rail passé) ; seul un import trafiqué en crée. |

## 2. Parcours réels (5 semaines-personas rejouées)

Rejouées sur la build de gel (`tests/`) : vocabulaire propre partout (scan
automatisé des termes punitifs), saisie du jour à 2 taps, hier à 2 taps,
consultation répétée sans aucune récompense (DOM identique sur 5 ouvertures).
Frictions restantes, assumées :

- « Renfo → Juste noter » = 3 taps (le choix guidée/noter est un arbitrage
  pré-tranché de la V2, pas une question ouverte — conservé).
- La note d'une entrée demande ✎ puis saisie — volontairement hors du chemin
  rapide.

## 3. Qualité

- **Code mort** : plus aucune référence swap/bonus/badge dans le JS ni le HTML ;
  la variable CSS `--swap` (orpheline depuis la V2) est recyclée comme couleur de
  la pastille Signal (B3).
- **Textes** : mentions « V1 »/« V2 » obsolètes corrigées (écran Idées, ligne de
  version des Réglages → V4).
- **Contrastes** (mesurés) : texte 14,5:1, muted 5,6:1, accent 8,4:1 — AA ok.
  `--accent-dim` utilisé comme couleur de texte (ligne « prochain bloc ») était à
  2,5:1 → passé sur `--muted`. Le ✓ « couvert » reste en accent-dim : décoratif,
  doublé par le style du label.
- **Sécurité locale** : le texte des idées passait par `innerHTML` (auto-XSS
  possible en collant du HTML) → construit en `textContent` (< 10 lignes, corrigé).
- **Aria/focus** : boutons d'action porteurs d'`aria-label`, `:focus-visible`
  global, toast en `role="status"`. P2 restant : les puces de date n'exposent pas
  `aria-pressed` (l'état actif n'est que visuel).

## 4. P2 restants (constatés, non corrigés — gel oblige)

1. Journal corrompu = repart à vide sans proposer de récupération (l'export est la sauvegarde).
2. Message d'erreur de chargement générique (mentionne file:// même quand c'est un 404).
3. Fiche exercice manquante affiche l'id brut comme nom.
4. Entrées futures importées comptées sans marquage.
5. `aria-pressed` absent des puces de date et chips de charges.
6. Le graphique Charges n'a pas d'alternative textuelle complète (le détail sous le canvas en donne l'essentiel).

Ces P2 vont dans l'écran Idées de l'app s'ils démangent pendant le bloc — pas dans le code.
