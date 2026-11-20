// police.js — Azura PD: wanted stars, pursuit AI, ramming, busted meter and wanted decay.
import * as THREE from 'three';
import { Car, carCollide } from './vehicles.js';
import { WORLD } from './city.js';

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene; this.wanted = 0; this.cars = []; this.hideTimer = 0; this.bustMeter = 0;
    this.spawnTimer = 0; this.seenTimer = 0;
  }
  addCrime(points, game) {
    const before = this.wanted;
    this.heat = Math.min(5, (this.heat || 0) + points);
    this.wanted = Math.max(this.wanted, Math.min(5, Math.ceil(this.heat)));
    if (this.wanted > before && game) game.onWantedUp(this.wanted);
  }
  syncHeat() { if (this.wanted > 0) this.heat = Math.max(this.heat || 0, this.wanted - 0.4); }
  desiredCars() { return this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 6); }
  spawnNear(target) {
    const a = Math.random() * Math.PI * 2, d = 55 + Math.random() * 25;
    const x = Math.max(-WORLD.half, Math.min(WORLD.half, target.x + Math.sin(a) * d));
    const z = Math.max(-WORLD.half, Math.min(WORLD.half, target.z + Math.cos(a) * d));
    const c = new Car(this.scene, x, z, a, 0x2f3542, { police: true });
    this.cars.push(c); return c;
  }
  update(dt, game) {
    const target = game.playerPos();
    if (this.wanted > 0) {
      this.spawnTimer -= dt;
      if (this.cars.length < this.desiredCars() && this.spawnTimer <= 0) { this.spawnNear(target); this.spawnTimer = 2.5; }
      // Visibility: police within 45u and roughly facing = seen
      let seen = false, nearest = 1e9;
      for (const c of this.cars) { const d = Math.hypot(c.x - target.x, c.z - target.z); nearest = Math.min(nearest, d); if (d < 48) seen = true; }
      if (seen) { this.seenTimer = 0; this.hideTimer = 0; } else { this.seenTimer += dt; this.hideTimer += dt; }
      if (this.hideTimer > 9) { this.heat = Math.max(0, (this.heat || 0) - dt * 0.12); const nw = Math.ceil(this.heat - 0.001); if (nw < this.wanted) { this.wanted = Math.max(0, nw); if (this.wanted === 0) this.heat = 0; } }
      // Busted: slow / on foot and a cop is right on top of you
      const slow = game.playerSpeed() < 2.2;
      if (nearest < 5.2 && slow) { this.bustMeter += dt; if (this.bustMeter > 2.6) game.onBusted(); }
      else this.bustMeter = Math.max(0, this.bustMeter - dt * 1.5);
      if (this.cars.length && game.audio) game.audio.startSiren(); else game.audio?.stopSiren();
    } else {
      this.bustMeter = 0; game.audio?.stopSiren();
      for (const c of this.cars) this.scene.remove(c.group);
      this.cars = [];
    }
    // Pursuit steering
    for (const c of this.cars) {
      if (c.dead) continue;
      const dx = target.x - c.x, dz = target.z - c.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - c.angle; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      const throttle = dist > 7 ? 1 : dist < 3.4 ? -0.6 : 0.25;
      const before = { x: c.x, z: c.z };
      c.drive(dt * 1.12, throttle, steer);
      if (carCollide(c, game.city.colliders)) { c.speed *= -0.4; c.angle += 0.5; }
      // Ram damage
      if (dist < 3.1 && Math.abs(c.speed) > 4 && c.hitCooldown <= 0) { game.onRam(c); c.hitCooldown = 0.9; }
      c.hitCooldown = Math.max(0, c.hitCooldown - dt);
      const bar = c.group.getObjectByName('lightbar'); if (bar) bar.material.color.setHex(Math.floor(performance.now() / 280) % 2 ? 0xff2222 : 0x2266ff);
      void before;
    }
  }
  clear() { for (const c of this.cars) this.scene.remove(c.group); this.cars = []; this.wanted = 0; this.heat = 0; this.bustMeter = 0; }
}
