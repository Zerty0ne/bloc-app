/* Portée depuis la campagne de validation V2→V4 — voir tests/README.md */
const RACINE_URL = process.env.BLOC_URL || "http://localhost:8123";
const OPTS_CHROMIUM = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const CACHE_ATTENDU = /const CACHE = "([^"]+)"/.exec(
  require("fs").readFileSync(require("path").join(__dirname, "..", "sw.js"), "utf8"))[1];
/* Tests d'acceptation Bloc V2 — journal + quotas.
   Pilote Chromium headless contre BLOC_URL. */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const URL = RACINE_URL + "/index.html";
const results = [];
function ok(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

function iso(d) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
const today = new Date();
const TODAY = iso(today);
const YESTERDAY = iso(new Date(today.getTime() - 864e5));

async function newPage(browser, seedLocalStorage) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  if (seedLocalStorage) await page.addInitScript(seedLocalStorage);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#saisie-types .type-btn");
  return { ctx, page };
}

const getLS = (page, key) =>
  page.evaluate(k => JSON.parse(localStorage.getItem("bloc." + k) || "null"), key);

async function clickType(page, label) {
  await page.locator("#saisie-types .type-btn", { hasText: label }).first().click();
}

(async () => {
  const browser = await chromium.launch(OPTS_CHROMIUM);

  /* ---- Critère 1 : trois entrées le même jour, quotas + extra ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Course");
    await clickType(page, "Vélo");
    await clickType(page, "Muscu libre");
    const nbEntrees = await page.locator("#saisie-entrees li").count();
    const journal = await getLS(page, "journal");
    const quotas = await page.locator(".quota-ligne").allTextContents();
    const velo = quotas.find(t => t.includes("Vélo")), course = quotas.find(t => t.includes("Course"));
    const extras = await page.locator(".quota-extras").textContent().catch(() => "");
    // pastilles sur la carte du jour
    const pastilles = await page.locator(".jour-carte.aujourdhui .pastille").allTextContents();
    ok("C1 — 3 entrées listées dans la saisie", nbEntrees === 3, `${nbEntrees} entrées`);
    ok("C1 — 3 entrées dans le journal (même date)", journal.length === 3 && journal.every(e => e.date === TODAY));
    ok("C1 — quota vélo incrémenté (1/3)", velo && velo.includes("1/3"), velo);
    ok("C1 — quota course incrémenté (1/2)", course && course.includes("1/2"), course);
    ok("C1 — muscu compté en extra", extras.includes("Extras : 1"), extras);
    ok("C1 — 3 pastilles sur la carte du jour", pastilles.length === 3, pastilles.join(","));
    await ctx.close();
  }

  /* ---- Critère 2 : course hier en deux taps ---- */
  {
    const { ctx, page } = await newPage(browser);
    await page.locator(".saisie-dates .chip", { hasText: "Hier" }).click();   // tap 1
    await clickType(page, "Course");                                          // tap 2
    const journal = await getLS(page, "journal");
    ok("C2 — course saisie pour hier en 2 taps",
      journal.length === 1 && journal[0].date === YESTERDAY && journal[0].type === "course",
      JSON.stringify(journal));
    await ctx.close();
  }

  /* ---- Critère 3 : course au lieu du vélo prévu — aucun état d'échec ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Course");
    const classesEchec = await page.evaluate(() =>
      document.querySelectorAll(".echec, .rate, .manque, [class*=fail], [class*=error]").length);
    const synthese = await page.locator("#ligne-jour").textContent();
    ok("C3 — aucun état d'échec dans le DOM", classesEchec === 0);
    ok("C3 — la ligne du jour liste le vélo restant", /3 vélo/.test(synthese), synthese.trim());
    ok("C3 — la ligne du jour nomme le plan du jour", /Aujourd'hui :/.test(synthese), synthese.trim());
    await ctx.close();
  }

  /* ---- Critère 4 : quota course 2/2 → créneaux course couverts ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Course");
    await clickType(page, "Course");
    const courseTxt = (await page.locator(".quota-ligne").allTextContents()).find(t => t.includes("Course"));
    // jeudi et dimanche = créneaux course du plan
    const couverts = await page.evaluate(() =>
      [...document.querySelectorAll(".jour-carte")].map(c => ({
        jour: c.querySelector(".jour-lettre").textContent,
        couvert: c.classList.contains("couvert"),
      })));
    const jeu = couverts.find(c => c.jour === "jeu"), dim = couverts.find(c => c.jour === "dim");
    ok("C4 — quota course affiché 2/2", courseTxt && courseTxt.includes("2/2"), courseTxt);
    ok("C4 — créneaux course du plan couverts (jeu + dim)", jeu.couvert && dim.couvert,
      JSON.stringify(couverts));
    await ctx.close();
  }

  /* ---- Critère 5 : suppression en un tap, recalcul ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Course");
    await clickType(page, "Course");
    await page.locator("#saisie-entrees li .suppr", { hasText: "✕" }).first().click();
    const journal = await getLS(page, "journal");
    const courseTxt = (await page.locator(".quota-ligne").allTextContents()).find(t => t.includes("Course"));
    ok("C5 — entrée supprimée en un tap", journal.length === 1);
    ok("C5 — quotas recalculés (1/2)", courseTxt && courseTxt.includes("1/2"), courseTxt);
    await ctx.close();
  }

  /* ---- Critère 6 : rappel 24h course après renfo, non bloquant ---- */
  {
    const seed = `localStorage.setItem("bloc.journal", JSON.stringify([{date:"${YESTERDAY}",type:"renfo",note:""}]));
      localStorage.setItem("bloc.schema_version","2");`;
    const { ctx, page } = await newPage(browser, seed);
    await clickType(page, "Course");
    const toastVisible = await page.evaluate(() => {
      const t = document.getElementById("toast");
      return !t.classList.contains("hidden") ? t.textContent : null;
    });
    const journal = await getLS(page, "journal");
    ok("C6 — l'entrée course est bien enregistrée (pas de blocage)",
      journal.length === 2 && journal[1].type === "course");
    ok("C6 — rappel 24h affiché", toastVisible && toastVisible.includes("24h"), toastVisible || "pas de toast");
    await ctx.close();
  }

  /* ---- Critère 7 : séance renfo guidée → journal + quota + charges ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Renfo KB");
    await page.locator("#saisie-renfo-choix .btn", { hasText: "Séance guidée" }).click();
    await page.locator("#go").click();                       // Lancer la séance
    await page.locator("#suivant").click();                  // timer mobilité → bloc force
    // Bloc force : 3 tours × 5 exercices
    for (let t = 0; t < 3; t++) {
      for (let e = 0; e < 5; e++) {
        const kg = page.locator("#kg");
        if (await kg.count()) await kg.fill("16");
        await page.locator("#suivant").click();
      }
    }
    await page.locator("#suivant").click();                  // timer fermeture → fin
    await page.locator("#ressenti").fill("bon test");
    await page.locator("#valider").click();
    await page.waitForSelector("#saisie-types .type-btn");
    const journal = await getLS(page, "journal");
    const charges = await getLS(page, "charges");
    const renfoTxt = (await page.locator(".quota-ligne").allTextContents()).find(t => t.includes("Renfo"));
    ok("C7 — la séance guidée crée l'entrée journal renfo",
      journal.length === 1 && journal[0].type === "renfo" && journal[0].date === TODAY
      && journal[0].note.includes("bon test"), JSON.stringify(journal));
    ok("C7 — quota renfo incrémenté (1/2)", renfoTxt && renfoTxt.includes("1/2"), renfoTxt);
    ok("C7 — charges enregistrées (4 exercices trackés)",
      charges && Object.keys(charges).length === 4 && charges["goblet-squat"][0].kg === 16,
      JSON.stringify(Object.keys(charges || {})));
    // l'écran Charges les affiche
    await page.locator('.tab[data-view="charges"]').click();
    const chips = await page.locator("#charges-chips .chip").count();
    ok("C7 — écran Charges alimenté", chips === 4, `${chips} chips`);
    await ctx.close();
  }

  /* ---- Critère 8 : migration V1 → V2 sans perte ---- */
  {
    const seed = `
      localStorage.setItem("bloc.validations", JSON.stringify({
        "2026-08-04": {type:"velo",  statut:"fait"},
        "2026-08-05": {type:"renfo", statut:"minimale", ressenti:"dur mais bien"},
        "2026-08-06": {type:"velo",  statut:"swap"}
      }));
      localStorage.setItem("bloc.bonus", JSON.stringify([
        {date:"2026-08-07", seance_id:"combat-flow"},
        {date:"2026-08-07", seance_id:"tibetains-matin", ressenti:"réveil ok"}
      ]));
      localStorage.setItem("bloc.charges", JSON.stringify({"goblet-squat":[{date:"2026-08-05",kg:14,ressenti:""}]}));
      localStorage.setItem("bloc.backlog_idees", JSON.stringify([{date:"2026-08-05",texte:"idée test"}]));`;
    const { ctx, page } = await newPage(browser, seed);
    const j = await getLS(page, "journal");
    const attendu = [
      e => e.date === "2026-08-04" && e.type === "velo" && e.note === "",
      e => e.date === "2026-08-05" && e.type === "renfo" && e.note === "séance minimale — dur mais bien",
      e => e.date === "2026-08-06" && e.type === "velo" && e.note === "swap course→vélo",
      e => e.date === "2026-08-07" && e.type === "boxe" && e.note === "Combat-Flow",
      e => e.date === "2026-08-07" && e.type === "autre" && e.note.startsWith("Tibétains du matin"),
    ];
    ok("C8 — 5 entrées migrées avec les bons types/notes",
      j && j.length === 5 && attendu.every(f => j.some(f)), JSON.stringify(j));
    const [charges, backlog, valid, bonus, schema] = await Promise.all([
      getLS(page, "charges"), getLS(page, "backlog_idees"),
      getLS(page, "validations"), getLS(page, "bonus"), getLS(page, "schema_version")]);
    ok("C8 — charges et idées conservées", charges["goblet-squat"][0].kg === 14 && backlog[0].texte === "idée test");
    ok("C8 — validations/bonus supprimées, schema_version=2",
      valid === null && bonus === null && schema === 2);
    // pas de rejeu : recharger ne double pas le journal
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#saisie-types .type-btn");
    const j2 = await getLS(page, "journal");
    ok("C8 — migration non rejouée après rechargement", j2.length === 5, `${j2.length} entrées`);
    await ctx.close();
  }

  /* ---- Critère 9 : export → effacement → import, journal intact ---- */
  {
    const { ctx, page } = await newPage(browser);
    await clickType(page, "Course");
    await clickType(page, "Boxe");
    const avant = await getLS(page, "journal");
    await page.locator('.tab[data-view="reglages"]').click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btn-export").click(),
    ]);
    const fichier = path.join(__dirname, "export-test.json");
    await download.saveAs(fichier);
    // effacement complet puis import
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#saisie-types .type-btn");
    ok("C9 — localStorage vidé avant import", (await getLS(page, "journal")).length === 0);
    await page.locator('.tab[data-view="reglages"]').click();
    await page.locator("#import-file").setInputFiles(fichier);
    await page.waitForTimeout(300);
    const apres = await getLS(page, "journal");
    ok("C9 — journal intact après export → effacement → import",
      JSON.stringify(apres) === JSON.stringify(avant), JSON.stringify(apres));
    const exporte = JSON.parse(fs.readFileSync(fichier, "utf8"));
    ok("C9 — l'export contient journal + schema_version",
      Array.isArray(exporte.journal) && exporte.schema_version === 2);
    await ctx.close();
  }

  /* ---- Bonus : import d'un export V1 → migration ---- */
  {
    const { ctx, page } = await newPage(browser);
    const fichierV1 = path.join(__dirname, "export-v1.json");
    fs.writeFileSync(fichierV1, JSON.stringify({
      version: 1,
      bloc_actif: { id: "bloc-1", date_debut: "2026-08-03" },
      validations: { "2026-08-04": { type: "course", statut: "fait" } },
      bonus: [{ date: "2026-08-05", seance_id: "combat-flow" }],
      charges: {}, backlog_idees: [],
    }));
    await page.locator('.tab[data-view="reglages"]').click();
    await page.locator("#import-file").setInputFiles(fichierV1);
    await page.waitForTimeout(300);
    const j = await getLS(page, "journal");
    ok("Import V1 — converti en journal (course + boxe)",
      j.length === 2 && j.some(e => e.type === "course") && j.some(e => e.type === "boxe"),
      JSON.stringify(j));
    await ctx.close();
  }

  /* ---- Critère 10 : offline via service worker (cache bloc-v5) ---- */
  {
    const { ctx, page } = await newPage(browser);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async c => (await caches.keys()).includes(c), CACHE_ATTENDU, { timeout: 15000 });
    const cles = await page.evaluate(() => caches.keys());
    ok(`C10 — cache ${CACHE_ATTENDU} créé (et lui seul)`, cles.length === 1 && cles[0] === CACHE_ATTENDU, cles.join(","));
    const { manquants, nbCache, nbFichiers } = await page.evaluate(async cache => {
      const reqs = (await (await caches.open(cache)).keys()).map(r => new URL(r.url).pathname);
      const sw = await (await fetch("sw.js")).text();
      const fichiers = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map(m => "/" + m[1].slice(2));
      return { manquants: fichiers.filter(f => !reqs.includes(f)), nbCache: reqs.length, nbFichiers: fichiers.length };
    }, CACHE_ATTENDU);
    ok("C10 — précache complet (tout FICHIERS en cache)",
      manquants.length === 0 && nbCache === nbFichiers, `${nbCache}/${nbFichiers}, manquants: ${manquants.join(",") || "aucun"}`);
    // coupure réseau : l'app doit se recharger depuis le cache
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector("#saisie-types .type-btn", { timeout: 10000 });
    const quotasOffline = await page.locator(".quota-ligne").count();
    ok("C10 — app fonctionnelle hors ligne (rechargée depuis le cache)", quotasOffline === 3);
    await ctx.close();
  }

  await browser.close();
  const fails = results.filter(r => !r.pass);
  console.log(`\n${results.length - fails.length}/${results.length} tests passés`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("ERREUR SCRIPT:", e); process.exit(2); });
