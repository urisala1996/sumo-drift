import { RING_R0 } from './config.js';

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
