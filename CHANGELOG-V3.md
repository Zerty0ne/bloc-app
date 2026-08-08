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

---

## Itération 4 — Raccourcis OS « J'ai fait vélo / course » · GARDÉE

**Proposition.** Deux `shortcuts` dans le manifest PWA (appui long sur l'icône
Android) : « J'ai fait vélo » et « J'ai fait course » ouvrent l'app avec
`?fait=velo|course` ; l'app journalise pour aujourd'hui, affiche « Vélo — noté. »
et nettoie l'URL (`history.replaceState`) pour interdire la double saisie au
rechargement. Un type inconnu est ignoré sans erreur. Si la règle des 24h joue,
son rappel remplace le toast de confirmation (le quota incrémenté confirme déjà).
Vélo et course seulement : le renfo passe par l'app de toute façon (séance guidée).

**Traits servis.** 4 (temps dans l'app en baisse : la saisie la plus fréquente ne
demande même plus de naviguer) et 1 (confirmation immédiate).
**Comportement changé.** Saisie du jour possible en 1 geste depuis l'écran
d'accueil du téléphone, app refermable aussitôt.
**Coût d'attention.** Négatif sur le parcours le plus fréquent ; les parcours
existants sont inchangés au tap près.

**Pré-score : 18/20** (5 + 4 + 4 + 2 + 3) — robustesse à 2 : le support des
shortcuts dépend du launcher Android (dégradation propre : l'icône ouvre l'app
normalement).

**Tests.** `?fait=velo` : entrée créée, toast, URL nettoyée, reload sans double
saisie. `?fait=course` après renfo hier : rappel 24h prioritaire. `?fait=zzz` :
ignoré. Régression : 31/31. Non vérifiable ici : l'appui long réel sur launcher
Android (testé via l'URL, qui est le mécanisme sous-jacent).

**Personas.** Idéale : l'app devient quasi invisible (geste unique). Chaotique :
le rattrapage rétroactif reste dans l'app (les shortcuts ne datent qu'aujourd'hui
— volontaire : pas de choix de date au niveau OS, trait 2). Fatigue : noter un
vélo doux coûte un geste. Signal physique : rappel 24h préservé même par ce
chemin. Hyperfocus : le raccourci évite précisément d'ouvrir-regarder l'app.

**Verdict : gardée.**

---

## Itération 5 — L'échéance bloc 2 rendue concrète · GARDÉE

**Proposition.** Sous les règles du bloc, une ligne discrète : « Bloc 2 dans 28 j —
débloque : Turkish Get-Up · Swings KB. » Les labels sont **lus dans les JSON de
séance** (variantes `bloc_min` > bloc courant) — zéro contenu inventé, et la ligne
disparaît d'elle-même quand le bloc est terminé ou qu'il n'y a rien à déverrouiller.
Le compteur « Bloc 2 dans N j » existait ; il gagne un contenu concret à attendre.

**Traits servis.** 6 (nouveauté planifiée : une échéance datée avec un contenu
nommé, pas un générateur) et 3 (le déverrouillage progressif porte le rationale du
bloc reprise).
**Comportement changé.** L'attente du bloc 2 a un objet précis, sans rien
demander.
**Coût d'attention.** Nul : une ligne statique en pied d'accueil.

**Pré-score : 17/20** (5 + 2 + 4 + 3 + 3).

**Tests.** Ligne correcte avec les deux variantes verrouillées trouvées dans
combat-flow ; disparition vérifiée quand `date_debut` est vieille de 5 semaines
(bloc fini). Régression : 31/31.

**Personas.** Toutes : ligne inerte et identique — elle ne réagit à aucun
comportement, ne récompense pas l'ouverture répétée (hyperfocus), ne juge rien
(fatigue/signal). Elle ne fait que rendre l'échéance tangible.

**Verdict : gardée.**

---

## Itération 6 — Pulsation du segment de quota à la saisie · GARDÉE

**Proposition.** À chaque saisie, le segment de quota qui vient de se remplir pulse
0,4 s (CSS pur, `prefers-reduced-motion` respecté — l'animation y est coupée comme
les transitions). Une saisie hors quota ne pulse rien (l'entrée qui apparaît dans la
liste reste le feedback). Un simple re-rendu (navigation) ne re-déclenche pas.

**Traits servis.** 1 (le geste central produit une réponse visible à l'endroit
exact où le regard se pose — le quota).
**Comportement changé.** La confirmation de saisie devient physique, sans toast
redondant (l'alternative « toast à chaque saisie » a été rejetée, itération 8).
**Coût d'attention.** Nul : rien d'ajouté aux parcours, 0,4 s d'animation unique.

**Pré-score : 18/20** (4 + 4 + 4 + 3 + 3).

**Tests.** Pulse sur le bon segment (1er segment vélo après une saisie vélo), pas
de pulse sur les autres, pas de re-pulse lors d'un re-rendu sans saisie.
Régression : 31/31.

**Personas.** Hyperfocus : c'est le point sensible — la pulsation ne se déclenche
qu'à la saisie d'une activité réelle, jamais à la consultation ; ouvrir l'app 15
fois ne produit rien. Pas de récompense variable (interdit) : le même geste produit
toujours exactement la même réponse. Autres personas : neutre ou positif.

**Verdict : gardée.**

---

## Itération 7 — Surbrillance du type « prévu aujourd'hui » dans la saisie · ABANDONNÉE

**Proposition.** Marquer d'un liseré ambre le bouton-type correspondant au plan du
jour (mardi → « Vélo » surligné), pour servir le trait 2.

**Pourquoi c'est rejeté avant scoring complet.** Un bouton surligné-mais-pas-tapé
en fin de journée est une dette implicite : exactement l'état que la règle dure
(trait 5, interdit « aucune dette affichée ») bannit — le rail « couvert » marque ce
qui est fait, jamais ce qui ne l'est pas, et cette surbrillance aurait inversé la
polarité. Pire en semaine de signal physique : gêne au tendon un jour course, le
bouton « Course » surligné pousse doucement contre la règle du lendemain. La ligne
du jour (it. 1) sert déjà le trait 2 sans cet effet de bord.

**Verdict : abandonnée** (conflit avec un interdit ; aucun score ne les rachète).

---

## Itération 8 — Toast de confirmation à chaque saisie manuelle · ABANDONNÉE

**Proposition.** « Vélo — noté. » en toast après chaque tap de type (comme les
raccourcis OS de l'it. 4).

**Pré-score : 11/20** (trait 1 : 2 — déjà servi ; friction-feedback : 1 —
redondant ; attention : 3 — un élément de plus à ignorer, risque de masquer le
rappel 24h ; robustesse : 3 ; réversibilité : 2 — habitude vite prise, retrait
visible). Dans l'app, la saisie se fait à l'écran : l'entrée apparaît dans la liste
et le quota s'incrémente sous les yeux — un toast par-dessus est du bruit. Le toast
de l'it. 4 se justifie uniquement parce que le raccourci OS court-circuite l'écran.
La pulsation de segment (it. 6) est la bonne réponse au même besoin.

**Verdict : abandonnée** (score < 12).

---

## Itération 9 — Thème clair automatique pour le plein soleil · ABANDONNÉE

**Proposition.** `@media (prefers-color-scheme: light)` avec une palette claire,
pour la lisibilité en extérieur (contexte d'usage déclaré).

**Pré-score : 11/20** (trait servi : 0 — le plein soleil est un contexte, aucun
des sept traits n'est nommable, et la grille est explicite : 0 si aucun trait ;
friction-feedback : 1 ; attention : 4 ; robustesse : 3 ; réversibilité : 3).
S'y ajoute un doute sérieux : dupliquer la palette double la surface de test
visuel de chaque futur changement, et le thème sombre unique est un choix de
design assumé de la V1. Doute sérieux = non.

**Verdict : abandonnée** (score < 12 ; si la lisibilité extérieure devient un
problème réel, la réponse proportionnée serait un bump de contraste de --muted,
pas un second thème).

---

## Itération 10 — Navigation des semaines passées dans le bilan · ABANDONNÉE

**Proposition.** Des flèches ‹ › dans le bilan pour consulter les semaines
antérieures (servirait le trait 7, les rétrospectives).

**Pré-score : 10/20** (trait 7 : 3 — mais le bilan montre déjà la semaine
précédente entre parenthèses et la tendance 4 semaines : l'essentiel de la
rétrospective est là sans navigation ; friction-feedback : 0 — n'améliore aucun
parcours existant, en crée un ; attention : 1 — des taps nouveaux, et surtout un
terrain d'exploration : c'est précisément le comportement que le trait 4 demande de
ne pas récompenser ; robustesse : 3 ; réversibilité : 3). L'archéologie de son
propre journal est l'hyperfocus déguisé en vertu.

**Verdict : abandonnée** (score < 12).

---

## Clôture de boucle

**Bilan : 6 gardées, 4 abandonnées, 0 revertée.** Aucun tap ajouté à aucun parcours
existant sur l'ensemble de la boucle ; la saisie du jour reste à 2 taps (1 geste via
raccourci OS). Cache service worker : `bloc-v3` → `bloc-v4` (bump unique de fin de
boucle ; liste `FICHIERS` revérifiée contre l'arborescence — aucun fichier applicatif
ajouté ni retiré, `CHANGELOG-V3.md` volontairement hors précache comme le README).

**Validation finale.** Régression complète 31/31 (saisie multi-entrées, 2 taps,
quotas, séance guidée intégrale, migration V1→V2 non régressée, export/import,
offline `bloc-v4` réseau coupé), scénarios de lecture du bilan, raccourcis OS,
et les cinq semaines-personas rejouées sur la build finale : vocabulaire propre
partout (scan automatique des termes punitifs), et en semaine d'hyperfocus cinq
consultations successives produisent un contenu strictement identique — rien dans
l'app ne récompense la consultation.
