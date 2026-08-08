/* Portée depuis la campagne de validation V2→V4 — voir tests/README.md */
const RACINE_URL = process.env.BLOC_URL || "http://localhost:8123";
const OPTS_CHROMIUM = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch(OPTS_CHROMIUM);
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(`localStorage.setItem("bloc.schema_version","2");
    localStorage.setItem("bloc.backlog_idees", JSON.stringify([{date:"2026-08-05",texte:"test date"}]));
    localStorage.setItem("bloc.charges", JSON.stringify({"goblet-squat":[{date:"2026-08-05",kg:14},{date:"2026-08-08",kg:16}]}));`);
  await page.goto(RACINE_URL + "/index.html", { waitUntil: "networkidle" });
  await page.locator('.tab[data-view="idees"]').click();
  const dateIdee = (await page.locator(".idees-liste .date").textContent()).trim();
  console.log(dateIdee === "05/08" ? "PASS idées en JJ/MM" : "FAIL idées", dateIdee);
  const fmt = await page.evaluate(() => fmtJJMM("2026-08-05"));
  console.log(fmt === "05/08" ? "PASS fmtJJMM (étiquettes du graphique charges)" : "FAIL fmtJJMM", fmt);
  // la puce de date du rail reste correcte
  await page.locator('.tab[data-view="accueil"]').click();
  await page.locator(".jour-carte.cliquable").first().click();
  const chip = (await page.locator(".saisie-dates .chip.active").textContent()).trim();
  console.log(/^\w+\. \d{2}\/\d{2}$/.test(chip) ? "PASS puce rail en jjj. JJ/MM" : "FAIL puce", chip);
  await browser.close();
})();
