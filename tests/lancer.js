/* Lance toutes les suites contre un serveur local éphémère.
   Usage : node lancer.js   (depuis tests/, après npm install)
   Env : CHROMIUM_PATH pour pointer un Chromium déjà installé. */
const { spawn } = require("child_process");
const { demarrer } = require("./serveur");

const SUITES = ["suite-regression.js", "suite-fonctionnalites.js",
  "suite-personas.js", "suite-robustesse.js", "suite-dates.js"];
const PORT = 8123;

/* spawn asynchrone : le serveur du parent doit rester réactif pendant la suite */
const lancerProcessus = (args, env) => new Promise(resoudre => {
  spawn("node", args, { cwd: __dirname, stdio: "inherit", env })
    .on("close", code => resoudre(code));
});

(async () => {
  const srv = await demarrer(PORT);
  let echecs = 0;

  // Cohérence du service worker avec l'arborescence
  if (await lancerProcessus(["../generate-sw.mjs", "--check"], process.env) !== 0) echecs++;

  for (const suite of SUITES) {
    console.log(`\n=== ${suite} ===`);
    const code = await lancerProcessus([suite],
      { ...process.env, BLOC_URL: `http://localhost:${PORT}` });
    if (code !== 0) echecs++;
  }
  srv.close();
  console.log(echecs ? `\n${echecs} suite(s) en échec` : "\nToutes les suites passent");
  process.exit(echecs ? 1 : 0);
})();
