// Gauntlet (roadmap #4): modo en solitario de oleadas crecientes. Cada oleada es
// una ronda de eliminación; el jugador debe quedar como único superviviente para
// avanzar y elegir UNA mejora (draft) entre oleadas. La run acaba al ser
// expulsado; la profundidad (oleadas superadas) se guarda como récord local.
//
// Es solo local: state.mode sigue siendo "local" y nada de esto toca el netcode.
// state.gaunt.active gatea toda la lógica de este módulo desde el bucle/rondas.

import { CARS, RING_SIZES, GAUNT_SHRINK_MIN, GAUNT_CPU_SCALE_PER_WAVE, GAUNT_AGGRO_PER_WAVE, SHRINK_T } from './config.js';
import { MAPS } from './maps.js';
import { state, rng } from './state.js';
import { buildFighters } from './cars.js';
import { loadMap } from './scene.js';
import { showControls } from './input.js';
import { startRound, show, hide } from './rounds.js';
import * as sfx from './audio.js';

const BEST_KEY = "driftsumo_gaunt_best";

export function getBest() {
  try { return +(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { return 0; }
}
function setBest(n) {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch {}
}

// --- Pool de mejoras. apply(mods) acumula sobre state.gaunt.mods. max limita
// cuántas veces puede salir cada una (las agotadas no se ofrecen). ---
export const UPGRADES = [
  { id: "engine", name: "ENGINE",  desc: "+12% top speed",       max: 5, apply: m => m.topSpeed *= 1.12 },
  { id: "nitro",  name: "NITRO",   desc: "+15% acceleration",    max: 5, apply: m => m.accel *= 1.15 },
  { id: "grip",   name: "GRIP",    desc: "+18% cornering grip",  max: 4, apply: m => m.grip *= 1.18 },
  { id: "heavy",  name: "HEAVY",   desc: "+18% mass · harder to shove", max: 4, apply: m => m.mass *= 1.18 },
  { id: "bumper", name: "BUMPER",  desc: "Your hits hit harder", max: 4, apply: m => m.bump += 0.6 },
  { id: "life",   name: "EXTRA LIFE", desc: "Survive one knock-off", max: 3, apply: m => m.lives += 1 },
];

function freshMods() {
  return { topSpeed: 1, accel: 1, grip: 1, mass: 1, bump: 0, lives: 0, taken: {} };
}

// Dificultad por oleada (w = 1-based).
function waveCfg(w) {
  const cpuCount = Math.min(3, w);                          // 1 → 2 → 3, luego tope 3
  const cpuScale = 1 + (w - 1) * GAUNT_CPU_SCALE_PER_WAVE;  // stats de CPU crecientes
  const aggroBonus = (w - 1) * GAUNT_AGGRO_PER_WAVE;
  const shrinkT = Math.max(GAUNT_SHRINK_MIN, SHRINK_T - (w - 1) * 2); // ring encoge antes
  const ringSize = w >= 8 ? "small" : (w >= 4 ? "small" : "medium");  // arenas más justas al avanzar
  const mapId = MAPS[(w - 1) % MAPS.length].id;
  return { cpuCount, cpuScale, aggroBonus, shrinkT, ringSize, mapId };
}

export function startGauntlet() {
  state.mode = "local";
  state.players = 1;   // controles e UI de 1 jugador
  state.gaunt = { active: true, wave: 0, mods: freshMods() };
  hide("menu"); hide("endScr"); hide("draftScr");
  document.getElementById("hud").style.display = "block";
  state.matchActive = true;
  nextWave();
}

function nextWave() {
  const g = state.gaunt;
  g.wave++;
  const wc = waveCfg(g.wave);
  state.shrinkT = wc.shrinkT;
  state.ringSize = wc.ringSize;
  state.ringR0 = RING_SIZES[wc.ringSize] || RING_SIZES.small;
  state.mapId = wc.mapId;

  // Roster: jugador en slot 0 + N CPUs con coches distintos.
  const used = new Set([state.selP1]);
  const roster = [{ ci: state.selP1, ctrl: "p1", slot: 0, tag: "YOU" }];
  for (let s = 1; s <= wc.cpuCount; s++) {
    let ci = 0;
    for (let i = 0; i < CARS.length; i++) if (!used.has(i)) { ci = i; break; }
    used.add(ci);
    roster.push({ ci, ctrl: "ai", slot: s, tag: "CPU" });
  }
  buildFighters(roster);
  loadMap(state.mapId);
  showControls();

  // Escala las CPUs y aplica las mejoras del jugador a su cfg (clonado).
  state.fighters.forEach(f => {
    if (f.isAI) {
      f.cfg.topSpeed *= wc.cpuScale;
      f.cfg.accel *= wc.cpuScale;
      f.aggro = Math.min(1.6, f.aggro + wc.aggroBonus);
    } else {
      applyRunMods(f);
    }
  });

  startRound();
}

function applyRunMods(player) {
  const m = state.gaunt.mods;
  player.cfg.topSpeed *= m.topSpeed;
  player.cfg.accel *= m.accel;
  player.cfg.grip *= m.grip;
  player.cfg.mass *= m.mass;
  player.bump = m.bump;
  player.lives = m.lives;
}

// Llamado desde el bucle al terminar la ronda de una oleada.
export function onWaveCleared(playerAlive) {
  if (playerAlive) { sfx.point(); offerDraft(); }
  else gameOver();
}

function offerDraft() {
  const g = state.gaunt;
  state.phase = "idle";   // sal de "roundend" para que el bucle no reentre aquí
  // Candidatas: las que no han llegado a su tope.
  const pool = UPGRADES.filter(u => (g.mods.taken[u.id] || 0) < u.max);
  const picks = [];
  const bag = pool.slice();
  while (picks.length < 3 && bag.length) {
    picks.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
  }

  document.getElementById("draftTitle").textContent = `WAVE ${g.wave} CLEARED · CHOOSE AN UPGRADE`;
  const row = document.getElementById("draftCards");
  row.innerHTML = "";
  picks.forEach(u => {
    const div = document.createElement("div");
    div.className = "draftCard";
    div.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
    div.onclick = () => chooseUpgrade(u.id);
    row.appendChild(div);
  });

  document.getElementById("hud").style.display = "none";
  show("draftScr");
}

function chooseUpgrade(id) {
  const g = state.gaunt;
  const u = UPGRADES.find(x => x.id === id);
  if (u) { u.apply(g.mods); g.mods.taken[id] = (g.mods.taken[id] || 0) + 1; }
  sfx.pickup();
  hide("draftScr");
  document.getElementById("hud").style.display = "block";
  nextWave();
}

function gameOver() {
  const g = state.gaunt;
  const cleared = g.wave - 1;            // la oleada actual no se superó
  const prev = getBest();
  const best = Math.max(prev, cleared);
  if (best > prev) setBest(best);

  state.gaunt.active = false;
  state.matchActive = false;
  state.phase = "idle";
  state.shrinkT = SHRINK_T;
  document.getElementById("hud").style.display = "none";

  const t = document.getElementById("endTitle");
  t.textContent = "KNOCKED OUT"; t.className = "big lose";
  document.getElementById("endSub").textContent =
    `Waves cleared: ${cleared} · Best: ${best}` + (cleared > prev ? "  🏆 NEW BEST!" : "");
  const rb = document.getElementById("rematchBtn");
  rb.textContent = "RETRY"; rb.style.display = "";
  rb.onclick = startGauntlet;   // RETRY relanza el gauntlet, no una revancha normal
  show("endScr");
  sfx.lose();
}

// Salir del gauntlet a media run (botón QUIT del HUD).
export function quitGauntlet() {
  state.gaunt.active = false;
  state.matchActive = false;
  state.phase = "idle";
  state.shrinkT = SHRINK_T;
  state.sd = -1;
  document.getElementById("hud").style.display = "none";
  hide("draftScr"); hide("endScr"); show("menu");
}
