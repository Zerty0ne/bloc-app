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
