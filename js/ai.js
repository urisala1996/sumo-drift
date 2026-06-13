import { state } from './state.js';

// Vector de repulsión de los pozos cercanos (para que la CPU no se autodestruya).
function holeAvoid(f) {
  const map = state.curMap;
  let ax = 0, az = 0;
  if (map && map.holes) {
    for (const h of map.holes) {
      const dx = f.x - h.x, dz = f.z - h.z, d = Math.hypot(dx, dz), danger = h.r + 6;
      if (d < danger && d > 1e-3) { const w = (danger - d) / danger; ax += dx / d * w; az += dz / d * w; }
    }
  }
  return [ax, az];
}

export function aiSteer(f) {
  let tx, tz;
  if (Math.hypot(f.x, f.z) > state.ringR - 5) {
    tx = 0; tz = 0;
  } else {
    let best = null, bd = 1e9;
    for (const o of state.fighters) {
      if (o === f || !o.alive || o.falling) continue;
      const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    // Si hay un pickup cerca (y más cerca que el rival), ve a por él.
    let pk = null, pd = 1e9;
    if (state.powerups && !f.fx) {
      for (const p of state.pickups) {
        const d = (p.x - f.x) ** 2 + (p.z - f.z) ** 2;
        if (d < pd) { pd = d; pk = p; }
      }
    }
    if (pk && pd < 18 * 18 && pd < bd) {
      tx = pk.x; tz = pk.z;
    } else if (!best) {
      tx = 0; tz = 0;
    } else {
      const od = Math.hypot(best.x, best.z) || 1;
      tx = best.x + best.x / od * 3 * f.aggro + best.vx * .25;
      tz = best.z + best.z / od * 3 * f.aggro + best.vz * .25;
    }
  }
  const [ax, az] = holeAvoid(f);
  tx += ax * 12; tz += az * 12;
  const want = Math.atan2(tx - f.x, -(tz - f.z));
  let d = want - f.heading;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.max(-1, Math.min(1, d * 2.2));
}

export function aiBrake(f) {
  const d = Math.hypot(f.x, f.z);
  const outv = (f.x * f.vx + f.z * f.vz) / (d || 1);
  return d > state.ringR - 3.5 && outv > 5;
}
