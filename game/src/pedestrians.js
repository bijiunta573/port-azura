// pedestrians.js — wandering citizens of Port Azura who flee gunfire, cars and chaos.
import * as THREE from 'three';
import { WORLD, collide } from './city.js';

const SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac];
const CLOTH = [0xff6b81, 0x7bed9f, 0x70a1ff, 0xeccc68, 0xff9ff3, 0x48dbfb, 0xf368e0, 0x1dd1a1];
export class Pedestrian {
  constructor(scene, rnd) {
    this.group = new THREE.Group();
    const s = SKIN[(rnd() * SKIN.length) | 0], c = CLOTH[(rnd() * CLOTH.length) | 0];
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.7, 0.26), new THREE.MeshLambertMaterial({ color: 0x3b3b4f })); legs.position.y = 0.35;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.3), new THREE.MeshLambertMaterial({ color: c })); torso.position.y = 1.04;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), new THREE.MeshLambertMaterial({ color: s })); head.position.y = 1.58;
    this.group.add(legs, torso, head); scene.add(this.group);
    this.pos = this.group.position;
    this.pos.set(-WORLD.half + rnd() * (WORLD.half * 2), 0, -WORLD.half + rnd() * WORLD.half * 2);
    this.angle = rnd() * Math.PI * 2; this.speed = 1.6 + rnd() * 1.2; this.health = 30;
    this.state = 'wander'; this.timer = 2 + rnd() * 4; this.dead = false; this.fleeFrom = null;
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  scare(x, z) { if (!this.dead) { this.state = 'flee'; this.fleeFrom = { x, z }; this.timer = 2.5; } }
  update(dt, colliders, danger) {
    if (this.dead) { this.group.rotation.x = Math.PI / 2; this.group.position.y = 0.25; return; }
    if (danger && Math.hypot(danger.x - this.x, danger.z - this.z) < 13) this.scare(danger.x, danger.z);
    this.timer -= dt;
    if (this.state === 'flee' && this.fleeFrom) {
      this.angle = Math.atan2(this.x - this.fleeFrom.x, this.z - this.fleeFrom.z);
      this.pos.x += Math.sin(this.angle) * 6.4 * dt; this.pos.z += Math.cos(this.angle) * 6.4 * dt;
      if (this.timer <= 0) { this.state = 'wander'; this.fleeFrom = null; }
    } else {
      if (this.timer <= 0) { this.angle = Math.random() * Math.PI * 2; this.timer = 3 + Math.random() * 4; }
      this.pos.x += Math.sin(this.angle) * this.speed * dt; this.pos.z += Math.cos(this.angle) * this.speed * dt;
    }
    const p = { x: this.pos.x, z: this.pos.z }; if (collide(p, 0.5, colliders)) { this.angle += Math.PI * 0.8; } this.pos.x = p.x; this.pos.z = p.z;
    this.pos.x = Math.max(-WORLD.half, Math.min(WORLD.beachX + 40, this.pos.x));
    this.pos.z = Math.max(-WORLD.half, Math.min(WORLD.half, this.pos.z));
    this.group.rotation.y = this.angle;
  }
  hurt(v) { this.health -= v; if (this.health <= 0) this.dead = true; return this.dead; }
}
export function spawnPeds(scene, rnd, n = 22) { const a = []; for (let i = 0; i < n; i++) a.push(new Pedestrian(scene, rnd)); return a; }
