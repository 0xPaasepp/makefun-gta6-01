// SOLMAR vehicles — detailed procedural cars (no external assets).
// Separate cabin/glass/wheels/headlights/taillights/brake lights/mirrors,
// clearcoat paint, suspension visual, weight transfer, damage visuals.
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

export function buildCarMesh(modelKey, opts = {}) {
  const cfg = CAR_MODELS[modelKey];
  const g = new THREE.Group();
  g.name = 'car-' + modelKey;
  const L = cfg.len, W = cfg.wid;
  const body = paint(opts.color ?? cfg.color);
  const top = paint(opts.color2 ?? cfg.top);

  // lower body + sculpted hood/trunk + cabin + glasshouse
  const lower = new THREE.Mesh(new THREE.BoxGeometry(L, 0.55, W), body);
  lower.position.y = 0.55; lower.castShadow = true; g.add(lower);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(L * 0.94, 0.34, W * 0.96), body);
  mid.position.y = 0.95; mid.castShadow = true; g.add(mid);
  const cabinLen = modelKey === 'van' ? L * 0.72 : modelKey === 'pickup' ? L * 0.34 : L * 0.5;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, 0.52, W * 0.84), top);
  cabin.position.set(modelKey === 'pickup' ? -L * 0.2 : -L * 0.04, 1.36, 0);
  cabin.castShadow = true; g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(cabinLen * 0.94, 0.4, W * 0.86), glassMat);
  glass.position.copy(cabin.position); glass.position.y = 1.38; g.add(glass);
  // roof panel over glass
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinLen * 0.9, 0.06, W * 0.8), top);
  roof.position.set(cabin.position.x, 1.66, 0); g.add(roof);
  // pickup bed
  if (modelKey === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(L * 0.36, 0.3, W * 0.9), darkMat);
    bed.position.set(L * 0.28, 1.05, 0); g.add(bed);
  }
  // grille + bumpers + spoiler
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, W * 0.6), darkMat);
  grille.position.set(L / 2, 0.62, 0); g.add(grille);
  for (const s of [1, -1]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, W * 0.98), chromeMat);
    bump.position.set(s * L / 2, 0.42, 0); g.add(bump);
  }
  if (modelKey === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, W * 0.9), darkMat);
    wing.position.set(-L / 2 + 0.1, 1.28, 0); g.add(wing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), darkMat);
    fin.position.set(-L / 2 + 0.28, 1.1, W * 0.3); g.add(fin);
    const fin2 = fin.clone(); fin2.position.z = -W * 0.3; g.add(fin2);
  }
  // headlights + taillights + brake lights
  const hlGeo = new THREE.BoxGeometry(0.08, 0.16, 0.42);
  for (const s of [1, -1]) {
    const hl = new THREE.Mesh(hlGeo, lightOnMat);
    hl.position.set(L / 2 + 0.02, 0.86, s * W * 0.3); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), tailMat);
    tl.position.set(-L / 2 - 0.02, 0.86, s * W * 0.3); g.add(tl);
  }
  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, W * 0.7), brakeMat);
  brake.position.set(-L / 2 - 0.03, 1.08, 0); brake.visible = false; g.add(brake);
  g.userData.brakeLight = brake;
  // reverse lights (white) — lit while backing up
  const rev = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, W * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8 }));
  rev.position.set(-L / 2 - 0.03, 0.62, 0); rev.visible = false; g.add(rev);
  g.userData.reverseLight = rev;
  // mirrors
  for (const s of [1, -1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.22), darkMat);
    mir.position.set(L * 0.18, 1.18, s * (W / 2 + 0.08)); g.add(mir);
  }
  // exhaust
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), chromeMat);
  ex.rotation.z = Math.PI / 2; ex.position.set(-L / 2 - 0.08, 0.34, W * 0.25); g.add(ex);
  // taxi sign / police lightbar
  if (modelKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf1c40f, emissiveIntensity: 0.8 }));
    sign.position.set(-L * 0.04, 1.74, 0); g.add(sign);
  }
  if (modelKey === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.1), darkMat);
    bar.position.set(-L * 0.04, 1.72, 0); g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    r.position.set(-L * 0.04, 1.8, 0.28); g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    b.position.set(-L * 0.04, 1.8, -0.28); g.add(b);
    g.userData.sirenR = r; g.userData.sirenB = b;
  }
  // wheels: tyre + rim + hub, spin + steer on front axle
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10);
  rimGeo.rotateX(Math.PI / 2);
  for (const [wx, wz, front] of [[L * 0.32, W / 2, true], [L * 0.32, -W / 2, true], [-L * 0.32, W / 2, false], [-L * 0.32, -W / 2, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat); tyre.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    pivot.add(tyre); pivot.add(rim); g.add(pivot);
    wheels.push({ pivot, tyre, front });
  }
  g.userData.wheels = wheels;
  // interior: seats + wheel, visible through glass
  for (const s of [1, -1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMat);
    seat.position.set(-L * 0.02, 1.15, s * W * 0.22); g.add(seat);
  }
  const swheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14), darkMat);
  swheel.position.set(L * 0.2, 1.3, W * 0.22); swheel.rotation.y = Math.PI / 2; g.add(swheel);
  // damage: smoke emitter anchor + dent plate (hidden until damaged)
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0 }));
  smoke.position.set(L * 0.3, 1.1, 0); g.add(smoke);
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
    const spin = (this.speed * dt) / 0.36;
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
