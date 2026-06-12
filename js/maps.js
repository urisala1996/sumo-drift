import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Definición de mapas. Cada mapa describe sus obstáculos en COORDENADAS DE MUNDO
// (no se escalan con el ring, que encoge por encima de ellos). El ring base mide
// RING_R0 = 36 y encoge hasta RMIN = 10, así que los obstáculos viven dentro de
// ~r ≤ 14 para seguir en juego; los pozos evitan las 4 plazas de salida (r≈19.8
// en los ejes cardinales).
//
// Tipos de obstáculo:
//   pillars: { x, z, r }            -> bumper cilíndrico (los coches rebotan)
//   walls:   { x, z, len, thick, rot } -> bumper rectangular (rot en radianes)
//   ramps:   { x, z, dx, dz, launch }  -> rampa; (dx,dz)=dir cuesta arriba (unit),
//                                         launch = impulso vertical al saltar
//   holes:   { x, z, r }            -> pozo; caer en él = fuera
// ---------------------------------------------------------------------------

// Crea una rampa con la dirección cuesta arriba apuntando al centro (0,0).
function rampToCenter(x, z, launch = 14) {
  const m = Math.hypot(x, z) || 1;
  return { x, z, dx: -x / m, dz: -z / m, launch };
}

// Anillo de 6 pilares alrededor del centro, radio R.
function pillarRing(R, r) {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3;
    out.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, r });
  }
  return out;
}

const D = 13 / Math.SQRT2; // ≈9.19, esquinas diagonales a r≈13

export const MAPS = [
  {
    id: "clasico", name: "CLASSIC", floor: 0x3d3170,
    desc: "Plain shrinking disc. The original.",
    pillars: [], walls: [], ramps: [], holes: [],
  },
  {
    id: "pilares", name: "PILLARS", floor: 0x3a4a72,
    desc: "Central pillar and bumpers: ricochet rivals into the void.",
    pillars: [{ x: 0, z: 0, r: 3.0 }, ...pillarRing(12, 1.7)],
    walls: [], ramps: [], holes: [],
  },
  {
    id: "rampas", name: "RAMPS", floor: 0x6b4a2e,
    desc: "Four ramps in an X: jump… or fly out of the ring.",
    pillars: [], walls: [], holes: [],
    ramps: [
      rampToCenter(7.78, 7.78), rampToCenter(-7.78, 7.78),
      rampToCenter(-7.78, -7.78), rampToCenter(7.78, -7.78),
    ],
  },
  {
    id: "pozos", name: "PITS", floor: 0x2a2342,
    desc: "Central crater and pits: one wrong move and you fall.",
    pillars: [], walls: [], ramps: [],
    holes: [
      { x: 0, z: 0, r: 4.5 },
      { x: D, z: D, r: 2.4 }, { x: -D, z: D, r: 2.4 },
      { x: -D, z: -D, r: 2.4 }, { x: D, z: -D, r: 2.4 },
    ],
  },
  {
    id: "muralla", name: "WALLS", floor: 0x3a5145,
    desc: "Wall maze: tight lanes and ricochets.",
    pillars: [], ramps: [], holes: [],
    walls: [
      // molinillo central
      { x: 5, z: 3, len: 8, thick: 1.2, rot: Math.PI / 2 },
      { x: -3, z: 5, len: 8, thick: 1.2, rot: 0 },
      { x: -5, z: -3, len: 8, thick: 1.2, rot: Math.PI / 2 },
      { x: 3, z: -5, len: 8, thick: 1.2, rot: 0 },
      // muros diagonales exteriores
      { x: 9.2, z: 9.2, len: 7, thick: 1.2, rot: Math.PI / 4 },
      { x: -9.2, z: -9.2, len: 7, thick: 1.2, rot: Math.PI / 4 },
    ],
  },
  {
    id: "caos", name: "CHAOS", floor: 0x5a2f52,
    desc: "A bit of everything: pillars, ramps and a central pit.",
    walls: [],
    pillars: [{ x: 10, z: -5, r: 1.8 }, { x: -10, z: 5, r: 1.8 }],
    ramps: [rampToCenter(-9, -9), rampToCenter(9, 9)],
    holes: [{ x: 0, z: 0, r: 3.5 }],
  },
];

export const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));

// Huella de la rampa (debe coincidir entre la geometría y la física de salto).
export const RAMP_LEN = 8, RAMP_RISE = 2.6, RAMP_WIDTH = 5;

// ---------------------------------------------------------------------------
// Geometría. Añade las mallas de los obstáculos de `map` a `group`. Comparte
// paleta con el ring del juego (scene.js). Es pura: no toca el estado global,
// así la usan por igual el juego y la página de previsualización.
// ---------------------------------------------------------------------------
export function buildMapFeatures(group, map) {
  const matPillar = new THREE.MeshLambertMaterial({ color: 0x5a4d95 });
  const matWall = new THREE.MeshLambertMaterial({ color: 0x4a3d85 });
  const matCap = new THREE.MeshLambertMaterial({ color: 0xff3d6e });
  const matRamp = new THREE.MeshLambertMaterial({ color: 0xffd93d });
  const matPit = new THREE.MeshBasicMaterial({ color: 0x0a0814 });
  const matPitWall = new THREE.MeshLambertMaterial({ color: 0x140e2b, side: THREE.DoubleSide });
  const matLip = new THREE.MeshBasicMaterial({ color: 0xff3d6e, side: THREE.DoubleSide });

  for (const p of (map.pillars || [])) {
    const h = 3.2;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.85, p.r, h, 18), matPillar);
    cyl.position.set(p.x, h / 2, p.z);
    cyl.castShadow = true; cyl.receiveShadow = true;
    group.add(cyl);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.9, p.r * 0.9, 0.35, 18), matCap);
    cap.position.set(p.x, h, p.z);
    group.add(cap);
  }

  for (const w of (map.walls || [])) {
    const h = 2.2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w.len, h, w.thick), matWall);
    box.position.set(w.x, h / 2, w.z);
    box.rotation.y = w.rot || 0;
    box.castShadow = true; box.receiveShadow = true;
    group.add(box);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w.len, 0.3, w.thick + 0.1), matCap);
    cap.position.set(w.x, h, w.z);
    cap.rotation.y = w.rot || 0;
    group.add(cap);
  }

  for (const rmp of (map.ramps || [])) {
    const L = RAMP_LEN, rise = RAMP_RISE, W = RAMP_WIDTH;
    // Triángulo rectángulo: cara baja en el suelo, sube por la hipotenusa.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, rise); shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
    geo.translate(-L / 2, 0, -W / 2); // centrar (largo en X local, alto en Y, ancho en Z)
    const mesh = new THREE.Mesh(geo, matRamp);
    // Alinear +X local con la dirección cuesta arriba (dx,dz).
    mesh.rotation.y = Math.atan2(-rmp.dz, rmp.dx);
    mesh.position.set(rmp.x, 0, rmp.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const ho of (map.holes || [])) {
    const depth = 5;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(ho.r, 28), matPit);
    disc.rotation.x = -Math.PI / 2; disc.position.set(ho.x, 0.04, ho.z);
    group.add(disc);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(ho.r, ho.r * 0.92, depth, 24, 1, true), matPitWall);
    wall.position.set(ho.x, -depth / 2, ho.z);
    group.add(wall);
    const lip = new THREE.Mesh(new THREE.RingGeometry(ho.r, ho.r + 0.4, 28), matLip);
    lip.rotation.x = -Math.PI / 2; lip.position.set(ho.x, 0.05, ho.z);
    group.add(lip);
  }

  return group;
}
