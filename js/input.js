import { state } from './state.js';

function hit(t, el) {
  const r = el.getBoundingClientRect();
  return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom;
}

function readTouches(touches) {
  state.tc.p1 = { l: 0, r: 0, b: 0 };
  state.tc.p2 = { l: 0, r: 0, b: 0 };
  // Online y 1P locales comparten el esquema de un solo humano (mitades + freno).
  if (state.mode === "online" || state.players === 1) {
    const brk = document.getElementById("brk1");
    let halfL = false, halfR = false, btn = false;
    for (const t of touches) {
      if (hit(t, brk)) { btn = true; continue; }
      if (t.clientX < innerWidth / 2) halfL = true; else halfR = true;
    }
    const both = halfL && halfR;
    state.tc.p1.b = (btn || both) ? 1 : 0;
    state.tc.p1.l = (halfL && !both) ? 1 : 0;
    state.tc.p1.r = (halfR && !both) ? 1 : 0;
  } else {
    const e1L = document.getElementById("p1L"), e1R = document.getElementById("p1R"),
          e2L = document.getElementById("p2L"), e2R = document.getElementById("p2R");
    let a = 0, b = 0, cc = 0, d = 0;
    for (const t of touches) {
      if (hit(t, e1L)) a = 1;
      else if (hit(t, e1R)) b = 1;
      else if (hit(t, e2L)) cc = 1;
      else if (hit(t, e2R)) d = 1;
    }
    state.tc.p1.b = (a && b) ? 1 : 0;
    state.tc.p1.l = (a && !(a && b)) ? 1 : 0;
    state.tc.p1.r = (b && !(a && b)) ? 1 : 0;
    state.tc.p2.b = (cc && d) ? 1 : 0;
    state.tc.p2.l = (cc && !(cc && d)) ? 1 : 0;
    state.tc.p2.r = (d && !(cc && d)) ? 1 : 0;
  }
}

export function setupInput() {
  const canvas = document.getElementById("c");
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(ev =>
    canvas.addEventListener(ev, e => { e.preventDefault(); readTouches(e.touches); }, { passive: false })
  );
  addEventListener("keydown", e => {
    if (e.key === "a" || e.key === "A") state.kb.p1.l = 1;
    if (e.key === "d" || e.key === "D") state.kb.p1.r = 1;
    if (e.key === "s" || e.key === "S") state.kb.p1.b = 1;
    if (e.key === "ArrowLeft")  (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).l = 1;
    if (e.key === "ArrowRight") (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).r = 1;
    if (e.key === "ArrowDown")  (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).b = 1;
  });
  addEventListener("keyup", e => {
    if (e.key === "a" || e.key === "A") state.kb.p1.l = 0;
    if (e.key === "d" || e.key === "D") state.kb.p1.r = 0;
    if (e.key === "s" || e.key === "S") state.kb.p1.b = 0;
    if (e.key === "ArrowLeft")  (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).l = 0;
    if (e.key === "ArrowRight") (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).r = 0;
    if (e.key === "ArrowDown")  (state.mode === "online" || state.players === 1 ? state.kb.p1 : state.kb.p2).b = 0;
  });
}

export function showControls() {
  // En online cada dispositivo tiene UN humano, así que reutilizamos el esquema
  // de 1 jugador (mitades de pantalla + freno). El layout de 2 botones por
  // esquina solo se usa en el 2P local.
  const single = state.mode === "online" || state.players === 1;
  ["hintL", "hintR", "brk1", "brkHint"].forEach(id =>
    document.getElementById(id).style.display = single ? "" : "none"
  );
  ["p1L", "p1R", "p2L", "p2R", "p1Lbl", "p2Lbl"].forEach(id =>
    document.getElementById(id).style.display = single ? "none" : ""
  );
}
