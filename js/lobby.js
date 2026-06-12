// Controlador de la pantalla de lobby online: crear/unirse a sala, elegir coche
// (con bloqueo de los ya cogidos), toggle de relleno con CPU y arranque (host).

import { CARS, RING_SIZES } from './config.js';
import { MAPS } from './maps.js';
import { state } from './state.js';
import {
  net, MAX_PLAYERS, isReady, createRoom, joinRoom, leaveRoom,
  setReady, pickCar, setFillAI, setMap, setRingSize, playersList, takenCars,
  subscribeMeta, subscribePlayers, subscribeInputs, subscribeState,
} from './net.js';
import { startMatch, applyMeta, applyNetState, goToMenuFromOnline, show, hide } from './rounds.js';

const RING_SIZE_LABELS = { small: "SMALL", medium: "MEDIUM", large: "LARGE" };

function msg(t) { document.getElementById("lobbyMsg").textContent = t || ""; }

// Abre el lobby desde el menú (panel de conexión).
export function openLobby() {
  hide("menu");
  show("lobby");
  document.getElementById("lobbyConnect").style.display = "";
  document.getElementById("lobbyRoom").style.display = "none";
  msg(isReady() ? "" : "Configure Firebase in js/firebase-config.js to play online.");
  document.getElementById("createBtn").disabled = !isReady();
  document.getElementById("joinBtn").disabled = !isReady();
}

function enterRoom(asHost) {
  document.getElementById("lobbyConnect").style.display = "none";
  document.getElementById("lobbyRoom").style.display = "";
  document.getElementById("roomCode").textContent = net.code;
  document.getElementById("startBtn").style.display = asHost ? "" : "none";
  document.getElementById("readyBtn").style.display = asHost ? "none" : "";
  document.getElementById("fillAIRow").style.display = asHost ? "" : "none";
  renderMapPicker();
  renderRingPicker();

  subscribeMeta(m => { onMeta(m); applyMeta(m); });
  subscribePlayers(() => renderPlayers());
  if (asHost) subscribeInputs(() => {});   // alimenta state.remoteInputs en el host
  else subscribeState(applyNetState);       // el cliente recibe transformaciones
  renderPlayers();
}

function onMeta(m) {
  if (!m) return; // cierre de sala lo gestiona applyMeta
  net.fillAI = !!m.fillAI;
  const t = document.getElementById("fillAIToggle");
  if (t) t.classList.toggle("on", net.fillAI);
  state.mapId = m.map || "clasico";
  state.ringSize = m.ringSize || "small";
  renderMapPicker();
  renderRingPicker();
  updateStartBtn();
}

// Selector de mapa: solo el host puede cambiarlo; los clientes ven el elegido.
function renderMapPicker() {
  const sel = state.mapId || "clasico";
  document.querySelectorAll("#lobbyMaps button").forEach(b => {
    b.classList.toggle("on", b.dataset.id === sel);
    b.disabled = !net.isHost;
  });
}

function renderRingPicker() {
  const sel = state.ringSize || "small";
  document.querySelectorAll("#lobbyRing button").forEach(b => {
    b.classList.toggle("on", b.dataset.size === sel);
    b.disabled = !net.isHost;
  });
}

function buildLobbyMaps() {
  const row = document.getElementById("lobbyMaps");
  row.innerHTML = "";
  MAPS.forEach(m => {
    const b = document.createElement("button");
    b.textContent = m.name; b.dataset.id = m.id; b.title = m.desc;
    b.onclick = () => { if (net.isHost) setMap(m.id); };
    row.appendChild(b);
  });
}

function buildLobbyRing() {
  const row = document.getElementById("lobbyRing");
  row.innerHTML = "";
  Object.keys(RING_SIZES).forEach(size => {
    const b = document.createElement("button");
    b.textContent = RING_SIZE_LABELS[size]; b.dataset.size = size;
    b.onclick = () => { if (net.isHost) setRingSize(size); };
    row.appendChild(b);
  });
}

function renderPlayers() {
  const list = document.getElementById("playerList");
  if (!list) return;
  list.innerHTML = "";
  const players = playersList();
  players.forEach(p => {
    const hex = "#" + CARS[p.car].color.toString(16).padStart(6, "0");
    const isMe = p.clientId === net.clientId;
    const isHostP = p.clientId === net.meta.host;
    const ready = p.ready || isHostP;
    const row = document.createElement("div");
    row.className = "plRow";
    row.innerHTML =
      `<span class="plDot" style="background:${hex}"></span>` +
      `<span class="plName">${p.name}${isHostP ? " 👑" : ""}${isMe ? " (you)" : ""}</span>` +
      `<span class="plReady ${ready ? "on" : ""}">${ready ? "READY" : "…"}</span>`;
    list.appendChild(row);
  });
  if (net.fillAI) {
    const used = players.length;
    for (let i = used; i < MAX_PLAYERS; i++) {
      const row = document.createElement("div");
      row.className = "plRow ghost";
      row.innerHTML = `<span class="plDot"></span><span class="plName">CPU</span><span class="plReady">BOT</span>`;
      list.appendChild(row);
    }
  }
  renderCars();
  renderReadyBtn();
  updateStartBtn();
}

function renderCars() {
  const taken = takenCars(net.clientId); // coches cogidos por OTROS
  const me = net.players[net.clientId];
  document.querySelectorAll("#lobbyCars .car").forEach((d, i) => {
    d.classList.toggle("locked", taken.has(i));
    d.classList.toggle("mine", !!me && me.car === i);
  });
}

function renderReadyBtn() {
  const btn = document.getElementById("readyBtn");
  if (net.isHost) return;
  const me = net.players[net.clientId];
  const ready = !!(me && me.ready);
  btn.textContent = ready ? "NOT READY" : "READY";
  btn.classList.toggle("on", ready);
}

function updateStartBtn() {
  const btn = document.getElementById("startBtn");
  if (!net.isHost) { btn.style.display = "none"; return; }
  btn.style.display = "";
  const humans = playersList().length;
  const total = net.fillAI ? MAX_PLAYERS : humans;
  const othersReady = playersList().filter(p => p.clientId !== net.clientId).every(p => p.ready);
  btn.disabled = !(total >= 2 && othersReady);
}

// Rejilla de coches del lobby (igual markup que el menú) — se construye una vez.
function buildLobbyCars() {
  const list = document.getElementById("lobbyCars");
  list.innerHTML = "";
  CARS.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "car";
    const hex = "#" + c.color.toString(16).padStart(6, "0");
    div.innerHTML = `<div class="swatch" style="background:${hex}"></div><h3>${c.name}</h3>`;
    div.onclick = () => {
      if (div.classList.contains("locked")) return;
      pickCar(i);
    };
    list.appendChild(div);
  });
}

export function buildLobby() {
  buildLobbyCars();
  buildLobbyMaps();
  buildLobbyRing();

  document.getElementById("createBtn").onclick = async () => {
    try { msg("Creating room…"); await createRoom("P1"); state.mode = "online"; enterRoom(true); }
    catch (e) { msg(e.message || "Couldn't create the room."); }
  };
  document.getElementById("joinBtn").onclick = async () => {
    const code = document.getElementById("joinCode").value;
    if (!code || code.trim().length < 4) { msg("Enter the 4-letter code."); return; }
    try { msg("Joining…"); const r = await joinRoom(code, ""); state.mode = "online"; enterRoom(false); }
    catch (e) { msg(e.message || "Couldn't join."); }
  };
  document.getElementById("readyBtn").onclick = () => {
    const me = net.players[net.clientId];
    setReady(!(me && me.ready));
  };
  document.getElementById("fillAIToggle").onclick = () => setFillAI(!net.fillAI);
  document.getElementById("startBtn").onclick = () => startMatch();
  document.getElementById("leaveBtn").onclick = () => goToMenuFromOnline();
  document.getElementById("lobbyBack").onclick = () => {
    hide("lobby"); show("menu");
    const oneP = document.querySelector('#modeToggle button[data-m="1"]');
    if (oneP) oneP.click();
  };

  // mayúsculas automáticas en el código
  const codeIn = document.getElementById("joinCode");
  codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase().slice(0, 4); });
}
