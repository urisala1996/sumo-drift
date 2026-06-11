import { RING_R0, WINS_NEEDED } from './config.js';
import { state } from './state.js';
import { setRing } from './scene.js';
import { setupFighters, placeFighters } from './cars.js';
import { refreshScoreUI, banner } from './hud.js';
import { showControls } from './input.js';
import { net, setStatus, writeMeta, leaveRoom } from './net.js';

export function show(id) { document.getElementById(id).classList.remove("hidden"); }
export function hide(id) { document.getElementById(id).classList.add("hidden"); }

// Arranca la partida. En local lo dispara el botón JUGAR; en online lo dispara
// el host desde el lobby (los clientes arrancan vía applyMeta -> clientStartMatch).
export function startMatch() {
  setupFighters();
  showControls();
  state.round = 1;
  if (state.mode === "online") setStatus("playing");
  startRound();
  hide("menu"); hide("endScr"); hide("lobby");
  document.getElementById("hud").style.display = "block";
  state.matchActive = true;
}

export function startRound() {
  setRing(RING_R0);
  placeFighters();
  state.playT = 0;
  state.phase = "count";
  state.phaseT = 0;
  document.getElementById("roundLbl").textContent = "RONDA " + state.round;
}

export function endRound(winner) {
  state.phase = "roundend";
  state.phaseT = 0;
  if (winner) {
    winner.wins++;
    refreshScoreUI();
    const hex = "#" + winner.cfg.color.toString(16).padStart(6, "0");
    let msg;
    if (state.mode === "online") msg = winner.isAI ? "RONDA PARA LA CPU" : "¡RONDA DE " + winner.tag + "!";
    else if (winner.ctrl === "p1" && state.players === 1) msg = "¡RONDA TUYA!";
    else if (winner.ctrl === "ai") msg = "RONDA PARA LA CPU";
    else msg = "¡RONDA DE " + winner.tag + "!";
    banner(msg, hex);
  } else {
    banner("¡EMPATE!");
  }
}

export function endMatch(winner) {
  state.phase = "idle";
  document.getElementById("hud").style.display = "none";

  if (state.mode === "online") {
    const sub = state.fighters.map(f => f.tag + " " + f.wins).join(" · ");
    writeMeta({
      status: "ended", phase: "idle", banner: "", bannerColor: "",
      endWinnerSlot: winner.slot, endWinnerTag: winner.tag, endWinnerAI: winner.isAI ? 1 : 0, sub,
    });
    renderEnd(winner.slot, winner.tag, winner.isAI, sub);
    state.matchActive = false;
    return;
  }

  const t = document.getElementById("endTitle");
  const human = winner.ctrl !== "ai";
  if (human && (state.players === 1 || winner.ctrl === "p1" || winner.ctrl === "p2")) {
    if (state.players === 1) { t.textContent = "¡VICTORIA!"; t.className = "big win"; }
    else { t.textContent = "¡GANA " + winner.tag + "!"; t.className = "big win"; }
  } else {
    t.textContent = "GANA LA CPU";
    t.className = "big lose";
  }
  document.getElementById("endSub").textContent = state.fighters.map(f => f.tag + " " + f.wins).join(" · ");
  document.getElementById("rematchBtn").style.display = "";
  show("endScr");
}

// ---------- Cliente online: reflejar estado del host ----------

// Construye la vista de partida en un cliente (sin lógica de fases: las
// posiciones llegan sincronizadas desde el host).
export function clientStartMatch() {
  setupFighters();
  showControls();
  placeFighters();
  hide("menu"); hide("endScr"); hide("lobby");
  document.getElementById("hud").style.display = "block";
  state.matchActive = true;
}

function renderEnd(winnerSlot, winnerTag, winnerAI, sub) {
  const t = document.getElementById("endTitle");
  if (winnerAI) { t.textContent = "GANA LA CPU"; t.className = "big lose"; }
  else if (winnerSlot === net.slot) { t.textContent = "¡VICTORIA!"; t.className = "big win"; }
  else { t.textContent = "¡GANA " + winnerTag + "!"; t.className = "big lose"; }
  document.getElementById("endSub").textContent = sub;
  // La revancha solo la controla el host.
  document.getElementById("rematchBtn").style.display = net.isHost ? "" : "none";
  document.getElementById("hud").style.display = "none";
  show("endScr");
}

// Llamado en cada cambio de meta (cliente). Si meta es null la sala se cerró.
export function applyMeta(meta) {
  if (net.isHost) return;
  if (!meta) { goToMenuFromOnline("La sala se ha cerrado."); return; }

  if (meta.status === "playing" && !state.matchActive) clientStartMatch();
  if (meta.status === "ended" && state.matchActive) {
    renderEnd(meta.endWinnerSlot, meta.endWinnerTag, !!meta.endWinnerAI, meta.sub || "");
    state.matchActive = false;
  }

  if (state.matchActive) {
    // Encoge el ring visualmente y actualiza state.ringR (lo usa cámara/aviso).
    if (typeof meta.ring === "number") setRing(RING_R0 * meta.ring / 100);
    document.getElementById("roundLbl").textContent = "RONDA " + (meta.round || 1);
    document.getElementById("ringLbl").textContent = "RING " + Math.round(meta.ring ?? 100) + "%";
    const b = document.getElementById("banner");
    if (meta.banner) {
      b.textContent = meta.banner;
      b.style.color = meta.bannerColor || "var(--paper)";
      b.style.opacity = 1;
    } else {
      b.style.opacity = 0;
    }
  }
}

// Cliente: guarda la última instantánea de transformaciones del host como
// objetivos de interpolación (el render se suaviza en main.js).
export function applyNetState(snap) {
  if (net.isHost || !snap) return;
  let winsChanged = false;
  for (const f of state.fighters) {
    const s = snap[f.slot];
    if (!s) continue;
    f.tx = s.x; f.tz = s.z; f.ty = s.y;
    f.theading = s.heading; f.tsteer = s.steer;
    f.alive = !!s.alive; f.falling = !!s.falling; f.brake = !!s.brake;
    if (typeof s.wins === "number" && s.wins !== f.wins) { f.wins = s.wins; winsChanged = true; }
  }
  if (winsChanged) refreshScoreUI();
}

export function goToMenuFromOnline(msg) {
  leaveRoom();
  state.mode = "local";
  state.matchActive = false;
  state.phase = "idle";
  document.getElementById("hud").style.display = "none";
  hide("endScr"); hide("lobby"); show("menu");
  // Vuelve a resaltar el modo 1 JUGADOR en el menú.
  const oneP = document.querySelector('#modeToggle button[data-m="1"]');
  if (oneP) oneP.click();
  if (msg) window.setTimeout(() => alert(msg), 50);
}
