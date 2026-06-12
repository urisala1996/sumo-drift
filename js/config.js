export const RING_R0 = 36, RING_RMIN = 10, SHRINK_T = 40, CAR_R = 1.9, WINS_NEEDED = 2;

// Sudden death: once the ring is at minimum size, the round is drawn after this
// many seconds if nobody has been knocked out.
export const SUDDEN_DEATH_T = 10;

// Selectable arena sizes (starting radius). "small" is the original size.
export const RING_SIZES = { small: 36, medium: 48, large: 60 };

export const CARS = [
  { name: "RAYO", color: 0xff8e3c, accel: 20, topSpeed: 28, grip: 6.0, turn: 2.5,  mass: .9,  stats: { SPD: 1.0, GRIP: .45, WT: .4 } },
  { name: "KUMO", color: 0x3ddbb4, accel: 16, topSpeed: 24, grip: 4.2, turn: 3.1,  mass: 1.0, stats: { SPD: .7,  GRIP: .3,  WT: .6 } },
  { name: "TORO", color: 0xff3d6e, accel: 15, topSpeed: 22, grip: 9.5, turn: 2.7,  mass: 1.3, stats: { SPD: .6,  GRIP: 1.0, WT: 1.0 } },
  { name: "VOLT", color: 0x6c5ce7, accel: 18, topSpeed: 26, grip: 6.5, turn: 2.8,  mass: 1.05, stats: { SPD: .8,  GRIP: .6,  WT: .65 } },
];

// Color por defecto para cada plaza (slot) del ring; coincide con --p1..--p4 del CSS
export const SLOT_COLORS = [0xff8e3c, 0x3ddbb4, 0x6c5ce7, 0xffd93d];
