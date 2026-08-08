/* Portée depuis la campagne de validation V2→V4 — voir tests/README.md */
const RACINE_URL = process.env.BLOC_URL || "http://localhost:8123";
const OPTS_CHROMIUM = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
/* Phase A — sondes de robustesse : constater, pas supposer */
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch(OPTS_CHROMIUM);
  const URL = RACINE_URL + "/index.html";

  // A1 — journal corrompu dans localStorage
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(`localStorage.setItem("bloc.journal", "{pas du json");
      localStorage.setItem("bloc.schema_version","2");`);
    const erreurs = [];
    page.on("pageerror", e => erreurs.push(e.message));
    await page.goto(URL, { waitUntil: "networkidle" });
    const ok = await page.locator("#saisie-types .type-btn").count();
    await page.locator("#saisie-types .type-btn", { hasText: "Vélo" }).first().click();
    const j = await page.evaluate(() => JSON.parse(localStorage.getItem("bloc.journal")));
    console.log("A1 journal corrompu → app charge:", ok > 0, "| saisie repart de zéro:", j.length === 1, "| erreurs:", erreurs.length);
  }

  // A2 — localStorage plein (setItem lance QuotaExceededError)
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(`const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {
        if (k === "bloc.journal") { const e = new Error("QuotaExceeded"); e.name = "QuotaExceededError"; throw e; }
        return orig.apply(this, arguments);
      };`);
    const erreurs = [];
    page.on("pageerror", e => erreurs.push(e.message));
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator("#saisie-types .type-btn", { hasText: "Vélo" }).first().click().catch(() => {});
    await page.waitForTimeout(300);
    const entrees = await page.locator("#saisie-entrees li").count();
    const toast = await page.evaluate(() => {
      const t = document.getElementById("toast");
      return t && !t.classList.contains("hidden") ? t.textContent : null;
    });
    console.log("A2 stockage plein → erreurs JS:", JSON.stringify(erreurs), "| entrée affichée:", entrees, "| feedback utilisateur:", toast);
  }

  // A3 — import d'un JSON valide mais de forme inattendue ({"foo":1})
  {
    const fs = require("fs"); const path = require("path");
    const page = await (await browser.newContext()).newPage();
    page.on("dialog", d => d.accept());
    await page.addInitScript(`localStorage.setItem("bloc.schema_version","2");
      localStorage.setItem("bloc.journal", JSON.stringify([{date:"2026-08-05",type:"velo",note:"précieuse"}]));`);
    await page.goto(URL, { waitUntil: "networkidle" });
    const f = path.join(__dirname, "mauvais.json");
    fs.writeFileSync(f, JSON.stringify({ foo: 1 }));
    await page.locator('.tab[data-view="reglages"]').click();
    await page.locator("#import-file").setInputFiles(f);
    await page.waitForTimeout(300);
    const j = await page.evaluate(() => JSON.parse(localStorage.getItem("bloc.journal") || "[]"));
    console.log("A3 import {foo:1} → journal après import:", JSON.stringify(j), j.length ? "(conservé)" : "(PERDU !)");
  }

  // A4 — config pointe vers un bloc absent
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route("**/blocs/bloc-1.json", r => r.abort());
    await page.goto(URL, { waitUntil: "networkidle" });
    const corps = (await page.textContent("body")).slice(0, 120).replace(/\s+/g, " ");
    console.log("A4 bloc manquant → écran:", corps);
    await ctx.close();
  }

  // A5 — fiche exercice manquante pendant une séance
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route("**/exercices/goblet-squat.json", r => r.abort());
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator("#saisie-types .type-btn", { hasText: "Renfo KB" }).first().click();
    await page.locator("#saisie-renfo-choix .btn", { hasText: "Séance guidée" }).click();
    await page.locator("#go").click();
    await page.locator("#suivant").click();
    const nom = await page.locator(".exo-nom").textContent();
    console.log("A5 fiche absente → séance continue, exo affiché:", JSON.stringify(nom.trim()));
    await ctx.close();
  }

  // A6 — entrée de journal à une date future (via import)
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(() => {
      const d = new Date(); d.setDate(d.getDate() + 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      localStorage.setItem("bloc.schema_version", "2");
      localStorage.setItem("bloc.journal", JSON.stringify([{date: iso, type: "velo", note: "future"}]));
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    const ligne = await page.locator("#ligne-jour").textContent();
    const quota = (await page.locator(".quota-ligne").allTextContents()).find(t => t.includes("Vélo"));
    console.log("A6 entrée future → app charge, quota vélo:", quota.replace(/\s+/g," ").trim(), "| ligne:", ligne.trim().slice(0, 60));
  }

  await browser.close();
})();
