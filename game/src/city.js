// SOLMAR city — procedural coastal city. Districts, instanced buildings,
// palms, props, marina, docks, plaza + fountain, animated sea.
import * as THREE from 'three';
import { WORLD, DISTRICTS } from './config.js';
import { makeRng } from './rng.js';

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  const r = makeRng(7);
  for (let y = 12; y < 244; y += 22)
    for (let x = 10; x < 118; x += 20) {
      const lit = r.chance(0.55);
      g.fillStyle = lit ? '#ffd98a' : '#20242c';
      g.fillRect(x, y, 12, 14);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const R = makeRng(4242);
  const colliders = []; // {x,z,hw,hd}
  const trafficLights = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- ground: grass base, city slab, beach strip, sea ----
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 160, WORLD.half * 2 + 40),
    new THREE.MeshStandardMaterial({ color: 0x6f9e4f, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.05, 0);
  grass.receiveShadow = true; group.add(grass);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x8a8d84, roughness: 0.95 }));
  slab.rotation.x = -Math.PI / 2; slab.position.y = 0; slab.receiveShadow = true;
  group.add(slab);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(34, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(WORLD.seaX + 15, 0.02, 0);
  beach.receiveShadow = true; group.add(beach);

  const seaGeo = new THREE.PlaneGeometry(120, WORLD.half * 2 + 120, 40, 40);
  const seaMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e6f8e, roughness: 0.12, metalness: 0.05,
    clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.2,
    transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(WORLD.seaX + 92, 0.15, 0);
  group.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();

  // ---- roads: dark strips + centre dashes + sidewalks ----
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const v of WORLD.roads) {
    for (const [w, d, vertical] of [[WORLD.roadHalf * 2, WORLD.half * 2, true], [WORLD.roadHalf * 2, WORLD.half * 2, false]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? w : d, vertical ? d : w), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(vertical ? v : 0, 0.03, vertical ? 0 : v);
      road.receiveShadow = true; group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? w + 5 : d, vertical ? d : w + 5), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(vertical ? v : 0, 0.015, vertical ? 0 : v);
      group.add(walk);
    }
    // centre dashes along both axes — ONE InstancedMesh, not 462 meshes
    const dashGeo = new THREE.PlaneGeometry(0.5, 3);
    const dashSpots = [];
    for (const v of WORLD.roads)
      for (let t = -230; t < 230; t += 14)
        for (const vertical of [true, false]) dashSpots.push({ v, t, vertical });
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
    const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler();
    dashSpots.forEach((s, i) => {
      de.set(-Math.PI / 2, 0, s.vertical ? Math.PI / 2 : 0); dq.setFromEuler(de);
      dm.compose(new THREE.Vector3(s.vertical ? s.v : s.t, 0.05, s.vertical ? s.t : s.v),
        dq, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(i, dm);
    });
    dashes.instanceMatrix.needsUpdate = true;
    group.add(dashes);
  }

  // ---- plaza + fountain (city heart, 0,0) ----
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(26, 40),
    new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.85 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.06, 0);
  plaza.receiveShadow = true; group.add(plaza);
  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.6 }));
  fountainBase.position.set(0, 0.6, 0); fountainBase.castShadow = true;
  group.add(fountainBase);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.35, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x3fa7c7, roughness: 0.08, clearcoat: 0.9, transparent: true, opacity: 0.9 }));
  fountainWater.position.set(0, 1.15, 0); group.add(fountainWater);
  const fountainTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.2, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.5 }));
  fountainTop.position.set(0, 2.2, 0); fountainTop.castShadow = true; group.add(fountainTop);
  colliders.push({ x: 0, z: 0, hw: 8, hd: 8 });

  // ---- parks: green circles with benches + trees ----
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x5d8f43, roughness: 1 });
  for (const [px, pz, pr] of [[-125, 25, 20], [75, -125, 18], [-75, 125, 16]]) {
    const park = new THREE.Mesh(new THREE.CircleGeometry(pr, 28), parkMat);
    park.rotation.x = -Math.PI / 2; park.position.set(px, 0.07, pz);
    park.receiveShadow = true; group.add(park);
  }

  // ---- buildings: InstancedMesh boxes, district palettes, lit windows ----
  const winTex = windowTexture();
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const bMat = new THREE.MeshStandardMaterial({
    roughness: 0.85, metalness: 0.05, map: winTex,
    emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.0 });
  const spots = [];
  for (const d of DISTRICTS) {
    const n = d.kind === 'commercial' ? 22 : d.kind === 'industrial' ? 14 : 18;
    for (let i = 0; i < n; i++) {
      const a = R.range(0, Math.PI * 2), rr = R.range(12, d.r);
      const x = Math.max(-225, Math.min(200, d.cx + Math.cos(a) * rr));
      const z = Math.max(-225, Math.min(225, d.cz + Math.sin(a) * rr));
      // keep off roads (road lines +-7) and plaza (r 30) and sea
      const onRoad = WORLD.roads.some((v) => Math.abs(x - v) < 9 || Math.abs(z - v) < 9);
      if (onRoad || Math.hypot(x, z) < 32 || x > 195) continue;
      const w = d.kind === 'industrial' ? R.range(16, 26) : R.range(10, 18);
      const dep = d.kind === 'industrial' ? R.range(14, 22) : R.range(10, 16);
      const h = d.kind === 'commercial' ? R.range(14, 42) : d.kind === 'industrial' ? R.range(8, 14) : R.range(7, 16);
      spots.push({ x, z, w, d: dep, h, color: R.pick(d.palette), rot: R.chance(0.5) ? 0 : Math.PI / 2 });
    }
  }
  const bMesh = new THREE.InstancedMesh(bGeo, bMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    e.set(0, s.rot, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(s.x, s.h / 2, s.z), q, new THREE.Vector3(s.w, s.h, s.d));
    bMesh.setMatrixAt(i, m4);
    bMesh.setColorAt(i, col.setHex(s.color));
    colliders.push({ x: s.x, z: s.z, hw: s.w / 2 + 0.3, hd: s.d / 2 + 0.3 });
  });
  bMesh.castShadow = true; bMesh.receiveShadow = true;
  bMesh.instanceMatrix.needsUpdate = true;
  group.add(bMesh);
  // rooftop details: AC boxes + antennae, instanced small boxes
  const roofGeo = new THREE.BoxGeometry(1.4, 0.9, 1.4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b6f66, roughness: 0.9 });
  const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, spots.length);
  spots.forEach((s, i) => {
    m4.compose(new THREE.Vector3(s.x + R.range(-2, 2), s.h + 0.45, s.z + R.range(-2, 2)),
      new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    roofMesh.setMatrixAt(i, m4);
  });
  roofMesh.instanceMatrix.needsUpdate = true; group.add(roofMesh);

  // ---- palms: instanced trunks + fronds, along Palm Avenue + marina ----
  const palmSpots = [];
  for (let z = -140; z <= 140; z += 20) { palmSpots.push([8, z]); palmSpots.push([-8, z]); }
  for (let x = 160; x <= 200; x += 14) palmSpots.push([x, 96]);
  for (let x = 160; x <= 200; x += 14) palmSpots.push([x, -96]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b42, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(2.4, 1.6, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(x, 3, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 6.6, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    fronds.setMatrixAt(i, m4);
    colliders.push({ x, z, hw: 0.5, hd: 0.5 });
  });
  trunks.castShadow = true; fronds.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true; fronds.instanceMatrix.needsUpdate = true;
  group.add(trunks); group.add(fronds);

  // ---- streetlights: instanced poles + glowing lamps ----
  const lampSpots = [];
  for (const v of WORLD.roads)
    for (let t = -140; t <= 140; t += 40) { lampSpots.push([v + 7, t]); lampSpots.push([v - 7, t]); }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.25 });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(x, 2.7, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 5.5, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    lamps.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true; lamps.instanceMatrix.needsUpdate = true;
  group.add(poles); group.add(lamps);

  // ---- marina basin + docks + crates ----
  const basin = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 60),
    new THREE.MeshPhysicalMaterial({ color: 0x14607e, roughness: 0.1, clearcoat: 0.8 }));
  basin.rotation.x = -Math.PI / 2; basin.position.set(188, 0.1, 70);
  group.add(basin);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.9 });
  for (const [dx, dz, w, d] of [[188, 40, 40, 4], [188, 100, 40, 4], [170, 70, 4, 56]]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), dockMat);
    dock.position.set(dx, 0.4, dz); dock.castShadow = true; dock.receiveShadow = true;
    group.add(dock);
    colliders.push({ x: dx, z: dz, hw: w / 2, hd: d / 2 });
  }
  const crateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb0893c, roughness: 0.9 });
  const crates = new THREE.InstancedMesh(crateGeo, crateMat, 24);
  const crateSpots = [];
  for (let i = 0; i < 24; i++) {
    const x = 176 + R.range(0, 22), z = -96 + R.range(0, 34);
    const y = R.chance(0.35) ? 3.3 : 1.1;
    crateSpots.push({ x, z, y });
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    crates.setMatrixAt(i, m4);
    colliders.push({ x, z, hw: 1.4, hd: 1.4 });
  }
  crates.castShadow = true; crates.instanceMatrix.needsUpdate = true;
  group.add(crates);

  // ---- marina boats + lighthouse (sea life, not a flat band) ----
  const boatHull = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.4 });
  const boatTrim = new THREE.MeshStandardMaterial({ color: 0x2a6ea5, roughness: 0.5 });
  for (const [bx, bz, ang, s] of [[188, 56, 0.4, 1], [188, 84, -0.3, 1.2], [216, 20, 1.2, 1.4], [222, -40, 0.8, 1.1]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7 * s, 1.2, 2.6 * s), boatHull);
    hull.position.y = 0.6; hull.castShadow = true; boat.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3 * s, 2.4 * s, 4), boatHull);
    bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
    bow.position.set(4.4 * s, 0.6, 0); boat.add(bow);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 1.4, 2 * s), boatTrim);
    cab.position.set(-0.6 * s, 1.8, 0); boat.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4 * s, 6), boatTrim);
    mast.position.set(0.8 * s, 3.4, 0); boat.add(mast);
    boat.position.set(bx, 0.1, bz); boat.rotation.y = ang;
    group.add(boat);
  }
  const lightBase = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.7 }));
  lightBase.position.set(214, 8, 150); lightBase.castShadow = true; group.add(lightBase);
  const lightTop = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 2.4 }));
  lightTop.position.set(214, 17, 150); group.add(lightTop);
  colliders.push({ x: 214, z: 150, hw: 3.4, hd: 3.4 });

  // ---- parking areas: marked bays ----
  const bayMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const [bx, bz] of [[-60, -44], [108, 44], [56, 104]]) {
    for (let i = 0; i < 4; i++) {
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), bayMat);
      bay.rotation.x = -Math.PI / 2; bay.position.set(bx + i * 3.2, 0.045, bz);
      group.add(bay);
    }
  }

  // ---- traffic lights at 4 big intersections ----
  const tlGeo = new THREE.BoxGeometry(0.5, 1.6, 0.5);
  const tlMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 8);
  for (const [ix, iz] of [[-50, -50], [50, 50], [-100, 100], [100, -100]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 6), tlMat);
    pole.position.set(ix + 6, 2.3, iz + 6); group.add(pole);
    const head = new THREE.Mesh(tlGeo, tlMat);
    head.position.set(ix + 6, 4.8, iz + 6); group.add(head);
    const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 1.4 }));
    bulb.position.set(ix + 6, 5.2, iz + 6); group.add(bulb);
    trafficLights.push({ x: ix, z: iz, bulb, state: 'green', t: R.range(0, 6) });
  }

  // ---- harbour cranes (industrial silhouettes) ----
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.7, metalness: 0.4 });
  for (const [cx, cz] of [[196, -60], [196, -110]]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
    mast.position.set(cx, 13, cz); mast.castShadow = true; group.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 1.4), craneMat);
    arm.position.set(cx - 7, 24, cz); arm.castShadow = true; group.add(arm);
    colliders.push({ x: cx, z: cz, hw: 1.6, hd: 1.6 });
  }

  let seaT = 0;
  return {
    colliders, trafficLights, group,
    setNight(night) {
      bMat.emissiveIntensity = night ? 0.9 : 0.0;
      lampMat.emissiveIntensity = night ? 2.2 : 0.25;
    },
    update(dt) {
      seaT += dt;
      const pos = seaGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = seaBase[i * 3], by = seaBase[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.12 + seaT * 1.4) * 0.35 + Math.cos(by * 0.1 + seaT) * 0.3);
      }
      pos.needsUpdate = true;
      seaGeo.computeVertexNormals();
      fountainWater.position.y = 1.15 + Math.sin(seaT * 2) * 0.05;
      for (const tl of trafficLights) {
        tl.t += dt;
        if (tl.t > 7) {
          tl.t = 0;
          tl.state = tl.state === 'green' ? 'red' : 'green';
          tl.bulb.material.color.setHex(tl.state === 'green' ? 0x33ff66 : 0xff3333);
          tl.bulb.material.emissive.setHex(tl.state === 'green' ? 0x33ff66 : 0xff3333);
        }
      }
    },
  };
}
