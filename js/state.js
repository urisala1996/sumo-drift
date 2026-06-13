import { RING_R0, RING_SIZES } from './config.js';

export const state = {
  scene: null,
  camera: null,
  renderer: null,
  smokePool: [],
  smokeIdx: 0,
  ringGroup: null,
  platform: null,
  edgeLine: null,
  curbs: [],
  fighters: [],

  // Mapa activo (obstáculos/rampas/pozos). mapId se elige en el menú/lobby.
  mapId: "clasico",
  mapGroup: null,
  curMap: null,

  // Tamaño de arena elegido (small/medium/large) y su radio inicial resuelto.
  ringSize: "small",
  ringR0: RING_SIZES.small,
  // Sudden death: tiempo con el ring al mínimo; sd = segundos restantes (-1 = off).
  sdT: 0,
  sd: -1,
  // Cliente: objetivo de tamaño de ring para interpolar (evita el "tick").
  ringTarget: null,

  // Power-ups (roadmap #1). powerups = toggle (default on). El host mantiene
  // `pickups` como verdad de juego; el cliente lo sobrescribe desde la red solo
  // para renderizar. pkMeshes mapea id->malla del pickup.
  powerups: true,
  pickups: [],        // [{ id, type, x, z, t }]
  pkSpawnAcc: 0,      // acumulador del scheduler (host)
  pkNextId: 1,        // id incremental de pickups (host)
  pkMeshes: {},       // id -> THREE.Mesh (host y cliente)

  players: 1,
  selP1: 0,
  selP2: 1,

  // "local" = juego en un dispositivo (1P / 2P); "online" = sala Firebase
  mode: "local",
  // Espejo del estado de red mantenido por net.js (ver js/net.js)
  net: { code: null, clientId: null, slot: 0, isHost: false, fillAI: true },
  // Última instantánea de input remoto por clientId (la rellena el host desde RTDB)
  remoteInputs: {},
  // Acumulador para limitar la frecuencia de escritura del host (~20Hz)
  netSendAcc: 0,
  round: 1,
  // Partida online: matchActive marca si hay combate en curso; matchId es un
  // contador que el host incrementa en cada arranque para que los clientes
  // reconstruyan de forma determinista (incluida la revancha).
  matchActive: false,
  matchId: 0,
  lastMatchId: 0,
  // Cliente: instante del último latido recibido del host (para detectar si el
  // host abandonó la sala de forma permanente, no un corte breve).
  hostSeenAt: 0,
  phase: "idle",
  phaseT: 0,
  playT: 0,
  ringR: RING_R0,
  lastT: 0,
  rngSeed: 99,
  tc: { p1: { l: 0, r: 0, b: 0 }, p2: { l: 0, r: 0, b: 0 } },
  kb: { p1: { l: 0, r: 0, b: 0 }, p2: { l: 0, r: 0, b: 0 } },
};

export function rng() {
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return state.rngSeed / 4294967296;
}

export function eff(p) {
  return {
    l: state.tc[p].l || state.kb[p].l,
    r: state.tc[p].r || state.kb[p].r,
    b: state.tc[p].b || state.kb[p].b,
  };
}
