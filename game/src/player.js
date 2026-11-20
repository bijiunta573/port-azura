// player.js — Rico Vale: third-person on-foot character with walk/run, gravity and collision.
import * as THREE from 'three';
import { WORLD, collide } from './city.js';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x00a8ff });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2f3542 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.75, 0.3), pants); legs.position.y = 0.38;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt); torso.position.y = 1.1;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), skin); head.position.y = 1.68;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), new THREE.MeshLambertMaterial({ color: 0xe84118 })); cap.position.y = 1.93;
    this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x222831 })); this.gun.position.set(0.38, 1.15, 0.35);
    this.group.add(legs, torso, head, cap, this.gun);
    scene.add(this.group);
    this.pos = this.group.position; this.pos.set(-12, 0, 14);
    this.velY = 0; this.health = 100; this.walkCycle = 0; this.facing = Math.PI; this.inCar = null;
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  update(dt, input, colliders) {
    if (this.inCar) { this.pos.copy(this.inCar.pos); this.group.visible = false; return; }
    this.group.visible = true;
    const mx = input.moveX, mz = input.moveZ;
    const moving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;
    const speed = input.run ? 10.5 : 5.4;
    if (moving) {
      const len = Math.hypot(mx, mz) || 1;
      const sin = Math.sin(input.yaw), cos = Math.cos(input.yaw);
      const dx = (mx * cos - mz * sin) / len, dz = (-mz * cos - mx * sin) / len;
      this.pos.x += dx * speed * dt; this.pos.z += dz * speed * dt;
      this.facing = Math.atan2(dx, dz); this.walkCycle += dt * (input.run ? 13 : 9);
    }
    if (input.keys.Space && this.pos.y === 0) this.velY = 6.5;
    this.velY -= 22 * dt; this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; }
    const p = { x: this.pos.x, z: this.pos.z }; collide(p, 0.55, colliders); this.pos.x = p.x; this.pos.z = p.z;
    this.pos.x = Math.max(-WORLD.half - 20, Math.min(WORLD.beachX + 95, this.pos.x));
    this.pos.z = Math.max(-WORLD.half - 20, Math.min(WORLD.half + 20, this.pos.z));
    if (this.pos.x > WORLD.beachX + 92) this.pos.x = WORLD.beachX + 92; // stay off deep water
    this.group.rotation.y = this.facing;
    this.group.position.y = this.pos.y + Math.abs(Math.sin(this.walkCycle)) * (moving ? 0.06 : 0);
    this.gun.visible = true;
  }
  heal(v) { this.health = Math.min(100, this.health + v); }
  hurt(v) { this.health = Math.max(0, this.health - v); }
}
