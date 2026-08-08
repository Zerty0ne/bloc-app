# Bloc V3 — journal de la boucle d'amélioration

Protocole : max 10 itérations. Chaque itération : proposer → pré-scorer (seuil 12/20)
→ implémenter → tester (Playwright headless) → jouer les 5 semaines-personas → garder
ou réverter. Grille : trait servi /5 · friction-feedback /5 · coût d'attention /4 ·
robustesse /3 · réversibilité /3.

---

## Itération 1 — Ligne du jour contextuelle · GARDÉE

**Proposition.** Une ligne sous l'en-tête de l'accueil : « Aujourd'hui : Sortie
longue ✓ — reste 2 course · 2 renfo kb. » Le plan du jour (avec ✓ si couvert) et le
reste de la semaine, lisibles sans scroller. La synthèse qui vivait sous le rail y est
**déplacée** (retrait net : un élément en moins sous la ligne de flottaison).

**Traits servis.** 1 (feedback en un regard dès l'ouverture) et 2 (la question « quoi
aujourd'hui ? » est répondue avant d'être posée).
**Comportement changé.** Ouvrir l'app suffit à savoir quoi faire et où on en est —
zéro tap, zéro scroll.
**Coût d'attention.** Négatif : aucun tap ajouté, un élément retiré du bas de page.

**Pré-score : 19/20** (5 + 4 + 4 + 3 + 3).

**Tests.** Ligne correcte à vide (« reste 3 vélo · 2 course · 2 renfo kb »), après
saisies (✓ apparaît quand le jour est couvert), semaine pleine (« semaine
couverte »). Régression complète : 31/31.

**Personas.** Idéale : ligne quasi muette (« ✓ — semaine couverte »). Chaotique :
c'est elle qui remet au clair après le rattrapage. Fatigue/signal : vocabulaire
strictement factuel (« reste », jamais « manqué »). Hyperfocus : contenu statique
entre deux saisies, rien à « regarder ».

**Verdict : gardée.**

---

## Itération 2 — Le bilan qui lit au lieu de compter · GARDÉE

**Proposition.** Carte « Lecture » en tête du bilan : 1 à 2 phrases générées par des
règles simples sur les données de la semaine. Règles : semaine vide (« lundi remet
les compteurs à zéro » — jamais de reproche), quotas couverts (+ extras), couverture
partielle factuelle, séances minimales (« comptées en plein : la régularité prime sur
le volume » — le pourquoi, trait 3), dépassement course/renfo (rappel de l'objectif
du bloc, cité depuis le JSON de l'utilisateur — pas de contenu inventé). Aucun
comptage de semaines consécutives (ce serait un streak déguisé).

**Traits servis.** 7 (le bilan interprète, zéro saisie) et 3 (rationale visible).
**Comportement changé.** Le bilan devient une lecture, pas un tableau de chiffres.
**Coût d'attention.** Nul : aucun tap, l'écran existant s'enrichit.

**Pré-score : 19/20** (5 + 4 + 4 + 3 + 3).

**Tests.** 5 scénarios seedés (vide, couverte+extras, partielle, fatigue/minimales,
sur-quota course) : phrases correctes, et scan automatique du vocabulaire interdit
(raté, manqué, échec, dette, « seulement », « d'affilée »…) : propre partout.
Régression : 31/31.

**Personas.** Idéale : « Tous les quotas sont couverts. » — sobre. Chaotique :
lecture factuelle sans jugement. Fatigue : c'est ici que la phrase minimales porte le
rationale anti-culpabilité. Signal physique : le sur-quota course déclenche le rappel
de l'objectif tissus — l'app soutient la prudence. Hyperfocus : le texte ne change
qu'avec les données, rien à farmer.

**Verdict : gardée** (une reformulation en cours d'itération : la première version
renvoyait vers « la ligne du jour », référence croisée confuse depuis le bilan).

---

## Itération 3 — Deltas de charges sur l'écran de fin de séance · GARDÉE

**Proposition.** L'écran « Terminé » de la séance renfo affiche les charges saisies
du jour avec le delta vs la séance précédente (« Goblet squat 16 kg (+2) »,
« = » si stable, « première mesure » sinon). C'est le pic de feedback légitime
du territoire 5 : densifier ce moment sans le rallonger.

**Traits servis.** 1 (feedback immédiat au moment où il a le plus de valeur).
**Comportement changé.** La progression se voit à la seconde où la séance se
termine, au lieu d'exiger un détour par l'écran Charges.
**Coût d'attention.** Nul : zéro tap, l'écran de fin existait déjà, le bouton
« Valider et fermer » reste au même endroit.

**Pré-score : 19/20** (5 + 4 + 4 + 3 + 3).

**Tests.** Séance guidée complète avec historique seedé : « 16 kg (+2) » affiché
pour l'exercice avec antécédent, « première mesure » pour le nouveau, exercices
non remplis absents de la liste, persistance des charges inchangée après
validation. Régression : 31/31. (Un delta négatif s'affiche « −x » sans autre
traitement : une charge qui baisse est une donnée, pas un échec.)

**Personas.** Idéale/fatigue : le (+) ou le (=) est le même feedback sobre ; en
séance minimale l'écran reste identique. Signal physique : une baisse volontaire
de charge s'affiche factuellement, aucun marquage. Hyperfocus : l'écran n'existe
qu'en fin de séance réelle — il récompense l'entraînement, pas la consultation.

**Verdict : gardée.**
