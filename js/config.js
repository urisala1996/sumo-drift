export const RING_R0 = 36, RING_RMIN = 10, SHRINK_T = 40, CAR_R = 1.9, WINS_NEEDED = 2;

export const CARS = [
  { name: "RAYO", color: 0xff8e3c, accel: 34, topSpeed: 46, grip: 5.2, turn: 2.25, mass: .9,  stats: { VEL: 1.0, AGA: .45, PESO: .4 } },
  { name: "KUMO", color: 0x3ddbb4, accel: 28, topSpeed: 40, grip: 3.4, turn: 2.9,  mass: 1.0, stats: { VEL: .7,  AGA: .3,  PESO: .6 } },
  { name: "TORO", color: 0xff3d6e, accel: 26, topSpeed: 38, grip: 8.5, turn: 2.5,  mass: 1.3, stats: { VEL: .6,  AGA: 1.0, PESO: 1.0 } },
  { name: "VOLT", color: 0x6c5ce7, accel: 30, topSpeed: 42, grip: 5.8, turn: 2.6,  mass: 1.05, stats: { VEL: .8,  AGA: .6,  PESO: .65 } },
];

// Color por defecto para cada plaza (slot) del ring; coincide con --p1..--p4 del CSS
export const SLOT_COLORS = [0xff8e3c, 0x3ddbb4, 0x6c5ce7, 0xffd93d];
