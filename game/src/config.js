// SOLMAR — Streets of the Sun. Shared tuning + world layout.
// Original city of Solmar: plaza, Palm Avenue, marina, docks. Nothing from
// any other game: all names, places and numbers below are our own.
//
// REBUILD 13 — eight named story missions (was 3), two more districts
// (Neon Row, Sunset Heights), and a clean 17:40 golden-hour start. The
// clock still lives inside the 16:30–19:30 golden band forever, and the
// sun sits low in the WEST, off the north–south Palm Avenue sightlines,
// so a driver never stares straight into a washed-out disc.
export const CONFIG = {
  world: { minX: -230, maxX: 230, minZ: -170, maxZ: 170, seaX: 205 },
  // Road centre-lines. Buildings are always placed INSIDE blocks, inset from
  // these lines, so no building ever sits on a road.
  roadsX: [-150, -100, -50, 0, 50, 100, 150],
  roadsZ: [-120, -80, -40, 0, 40, 80, 120],
  roadWidth: 9,
  plaza: { x: 0, z: 0, r: 16 },
  fountain: { x: 0, z: 0, r: 5 },
  playerStart: { x: 0, z: 8, heading: 0 },
  startMoney: 150,
  // Golden hour band: hour wraps inside it, so the light never leaves
  // sunset. Sun azimuth: due west (-X), low — off the main sightlines.
  // Rebuild 13: the start is a clean 17:40 (hour 17, minute 40), never a
  // fractional hour that could read as a morning time on the HUD.
  goldenHour: { start: 16.5, end: 19.5, defaultHour: 17, defaultMinute: 40 },
  sun: { azimuthWest: true, elevationDeg: 11, color: 0xff9a50, intensity: 1.55 },
  // Mission 1: steal the sunset-orange GT parked on the -50 road, deliver
  // it to Mara's garage at the south end of the same road.
  m1Car: { x: -50, z: 10, model: 'sedan', color: 0xe87a2a },
  m1Garage: { x: -50, z: 60, r: 7 },
  m1Reward: 500,
  // Mission 2: the Neon Sport waits at the marina; stealing it is hot.
  m2Car: { x: 180, z: 60, model: 'sport', color: 0xff2fb3 },
  m2Reward: 800,
  // Mission 3: harbour heist. Four armed guards, cash crate at the docks.
  m3Cash: { x: 188, z: -80, r: 5 },
  m3Reward: 3500,
  // Rebuild 13 — missions 4–8 (state machines live in missions.js):
  // M4 Paint It Gold: repaint any car at Mara's garage (press C in the car).
  m4Reward: 600,
  // M5 Marina Sprint: win the east-road street race (race2).
  m5Reward: 700,
  // M6 Badge Trouble: get the cops hot (2+ stars), then lose them clean.
  m6Reward: 900,
  // M7 Shell Game: find 3 more Sun Shells for DJ Marea.
  m7Shells: 3,
  m7Reward: 500,
  // M8 King of the Sunset: win the Palm Avenue sprint (race 1). Final.
  m8Reward: 5000,
  guards: [
    { x: 170, z: -70 }, { x: 186, z: -96 }, { x: 202, z: -66 }, { x: 176, z: -92 },
  ],
  // Side jobs — extra ways to earn, all optional.
  taxiPickup: { x: 6, z: 14, r: 5 },
  taxiDropoff: { x: 100, z: 118, r: 7 },
  taxiReward: 120,
  courierPickup: { x: 176, z: -70, r: 4 },
  courierDropoff: { x: 170, z: 40, r: 6 },
  courierReward: 150,
  raceStart: { x: 0, z: 120, r: 7 },
  raceCheckpoints: [{ x: 0, z: 40 }, { x: 0, z: -40 }, { x: 0, z: -120 }],
  raceReward: 400,
  // Second race (rebuild 12): the Marina Sprint, east edge of the city.
  race2Start: { x: 150, z: 100, r: 7 },
  race2Checkpoints: [{ x: 150, z: 0 }, { x: 150, z: -120 }, { x: 50, z: -120 }],
  race2Reward: 500,
  packages: [
    { x: -100, z: 40 }, { x: 50, z: -40 }, { x: 150, z: 80 },
    { x: -150, z: -80 }, { x: 100, z: -120 },
  ],
  packageReward: 250,
  // Ten golden Sun Shells hidden around Solmar (rebuild 12 collectibles).
  // Finding all ten pays a bonus and a full respect rank.
  shells: [
    { x: -12, z: 14 }, { x: 8, z: -16 }, { x: -104, z: 84 }, { x: 54, z: 44 },
    { x: -154, z: -44 }, { x: 104, z: -84 }, { x: 196, z: 24 }, { x: 174, z: -108 },
    { x: -46, z: -124 }, { x: 208, z: 116 },
  ],
  shellReward: 25,
  shellsBonus: 500,
  safehouse: { x: -50, z: 60, r: 7 }, // Mara's garage doubles as safehouse
  // Garage paint shop (rebuild 12): repaint the car you're driving for $50.
  paintCost: 50,
  paints: [
    { name: 'Sunset Orange', color: 0xe87a2a },
    { name: 'Coral Pink', color: 0xff5a8a },
    { name: 'Marina Teal', color: 0x2a9a8a },
    { name: 'Palm Gold', color: 0xffd23f },
    { name: 'Midnight Purple', color: 0x7a4a9a },
    { name: 'Arctic White', color: 0xe8e8e8 },
  ],
  walkSpeed: 6.5,
  runSpeed: 9.5,
  carAccel: 15,
  carBrake: 26,
  carMaxSpeed: 27,
  sportMaxSpeed: 36,
  carSteer: 1.9,
  trafficCount: 22,
  pedCount: 40,
  saveKey: 'solmar-save-v1',
  autosaveSecs: 30,
  // Respect ranks (rebuild 12): earn respect from missions, jobs, shells
  // and paint jobs. Rank 2 unlocks the Rifle.
  respectRanks: ['NOBODY', 'STREET', 'KNOWN', 'FEARED', 'LEGEND OF SOLMAR'],
  respectPerRank: 40,
  weapons: {
    pistol: { name: 'Pistol', damage: 34, cooldown: 0.32, range: 70, spread: 0.012, pellets: 1, auto: false },
    smg: { name: 'SMG', damage: 18, cooldown: 0.09, range: 60, spread: 0.05, pellets: 1, auto: true },
    shotgun: { name: 'Shotgun', damage: 22, cooldown: 0.85, range: 34, spread: 0.09, pellets: 5, auto: false },
    rifle: { name: 'Rifle', damage: 55, cooldown: 0.7, range: 110, spread: 0.004, pellets: 1, auto: false },
  },
};

// Named story missions, each with a giver and an opening line.
// Rebuild 13: eight missions (was three) — every one has a named contact
// and a clear objective line, the way a full story mode should.
export const MISSION_DEFS = [
  { id: 1, name: 'A Car for Mara', giver: 'MARA',
    intro: 'Dario! The Vanes took my car. Steal me a ride and bring it to my garage — south end of the road, you know the one.' },
  { id: 2, name: 'Neon Nights', giver: 'KITO',
    intro: 'The Neon Sport is sitting at the marina, all pink and loud. Grab it — and when the cops come, and they will come, lose them.' },
  { id: 3, name: 'Harbour Heist', giver: 'KITO',
    intro: 'Four guards on the Vanes\' harbour cash at the docks. Take them down, grab the crate, and we are rich, brother.' },
  { id: 4, name: 'Paint It Gold', giver: 'MARA',
    intro: 'A stolen car still looks stolen. Bring any car to my garage and give it a fresh coat — press C in the paint shop and it\'s yours.' },
  { id: 5, name: 'Marina Sprint', giver: 'MARSHAL',
    intro: 'The Marina Sprint starts on the east road, kid. Beat my course — all three checkpoints — and the docks crowd will know your name.' },
  { id: 6, name: 'Badge Trouble', giver: 'FIXER',
    intro: 'The Vanes paid Solmar PD to lean on you. Get them hot — two stars, at least — then lose them clean. Show the city you can\'t be caught.' },
  { id: 7, name: 'Shell Game', giver: 'MAREA',
    intro: 'DJ Marea here — the Sun Shells are Solmar\'s gold, baby. Find me three more and I\'ll put your name on the radio tonight.' },
  { id: 8, name: 'King of the Sunset', giver: 'KITO',
    intro: 'Last one, brother. The Palm Avenue sprint — win it and the whole city is yours. No brakes, no mercy. Make me proud.' },
];

export const MISSION_TEXT = [
  'NEXT: A CAR FOR MARA — Mara: steal a car and bring it to her garage.',
  'NEXT: NEON NIGHTS — Kito: grab the Neon Sport at the marina, then lose the police.',
  'NEXT: HARBOUR HEIST — Kito: take down the 4 guards and grab the cash at the docks.',
  'NEXT: PAINT IT GOLD — Mara: repaint a car at her garage (drive in, press C).',
  'NEXT: MARINA SPRINT — Marshal: win the east-road street race (3 checkpoints).',
  'NEXT: BADGE TROUBLE — Fixer: get 2+ wanted stars, then lose the cops clean.',
  'NEXT: SHELL GAME — DJ Marea: find 3 more Sun Shells around Solmar.',
  'NEXT: KING OF THE SUNSET — Kito: win the Palm Avenue sprint. Final race.',
  'SOLMAR IS YOURS — story complete: side jobs, races, shells and the paint shop pay across the city.',
];

export const DISTRICTS = [
  { name: 'DOWNTOWN', street: 'Brisa Blvd', x: -150, z: -60, tall: true },
  { name: 'OLD TOWN', street: 'Calle Luna', x: -100, z: 60, tall: false },
  { name: 'PALM AVENUE', street: 'Palm Ave', x: 0, z: 0, tall: false },
  { name: 'MARINA', street: 'Marina Dr', x: 180, z: 60, tall: false },
  { name: 'DOCKS', street: 'Dock Rd', x: 185, z: -85, tall: false },
  { name: 'BEACHSIDE', street: 'Shore Dr', x: 150, z: 120, tall: false },
  // Rebuild 13: Neon Row (south, the bright strip) and Sunset Heights
  // (north, the tall end of town) fill the map's last blank corners.
  { name: 'NEON ROW', street: 'Neon St', x: 0, z: 130, tall: false },
  { name: 'SUNSET HEIGHTS', street: 'Heights Rd', x: -100, z: -130, tall: true },
];

// Nearest district + street name for any map position (HUD + minimap).
export function districtAt(x, z) {
  let best = DISTRICTS[2], bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
export function streetNameAt(x, z) {
  // Closest road line wins; ties break to the avenue.
  let best = 'Palm Ave', bd = Math.abs(x);
  const named = [[-150, 'Brisa Blvd'], [-100, 'Calle Luna'], [-50, 'Garage Row'], [50, 'Sol Blvd'], [100, 'Hotel Row'], [150, 'Marina Dr']];
  for (const [rx, name] of named) {
    const dd = Math.abs(x - rx);
    if (dd < bd) { bd = dd; best = name; }
  }
  const namedZ = [[-140, 'Heights Rd'], [-120, 'Northgate'], [-80, 'Dock Rd'], [-40, 'Luna St'], [40, 'Plaza St'], [80, 'Marina Dr'], [120, 'Shore Dr'], [140, 'Neon St']];
  for (const [rz, name] of namedZ) {
    const dd = Math.abs(z - rz);
    if (dd < bd) { bd = dd; best = name; }
  }
  return best;
}
