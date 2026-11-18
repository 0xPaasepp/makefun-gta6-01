// SOLMAR — city builder. Original coastal city: plaza + fountain, palm
// avenue, marina, harbour docks, streets with buildings. Buildings are our
// own boxes with balconies, roof AC units and lit windows — no real-world
// architecture, no Rockstar assets.
// RULE: buildings live only inside blocks between road lines, set back at
// least 8 units from any road edge, so roads and sidewalks stay clear.

import { CONFIG } from './config.js';

function windowTexture(rng, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng.chance(lit ? 0.55 : 0.12);
      g.fillStyle = on ? (rng.chance(0.5) ? '#ffd166' : '#ffe8a3') : '#20242e';
      g.fillRect(10 + x * 30, 12 + y * 24, 18, 14);
    }
  }
  return c;
}

export function buildCity(THREE, scene, rng) {
  const C = CONFIG;
  const colliders = []; // {x, z, hx, hz} axis-aligned boxes
  const windowMats = []; // materials whose emissive we raise at night
  const neonMats = [];
  const palms = [];
  const group = new THREE.Group();
  scene.add(group);

  const texDay = [];
  const texNight = [];
  for (let i = 0; i < 3; i++) {
    texDay.push(new THREE.CanvasTexture(windowTexture(rng, false)));
    texNight.push(new THREE.CanvasTexture(windowTexture(rng, true)));
  }

  // ---- ground: sand-coloured land, darker asphalt handled by road strips
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshLambertMaterial({ color: 0xc9b18a })
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // ---- sea: east (x > 212) and south (z > 212), teal with a sunset tint
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x1b7f8e });
  const seaE = new THREE.Mesh(new THREE.PlaneGeometry(240, 460), seaMat);
  seaE.rotation.x = -Math.PI / 2; seaE.position.set(330, -0.4, 0);
  group.add(seaE);
  const seaS = new THREE.Mesh(new THREE.PlaneGeometry(460, 240), seaMat);
  seaS.rotation.x = -Math.PI / 2; seaS.position.set(0, -0.4, 330);
  group.add(seaS);

  // ---- roads: dark asphalt strips on the road lines, with centre dashes
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const roadLen = 430;
  for (const x of C.roadsX) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth, roadLen), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, 0);
    group.add(r);
    for (let z = -200; z < 205; z += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.04, z);
      group.add(d);
    }
  }
  for (const z of C.roadsZ) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, C.roadWidth), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, z);
    group.add(r);
    for (let x = -200; x < 205; x += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.04, z);
      group.add(d);
    }
  }

  // ---- sidewalks: pale strips flanking every road
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (const x of C.roadsX) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3, roadLen), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x + s * (C.roadWidth / 2 + 1.5), 0.03, 0);
      group.add(w);
    }
  }
  for (const z of C.roadsZ) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 3), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(0, 0.03, z + s * (C.roadWidth / 2 + 1.5));
      group.add(w);
    }
  }

  // ---- plaza: warm stone circle + fountain at (0,0)
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0xd9c9a8 });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(27, 40), plazaMat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.05, 0);
  group.add(plaza);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.7, 10, 32),
    new THREE.MeshLambertMaterial({ color: 0xe8e0cc })
  );
  rim.rotation.x = -Math.PI / 2; rim.position.set(0, 0.7, 0);
  group.add(rim);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 32),
    new THREE.MeshLambertMaterial({ color: 0x35b6c9, emissive: 0x0a4a55 })
  );
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.75, 0);
  group.add(water);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 2.2, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0ead6 })
  );
  spout.position.set(0, 1.6, 0);
  group.add(spout);
  colliders.push({ x: 0, z: 0, hx: 4.6, hz: 4.6 });

  // ---- palm tree factory
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 6.5 * s, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6b46 })
    );
    trunk.position.y = 3.2 * s; g.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 3.4 * s, 4), leafMat);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.3 * s, 6.6 * s, Math.sin(a) * 1.3 * s);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    const coco = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 * s, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4f2a })
    );
    coco.position.y = 6.2 * s; g.add(coco);
    g.position.set(x, 0, z);
    group.add(g);
    palms.push(g);
    return g;
  }
  // Palms ring the plaza
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    palm(Math.cos(a) * 22, Math.sin(a) * 22, rng.range(0.9, 1.2));
  }
  // Palm Avenue: both sides of road x = -30
  for (let z = -195; z <= 195; z += 16) {
    palm(-30 - 7.5, z + rng.range(-2, 2), rng.range(0.9, 1.3));
    palm(-30 + 7.5, z + 8 + rng.range(-2, 2), rng.range(0.9, 1.3));
  }
  // Marina + docks palms
  for (let i = 0; i < 6; i++) palm(196 + rng.range(-4, 6), -130 + i * 12, 1.1);
  for (let i = 0; i < 6; i++) palm(196 + rng.range(-4, 6), 120 + i * 12, 1.1);

  // ---- buildings: one block at a time, inset from roads
  const blockEdges = [-205, -155, -95, -35, 35, 95, 155, 205];
  const palette = [0xe8b4b8, 0xf2d5a0, 0xa8d8ea, 0xf7cac9, 0xd5c6e8, 0xb5e3c0, 0xf6e27a, 0xe0aaff];
  const skipBlock = (x0, x1, z0, z1) => {
    // plaza block
    if (x0 >= -35 && x1 <= 35 && z0 >= -35 && z1 <= 35) return true;
    // garage block (Mara's garage lives here)
    if (x0 >= -35 && x1 <= 35 && z0 >= -95 && z1 <= -35) return true;
    // marina + docks strips (east edge)
    if (x0 >= 155 && z0 >= -155 && z1 <= -35) return true;
    if (x0 >= 155 && z0 >= 95) return true;
    return false;
  };
  for (let bi = 0; bi < blockEdges.length - 1; bi++) {
    for (let bj = 0; bj < blockEdges.length - 1; bj++) {
      const x0 = blockEdges[bi] + 3, x1 = blockEdges[bi + 1] - 3;
      const z0 = blockEdges[bj] + 3, z1 = blockEdges[bj + 1] - 3;
      if (skipBlock(blockEdges[bi], blockEdges[bi + 1], blockEdges[bj], blockEdges[bj + 1])) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(12, Math.min(24, x1 - x0 - 4));
        const d = rng.range(12, Math.min(24, z1 - z0 - 4));
        const h = rng.range(8, 30);
        const cx = rng.range(x0 + w / 2 + 1, x1 - w / 2 - 1);
        const cz = rng.range(z0 + d / 2 + 1, z1 - d / 2 - 1);
        const ti = rng.int(0, 2);
        const winMat = new THREE.MeshLambertMaterial({
          color: rng.pick(palette),
          map: texDay[ti],
          emissiveMap: texNight[ti],
          emissive: 0x000000,
        });
        windowMats.push(winMat);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), winMat);
        b.position.set(cx, h / 2, cz);
        group.add(b);
        colliders.push({ x: cx, z: cz, hx: w / 2, hz: d / 2 });
        // balconies on the long faces
        const balcMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
        const floors = Math.max(1, Math.floor(h / 6));
        for (let f = 1; f <= floors; f++) {
          const by = f * 5.2;
          if (by > h - 2) break;
          const bal = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.25, 1.4), balcMat);
          bal.position.set(cx, by, cz + d / 2 + 0.6);
          group.add(bal);
        }
        // roof AC units
        const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
        for (let a = 0; a < rng.int(1, 3); a++) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), acMat);
          ac.position.set(cx + rng.range(-w / 4, w / 4), h + 0.45, cz + rng.range(-d / 4, d / 4));
          group.add(ac);
        }
      }
    }
  }

  // ---- Mara's garage (block x -35..35, z -95..-35): low building + door
  const garageMat = new THREE.MeshLambertMaterial({ color: 0x7fb3d5 });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 14), garageMat);
  garage.position.set(0, 3.5, -82);
  group.add(garage);
  colliders.push({ x: 0, z: -82, hx: 10, hz: 7 });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  );
  door.position.set(0, 2.5, -74.8);
  group.add(door);
  // garage forecourt marker (gold ring where the delivery lands)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3, 3.8, 32),
    new THREE.MeshBasicMaterial({ color: 0xf5d76e, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.06, -70);
  group.add(ring);

  // ---- neon signs: SOLMAR over the plaza, MARINA at the pier
  function neonSign(text, x, y, z, ry, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#14061f'; g.fillRect(0, 0, 512, 128);
    g.font = 'bold 72px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 28;
    g.fillStyle = color;
    g.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    neonMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    group.add(m);
    return m;
  }
  neonSign('SOLMAR', 0, 12, -24, 0, '#ff2e88');
  neonSign('MARINA', 196, 9, -96, -Math.PI / 2, '#29e6ff');
  neonSign('DOCKS', 196, 9, 146, -Math.PI / 2, '#ff9f1c');

  // ---- marina: piers into the sea + moored boats
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  for (const pz of [-120, -100, -80]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 4), pierMat);
    pier.position.set(216, 0.2, pz);
    group.add(pier);
  }
  const boatColors = [0xffffff, 0xff6b6b, 0x4ecdc4];
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(7, 1.2, 2.4),
      new THREE.MeshLambertMaterial({ color: boatColors[i % 3] })
    );
    hull.position.y = 0.4; boat.add(hull);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.4, 2),
      new THREE.MeshLambertMaterial({ color: 0xeaf2f8 })
    );
    cab.position.set(-0.5, 1.6, 0); boat.add(cab);
    boat.position.set(222 + rng.range(-4, 10), 0, -122 + i * 11);
    boat.rotation.y = rng.range(-0.2, 0.2);
    group.add(boat);
  }

  // ---- docks: warehouses, containers, cash crates, crane
  const whMat = new THREE.MeshLambertMaterial({ color: 0x6c757d });
  for (const [wx, wz, ww, wd] of [[168, 128, 18, 12], [190, 178, 16, 12]]) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(ww, 9, wd), whMat);
    wh.position.set(wx, 4.5, wz);
    group.add(wh);
    colliders.push({ x: wx, z: wz, hx: ww / 2, hz: wd / 2 });
  }
  const contColors = [0xe07a5f, 0x2a9d8f, 0x4361ee, 0xf4a261];
  for (let i = 0; i < 10; i++) {
    const cont = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: contColors[i % 4] })
    );
    cont.position.set(164 + (i % 5) * 8, 1.3 + (i >= 5 ? 2.6 : 0), 168 + Math.floor(i / 5) * 6);
    group.add(cont);
    if (i < 5) colliders.push({ x: cont.position.x, z: cont.position.z, hx: 3, hz: 1.3 });
  }
  // cash crates (M3 objective) — gold-topped crates by the water
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e, emissive: 0x554400 });
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat);
    crate.position.set(184 + (i % 2) * 2.4, 0.9, 156 + Math.floor(i / 2) * 2.4);
    group.add(crate);
    const gold = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), goldMat);
    gold.position.set(crate.position.x, 1.95, crate.position.z);
    group.add(gold);
    colliders.push({ x: crate.position.x, z: crate.position.z, hx: 1, hz: 1 });
  }
  // harbour crane
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xe07a5f });
  const craneLeg = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
  craneLeg.position.set(200, 13, 140); group.add(craneLeg);
  const craneArm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 30), craneMat);
  craneArm.position.set(200, 25, 128); group.add(craneArm);
  colliders.push({ x: 200, z: 140, hx: 1.2, hz: 1.2 });

  // ---- south beach: umbrellas + towels on the sand strip (z 190..205)
  const umbColors = [0xff6b6b, 0x2ec4b6, 0xffd166, 0xff2e88];
  for (let i = 0; i < 8; i++) {
    const ux = -160 + i * 42 + rng.range(-6, 6);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xe8e0cc })
    );
    pole.position.set(ux, 1.3, 196);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 1, 8),
      new THREE.MeshLambertMaterial({ color: umbColors[i % 4] })
    );
    top.position.set(ux, 3, 196);
    group.add(top);
  }

  // ---- streetlights along the main roads (glow at night)
  const lightMats = [];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });
  for (const x of C.roadsX) {
    for (let z = -180; z <= 180; z += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), poleMat);
      pole.position.set(x + 7, 3.5, z); group.add(pole);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb.position.set(x + 7, 7.1, z); group.add(bulb);
      lightMats.push(bulbMat);
    }
  }

  // ---- sun disc + sunset sky dome (canvas gradient, cheap)
  const skyC = document.createElement('canvas');
  skyC.width = 4; skyC.height = 256;
  const sg = skyC.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(0.45, '#ff2e63');
  grad.addColorStop(0.7, '#ff8c42');
  grad.addColorStop(1, '#ffd166');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyC);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd166, fog: false })
  );
  sun.position.set(-260, 70, -420);
  sun.lookAt(0, 40, 0);
  scene.add(sun);

  return {
    colliders, windowMats, neonMats, lightMats, palms, group,
    // timeOfDay in hours (0-24). Sunset default ~17.8. Returns nothing;
    // sets window emissive + streetlight colour for night.
    update(hour) {
      const night = hour >= 19 || hour < 6;
      const dusk = hour >= 17 && hour < 19;
      const glow = night ? 0.85 : dusk ? 0.45 : 0.0;
      for (const m of windowMats) m.emissive.setRGB(glow, glow * 0.75, glow * 0.4);
      for (const m of lightMats) m.color.setHex(night || dusk ? 0xffe9a3 : 0x555555);
      sun.position.y = night ? -40 : 40 + (19 - hour) * 12;
      sun.visible = !night;
    },
  };
}
