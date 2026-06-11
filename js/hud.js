import { WINS_NEEDED } from './config.js';
import { state } from './state.js';

export function buildScoreUI() {
  const box = document.getElementById("score");
  box.innerHTML = "";
  state.fighters.forEach((f, idx) => {
    const hex = "#" + f.cfg.color.toString(16).padStart(6, "0");
    const div = document.createElement("div");
    div.className = "scoreCar";
    div.innerHTML =
      `<div class="scoreTop"><div class="scoreDot" style="background:${hex}"></div><div class="scoreTag">${f.tag}</div></div>` +
      `<div class="pips">` +
      Array.from({ length: WINS_NEEDED }, (_, k) =>
        `<div class="pip" data-i="${idx}" data-k="${k}"></div>`
      ).join("") +
      `</div>`;
    box.appendChild(div);
  });
  refreshScoreUI();
}

export function refreshScoreUI() {
  document.querySelectorAll(".pip").forEach(p => {
    const f = state.fighters[+p.dataset.i];
    p.classList.toggle("on", f && f.wins > +p.dataset.k);
  });
}

export function banner(txt, color) {
  const b = document.getElementById("banner");
  b.textContent = txt;
  b.style.color = color || "var(--paper)";
  b.style.opacity = 1;
  // Se guarda para que el host online lo sincronice por meta (ver net.writeFrame).
  state.bannerText = txt;
  state.bannerColor = color || "var(--paper)";
}

export function hideBanner() {
  document.getElementById("banner").style.opacity = 0;
  state.bannerText = "";
  state.bannerColor = "";
}
