// vehicles.js — car meshes, parked cars, road-following traffic and player driving physics.
import * as THREE from 'three';
import { WORLD, isRoad, collide } from './city.js';

const COLORS = [0xe84118, 0x0097e6, 0xfbc531, 0x4cd137, 0xeccc68, 0xffffff, 0x718093, 0xff6b81, 0x7bed9f];
let geoBody, geoCab, geoWheel, matGlass, matTire;
function geos() { if (!geoBody) { geoBody = new THREE.BoxGeometry(2, 0.62, 4.2); geoCab = new THREE.BoxGeometry(1.7, 0.55, 2); geoWheel = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10); matGlass = new THREE.MeshLambertMaterial({ color: 0x1b2a3a }); matTire = new THREE.MeshLambertMaterial({ color: 0x15181c }); } }

export class Car {
  constructor(scene, x, z, angle, color, opts = {}) {
    geos();
    this.group = new THREE.Group();
    this.bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(geoBody, this.bodyMat); body.position.y = 0.55;
    const cab = new THREE.Mesh(geoCab, opts.police ? new THREE.MeshLambertMaterial({ color: 0xf5f6fa }) : matGlass); cab.position.set(0, 1.1, -0.2);
    this.group.add(body, cab);
    this.wheels = [];
    for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.Mesh(geoWheel, matTire); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); this.group.add(w); this.wheels.push(w); }
    if (opts.police) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 })); bar.position.set(0, 1.5, -0.2); bar.name = 'lightbar'; this.group.add(bar); const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.22), new THREE.MeshLambertMaterial({ color: 0x192a56 })); stripe.position.y = 0.42; this.group.add(stripe); }
    this.group.position.set(x, 0, z); this.group.rotation.y = angle;
    scene.add(this.group);
    this.pos = this.group.position; this.angle = angle; this.speed = 0; this.steer = 0;
    this.health = 100; this.isPolice = !!opts.police; this.isTraffic = !!opts.traffic; this.parked = !!opts.parked;
    this.targetCar = !!opts.targetCar; this.dead = false; this.laneDir = opts.laneDir || 1; this.axis = opts.axis || 'z'; this.hitCooldown = 0;
    if (this.targetCar) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; this.group.add(ring); }
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  drive(dt, throttle, steerIn) {
    const accel = throttle > 0 ? 15 : throttle < 0 ? (this.speed > 0.5 ? -26 : -8) : 0;
    this.speed += accel * dt; this.speed -= this.speed * 0.55 * dt;
    this.speed = Math.max(-9, Math.min(24, this.speed));
    if (Math.abs(this.speed) > 0.2) this.angle -= steerIn * dt * 1.7 * Math.sign(this.speed) * Math.min(1, Math.abs(this.speed) / 8);
    this.pos.x += Math.sin(this.angle) * this.speed * dt; this.pos.z += Math.cos(this.angle) * this.speed * dt;
    this.sync();
  }
  sync() { this.group.rotation.y = this.angle; for (const w of this.wheels) w.rotation.x += this.speed * 0.05; }
  updateTraffic(dt, colliders) {
    if (this.dead) return;
    const sp = 9;
    if (this.axis === 'z') { this.pos.z += this.laneDir * sp * dt; this.angle = this.laneDir > 0 ? 0 : Math.PI; if (Math.abs(this.pos.z) > WORLD.half - 6) { this.laneDir *= -1; this.pos.x += this.laneDir * 0; this.pos.x = snapLane(this.pos.x, 'x'); } }
    else { this.pos.x += this.laneDir * sp * dt; this.angle = this.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2; if (Math.abs(this.pos.x) > WORLD.half - 6) this.laneDir *= -1; }
    this.speed = sp; this.sync();
  }
}
function snapLane(v, axis) { const step = WORLD.roadEvery; return Math.round(v / step) * step + 3; }
const LANES = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
export function spawnTraffic(scene, rnd, colliders) {
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const horiz = rnd() > 0.5, lane = LANES[(rnd() * LANES.length) | 0];
    const along = -WORLD.half + rnd() * WORLD.half * 2;
    const c = new Car(scene, horiz ? along : lane + 3, horiz ? lane + 3 : along, 0, COLORS[(rnd() * COLORS.length) | 0], { traffic: true, axis: horiz ? 'x' : 'z', laneDir: rnd() > 0.5 ? 1 : -1 });
    cars.push(c);
  }
  // Parked cars along curbs
  for (let i = 0; i < 16; i++) {
    const lane = LANES[(rnd() * LANES.length) | 0];
    const along = -WORLD.half + 16 + rnd() * (WORLD.half * 2 - 32);
    const vertical = rnd() > 0.5;
    const c = new Car(scene, vertical ? lane + 5.4 : along, vertical ? along : lane + 5.4, vertical ? 0 : Math.PI / 2, COLORS[(rnd() * COLORS.length) | 0], { parked: true });
    cars.push(c);
  }
  return cars;
}
export function carCollide(car, colliders) { const p = { x: car.pos.x, z: car.pos.z }; const hit = collide(p, 2.1, colliders); if (hit) { car.pos.x = p.x; car.pos.z = p.z; } return hit; }
export { isRoad };
