// SOLMAR — Streets of the Sun. World constants, coordinates, story data.
// Everything here is original: own city, own names, own story. Nothing from
// Rockstar / GTA: no GTA names, characters, map, art or music.

export const CONFIG = {
  world: { minX: -210, maxX: 210, minZ: -210, maxZ: 210 },
  // Key coordinates (x = east, z = south; north is -z).
  playerStart: { x: -6, z: 14 },
  fountain: { x: 0, z: 0 },
  garage: { x: 0, z: -70 },
  marina: { x: 185, z: -100 },
  neonSport: { x: 186, z: -92 },
  docks: { x: 178, z: 150 },
  cashCrates: { x: 186, z: 158 },
  startMoney: 150,
  roadWidth: 10,
  // Road centre lines. Buildings live ONLY inside the blocks between these
  // lines, set back from the edges, so nobody spawns trapped on a road.
  roadsX: [-150, -90, -30, 30, 90, 150],
  roadsZ: [-150, -90, -30, 30, 90, 150],
  // The central block (between -30 and 30 on both axes) is the plaza.
  plaza: { minX: -28, maxX: 28, minZ: -28, maxZ: 28 },

  districts: [
    { name: 'Old Plaza', x: -30, z: -30, w: 60, h: 60, color: '#f2a65a' },
    { name: 'Palm Avenue', x: -40, z: -150, w: 20, h: 300, color: '#2ec4b6' },
    { name: 'Marina Bay', x: 150, z: -150, w: 60, h: 110, color: '#48cae4' },
    { name: 'Harbour Docks', x: 150, z: 110, w: 60, h: 100, color: '#e07a5f' },
    { name: 'Sunset Heights', x: -210, z: -210, w: 120, h: 120, color: '#ff8fa3' },
    { name: 'Vane Row', x: 60, z: -210, w: 150, h: 120, color: '#b388eb' },
    { name: 'Coral Market', x: -210, z: 60, w: 120, h: 150, color: '#ffd166' },
    { name: 'South Beach', x: 60, z: 90, w: 150, h: 120, color: '#06d6a0' },
  ],

  // Seven original car models. No real-world makes.
  carModels: [
    { id: 'city', name: 'Solmar City', len: 3.6, wid: 1.7, color: 0x4a90d9, top: 0.55, price: 2200 },
    { id: 'sedan', name: 'Coral Sedan', len: 4.2, wid: 1.8, color: 0xc0392b, top: 0.6, price: 4800 },
    { id: 'taxi', name: 'Solmar Cab', len: 4.0, wid: 1.8, color: 0xf1c40f, top: 0.6, price: 3900 },
    { id: 'sport', name: 'Neon Sport', len: 4.4, wid: 1.9, color: 0xf7d117, top: 0.5, price: 24000 },
    { id: 'pickup', name: 'Dune Pickup', len: 4.6, wid: 1.9, color: 0x7f8c8d, top: 0.7, price: 9100 },
    { id: 'van', name: 'Harbour Van', len: 4.8, wid: 2.0, color: 0xeaf2f8, top: 0.9, price: 6500 },
    { id: 'cruiser', name: 'Solmar Cruiser', len: 4.3, wid: 1.9, color: 0x1c2733, top: 0.6, price: 0 },
  ],

  radioStations: [
    { name: 'SOL FM 98.1', desc: 'Sunset drive', bpm: 96, root: 55 },
    { name: 'PALM 101', desc: 'Coast cruiser', bpm: 112, root: 65.41 },
    { name: 'NEON NIGHTS', desc: 'After dark', bpm: 128, root: 49 },
  ],

  policeUnits: ['UNIT 7', 'UNIT 12', 'UNIT 3', 'UNIT 21', 'UNIT 5', 'UNIT 9'],

  missions: [
    {
      id: 1, chapter: 'CHAPTER 1 — WHEELS FOR MARA', title: 'Steal a car for Mara',
      reward: 500, payoutText: '+$500',
      stages: [
        { key: 'steal', objective: 'Steal any car — press E near one', hint: 'Parked cars line Palm Avenue' },
        { key: 'deliver', objective: 'Deliver the car to Mara\'s garage', hint: 'Follow the gold blip on the minimap' },
      ],
    },
    {
      id: 2, chapter: 'CHAPTER 2 — NEON HEAT', title: 'Grab the Neon Sport',
      reward: 800, payoutText: '+$800',
      stages: [
        { key: 'grab', objective: 'Take the Neon Sport at the marina', hint: 'Yellow coupe, east pier' },
        { key: 'evade', objective: 'Lose the police — break line of sight', hint: 'Stay unseen until the heat dies' },
      ],
    },
    {
      id: 3, chapter: 'CHAPTER 3 — HARBOUR HEIST', title: 'Hit the Vane cash crates',
      reward: 3500, payoutText: '+$3,500',
      stages: [
        { key: 'heist', objective: 'Grab the cash at the docks — guards are armed', hint: 'Click to shoot. Crates by the water.' },
        { key: 'escape', objective: 'Get clear of the docks with the cash', hint: 'Lose the heat or outrun it' },
      ],
    },
  ],

  dialogue: {
    maraStart: 'Mara: Dario! I need wheels — steal a car and bring it to my garage.',
    kitoNeon: 'Kito: That Neon Sport is hot — lose the cops!',
    kitoHarbor: 'Kito: The cash is in the crates by the water — grab it fast, the guards are armed!',
    maraDone1: 'Mara: Perfect. You always come through, brother.',
    kitoDone2: 'Kito: Clean getaway. The Vanes will be furious.',
    kitoDone3: 'Kito: $3,500! We are eating good tonight, Dario.',
  },
};
