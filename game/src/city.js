// SOLMAR · city.js — Solmar: plaza + fountain, palm avenue, marina, docks,
// sea, buildings with lit windows / balconies / roof AC, street lamps, props.
import * as THREE from 'three';
import { CFG, ROADS_V, ROADS_H, ROAD_W, SPURS } from './config.js';
import { mulberry32, range, int } from './rng.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(base, litRatio, rng) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle floor bands
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffd97a' : '#20242e';
        g.fillRect(14 + col * 28, 16 + row * 32, 18, 20);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(14 + col * 28, 16 + row * 32, 18, 3);
      }
    }
  });
}

function plazaTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const cols = ['#cbb083'];
    const tiles = ['#cbb083', '#bfa071', '#d6bd96', '#b3946a', '#c2a87e'];
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = tiles[(i + j * 3) % tiles.length];
      g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(90,70,50,0.5)'; g.lineWidth = 2;
      g.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
    // fountain ring shadow in the middle
    g.fillStyle = 'rgba(120,90,60,0.35)';
    g.beginPath(); g.arc(w / 2, h / 2, 34, 0, Math.PI * 2); g.fill();
  });
}

function neonTexture(word, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = 'bold 84px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 26;
    g.fillStyle = fg; g.fillText(word, w / 2, h / 2 + 4);
    g.shadowBlur = 0; g.fillStyle = '#ffffff';
    g.font = 'bold 80px Arial, sans-serif';
    g.fillText(word, w / 2, h / 2 + 4);
  });
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x0,z0,x1,z1}
    this.facadeMats = [];
    this.lampGlows = [];
    this.lampHeads = [];
    this.heliPad = null;
    const rng = mulberry32(20261118);
    this.buildGround();
    this.buildRoads();
    this.buildPlaza(rng);
    this.buildBuildings(rng);
    this.buildPalms(rng);
    this.buildMarina();
    this.buildDocks();
    this.buildSea();
    this.buildGarage();
    this.buildCrates();
    this.buildBillboard();
    this.buildLamps();
  }
  addCollider(x0, z0, x1, z1) { this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }
  isBlocked(x, z, r = 0.6) {
    for (const c of this.colliders) {
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  }
  // push a circle out of colliders; returns true if a collision happened
  resolve(x, z, r = 0.6) {
    let hit = false;
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else { x += r; }
      }
    }
    return { x, z, hit };
  }
  buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 480),
      new THREE.MeshLambertMaterial({ color: 0xb59a68 })
    );
    g.rotation.x = -Math.PI / 2; g.position.set(0, -0.05, 0); g.receiveShadow = true;
    this.scene.add(g);
  }
  roadMesh(x, z, w, d) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: 0x38332e })
    );
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true;
    this.scene.add(m);
    // dashed centre line
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
    const len = Math.max(w, d), n = Math.floor(len / 6);
    for (let i = 0; i < n; i += 2) {
      const t = -len / 2 + i * 6 + 2;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(w > d ? 3 : 0.35, w > d ? 0.35 : 3), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(w > d ? x + t : x, 0.04, w > d ? z : z + t);
      this.scene.add(dash);
    }
  }
  buildRoads() {
    for (const x of ROADS_V) this.roadMesh(x, 0, ROAD_W, 340);
    for (const z of ROADS_H) this.roadMesh(0, z, 340, ROAD_W);
    for (const s of SPURS) {
      if (s.kind === 'v') this.roadMesh(s.x, (s.z0 + s.z1) / 2, s.w, s.z1 - s.z0);
      else this.roadMesh((s.x0 + s.x1) / 2, s.z, s.x1 - s.x0, s.w);
    }
  }
  buildPlaza(rng) {
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshLambertMaterial({ map: plazaTexture() })
    );
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.06, 0); plaza.receiveShadow = true;
    this.scene.add(plaza);
    // fountain: stone basin + water + column
    const stone = new THREE.MeshLambertMaterial({ color: 0xcfc4ae });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 0.9, 24), stone);
    basin.position.set(0, 0.45, 0); basin.castShadow = true; this.scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(5.3, 5.3, 0.2, 24),
      new THREE.MeshLambertMaterial({ color: 0x2fa8b8, emissive: 0x0a4a55 })
    );
    water.position.set(0, 0.85, 0); this.scene.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3.2, 12), stone);
    col.position.set(0, 1.6, 0); col.castShadow = true; this.scene.add(col);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.25, 16), stone);
    top.position.set(0, 3.2, 0); this.scene.add(top);
    this.addCollider(-6.6, -6.6, 6.6, 6.6);
    // market stalls (striped awnings), planters, benches
    const stallCols = [0xe85d75, 0x2fa36b, 0xf2b705, 0x3e7cc2];
    const stallPos = [[-16, -14], [16, -14], [-16, 14], [16, 14]];
    stallPos.forEach(([sx, sz], i) => {
      const g = new THREE.Group();
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2.4), new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
      counter.position.y = 0.5; counter.castShadow = true; g.add(counter);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 3), new THREE.MeshLambertMaterial({ color: stallCols[i] }));
      awn.position.y = 2.4; awn.castShadow = true; g.add(awn);
      for (const px of [-2, 2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x666666 }));
        pole.position.set(px, 1.2, 1.2); g.add(pole);
      }
      g.position.set(sx, 0, sz); g.rotation.y = (i % 2) * 0.4;
      this.scene.add(g);
      this.addCollider(sx - 2.4, sz - 1.6, sx + 2.4, sz + 1.6);
    });
    for (const [bx, bz] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), new THREE.MeshLambertMaterial({ color: 0x7a5a38 }));
      bench.position.set(bx, 0.25, bz); bench.castShadow = true; this.scene.add(bench);
      const planter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
      planter.position.set(bx + (bx === 0 ? 3 : 0), 0.45, bz + (bz === 0 ? 3 : 0)); planter.castShadow = true; this.scene.add(planter);
    }
  }
  buildBuildings(rng) {
    const bases = ['#8a7f72', '#7d7468', '#94806a', '#6e7d84', '#9c8a7a', '#84707e'];
    const blocks = [];
    for (const bx of [-125, -75, -25, 25, 75, 125]) {
      for (const bz of [-125, -75, -25, 25, 75, 125]) {
        if (Math.abs(bx) < 40 && Math.abs(bz) < 40) continue; // plaza
        if (bx > 140) continue;
        blocks.push([bx, bz]);
      }
    }
    for (const [bx, bz] of blocks) {
      const w = range(rng, 16, 26), d = range(rng, 16, 26), hgt = range(rng, 12, 42);
      const tex = facadeTexture(bases[int(rng, 0, bases.length - 1)], 0.45, rng);
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
      b.position.set(bx, hgt / 2, bz); b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b);
      this.facadeMats.push(mat);
      this.addCollider(bx - w / 2 - 0.4, bz - d / 2 - 0.4, bx + w / 2 + 0.4, bz + d / 2 + 0.4);
      // balconies on the south face + roof AC units
      const nBal = int(rng, 1, 3);
      for (let i = 0; i < nBal; i++) {
        const by = 4 + i * 7 + rng() * 2;
        if (by > hgt - 3) break;
        const bal = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 1.4), new THREE.MeshLambertMaterial({ color: 0x5a5148 }));
        bal.position.set(bx - w / 4 + (i % 2) * w / 2, by, bz + d / 2 + 0.7);
        this.scene.add(bal);
      }
      for (let i = 0; i < 2; i++) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0xb8bcc0 }));
        ac.position.set(bx - w / 4 + i * w / 2, hgt + 0.45, bz + (rng() - 0.5) * d * 0.4);
        ac.castShadow = true; this.scene.add(ac);
      }
    }
  }
  palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 6.5 * s, 7),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
    );
    trunk.position.y = 3.25 * s; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 * s, 0.08 * s, 3.4 * s),
        new THREE.MeshLambertMaterial({ color: 0x2f7d3a })
      );
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.4 * s, 6.6 * s, Math.sin(a) * 1.4 * s);
      frond.rotation.y = -a; frond.rotation.x = 0.5;
      frond.castShadow = true; g.add(frond);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a2f }));
    nuts.position.y = 6.3 * s; g.add(nuts);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return g;
  }
  buildPalms(rng) {
    // Palm Avenue (x=100) both sides — set OUTSIDE the road (road spans 95..105)
    // so trunks never block the driving line or the chase camera.
    for (let z = -160; z <= 160; z += 20) {
      this.palm(93, z, 1); this.palm(107, z + 10, 0.9);
    }
    // plaza corners + docks
    for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [20, 20], [160, 140], [160, 170], [196, 135], [196, 172], [176, -120], [176, -80]]) {
      this.palm(x, z, 0.95 + rng() * 0.3);
    }
  }
  buildMarina() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 64),
      new THREE.MeshLambertMaterial({ color: 0x1f7d8c, emissive: 0x0a3a44 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(190, 0.12, -100);
    this.scene.add(water);
    // quay edge + moored boats
    const quay = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 64), new THREE.MeshLambertMaterial({ color: 0xa89a80 }));
    quay.position.set(166, 0.5, -100); quay.castShadow = true; this.scene.add(quay);
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 8), new THREE.MeshLambertMaterial({ color: [0xe8e4da, 0xc23b2e, 0x3e7cc2][i] }));
      hull.position.y = 0.4; hull.castShadow = true; boat.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshLambertMaterial({ color: 0xf0ede4 }));
      cab.position.set(0, 1.4, -0.5); boat.add(cab);
      boat.position.set(184 + (i % 2) * 8, 0.1, -118 + i * 18);
      boat.rotation.y = (i - 1) * 0.08;
      this.scene.add(boat);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: neonTexture('MARINA', '#123a5c', '#7fd4ff'), side: THREE.DoubleSide })
    );
    sign.position.set(178, 6, -132); this.scene.add(sign);
  }
  buildDocks() {
    const quay = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 62),
      new THREE.MeshLambertMaterial({ color: 0x9a8a72 })
    );
    quay.rotation.x = -Math.PI / 2; quay.position.set(178, 0.03, 159); quay.receiveShadow = true;
    this.scene.add(quay);
    // warehouse sheds
    for (const [wx, wz] of [[158, 136], [158, 176]]) {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 16), new THREE.MeshLambertMaterial({ color: 0x7d6a58 }));
      shed.position.set(wx, 3.5, wz); shed.castShadow = true; this.scene.add(shed);
      this.addCollider(wx - 5.4, wz - 8.4, wx + 5.4, wz + 8.4);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 16, 12, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x5d4f42 }));
      roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
      roof.position.set(wx, 7, wz); this.scene.add(roof);
    }
    // DOCKS neon — double-sided, 30 x 7.5 m, low over the quay, rotated to
    // face WEST so it reads correctly for the player approaching from the city
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 7.5),
      new THREE.MeshBasicMaterial({ map: neonTexture('DOCKS', '#2b1055', '#ffd94d'), side: THREE.DoubleSide })
    );
    neon.position.set(196, 7.5, 150);
    neon.rotation.y = -Math.PI / 2;
    this.scene.add(neon);
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    post1.position.set(196, 3.75, 136); this.scene.add(post1);
    const post2 = post1.clone(); post2.position.set(196, 3.75, 164); this.scene.add(post2);
  }
  buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 480),
      new THREE.MeshLambertMaterial({ color: 0x1b6d7d, emissive: 0x0a3540 })
    );
    sea.rotation.x = -Math.PI / 2; sea.position.set(318, 0.1, 0);
    this.scene.add(sea);
    // south sea strip so the harbour shot has water on two sides
    const seaS = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 110),
      new THREE.MeshLambertMaterial({ color: 0x1b6d7d, emissive: 0x0a3540 })
    );
    seaS.rotation.x = -Math.PI / 2; seaS.position.set(120, 0.1, 245);
    this.scene.add(seaS);
    // animated-ish wave lines: thin lighter strips on the sea
    for (let i = 0; i < 10; i++) {
      const w = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 0.7),
        new THREE.MeshBasicMaterial({ color: 0x9adfe8, transparent: true, opacity: 0.35 })
      );
      w.rotation.x = -Math.PI / 2;
      w.position.set(230 + (i % 5) * 30, 0.16, -180 + i * 40);
      this.scene.add(w);
    }
  }
  buildGarage() {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), new THREE.MeshLambertMaterial({ color: 0xb0562f }));
    walls.position.y = 3; walls.castShadow = true; g.add(walls);
    const door = new THREE.Mesh(new THREE.BoxGeometry(7, 4.4, 0.3), new THREE.MeshLambertMaterial({ color: 0x3a3f46 }));
    door.position.set(-2.5, 2.2, 5.1); g.add(door);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: neonTexture('MARA\u2019S GARAGE', '#3a1f16', '#ff9d5c'), side: THREE.DoubleSide })
    );
    sign.position.set(0, 5.2, 5.2); g.add(sign);
    g.position.set(CFG.garageBldg.x, 0, CFG.garageBldg.z);
    this.scene.add(g);
    this.addCollider(CFG.garageBldg.x - 6.4, CFG.garageBldg.z - 5.4, CFG.garageBldg.x + 6.4, CFG.garageBldg.z + 5.4);
  }
  buildCrates() {
    // 5-crate golden cluster by the water — the M3 target
    const gold = new THREE.MeshLambertMaterial({ color: 0xd8a928, emissive: 0x4a3200 });
    const spots = [[0, 0], [1.6, 0.4], [-1.5, 0.6], [0.7, -1.3], [-0.8, -1.2]];
    for (const [dx, dz] of spots) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), gold);
      c.position.set(CFG.cashCrates.x + dx, 1.1, CFG.cashCrates.z + dz);
      c.rotation.y = dx; c.castShadow = true; this.scene.add(c);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), gold);
    top.position.set(CFG.cashCrates.x + 0.3, 3.2, CFG.cashCrates.z + 0.1); top.castShadow = true;
    this.scene.add(top);
    this.addCollider(CFG.cashCrates.x - 3.4, CFG.cashCrates.z - 3, CFG.cashCrates.x + 3.4, CFG.cashCrates.z + 3);
  }
  buildBillboard() {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 6.5),
      new THREE.MeshBasicMaterial({ map: neonTexture('SOLMAR', '#2b1055', '#ff6ec7'), side: THREE.DoubleSide })
    );
    sign.position.set(-24, 9, -24); sign.rotation.y = Math.PI / 4;
    this.scene.add(sign);
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 8), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    p1.position.set(-31, 4.5, -31); this.scene.add(p1);
    const p2 = p1.clone(); p2.position.set(-17, 4.5, -17); this.scene.add(p2);
  }
  buildLamps() {
    const glowTex = canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,220,130,0.85)');
      gr.addColorStop(1, 'rgba(255,220,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const spots = [];
    for (const x of ROADS_V) for (const z of [-120, -40, 40, 120]) spots.push([x + 6, z]);
    for (const z of ROADS_H) for (const x of [-120, -40, 40, 120]) spots.push([x, z + 6]);
    for (const [x, z] of spots) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
      pole.position.set(x, 3, z); this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
      head.position.set(x, 6.1, z); this.scene.add(head);
      this.lampHeads.push(head);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })
      );
      glow.rotation.x = -Math.PI / 2; glow.position.set(x, 0.08, z);
      this.scene.add(glow);
      this.lampGlows.push(glow);
    }
  }
  // dusk/night lighting: windows + lamp pools fade in, sun dims
  setNightFactor(f) {
    for (const m of this.facadeMats) m.emissiveIntensity = f * 0.6;
    for (const g of this.lampGlows) g.material.opacity = f * 0.85;
  }
}
