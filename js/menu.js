import { CARS, RING_SIZES } from './config.js';
import { MAPS } from './maps.js';
import { state } from './state.js';
import { startMatch, show, hide, goToMenuFromOnline, quitMatch } from './rounds.js';
import { buildLobby, openLobby } from './lobby.js';

const RING_SIZE_LABELS = { small: "SMALL", medium: "MEDIUM", large: "LARGE" };

function buildMapPicker() {
  const row = document.getElementById("menuMaps");
  row.innerHTML = "";
  MAPS.forEach(m => {
    const b = document.createElement("button");
    b.textContent = m.name; b.dataset.id = m.id;
    b.title = m.desc;
    b.classList.toggle("on", m.id === state.mapId);
    b.onclick = () => {
      state.mapId = m.id;
      row.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.id === m.id));
    };
    row.appendChild(b);
  });
}

function buildRingPicker() {
  const row = document.getElementById("menuRing");
  row.innerHTML = "";
  Object.keys(RING_SIZES).forEach(size => {
    const b = document.createElement("button");
    b.textContent = RING_SIZE_LABELS[size]; b.dataset.size = size;
    b.classList.toggle("on", size === state.ringSize);
    b.onclick = () => {
      state.ringSize = size;
      row.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.size === size));
    };
    row.appendChild(b);
  });
}

function updateCarUI() {
  document.querySelectorAll("#carList .car").forEach((d, i) => {
    d.classList.remove("p1", "p2");
    const badge = d.querySelector(".badge");
    if (state.players === 1) {
      if (i === state.selP1) { d.classList.add("p1"); badge.textContent = "YOU"; }
    } else {
      if (i === state.selP1) { d.classList.add("p1"); badge.textContent = "P1"; }
      else if (i === state.selP2) { d.classList.add("p2"); badge.textContent = "P2"; }
    }
  });
  const prompt = document.getElementById("pickPrompt"), play = document.getElementById("playBtn");
  if (state.players === 1) {
    prompt.textContent = "Pick your car";
    play.disabled = false;
  } else {
    prompt.textContent = state.selP2 === null ? "P2: pick your car" : "Ready! Each with their car";
    play.disabled = state.selP1 === null || state.selP2 === null;
  }
}

function pickCar(i) {
  if (state.players === 1) {
    state.selP1 = i;
  } else {
    if (i === state.selP1) return;
    if (i === state.selP2) { state.selP2 = null; return updateCarUI(); }
    state.selP2 = i;
  }
  updateCarUI();
}

function setMode(m) {
  document.querySelectorAll("#modeToggle button").forEach(b =>
    b.classList.toggle("on", b.dataset.m === String(m))
  );
  if (m === "online") { openLobby(); return; }

  state.mode = "local";
  state.players = +m;
  // El menú local solo deja elegir entre los 3 primeros coches (el 4º, VOLT,
  // queda para online); selP usa índices 0..2.
  if (state.players === 2) { state.selP1 = 0; state.selP2 = 1; } else { state.selP1 = 0; }
  document.getElementById("menuHow").innerHTML = state.players === 1
    ? 'You accelerate on your own. Tap <b>left</b> or <b>right</b> to steer and <b>BRAKE</b> (or both sides) to slow down. Push your rivals out of the ring as it shrinks.'
    : 'Best with the phone flat on the table. Each player has <b>◀ ▶</b> in their corner; press <b>both at once</b> to brake. Knock the other one out of the ring!';
  updateCarUI();
}

export function buildMenu() {
  const list = document.getElementById("carList");
  CARS.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "car";
    const hex = "#" + c.color.toString(16).padStart(6, "0");
    div.innerHTML =
      `<div class="badge"></div><div class="swatch" style="background:${hex}"></div><h3>${c.name}</h3>` +
      Object.entries(c.stats).map(([k, v]) =>
        `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${v * 100}%"></i></div></div>`
      ).join("");
    div.onclick = () => pickCar(i);
    list.appendChild(div);
  });
  document.querySelectorAll("#modeToggle button").forEach(b => b.onclick = () => setMode(b.dataset.m));
  document.getElementById("playBtn").onclick = startMatch;
  document.getElementById("rematchBtn").onclick = startMatch;
  document.getElementById("menuBtn").onclick = () => {
    if (state.mode === "online") goToMenuFromOnline();
    else { hide("endScr"); show("menu"); }
  };
  document.getElementById("quitBtn").onclick = quitMatch;
  buildMapPicker();
  buildRingPicker();
  buildLobby();
  setMode("1");
}
