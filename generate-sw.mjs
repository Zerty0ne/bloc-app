#!/usr/bin/env node
/* Régénère la liste FICHIERS de sw.js depuis l'arborescence réelle.
   Usage :  node generate-sw.mjs           réécrit sw.js (CACHE inchangé)
            node generate-sw.mjs --check   sort en erreur si sw.js diverge
   Exclusions : documentation, tests, outillage — tout ce qui n'est pas servi
   à l'app. Après ajout/suppression de fichiers : régénérer PUIS incrémenter
   la constante CACHE de sw.js à la main (le bump reste une décision humaine). */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL(".", import.meta.url));
const EXCLUS = new Set(["sw.js", "README.md", "CHANGELOG-V3.md", "AUDIT.md", "generate-sw.mjs"]);
const DOSSIERS_EXCLUS = new Set([".git", "tests", "node_modules"]);

function lister(dir) {
  const resultat = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const chemin = join(dir, e.name);
    const rel = relative(RACINE, chemin);
    if (e.isDirectory()) {
      if (!DOSSIERS_EXCLUS.has(e.name)) resultat.push(...lister(chemin));
    } else if (!EXCLUS.has(rel)) resultat.push(rel.split("\\").join("/"));
  }
  return resultat;
}

const fichiers = ["./", ...lister(RACINE).sort().map(f => "./" + f)];
const bloc = "const FICHIERS = [\n" + fichiers.map(f => `  "${f}"`).join(",\n") + "\n];";

const swPath = join(RACINE, "sw.js");
const sw = readFileSync(swPath, "utf8");
const nouveau = sw.replace(/const FICHIERS = \[[\s\S]*?\];/, bloc);
if (!/const FICHIERS = \[[\s\S]*?\];/.test(sw)) {
  console.error("sw.js : bloc FICHIERS introuvable"); process.exit(2);
}

if (process.argv.includes("--check")) {
  if (nouveau === sw) { console.log(`sw.js à jour (${fichiers.length} entrées)`); process.exit(0); }
  console.error("sw.js DIVERGE de l'arborescence — lancer : node generate-sw.mjs");
  process.exit(1);
} else {
  writeFileSync(swPath, nouveau);
  console.log(`sw.js régénéré (${fichiers.length} entrées). Penser au bump de CACHE si le contenu a changé.`);
}
