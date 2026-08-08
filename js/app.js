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
function getJournal()     { return LS.get("journal", []); }
function setJournal(j)    { LS.set("journal", j); }
function getCharges()     { return LS.get("charges", {}); }
function getBacklog()     { return LS.get("backlog_idees", []); }

/* ---------- Migration V1 → V2 : validations/bonus → journal ---------- */
function typePourSeanceLibre(seanceId) {
  if (/renfo/.test(seanceId)) return "renfo";
  if (seanceId === "combat-flow") return "boxe";
  return "autre";
}

function migrerV2() {
  if (LS.get("schema_version", 1) >= 2) return;
  const journal = getJournal();
  Object.entries(LS.get("validations", {})).forEach(([date, v]) => {
    let type = v.type, note = "";
    if (v.statut === "swap") { type = "velo"; note = "swap course→vélo"; }
    else if (v.statut === "minimale") note = "séance minimale";
    if (v.ressenti) note = note ? `${note} — ${v.ressenti}` : v.ressenti;
    journal.push({ date, type, note });
  });
  LS.get("bonus", []).forEach(b => {
    const nom = state.seances[b.seance_id]?.nom || b.seance_id;
    journal.push({
      date: b.date,
      type: typePourSeanceLibre(b.seance_id),
      note: b.ressenti ? `${nom} — ${b.ressenti}` : nom,
    });
  });
  journal.sort((a, b) => a.date < b.date ? -1 : 1);
  setJournal(journal);
  localStorage.removeItem("bloc.validations");
  localStorage.removeItem("bloc.bonus");
  LS.set("schema_version", 2);
}

/* ---------- Journal : helpers ---------- */
function typesActivite() { return state.bloc.types_activite || []; }
function quotasHebdo()   { return state.bloc.quotas_hebdo || {}; }
function labelType(id)   { return (typesActivite().find(t => t.id === id) || {}).label || id; }

/* Entrées de la semaine [lundi, lundi+6], avec leur index dans le journal */
function entreesSemaine(lundi) {
  const debut = isoDate(lundi), fin = isoDate(addJours(lundi, 6));
  return getJournal().map((e, idx) => ({ ...e, idx }))
    .filter(e => e.date >= debut && e.date <= fin);
}
function comptesParType(entrees) {
  const c = {};
  entrees.forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
  return c;
}

function ajouterEntree(date, type, note = "") {
  signalerRegle24h(date, type);
  const j = getJournal();
  j.push({ date, type, note });
  setJournal(j);
}
function supprimerEntree(idx) {
  const j = getJournal();
  j.splice(idx, 1);
  setJournal(j);
}

/* Règle des 24h — signal, jamais un blocage */
function signalerRegle24h(date, type) {
  const autre = type === "course" ? "renfo" : type === "renfo" ? "course" : null;
  if (!autre) return;
  const d = new Date(date + "T00:00:00");
  const proches = [isoDate(addJours(d, -1)), date, isoDate(addJours(d, 1))];
  if (getJournal().some(e => e.type === autre && proches.includes(e.date)))
    toast("Rappel : ta règle — course et renfo jambes à 24h d'écart.");
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 6000);
}

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

  // Séances de la semaine type + types d'activité (renfo) + libres
  const ids = new Set();
  state.bloc.semaine_type.forEach(j => { if (j.seance_id) ids.add(j.seance_id); });
  (state.bloc.types_activite || []).forEach(t => { if (t.seance_id) ids.add(t.seance_id); });
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

  migrerV2();

  // Raccourci OS (appui long sur l'icône) : ?fait=velo|course → journalise et confirme
  const fait = new URLSearchParams(location.search).get("fait");
  if (fait) {
    history.replaceState(null, "", location.pathname);   // pas de re-saisie au rechargement
    if (typesActivite().some(t => t.id === fait)) {
      toast(`${labelType(fait)} — noté.`);
      ajouterEntree(isoDate(new Date()), fait);           // le rappel 24h, s'il joue, remplace le toast
    }
  }

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
   ACCUEIL — saisie « J'ai fait… », quotas, plan indicatif
   ============================================================ */
let saisieDate = null;        // date ISO ciblée par la saisie (défaut : aujourd'hui)
let choixSeanceType = null;   // type dont le choix guidée/noter est déplié

function numeroSemaine() {
  const debut = new Date(getBlocActif().date_debut + "T00:00:00");
  const n = Math.floor(joursEntre(lundiDe(debut), lundiDe(new Date())) / 7) + 1;
  return Math.min(Math.max(n, 1), state.bloc.duree_semaines);
}
function joursAvantBlocSuivant() {
  const debut = new Date(getBlocActif().date_debut + "T00:00:00");
  return Math.max(state.bloc.duree_semaines * 7 - joursEntre(debut, new Date()), 0);
}

function fmtDateCourte(iso) {
  const d = new Date(iso + "T00:00:00");
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  return `${jours[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function rendreAccueil() {
  document.getElementById("bloc-nom").textContent = state.bloc.nom;
  const compteur = document.getElementById("bloc-compteur");
  const restant = joursAvantBlocSuivant();
  compteur.innerHTML =
    `Semaine <strong>${numeroSemaine()}/${state.bloc.duree_semaines}</strong><br>` +
    (restant > 0 ? `Bloc 2 dans <strong>${restant} j</strong>` : `Bloc terminé — bilan !`);

  if (!saisieDate) saisieDate = isoDate(new Date());
  rendreLigneJour();
  rendreSaisie();
  rendreQuotas();
  rendreRail();

  // Séances libres — la fin de séance crée l'entrée de journal
  const liste = document.getElementById("libres-liste");
  liste.innerHTML = "";
  state.libres.forEach(s => {
    const c = document.createElement("div");
    c.className = "libre-carte";
    c.innerHTML = `
      <div class="jour-info">
        <div class="jour-label">${s.nom}</div>
        <div class="jour-detail">${s.description || ""}</div>
      </div>`;
    c.addEventListener("click", () =>
      lancerSeance(s, { type: typePourSeanceLibre(s.id), estLibre: true, date: isoDate(new Date()) }));
    liste.appendChild(c);
  });

  // Règles du bloc + échéance : ce que le bloc suivant déverrouille (lu dans les JSON)
  const blocNum = parseInt((getBlocActif().id.match(/\d+/) || [1])[0], 10);
  const deverrouillages = [];
  Object.values(state.seances).forEach(s => s.phases.forEach(p =>
    (p.variantes || []).forEach(v => {
      if ((v.bloc_min || 1) > blocNum) deverrouillages.push(v.label);
    })));
  document.getElementById("regles").innerHTML =
    `<ul>${state.bloc.regles.map(r => `<li>${r}</li>`).join("")}</ul>` +
    (restant > 0 && deverrouillages.length
      ? `<p class="prochain-bloc">Bloc ${blocNum + 1} dans ${restant} j — débloque : ${deverrouillages.join(" · ")}.</p>`
      : "");
}

/* ----- Ligne du jour : quoi aujourd'hui, que reste-t-il ----- */
function resteTexte(counts) {
  const restes = Object.entries(quotasHebdo())
    .map(([t, q]) => [t, Math.max(q - (counts[t] || 0), 0)])
    .filter(([, r]) => r > 0);
  return restes.length
    ? "reste " + restes.map(([t, r]) => `${r} ${labelType(t).toLowerCase()}`).join(" · ")
    : "semaine couverte";
}

function rendreLigneJour() {
  const aujourdhui = isoDate(new Date());
  const plan = state.bloc.semaine_type[(new Date().getDay() + 6) % 7];
  const counts = comptesParType(entreesSemaine(lundiDe(new Date())));
  const quotas = quotasHebdo();
  const couvert = plan.type !== "repos" && (
    (plan.type in quotas && (counts[plan.type] || 0) >= quotas[plan.type]) ||
    getJournal().some(e => e.date === aujourdhui && e.type === plan.type));
  document.getElementById("ligne-jour").innerHTML =
    `Aujourd'hui : <strong>${plan.label || "Repos"}</strong>${couvert ? " ✓" : ""} — ${resteTexte(counts)}.`;
}

/* ----- Saisie « J'ai fait… » ----- */
function rendreSaisie() {
  const auj = isoDate(new Date());
  const hier = isoDate(addJours(new Date(), -1));

  // Sélecteur de date : Aujourd'hui / Hier (+ date du rail si autre)
  const dates = document.getElementById("saisie-dates");
  dates.innerHTML = "";
  const choix = [["Aujourd'hui", auj], ["Hier", hier]];
  if (saisieDate !== auj && saisieDate !== hier) choix.push([fmtDateCourte(saisieDate), saisieDate]);
  choix.forEach(([label, d]) => {
    const b = document.createElement("button");
    b.className = "chip" + (saisieDate === d ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => { saisieDate = d; choixSeanceType = null; rendreAccueil(); });
    dates.appendChild(b);
  });

  // Boutons-types
  const types = document.getElementById("saisie-types");
  types.innerHTML = "";
  typesActivite().forEach(t => {
    const b = document.createElement("button");
    b.className = "btn type-btn";
    b.textContent = t.label;
    b.addEventListener("click", () => {
      if (t.seance_id) { choixSeanceType = choixSeanceType === t.id ? null : t.id; rendreAccueil(); }
      else { ajouterEntree(saisieDate, t.id); rendreAccueil(); }
    });
    types.appendChild(b);
  });

  // Choix guidée / juste noter (types avec séance, ex. renfo)
  const zone = document.getElementById("saisie-renfo-choix");
  zone.classList.toggle("hidden", !choixSeanceType);
  zone.innerHTML = "";
  if (choixSeanceType) {
    const t = typesActivite().find(x => x.id === choixSeanceType);
    const guide = document.createElement("button");
    guide.className = "btn btn-accent";
    guide.textContent = "Séance guidée";
    guide.addEventListener("click", () => {
      const d = saisieDate;
      choixSeanceType = null;
      lancerSeance(state.seances[t.seance_id], { type: t.id, date: d });
    });
    const noter = document.createElement("button");
    noter.className = "btn";
    noter.textContent = "Juste noter";
    noter.addEventListener("click", () => {
      choixSeanceType = null;
      ajouterEntree(saisieDate, t.id);
      rendreAccueil();
    });
    zone.appendChild(guide);
    zone.appendChild(noter);
  }

  // Entrées du jour sélectionné — suppression en un tap, note éditable
  const liste = document.getElementById("saisie-entrees");
  liste.innerHTML = "";
  const jour = getJournal().map((e, idx) => ({ ...e, idx })).filter(e => e.date === saisieDate);
  jour.forEach(e => {
    const li = document.createElement("li");
    const info = document.createElement("span");
    info.className = "entree-info";
    const nom = document.createElement("strong");
    nom.textContent = labelType(e.type);
    info.appendChild(nom);
    if (e.note) {
      const note = document.createElement("span");
      note.className = "entree-note";
      note.textContent = e.note;
      info.appendChild(note);
    }
    li.appendChild(info);

    const edit = document.createElement("button");
    edit.className = "suppr";
    edit.textContent = "✎";
    edit.setAttribute("aria-label", "Modifier la note");
    edit.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "text"; input.maxLength = 120;
      input.value = e.note || "";
      input.placeholder = "Note (optionnel)";
      input.className = "entree-note-input";
      li.replaceChild(input, info);
      edit.remove();
      input.focus();
      input.addEventListener("keydown", ev => { if (ev.key === "Enter") input.blur(); });
      input.addEventListener("blur", () => {
        const j = getJournal();
        j[e.idx].note = input.value.trim();
        setJournal(j);
        rendreAccueil();
      });
    });
    li.appendChild(edit);

    const suppr = document.createElement("button");
    suppr.className = "suppr";
    suppr.textContent = "✕";
    suppr.setAttribute("aria-label", "Supprimer l'entrée");
    suppr.addEventListener("click", () => { supprimerEntree(e.idx); rendreAccueil(); });
    li.appendChild(suppr);
    liste.appendChild(li);
  });
}

/* ----- Quotas de la semaine ----- */
function rendreQuotas() {
  const cont = document.getElementById("quotas");
  cont.innerHTML = "";
  const counts = comptesParType(entreesSemaine(lundiDe(new Date())));
  const quotas = quotasHebdo();

  Object.entries(quotas).forEach(([type, quota]) => {
    const n = counts[type] || 0;
    const ligne = document.createElement("div");
    ligne.className = "quota-ligne";
    ligne.innerHTML = `
      <span class="quota-label">${labelType(type)}</span>
      <span class="quota-segments">${Array.from({ length: quota }, (_, i) =>
        `<span class="${i < Math.min(n, quota) ? "plein" : ""}"></span>`).join("")}</span>
      <span class="quota-compte">${n}/${quota}</span>`;
    cont.appendChild(ligne);
  });

  const extras = Object.entries(counts).filter(([t]) => !(t in quotas))
    .reduce((s, [, n]) => s + n, 0);
  if (extras) {
    const p = document.createElement("p");
    p.className = "quota-extras";
    p.textContent = `Extras : ${extras}`;
    cont.appendChild(p);
  }
}

/* ----- Rail de la semaine : plan indicatif ----- */
function rendreRail() {
  const lundi = lundiDe(new Date());
  const aujourdhui = isoDate(new Date());
  const semaine = entreesSemaine(lundi);
  const counts = comptesParType(semaine);
  const quotas = quotasHebdo();
  const rail = document.getElementById("semaine-rail");
  rail.innerHTML = "";

  state.bloc.semaine_type.forEach((j, idx) => {
    const dateIso = isoDate(addJours(lundi, idx));
    const estRepos = j.type === "repos";
    const entreesJour = semaine.filter(e => e.date === dateIso);
    const couvert = !estRepos && (
      (j.type in quotas && (counts[j.type] || 0) >= quotas[j.type]) ||
      entreesJour.some(e => e.type === j.type));

    const carte = document.createElement("div");
    carte.className = "jour-carte"
      + (dateIso === aujourdhui ? " aujourdhui" : "")
      + (estRepos ? " repos" : "")
      + (couvert ? " couvert" : "");
    carte.innerHTML = `
      <div class="jour-lettre">${j.jour.slice(0, 3)}</div>
      <div class="jour-info">
        <div class="jour-label">${j.label || "Repos"}${couvert ? ` <span class="couvert-coche">✓</span>` : ""}</div>
        ${j.detail ? `<div class="jour-detail">${j.detail}</div>` : ""}
        ${entreesJour.length ? `<div class="pastilles">${entreesJour.map(e =>
          `<span class="pastille">${labelType(e.type)}</span>`).join("")}</div>` : ""}
      </div>`;

    // Tap sur un jour passé ou courant = saisie pré-réglée sur cette date
    if (dateIso <= aujourdhui) {
      carte.classList.add("cliquable");
      carte.addEventListener("click", () => {
        saisieDate = dateIso;
        choixSeanceType = null;
        rendreAccueil();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    rail.appendChild(carte);
  });
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

  // Charges du jour vs séance précédente — le feedback au bon moment
  const histo = getCharges();
  const lignesCharges = Object.entries(seanceCtx.chargesSaisies).map(([id, kg]) => {
    const pts = histo[id] || [];
    const prev = pts.length ? pts[pts.length - 1].kg : null;
    const delta = prev === null ? null : kg - prev;
    const deltaTxt = delta === null ? `<small>première mesure</small>`
      : delta ? ` (${delta > 0 ? "+" : ""}${String(delta.toFixed(1)).replace(/\.0$/, "")})` : ` (=)`;
    return `<div class="bilan-ligne"><span>${state.exercices[id]?.nom || id}</span>
      <span class="val">${kg} kg${deltaTxt}</span></div>`;
  }).join("");

  const vue = document.getElementById("view-seance");
  vue.innerHTML = `
    <div class="seance-head"><span class="seance-phase-nom">Terminé</span></div>
    <div class="seance-corps lancement">
      <h2>Séance faite${seanceCtx.minimale ? " (minimale — ça compte pareil)" : ""}.</h2>
      ${lignesCharges ? `<div class="fin-charges">${lignesCharges}</div>` : ""}
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

    // Entrée de journal (type et date posés au lancement de la séance)
    const date = seanceCtx.date || dateIso;
    const morceaux = [];
    if (seanceCtx.estLibre) morceaux.push(seanceCtx.seance.nom);
    if (seanceCtx.minimale) morceaux.push("séance minimale");
    if (ressenti) morceaux.push(ressenti);
    ajouterEntree(date, seanceCtx.type || "autre", morceaux.join(" — "));
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
   BILAN HEBDO — quotas, zéro saisie
   ============================================================ */
function statsSemaine(lundi) {
  const counts = comptesParType(entreesSemaine(lundi));
  const quotas = quotasHebdo();
  const cles = Object.keys(quotas);
  // % = moyenne des taux de couverture par type, plafonnés à 100 % chacun
  const taux = cles.length
    ? cles.reduce((s, t) => s + Math.min((counts[t] || 0) / quotas[t], 1), 0) / cles.length
    : 0;
  const extras = {};
  Object.entries(counts).forEach(([t, n]) => { if (!(t in quotas)) extras[t] = n; });
  return { counts, quotas, extras, pct: Math.round(taux * 100) };
}

/* Lecture de la semaine : 1-2 phrases par règles simples, ton factuel.
   Jamais de « manqué », jamais de compte de semaines consécutives. */
function lectureSemaine(cette, entrees) {
  const phrases = [];
  const cles = Object.keys(cette.quotas);
  const done = cles.filter(t => (cette.counts[t] || 0) >= cette.quotas[t]);
  const extrasN = Object.values(cette.extras).reduce((a, b) => a + b, 0);
  const jourIdx = (new Date().getDay() + 6) % 7;   // 0 = lundi

  if (!entrees.length) {
    phrases.push(jourIdx <= 2
      ? "Rien de noté pour l'instant — la semaine commence."
      : "Peu d'entrées cette semaine — lundi remet les compteurs à zéro.");
  } else if (done.length === cles.length) {
    phrases.push(`Tous les quotas sont couverts${extrasN
      ? `, plus ${extrasN} extra${extrasN > 1 ? "s" : ""}` : ""}.`);
  } else if (done.length) {
    phrases.push(`${done.map(labelType).join(" et ")} couvert${done.length > 1 ? "s" : ""}, le reste de la semaine est ouvert.`);
  } else {
    phrases.push(`${entrees.length} entrée${entrees.length > 1 ? "s" : ""} posée${entrees.length > 1 ? "s" : ""} sur la semaine.`);
  }

  const minimales = entrees.filter(e => (e.note || "").includes("séance minimale")).length;
  if (minimales) phrases.push(`${minimales} séance${minimales > 1 ? "s" : ""} minimale${minimales > 1 ? "s" : ""} — ` +
    `comptée${minimales > 1 ? "s" : ""} en plein : la régularité prime sur le volume.`);

  // Dépassement sur les types sensibles tendons : rappel de l'objectif du bloc
  const surQuota = ["course", "renfo"].filter(t =>
    t in cette.quotas && (cette.counts[t] || 0) > cette.quotas[t]);
  if (surQuota.length && state.bloc.objectif) phrases.push(
    `${surQuota.map(labelType).join(" et ")} au-dessus du quota — rappel du bloc : « ${state.bloc.objectif} »`);

  if (phrases.length < 2 && extrasN && done.length !== cles.length) phrases.push(
    `${extrasN} extra${extrasN > 1 ? "s" : ""} hors quotas (${Object.keys(cette.extras).map(labelType).join(", ")}).`);

  return phrases.slice(0, 2).join(" ");
}

function rendreBilan() {
  const lundi = lundiDe(new Date());
  const cette = statsSemaine(lundi);
  const prec = statsSemaine(addJours(lundi, -7));
  const cont = document.getElementById("bilan-contenu");

  // Tendance 4 semaines (barres)
  const tendance = [];
  for (let i = 3; i >= 0; i--) tendance.push(statsSemaine(addJours(lundi, -7 * i)));

  // Charges : dernière valeur vs précédente, par exercice
  const charges = getCharges();
  const lignesCharges = Object.entries(charges).map(([id, pts]) => {
    const d = pts[pts.length - 1], av = pts.length > 1 ? pts[pts.length - 2] : null;
    const delta = av ? d.kg - av.kg : 0;
    return `<div class="bilan-ligne"><span>${state.exercices[id]?.nom || id}</span>
      <span class="val">${d.kg} kg${delta ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(1)})` : ""}</span></div>`;
  }).join("");

  const lignesExtras = Object.entries(cette.extras).map(([t, n]) =>
    `<div class="bilan-ligne"><span>${labelType(t)}</span><span class="val">${n}</span></div>`).join("");

  cont.innerHTML = `
    <div class="bilan-carte">
      <h3>Lecture</h3>
      <p class="lecture">${lectureSemaine(cette, entreesSemaine(lundi))}</p>
    </div>
    <div class="bilan-carte">
      <h3>Quotas</h3>
      ${Object.entries(cette.quotas).map(([t, q]) =>
        `<div class="bilan-ligne"><span>${labelType(t)}</span>
          <span class="val">${cette.counts[t] || 0}/${q} <small>(${prec.counts[t] || 0}/${q})</small></span></div>`).join("")}
      <p class="hint">Entre parenthèses : semaine précédente.</p>
    </div>
    <div class="bilan-carte">
      <h3>Tendance 4 semaines</h3>
      <div class="tendance">
        ${tendance.map((s, i) => `<div style="height:${Math.max(s.pct, 4)}%"
          class="${i === 3 ? "actuelle" : ""}"><span>S${numeroSemaine() - (3 - i)}</span></div>`).join("")}
      </div>
      <p class="hint" style="margin-top:26px">Hauteur = couverture moyenne des quotas (plafonnée à 100 % par type).</p>
    </div>
    <div class="bilan-carte">
      <h3>Extras</h3>
      ${lignesExtras || `<p class="hint">Aucun extra cette semaine.</p>`}
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
      version: 2,
      schema_version: 2,
      bloc_actif: getBlocActif(),
      journal: getJournal(),
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
        ["bloc_actif", "charges", "backlog_idees"].forEach(k => {
          if (data[k] !== undefined) LS.set(k, data[k]);
        });
        if (data.journal !== undefined) {
          setJournal(data.journal);
          LS.set("schema_version", 2);
        } else {
          // Export V1 : restaurer validations/bonus puis passer par la migration
          localStorage.removeItem("bloc.journal");
          LS.set("validations", data.validations || {});
          LS.set("bonus", data.bonus || []);
          LS.set("schema_version", 1);
          migrerV2();
        }
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
