# DRIFT·SUMO

Top-down car sumo battle (Three.js r128, ES modules, no build step). Static files only,
deployed to GitHub Pages. English UI. Local 1P/2P plus host-authoritative online rooms
(Firebase RTDB). Selectable battle maps with obstacles, ramps and pits (see
[js/maps.js](js/maps.js)), selectable arena size (small/medium/large, `RING_SIZES` in
[js/config.js](js/config.js)), and sudden-death (round drawn after `SUDDEN_DEATH_T`s once the
ring hits minimum size).

## Layout
- [index.html](index.html) — shell + import map (three, firebase) + DOM.
- `js/` — `main.js` (loop), `physics.js`, `cars.js`, `ai.js`, `scene.js`, `maps.js`,
  `rounds.js`, `hud.js`, `input.js`, `menu.js`, `lobby.js`, `net.js`, `config.js`, `state.js`.
- [maps-preview.html](maps-preview.html) — standalone in-engine map preview.
- Online is host-authoritative: host runs all physics and writes car transforms ~20Hz;
  clients send only input `{l,r,b}` and render interpolated.

## Production / Deployment

### How to deploy
Static files only — push to `main` branch and GitHub Pages serves everything automatically.
The Firebase RTDB config in [js/firebase-config.js](js/firebase-config.js) is intentionally
public (Firebase Web SDK design); security is enforced by RTDB rules, not by hiding the config.

### Firebase security rules
Rules live in [database.rules.json](database.rules.json). **Deploy them before going public:**

```
# Firebase CLI (one-time setup: npm install -g firebase-tools && firebase login)
firebase deploy --only database
```

What the rules enforce:
- Room codes must be 4 uppercase letters (no I/O), matching `genCode()` in net.js
- `meta.host` (a UUID) is **immutable** once written — prevents host hijacking
- All fields are type- and range-validated; unknown fields are rejected
- Player names ≤ 20 chars, coordinates bounded to ±150 (largest arena + margin)
- Inputs locked to `0 | 1`; car/slot indices bounded to `0–3`
- Power-ups: `meta.powerups` (bool), per-slot `state.fx` (0–3), and a `pickups` node
  (`{type:1–3, x, z}`). **Adding these required a rules change — redeploy before online use.**

Limitation: without Firebase Auth we can't cryptographically verify that the writer
of `meta` / `state` is the actual host. We rely on UUID obscurity for clientIds
(randomly generated per session, never exposed in the UI). Adding Firebase Anonymous
Auth in the future would make the host-write check airtight.

### Production checklist
- [x] **Firebase rules** — [database.rules.json](database.rules.json) deployed to RTDB
- [ ] **Firebase Usage Alerts** — *manual, console-only (~2 min):* Firebase console →
      ⚙ Project settings → **Usage and billing** → **Details & settings** → set a budget
      alert (or, on Blaze, Google Cloud → Billing → Budgets & alerts → 80% threshold).
      Spark free tier caps: 10 GB/month bandwidth, 1 GB storage, 100 concurrent connections.
- [x] **Open Graph tags** — `og:*` + `twitter:*` meta in [index.html](index.html);
      share image is [og-image.png](og-image.png) (1200×630, rasterized from
      [og-image.svg](og-image.svg)). **Absolute URLs hardcode the github.io Pages URL —
      update them if you move to a custom domain.**
- [x] **PWA manifest** — [manifest.json](manifest.json) + [sw.js](sw.js) service worker.
      Caches the static shell (cache-first) + CDN libs (stale-while-revalidate); never
      intercepts Firebase RTDB/analytics traffic. Registered in [js/main.js](js/main.js).
      **Bump `CACHE` in sw.js when shipping new assets** or clients keep the old cache.
      Note: icons are the SVG favicon; older browsers that require 192/512 PNG icons for
      install may not prompt — add PNGs later if needed.
- [x] **Analytics** — [js/analytics.js](js/analytics.js) inits Firebase Analytics (GA4)
      at startup via `isSupported()` guard; reuses the net.js app instance
      (`getApps()`/`getApp()`). `firebase/analytics` added to the import map. Best-effort:
      wrapped so any failure is silent.
- [x] **Sound effects** — [js/audio.js](js/audio.js): fully synthesized Web Audio (no assets).
      Thud (car-car + obstacle bumps), fall whoosh, ramp jump, countdown beeps, round ding,
      match win/lose fanfare. Host/local trigger at the physics event sites
      ([js/physics.js](js/physics.js), [js/rounds.js](js/rounds.js), [js/main.js](js/main.js));
      online clients re-derive them from net state (fall/jump in `applyNetState`, countdown/round
      via banner in `applyMeta`, car impacts via a proximity detector in `clientFrame`) since
      clients run no physics. Mute toggle (`#muteBtn`, persisted in localStorage); context is
      lazily created and resumed on first gesture per autoplay policy.
- [x] **4th player online** — already fully wired: `MAX_PLAYERS=4` flows through `freeSlot`,
      the room-full check, `onlineRoster` CPU-fill and the lobby; 4 cars/`SLOT_COLORS` cover 4
      slots. HUD score row made responsive for 4 entries. **Needs a live 4-device/4-tab test**
      (can't be verified locally without 4 clients).
- [ ] **Custom domain** — point DNS to GitHub Pages in repo Settings → Pages

## Features
- [x] **Power-ups (roadmap #1)** — [js/pickups.js](js/pickups.js): mid-round pickups behind a
      default-on toggle (menu + host lobby switch, synced `meta.powerups`). v1 = **Boost** (temp
      speed), **Shield** (survive one knock-off), **Ram** (heavy next hit). Host spawns/collects
      and runs effects; effects show in synced transforms, so clients only get pickup positions
      (`pickups` node) + a per-car effect id (`state.fx`) for the holder aura. Effect hooks
      (`boostFactor`/`consumeShield`/`ramBonus`) live in pickups.js and are called from
      [js/physics.js](js/physics.js). Freeze + Gust deferred (see [ROADMAP.md](ROADMAP.md)).
- [x] **Gauntlet (roadmap #4)** — [js/gauntlet.js](js/gauntlet.js): solo, **local-only** endless
      run reached via the **GAUNTLET** menu mode. Each wave is one elimination round; survive to
      draft 1 of 3 upgrades (ENGINE/NITRO/GRIP/HEAVY/BUMPER/EXTRA-LIFE) accumulated in
      `state.gaunt.mods` and re-applied to a freshly built player car each wave. Difficulty ramps
      CPU count (1→2→3) then aggro/stats/ring-shrink (`state.shrinkT`); map rotates per wave. Best
      depth saved in `localStorage`. All gated by `state.gaunt.active`, so 1P/2P/online are
      untouched. Per-fighter `cfg` is now a **clone** (was a shared `CARS` ref) so stat upgrades
      and CPU scaling don't mutate shared config; BUMPER/EXTRA-LIFE hook
      [js/physics.js](js/physics.js) (`f.bump`, `f.lives` via the shield snap-back in `fallCheck`).

## TODO / Known issues
- [x] **Handling too twitchy** — reduced top speed ~40% and accel proportionally; steering
      authority now kicks in at lower speed (`speed0/7` vs `/12`); grip increased slightly.
- [x] **Reverse on long brake** — holding brake >2s now drives backwards at 40% top speed
      (`brakeT` accumulator in [js/physics.js](js/physics.js)).
- [x] **Brake lights wrong color** — changed to warm yellow `0xffe066`
      (`blMat` in [js/cars.js](js/cars.js)).
- [x] **Online "Revancha" fixed** — rematch now uses a `matchId` nonce in meta: the host
      increments it on every start (single atomic `writeMeta`), and clients rebuild whenever it
      changes instead of relying on the fragile `status==="playing" && !matchActive` gate
      ([js/rounds.js](js/rounds.js), [js/state.js](js/state.js)).
- [x] **Mobile room disconnect grace** — rooms/players are no longer deleted on the first
      connection blip. Presence uses a heartbeat (`hostSeen`/`seen`) + `.info/connected`
      re-assert; stale players are reaped after `PLAYER_TTL` (30s) and stale rooms after
      `ROOM_TTL` (60s). Clients detect a permanently-gone host via the same TTL
      ([js/net.js](js/net.js) `startPresence`/`reapStalePlayers`).
- [x] **Ramps need collision** — added wedge collision in `resolveObstacles`
      ([js/physics.js](js/physics.js)): front face and flanks push cars out and reflect
      velocity; only cars approaching up-slope fast enough get launched.
