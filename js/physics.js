import { CAR_R } from './config.js';
import { RAMP_LEN, RAMP_RISE, RAMP_WIDTH } from './maps.js';
import { state, rng } from './state.js';
import { spawnSmoke } from './scene.js';
import * as sfx from './audio.js';

const GRAV = 42;          // gravedad de los saltos (rampa)
const RAMP_HALF_L = RAMP_LEN / 2, RAMP_HALF_W = RAMP_WIDTH / 2;

// ¿Está el coche sobre la huella de alguna rampa? Devuelve la rampa o null.
function rampAt(f, map) {
  for (const r of (map.ramps || [])) {
    const along = (f.x - r.x) * r.dx + (f.z - r.z) * r.dz;       // eje cuesta arriba
    const across = (f.x - r.x) * -r.dz + (f.z - r.z) * r.dx;     // eje transversal
    if (Math.abs(along) <= RAMP_HALF_L && Math.abs(across) <= RAMP_HALF_W) return r;
  }
  return null;
}

// ¿El centro del coche está sobre un pozo? (en suelo = caída terminal)
function overHole(f, map) {
  for (const h of (map.holes || [])) {
    if (Math.hypot(f.x - h.x, f.z - h.z) < h.r) return true;
  }
  return false;
}

// Empuja el coche fuera de pilares (círculo) y muros (caja rotada) y refleja su
// velocidad. Mismo estilo de impulso que las colisiones coche-coche.
export function resolveObstacles(f, map) {
  for (const p of (map.pillars || [])) {
    const dx = f.x - p.x, dz = f.z - p.z, d = Math.hypot(dx, dz), minD = CAR_R + p.r;
    if (d < minD && d > 1e-6) {
      const nx = dx / d, nz = dz / d;
      f.x += nx * (minD - d); f.z += nz * (minD - d);
      const vn = f.vx * nx + f.vz * nz;
      if (vn < 0) {
        const e = .35; f.vx -= (1 + e) * vn * nx; f.vz -= (1 + e) * vn * nz;
        spawnSmoke(f.x - nx * CAR_R, f.z - nz * CAR_R, 0xffd9a0);
        sfx.thud(Math.min(1, -vn / 25));
      }
    }
  }
  for (const w of (map.walls || [])) {
    const c = Math.cos(-w.rot), s = Math.sin(-w.rot);
    const lx = (f.x - w.x) * c - (f.z - w.z) * s;   // punto en el marco local del muro
    const lz = (f.x - w.x) * s + (f.z - w.z) * c;
    const hx = w.len / 2, hz = w.thick / 2;
    const cx = Math.max(-hx, Math.min(hx, lx)), cz = Math.max(-hz, Math.min(hz, lz));
    let dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
    if (d > 1e-6 && d < CAR_R) {
      const c2 = Math.cos(w.rot), s2 = Math.sin(w.rot);
      const nx = (dx / d) * c2 - (dz / d) * s2;       // normal de vuelta a mundo
      const nz = (dx / d) * s2 + (dz / d) * c2;
      f.x += nx * (CAR_R - d); f.z += nz * (CAR_R - d);
      const vn = f.vx * nx + f.vz * nz;
      if (vn < 0) {
        const e = .3; f.vx -= (1 + e) * vn * nx; f.vz -= (1 + e) * vn * nz;
        spawnSmoke(f.x - nx * CAR_R, f.z - nz * CAR_R, 0xffd9a0);
        sfx.thud(Math.min(1, -vn / 25));
      }
    }
  }

  // Rampas: colisión lateral (cara frontal/trasera y flancos del cuño).
  // Un coche que no venga con suficiente velocidad cuesta arriba rebota contra
  // la cara del cuño en lugar de atravesarlo.
  for (const r of (map.ramps || [])) {
    // Marco local de la rampa: eje +X = cuesta arriba (dx,dz), eje +Z = flanco.
    const along  =  (f.x - r.x) * r.dx  + (f.z - r.z) * r.dz;
    const across = -(f.x - r.x) * r.dz  + (f.z - r.z) * r.dx;

    // ¿Está el coche en la huella XZ de la rampa?
    if (Math.abs(along) > RAMP_HALF_L + CAR_R || Math.abs(across) > RAMP_HALF_W + CAR_R) continue;

    // Altura de la superficie inclinada en este punto (0 en la base, RAMP_RISE en la cima).
    const surfaceH = Math.max(0, ((along + RAMP_HALF_L) / RAMP_LEN) * RAMP_RISE);

    // Colisión lateral: cara frontal (high end) / trasera (low end) / flancos.
    // Solo aplicamos si el coche está por debajo de la altura de la rampa
    // (si está encima, la rampa ya lo lanzó o está saltando).
    if (f.y < surfaceH) {
      // Cara frontal (along > RAMP_HALF_L - CAR_R): empuja hacia atrás.
      if (along > RAMP_HALF_L - CAR_R && along < RAMP_HALF_L + CAR_R && Math.abs(across) < RAMP_HALF_W) {
        const pen = RAMP_HALF_L + CAR_R - along;
        f.x -= r.dx * pen; f.z -= r.dz * pen;
        const vn = f.vx * r.dx + f.vz * r.dz;
        if (vn > 0) { const e = .25; f.vx -= (1 + e) * vn * r.dx; f.vz -= (1 + e) * vn * r.dz; }
        spawnSmoke(f.x, f.z, 0xffd9a0);
      }
      // Flancos (across ≈ ±RAMP_HALF_W): empuja lateralmente.
      if (Math.abs(across) > RAMP_HALF_W - CAR_R && Math.abs(across) < RAMP_HALF_W + CAR_R && Math.abs(along) < RAMP_HALF_L) {
        const sn = Math.sign(across), pen = RAMP_HALF_W + CAR_R - Math.abs(across);
        const nx = -r.dz * sn, nz = r.dx * sn;
        f.x += nx * pen; f.z += nz * pen;
        const vn = f.vx * nx + f.vz * nz;
        if (vn < 0) { const e = .25; f.vx -= (1 + e) * vn * nx; f.vz -= (1 + e) * vn * nz; }
      }
    }
  }
}

// Comprueba si el coche debe caer (pozo interior o borde del ring).
function fallCheck(f, map) {
  if ((map && overHole(f, map)) || Math.hypot(f.x, f.z) > state.ringR + CAR_R * .4) {
    f.falling = true; f.air = false; f.vy = 2;
    sfx.whoosh();
  }
}

export function physicsCar(f, dt, steerTarget, brake) {
  if (f.falling) {
    f.brakeT = 0;
    f.vy -= 55 * dt; f.y += f.vy * dt;
    f.x += f.vx * dt; f.z += f.vz * dt;
    f.spin += dt * 5;
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.z = f.spin * .7;
    f.mesh.rotation.x = f.spin * .4;
    if (f.y < -40) { f.alive = false; f.falling = false; f.mesh.visible = false; }
    return;
  }
  const cfg = f.cfg;
  const map = state.curMap;

  // ----- En el aire (salto de rampa): vuelo balístico -----
  if (f.air) {
    f.brakeT = 0;
    f.steer += (steerTarget - f.steer) * Math.min(1, dt * 10);
    f.heading += f.steer * cfg.turn * dt * 0.4;   // control aéreo leve
    f.x += f.vx * dt; f.z += f.vz * dt;
    f.vy -= GRAV * dt; f.y += f.vy * dt;
    if (map) resolveObstacles(f, map);
    if (f.y <= 0) {                                // aterrizaje
      f.y = 0; f.vy = 0; f.air = false;
      fallCheck(f, map);
      if (rng() < .8) for (let k = 0; k < 3; k++) spawnSmoke(f.x, f.z, 0xbbb0d0);
    }
    f.brake = !!brake;
    f.brakeLights.forEach(b => b.visible = false);
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.set(0, -f.heading + Math.PI, -f.steer * .12);
    return;
  }

  // ----- En el suelo (modelo de conducción original) -----
  f.steer += (steerTarget - f.steer) * Math.min(1, dt * 8);
  const speed0 = Math.hypot(f.vx, f.vz);
  f.heading += f.steer * cfg.turn * dt * Math.min(1, speed0 / 7);
  const fx = Math.sin(f.heading), fz = -Math.cos(f.heading);

  // Acumula tiempo de freno para activar marcha atrás tras 2s.
  if (brake) { f.brakeT += dt; } else { f.brakeT = 0; }
  const reversing = brake && f.brakeT > 2.0;
  const maxReverse = cfg.topSpeed * 0.4;

  const acc = (brake && !reversing) ? 0 : (!brake ? cfg.accel : 0);
  f.vx += fx * acc * dt; f.vz += fz * acc * dt;
  let vF = f.vx * fx + f.vz * fz;
  const rx = -fz, rz = fx;
  let vL = f.vx * rx + f.vz * rz;
  vL *= Math.max(0, 1 - (brake ? cfg.grip * 1.6 : cfg.grip) * dt);

  if (reversing) {
    // Empuja hacia atrás activamente.
    vF -= cfg.accel * 0.6 * dt;
    if (vF < -maxReverse) vF = -maxReverse;
  } else {
    vF *= Math.max(0, 1 - (brake ? 6.0 : .35) * dt);
    if (vF > cfg.topSpeed) vF = cfg.topSpeed;
    if (vF < 0) vF = 0;
  }
  f.vx = fx * vF + rx * vL; f.vz = fz * vF + rz * vL;
  f.x += f.vx * dt; f.z += f.vz * dt;

  if (map) resolveObstacles(f, map);

  // Rampa: si la cruzo con suficiente velocidad cuesta arriba, salto.
  if (map) {
    const r = rampAt(f, map);
    if (r && (f.vx * r.dx + f.vz * r.dz) > 3) {
      f.air = true; f.vy = r.launch;
      f.vx += r.dx * 6; f.vz += r.dz * 6;
      sfx.jump();
    }
  }

  if (!f.air) fallCheck(f, map);

  const drifting = Math.abs(vL) > 6;
  if (drifting && rng() < .7) spawnSmoke(f.x - fx * 1.8, f.z - fz * 1.8);
  if (brake && speed0 > 4 && rng() < .4) spawnSmoke(f.x - fx * 1.6, f.z - fz * 1.6, 0xbbb0d0);
  f.brake = !!brake;
  f.brakeLights.forEach(b => b.visible = !!brake);
  f.mesh.position.set(f.x, f.y, f.z);
  f.mesh.rotation.set(0, -f.heading + Math.PI, -f.steer * .12);
  f.wheels[2].rotation.y = f.steer * .45;
  f.wheels[3].rotation.y = f.steer * .45;
}

export function collisions() {
  for (let i = 0; i < state.fighters.length; i++) {
    for (let j = i + 1; j < state.fighters.length; j++) {
      const a = state.fighters[i], b = state.fighters[j];
      if (!a.alive || !b.alive || a.falling || b.falling) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > CAR_R * 2 || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d, overlap = CAR_R * 2 - d;
      const ma = a.cfg.mass, mb = b.cfg.mass, mt = ma + mb;
      a.x -= nx * overlap * (mb / mt); a.z -= nz * overlap * (mb / mt);
      b.x += nx * overlap * (ma / mt); b.z += nz * overlap * (ma / mt);
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const e = 1.35, jimp = -(1 + e) * rel / (1 / ma + 1 / mb);
        a.vx -= jimp * nx / ma; a.vz -= jimp * nz / ma;
        b.vx += jimp * nx / mb; b.vz += jimp * nz / mb;
        const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
        for (let k = 0; k < 4; k++) spawnSmoke(cx, cz, 0xffd9a0);
        sfx.thud(Math.min(1, jimp / 30));
      }
    }
  }
}
