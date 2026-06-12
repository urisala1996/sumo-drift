// ============================================================
//  Capa de red — Firebase Realtime Database (host-authoritative)
// ============================================================
// El host de la sala ejecuta toda la física y publica las posiciones de los
// coches (~20Hz). Los clientes solo escriben su input {l,r,b} y renderizan
// con interpolación. La config web de Firebase es pública; la seguridad va en
// las reglas de la RTDB. No se usa Firebase Auth: cada cliente genera un id
// aleatorio y la presencia se gestiona con onDisconnect().

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, child, get, set, update, remove,
  onValue, onDisconnect, serverTimestamp,
} from 'firebase/database';
import { firebaseConfig, firebaseReady } from './firebase-config.js';
import { CARS } from './config.js';
import { state } from './state.js';

export const MAX_PLAYERS = 4;

// Presencia con gracia: en vez de borrar la sala/jugador al primer corte de
// conexión (p.ej. minimizar el navegador en móvil para pegar el código), se
// refresca un "latido" periódico y solo se limpia lo que lleva inactivo un rato.
const HEARTBEAT_MS = 8000;   // frecuencia del latido de presencia
const PLAYER_TTL = 30000;    // gracia antes de echar a un jugador inactivo
export const ROOM_TTL = 60000; // gracia antes de dar una sala/host por muertos
let hbTimer = null, connUnsub = null;

// Espejo local del estado de red (state.net apunta a este objeto).
export const net = state.net;
net.app = null;
net.db = null;
net.roomRef = null;
net.players = {};          // clientId -> { name, slot, car, ready }
net.meta = {};             // última meta conocida (host la mantiene; cliente la lee)
net.unsubs = [];           // funciones para cancelar listeners
net.metaCache = {};        // host: meta acumulada que se reescribe cada frame

export function isReady() { return firebaseReady; }
export function isHost() { return net.isHost; }

function ensureApp() {
  if (!firebaseReady) throw new Error("Firebase is not configured. Edit js/firebase-config.js.");
  if (!net.app) {
    net.app = initializeApp(firebaseConfig);
    net.db = getDatabase(net.app);
  }
  return net.db;
}

function genCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I/O para evitar confusión
  let s = "";
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function freeCar(players, exclude = null) {
  const taken = new Set(Object.values(players).map(p => p.car));
  for (let i = 0; i < CARS.length; i++) if (i !== exclude && !taken.has(i)) return i;
  return 0;
}

function freeSlot(players) {
  const taken = new Set(Object.values(players).map(p => p.slot));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!taken.has(i)) return i;
  return -1;
}

// ---------- Crear / unirse ----------
export async function createRoom(name) {
  const db = ensureApp();
  net.clientId = crypto.randomUUID();
  let code, exists = true, tries = 0;
  do {
    code = genCode();
    const snap = await get(child(ref(db), `rooms/${code}/meta`));
    exists = snap.exists();
  } while (exists && ++tries < 20);

  net.code = code;
  net.slot = 0;
  net.isHost = true;
  net.roomRef = ref(db, `rooms/${code}`);
  net.metaCache = {
    host: net.clientId, status: "lobby", phase: "idle", phaseT: 0,
    ring: 100, round: 1, matchId: 0, banner: "", bannerColor: "", fillAI: true,
    map: state.mapId || "clasico", ringSize: state.ringSize || "small",
    hostSeen: serverTimestamp(), createdAt: serverTimestamp(),
  };
  net.fillAI = true;
  await set(net.roomRef, {
    meta: net.metaCache,
    players: { [net.clientId]: { name: name || "P1", slot: 0, car: 0, ready: false, seen: serverTimestamp() } },
  });
  // NOTA: ya NO se borra la sala al desconectar; ver startPresence() — un corte
  // breve de conexión no debe tumbar la sala. La limpieza es diferida por TTL.
  startPresence();
  return { code, clientId: net.clientId };
}

export async function joinRoom(code, name) {
  const db = ensureApp();
  code = (code || "").toUpperCase().trim();
  const metaSnap = await get(child(ref(db), `rooms/${code}/meta`));
  if (!metaSnap.exists()) throw new Error("Room not found.");
  const meta = metaSnap.val();
  // Sala fantasma: el host lleva demasiado tiempo sin dar señales -> la limpiamos.
  if (meta.hostSeen && Date.now() - meta.hostSeen > ROOM_TTL) {
    await remove(ref(db, `rooms/${code}`));
    throw new Error("This room is no longer active.");
  }
  if (meta.status !== "lobby") throw new Error("The match has already started.");
  const pSnap = await get(child(ref(db), `rooms/${code}/players`));
  const players = pSnap.val() || {};
  if (Object.keys(players).length >= MAX_PLAYERS) throw new Error("The room is full.");

  net.clientId = crypto.randomUUID();
  net.slot = freeSlot(players);
  net.isHost = false;
  net.code = code;
  net.roomRef = ref(db, `rooms/${code}`);
  await set(ref(db, `rooms/${code}/players/${net.clientId}`), {
    name: name || `P${net.slot + 1}`, slot: net.slot, car: freeCar(players), ready: false, seen: serverTimestamp(),
  });
  // El input sí se borra al desconectar (no debe quedar input fantasma); la
  // entrada de jugador se mantiene con gracia (ver startPresence()).
  onDisconnect(ref(db, `rooms/${code}/inputs/${net.clientId}`)).remove();
  startPresence();
  return { code, clientId: net.clientId, slot: net.slot };
}

// ---------- Suscripciones ----------
function track(unsub) { net.unsubs.push(unsub); }

export function subscribeMeta(cb) {
  const r = ref(net.db, `rooms/${net.code}/meta`);
  // Pasa null cuando la sala desaparece (host desconectado) para que el cliente
  // pueda volver al menú.
  track(onValue(r, s => { const v = s.val(); if (v) net.meta = v; cb(v); }));
}
export function subscribePlayers(cb) {
  const r = ref(net.db, `rooms/${net.code}/players`);
  track(onValue(r, s => { net.players = s.val() || {}; cb(net.players); }));
}
export function subscribeInputs(cb) {
  const r = ref(net.db, `rooms/${net.code}/inputs`);
  track(onValue(r, s => { state.remoteInputs = s.val() || {}; cb(state.remoteInputs); }));
}
export function subscribeState(cb) {
  const r = ref(net.db, `rooms/${net.code}/state`);
  track(onValue(r, s => cb(s.val() || {})));
}

// ---------- Escrituras de cliente (lobby + input) ----------
export function setReady(v) {
  if (!net.code || net.isHost === undefined) return;
  return update(ref(net.db, `rooms/${net.code}/players/${net.clientId}`), { ready: !!v });
}
export function pickCar(carIndex) {
  return update(ref(net.db, `rooms/${net.code}/players/${net.clientId}`), { car: carIndex });
}
export function writeInput(input) {
  // El host usa su input local directamente; no necesita escribirlo.
  if (net.isHost) return;
  return set(ref(net.db, `rooms/${net.code}/inputs/${net.clientId}`), {
    l: input.l ? 1 : 0, r: input.r ? 1 : 0, b: input.b ? 1 : 0,
  });
}

// ---------- Escrituras de host (meta + estado de juego) ----------
export function setFillAI(v) {
  if (!net.isHost) return;
  net.fillAI = !!v;
  net.metaCache.fillAI = !!v;
  return update(ref(net.db, `rooms/${net.code}/meta`), { fillAI: !!v });
}
export function setMap(id) {
  if (!net.isHost) return;
  net.metaCache.map = id;
  return update(ref(net.db, `rooms/${net.code}/meta`), { map: id });
}
export function setRingSize(size) {
  if (!net.isHost) return;
  net.metaCache.ringSize = size;
  return update(ref(net.db, `rooms/${net.code}/meta`), { ringSize: size });
}
export function writeMeta(partial) {
  if (!net.isHost) return;
  Object.assign(net.metaCache, partial);
  return update(ref(net.db, `rooms/${net.code}/meta`), partial);
}

// Empuja transformaciones de todos los coches + meta en una sola escritura.
export function writeFrame(fighters, metaPartial) {
  if (!net.isHost) return;
  const st = {};
  for (const f of fighters) {
    st[f.slot] = {
      x: f.x, z: f.z, y: f.y, heading: f.heading, steer: f.steer,
      alive: f.alive ? 1 : 0, falling: f.falling ? 1 : 0, brake: f.brake ? 1 : 0, wins: f.wins,
    };
  }
  if (metaPartial) Object.assign(net.metaCache, metaPartial);
  return update(ref(net.db, `rooms/${net.code}`), { state: st, meta: net.metaCache });
}

// ---------- Helpers ----------
export function playersList() {
  return Object.entries(net.players)
    .map(([clientId, p]) => ({ clientId, ...p }))
    .sort((a, b) => a.slot - b.slot);
}
export function takenCars(exceptClientId = null) {
  const s = new Set();
  for (const [cid, p] of Object.entries(net.players)) if (cid !== exceptClientId) s.add(p.car);
  return s;
}

// ---------- Presencia (latido + reconexión + siega diferida) ----------
function presenceRefresh() {
  if (!net.code || !net.db) return;
  if (net.isHost) {
    net.metaCache.hostSeen = serverTimestamp();
    update(ref(net.db, `rooms/${net.code}/meta`), { hostSeen: serverTimestamp() });
    reapStalePlayers();
  } else {
    update(ref(net.db, `rooms/${net.code}/players/${net.clientId}`), { seen: serverTimestamp(), online: true });
  }
}

// El host echa a los jugadores que llevan demasiado tiempo sin latir (les da
// margen para volver tras un corte breve antes de convertirlos en hueco/CPU).
function reapStalePlayers() {
  if (!net.isHost || !net.code) return;
  const now = Date.now();
  for (const [cid, p] of Object.entries(net.players)) {
    if (cid === net.clientId) continue;
    if (p.seen && now - p.seen > PLAYER_TTL) remove(ref(net.db, `rooms/${net.code}/players/${cid}`));
  }
}

function startPresence() {
  stopPresence();
  presenceRefresh();
  hbTimer = setInterval(presenceRefresh, HEARTBEAT_MS);
  // Reafirma la presencia al (re)conectar; un cliente además marca su entrada
  // como offline (sin borrarla) al caer, para que la siega tenga su margen.
  connUnsub = onValue(ref(net.db, ".info/connected"), snap => {
    if (snap.val() !== true || !net.code) return;
    if (!net.isHost) {
      const pr = ref(net.db, `rooms/${net.code}/players/${net.clientId}`);
      onDisconnect(pr).update({ online: false });
    }
    presenceRefresh();
  });
}

function stopPresence() {
  if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  if (connUnsub) { try { connUnsub(); } catch (e) {} connUnsub = null; }
}

export function leaveRoom() {
  stopPresence();
  for (const u of net.unsubs) { try { u(); } catch (e) {} }
  net.unsubs = [];
  if (net.code && net.db) {
    try {
      if (net.isHost) { remove(net.roomRef); }
      else {
        const pr = ref(net.db, `rooms/${net.code}/players/${net.clientId}`);
        onDisconnect(pr).cancel(); remove(pr);
        remove(ref(net.db, `rooms/${net.code}/inputs/${net.clientId}`));
      }
    } catch (e) {}
  }
  net.code = null; net.roomRef = null; net.players = {}; net.meta = {};
  net.isHost = false; net.slot = 0;
}
