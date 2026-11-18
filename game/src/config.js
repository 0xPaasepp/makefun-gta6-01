// SOLMAR config — world layout, districts, cars, missions, dialogue.
// Original city, original names. Nothing from any other game.
export const WORLD = {
  half: 240, seaX: 208, plaza: { x: 0, z: 0 },
  roads: [-150, -100, -50, 0, 50, 100, 150],
  roadHalf: 5, blockGap: 50,
};
export const DISTRICTS = [
  { name: 'Old Town', cx: -120, cz: -100, r: 90, kind: 'residential', palette: [0xd8c9a3, 0xc9b18a, 0xe0d3b0] },
  { name: 'Palm Avenue', cx: 0, cz: 60, r: 80, kind: 'commercial', palette: [0x9fb4c7, 0xb7c9d8, 0x8fa8bd] },
  { name: 'Marina', cx: 170, cz: 90, r: 60, kind: 'commercial', palette: [0x7fb3c8, 0x9cc8d8, 0x6ba3b8] },
  { name: 'Harbour', cx: 170, cz: -110, r: 70, kind: 'industrial', palette: [0x8a8a86, 0x9a938a, 0x7a7a72] },
  { name: 'Hillside', cx: -140, cz: 130, r: 80, kind: 'residential', palette: [0xe8dcc0, 0xd8c9a3, 0xcbb894] },
];
export const CAR_MODELS = {
  sedan:   { name: 'Solmar Sedan',   color: 0x3a6ea5, top: 0x2a4a6a, len: 4.4, wid: 1.9, accel: 11, topSpeed: 34, grip: 2.6, price: 1200 },
  hatch:   { name: 'Civic Hatch',    color: 0xc0392b, top: 0x7a1f16, len: 3.8, wid: 1.8, accel: 12, topSpeed: 32, grip: 2.9, price: 900 },
  taxi:    { name: 'Sun Taxi',       color: 0xf1c40f, top: 0x111111, len: 4.4, wid: 1.9, accel: 11, topSpeed: 33, grip: 2.6, price: 1100 },
  pickup:  { name: 'Dune Pickup',    color: 0x7d6608, top: 0x4a3d05, len: 4.8, wid: 2.0, accel: 10, topSpeed: 31, grip: 2.4, price: 1500 },
  van:     { name: 'Cargo Van',      color: 0x7f8c8d, top: 0x5d6d7e, len: 5.0, wid: 2.1, accel: 8,  topSpeed: 28, grip: 2.2, price: 1400 },
  sport:   { name: 'Neon Sport',     color: 0x00e5ff, top: 0x0a2a33, len: 4.2, wid: 2.0, accel: 16, topSpeed: 46, grip: 3.4, price: 8000 },
  cruiser: { name: 'Police Cruiser', color: 0x1a1a2e, top: 0x0f0f1a, len: 4.6, wid: 2.0, accel: 13, topSpeed: 38, grip: 3.0, price: 0 },
};
export const PARKED_CARS = [
  { model: 'sedan', x: -50, z: 10, angle: 0 },   // M1 target car, on road x=-50 facing south
  { model: 'hatch', x: -60, z: -44, angle: 0 },
  { model: 'taxi', x: 8, z: -52, angle: Math.PI },
  { model: 'pickup', x: 108, z: 44, angle: Math.PI / 2 },
  { model: 'van', x: -108, z: 108, angle: 0 },
  { model: 'sedan', x: 56, z: 104, angle: Math.PI },
  { model: 'hatch', x: -156, z: -8, angle: Math.PI / 2 },
  { model: 'sport', x: 180, z: 60, angle: -Math.PI / 2 },  // M2 Neon Sport, marina
  { model: 'sedan', x: 148, z: -148, angle: 0 },
  { model: 'taxi', x: -48, z: 148, angle: Math.PI },
];
export const MISSIONS = [
  { id: 0, name: 'A Car for Mara', blip: { x: -50, z: 60 },
    text: 'M1: Steal a car and deliver it to Mara\'s garage (yellow marker).',
    done: 'Delivered. Mara: "Clean work, Dario. The Vanes won\'t know what hit them."' },
  { id: 1, name: 'Neon Nights', blip: { x: 180, z: 60 },
    text: 'M2: Grab the Neon Sport at the marina — then LOSE THE POLICE.',
    done: 'You lost them. Kito: "That Neon Sport sings. The Vanes want it back — keep it moving."' },
  { id: 2, name: 'Harbour Heist', blip: { x: 190, z: -80 },
    text: 'M3: Hit the harbour crates. Four Vane guards. Take the cash (+$3,500).',
    done: 'Heist done. +$3,500. Mara: "We\'re out, Dario. Solmar is ours tonight."' },
];
export const DIALOGUES = {
  intro: { who: 'MARA', text: 'Dario — the Vanes took our garage. Steal a car, any car, and bring it to my marker. We start tonight.' },
  m1done: { who: 'MARA', text: 'Clean work. Now the Neon Sport at the marina — Kito says the Vanes park it there at dusk.' },
  m2start: { who: 'KITO', text: 'That Neon Sport is Vane property. Take it and the whole harbour precinct will be on you. Lose them!' },
  m2done: { who: 'KITO', text: 'You shook every cruiser in Solmar. Beautiful. One last job: the harbour crates.' },
  m3start: { who: 'KITO', text: 'Four armed guards on the crates. Stay low, use the pistol, grab the cash.' },
  m3done: { who: 'MARA', text: 'We did it, Dario. $3,500 — the garage is ours again.' },
  busted: { who: 'SOLMAR PD', text: 'You\'re busted, Voss. The Vanes own the courts, but tonight the cells own you. -$200 bail.' },
  trial: { who: 'KITO', text: 'Sunset Sprint! Hit all 5 rings before the clock dies. $300 if you\'re fast enough.' },
};
export const PEOPLE_NAMES = ['Ana', 'Beto', 'Celia', 'Dante', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Ines', 'Jules', 'Kira', 'Leo', 'Mina', 'Nico', 'Olga', 'Paco', 'Rosa', 'Sven', 'Tara', 'Umar', 'Vera', 'Wes', 'Yara', 'Zeke'];
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const START_MONEY = 150;
export const SAVE_KEY = 'solmar-save-v1';
