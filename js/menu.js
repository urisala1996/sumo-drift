import { CARS } from './config.js';
import { MAPS } from './maps.js';
import { state } from './state.js';
import { startMatch, show, hide, goToMenuFromOnline } from './rounds.js';
import { buildLobby, openLobby } from './lobby.js';

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

function updateCarUI() {
  document.querySelectorAll("#carList .car").forEach((d, i) => {
    d.classList.remove("p1", "p2");
    const badge = d.querySelector(".badge");
    if (state.players === 1) {
      if (i === state.selP1) { d.classList.add("p1"); badge.textContent = "TÚ"; }
    } else {
      if (i === state.selP1) { d.classList.add("p1"); badge.textContent = "P1"; }
      else if (i === state.selP2) { d.classList.add("p2"); badge.textContent = "P2"; }
    }
  });
  const prompt = document.getElementById("pickPrompt"), play = document.getElementById("playBtn");
  if (state.players === 1) {
    prompt.textContent = "Elige tu coche";
    play.disabled = false;
  } else {
    prompt.textContent = state.selP2 === null ? "P2: elige tu coche" : "¡Listos! Cada uno con su coche";
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
    ? 'Aceleras solo. Toca <b>izquierda</b> o <b>derecha</b> para girar y <b>FRENO</b> (o los dos lados) para frenar. Saca a los rivales del ring, que encoge con el tiempo.'
    : 'Mejor con el móvil sobre la mesa. Cada jugador tiene <b>◀ ▶</b> en su esquina; pulsa <b>los dos a la vez</b> para frenar. ¡Saca al otro del ring!';
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
  buildMapPicker();
  buildLobby();
  setMode("1");
}
