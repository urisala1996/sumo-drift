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
- [ ] **Online "Revancha" broken** — after an online match ends, clicking Revancha doesn't work
      and the player's car appears alone (rematch path for online in
      [js/rounds.js](js/rounds.js) / [js/menu.js](js/menu.js); host must re-run setup and
      re-sync all players instead of restarting solo).
- [ ] **Mobile room disconnect while pasting code** — minimizing the browser to copy a code
      drops the connection and the room is already gone. Add grace time / don't delete the room
      immediately on disconnect; only clean up after sustained idle
      (`onDisconnect` handling in [js/net.js](js/net.js)).
- [x] **Ramps need collision** — added wedge collision in `resolveObstacles`
      ([js/physics.js](js/physics.js)): front face and flanks push cars out and reflect
      velocity; only cars approaching up-slope fast enough get launched.
