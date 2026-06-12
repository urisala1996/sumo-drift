import { RING_RMIN, SHRINK_T, WINS_NEEDED, SUDDEN_DEATH_T } from './config.js';
import { state, eff } from './state.js';
import { initThree, setRing, updateSmoke, updateCamera } from './scene.js';
import { setupFighters, placeFighters } from './cars.js';
import { setupInput } from './input.js';
import { aiSteer, aiBrake } from './ai.js';
import { physicsCar, collisions } from './physics.js';
import { banner, hideBanner, showCountdown, hideCountdown } from './hud.js';
import { startRound, endRound, endMatch, goToMenuFromOnline } from './rounds.js';
import { buildMenu } from './menu.js';
import { net, writeFrame, writeInput, ROOM_TTL } from './net.js';

const SEND_HZ = 20;

// Resuelve el input de un luchador según quién lo controla.
function resolveInput(f, online) {
  if (f.isAI) return { st: aiSteer(f), br: aiBrake(f) };
  let e;
  if (online) {
    e = f.clientId === net.clientId ? eff("p1") : (state.remoteInputs[f.clientId] || { l: 0, r: 0, b: 0 });
  } else {
    e = eff(f.ctrl);
  }
  return { st: (e.l ? -1 : 0) + (e.r ? 1 : 0), br: !!e.b };
}

// El host publica transformaciones + meta a ~20Hz (no cada frame).
function maybeSendFrame(dt) {
  state.netSendAcc += dt;
  if (state.netSendAcc < 1 / SEND_HZ) return;
  state.netSendAcc = 0;
  writeFrame(state.fighters, {
    phase: state.phase,
    round: state.round,
    ring: Math.round(state.ringR / state.ringR0 * 100),
    ringSize: state.ringSize,
    sd: state.sd,
    banner: state.bannerText || "",
    bannerColor: state.bannerColor || "",
  });
}

// Cliente: suaviza el render de un coche hacia el objetivo recibido del host.
function lerpFighter(f, dt) {
  const k = Math.min(1, dt * 12);
  f.x += (f.tx - f.x) * k;
  f.z += (f.tz - f.z) * k;
  f.y += (f.ty - f.y) * k;
  let dh = f.theading - f.heading;
  while (dh > Math.PI) dh -= 2 * Math.PI;
  while (dh < -Math.PI) dh += 2 * Math.PI;
  f.heading += dh * k;
  f.steer += (f.tsteer - f.steer) * k;
  if (!f.alive && !f.falling) { f.mesh.visible = false; return; }
  f.mesh.visible = true;
  if (f.falling) {
    f.spin += dt * 5;
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.z = f.spin * .7;
    f.mesh.rotation.x = f.spin * .4;
  } else {
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.set(0, -f.heading + Math.PI, -f.steer * .12);
    f.wheels[2].rotation.y = f.steer * .45;
    f.wheels[3].rotation.y = f.steer * .45;
  }
  f.brakeLights.forEach(b => b.visible = !!f.brake);
}

// Cliente online: enviar mi input y renderizar el estado del host.
function clientFrame(dt) {
  const e = eff("p1");
  const inp = { l: e.l ? 1 : 0, r: e.r ? 1 : 0, b: e.b ? 1 : 0 };
  const last = state._lastInp;
  if (!last || inp.l !== last.l || inp.r !== last.r || inp.b !== last.b) {
    writeInput(inp);
    state._lastInp = inp;
  }
  if (state.matchActive) {
    // Interpola el tamaño del ring hacia el objetivo del host: el host envía el
    // tamaño a ~20Hz y aquí se suaviza por frame para que no se vea el "tick".
    if (state.ringTarget != null && Math.abs(state.ringTarget - state.ringR) > 0.001) {
      setRing(state.ringR + (state.ringTarget - state.ringR) * Math.min(1, dt * 7));
    }
    for (const f of state.fighters) lerpFighter(f, dt);
    let warn = false;
    for (const f of state.fighters) {
      if (f.slot === net.slot && f.alive && !f.falling && Math.hypot(f.x, f.z) > state.ringR - 5) warn = true;
    }
    document.getElementById("warnTag").style.opacity = warn ? 1 : 0;
  }
  updateSmoke(dt);
  updateCamera(dt);
}

function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (t - state.lastT) / 1000 || .016);
  state.lastT = t;

  for (const r of state.scene.userData.rocks) {
    r.userData.bob += dt;
    r.position.y = r.userData.baseY + Math.sin(r.userData.bob) * .8;
    r.rotation.y += dt * .2;
  }

  const online = state.mode === "online";
  const host = online && net.isHost;

  // ----- Cliente online: solo renderiza el estado autoritativo del host -----
  if (online && !net.isHost) {
    // Si el host lleva demasiado tiempo sin latir, dio la sala por perdida.
    if (state.hostSeenAt && Date.now() - state.hostSeenAt > ROOM_TTL) {
      goToMenuFromOnline("El host abandonó la sala.");
      return;
    }
    clientFrame(dt);
    state.renderer.render(state.scene, state.camera);
    return;
  }

  // ----- Local o host: simulación autoritativa -----
  // Si un jugador remoto se desconecta a media partida, su coche pasa a CPU.
  if (host) {
    for (const f of state.fighters) {
      if (f.ctrl === "net" && f.clientId !== net.clientId && !net.players[f.clientId]) {
        f.ctrl = "ai"; f.isAI = true;
      }
    }
  }

  if (state.phase === "count") {
    state.phaseT += dt;
    const n = 3 - Math.floor(state.phaseT);
    banner(n > 0 ? String(n) : "GO!", "var(--sun)");
    updateCamera(dt);
    if (state.phaseT >= 3.6) { hideBanner(); state.phase = "play"; }

  } else if (state.phase === "play") {
    const r0 = state.ringR0;
    state.playT += dt;
    state.sd = -1;   // por defecto sin muerte súbita (la rama de abajo lo activa)
    setRing(Math.max(RING_RMIN, r0 - (r0 - RING_RMIN) * (state.playT / SHRINK_T)));
    document.getElementById("ringLbl").textContent = "RING " + Math.round(state.ringR / r0 * 100) + "%";
    for (const f of state.fighters) {
      if (!f.alive) continue;
      const { st, br } = resolveInput(f, online);
      physicsCar(f, dt, st, br);
    }
    collisions();
    let warn = false;
    for (const f of state.fighters) {
      const localHuman = online ? (f.clientId === net.clientId) : !f.isAI;
      if (localHuman && f.alive && !f.falling && Math.hypot(f.x, f.z) > state.ringR - 5) warn = true;
    }
    document.getElementById("warnTag").style.opacity = warn ? 1 : 0;
    updateSmoke(dt);
    updateCamera(dt);
    const alive = state.fighters.filter(f => f.alive && !f.falling);
    const fallingStill = state.fighters.some(f => f.falling);
    if (alive.length <= 1 && !fallingStill) {
      endRound(alive[0] || null);
    } else if (state.ringR <= RING_RMIN + 0.01) {
      // Muerte súbita: el ring está al mínimo, cuenta atrás hasta empate.
      state.sdT += dt;
      const left = Math.ceil(SUDDEN_DEATH_T - state.sdT);
      state.sd = Math.max(0, left);
      showCountdown(left);
      if (state.sdT >= SUDDEN_DEATH_T) { hideCountdown(); state.sd = -1; endRound(null); }
    }

  } else if (state.phase === "roundend") {
    state.phaseT += dt;
    for (const f of state.fighters) if (f.falling) physicsCar(f, dt, 0, false);
    updateSmoke(dt);
    updateCamera(dt);
    if (state.phaseT > 2.2) {
      hideBanner();
      const champ = state.fighters.find(f => f.wins >= WINS_NEEDED);
      if (champ) endMatch(champ);
      else { state.round++; startRound(); }
    }

  } else {
    updateSmoke(dt);
  }

  if (host && state.matchActive) maybeSendFrame(dt);
  state.renderer.render(state.scene, state.camera);
}

initThree();
setupInput();
buildMenu();
setupFighters();
placeFighters();
requestAnimationFrame(loop);
