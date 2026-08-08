/* Portée depuis la campagne de validation V2→V4 — voir tests/README.md */
const RACINE_URL = process.env.BLOC_URL || "http://localhost:8123";
const OPTS_CHROMIUM = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
/* Les 5 semaines-personas contre la build finale */
const { chromium } = require("playwright-core");
const INTERDITS = /raté|manqué|échec|dette|rouge|honte|streak|série|d'affilée|seulement/i;
(async () => {
  const browser = await chromium.launch(OPTS_CHROMIUM);
  const lundi = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay()+6)%7); return d; })();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const J = n => { const d = new Date(lundi); d.setDate(d.getDate()+n); return iso(d); };
  const e = (n, type, note="") => ({date: J(n), type, note});

  const personas = {
    "ideale": [e(1,"velo"), e(2,"renfo"), e(3,"course"), e(5,"velo"), e(5,"renfo"), e(6,"course"), e(4,"velo")],
    "chaotique": [e(3,"course"), e(5,"velo"), e(5,"muscu"), e(5,"course"), e(4,"velo",  "rattrapé de mémoire")],
    "fatigue": [e(2,"renfo","séance minimale"), e(4,"velo","tour très doux")],
    "signal-physique": [e(1,"velo"), e(2,"renfo"), e(3,"velo","gêne tendon — course remplacée"), e(5,"velo")],
    "hyperfocus": [e(1,"velo")],
  };

  for (const [nom, journal] of Object.entries(personas)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript(`localStorage.setItem("bloc.schema_version","2");
      localStorage.setItem("bloc.journal", JSON.stringify(${JSON.stringify(journal)}));`);
    await page.goto(RACINE_URL + "/index.html", { waitUntil: "networkidle" });
    await page.waitForSelector("#saisie-types .type-btn");
    const ligne = (await page.locator("#ligne-jour").textContent()).trim();
    await page.locator('.tab[data-view="bilan"]').click();
    const lecture = (await page.locator(".lecture").textContent()).trim();
    const accueilTxt = await page.evaluate(() => document.getElementById("view-accueil").textContent);
    const propre = !INTERDITS.test(ligne) && !INTERDITS.test(lecture) && !INTERDITS.test(accueilTxt);
    console.log(`--- ${nom} ${propre ? "(vocabulaire OK)" : "(VOCABULAIRE INTERDIT DÉTECTÉ)"}`);
    console.log(`    ligne du jour : ${ligne}`);
    console.log(`    lecture bilan : ${lecture}`);
    if (nom === "hyperfocus") {
      // 5 ouvertures successives : le contenu doit être strictement identique
      let prev = null, stable = true;
      for (let i = 0; i < 5; i++) {
        await page.locator('.tab[data-view="accueil"]').click();
        const t = await page.evaluate(() => document.getElementById("view-accueil").innerHTML);
        if (prev !== null && t !== prev) stable = false;
        prev = t;
      }
      console.log(`    5 consultations → contenu strictement identique : ${stable}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
