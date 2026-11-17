// config.js — every tunable number and the city's static layout in one place.
// Solmar is an original fictional city: nothing here comes from any commercial game.

export const WORLD = {
  size: 420,            // playable square, metres (x and z from -210 to +210)
  roadStep: 42,         // distance between parallel streets
  roadWidth: 10,
  blockSize: 32,
  seaAt: 190,           // z > seaAt is the beach + ocean
  seed: 1337,
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.6,
  maxHealth: 100,
  startMoney: 150,
  startPos: { x: 0, z: 42 },
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseMax: 12,
  maxSpeed: 46,
  steerMax: 0.55,
  grip: 6.5,
};

export const WANTED = {
  maxStars: 5,
  decayDelaySec: 14,    // seconds unseen before a star drops
  bustRange: 2.2,       // cop on foot this close busts you (if you are slow)
  copCarsPerStar: [0, 1, 2, 3, 4, 5],
  footCopsPerStar: [0, 0, 1, 2, 3, 4],
};

export const TRAFFIC = { cars: 16, pedestrians: 26, parkedCars: 14 };

export const SAVE_KEY = 'solmar-save-v1';

// Street names for the HUD / minimap flavour (all invented).
export const STREET_NAMES = [
  'Coral Row', 'Palm Avenue', 'Harbor Drive', 'Sunset Boulevard', 'Marina Walk',
  'Cactus Lane', 'Flamingo Street', 'Bayview Road', 'Jacaranda Way', 'Neon Mile',
];

// Original car models (invented names, colours, stats).
export const CAR_MODELS = [
  { name: 'Coral Coupe',    color: 0xff5a3c, top: 44, accel: 26, seats: 2, value: 900 },
  { name: 'Bay Sedan',      color: 0x3c7dff, top: 40, accel: 22, seats: 4, value: 650 },
  { name: 'Sun Taxi',       color: 0xffc21c, top: 38, accel: 20, seats: 4, value: 500, taxi: true },
  { name: 'Palm Pickup',    color: 0x3fae5a, top: 38, accel: 21, seats: 2, value: 700 },
  { name: 'Neon Sport',     color: 0xb44dff, top: 50, accel: 32, seats: 2, value: 2400 },
  { name: 'Harbor Van',     color: 0xd8d8d8, top: 34, accel: 17, seats: 4, value: 550 },
  { name: 'Dune Buggy',     color: 0xff8c1a, top: 42, accel: 28, seats: 2, value: 1100 },
];

// Pedestrian outfit palette.
export const PED_COLORS = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xf78c6b, 0x8e6cc8, 0xe9ecef, 0x2b2d42];

export const MISSIONS = [
  {
    id: 'm1', title: 'MISSION 1 — FIRST WHEELS', giver: 'Mara',
    briefing: 'Mara: "Dario. My tow truck died and the Vane boys took my best coupe. Steal any car on Coral Row and bring it to my garage — the yellow marker. Don\'t let the cops see you take it."',
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)', sub: 'Any parked or traffic car works. Watch for police.' },
      { kind: 'goto', text: 'Drive the stolen car to Mara\'s Garage', sub: 'Follow the yellow marker on the minimap.' },
    ],
    reward: 500,
  },
  {
    id: 'm2', title: 'MISSION 2 — THE PAYBACK RUN', giver: 'Kito',
    briefing: 'Kito: "Vane\'s crew stashed a sports car at the marina — a Neon Sport, worth real money. Grab it, then lose the cops. The whole harbour will be hot. Drive like you mean it."',
    steps: [
      { kind: 'goto', text: 'Reach the Marina pickup point', sub: 'The Neon Sport is parked by the docks.' },
      { kind: 'steal', text: 'Steal the Neon Sport', sub: 'Taking it trips the alarm — wanted level 2.' },
      { kind: 'escape', text: 'Lose the police (wanted level back to 0)', sub: 'Break line of sight and stay hidden until the stars drop.' },
      { kind: 'goto', text: 'Deliver the Neon Sport to Kito\'s lockup', sub: 'North-east corner of the city.' },
    ],
    reward: 1200,
  },
  {
    id: 'm3', title: 'MISSION 3 — HARBOR HEIST', giver: 'Kito',
    briefing: 'Kito: "Tonight we take the harbour back. Vane\'s cash is in the dock office, guarded. Get in, grab the money, and get out. They will shoot — so will you. Good luck, brother."',
    steps: [
      { kind: 'goto', text: 'Reach the dock office at the harbour', sub: 'Vane\'s guards are waiting. Bring your pistol.' },
      { kind: 'combat', text: 'Take out the guards and grab the cash', sub: 'Shoot the guards (click to fire), then walk over the cash.' },
      { kind: 'escape', text: 'Escape the police dragnet (wanted level back to 0)', sub: 'Three stars. Use a fast car.' },
      { kind: 'goto', text: 'Bring the cash to Mara\'s Garage', sub: 'The crew is waiting. This is the big one.' },
    ],
    reward: 3500,
  },
];

export const STORY_END =
  'The harbour is yours again. The Vane family leaves Solmar by morning, and the sun comes up over a city that finally feels like home. Dario Voss — wheelman, brother, legend of Coral Row. THE END... for now. Free roam continues — keep stealing cars, earning cash and dodging the Solmar Police.';
