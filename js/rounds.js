import { RING_SIZES, WINS_NEEDED } from './config.js';
import { state } from './state.js';
import { setRing, loadMap } from './scene.js';
import { setupFighters, placeFighters } from './cars.js';
import { refreshScoreUI, banner, hideBanner, showCountdown, hideCountdown } from './hud.js';
import { showControls } from './input.js';
import { net, writeMeta, leaveRoom } from './net.js';

function ringRadius(size) { return RING_SIZES[size] || RING_SIZES.small; }

export function show(id) { document.getElementById(id).classList.remove("hidden"); }
export function hide(id) { document.getElementById(id).classList.add("hidden"); }

// Arranca la partida. En local lo dispara el botón JUGAR; en online lo dispara
// el host desde el lobby (los clientes arrancan vía applyMeta -> clientStartMatch).
export function startMatch() {
  state.ringR0 = ringRadius(state.ringSize);
  setupFighters();
  loadMap(state.mapId);
  showControls();
  state.round = 1;
  if (state.mode === "online") {
    // Nuevo matchId en cada arranque (incluida la revancha): los clientes lo
    // detectan y reconstruyen la partida de cero, sin depender de matchActive.
    // Una sola escritura atómica evita estados intermedios.
    state.matchId = (net.meta.matchId || 0) + 1;
    writeMeta({
      map: state.mapId, ringSize: state.ringSize, matchId: state.matchId, status: "playing",
      round: 1, banner: "", bannerColor: "", sd: -1,
      endWinnerSlot: null, endWinnerTag: null, endWinnerAI: 0, sub: "",
    });
  }
  startRound();
  hide("menu"); hide("endScr"); hide("lobby");
  document.getElementById("hud").style.display = "block";
  state.matchActive = true;
}

export function startRound() {
  setRing(state.ringR0);
  placeFighters();
  state.playT = 0;
  state.sdT = 0;
  state.sd = -1;
  hideCountdown();
  state.phase = "count";
  state.phaseT = 0;
  document.getElementById("roundLbl").textContent = "ROUND " + state.round;
}

export function endRound(winner) {
  state.phase = "roundend";
  state.phaseT = 0;
  state.sd = -1;
  hideCountdown();
  if (winner) {
    winner.wins++;
    refreshScoreUI();
    const hex = "#" + winner.cfg.color.toString(16).padStart(6, "0");
    let msg;
    if (state.mode === "online") msg = winner.isAI ? "CPU's ROUND" : winner.tag + "'s ROUND!";
    else if (winner.ctrl === "p1" && state.players === 1) msg = "YOUR ROUND!";
    else if (winner.ctrl === "ai") msg = "CPU's ROUND";
    else msg = winner.tag + "'s ROUND!";
    banner(msg, hex);
  } else {
    banner("DRAW!");
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
    if (state.players === 1) { t.textContent = "VICTORY!"; t.className = "big win"; }
    else { t.textContent = winner.tag + " WINS!"; t.className = "big win"; }
  } else {
    t.textContent = "CPU WINS";
    t.className = "big lose";
  }
  document.getElementById("endSub").textContent = state.fighters.map(f => f.tag + " " + f.wins).join(" · ");
  document.getElementById("rematchBtn").style.display = "";
  show("endScr");
}

// Sale de la partida a mitad (botón QUIT del HUD).
export function quitMatch() {
  if (state.mode === "online") { goToMenuFromOnline(); return; }
  state.matchActive = false;
  state.phase = "idle";
  state.sd = -1;
  hideBanner(); hideCountdown();
  document.getElementById("hud").style.display = "none";
  hide("endScr"); show("menu");
}

// ---------- Cliente online: reflejar estado del host ----------

// Construye la vista de partida en un cliente (sin lógica de fases: las
// posiciones llegan sincronizadas desde el host).
export function clientStartMatch() {
  state.ringSize = net.meta.ringSize || "small";
  state.ringR0 = ringRadius(state.ringSize);
  state.ringTarget = state.ringR0;
  setRing(state.ringR0);
  setupFighters();
  loadMap(net.meta.map || "clasico");
  showControls();
  placeFighters();
  hide("menu"); hide("endScr"); hide("lobby");
  document.getElementById("hud").style.display = "block";
  state.matchActive = true;
}

function renderEnd(winnerSlot, winnerTag, winnerAI, sub) {
  const t = document.getElementById("endTitle");
  if (winnerAI) { t.textContent = "CPU WINS"; t.className = "big lose"; }
  else if (winnerSlot === net.slot) { t.textContent = "VICTORY!"; t.className = "big win"; }
  else { t.textContent = winnerTag + " WINS!"; t.className = "big lose"; }
  document.getElementById("endSub").textContent = sub;
  // La revancha solo la controla el host.
  document.getElementById("rematchBtn").style.display = net.isHost ? "" : "none";
  document.getElementById("hud").style.display = "none";
  show("endScr");
}

// Llamado en cada cambio de meta (cliente). Si meta es null la sala se cerró.
export function applyMeta(meta) {
  if (net.isHost) return;
  if (!meta) { goToMenuFromOnline("The room was closed."); return; }
  // Cualquier meta recibida implica que el host sigue vivo.
  state.hostSeenAt = Date.now();

  // Arranca (o re-arranca en revancha) cuando cambia el matchId con status playing.
  if (meta.status === "playing" && typeof meta.matchId === "number" && meta.matchId !== state.lastMatchId) {
    state.lastMatchId = meta.matchId;
    clientStartMatch();
  }
  if (meta.status === "ended" && state.matchActive) {
    renderEnd(meta.endWinnerSlot, meta.endWinnerTag, !!meta.endWinnerAI, meta.sub || "");
    state.matchActive = false;
  }

  if (state.matchActive) {
    // Fija el objetivo de tamaño de ring; main.js lo interpola por frame
    // (evita el "tick" que se veía al recibir el tamaño a saltos de ~20Hz).
    if (typeof meta.ring === "number") state.ringTarget = state.ringR0 * meta.ring / 100;
    document.getElementById("roundLbl").textContent = "ROUND " + (meta.round || 1);
    document.getElementById("ringLbl").textContent = "RING " + Math.round(meta.ring ?? 100) + "%";
    // Cuenta atrás de muerte súbita sincronizada desde el host.
    if (typeof meta.sd === "number" && meta.sd >= 0) showCountdown(meta.sd);
    else hideCountdown();
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
  state.matchId = 0;
  state.lastMatchId = 0;
  state.hostSeenAt = 0;
  state.sd = -1;
  state.ringTarget = null;
  state.phase = "idle";
  hideCountdown();
  document.getElementById("hud").style.display = "none";
  hide("endScr"); hide("lobby"); show("menu");
  // Vuelve a resaltar el modo 1 JUGADOR en el menú.
  const oneP = document.querySelector('#modeToggle button[data-m="1"]');
  if (oneP) oneP.click();
  if (msg) window.setTimeout(() => alert(msg), 50);
}
