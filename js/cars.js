import * as THREE from 'three';
import { CARS, RING_R0 } from './config.js';
import { state, rng } from './state.js';
import { buildScoreUI } from './hud.js';
import { net, MAX_PLAYERS, playersList } from './net.js';

// Crea el objeto luchador con todos los campos (incluidos los de interpolación
// de red `t*`, que los clientes usan como objetivo al que acercar el render).
function makeFighter(r) {
  const m = makeCarMesh(CARS[r.ci]);
  return {
    cfg: CARS[r.ci], ctrl: r.ctrl, tag: r.tag,
    slot: r.slot, clientId: r.clientId || null,
    mesh: m.mesh, wheels: m.wheels, brakeLights: m.brakeLights,
    isAI: r.ctrl === "ai", wins: 0,
    x: 0, z: 0, vx: 0, vz: 0, heading: 0, steer: 0,
    alive: true, falling: false, air: false, y: 0, vy: 0, spin: 0, brake: false, brakeT: 0,
    aggro: .6 + rng() * .5,
    // objetivos de interpolación para clientes online
    tx: 0, tz: 0, ty: 0, theading: 0, tsteer: 0,
  };
}

// Selecciona el coche libre de menor índice que no esté en `taken`.
function lowestFreeCar(taken) {
  for (let i = 0; i < CARS.length; i++) if (!taken.has(i)) return i;
  return 0;
}

export function makeCarMesh(cfg) {
  const g = new THREE.Group(), wheels = [];
  const bodyMat = new THREE.MeshLambertMaterial({ color: cfg.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x241a44 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, .9, 4.4), bodyMat);
  body.position.y = .85; body.castShadow = true; g.add(body);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, .8, 2.0), darkMat);
  cab.position.set(0, 1.6, -.2); cab.castShadow = true; g.add(cab);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.6, .18, .6), darkMat);
  spoiler.position.set(0, 1.5, 2.0); g.add(spoiler);

  const s1 = new THREE.Mesh(new THREE.BoxGeometry(.15, .5, .15), darkMat);
  s1.position.set(-.9, 1.2, 2.0); g.add(s1);
  const s2 = s1.clone(); s2.position.x = .9; g.add(s2);

  const wGeo = new THREE.BoxGeometry(.5, .9, .9);
  [[-1.25, -1.4], [1.25, -1.4], [-1.25, 1.5], [1.25, 1.5]].forEach(p => {
    const w = new THREE.Mesh(wGeo, darkMat);
    w.position.set(p[0], .45, p[1]); w.castShadow = true; g.add(w); wheels.push(w);
  });

  const blMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const bl1 = new THREE.Mesh(new THREE.BoxGeometry(.55, .32, .18), blMat);
  bl1.position.set(-.7, .85, 2.25); bl1.visible = false; g.add(bl1);
  const bl2 = bl1.clone(); bl2.position.x = .7; g.add(bl2);

  state.scene.add(g);
  return { mesh: g, wheels, brakeLights: [bl1, bl2] };
}

// Construye el roster de la sala online a partir de net.players (sincronizado)
// más relleno de CPU si fillAI está activo. Host y clientes derivan el MISMO
// roster porque ambos parten de los mismos datos sincronizados.
function onlineRoster() {
  const humans = playersList(); // ordenado por slot
  const taken = new Set(humans.map(p => p.car));
  const roster = humans.map(p => ({
    ci: p.car, ctrl: "net", slot: p.slot, clientId: p.clientId,
    tag: p.name || `P${p.slot + 1}`,
  }));
  const fill = net.meta.fillAI ?? net.fillAI;
  if (fill) {
    const used = new Set(humans.map(p => p.slot));
    for (let s = 0; s < MAX_PLAYERS; s++) {
      if (used.has(s)) continue;
      const ci = lowestFreeCar(taken);
      taken.add(ci);
      roster.push({ ci, ctrl: "ai", slot: s, tag: "CPU" });
    }
  }
  return roster.sort((a, b) => a.slot - b.slot);
}

export function setupFighters() {
  state.fighters.forEach(f => state.scene.remove(f.mesh));
  state.fighters = [];
  let roster;
  if (state.mode === "online") {
    roster = onlineRoster();
  } else if (state.players === 1) {
    const others = [0, 1, 2].filter(i => i !== state.selP1);
    roster = [
      { ci: state.selP1, ctrl: "p1", slot: 0, tag: "TÚ" },
      { ci: others[0],   ctrl: "ai", slot: 1, tag: "CPU" },
      { ci: others[1],   ctrl: "ai", slot: 2, tag: "CPU" },
    ];
  } else {
    const other = [0, 1, 2].find(i => i !== state.selP1 && i !== state.selP2);
    roster = [
      { ci: state.selP1, ctrl: "p1", slot: 0, tag: "P1" },
      { ci: state.selP2, ctrl: "p2", slot: 1, tag: "P2" },
      { ci: other,       ctrl: "ai", slot: 2, tag: "CPU" },
    ];
  }
  roster.forEach(r => state.fighters.push(makeFighter(r)));
  buildScoreUI();
}

export function placeFighters() {
  const n = state.fighters.length;
  state.fighters.forEach((f, i) => {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
    f.x = Math.cos(a) * RING_R0 * .55;
    f.z = Math.sin(a) * RING_R0 * .55;
    f.vx = 0; f.vz = 0; f.steer = 0;
    f.heading = Math.atan2(-f.x, f.z);
    f.alive = true; f.falling = false; f.air = false; f.y = 0; f.vy = 0; f.spin = 0; f.brake = false; f.brakeT = 0;
    // objetivos de interpolación = posición inicial (evita "saltos" en clientes)
    f.tx = f.x; f.tz = f.z; f.ty = 0; f.theading = f.heading; f.tsteer = 0;
    f.mesh.visible = true;
    f.mesh.position.set(f.x, 0, f.z);
    f.mesh.rotation.set(0, -f.heading + Math.PI, 0);
    f.brakeLights.forEach(b => b.visible = false);
  });
}
