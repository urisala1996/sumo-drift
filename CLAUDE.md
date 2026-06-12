# DRIFT·SUMO

Top-down car sumo battle (Three.js r128, ES modules, no build step). Static files only,
deployed to GitHub Pages. Local 1P/2P plus host-authoritative online rooms (Firebase RTDB).
Selectable battle maps with obstacles, ramps and pits (see [js/maps.js](js/maps.js)).

## Layout
- [index.html](index.html) — shell + import map (three, firebase) + DOM.
- `js/` — `main.js` (loop), `physics.js`, `cars.js`, `ai.js`, `scene.js`, `maps.js`,
  `rounds.js`, `hud.js`, `input.js`, `menu.js`, `lobby.js`, `net.js`, `config.js`, `state.js`.
- [maps-preview.html](maps-preview.html) — standalone in-engine map preview.
- Online is host-authoritative: host runs all physics and writes car transforms ~20Hz;
  clients send only input `{l,r,b}` and render interpolated.

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
