// Solmar city geometry. Grid roads, buildings inset inside blocks (never
// on a road line), plaza + fountain, palm avenue, marina piers, docks with
// warehouses and a big DOCKS neon sign, and the sea to the east.
// Also owns the time-of-day sky/sun and the building collision boxes.
//
// REBUILD 12 — PERMANENT GOLDEN HOUR, GLARE-SAFE. The sky is a gradient
// dome (pink zenith, orange west horizon, violet east), the sun is a small
// disc low in the WEST, off the north–south Palm Avenue sightlines, wrapped
// in warm haze — so facing the sun never whites the frame out the way a
// bare white-yellow disc does. Long fake shadows stretch east from every
// building, palm and car. Buildings are pastel with red terracotta roofs,
// and the streets carry named signs: BRISA INN, CASA LUNA, EL FARO,
// MERCADO SOL, plus street-name plates at the main intersections.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeRng, range, pick, clamp } from './rng.js';

function windowTexture(seed, lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  // Pale wall base: the texture multiplies the pastel wall colour, so the
  // base must stay light — a dark base turned every facade black at dusk.
  g.fillStyle = '#8a8f96'; g.fillRect(0, 0, 64, 128);
  const rng = makeRng(seed);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      const on = rng() < (lit ? 0.55 : 0.25);
      g.fillStyle = on ? (rng() < 0.5 ? '#ffd98a' : '#9fd8ff') : '#4a5058';
      g.fillRect(x, y, 7, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTexture(text, fg, bg, size) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg; g.font = `bold ${size || 72}px Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Golden-hour sky gradient: pink at the top, orange at the west horizon,
// soft violet at the east. Drawn once on a canvas, wrapped on a dome.
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#7a5a9a');   // violet zenith
  grad.addColorStop(0.38, '#e87aa8');  // pink mid-sky
  grad.addColorStop(0.62, '#ff9a5a');  // orange band
  grad.addColorStop(0.8, '#ffc46a');   // warm horizon glow
  grad.addColorStop(1.0, '#e8876a');   // haze at the ground line
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  // A few soft horizontal haze streaks near the horizon.
  g.globalAlpha = 0.16;
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i % 2 ? '#ffd9a8' : '#d87aa8';
    g.fillRect(0, 300 + i * 18, 1024, 7);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Small warm sun disc with a soft radial glow — bright but never a
// frame-filling white wash. Placed low in the west, off the main roads.
function sunTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 236, 180, 1)');
  grad.addColorStop(0.22, 'rgba(255, 190, 110, 0.95)');
  grad.addColorStop(0.5, 'rgba(255, 140, 80, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 60, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.palms = [];
    this.fountainWater = null;
    this.sun = null; this.hemi = null;
    this.buildings = [];
    this.docksSign = null;
    this.sunDisc = null;
    this._build();
  }
  _addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  collides(x, z, r) {
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return c;
    }
    return null;
  }
  resolveCollision(x, z, r) {
    const c = this.collides(x, z, r);
    if (!c) return [x, z];
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    let dx = x - cx, dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) {
      // Inside the box: push out along the smallest penetration axis.
      const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) return [c.minX - r, z];
      if (m === pr) return [c.maxX + r, z];
      if (m === pt) return [x, c.minZ - r];
      return [x, c.maxZ + r];
    }
    dx /= d; dz /= d;
    return [cx + dx * r, cz + dz * r];
  }
  // Long golden-hour shadow: a flat dark streak stretching EAST from a
  // footprint (sun is low in the west). Cheap, reads as a real long shadow.
  _longShadow(x, z, w, d, len) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(len, Math.max(w, d) * 0.9),
      new THREE.MeshBasicMaterial({ color: 0x1a0e08, transparent: true, opacity: 0.22 }));
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = 0; // plane's long axis runs along +X (east)
    s.position.set(x + len / 2 + w * 0.3, 0.06, z);
    this.scene.add(s);
  }
  _sign(text, fg, bg, w, h, x, y, z, rotY) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: textTexture(text, fg, bg, Math.round(64 * (w / 12))) }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.scene.add(m);
    return m;
  }
  _build() {
    const rng = makeRng(20261119);
    const scene = this.scene;
    // --- Golden-hour sky dome + haze fog + warm lights ---
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }));
    scene.add(dome);
    scene.background = new THREE.Color(0xe8876a);
    scene.fog = new THREE.Fog(0xf7a05a, 190, 520); // warm haze, near enough to read
    this.hemi = new THREE.HemisphereLight(0xffc4a0, 0x7a5a4a, 1.05);
    scene.add(this.hemi);
    // Sun low in the WEST (-X), elevation ~11deg: off the north-south
    // Palm Avenue sightlines, so driving the avenue never faces the disc.
    this.sun = new THREE.DirectionalLight(0xff9a50, 1.7);
    this.sun.position.set(-170, 34, -30);
    scene.add(this.sun);
    // The sun disc itself: small, soft, low in the west sky.
    this.sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }));
    this.sunDisc.position.set(-560, 78, -100);
    this.sunDisc.lookAt(0, 0, 0);
    scene.add(this.sunDisc);
    // Fill light from the east (sea side, pink): lifts the faces the low
    // western sun never reaches — the docks, east facades, the player's
    // front when he faces the sea — without washing the sunset out.
    this.fill = new THREE.DirectionalLight(0xffb0c0, 0.55);
    this.fill.position.set(180, 60, 40);
    scene.add(this.fill);
    // Ground: warm city slab + sand strip + sea (sunset-tinted).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(470, 350),
      new THREE.MeshLambertMaterial({ color: 0x5a4f45 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0);
    scene.add(ground);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 350),
      new THREE.MeshLambertMaterial({ color: 0xe8c890 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(200, 0.02, 0);
    scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 350),
      new THREE.MeshLambertMaterial({ color: 0x2a7a9e, emissive: 0x0a2a3a }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(340, 0.01, 0);
    scene.add(sea);
    // Sunset glitter on the sea: a warm band in the docks sightline, so
    // the water reads as water even through the haze.
    const glitter = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 26),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.45 }));
    glitter.rotation.x = -Math.PI / 2;
    glitter.position.set(320, 0.04, -80);
    scene.add(glitter);
    // Sidewalk blocks: one slab per block between roads, inset from roads.
    const blockMat = new THREE.MeshLambertMaterial({ color: 0x9a8a72 });
    const xs = [-205, ...CONFIG.roadsX, 205];
    const zs = [-165, ...CONFIG.roadsZ, 165];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i] + 5.5, x1 = xs[i + 1] - 5.5;
        const z0 = zs[j] + 5.5, z1 = zs[j + 1] - 5.5;
        if (x1 - x0 < 8 || z1 - z0 < 8) continue;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        // Central plaza replaces the block around (0,0).
        if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
        // Marina / docks blocks on the east edge stay open ground.
        if (cx > 160) continue;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), blockMat);
        slab.position.set(cx, 0.15, cz);
        scene.add(slab);
      }
    }
    // Road centre dashes down Palm Avenue + Brisa Blvd, so the asphalt reads.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let z = -160; z <= 160; z += 12) {
      if (Math.abs(z) < 20) continue;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.05, z);
      scene.add(dash);
    }
    for (let x = -200; x <= 150; x += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.05, 0);
      scene.add(dash);
    }
    // Plaza: pale stone disc + fountain.
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 17, 0.4, 28),
      new THREE.MeshLambertMaterial({ color: 0xe8d8b8 }));
    plaza.position.set(0, 0.2, 0);
    scene.add(plaza);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 6, 1.1, 20),
      new THREE.MeshLambertMaterial({ color: 0xfff2d8 }));
    rim.position.set(0, 0.55, 0);
    scene.add(rim);
    this.fountainWater = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.25, 20),
      new THREE.MeshLambertMaterial({ color: 0x4fb3e8, emissive: 0x0a4a6a }));
    this.fountainWater.position.set(0, 0.95, 0);
    scene.add(this.fountainWater);
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.75 }));
    jet.position.set(0, 2.2, 0);
    scene.add(jet);
    // Plaza paving: mosaic rings + radial slabs, so the plaza floor reads
    // in the camera foreground instead of bare stone.
    [[6.8, 8.2, 0xc23b2a], [12.5, 13.8, 0x3a7a8a]].forEach(([rIn, rOut, col]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 28),
        new THREE.MeshLambertMaterial({ color: col }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.42, 0);
      scene.add(ring);
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 4),
        new THREE.MeshLambertMaterial({ color: 0xd8c8a8 }));
      slab.position.set(Math.cos(a) * 10.5, 0.43, Math.sin(a) * 10.5);
      slab.rotation.y = -a + Math.PI / 2;
      scene.add(slab);
    }
    // Plaza props: benches, hydrant, newspaper box, food stall.
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    [[-10, 10], [10, 10], [-10, -10], [10, -10]].forEach(([bx, bz]) => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
      bench.position.set(bx, 0.7, bz);
      scene.add(bench);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x2c313a }));
      leg.position.set(bx, 0.35, bz);
      scene.add(leg);
    });
    const stall = new THREE.Group();
    const stallBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2),
      new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    stallBase.position.y = 0.8; stall.add(stallBase);
    const stallTop = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 4),
      new THREE.MeshLambertMaterial({ color: 0xff5a3c }));
    stallTop.position.y = 2.2; stallTop.rotation.y = Math.PI / 4; stall.add(stallTop);
    stall.position.set(12, 0.3, -12);
    scene.add(stall);
    this._sign('TACOS EL SOL', '#fff2cc', '#c23b3b', 6, 1.5, 12, 1.6, -10.9, 0);
    // Buildings, inset inside blocks. Pastel walls, RED terracotta roofs,
    // tall downtown west, low elsewhere. Long shadows stretch east.
    const palette = [0xf2b8a0, 0xf8d8a8, 0xa8c8d8, 0xd8a8c8, 0xb8d8b0, 0xf0c8b8, 0xc8b8e8];
    const roofCols = [0xc23b2a, 0xa83224, 0xd84a2a, 0x8a2a20];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i] + 9, x1 = xs[i + 1] - 9;
        const z0 = zs[j] + 9, z1 = zs[j + 1] - 9;
        if (x1 - x0 < 10 || z1 - z0 < 10) continue;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue; // plaza
        if (cx > 160) continue; // marina/docks open
        if (Math.abs(cx + 50) < 12 && Math.abs(cz - 60) < 12) continue; // Mara's garage yard
        const tall = cx < -100;
        const w = range(rng, 10, Math.min(20, x1 - x0));
        const d = range(rng, 10, Math.min(20, z1 - z0));
        const h = tall ? range(rng, 22, 46) : range(rng, 8, 18);
        const bx = cx + range(rng, -2, 2), bz = cz + range(rng, -2, 2);
        const tex = windowTexture(Math.floor(rng() * 1e9), false);
        const mat = new THREE.MeshLambertMaterial({ color: pick(rng, palette), map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(bx, h / 2 + 0.3, bz);
        scene.add(b);
        this.buildings.push(b);
        this._addCollider(bx, bz, w + 0.4, d + 0.4);
        // Red terracotta roof lip + a red roof cap on low buildings.
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8),
          new THREE.MeshLambertMaterial({ color: pick(rng, roofCols) }));
        roof.position.set(bx, h + 0.55, bz);
        scene.add(roof);
        if (!tall) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, 2.2, 4),
            new THREE.MeshLambertMaterial({ color: pick(rng, roofCols) }));
          cap.position.set(bx, h + 1.9, bz);
          cap.rotation.y = Math.PI / 4;
          scene.add(cap);
        }
        this._longShadow(bx, bz, w, d, h * 1.1);
      }
    }
    // Mara's garage (safehouse): low wide building at (-50, 60) yard edge.
    const garage = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a4a3a }));
    garage.position.set(-62, 3.3, 66);
    scene.add(garage);
    this._addCollider(-62, 66, 16, 10);
    this._sign("MARA'S GARAGE", '#ffd98a', '#3a241c', 12, 3, -62, 5.2, 60.9, 0);
    this._sign('PAINT SHOP — PRESS C', '#111111', '#ffd23f', 10, 2, -62, 2.2, 60.9, 0);
    // BRISA INN at the taxi dropoff (100, 118) corner.
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(18, 24, 14),
      new THREE.MeshLambertMaterial({ color: 0xf2c8a0, map: windowTexture(77, true) }));
    hotel.position.set(112, 12.3, 128);
    scene.add(hotel);
    this._addCollider(112, 128, 18, 14);
    this._sign('BRISA INN', '#fff2cc', '#27435e', 14, 3.5, 112, 20, 120.9, 0);
    this._longShadow(112, 128, 18, 14, 26);
    // CASA LUNA apartments by the plaza, EL FARO bar at the marina,
    // MERCADO SOL market in Old Town — named signs the player can read.
    const casa = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xd8a8c8, map: windowTexture(515, true) }));
    casa.position.set(-24, 6.3, -24);
    scene.add(casa);
    this._addCollider(-24, -24, 14, 12);
    this._sign('CASA LUNA', '#fff2cc', '#7a3a6a', 11, 2.8, -24, 10, -17.9, 0);
    const faro = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9),
      new THREE.MeshLambertMaterial({ color: 0x4a7a8d }));
    faro.position.set(170, 3.8, 40);
    scene.add(faro);
    this._addCollider(170, 40, 12, 9);
    this._sign('EL FARO BAR', '#ffd23f', '#123a4a', 10, 2.5, 170, 5.5, 35.4, 0);
    const mercado = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 12),
      new THREE.MeshLambertMaterial({ color: 0xb8d8b0, map: windowTexture(99, true) }));
    mercado.position.set(-118, 4.3, 62);
    scene.add(mercado);
    this._addCollider(-118, 62, 16, 12);
    this._sign('MERCADO SOL', '#2a4a2a', '#e8f2d8', 12, 3, -118, 6.5, 55.9, 0);
    // Billboards: sunset cruises + El Faro live music.
    this._sign('SOLMAR SUNSET CRUISES', '#ffd23f', '#27435e', 16, 4, -100, 12, -39, 0);
    this._sign('EL FARO — LIVE MUSIC', '#ff5a8a', '#101826', 16, 4, 100, 12, 39, Math.PI);
    // Street-name plates on poles at the main intersections.
    const plate = (text, x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x2c313a }));
      pole.position.set(x, 1.7, z);
      scene.add(pole);
      this._sign(text, '#111111', '#e8e8e8', 6, 1.2, x, 3.6, z, 0);
    };
    plate('PALM AVE', -7.5, 40); // west kerb: clear of the minimap
    plate('BRISA BLVD', -100, 7.5);
    plate('MARINA DR', 150, 7.5);
    plate('DOCK RD', 150, -80);
    // Traffic lights at four intersections (red/amber/green boxes).
    [[0, 40], [0, -40], [-50, 0], [50, 0]].forEach(([tx, tz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      pole.position.set(tx + 6, 2.75, tz + 6);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      head.position.set(tx + 6, 5.6, tz + 6);
      scene.add(head);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
      lamp.position.set(tx + 6, 5.9, tz + 6.35);
      scene.add(lamp);
    });
    // Marina: piers + boats + office.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    [[186, 30], [186, 90]].forEach(([px, pz]) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 5), pierMat);
      pier.position.set(px, 0.4, pz);
      scene.add(pier);
    });
    const boatCols = [0xffffff, 0xffd23f, 0x3fa7ff, 0xff5a3c];
    for (let i = 0; i < 6; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 2.6),
        new THREE.MeshLambertMaterial({ color: boatCols[i % 4] }));
      hull.position.y = 0.4; boat.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2),
        new THREE.MeshLambertMaterial({ color: 0xe8f2f8 }));
      cab.position.set(-0.5, 1.6, 0); boat.add(cab);
      boat.position.set(196 + (i % 2) * 8, 0, 18 + i * 16);
      boat.rotation.y = (rng() - 0.5) * 0.2;
      scene.add(boat);
    }
    // Docks: warehouses, crate stacks, big DOCKS neon sign facing west
    // (toward the approach road) so it reads fully in frame, never cropped.
    const whMat = new THREE.MeshLambertMaterial({ color: 0x6a5a6a });
    [[205, -105], [205, -55]].forEach(([wx, wz]) => {
      const wh = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 26), whMat);
      wh.position.set(wx, 5.3, wz);
      scene.add(wh);
      this._addCollider(wx, wz, 18, 26);
      this._longShadow(wx, wz, 18, 26, 12);
    });
    this.docksSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: textTexture('DOCKS', '#ff5a8a', '#101826', 84) }));
    this.docksSign.position.set(195.8, 8.5, -80);
    this.docksSign.rotation.y = -Math.PI / 2; // faces west, toward the player
    scene.add(this.docksSign);
    const crateCols = [0xb07a3a, 0x7a8a3a, 0x3a7a8a, 0x8a3a3a];
    const crateSpots = [[176, -64], [180, -66], [178, -62], [196, -92], [170, -88], [192, -70], [182, -96], [168, -78]];
    crateSpots.forEach(([cx, cz], i) => {
      const h = 1.6 + (i % 3) * 1.6;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(3, h, 3),
        new THREE.MeshLambertMaterial({ color: crateCols[i % 4] }));
      crate.position.set(cx, h / 2 + 0.3, cz);
      scene.add(crate);
      this._addCollider(cx, cz, 3.4, 3.4);
    });
    // Docks foreground: barrels, pallets + hazard stripes on the approach
    // ground, so the heist frame is grounded instead of bare dirt.
    const barrelCols = [0x8a3a2a, 0x3a5a8a, 0x7a7a2a];
    [[152, -60], [155, -72], [150, -68], [162, -58]].forEach(([bx, bz], i) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10),
        new THREE.MeshLambertMaterial({ color: barrelCols[i % 3] }));
      barrel.position.set(bx, 1.1, bz);
      scene.add(barrel);
      this._addCollider(bx, bz, 1.6, 1.6);
    });
    [[158, -62], [164, -74]].forEach(([px, pz]) => {
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3),
        new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
      pallet.position.set(px, 0.55, pz);
      scene.add(pallet);
      this._addCollider(px, pz, 3.2, 3.2);
    });
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7),
        new THREE.MeshLambertMaterial({ color: i % 2 ? 0x111111 : 0xffd23f }));
      stripe.rotation.x = -Math.PI / 2; stripe.rotation.z = 0.5;
      stripe.position.set(168 + i * 2.4, 0.06, -72);
      scene.add(stripe);
    }
    // Palms: down Palm Avenue (x=0, both kerbs) and around marina/docks.
    // Each palm drops a long eastward shadow streak.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8a4a });
    const palmSpots = [];
    for (let z = -150; z <= 150; z += 18) {
      if (Math.abs(z) < 22) continue; // keep the plaza clear
      palmSpots.push([-7.5, z]); palmSpots.push([7.5, z]);
    }
    [[168, 24], [168, 96], [196, -60], [168, -100], [150, -60], [120, 140], [-8, 24], [196, 120], [150, 100], [-150, 120]].forEach(p => palmSpots.push(p));
    palmSpots.forEach(([px, pz]) => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 6.5, 7), trunkMat);
      trunk.position.y = 3.25; trunk.rotation.z = 0.08;
      palm.add(trunk);
      for (let k = 0; k < 6; k++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 4), leafMat);
        const a = (k / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.4, 6.6, Math.sin(a) * 1.4);
        leaf.rotation.z = Math.cos(a) * 1.1;
        leaf.rotation.x = -Math.sin(a) * 1.1;
        palm.add(leaf);
      }
      palm.position.set(px, 0.3, pz);
      scene.add(palm);
      this.palms.push(palm);
      this._longShadow(px, pz, 1, 1, 7);
    });
    // Beach dressing: umbrellas + towels on the sand strip east of the city.
    const umbCols = [0xff5a3c, 0xffd23f, 0x3fa7ff, 0x2aff8a];
    [[210, -20], [212, 20], [209, 60], [211, -60], [210, 100], [208, -100], [212, 140]].forEach(([ux, uz], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6),
        new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }));
      pole.position.set(ux, 1.3, uz);
      scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 8),
        new THREE.MeshLambertMaterial({ color: umbCols[i % 4] }));
      top.position.set(ux, 3.0, uz);
      scene.add(top);
      const towel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.0),
        new THREE.MeshLambertMaterial({ color: umbCols[(i + 2) % 4] }));
      towel.position.set(ux + 2.5, 0.35, uz + 1);
      scene.add(towel);
    });
    // "WELCOME TO SOLMAR" arch over the south end of Palm Avenue.
    const archL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x27435e }));
    archL.position.set(-5.5, 3.5, 158);
    scene.add(archL);
    const archR = archL.clone(); archR.position.x = 5.5; scene.add(archR);
    this._sign('WELCOME TO SOLMAR', '#ffd23f', '#27435e', 12, 2.6, 0, 7.2, 158, Math.PI);
    // Street lamps along the main roads, glowing warm at golden hour.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc46a });
    for (let z = -140; z <= 140; z += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), lampMat);
      pole.position.set(-6, 2.8, z); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(-6, 5.4, z); scene.add(bulb);
    }
    // Fire hydrants + newspaper boxes near the plaza, for street density.
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xc23b2a });
    [[-8, 18], [8, -18], [-52, 30]].forEach(([hx, hz]) => {
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8), hydMat);
      hyd.position.set(hx, 0.75, hz);
      scene.add(hyd);
    });
    // Rebuild 13 — NO FLAT BROWN FOREGROUNDS. The camera's ground in
    // every staging shot now carries detail: crosswalk stripes at the
    // Palm Avenue intersections, kerb edge lines down the avenue, flower
    // planters + bins + newspaper boxes along the plaza edge, and a
    // second food cart on the avenue — so no frame is a bare brown slab.
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2ead8 });
    for (const cz of [40, -40, 80, -80, 120, -120]) {
      for (let sx = -4; sx <= 4; sx += 1.6) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.6), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(sx, 0.05, cz + 5.2);
        scene.add(stripe);
      }
    }
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const ex of [-4.4, 4.4]) {
      for (let z = -160; z <= 160; z += 8) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 4), edgeMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set(ex, 0.05, z);
        scene.add(seg);
      }
    }
    const planterMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const flowerCols = [0xff5a8a, 0xffd23f, 0x2aff8a, 0xff5a3c];
    [[-14, 18], [14, 18], [-14, -18], [14, -18], [-20, 0], [20, 0]].forEach(([px, pz], i) => {
      const boxM = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.2), planterMat);
      boxM.position.set(px, 0.65, pz);
      scene.add(boxM);
      for (let k = 0; k < 3; k++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
          new THREE.MeshLambertMaterial({ color: flowerCols[(i + k) % 4] }));
        fl.position.set(px - 0.8 + k * 0.8, 1.15, pz);
        scene.add(fl);
      }
    });
    const binMat = new THREE.MeshLambertMaterial({ color: 0x2a4a3a });
    [[-6, 26], [6, -26], [-48, 22], [52, -22]].forEach(([bx, bz]) => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.0, 8), binMat);
      bin.position.set(bx, 0.8, bz);
      scene.add(bin);
    });
    // Second food cart on Palm Avenue (north end) — a landmark in the
    // driving shot's foreground.
    const cart2 = new THREE.Group();
    const cartBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x3fa7ff }));
    cartBase.position.y = 0.7; cart2.add(cartBase);
    const cartTop = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.0, 4),
      new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    cartTop.position.y = 1.9; cartTop.rotation.y = Math.PI / 4; cart2.add(cartTop);
    cart2.position.set(6.5, 0.3, -64);
    scene.add(cart2);
    this._sign('CHURROS', '#fff2cc', '#27435e', 5, 1.3, 6.5, 1.5, -63, 0);
    // Rebuild 13 — district signs for the two new districts: NEON ROW
    // over the south strip, SUNSET HEIGHTS on the tall north blocks.
    // (rotation.y = PI: the sign faces north, toward the plaza approach,
    // so it reads on the way in instead of showing its blank back.)
    this._sign('NEON ROW', '#ffd23f', '#1a1a2a', 12, 3, -50, 10, 119, Math.PI);
    this._sign('SUNSET HEIGHTS', '#fff2cc', '#27435e', 14, 3, -100, 14, -119, 0);
    // Neon Row dressing: a record shop + a bright pink awning block at
    // the south end of Palm Avenue, where DJ Vela stands.
    const recShop = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9),
      new THREE.MeshLambertMaterial({ color: 0x2a1a4a, map: windowTexture(4242, true) }));
    recShop.position.set(-16, 3.8, 132);
    scene.add(recShop);
    this._addCollider(-16, 132, 12, 9);
    this._sign('VELA RECORDS', '#ff5a8a', '#1a1a2a', 10, 2.5, -16, 5.5, 127.4, Math.PI);
    this._longShadow(-16, 132, 12, 9, 9);
  }
  setTimeOfDay(hour) {
    // PERMANENT GOLDEN HOUR: whatever hour the game (or a debug call)
    // asks for, the sky stays in the golden band. The sun's elevation
    // dips slightly as the hour moves 16:30 -> 19:30, then wraps.
    // The sun NEVER climbs to noon and NEVER sits in a driver's face:
    // it stays low in the west, off the Palm Avenue sightlines.
    const band = CONFIG.goldenHour;
    let h = hour;
    if (h < band.start || h > band.end) h = band.defaultHour + ((h - band.start) % 1.5 + 1.5) % 1.5 * 0.2;
    const t = clamp((h - band.start) / (band.end - band.start), 0, 1);
    const elev = 14 - t * 7; // 14deg -> 7deg: sinking, never rising
    const rad = elev * Math.PI / 180;
    this.sun.position.set(-Math.cos(rad) * 180, Math.sin(rad) * 180, -30 - t * 40);
    this.sun.color.setHex(0xff9a50);
    this.sun.intensity = 1.7 - t * 0.15;
    this.hemi.intensity = 1.05 - t * 0.15;
    // Sun disc sinks with the hour, always low and west.
    if (this.sunDisc) this.sunDisc.position.set(-560, 95 - t * 42, -100 - t * 60);
    // Sky dome + haze are fixed golden hour; fog keeps the street readable.
    this.scene.fog = new THREE.Fog(0xf7a05a, 190, 520);
  }
}
