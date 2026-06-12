# DRIFT·SUMO — Long-term feature roadmap

Replayability ideas, ordered as a suggested build arc. Each is grounded in the current
architecture (host-authoritative RTDB, deterministic data-driven maps, slot-based fighters,
best-of-3, no accounts). Status legend: 🔵 planned · 🟡 in progress · ✅ done.

## Suggested arc
**#1 → #4 → #2 → #5 → #3.** #1's effect system is the foundation #4's draft pool and #2's
unlock targets reuse, so build it first.

---

## 1. Power-ups & hazard events 🟡 *(planning — next up)*
Mid-round pickups (speed boost, heavy "ram" charge, one-hit shield, brief rival freeze) plus
timed arena events (wind gust toward the edge, temporary extra pit).
- **Fits:** physics already has impulses; maps already place features; `f.*` fields sync to
  clients for free. A pickup is a position + an effect flag on a fighter.
- **Replayability:** every round differs; comeback swings.
- **Effort:** medium · **Risk:** balance + host-authoritative collect/broadcast netcode.
- **Foundation for:** #4 (draft pool), #2 (unlock targets).

## 2. Persistent progression — garage unlocks & cosmetics 🔵
Track wins in `localStorage` (later RTDB per device-id). Coins → car skins, trail colors,
victory emotes, tuned chassis. Daily-modifier rotation ("today: low gravity / tiny ring").
- **Fits:** cars are data in `config.js`; skins = material/color swaps. v1 device-local, no auth.
- **Replayability:** "one more match to unlock X"; come back tomorrow.
- **Effort:** medium-high · **Risk:** per-device progress is spoofable without server accounts.

## 3. Tournament / bracket mode 🔵
Elimination bracket chaining matches: 4–8 players (humans + CPU), seeding, spectator view,
champion screen. Online host runs the bracket state machine in `meta`.
- **Fits:** best-of-3 + host-authoritative `meta` state machine already exist; bracket is a layer
  deciding who plays next.
- **Replayability:** one-off matches become a session with an arc and stakes.
- **Effort:** high · **Risk:** spectating/waiting + drop handling across multiple matches.

## 4. Roguelike "gauntlet" single-player 🔵
Solo run vs escalating CPU waves; draft one upgrade between rounds (grip, ram damage, extra
life, ring-shrink slowdown). Run ends on death; depth/score to a local leaderboard.
- **Fits:** reuses AI + physics + #1's effect/upgrade system as a meta-loop wrapper.
- **Replayability:** procedural build variety + personal high score. Strengthens the currently
  thin solo mode (likely most sessions).
- **Effort:** medium-high · **Risk:** AI difficulty scaling; upgrade balance.

## 5. Procedural / community maps 🔵
Seeded map generator (`maps.js` data model already: pillars/walls/ramps/holes) + a shareable
seed and a lightweight in-browser editor exporting a paste-able code (like room codes).
- **Fits:** maps are pure data + deterministic `buildMapFeatures`; seeds replicate across
  host/clients exactly like `meta.map`.
- **Replayability:** effectively infinite arenas; community sharing = content flywheel, zero
  hosting cost.
- **Effort:** medium (generator) → high (editor) · **Risk:** fairness validation (safe spawns,
  winnable layouts).
