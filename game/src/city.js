// city.js — builds the whole of Solmar: streets, blocks, buildings, beach,
// ocean, palms, lights and props. All geometry is generated from a fixed seed,
// so the city is identical on every load. Also owns the road network that
// traffic, pedestrians and police drive and walk on.

import * as THREE from 'three';
import { WORLD, STREET_NAMES } from './config.js';
import { mulberry32, range, intRange, pick } from './rng.js';

const ROAD_COORDS = [];
for (let c = -4; c <= 4; c++) ROAD_COORDS.push(c * WORLD.roadStep);

export function isRoad(x, z) {
  const hw = WORLD.roadWidth / 2 + 1;
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) < hw || Math.abs(z - c) < hw) return true;
  }
  return false;
}

export function nearestRoadCoord(v) {
  let best = ROAD_COORDS[0], bd = Infinity;
  for (const c of ROAD_COORDS) { const d = Math.abs(v - c); if (d < bd) { bd = d; best = c; } }
  return best;
}

// Snap a point onto the nearest road centreline.
export function snapToRoad(x, z) {
  const dx = Math.abs(x - nearestRoadCoord(x));
  const dz = Math.abs(z - nearestRoadCoord(z));
  if (dx < dz) return { x: nearestRoadCoord(x), z, alongX: false };
  return { x, z: nearestRoadCoord(z), alongX: true };
}

export function buildingTexture(rng, baseColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // lit / dark windows
  for (let y = 12; y < 244; y += 18) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd97a' : '#9fd8ff') : 'rgba(10,16,28,0.85)';
      g.fillRect(x, y, 11, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#3a3e46';
  for (let i = 0; i < 900; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  // centre dashes both ways
  g.fillStyle = '#e8c93a';
  for (let y = 0; y < 256; y += 32) { g.fillRect(124, y, 8, 18); g.fillRect(124, y, 8, 18); }
  // edge lines
  g.fillStyle = '#d8d8d8';
  g.fillRect(6, 0, 3, 256); g.fillRect(247, 0, 3, 256);
  // crosswalk stripes near edges
  g.fillStyle = '#e8e8e8';
  for (let x = 20; x < 240; x += 24) { g.fillRect(x, 8, 12, 20); g.fillRect(x, 228, 12, 20); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(WORLD.seed);
    this.buildings = [];   // {x, z, w, d, h} for collision + minimap
    this.colliders = [];    // {x, z, r} circles
    this.palms = [];
    this.build();
  }

  build() {
    const rng = this.rng;
    const scene = this.scene;

    // Sky, sun, fog — a hot late-afternoon over the bay.
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0x9fc8e8, 180, 520);
    const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -230; sun.shadow.camera.right = 230;
    sun.shadow.camera.top = 230; sun.shadow.camera.bottom = -230;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbddcff, 0x8a6f4d, 1.1));
    this.sun = sun;

    // Ground: grass-ish base, then road strips, sidewalks and the beach.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.size + 260, WORLD.size + 260),
      new THREE.MeshLambertMaterial({ color: 0x7fae62 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 40);
    ground.receiveShadow = true;
    scene.add(ground);

    const roadTex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    for (const c of ROAD_COORDS) {
      for (const horizontal of [true, false]) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat.clone());
        seg.material.map = roadTex.clone();
        seg.material.map.repeat.set(WORLD.size / 12, 1);
        seg.material.map.needsUpdate = true;
        seg.rotation.x = -Math.PI / 2;
        if (horizontal) { seg.position.set(0, 0.01, c); }
        else { seg.rotation.z = Math.PI / 2; seg.position.set(c, 0.01, 0); }
        seg.receiveShadow = true;
        scene.add(seg);
      }
    }

    // Sidewalk slabs around every block. Blocks sit BETWEEN the roads:
    // block centres are at odd multiples of 21 (roads are at multiples of 42).
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    for (let bx = -5; bx <= 4; bx++) {
      for (let bz = -5; bz <= 3; bz++) {
        if (bx === 0 && bz === 0) continue; // the central plaza lives here
        const cx = bx * WORLD.roadStep + 21, cz = bz * WORLD.roadStep + 21;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(WORLD.blockSize + 4, 0.3, WORLD.blockSize + 4), walkMat);
        slab.position.set(cx, 0.1, cz);
        slab.receiveShadow = true;
        scene.add(slab);
      }
    }

    // Buildings: 1–4 per block, varied heights and warm pastel colours.
    const palette = ['#e8a87c', '#d9c27a', '#a8c8d8', '#e89aa0', '#c9b8e8', '#f2e3c9', '#9fc8a8', '#e8d8b0', '#7fb3d5', '#d98c8c'];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = -5; bx <= 4; bx++) {
      for (let bz = -5; bz <= 3; bz++) {
        if (bx === 0 && bz === 0) continue; // plaza block
        if (bx === -1 && bz === 1) continue; // Mara's garage block
        if (bx === 4 && bz === -5) continue; // Kito's lockup block
        const cx = bx * WORLD.roadStep + 21, cz = bz * WORLD.roadStep + 21;
        const n = intRange(rng, 1, 3);
        for (let i = 0; i < n; i++) {
          const w = range(rng, 10, 15), d = range(rng, 10, 15);
          const h = range(rng, 8, (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) ? 58 : 34);
          const ox = (i % 2 === 0 ? -1 : 1) * range(rng, 4, 8);
          const oz = (i < 2 ? -1 : 1) * range(rng, 4, 8);
          const x = cx + ox, z = cz + oz;
          const color = pick(rng, palette);
          const tex = buildingTexture(rng, color);
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2 + 0.2, z);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          // rooftop box (AC unit / penthouse)
          if (rng() < 0.6) {
            const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x5a5f66 }));
            roof.scale.set(w * 0.3, 2, d * 0.3);
            roof.position.set(x + range(rng, -2, 2), h + 1.2, z + range(rng, -2, 2));
            scene.add(roof);
          }
          this.buildings.push({ x, z, w, d, h });
          this.colliders.push({ x, z, r: Math.max(w, d) * 0.45 });
        }
      }
    }

    // Central plaza: fountain + palms at the middle of town (block centre 21,21).
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.8, 24),
      new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
    plaza.position.set(21, 0.5, 21);
    scene.add(plaza);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 5, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8ecff }));
    jet.position.set(21, 3, 21);
    scene.add(jet);

    // Beach + ocean to the south.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 260, 60),
      new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, WORLD.seaAt + 12);
    sand.receiveShadow = true;
    scene.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 300),
      new THREE.MeshLambertMaterial({ color: 0x1e7fb8 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.4, WORLD.seaAt + 170);
    scene.add(sea);

    // Palm trees: beach row + scattered in parks.
    const palmPositions = [];
    for (let x = -200; x <= 200; x += 16) palmPositions.push([x + range(rng, -4, 4), WORLD.seaAt + range(rng, 2, 14)]);
    for (let i = 0; i < 26; i++) palmPositions.push([range(rng, -190, 190), range(rng, -190, 170)]);
    for (const [x, z] of palmPositions) {
      if (isRoad(x, z)) continue;
      if (this.buildings.some((b) => Math.abs(b.x - x) < b.w / 2 + 2 && Math.abs(b.z - z) < b.d / 2 + 2)) continue;
      this.addPalm(x, z, rng);
    }

    // Street lights along every road.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 });
    for (const c of ROAD_COORDS) {
      for (let v = -189; v <= 189; v += 42) {
        for (const [x, z] of [[c + 6, v], [v, c + 6]]) {
          if (Math.abs(z) > 185 || Math.abs(x) > 205) continue;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
          pole.position.set(x, 3, z);
          scene.add(pole);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
          lamp.position.set(x, 6.1, z);
          scene.add(lamp);
        }
      }
    }

    // Harbour docks: wooden pier + crates at the south-east.
    const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 14),
      new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
    pier.position.set(150, 0.4, 196);
    scene.add(pier);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xb5893c });
    for (let i = 0; i < 10; i++) {
      const crate = new THREE.Mesh(boxGeo, crateMat);
      const s = range(rng, 1.6, 2.6);
      crate.scale.set(s, s, s);
      crate.position.set(130 + rng() * 40, s / 2 + 0.8, 192 + rng() * 8);
      crate.rotation.y = rng() * Math.PI;
      crate.castShadow = true;
      scene.add(crate);
    }
    // Dock office (mission 3 target) on the sand by the pier.
    const office = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: buildingTexture(rng, '#d97b4d') }));
    office.scale.set(14, 7, 10);
    office.position.set(189, 3.7, 189);
    office.castShadow = true;
    scene.add(office);
    this.buildings.push({ x: 189, z: 189, w: 14, d: 10, h: 7 });
    this.colliders.push({ x: 189, z: 189, r: 7 });

    // Mara's garage (mission 1 + 3 destination) on Coral Row.
    const garage = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: buildingTexture(rng, '#4d7fb8') }));
    garage.scale.set(18, 8, 14);
    garage.position.set(-21, 4.2, 63);
    garage.castShadow = true;
    scene.add(garage);
    this.buildings.push({ x: -21, z: 63, w: 18, d: 14, h: 8 });
    this.colliders.push({ x: -21, z: 63, r: 9 });

    // Kito's lockup (mission 2 destination) north-east, block centre (189,-189).
    const lockup = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: buildingTexture(rng, '#6b4d8a') }));
    lockup.scale.set(16, 7, 12);
    lockup.position.set(189, 3.7, -189);
    lockup.castShadow = true;
    scene.add(lockup);
    this.buildings.push({ x: 189, z: -189, w: 16, d: 12, h: 7 });
    this.colliders.push({ x: 189, z: -189, r: 8 });
  }

  addPalm(x, z, rng) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
    trunk.position.set(x, 3, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5a });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.2, 6.4, z + Math.sin(a) * 1.2);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      this.scene.add(leaf);
    }
    this.palms.push({ x, z });
  }

  // Is a point blocked by a building (circle approx)?
  blocked(x, z, pad) {
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const r = c.r + (pad || 0);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  clampToWorld(x, z) {
    const m = WORLD.size / 2 - 4;
    return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(200, z)) };
  }

  streetNameAt(x, z) {
    const idx = (Math.abs(Math.round(x / 42)) + Math.abs(Math.round(z / 42))) % STREET_NAMES.length;
    return STREET_NAMES[idx];
  }
}
