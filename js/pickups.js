// ============================================================
//  Power-ups (roadmap #1) — host scheduler + effects + shared renderer
// ============================================================
// The HOST owns gameplay: it spawns pickups (`spawnPickups`), detects collection
// (`collectPickups`) and decays effects (`tickEffects`). Effects manifest in the
// synced car transforms, so CLIENTS only render: they overwrite `state.pickups`
// from the network and call `renderPickups` like the host does. The effect hooks
// (`boostFactor`/`consumeShield`/`ramBonus`) are imported by physics.js.

import * as THREE from 'three';
import {
  PK, PK_DEFS, PK_TYPES, PK_R, PK_SPAWN_T, PK_MAX, PK_LIFE,
  BOOST_MULT, RAM_E, CAR_R,
} from './config.js';
import { state, rng } from './state.js';
import { spawnSmoke } from './scene.js';
import * as sfx from './audio.js';

// ---------- Host: spawning ----------
function badSpot(x, z, map) {
  if (map) {
    for (const h of (map.holes || [])) if (Math.hypot(x - h.x, z - h.z) < h.r + 2) return true;
    for (const p of (map.pillars || [])) if (Math.hypot(x - p.x, z - p.z) < p.r + 2) return true;
  }
  for (const pk of state.pickups) if (Math.hypot(x - pk.x, z - pk.z) < PK_R * 3) return true;
  return false;
}

function findSpawnPos() {
  const map = state.curMap;
  const maxR = Math.max(4.5, state.ringR - 4);
  for (let tries = 0; tries < 14; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 4 + rng() * (maxR - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!badSpot(x, z, map)) return { x, z };
  }
  return null;
}

// Host only: decay lifetimes, drop expired, and occasionally spawn a new pickup.
export function spawnPickups(dt) {
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    state.pickups[i].t -= dt;
    if (state.pickups[i].t <= 0) state.pickups.splice(i, 1);
  }
  state.pkSpawnAcc += dt;
  if (state.pkSpawnAcc < PK_SPAWN_T) return;
  state.pkSpawnAcc = 0;
  if (state.pickups.length >= PK_MAX) return;
  const pos = findSpawnPos();
  if (!pos) return;
  const type = PK_TYPES[Math.floor(rng() * PK_TYPES.length)];
  state.pickups.push({ id: state.pkNextId++, type, x: pos.x, z: pos.z, t: PK_LIFE });
}

// Host only: a car overlapping a pickup grabs its effect.
export function collectPickups() {
  if (!state.pickups.length) return;
  for (const f of state.fighters) {
    if (!f.alive || f.falling) continue;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      if (Math.hypot(f.x - pk.x, f.z - pk.z) < CAR_R + PK_R) {
        f.fx = pk.type; f.fxT = PK_DEFS[pk.type].dur;
        state.pickups.splice(i, 1);
        for (let k = 0; k < 5; k++) spawnSmoke(f.x, f.z, PK_DEFS[f.fx].color);
        sfx.pickup();
      }
    }
  }
}

// Host only: count down active effects; clear when they run out.
export function tickEffects(dt) {
  for (const f of state.fighters) {
    if (f.fxT > 0) {
      f.fxT -= dt;
      if (f.fxT <= 0) { f.fxT = 0; f.fx = 0; }
    }
  }
}

// ---------- Effect hooks (used by physics.js) ----------
export function boostFactor(f) { return f.fx === PK.BOOST ? BOOST_MULT : 1; }

export function consumeShield(f) {
  if (f.fx === PK.SHIELD) { f.fx = 0; f.fxT = 0; return true; }
  return false;
}

// Extra restitution if either car holds RAM; consumes it on whoever does.
export function ramBonus(a, b) {
  let e = 0;
  if (a.fx === PK.RAM) { a.fx = 0; a.fxT = 0; e += RAM_E; }
  if (b.fx === PK.RAM) { b.fx = 0; b.fxT = 0; e += RAM_E; }
  return e;
}

// ---------- Shared renderer (host + client) ----------
let pkGeo = null;
export function renderPickups(dt) {
  const seen = new Set();
  for (const pk of state.pickups) {
    seen.add(pk.id);
    let m = state.pkMeshes[pk.id];
    if (!m) {
      if (!pkGeo) pkGeo = new THREE.OctahedronGeometry(1.15);
      m = new THREE.Mesh(pkGeo, new THREE.MeshBasicMaterial({ color: PK_DEFS[pk.type].color }));
      m.userData.spin = rng() * 6.28;
      state.scene.add(m);
      state.pkMeshes[pk.id] = m;
    }
    m.userData.spin += dt * 2.2;
    m.position.set(pk.x, 2.2 + Math.sin(m.userData.spin * 1.5) * 0.35, pk.z);
    m.rotation.set(0.4, m.userData.spin, 0);
  }
  // Remove meshes whose pickup is gone (collected/expired).
  for (const id in state.pkMeshes) {
    if (!seen.has(+id)) {
      const m = state.pkMeshes[id];
      state.scene.remove(m);
      if (m.material) m.material.dispose();   // geometry is shared — don't dispose
      delete state.pkMeshes[id];
    }
  }
  // Holder auras: color + gentle pulse from each fighter's active effect.
  const pulse = 0.4 + 0.22 * (0.5 + 0.5 * Math.sin(performance.now() / 120));
  for (const f of state.fighters) {
    if (!f.aura) continue;
    if (f.fx > 0 && f.alive && !f.falling) {
      f.aura.visible = true;
      f.aura.material.color.setHex(PK_DEFS[f.fx].color);
      f.aura.material.opacity = pulse;
    } else {
      f.aura.visible = false;
    }
  }
}

// Remove all pickup meshes + reset state (round/match reset). On clients
// `state.pickups` is refilled from the network next frame if the match is live.
export function clearPickups() {
  for (const id in state.pkMeshes) {
    const m = state.pkMeshes[id];
    state.scene.remove(m);
    if (m.material) m.material.dispose();
  }
  state.pkMeshes = {};
  state.pickups = [];
  state.pkSpawnAcc = 0;
  for (const f of state.fighters) { if (f.aura) f.aura.visible = false; }
}
