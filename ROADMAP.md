# DRIFT·SUMO — Long-term feature roadmap

Replayability ideas, ordered as a suggested build arc. Each is grounded in the current
architecture (host-authoritative RTDB, deterministic data-driven maps, slot-based fighters,
best-of-3, no accounts). Status legend: 🔵 planned · 🟡 in progress · ✅ done.

## Suggested arc
**#1 ✅ → #4 ✅ → #2 → #5 → #3.** #1's effect system was the foundation #4's draft pool reused;
#2's unlock targets and #3's editor build on the same data-driven cars/maps.

---

## 1. Power-ups & hazard events 🟢 *(v1 shipped — Boost/Shield/Ram)*
Mid-round pickups, gated behind a default-on toggle (menu + host lobby switch, synced via
`meta.powerups`). Implemented in [js/pickups.js](js/pickups.js).
- **Shipped (v1):** **Boost** (temp speed), **Shield** (survive one knock-off), **Ram** (heavy
  next car-car hit). Host spawns/collects; effects manifest in synced transforms; clients render
  pickup positions + a per-car effect id (`fx`) for the holder aura. AI seeks nearby pickups.
- **Deferred:** **Freeze** (crowd-control pickup) and the **Gust** hazard event (wind toward an
  edge) — both fit the same `fx`/event scaffolding when we return to this.
- **Foundation for:** #4 (draft pool reuses the effect hooks), #2 (unlock targets).
- **Note:** required a `database.rules.json` change (new `pickups` node, `meta.powerups`, per-slot
  `fx`) — redeploy rules before online use.

## 2. Persistent progression — garage unlocks & cosmetics 🔵
Track wins in `localStorage` (later RTDB per device-id). Coins → car skins, trail colors,
victory emotes, tuned chassis. Daily-modifier rotation ("today: low gravity / tiny ring").
- **Fits:** cars are data in `config.js`; skins = material/color swaps. v1 device-local, no auth.
- **Replayability:** "one more match to unlock X"; come back tomorrow.
- **Effort:** medium-high · **Risk:** per-device progress is spoofable without server accounts.

## 3. Garage & Content Studio — asset manager + editor 🔵
In-browser suite to create and manage game content, all persisted in `localStorage` and surfaced
in the existing car/map pickers:
- **Car editor:** name, color and stats (accel/topSpeed/grip/turn/mass) with a live preview that
  reuses `makeCarMesh` ([js/cars.js](js/cars.js)); custom cars join the selection grid.
- **Map editor:** place/drag pillars, walls, ramps and holes on the current data model
  ([js/maps.js](js/maps.js)); builds directly on the in-engine preview
  ([maps-preview.html](maps-preview.html)) and exports a paste-able share code.
- **Asset manager:** duplicate / rename / delete / import / export car and map definitions (JSON
  or share code).
- **Fits:** cars and maps are already pure data + deterministic builders, so custom entries flow
  through the same pickers, `loadMap`, and (for maps) `meta.map` sync with zero engine changes.
- **Overlaps:** subsumes the editor half of #5 (procedural/community maps) and feeds #2's cosmetics.
- **Effort:** medium (managers + car editor) → high (drag map editor) · **Risk:** fairness
  validation for custom maps (safe spawns, winnable layouts); sharing custom *cars* online needs a
  sync/validation story (start local-only).

## 4. Roguelike "gauntlet" single-player ✅ *(shipped — endless escalating)*
Solo run vs escalating CPU waves; draft one upgrade between waves. Run ends on a knock-off; depth
(waves cleared) saved as a local best. Implemented in [js/gauntlet.js](js/gauntlet.js).
- **Shipped:** endless waves (CPU count ramps 1→2→3, then aggro/stat/shrink scaling; map rotates
  per wave). 4th menu mode **GAUNTLET**. Between-wave **DRAFT** of 3 upgrades from a pool —
  ENGINE / NITRO / GRIP / HEAVY / BUMPER / EXTRA-LIFE — accumulated in `state.gaunt.mods` and
  re-applied to a freshly built player car each wave. Local best in `localStorage`.
- **Reuses:** AI + physics untouched; per-fighter cloned `cfg` carries stat upgrades, BUMPER adds
  passive collision restitution, EXTRA-LIFE rides the existing shield snap-back in `fallCheck`
  ([js/physics.js](js/physics.js)). Solo-only — no netcode involved.
- **Deferred:** more upgrades/relics, boss waves, an online/shared leaderboard.

## 5. Procedural / community maps 🔵
Seeded map generator (`maps.js` data model already: pillars/walls/ramps/holes) + a shareable
seed and a lightweight in-browser editor exporting a paste-able code (like room codes).
- **Fits:** maps are pure data + deterministic `buildMapFeatures`; seeds replicate across
  host/clients exactly like `meta.map`.
- **Replayability:** effectively infinite arenas; community sharing = content flywheel, zero
  hosting cost.
- **Effort:** medium (generator) → high (editor) · **Risk:** fairness validation (safe spawns,
  winnable layouts).
