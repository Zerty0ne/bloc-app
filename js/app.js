/* ============================================================
   Bloc — app d'entraînement personnelle (V1)
   Tout le contenu du programme vit dans des JSON (voir README).
   Ce fichier ne contient que le moteur : état, rendu, séance.
   ============================================================ */
"use strict";

/* ---------- État global (chargé au démarrage) ---------- */
const state = {
  config: null,       // config.json
  bloc: null,         // bloc actif (blocs/bloc-1.json)
  seances: {},        // seance_id -> objet séance (renfo + libres)
  exercices: {},      // exercice_id -> fiche
  libres: [],         // liste des séances libres
};

/* ---------- localStorage : clés versionnées ---------- */
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem("bloc." + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem("bloc." + key, JSON.stringify(value)); },
};

function getBlocActif()   { return LS.get("bloc_actif", null); }
function getValidations() { return LS.get("validations", {}); }
function getBonus()       { return LS.get("bonus", []); }
function getCharges()     { return LS.get("charges", {}); }
function getBacklog()     { return LS.get("backlog_idees", []); }

/* ---------- Dates (semaine = lundi → dimanche) ---------- */
function isoDate(d) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function lundiDe(d) {
  const r = new Date(d); const dow = (r.getDay() + 6) % 7; // lundi=0
  r.setDate(r.getDate() - dow); r.setHours(0, 0, 0, 0); return r;
}
function addJours(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function joursEntre(a, b) { return Math.floor((b - a) / 86400000); }

/* ---------- Chargement des données ---------- */
async function chargerJSON(url) {
  if (window.BLOC_DATA && window.BLOC_DATA[url]) return window.BLOC_DATA[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error("Chargement impossible : " + url);
  return r.json();
}

async function init() {
  state.config = await chargerJSON("config.json");
  state.bloc = await chargerJSON(state.config.bloc_actif_fichier);

  // Bloc actif : posé au premier lancement
  let actif = getBlocActif();
  if (!actif || actif.id !== state.bloc.id) {
    actif = { id: state.bloc.id, date_debut: isoDate(new Date()) };
    LS.set("bloc_actif", actif);
  }

  // Séances de la semaine type (renfo) + libres
  const ids = new Set();
  state.bloc.semaine_type.forEach(j => { if (j.seance_id) ids.add(j.seance_id); });
  for (const id of ids) state.seances[id] = await chargerJSON(`seances/${id}.json`);
  for (const path of state.config.seances_libres) {
    const s = await chargerJSON(path);
    state.seances[s.id] = s;
    state.libres.push(s);
  }

  // Fiches exercices référencées (chargées à la volée, tolère l'absence)
  const exoIds = new Set();
  Object.values(state.seances).forEach(s => s.phases.forEach(p => {
    (p.exercices || []).forEach(e => exoIds.add(e.exercice_id));
    (p.variantes || []).forEach(v => v.exercices.forEach(e => exoIds.add(e.exercice_id)));
  }));
  await Promise.all([...exoIds].map(async id => {
    try { state.exercices[id] = await chargerJSON(`exercices/${id}.json`); }
    catch { state.exercices[id] = { id, nom: id, images: [], rappel_technique: "", pourquoi: "" }; }
  }));

  brancherNavigation();
  brancherReglages();
  brancherIdees();
  rendreAccueil();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const vues = ["accueil", "seance", "charges", "bilan", "idees", "reglages"];
function afficherVue(nom) {
  vues.forEach(v => document.getElementById("view-" + v).classList.toggle("hidden", v !== nom));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === nom));
  document.getElementById("tabbar").classList.toggle("masquee", nom === "seance");
  if (nom === "accueil") rendreAccueil();
  if (nom === "charges") rendreCharges();
  if (nom === "bilan") rendreBilan();
  if (nom === "idees") rendreIdees();
  if (nom === "reglages") rendreReglages();
  window.scrollTo(0, 0);
}
function brancherNavigation() {
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => afficherVue(t.dataset.view)));
}

/* ============================================================
   ACCUEIL — la semaine
   ============================================================ */
function statutDuJour(dateIso) { return (getValidations()[dateIso] || null); }

function numeroSemaine() {
  const debut = new Date(getBlocActif().date_debut + "T00:00:00");
  const n = Math.floor(joursEntre(lundiDe(debut), lundiDe(new Date())) / 7) + 1;
  return Math.min(Math.max(n, 1), state.bloc.duree_semaines);
}
function joursAvantBlocSuivant() {
  const debut = new Date(getBlocActif().date_debut + "T00:00:00");
  return Math.max(state.bloc.duree_semaines * 7 - joursEntre(debut, new Date()), 0);
}

function rendreAccueil() {
  document.getElementById("bloc-nom").textContent = state.bloc.nom;
  const compteur = document.getElementById("bloc-compteur");
  const restant = joursAvantBlocSuivant();
  compteur.innerHTML =
    `Semaine <strong>${numeroSemaine()}/${state.bloc.duree_semaines}</strong><br>` +
    (restant > 0 ? `Bloc 2 dans <strong>${restant} j</strong>` : `Bloc terminé — bilan !`);

  const lundi = lundiDe(new Date());
  const aujourdhui = isoDate(new Date());
  const rail = document.getElementById("semaine-rail");
  rail.innerHTML = "";

  const actifs = state.bloc.semaine_type.filter(j => j.type !== "repos");
  let faits = 0;
  const segments = [];

  state.bloc.semaine_type.forEach((j, idx) => {
    const dateIso = isoDate(addJours(lundi, idx));
    const val = statutDuJour(dateIso);
    const estRepos = j.type === "repos";

    const carte = document.createElement("div");
    carte.className = "jour-carte" + (dateIso === aujourdhui ? " aujourdhui" : "") + (estRepos ? " repos" : "");
    carte.innerHTML = `
      <div class="jour-lettre">${j.jour.slice(0, 3)}</div>
      <div class="jour-info">
        <div class="jour-label">${j.label || "Repos"}</div>
        ${j.detail ? `<div class="jour-detail">${j.detail}</div>` : ""}
      </div>`;

    if (!estRepos) {
      const actions = document.createElement("div");
      actions.className = "jour-actions";

      // Coche de validation (tap = fait / re-tap = annule)
      const coche = document.createElement("button");
      coche.className = "coche" + (val ? " " + val.statut : "");
      coche.textContent = val ? (val.statut === "swap" ? "⇄" : "✓") : "✓";
      coche.setAttribute("aria-label", val ? "Annuler la validation" : "Valider la séance");
      coche.addEventListener("click", () => {
        const v = getValidations();
        if (v[dateIso]) delete v[dateIso];
        else v[dateIso] = { type: j.type, statut: "fait" };
        LS.set("validations", v); rendreAccueil();
      });
      actions.appendChild(coche);

      // Swap course → vélo doux (règle du lendemain)
      if (j.type === "course" && (!val || val.statut !== "swap")) {
        const swap = document.createElement("button");
        swap.className = "btn btn-petit";
        swap.textContent = "→ vélo doux";
        swap.addEventListener("click", () => {
          const v = getValidations();
          v[dateIso] = { type: "velo", statut: "swap" };
          LS.set("validations", v); rendreAccueil();
        });
        actions.appendChild(swap);
      }

      // Lancement de la séance renfo
      if (j.seance_id) {
        const go = document.createElement("button");
        go.className = "btn btn-petit btn-accent";
        go.textContent = "Lancer";
        go.addEventListener("click", () =>
          lancerSeance(state.seances[j.seance_id], { source: "programme", date: dateIso }));
        actions.appendChild(go);
      }
      carte.appendChild(actions);

      if (val) faits++;
      segments.push(val ? val.statut : "");
    }
    rail.appendChild(carte);
  });

  // Jauge segmentée
  const jauge = document.getElementById("jauge");
  jauge.innerHTML = segments.map(s => `<span class="${s}"></span>`).join("");
  document.getElementById("jauge-label").textContent =
    `${faits}/${actifs.length} séances cette semaine`;

  // Séances libres + marqueur bonus du jour
  const bonusAujourdhui = getBonus().filter(b => b.date === aujourdhui).map(b => b.seance_id);
  const liste = document.getElementById("libres-liste");
  liste.innerHTML = "";
  state.libres.forEach(s => {
    const c = document.createElement("div");
    c.className = "libre-carte";
    c.innerHTML = `
      <div class="jour-info">
        <div class="jour-label">${s.nom}</div>
        <div class="jour-detail">${s.description || ""}</div>
      </div>
      ${bonusAujourdhui.includes(s.id) ? `<span class="badge-bonus">Bonus ✓</span>` : ""}`;
    c.addEventListener("click", () => lancerSeance(s, { source: "libre" }));
    liste.appendChild(c);
  });

  // Règles du bloc
  document.getElementById("regles").innerHTML =
    `<ul>${state.bloc.regles.map(r => `<li>${r}</li>`).join("")}</ul>`;
}

/* ============================================================
   MOTEUR DE SÉANCE
   Types de phase : timer | tours | sequence | choix
   ============================================================ */
let seanceCtx = null;   // contexte de la séance en cours
let wakeLock = null;
let timerInterval = null;

async function verrouillerEcran() {
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); }
  catch { /* fallback silencieux */ }
}
function libererEcran() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

function lancerSeance(seance, contexte) {
  seanceCtx = {
    seance, ...contexte,
    minimale: false,
    phaseIdx: -1,       // -1 = écran de lancement
    tour: 1, exoIdx: 0,
    varianteChoisie: null,
    chargesSaisies: {},  // exercice_id -> kg (saisis pendant la séance)
  };
  afficherVue("seance");
  rendreLancement();
}

function rendreLancement() {
  const s = seanceCtx.seance;
  const aMinimale = s.phases.some(p => p.type === "tours" && p.nb_tours_minimal);
  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head">
      <span class="seance-phase-nom">Séance</span>
      <button class="seance-quit" id="quit">Fermer ✕</button>
    </div>
    <div class="seance-corps lancement">
      <h2>${s.nom}</h2>
      <p>${s.description || ""}</p>
      ${s.note_compatibilite ? `<p class="exo-pourquoi">${s.note_compatibilite}</p>` : ""}
    </div>
    <div class="seance-pied">
      ${aMinimale ? `<button class="btn btn-large" id="go-min">Séance minimale</button>` : ""}
      <button class="btn btn-large btn-accent" id="go">Lancer la séance</button>
    </div>`;
  document.getElementById("quit").addEventListener("click", quitterSeance);
  document.getElementById("go").addEventListener("click", () => demarrer(false));
  if (aMinimale) document.getElementById("go-min").addEventListener("click", () => demarrer(true));
}

function demarrer(minimale) {
  seanceCtx.minimale = minimale;
  verrouillerEcran();
  phaseSuivante();
}

function quitterSeance() {
  stopTimer(); libererEcran(); seanceCtx = null;
  afficherVue("accueil");
}

function phaseSuivante() {
  stopTimer();
  seanceCtx.phaseIdx++;
  seanceCtx.tour = 1; seanceCtx.exoIdx = 0; seanceCtx.varianteChoisie = null;
  const phases = seanceCtx.seance.phases;
  if (seanceCtx.phaseIdx >= phases.length) { rendreFin(); return; }
  rendrePhase();
}

function rendrePhase() {
  const phase = seanceCtx.seance.phases[seanceCtx.phaseIdx];
  if (phase.type === "timer") rendreTimer(phase);
  else if (phase.type === "choix" && !seanceCtx.varianteChoisie) rendreChoix(phase);
  else rendreExercice(phase);
}

/* ----- Phase timer (mobilité, fermeture, étirements) ----- */
function rendreTimer(phase) {
  let restant = phase.duree_min * 60;
  let pause = false;
  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head">
      <span class="seance-phase-nom">${phase.nom}</span>
      <button class="seance-quit" id="quit">✕</button>
    </div>
    <div class="seance-corps">
      <div class="timer-affichage" id="timer">${fmtTemps(restant)}</div>
      <ul class="timer-liste">${(phase.contenu || []).map(c => `<li>${c}</li>`).join("")}</ul>
    </div>
    <div class="seance-pied">
      <div class="row">
        <button class="btn" id="pause">Pause</button>
        <button class="btn btn-accent" id="suivant">Phase suivante</button>
      </div>
    </div>`;
  document.getElementById("quit").addEventListener("click", quitterSeance);
  document.getElementById("suivant").addEventListener("click", phaseSuivante);
  document.getElementById("pause").addEventListener("click", e => {
    pause = !pause; e.target.textContent = pause ? "Reprendre" : "Pause";
  });
  timerInterval = setInterval(() => {
    if (pause) return;
    restant = Math.max(restant - 1, 0);
    const el = document.getElementById("timer");
    if (el) el.textContent = fmtTemps(restant);
    if (restant === 0) stopTimer();  // fin silencieuse, l'utilisateur enchaîne
  }, 1000);
}
function fmtTemps(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* ----- Phase choix (variantes de finisher) ----- */
function rendreChoix(phase) {
  const blocNum = parseInt((getBlocActif().id.match(/\d+/) || [1])[0], 10);
  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head">
      <span class="seance-phase-nom">${phase.nom}</span>
      <button class="seance-quit" id="quit">✕</button>
    </div>
    <div class="seance-corps lancement" id="variantes"></div>
    <div class="seance-pied">
      <button class="btn btn-large" id="skip">Passer cette phase</button>
    </div>`;
  document.getElementById("quit").addEventListener("click", quitterSeance);
  document.getElementById("skip").addEventListener("click", phaseSuivante);
  const cont = document.getElementById("variantes");
  phase.variantes.forEach(v => {
    const verrouille = (v.bloc_min || 1) > blocNum;
    const b = document.createElement("button");
    b.className = "btn variante";
    b.disabled = verrouille;
    b.innerHTML = `${v.label}${verrouille
      ? `<small>${seanceCtx.seance.note_compatibilite || "Débloqué au bloc " + v.bloc_min}</small>` : ""}`;
    if (!verrouille) b.addEventListener("click", () => {
      seanceCtx.varianteChoisie = v; seanceCtx.exoIdx = 0; rendrePhase();
    });
    cont.appendChild(b);
  });
}

/* ----- Phases exercices (tours / sequence / variante choisie) ----- */
function exercicesCourants(phase) {
  if (phase.type === "choix") return seanceCtx.varianteChoisie.exercices;
  return phase.exercices;
}
function nbToursCourant(phase) {
  if (phase.type !== "tours") return 1;
  return seanceCtx.minimale && phase.nb_tours_minimal ? phase.nb_tours_minimal : phase.nb_tours;
}

function rendreExercice(phase) {
  const exos = exercicesCourants(phase);
  const exo = exos[seanceCtx.exoIdx];
  const fiche = state.exercices[exo.exercice_id] || {};
  const nbTours = nbToursCourant(phase);
  const charges = getCharges();
  const dernierePoids = exo.charge_trackee
    ? (seanceCtx.chargesSaisies[exo.exercice_id]
       ?? (charges[exo.exercice_id]?.slice(-1)[0]?.kg ?? ""))
    : null;

  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head">
      <span class="seance-phase-nom">${phase.nom}</span>
      ${nbTours > 1 ? `<span class="seance-tour">Tour ${seanceCtx.tour}/${nbTours}</span>` : ""}
      <button class="seance-quit" id="quit">✕</button>
    </div>
    <div class="seance-corps">
      <div class="exo-nom">${fiche.nom || exo.exercice_id}</div>
      <div class="exo-reps">${exo.reps || ""}</div>
      ${fiche.images && fiche.images.length
        ? `<div class="exo-images">${fiche.images.map(i => `<img src="${i}" alt="">`).join("")}</div>` : ""}
      ${fiche.rappel_technique ? `<div class="exo-rappel">${fiche.rappel_technique}</div>` : ""}
      ${fiche.pourquoi ? `<div class="exo-pourquoi">${fiche.pourquoi}</div>` : ""}
      ${exo.charge_trackee ? `
        <div class="charge-saisie">
          <label for="kg">Charge</label>
          <input type="number" id="kg" inputmode="decimal" step="0.5" min="0" value="${dernierePoids}">
          <label>kg</label>
        </div>` : ""}
    </div>
    <div class="seance-pied">
      <button class="btn btn-large btn-accent" id="suivant">Suivant</button>
    </div>`;
  document.getElementById("quit").addEventListener("click", quitterSeance);
  document.getElementById("suivant").addEventListener("click", () => {
    // Sauvegarde de la charge saisie (une valeur par exercice et par séance)
    if (exo.charge_trackee) {
      const kg = parseFloat(document.getElementById("kg").value);
      if (!isNaN(kg) && kg > 0) seanceCtx.chargesSaisies[exo.exercice_id] = kg;
    }
    // Avancement : exercice suivant → tour suivant → phase suivante
    seanceCtx.exoIdx++;
    if (seanceCtx.exoIdx >= exos.length) {
      seanceCtx.exoIdx = 0;
      seanceCtx.tour++;
      if (seanceCtx.tour > nbTours) { phaseSuivante(); return; }
    }
    rendrePhase();
  });
}

/* ----- Fin de séance ----- */
function rendreFin() {
  stopTimer(); libererEcran();
  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head"><span class="seance-phase-nom">Terminé</span></div>
    <div class="seance-corps lancement">
      <h2>Séance faite${seanceCtx.minimale ? " (minimale — ça compte pareil)" : ""}.</h2>
      <p>Ressenti du jour, si tu veux — une ligne suffit :</p>
      <textarea id="ressenti" maxlength="200" placeholder="Optionnel"></textarea>
    </div>
    <div class="seance-pied">
      <button class="btn btn-large btn-accent" id="valider">Valider et fermer</button>
    </div>`;
  document.getElementById("valider").addEventListener("click", () => {
    const ressenti = document.getElementById("ressenti").value.trim();
    const dateIso = isoDate(new Date());

    // Enregistrement des charges saisies pendant la séance
    const charges = getCharges();
    Object.entries(seanceCtx.chargesSaisies).forEach(([id, kg]) => {
      if (!charges[id]) charges[id] = [];
      charges[id].push({ date: dateIso, kg, ressenti: "" });
    });
    LS.set("charges", charges);

    // Validation programme ou bonus libre
    if (seanceCtx.source === "programme") {
      const v = getValidations();
      v[seanceCtx.date] = {
        type: "renfo",
        statut: seanceCtx.minimale ? "minimale" : "fait",
        ...(ressenti ? { ressenti } : {}),
      };
      LS.set("validations", v);
    } else {
      const b = getBonus();
      b.push({ date: dateIso, seance_id: seanceCtx.seance.id, ...(ressenti ? { ressenti } : {}) });
      LS.set("bonus", b);
    }
    quitterSeance();
  });
}

/* ============================================================
   CHARGES — progression graphée
   ============================================================ */
let exoChargeActif = null;

function rendreCharges() {
  const charges = getCharges();
  const ids = Object.keys(charges);
  const chips = document.getElementById("charges-chips");
  const canvas = document.getElementById("charges-chart");
  const detail = document.getElementById("charges-detail");

  if (!ids.length) {
    chips.innerHTML = "";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    detail.textContent = "Les charges saisies en séance renfo apparaîtront ici — la progression se verra.";
    return;
  }
  if (!exoChargeActif || !ids.includes(exoChargeActif)) exoChargeActif = ids[0];

  chips.innerHTML = "";
  ids.forEach(id => {
    const b = document.createElement("button");
    b.className = "chip" + (id === exoChargeActif ? " active" : "");
    b.textContent = (state.exercices[id]?.nom || id);
    b.addEventListener("click", () => { exoChargeActif = id; rendreCharges(); });
    chips.appendChild(b);
  });

  const points = charges[exoChargeActif];
  dessinerCourbe(canvas, points);
  const dernier = points[points.length - 1];
  const premier = points[0];
  detail.textContent = `${points.length} séance${points.length > 1 ? "s" : ""} · ` +
    `de ${premier.kg} kg à ${dernier.kg} kg` +
    (dernier.kg > premier.kg ? ` (+${(dernier.kg - premier.kg).toFixed(1)} kg)` : "");
}

/* Courbe canvas maison — pas de librairie, ligne + points */
function dessinerCourbe(canvas, points) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, pad = 44;
  ctx.clearRect(0, 0, W, H);

  const kgs = points.map(p => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const lo = Math.floor(min - 1), hi = Math.ceil(max + 1);
  const x = i => points.length === 1 ? W / 2 : pad + i * (W - 2 * pad) / (points.length - 1);
  const y = kg => H - pad - (kg - lo) * (H - 2 * pad) / (hi - lo || 1);

  // Grille horizontale + valeurs
  ctx.strokeStyle = "#31353d"; ctx.fillStyle = "#8b8f97";
  ctx.font = "13px system-ui"; ctx.textAlign = "left";
  for (let kg = lo; kg <= hi; kg++) {
    ctx.beginPath(); ctx.moveTo(pad, y(kg)); ctx.lineTo(W - pad, y(kg)); ctx.stroke();
    ctx.fillText(kg + "", 8, y(kg) + 4);
  }
  // Ligne
  ctx.strokeStyle = "#e2a63d"; ctx.lineWidth = 3; ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(x(i), y(p.kg)) : ctx.moveTo(x(i), y(p.kg)));
  ctx.stroke();
  // Points + dates
  ctx.fillStyle = "#e2a63d"; ctx.textAlign = "center";
  points.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(p.kg), 5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#8b8f97";
  const step = Math.ceil(points.length / 5);   // max ~5 étiquettes de date
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1)
      ctx.fillText(p.date.slice(5).replace("-", "/"), x(i), H - 14);
  });
}

/* ============================================================
   BILAN HEBDO — zéro saisie
   ============================================================ */
function statsSemaine(lundi) {
  const v = getValidations();
  const actifs = state.bloc.semaine_type.filter(j => j.type !== "repos").length;
  let faits = 0, swaps = 0, minimales = 0;
  const parType = {};
  state.bloc.semaine_type.forEach((j, idx) => {
    if (j.type === "repos") return;
    const val = v[isoDate(addJours(lundi, idx))];
    if (val) {
      faits++;
      if (val.statut === "swap") swaps++;
      if (val.statut === "minimale") minimales++;
      parType[val.type] = (parType[val.type] || 0) + 1;
    }
  });
  return { faits, actifs, swaps, minimales, parType, pct: Math.round(faits / actifs * 100) };
}

function rendreBilan() {
  const lundi = lundiDe(new Date());
  const cette = statsSemaine(lundi);
  const cont = document.getElementById("bilan-contenu");

  // Tendance 4 semaines (barres)
  const tendance = [];
  for (let i = 3; i >= 0; i--) tendance.push(statsSemaine(addJours(lundi, -7 * i)));

  // Bonus de la semaine
  const finSemaine = isoDate(addJours(lundi, 6));
  const debutSemaine = isoDate(lundi);
  const bonusSemaine = getBonus().filter(b => b.date >= debutSemaine && b.date <= finSemaine);

  // Charges : dernière valeur vs précédente, par exercice
  const charges = getCharges();
  const lignesCharges = Object.entries(charges).map(([id, pts]) => {
    const d = pts[pts.length - 1], av = pts.length > 1 ? pts[pts.length - 2] : null;
    const delta = av ? d.kg - av.kg : 0;
    return `<div class="bilan-ligne"><span>${state.exercices[id]?.nom || id}</span>
      <span class="val">${d.kg} kg${delta ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(1)})` : ""}</span></div>`;
  }).join("");

  const typesLabels = { velo: "Vélo", course: "Course", renfo: "Renfo" };
  cont.innerHTML = `
    <div class="bilan-carte">
      <h3>Adhérence cette semaine</h3>
      <div class="bilan-grand">${cette.faits}/${cette.actifs} <small>(${cette.pct} %)</small></div>
      ${cette.swaps ? `<p class="hint">${cette.swaps} swap${cette.swaps > 1 ? "s" : ""} course→vélo — la règle appliquée, pas un échec.</p>` : ""}
      ${cette.minimales ? `<p class="hint">${cette.minimales} séance${cette.minimales > 1 ? "s" : ""} minimale${cette.minimales > 1 ? "s" : ""} — validée${cette.minimales > 1 ? "s" : ""} comme complète${cette.minimales > 1 ? "s" : ""}.</p>` : ""}
    </div>
    <div class="bilan-carte">
      <h3>Par type</h3>
      ${Object.entries(cette.parType).map(([t, n]) =>
        `<div class="bilan-ligne"><span>${typesLabels[t] || t}</span><span class="val">${n}</span></div>`).join("")
        || `<p class="hint">Rien de coché encore cette semaine.</p>`}
      ${bonusSemaine.length ? `<div class="bilan-ligne"><span>Bonus (hors jauge)</span>
        <span class="val">${bonusSemaine.length}</span></div>` : ""}
    </div>
    <div class="bilan-carte">
      <h3>Tendance 4 semaines</h3>
      <div class="tendance">
        ${tendance.map((s, i) => `<div style="height:${Math.max(s.pct, 4)}%"
          class="${i === 3 ? "actuelle" : ""}"><span>S${numeroSemaine() - (3 - i)}</span></div>`).join("")}
      </div>
      <p class="hint" style="margin-top:26px">Hauteur = % d'adhérence de la semaine.</p>
    </div>
    ${lignesCharges ? `<div class="bilan-carte"><h3>Charges — dernière vs précédente</h3>${lignesCharges}</div>` : ""}`;
}

/* ============================================================
   IDÉES — backlog
   ============================================================ */
function brancherIdees() {
  document.getElementById("idee-add").addEventListener("click", () => {
    const input = document.getElementById("idee-input");
    const texte = input.value.trim();
    if (!texte) return;
    const b = getBacklog();
    b.unshift({ date: isoDate(new Date()), texte });
    LS.set("backlog_idees", b);
    input.value = "";
    rendreIdees();
  });
}
function rendreIdees() {
  const liste = document.getElementById("idees-liste");
  const b = getBacklog();
  liste.innerHTML = b.length ? "" : `<p class="hint">Aucune idée pour l'instant — c'est bon signe, tu t'entraînes.</p>`;
  b.forEach((idee, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${idee.texte}</span><span class="date">${idee.date.slice(5)}</span>`;
    const suppr = document.createElement("button");
    suppr.className = "suppr"; suppr.textContent = "✕";
    suppr.setAttribute("aria-label", "Supprimer");
    suppr.addEventListener("click", () => {
      const nb = getBacklog(); nb.splice(i, 1); LS.set("backlog_idees", nb); rendreIdees();
    });
    li.appendChild(suppr);
    liste.appendChild(li);
  });
}

/* ============================================================
   RÉGLAGES — export/import, date de début
   ============================================================ */
function brancherReglages() {
  document.getElementById("date-debut").addEventListener("change", e => {
    const actif = getBlocActif();
    actif.date_debut = e.target.value;
    LS.set("bloc_actif", actif);
    rendreAccueil();
  });
  document.getElementById("btn-export").addEventListener("click", () => {
    const data = {
      version: 1,
      bloc_actif: getBlocActif(),
      validations: getValidations(),
      bonus: getBonus(),
      charges: getCharges(),
      backlog_idees: getBacklog(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bloc-export-${isoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById("btn-import").addEventListener("click", () =>
    document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        ["bloc_actif", "validations", "bonus", "charges", "backlog_idees"].forEach(k => {
          if (data[k] !== undefined) LS.set(k, data[k]);
        });
        alert("Import réussi.");
        rendreAccueil();
      } catch { alert("Fichier illisible — export Bloc attendu."); }
    };
    reader.readAsText(file);
  });
}
function rendreReglages() {
  document.getElementById("date-debut").value = getBlocActif().date_debut;
}

/* ---------- Démarrage ---------- */
init().catch(err => {
  document.body.innerHTML = `<main class="view"><h1>Erreur de chargement</h1>
    <p class="hint">${err.message}. L'app doit être servie par un serveur web (pas en file://) — voir README.</p></main>`;
});
