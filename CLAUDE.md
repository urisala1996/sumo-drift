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

Limitation: without Firebase Auth we can't cryptographically verify that the writer
of `meta` / `state` is the actual host. We rely on UUID obscurity for clientIds
(randomly generated per session, never exposed in the UI). Adding Firebase Anonymous
Auth in the future would make the host-write check airtight.

### Production checklist
- [x] **Firebase rules** — [database.rules.json](database.rules.json) deployed to RTDB
- [ ] **Firebase Usage Alerts** — set up in the Firebase console (Spark free tier:
      10 GB/month bandwidth, 100 concurrent connections); alert at 80% to avoid surprises
- [ ] **Open Graph tags** — add `og:title`, `og:description`, `og:image`, `og:url` to
      `<head>` in [index.html](index.html) so link previews look good on Discord/iMessage
- [ ] **PWA manifest** — `manifest.json` + 20-line service worker for home-screen install
      and instant repeat loads (the shell only; online still needs connectivity)
- [ ] **Sound effects** — 3–4 sounds (collision thud, fall whoosh, win jingle) via Web Audio
      API (generated or small `.ogg` files, no large assets needed)
- [ ] **4th player online** — `MAX_PLAYERS=4` slots and `SLOT_COLORS` are already wired;
      just needs the lobby UI and local testing
- [ ] **Analytics** — `measurementId` is already in firebase-config.js; add
      `import { getAnalytics } from 'firebase/analytics'; getAnalytics(app)` in net.js
- [ ] **Custom domain** — point DNS to GitHub Pages in repo Settings → Pages

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
