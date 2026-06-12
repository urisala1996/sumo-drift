// Firebase Analytics (Google Analytics 4) — best-effort page/session metrics.
//
// Initialised once at startup for ALL players (local 1P/2P included), so we get
// pageviews/DAU even from people who never open an online room. It reuses the
// same Firebase app instance as net.js (whichever inits first wins via getApps).
//
// Analytics only works over http(s) with a measurementId; isSupported() guards
// unsupported environments (e.g. some in-app browsers) and file:// dev, and the
// whole thing is wrapped so a failure here can never break the game.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig, firebaseReady } from './firebase-config.js';

export async function initAnalytics() {
  if (!firebaseReady || !firebaseConfig.measurementId) return;
  try {
    // Dynamic import: ad blockers commonly block firebase-analytics.js. A static
    // import would fail the whole main.js module graph and break the game; a
    // dynamic one just rejects here and is swallowed.
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (!(await isSupported())) return;
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    getAnalytics(app);
  } catch (e) {
    // Analytics is non-essential; never surface errors to the player.
  }
}
