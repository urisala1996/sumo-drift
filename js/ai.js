import { state } from './state.js';

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
    if (!best) {
      tx = 0; tz = 0;
    } else {
      const od = Math.hypot(best.x, best.z) || 1;
      tx = best.x + best.x / od * 3 * f.aggro + best.vx * .25;
      tz = best.z + best.z / od * 3 * f.aggro + best.vz * .25;
    }
  }
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
