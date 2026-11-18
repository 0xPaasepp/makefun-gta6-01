// SOLMAR — Streets of the Sun · config.js
// Single source of truth for world layout, spawn points and mission data.
// Forward vector for heading h is (sin h, cos h) in (x, z); h = PI faces north (-z).

export const CFG = {
  world: { minX: -240, minZ: -240, maxX: 240, maxZ: 240 },
  seaX: 208,               // water starts east of this x
  marina: { x0: 168, z0: -132, x1: 212, z1: -68 }, // marina basin (water)
  docks: { x0: 150, z0: 128, x1: 206, z1: 190 },   // quay rectangle
  plaza: { x: 0, z: 0, half: 22 },
  fountain: { x: 0, z: 0, r: 6 },
  playerStart: { x: -6, z: 14, heading: Math.PI },
  garage: { x: 0, z: -70 },          // Mara's garage (delivery point, on road x=0)
  garageBldg: { x: 13, z: -70 },
  marinaPoint: { x: 185, z: -100 },
  neonSport: { x: 186, z: -92, heading: Math.PI / 2 },
  docksPoint: { x: 178, z: 150 },
  cashCrates: { x: 186, z: 158 },
  palmAvenueX: 100,
  startMoney: 150,
  saveKey: 'solmar-save-v1',
  startHour: 17.82, // 05:49 PM sunset
};

// Real street network — used by city.js to lay roads AND by hud.js to draw the minimap.
export const ROADS_V = [-150, -100, -50, 0, 50, 100, 150]; // north-south roads (x), z -170..170
export const ROADS_H = [-150, -100, -50, 0, 50, 100, 150]; // east-west roads (z), x -170..170
export const ROAD_W = 10;
export const SPURS = [
  { kind: 'v', x: 185, z0: -150, z1: -50, w: 8 },   // marina road
  { kind: 'h', z: 150, x0: 150, x1: 208, w: 10 },  // docks road
  { kind: 'v', x: 170, z0: 100, z1: 150, w: 8 },   // docks connector
];

// Parked cars: [x, z, heading, model]
export const PARKED = [
  [5.5, 40, 0, 'sedan'], [ -5.5, 62, Math.PI, 'hatch'], [55.5, -30, 0, 'taxi'],
  [105.5, 80, 0, 'pickup'], [-45.5, -80, Math.PI, 'van'], [155.5, 20, 0, 'sedan'],
  [-105.5, 110, Math.PI, 'hatch'], [5.5, -120, 0, 'sedan'], [45.5, 140, 0, 'taxi'],
  [-155.5, -40, Math.PI, 'pickup'],
];

export const CAR_MODELS = {
  sedan:  { color: 0xc23b2e, top: 22, accel: 14, grip: 1.0, name: 'Solmar Sedan' },
  hatch:  { color: 0x3e7cc2, top: 20, accel: 13, grip: 1.0, name: 'Breeze Hatch' },
  taxi:   { color: 0xf2b705, top: 21, accel: 13, grip: 1.0, name: 'Sun Cab' },
  pickup: { color: 0x5a7d4f, top: 19, accel: 12, grip: 0.95, name: 'Dune Pickup' },
  van:    { color: 0xd8d3c8, top: 17, accel: 11, grip: 0.9, name: 'Harbor Van' },
  sport:  { color: 0xffc400, top: 30, accel: 19, grip: 1.15, name: 'Neon Sport' },
  cruiser:{ color: 0x1c2733, top: 26, accel: 17, grip: 1.1, name: 'SPD Cruiser' },
};

export const MISSIONS = [
  {
    id: 0, chapter: 'CHAPTER 1 — WHEELS FOR MARA', title: 'Steal a car for Mara',
    stages: [
      { text: 'Steal any car — press E near one', sub: 'Parked cars line Palm Avenue' },
      { text: 'Deliver the car to Mara\u2019s garage', sub: 'Follow the gold blip on the minimap' },
    ],
    reward: 500,
  },
  {
    id: 1, chapter: 'CHAPTER 2 — NEON HEAT', title: 'Grab the Neon Sport',
    stages: [
      { text: 'Take the Neon Sport at the marina', sub: 'It is parked by the water, x185' },
      { text: 'Lose the police — break line of sight', sub: 'Stay unseen until the heat dies' },
    ],
    reward: 0,
  },
  {
    id: 2, chapter: 'CHAPTER 3 — HARBOUR HEIST', title: 'Raid the Vane cash crates',
    stages: [
      { text: 'Grab the cash at the docks — guards are armed', sub: 'Click to shoot. Crates by the water.' },
      { text: 'Get clear of the docks', sub: 'The cash is yours. Drive!' },
    ],
    reward: 3500,
  },
];

export const DIALOGUES = {
  start: { who: 'Mara', text: 'Mara: Dario! I need wheels — steal a car and bring it to my garage.' },
  neon: { who: 'Kito', text: 'Kito: That Neon Sport is hot — lose the cops!' },
  harbor: { who: 'Kito', text: 'Kito: The cash is in the crates by the water — grab it fast, the guards are armed!' },
  delivered: { who: 'Mara', text: 'Mara: Perfect. You always come through, brother.' },
  evaded: { who: 'Kito', text: 'Kito: Clean. Nobody saw a thing.' },
  heistDone: { who: 'Dario', text: 'Dario: The Vanes just funded our whole summer.' },
  busted: { who: 'Kito', text: 'Kito: They booked you and let you walk. Lay low, Dario.' },
};

export const PEOPLE = {
  dario: { shirt: 0xffffff, pants: 0x23283a, skin: 0xd9a066, hair: 0x1a1210 },
  mara: { shirt: 0xe85d75, pants: 0x2b3a55, skin: 0xe8b98a, hair: 0x3a1f16 },
  kito: { shirt: 0x2fa36b, pants: 0x333333, skin: 0x8a5a3b, hair: 0x0d0d0d },
  guard: { shirt: 0x7a1f1f, pants: 0x1c1c1c, skin: 0xc98d5f, hair: 0x111111 },
};
