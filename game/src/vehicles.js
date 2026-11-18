// SOLMAR — vehicles. Seven original car models built from boxes, glossy
// paint, rotating wheels, brake lights, underglow on the Neon Sport, and a
// police cruiser with a blinking lightbar. Traffic drives road loops;
// parked cars sit on the shoulder, close to the road, stealable with E.

import { CONFIG } from './config.js';

export function makeCarMesh(THREE, model, rng) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, 0.75, model.len), paint);
  body.position.y = 0.65;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.82, model.top, model.len * 0.52), glass);
  cabin.position.set(0, 1.15 + model.top / 2 - 0.25, -model.len * 0.05);
  g.add(cabin);
  // wheels (spin when driving)
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [wx, wz] of [
    [-model.wid / 2, model.len * 0.32], [model.wid / 2, model.len * 0.32],
    [-model.wid / 2, -model.len * 0.32], [model.wid / 2, -model.len * 0.32],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w); wheels.push(w);
  }
  // headlights + brake lights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(s * model.wid * 0.3, 0.7, -model.len / 2 - 0.02);
    g.add(h);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), brakeMat);
    b.position.set(s * model.wid * 0.3, 0.7, model.len / 2 + 0.02);
    g.add(b);
  }
  // spoiler on sport models
  if (model.id === 'sport' || model.id === 'cruiser') {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.9, 0.08, 0.5), paint);
    sp.position.set(0, 1.25, model.len / 2 - 0.3);
    g.add(sp);
  }
  // underglow on the Neon Sport (emissive plane + glow)
  let underglow = null;
  if (model.id === 'sport') {
    underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(model.wid + 0.9, model.len + 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.55 })
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.06;
    g.add(underglow);
  }
  // police lightbar
  let lightbar = null;
  if (model.id === 'cruiser') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    red.position.x = -0.3; bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.3; bar.add(blue);
    bar.position.set(0, 1.75, 0);
    g.add(bar);
    lightbar = { red: red.material, blue: blue.material };
    // white doors: two pale side panels
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.5, model.len * 0.45),
        new THREE.MeshLambertMaterial({ color: 0xf2f4f6 })
      );
      p.position.set(s * (model.wid / 2 + 0.01), 0.7, 0);
      g.add(p);
    }
  }
  // taxi sign
  if (model.id === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    sign.position.set(0, 1.85, 0);
    g.add(sign);
  }
  g.userData = { wheels, brakeMat, underglow, lightbar, model };
  return g;
}

export class VehicleManager {
  constructor(THREE, scene, rng, colliders) {
    this.THREE = THREE; this.scene = scene; this.rng = rng;
    this.colliders = colliders;
    this.cars = []; // {mesh, model, x, z, heading, speed, parked, occupied, alarm, traffic, loop, wp}
    this.traffic = [];
    this._spawnParked();
    this._spawnTraffic();
    this._spawnNeonSport();
  }

  _addCar(model, x, z, heading, opts = {}) {
    const mesh = makeCarMesh(this.THREE, model, this.rng);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      mesh, model, x, z, heading, speed: 0,
      parked: !!opts.parked, occupied: !!opts.occupied,
      alarm: false, traffic: !!opts.traffic,
      loop: opts.loop || null, wp: 0, stuck: 0,
      condition: 100, maxSpeed: opts.maxSpeed || 34,
    };
    this.cars.push(car);
    if (opts.traffic) this.traffic.push(car);
    return car;
  }

  _spawnParked() {
    // Parked cars on the shoulder, 7 units off the road centre — close
    // enough to reach on foot, never stranded deep in a block.
    const spots = [];
    for (const z of [-170, -120, -60, -10, 40, 100, 160]) spots.push({ x: -30 + 7.5, z, h: 0 });
    for (const z of [-140, -80, -20, 60, 120, 180]) spots.push({ x: 30 - 7.5, z, h: Math.PI });
    for (const x of [-120, -60, 60, 120]) spots.push({ x, z: -90 + 7.5, h: Math.PI / 2 });
    for (const x of [-140, -40, 80, 140]) spots.push({ x, z: 90 - 7.5, h: -Math.PI / 2 });
    // a couple near the plaza for the M1 opener
    spots.push({ x: -37.5, z: 12, h: Math.PI / 2 });
    spots.push({ x: 37.5, z: -14, h: -Math.PI / 2 });
    // The Neon Sport is unique: only the marina car wears that model.
    // Parked cars use the other five models.
    const models = CONFIG.carModels.filter((m) => m.id !== 'cruiser' && m.id !== 'sport');
    spots.forEach((s, i) => {
      const m = models[i % models.length];
      this._addCar(m, s.x, s.z, s.h, { parked: true, occupied: this.rng.chance(0.3) });
    });
  }

  _spawnTraffic() {
    // 16 traffic cars on rectangular road loops.
    const loops = [];
    const xs = CONFIG.roadsX, zs = CONFIG.roadsZ;
    for (let i = 0; i < 8; i++) {
      const x1 = xs[this.rng.int(0, 2)], x2 = xs[this.rng.int(3, 5)];
      const z1 = zs[this.rng.int(0, 2)], z2 = zs[this.rng.int(3, 5)];
      loops.push([
        { x: x1 + 2.5, z: z1 + 2.5 }, { x: x2 - 2.5, z: z1 + 2.5 },
        { x: x2 - 2.5, z: z2 - 2.5 }, { x: x1 + 2.5, z: z2 - 2.5 },
      ]);
    }
    const models = CONFIG.carModels.filter((m) => m.id !== 'cruiser' && m.id !== 'sport');
    for (let i = 0; i < 16; i++) {
      const loop = loops[i % loops.length];
      const wp = i % 4;
      const p = loop[wp];
      const car = this._addCar(models[i % models.length], p.x, p.z, 0, {
        traffic: true, loop, maxSpeed: this.rng.range(9, 14),
      });
      car.wp = (wp + 1) % 4;
      car.speed = car.maxSpeed;
    }
  }

  _spawnNeonSport() {
    const m = CONFIG.carModels.find((c) => c.id === 'sport');
    this.neonSport = this._addCar(m, CONFIG.neonSport.x, CONFIG.neonSport.z, Math.PI / 2, { parked: true });
  }

  nearestCar(x, z, maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Place a few traffic cars ahead of (x,z) along heading h — for staged shots. */
  placeTrafficAhead(x, z, h, count = 3) {
    const fx = Math.sin(h), fz = Math.cos(h);
    let placed = 0;
    for (const c of this.traffic) {
      if (placed >= count) break;
      const d = 14 + placed * 12;
      c.x = x + fx * d + (placed % 2 === 0 ? 2.5 : -2.5);
      c.z = z + fz * d;
      c.heading = h;
      c.wp = 0;
      c.loop = null;
      c.speed = 8;
      placed++;
    }
  }

  update(dt, playerCar) {
    // traffic follows loops
    for (const c of this.traffic) {
      if (!c.loop) { // staged / free-driving traffic: roll straight
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        if (Math.abs(c.x) > 205 || Math.abs(c.z) > 205) c.speed = 0;
      } else {
        const t = c.loop[c.wp];
        const dx = t.x - c.x, dz = t.z - c.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let dh = want - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        // brake if another car is right ahead on the same road
        let ahead = false;
        for (const o of this.cars) {
          if (o === c || o.traffic === false && o.parked) continue;
          const ox = o.x - c.x, oz = o.z - c.z;
          const od = Math.hypot(ox, oz);
          if (od < 7 && od > 0.1) {
            const dot = (ox * Math.sin(c.heading) + oz * Math.cos(c.heading)) / od;
            if (dot > 0.92) { ahead = true; break; }
          }
        }
        c.speed = ahead ? 0 : (Math.abs(dh) > 0.6 ? c.maxSpeed * 0.4 : c.maxSpeed);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        if (d < 3) c.wp = (c.wp + 1) % c.loop.length;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      this._spinWheels(c, dt);
    }
    // parked / player car mesh sync
    for (const c of this.cars) {
      if (c.traffic) continue;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      this._spinWheels(c, dt);
      const braking = c === playerCar && c.braking;
      c.mesh.userData.brakeMat.color.setHex(braking ? 0xff2222 : 0x550000);
    }
  }

  _spinWheels(c, dt) {
    const w = c.mesh.userData.wheels;
    const spin = (c.speed / 0.36) * dt;
    for (const wheel of w) wheel.rotation.x += spin;
  }
}
