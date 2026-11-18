// Solmar: a sunny coastal city. Grid streets, a central plaza with a
// fountain, a palm avenue, a marina to the north-east and docks to the
// south-east, sea beyond the east edge. Buildings sit INSIDE their blocks
// with a clear margin — never centred on a road line (that trapped the
// player in the first build).
import { CONFIG } from './config.js';
import { mulberry32, range, pick } from './rng.js';

const ROAD_COORDS = [-150, -100, -50, 0, 50, 100, 150];
const BLOCK_CENTERS = [-175, -125, -75, -25, 25, 75, 125, 175];
const BUILDING_COLORS = [0xd8c9a3, 0xc9b18a, 0xb7c4c9, 0xd8a38a, 0xa3b8a3, 0xc9a3b8, 0xe0d6c0, 0x9ab8c9];

function box(THREE, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

export function buildCity(scene, THREE) {
  const rand = mulberry32(20261117);
  const colliders = [];
  const palms = [];

  // Sky, light, fog.
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x87bfe8, 260, 520);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440),
    new THREE.MeshLambertMaterial({ color: 0x9aa88a })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Sea to the east.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 460),
    new THREE.MeshLambertMaterial({ color: 0x1f7fb8 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(320, 0.1, 0);
  scene.add(sea);

  // Roads: dark strips along the grid, slightly above the ground.
  for (const c of ROAD_COORDS) {
    const roadNS = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.world.roadWidth, 400),
      new THREE.MeshLambertMaterial({ color: 0x3c3f45 })
    );
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(c, 0.05, 0);
    scene.add(roadNS);
    const roadEW = new THREE.Mesh(
      new THREE.PlaneGeometry(400, CONFIG.world.roadWidth),
      new THREE.MeshLambertMaterial({ color: 0x3c3f45 })
    );
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.05, c);
    scene.add(roadEW);
  }

  // Plaza: pale stone disc at the centre.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(19, 19, 0.3, 28),
    new THREE.MeshLambertMaterial({ color: 0xdccfae })
  );
  plaza.position.set(0, 0.15, 0);
  scene.add(plaza);

  // Fountain: stone basin, water disc, centre column.
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0xbfb49a })
  );
  basin.position.set(0, 0.55, 0);
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.25, 20),
    new THREE.MeshLambertMaterial({ color: 0x3fa8d8 })
  );
  water.position.set(0, 1.0, 0);
  scene.add(water);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.9, 2.6, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8cdb2 })
  );
  column.position.set(0, 1.9, 0);
  scene.add(column);
  colliders.push({ minX: -6.5, maxX: 6.5, minZ: -6.5, maxZ: 6.5 });

  // Buildings, one or two per block, kept well inside the block.
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      // Plaza block stays open; marina / docks blocks stay open too.
      if (bx === -25 && bz === -25) continue;
      if (bx === 175 && bz === -125) continue;
      if (bx === 175 && bz === 125) continue;
      if (bx === 175 && bz === 175) continue;
      const n = rand() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = range(rand, 10, 16);
        const d = range(rand, 10, 16);
        const h = range(rand, 8, 30);
        const ox = range(rand, -6, 6) + (i === 1 ? (w / 2 + 4) * (rand() < 0.5 ? -1 : 1) : 0);
        const oz = range(rand, -6, 6) + (i === 1 ? (d / 2 + 4) * (rand() < 0.5 ? -1 : 1) : 0);
        // Clamp the centre so the whole building stays inside its block
        // with a 3 m margin — a second building must never spill onto a road.
        const cx = Math.max(bx - 20 + w / 2 + 3, Math.min(bx + 20 - w / 2 - 3, bx + ox));
        const cz = Math.max(bz - 20 + d / 2 + 3, Math.min(bz + 20 - d / 2 - 3, bz + oz));
        const color = pick(rand, BUILDING_COLORS);
        const b = box(THREE, w, h, d, color, cx, h / 2, cz);
        scene.add(b);
        const roof = box(THREE, w * 0.9, 0.6, d * 0.9, 0x6b5a48, cx, h + 0.3, cz);
        scene.add(roof);
        colliders.push({
          minX: cx - w / 2 - 0.4, maxX: cx + w / 2 + 0.4,
          minZ: cz - d / 2 - 0.4, maxZ: cz + d / 2 + 0.4,
        });
      }
    }
  }

  // Palm avenue along x = 100, both sides of the road.
  for (let z = -175; z <= 175; z += 25) {
    for (const px of [94, 106]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 7, 7),
        new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
      );
      trunk.position.set(px, 3.5, z);
      scene.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 3.2, 7),
        new THREE.MeshLambertMaterial({ color: 0x3f9a4a })
      );
      crown.position.set(px, 8.2, z);
      scene.add(crown);
      palms.push({ x: px, z });
    }
  }

  // Street lamps at the main intersections + benches around the plaza.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x776622 });
  for (const [lx, lz] of [[-56, -56], [56, -56], [-56, 56], [56, 56], [-106, 106], [106, -106]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), lampMat);
    pole.position.set(lx, 2.5, lz);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
    bulb.position.set(lx, 5.1, lz);
    scene.add(bulb);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bench = box(THREE, 2.2, 0.5, 0.7, 0x7a5a3a, Math.sin(a) * 13, 0.45, Math.cos(a) * 13);
    bench.rotation.y = -a;
    scene.add(bench);
  }

  // Marina (north-east): wooden pier + moored boats.
  const pier = box(THREE, 26, 0.8, 8, 0x8a6a42, 196, 0.4, -100);
  scene.add(pier);
  for (let i = 0; i < 3; i++) {
    const hull = box(THREE, 9, 1.4, 3, 0xe8e8e8, 214, 0.7, -116 + i * 16);
    scene.add(hull);
    const mast = box(THREE, 0.3, 6, 0.3, 0x5a4a3a, 214, 3.5, -116 + i * 16);
    scene.add(mast);
  }
  colliders.push({ minX: 183, maxX: 209, minZ: -104, maxZ: -96 });

  // Docks (south-east): crates and containers.
  const crateSpots = [
    [186, 158, 3, 2.4], [190, 152, 2.4, 2.4], [182, 164, 2.6, 2.2],
    [176, 156, 2.2, 2.2], [194, 162, 2.4, 2.4], [180, 148, 2.2, 2.2],
  ];
  for (const [cx, cz, w, h] of crateSpots) {
    const crate = box(THREE, w, h, w, 0xb08a3a, cx, h / 2, cz);
    scene.add(crate);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - w / 2, maxZ: cz + w / 2 });
  }
  const containerColors = [0x2a6ea5, 0xc95a2a, 0x4a8a3a];
  for (let i = 0; i < 3; i++) {
    const c = box(THREE, 12, 2.6, 2.6, containerColors[i], 172, 1.3, 138 + i * 14);
    scene.add(c);
    colliders.push({ minX: 166, maxX: 178, minZ: 136.7 + i * 14, maxZ: 139.3 + i * 14 });
  }

  // A few palms at the docks and marina for the harbour shot.
  for (const [px, pz] of [[168, 168], [196, 132], [196, -84], [170, -118]]) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
    );
    trunk.position.set(px, 3.5, pz);
    scene.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x3f9a4a })
    );
    crown.position.set(px, 8.2, pz);
    scene.add(crown);
    palms.push({ x: px, z: pz });
  }

  return {
    colliders,
    palms,
    plaza: { x: 0, z: 0 },
    fountain: { x: 0, z: 0 },
    marina: { x: 196, z: -100 },
    docks: { x: 178, z: 150 },
  };
}

// Circle (player / car) vs AABB colliders.
export function hitsCollider(x, z, r, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

export function clampToCity(x, z) {
  const h = CONFIG.world.half;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}
