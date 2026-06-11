import { CAR_R } from './config.js';
import { state, rng } from './state.js';
import { spawnSmoke } from './scene.js';

export function physicsCar(f, dt, steerTarget, brake) {
  if (f.falling) {
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
  f.steer += (steerTarget - f.steer) * Math.min(1, dt * 10);
  const speed0 = Math.hypot(f.vx, f.vz);
  f.heading += f.steer * cfg.turn * dt * Math.min(1, speed0 / 12);
  const fx = Math.sin(f.heading), fz = -Math.cos(f.heading);
  const acc = brake ? 0 : cfg.accel;
  f.vx += fx * acc * dt; f.vz += fz * acc * dt;
  let vF = f.vx * fx + f.vz * fz;
  const rx = -fz, rz = fx;
  let vL = f.vx * rx + f.vz * rz;
  vL *= Math.max(0, 1 - (brake ? cfg.grip * 1.6 : cfg.grip) * dt);
  vF *= Math.max(0, 1 - (brake ? 6.0 : .35) * dt);
  if (vF > cfg.topSpeed) vF = cfg.topSpeed;
  if (vF < 0) vF = 0;
  f.vx = fx * vF + rx * vL; f.vz = fz * vF + rz * vL;
  f.x += f.vx * dt; f.z += f.vz * dt;
  if (Math.hypot(f.x, f.z) > state.ringR + CAR_R * .4) { f.falling = true; f.vy = 2; }
  const drifting = Math.abs(vL) > 6;
  if (drifting && rng() < .7) spawnSmoke(f.x - fx * 1.8, f.z - fz * 1.8);
  if (brake && speed0 > 4 && rng() < .4) spawnSmoke(f.x - fx * 1.6, f.z - fz * 1.6, 0xbbb0d0);
  if (!f.isAI && f.ctrl === "p1") document.getElementById("driftTag").style.opacity = drifting ? 1 : 0;
  f.brake = !!brake;
  f.brakeLights.forEach(b => b.visible = !!brake);
  f.mesh.position.set(f.x, 0, f.z);
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
      }
    }
  }
}
