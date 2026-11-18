// SOLMAR vehicles — sleek procedural supercars (no external assets).
// Bodies are extruded wedge side-profiles (sloped hood, raked glasshouse,
// sculpted flanks), NOT boxes: low wide stance, angular LED lights,
// side intakes, rear wings, big low-profile wheels, clearcoat paint.
import * as THREE from 'three';
import { CAR_MODELS } from './config.js';

const paintCache = {};
function paint(color) {
  if (!paintCache[color]) paintCache[color] = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.55, roughness: 0.28,
    clearcoat: 1.0, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
  return paintCache[color];
}
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0d1b26, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.4 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.85 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.18 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c7, metalness: 0.9, roughness: 0.25 });
const lightOnMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 1.6 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0d0d, emissive: 0xaa1111, emissiveIntensity: 0.7 });
const brakeMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2.4 });

// Extrude a side-profile polygon (x = along length, front = +x; y = height)
// across the car width. Returns a centred mesh — the wedge silhouette.
function wedge(pts, width, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2 });
  geo.translate(0, 0, -width / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// Side-profile (front +L/2) per model: [x, y] outline of the body.
function bodyProfile(modelKey, L) {
  const h = L / 2;
  switch (modelKey) {
    case 'sport': return [ // Lamborghini-style low wedge: long sloped nose, low deck
      [h, 0.26], [h * 0.6, 0.5], [h * 0.15, 0.68],
      [-h * 0.55, 0.68], [-h * 0.92, 0.62], [-h, 0.45], [-h, 0.26]];
    case 'hatch': return [
      [h, 0.28], [h * 0.6, 0.52], [h * 0.1, 0.78],
      [-h * 0.6, 0.84], [-h * 0.95, 0.78], [-h, 0.45], [-h, 0.28]];
    case 'pickup': return [
      [h, 0.30], [h * 0.55, 0.55], [h * 0.2, 0.78],
      [-h * 0.05, 0.78], [-h * 0.1, 0.58], [-h, 0.58], [-h, 0.30]];
    case 'van': return [ // tall van, sloped nose
      [h, 0.32], [h - 0.08, 0.9], [h * 0.55, 1.45], [h * 0.2, 1.72],
      [-h * 0.7, 1.72], [-h * 0.95, 1.6], [-h, 0.45], [-h, 0.32]];
    default: return [ // sedan / taxi / cruiser: sleek fastback, long sloped hood
      [h, 0.28], [h * 0.6, 0.54], [h * 0.1, 0.82],
      [-h * 0.55, 0.82], [-h * 0.92, 0.74], [-h, 0.45], [-h, 0.28]];
  }
}

// Raked glasshouse profile per model.
function cabinProfile(modelKey, L) {
  const h = L / 2;
  switch (modelKey) {
    case 'sport': return [[h * 0.55, 0.66], [h * 0.2, 1.0], [-h * 0.35, 1.02], [-h * 0.58, 0.68]];
    case 'hatch': return [[h * 0.6, 0.76], [h * 0.2, 1.18], [-h * 0.5, 1.2], [-h * 0.75, 0.8]];
    case 'pickup': return [[h * 0.35, 0.76], [h * 0.05, 1.2], [-h * 0.28, 1.2], [-h * 0.3, 0.78]];
    case 'van': return [[h * 0.62, 1.4], [h * 0.3, 1.72], [-h * 0.6, 1.72], [-h * 0.85, 1.45]];
    default: return [[h * 0.58, 0.8], [h * 0.12, 1.16], [-h * 0.38, 1.18], [-h * 0.62, 0.82]];
  }
}

export function buildCarMesh(modelKey, opts = {}) {
  const cfg = CAR_MODELS[modelKey];
  const g = new THREE.Group();
  g.name = 'car-' + modelKey;
  const L = cfg.len, W = cfg.wid;
  const body = paint(opts.color ?? cfg.color);
  const top = paint(opts.color2 ?? cfg.top);
  const isSport = modelKey === 'sport';
  const wheelR = isSport ? 0.42 : modelKey === 'van' || modelKey === 'pickup' ? 0.38 : 0.36;

  // --- wedge body + raked glasshouse + roof panel ---
  g.add(wedge(bodyProfile(modelKey, L), W * 0.96, body));
  const cabPts = cabinProfile(modelKey, L);
  if (modelKey !== 'van') g.add(wedge(cabPts, W * 0.72, glassMat));
  else g.add(wedge(cabPts, W * 0.82, glassMat));
  // slim roof panel in paint colour over the glasshouse
  const roofPts = cabPts.map(([x, y], i) => (i === 1 || i === 2 ? [x, y + 0.05] : [x, y + 0.02]));
  const roof = wedge([[roofPts[1][0], roofPts[1][1]], [roofPts[2][0], roofPts[2][1]], [roofPts[2][0], roofPts[2][1] - 0.06], [roofPts[1][0], roofPts[1][1] - 0.06]], W * 0.7, top);
  g.add(roof);

  // --- front splitter + side skirts (low, dark, ground-hugging) ---
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, W * 0.94), darkMat);
  splitter.position.set(L / 2 - 0.05, 0.28, 0); g.add(splitter);
  for (const s of [1, -1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.1, 0.06), darkMat);
    skirt.position.set(-L * 0.05, 0.3, s * (W / 2 + 0.01)); g.add(skirt);
    // sculpted side intake behind the door (sport: big angular scoop)
    const intake = new THREE.Mesh(new THREE.BoxGeometry(isSport ? 0.55 : 0.3, isSport ? 0.26 : 0.14, 0.06), darkMat);
    intake.position.set(-L * 0.22, 0.62, s * (W / 2 + 0.01));
    intake.rotation.z = isSport ? -0.25 : 0; g.add(intake);
  }
  // --- pickup bed (open, with walls + floor) ---
  if (modelKey === 'pickup') {
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.08, W * 0.86), darkMat);
    bedFloor.position.set(-L * 0.26, 0.66, 0); g.add(bedFloor);
    for (const s of [1, -1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.22, 0.06), body);
      wall.position.set(-L * 0.26, 0.78, s * W * 0.44); g.add(wall);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, W * 0.86), body);
    tail.position.set(-L * 0.48, 0.78, 0); g.add(tail);
  }
  // --- grille: slim dark slot, angled back ---
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, W * (isSport ? 0.72 : 0.55)), darkMat);
  grille.position.set(L / 2 - 0.02, isSport ? 0.44 : 0.48, 0);
  grille.rotation.z = -0.35; g.add(grille);
  // --- rear wing / lip spoiler ---
  if (isSport) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, W * 0.92), darkMat);
    wing.position.set(-L / 2 + 0.12, 1.05, 0); wing.rotation.z = 0.12; wing.castShadow = true; g.add(wing);
    for (const s of [1, -1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), darkMat);
      strut.position.set(-L / 2 + 0.14, 0.86, s * W * 0.3); g.add(strut);
    }
  } else if (modelKey !== 'van' && modelKey !== 'pickup') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, W * 0.8), body);
    lip.position.set(-L / 2 + 0.05, 0.8, 0); g.add(lip);
  }
  // --- angular LED headlights (slanted blades) + full-width tail bar ---
  const hlGeo = new THREE.BoxGeometry(0.07, 0.1, isSport ? 0.55 : 0.4);
  for (const s of [1, -1]) {
    const hl = new THREE.Mesh(hlGeo, lightOnMat);
    hl.position.set(L / 2 - 0.06, 0.55, s * W * 0.3);
    hl.rotation.y = s * (isSport ? 0.35 : 0.15); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.38), tailMat);
    tl.position.set(-L / 2 + 0.02, 0.6, s * W * 0.3); g.add(tl);
  }
  if (isSport) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, W * 0.78),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1.2 }));
    bar.position.set(-L / 2 - 0.01, 0.82, 0); g.add(bar);
  }
  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, W * 0.7), brakeMat);
  brake.position.set(-L / 2 - 0.03, 0.78, 0); brake.visible = false; g.add(brake);
  g.userData.brakeLight = brake;
  // reverse lights (white) — lit while backing up
  const rev = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, W * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8 }));
  rev.position.set(-L / 2 - 0.03, 0.42, 0); rev.visible = false; g.add(rev);
  g.userData.reverseLight = rev;
  // mirrors on slim stalks
  for (const s of [1, -1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), darkMat);
    mir.position.set(L * 0.22, 0.95, s * (W / 2 + 0.09)); g.add(mir);
  }
  // twin exhausts (sport) / single (others)
  for (const ez of isSport ? [W * 0.22, -W * 0.22] : [W * 0.25]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), chromeMat);
    ex.rotation.z = Math.PI / 2; ex.position.set(-L / 2 - 0.08, 0.34, ez); g.add(ex);
  }
  // taxi sign / police lightbar
  if (modelKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf1c40f, emissiveIntensity: 0.8 }));
    sign.position.set(-L * 0.04, 1.28, 0); g.add(sign);
  }
  if (modelKey === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.1), darkMat);
    bar.position.set(-L * 0.04, 1.28, 0); g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    r.position.set(-L * 0.04, 1.36, 0.28); g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    b.position.set(-L * 0.04, 1.36, -0.28); g.add(b);
    g.userData.sirenR = r; g.userData.sirenB = b;
  }
  // wheels: big low-profile tyres + wide rims, spin + steer on front axle
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 18);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelR * (isSport ? 0.68 : 0.58), wheelR * (isSport ? 0.68 : 0.58), 0.32, 10);
  rimGeo.rotateX(Math.PI / 2);
  const archGeo = new THREE.CylinderGeometry(wheelR + 0.05, wheelR + 0.05, 0.1, 18);
  archGeo.rotateX(Math.PI / 2);
  for (const [wx, wz, front] of [[L * 0.32, W / 2, true], [L * 0.32, -W / 2, true], [-L * 0.32, W / 2, false], [-L * 0.32, -W / 2, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wheelR, wz);
    const arch = new THREE.Mesh(archGeo, darkMat); // wheel-well shadow disc
    pivot.add(arch);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat); tyre.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    pivot.add(tyre); pivot.add(rim); g.add(pivot);
    wheels.push({ pivot, tyre, front });
  }
  g.userData.wheels = wheels;
  g.userData.wheelR = wheelR;
  // interior: seats + wheel, visible through glass
  for (const s of [1, -1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMat);
    seat.position.set(-L * 0.02, 0.85, s * W * 0.22); g.add(seat);
  }
  const swheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14), darkMat);
  swheel.position.set(L * 0.2, 0.95, W * 0.22); swheel.rotation.y = Math.PI / 2; g.add(swheel);
  // damage: smoke emitter anchor (hidden until damaged)
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0 }));
  smoke.position.set(L * 0.3, 0.9, 0); g.add(smoke);
  g.userData.smoke = smoke;
  return g;
}

export class Car {
  constructor(scene, modelKey, x, z, angle, opts = {}) {
    this.cfg = CAR_MODELS[modelKey];
    this.model = modelKey;
    this.mesh = buildCarMesh(modelKey, opts);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = angle;
    this.speed = 0; this.steer = 0;
    this.damage = 0; this.occupied = false; this.alarm = false;
    this.gear = 1; this.parked = opts.parked !== false;
    this.smokeT = 0;
  }
  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  // Arcade physics with weight transfer + suspension visual.
  update(dt, input, colliders, resolve) {
    const cfg = this.cfg;
    const throttle = input.forward ? 1 : input.back ? -0.6 : 0;
    const targetSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (targetSteer * 0.55 - this.steer) * Math.min(1, dt * 8);
    if (throttle !== 0) {
      this.speed += throttle * cfg.accel * dt * (this.speed < 0 ? 1.4 : 1);
      this.gear = 1 + Math.min(4, Math.floor(Math.abs(this.speed) / 9));
    } else {
      this.speed -= this.speed * Math.min(1, dt * 0.9);
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    // grip-limited top speed + reverse cap
    const top = cfg.topSpeed * (this.speed < 0 ? 0.35 : 1);
    this.speed = Math.max(-top, Math.min(top, this.speed));
    // steering must work from a standstill (traffic AI turns onto its route
    // before it has speed); keep a minimum turn authority of 0.3.
    const spdF = Math.max(0.3, Math.min(1, Math.abs(this.speed) / 8));
    const turn = this.steer * cfg.grip * 0.055 * spdF * Math.sign(this.speed || 1);
    this.heading += turn * dt * 10;
    const f = this.forward;
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    if (nx < -232) { nx = -232; this.speed *= 0.4; this.bump(); }
    if (nx > 204) { nx = 204; this.speed *= 0.4; this.bump(); }
    if (nz < -232) { nz = -232; this.speed *= 0.4; this.bump(); }
    if (nz > 232) { nz = 232; this.speed *= 0.4; this.bump(); }
    if (resolve) {
      const hit = resolve(nx, nz, 1.1);
      if (hit) { nx = hit.x; nz = hit.z; if (Math.abs(this.speed) > 6) this.bump(); this.speed *= 0.5; }
    }
    this.x = nx; this.z = nz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // suspension visual: pitch on accel/brake, roll in corners, body lean
    const pitch = -throttle * 0.02 - (this.speed * 0.0004);
    const roll = -this.steer * Math.min(1, Math.abs(this.speed) / 20) * 0.05;
    this.mesh.rotation.x = pitch;
    this.mesh.rotation.z = roll;
    // wheels spin + front steer
    const wheelR = this.mesh.userData.wheelR || 0.36;
    const spin = (this.speed * dt) / wheelR;
    for (const w of this.mesh.userData.wheels) {
      w.tyre.rotation.y += spin;
      if (w.front) w.pivot.rotation.y = this.steer * 0.4;
    }
    // brake + reverse lights
    this.mesh.userData.brakeLight.visible = !!input.back;
    if (this.mesh.userData.reverseLight) this.mesh.userData.reverseLight.visible = !!input.back;
    if (this.damage > 40) {
      this.smokeT += dt;
      const s = this.mesh.userData.smoke;
      s.material.opacity = 0.25 + Math.sin(this.smokeT * 9) * 0.12;
      s.position.y = 1.1 + Math.sin(this.smokeT * 5) * 0.15;
      s.scale.setScalar(1 + Math.sin(this.smokeT * 7) * 0.2);
    }
    return this.speed;
  }
  bump() { this.damage = Math.min(100, this.damage + 4); }
}

// Traffic car: follows a road loop, obeys traffic lights roughly.
export class TrafficCar extends Car {
  constructor(scene, modelKey, x, z, angle) {
    super(scene, modelKey, x, z, angle, { parked: false });
    this.route = null; this.wp = 0; this.waitT = 0;
  }
  setRoute(points) {
    this.route = points;
    // start at the nearest waypoint so the car never U-turns across the city
    let best = 0, bd = 1e9;
    points.forEach((p, i) => {
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < bd) { bd = d; best = i; }
    });
    this.wp = best;
  }
  updateTraffic(dt, lights, resolve) {
    if (!this.route) return;
    const target = this.route[this.wp];
    const dx = target.x - this.x, dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) { this.wp = (this.wp + 1) % this.route.length; return; }
    const want = Math.atan2(dx, dz);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    // red light ahead: stop
    let stopped = false;
    for (const tl of lights) {
      if (tl.state === 'red' && Math.hypot(tl.x - this.x, tl.z - this.z) < 10) stopped = true;
    }
    // keep creeping forward while turning onto the route (never stall at 0 speed)
    const input = { forward: !stopped, back: false, left: dh > 0.12, right: dh < -0.12 };
    this.update(dt, input, null, resolve);
    if (stopped) this.speed = Math.max(0, this.speed - 20 * dt);
  }
}
