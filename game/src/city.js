// city.js — procedural Port Azura: road grid, buildings, palms, lights, beach, marina and pier.
import * as THREE from 'three';

export const WORLD = { half: 190, roadEvery: 44, roadW: 13, beachX: 148 };
export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function isRoad(v) { const m = ((v % WORLD.roadEvery) + WORLD.roadEvery) % WORLD.roadEvery; return m < WORLD.roadW / 2 || m > WORLD.roadEvery - WORLD.roadW / 2; }

const MAT = {};
function mat(color, rough = 0.9) { const k = color + '_' + rough; if (!MAT[k]) MAT[k] = new THREE.MeshLambertMaterial({ color, roughness: rough }); return MAT[k]; }
const PALETTE = [0xf2e3c6, 0xffb4a2, 0xa8dadc, 0xffe66d, 0xc7ceea, 0xffd6a5, 0x9bf6ff, 0xfdffb6, 0xe5989b, 0xb8f2e6];

export function buildCity(scene, seed = 1) {
  const rnd = mulberry(seed * 7919 + 13);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const H = WORLD.half;
  // Ground: city slab + sand + water
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(H * 2 + 80, H * 2 + 80), mat(0x8a8f7a));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(90, H * 2 + 80), mat(0xeed9a3));
  sand.rotation.x = -Math.PI / 2; sand.position.set(WORLD.beachX + 38, 0.01, 0); scene.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, H * 2 + 200), new THREE.MeshPhongMaterial({ color: 0x0e7fc4, shininess: 120, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(WORLD.beachX + 160, -0.4, 0); water.name = 'water'; scene.add(water);
  // Roads: dark strips along grid lines + sidewalks (slightly raised light strips)
  const roadGeoX = new THREE.PlaneGeometry(H * 2, WORLD.roadW), roadGeoZ = new THREE.PlaneGeometry(WORLD.roadW, H * 2);
  const roadMat = mat(0x2e3138), sideMat = mat(0xb9b3a4);
  for (let v = -176; v <= 176; v += WORLD.roadEvery) {
    for (const horiz of [true, false]) {
      const side = new THREE.Mesh(horiz ? new THREE.PlaneGeometry(H * 2, WORLD.roadW + 5) : new THREE.PlaneGeometry(WORLD.roadW + 5, H * 2), sideMat);
      side.rotation.x = -Math.PI / 2; side.position.set(horiz ? 0 : v, 0.02, horiz ? v : 0); scene.add(side);
      const r = new THREE.Mesh(horiz ? roadGeoX : roadGeoZ, roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(horiz ? 0 : v, 0.04, horiz ? v : 0); scene.add(r);
    }
  }
  // Buildings inside blocks (instanced boxes + window glow via emissive-ish second instanced set skipped for perf)
  const spots = [];
  for (let bx = -110; bx < WORLD.beachX - 20; bx += WORLD.roadEvery)
    for (let bz = -154; bz < H - 10; bz += WORLD.roadEvery)
      for (let i = 0; i < 2; i++) spots.push({ x: bx - 7 + rnd() * 14, z: bz - 7 + rnd() * 14, w: 9 + rnd() * 8, d: 9 + rnd() * 8, h: 8 + rnd() * rnd() * 30 + 4 });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.h / 2, s.z); dummy.scale.set(s.w, s.h, s.d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix); inst.setColorAt(i, col.setHex(PALETTE[(rnd() * PALETTE.length) | 0]));
    colliders.push({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 });
    // rooftop box
  });
  inst.instanceMatrix.needsUpdate = true; scene.add(inst);
  // Palm trees (instanced trunks + frond cones)
  const palmSpots = [];
  for (let i = 0; i < 130; i++) { const x = -H + rnd() * (WORLD.beachX + H + 30), z = -H + rnd() * H * 2; if (!isRoad(x) && !isRoad(z)) palmSpots.push({ x, z, s: 0.8 + rnd() * 0.5 }); else if (x > WORLD.beachX) palmSpots.push({ x, z, s: 1 }); }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 6, 5), mat(0x8b6f47), palmSpots.length);
  const fronds = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 1.6, 7), mat(0x2e9e4f), palmSpots.length);
  palmSpots.forEach((p, i) => { dummy.rotation.set(0, 0, 0); dummy.position.set(p.x, 3 * p.s, p.z); dummy.scale.set(p.s, p.s, p.s); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); dummy.position.y = 6.4 * p.s; dummy.updateMatrix(); fronds.setMatrixAt(i, dummy.matrix); });
  trunks.instanceMatrix.needsUpdate = fronds.instanceMatrix.needsUpdate = true; scene.add(trunks, fronds);
  // Streetlights (instanced poles + emissive heads)
  const lampSpots = [];
  for (let v = -176; v <= 176; v += WORLD.roadEvery) for (let u = -H + 10; u <= H; u += 30) lampSpots.push({ x: v + 8, z: u }, { x: u, z: v + 8 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 4), mat(0x444a52), lampSpots.length);
  lampSpots.forEach((p, i) => { dummy.position.set(p.x, 2.7, p.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix); });
  poles.instanceMatrix.needsUpdate = true; scene.add(poles);
  // Marina + pier on the water edge (east)
  const pierMat = mat(0x9a7b55);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 14), pierMat); pier.position.set(WORLD.beachX + 62, 0.6, 22); scene.add(pier);
  colliders.push({ minX: WORLD.beachX + 20, maxX: WORLD.beachX + 30, minZ: 8, maxZ: 36 }); // marina hut
  const hut = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 12), mat(0x00a8a8)); hut.position.set(WORLD.beachX + 25, 2.5, 22); scene.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 3, 4), mat(0xe84118)); hutRoof.position.set(WORLD.beachX + 25, 6.5, 22); hutRoof.rotation.y = Math.PI / 4; scene.add(hutRoof);
  for (let i = 0; i < 5; i++) { const boat = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.6), mat(PALETTE[(rnd() * PALETTE.length) | 0])); hull.position.y = 0.4; const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2), mat(0xffffff)); cab.position.set(-0.6, 1.6, 0); boat.add(hull, cab); boat.position.set(WORLD.beachX + 48 + i * 11, 0, 34 + (i % 2) * 6); boat.rotation.y = (rnd() - 0.5) * 0.4; scene.add(boat); }
  // Golden-hour sky helpers: sun sprite + clouds
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd97a })); sun.position.set(320, 90, -180); scene.add(sun);
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9d6, transparent: true, opacity: 0.8 })); c.scale.y = 0.35; c.position.set(-260 + rnd() * 560, 70 + rnd() * 30, -260 + rnd() * 520); scene.add(c); }
  const landmarks = {
    marina: new THREE.Vector3(WORLD.beachX + 16, 0, 22),
    pierEnd: new THREE.Vector3(WORLD.beachX + 88, 1.2, 22),
    garage: new THREE.Vector3(-88, 0, -88),
    plaza: new THREE.Vector3(0, 0, 0),
    depot: new THREE.Vector3(-132, 0, 88),
  };
  return { colliders, landmarks, water };
}

export function collide(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX)), nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) { const d = Math.sqrt(d2); pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius; }
      else { pos.x = c.maxX + radius; }
      return true;
    }
  }
  return false;
}
