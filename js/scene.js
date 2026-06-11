import * as THREE from 'three';
import { RING_R0 } from './config.js';
import { state, rng } from './state.js';
import { MAP_BY_ID, buildMapFeatures } from './maps.js';

export function initThree() {
  state.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true });
  state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  state.renderer.setSize(innerWidth, innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x2a1e4f);
  state.scene.fog = new THREE.Fog(0x2a1e4f, 160, 340);

  const aspect = innerWidth / innerHeight, d = 50;
  state.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 600);
  state.camera.position.set(48, 56, 48);
  state.camera.lookAt(0, 0, 0);

  state.scene.add(new THREE.AmbientLight(0x8877cc, .9));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
  sun.position.set(30, 55, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  state.scene.add(sun);
  state.scene.userData.sun = sun;

  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshLambertMaterial({ color: 0x1c1340 })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = -46;
  state.scene.add(deep);

  state.rngSeed = 7;
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, r = 70 + rng() * 160;
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(10 + rng() * 26, 14 + rng() * 30, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2d6b })
    );
    hill.position.set(Math.cos(a) * r, -44, Math.sin(a) * r);
    state.scene.add(hill);
  }

  state.scene.userData.rocks = [];
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2, r = 52 + rng() * 40;
    const ro = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5 + rng() * 3, 0),
      new THREE.MeshLambertMaterial({ color: 0x7a6aa8 })
    );
    ro.position.set(Math.cos(a) * r, -6 - rng() * 16, Math.sin(a) * r);
    ro.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    ro.userData = { bob: rng() * 6.28, baseY: ro.position.y };
    state.scene.userData.rocks.push(ro);
    state.scene.add(ro);
  }

  buildRing();
  buildSmokePool();
  addEventListener("resize", onResize);
}

export function onResize() {
  const aspect = innerWidth / innerHeight, d = state.camera.top;
  state.camera.left = -d * aspect;
  state.camera.right = d * aspect;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(innerWidth, innerHeight);
}

export function buildRing() {
  state.ringGroup = new THREE.Group();
  state.platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 0.92, 7, 36),
    new THREE.MeshLambertMaterial({ color: 0x3d3170 })
  );
  state.platform.position.y = -3.5;
  state.platform.receiveShadow = true;
  state.ringGroup.add(state.platform);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.001, 0.95, 2.2, 36, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x2b2150, side: THREE.DoubleSide })
  );
  skirt.position.y = -1.1;
  state.ringGroup.add(skirt);

  state.edgeLine = new THREE.Mesh(
    new THREE.RingGeometry(.945, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xf5ead7, side: THREE.DoubleSide })
  );
  state.edgeLine.rotation.x = -Math.PI / 2;
  state.edgeLine.position.y = .03;
  state.ringGroup.add(state.edgeLine);

  const cc = new THREE.Mesh(
    new THREE.RingGeometry(.18, .2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide })
  );
  cc.rotation.x = -Math.PI / 2;
  cc.position.y = .03;
  state.ringGroup.add(cc);
  state.scene.add(state.ringGroup);

  const curbGeo = new THREE.BoxGeometry(1.5, .55, 2.2);
  const mR = new THREE.MeshLambertMaterial({ color: 0xff3d6e });
  const mW = new THREE.MeshLambertMaterial({ color: 0xf5ead7 });
  for (let i = 0; i < 36; i++) {
    const c = new THREE.Mesh(curbGeo, i % 2 ? mR : mW);
    c.castShadow = true;
    state.scene.add(c);
    state.curbs.push(c);
  }
  setRing(RING_R0);
}

// Carga el mapa `mapId`: reconstruye los obstáculos y tiñe el suelo del ring.
// Los obstáculos viven en coordenadas de mundo (no se escalan con el ring).
export function loadMap(mapId) {
  const map = MAP_BY_ID[mapId] || MAP_BY_ID.clasico;
  state.curMap = map;
  state.mapId = map.id;
  if (state.mapGroup) {
    state.mapGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    state.scene.remove(state.mapGroup);
  }
  state.mapGroup = new THREE.Group();
  buildMapFeatures(state.mapGroup, map);
  state.scene.add(state.mapGroup);
  if (state.platform) state.platform.material.color.setHex(map.floor ?? 0x3d3170);
}

export function setRing(r) {
  state.ringR = r;
  state.ringGroup.scale.set(r, 1, r);
  for (let i = 0; i < state.curbs.length; i++) {
    const a = i / state.curbs.length * Math.PI * 2;
    state.curbs[i].position.set(Math.cos(a) * (r + .6), .15, Math.sin(a) * (r + .6));
    state.curbs[i].rotation.y = -a + Math.PI / 2;
  }
}

export function buildSmokePool() {
  const g = new THREE.BoxGeometry(.7, .7, .7);
  const m = new THREE.MeshLambertMaterial({ color: 0xf5ead7, transparent: true, opacity: .7 });
  for (let i = 0; i < 50; i++) {
    const s = new THREE.Mesh(g, m.clone());
    s.visible = false;
    s.userData = { life: 0 };
    state.scene.add(s);
    state.smokePool.push(s);
  }
}

export function spawnSmoke(x, z, col) {
  const s = state.smokePool[state.smokeIdx++ % state.smokePool.length];
  s.visible = true;
  s.position.set(x + (rng() - .5), .4, z + (rng() - .5));
  s.scale.setScalar(.5 + rng() * .6);
  s.material.color.set(col || 0xf5ead7);
  s.material.opacity = .65;
  s.userData.life = .6;
}

export function updateSmoke(dt) {
  for (const s of state.smokePool) {
    if (!s.visible) continue;
    s.userData.life -= dt;
    s.position.y += dt * 2.2;
    s.scale.multiplyScalar(1 + dt * 1.5);
    s.material.opacity = Math.max(0, s.userData.life);
    if (s.userData.life <= 0) s.visible = false;
  }
}

export function updateCamera(dt) {
  let cx = 0, cz = 0, nn = 0;
  for (const f of state.fighters) {
    if (f.alive && !f.falling) { cx += f.x; cz += f.z; nn++; }
  }
  if (nn) { cx /= nn; cz /= nn; }
  const tx = cx * .3 + 48, tz = cz * .3 + 48;
  state.camera.position.x += (tx - state.camera.position.x) * Math.min(1, dt * 3);
  state.camera.position.z += (tz - state.camera.position.z) * Math.min(1, dt * 3);
  state.camera.position.y = 56;
  state.camera.lookAt(state.camera.position.x - 48, 0, state.camera.position.z - 48);
  const d = Math.max(26, Math.min(50, state.ringR * 1.35 + 8));
  state.camera.top += (d - state.camera.top) * Math.min(1, dt * 2);
  state.camera.bottom = -state.camera.top;
  const aspect = innerWidth / innerHeight;
  state.camera.left = -state.camera.top * aspect;
  state.camera.right = state.camera.top * aspect;
  state.camera.updateProjectionMatrix();
}
