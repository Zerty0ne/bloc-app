/* Portée depuis la campagne de validation V2→V4 — voir tests/README.md */
const RACINE_URL = process.env.BLOC_URL || "http://localhost:8123";
const OPTS_CHROMIUM = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
/* Chantiers B1/B2/B3 : signal, bloc à venir, bilan et transition de fin */
const { chromium } = require("playwright-core");
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
let fails = 0;
const ok = (n, c, det="") => { if (!c) fails++; console.log(`${c?"PASS":"FAIL"} ${n}${det?" — "+det:""}`); };
(async () => {
  const browser = await chromium.launch(OPTS_CHROMIUM);
  const URL = RACINE_URL + "/index.html";

  /* B3 — signal : 2 taps, ni quota ni extra, pastille, lecture, 24h */
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator("#saisie-types .type-btn", { hasText: "Signal" }).click();  // 1 tap (date déjà sur aujourd'hui)
    const j = await page.evaluate(() => JSON.parse(localStorage.getItem("bloc.journal")));
    ok("B3 signal saisi en un tap type", j.length === 1 && j[0].type === "signal");
    const extras = await page.locator(".quota-extras").textContent();
    ok("B3 compté à part (ni extra ni quota)", extras.trim() === "Signal : 1", extras.trim());
    const pastille = await page.locator(".jour-carte.aujourdhui .pastille.signal").count();
    ok("B3 pastille signal distincte sur le rail", pastille === 1);
    // lecture hebdo : prudence appliquée
    await page.locator('.tab[data-view="bilan"]').click();
    const lecture = await page.locator(".lecture").first().textContent();
    ok("B3 lecture : prudence appliquée", /prudence appliquée/.test(lecture), lecture.trim());
    // 24h : renfo hier + signal hier → course aujourd'hui mentionne le signal
    await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate()-1);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      localStorage.setItem("bloc.journal", JSON.stringify([
        {date: iso, type:"renfo", note:""}, {date: iso, type:"signal", note:"tendon"}]));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#saisie-types .type-btn", { hasText: "Course" }).first().click();
    const toast = await page.evaluate(() => document.getElementById("toast").textContent);
    ok("B3 rappel 24h mentionne le signal", /24h.*signal est noté/s.test(toast), toast);
    await page.context().close();
  }

  /* B2 — bloc à venir */
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(() => {
      if (localStorage.getItem("test.seeded")) return;   // ne seed qu'au premier chargement
      localStorage.setItem("test.seeded", "1");
      const d = new Date(); d.setDate(d.getDate() + 5);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      localStorage.setItem("bloc.schema_version","2");
      localStorage.setItem("bloc.bloc_actif", JSON.stringify({id:"bloc-1", date_debut: iso}));
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    const compteur = (await page.locator("#bloc-compteur").textContent()).replace(/\s+/g," ").trim();
    ok("B2 compteur « démarre dans 5 j »", /démarre.*dans 5 j/.test(compteur), compteur);
    const ligne = (await page.locator("#ligne-jour").textContent()).trim();
    ok("B2 ligne du jour sans « reste »", /démarre dans 5 j/.test(ligne) && !/reste/.test(ligne), ligne);
    ok("B2 quotas visibles", (await page.locator(".quota-ligne").count()) === 3);
    ok("B2 pas de ligne bloc 2", (await page.locator(".prochain-bloc").count()) === 0);
    // le journal fonctionne avant le début
    await page.locator("#saisie-types .type-btn", { hasText: "Vélo" }).first().click();
    const q = (await page.locator(".quota-ligne").allTextContents()).find(t => t.includes("Vélo"));
    ok("B2 saisie avant le début comptée", q.includes("1/3"), q.replace(/\s+/g," ").trim());
    const lect = await (async () => { await page.locator('.tab[data-view="bilan"]').click();
      return page.locator(".lecture").first().textContent(); })();
    ok("B2 lecture : pas de reproche avant le départ", /n'a pas commencé/.test(lect), lect.trim());
    // futur → présent : date_debut repassée à aujourd'hui
    await page.evaluate(() => {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      localStorage.setItem("bloc.bloc_actif", JSON.stringify({id:"bloc-1", date_debut: iso}));
    });
    await page.reload({ waitUntil: "networkidle" });
    const c2 = (await page.locator("#bloc-compteur").textContent()).replace(/\s+/g," ").trim();
    ok("B2 bascule futur→présent", /Semaine 1\/4/.test(c2), c2);
    await page.context().close();
  }

  /* B1 — bilan de bloc (dernière semaine) + transition (bloc fini) */
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(() => {
      const d = new Date(); d.setDate(d.getDate() - 22);           // semaine 4 sur 4
      const iso = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
      const j = [];
      for (let s = 0; s < 3; s++) for (const [off, type] of [[1,"velo"],[2,"renfo"],[3,"course"],[5,"velo"]]) {
        const e = new Date(d); e.setDate(e.getDate() + s*7 + off); j.push({date: iso(e), type, note: s===1&&type==="renfo" ? "séance minimale" : ""});
      }
      const sig = new Date(d); sig.setDate(sig.getDate() + 9);
      j.push({date: iso(sig), type: "signal", note: "tendon"});
      localStorage.setItem("bloc.schema_version","2");
      localStorage.setItem("bloc.bloc_actif", JSON.stringify({id:"bloc-1", date_debut: iso(d)}));
      localStorage.setItem("bloc.journal", JSON.stringify(j));
      localStorage.setItem("bloc.charges", JSON.stringify({"goblet-squat":[{date:iso(d),kg:14},{date:iso(sig),kg:18}]}));
    });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator('.tab[data-view="bilan"]').click();
    const carte = await page.locator(".bilan-bloc").count();
    ok("B1 bilan de bloc visible en dernière semaine", carte === 1);
    const txt = (await page.locator(".bilan-bloc").textContent()).replace(/\s+/g," ").trim();
    ok("B1 cumul quotas par type", /vélo 6\/12/.test(txt), txt.slice(0,160));
    ok("B1 progression des charges 14 → 18 (+4)", /14 → 18 kg \(\+4\)/.test(txt));
    ok("B1 signaux et minimales dans la lecture", /1 signal et 1 séance minimale — la règle de prudence a fonctionné/.test(txt));
    await page.context().close();

    // bloc fini (date_debut il y a 30 j) → transition sur l'accueil
    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript(() => {
      const d = new Date(); d.setDate(d.getDate() - 30);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      localStorage.setItem("bloc.schema_version","2");
      localStorage.setItem("bloc.bloc_actif", JSON.stringify({id:"bloc-1", date_debut: iso}));
    });
    await page2.goto(URL, { waitUntil: "networkidle" });
    const fin = await page2.locator(".fin-bloc-carte").count();
    ok("B1 transition affichée à la fin du bloc", fin === 1);
    await page2.locator("#voir-bilan-bloc").click();
    ok("B1 accès direct au bilan de bloc", (await page2.locator(".bilan-bloc").count()) === 1);
    // l'app reste utilisable
    await page2.locator('.tab[data-view="accueil"]').click();
    await page2.locator("#saisie-types .type-btn", { hasText: "Vélo" }).first().click();
    const j2 = await page2.evaluate(() => JSON.parse(localStorage.getItem("bloc.journal")));
    ok("B1 journal toujours fonctionnel après la fin", j2.length === 1);
    await page2.context().close();
  }

  await browser.close();
  console.log(fails ? `${fails} ÉCHEC(S)` : "TOUT PASSE");
  process.exit(fails ? 1 : 0);
})();
