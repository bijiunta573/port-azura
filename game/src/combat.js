// combat.js — hitscan pistol, muzzle tracers, rival gang shooters and pier target dummies.
import * as THREE from 'three';

export class Combat {
  constructor(scene) {
    this.scene = scene; this.cooldown = 0; this.tracers = [];
    this.ray = new THREE.Raycaster();
    this.gang = []; this.dummies = [];
  }
  addDummy(x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), new THREE.MeshLambertMaterial({ color: 0x8b6f47 })); post.position.y = 0.55;
    const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 16), new THREE.MeshLambertMaterial({ color: 0xff4757 })); bull.rotation.x = Math.PI / 2; bull.position.y = 1.5;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), new THREE.MeshLambertMaterial({ color: 0xffffff })); inner.rotation.x = Math.PI / 2; inner.position.y = 1.5;
    g.add(post, bull, inner); g.position.set(x, 1.2, z); this.scene.add(g);
    const d = { group: g, pos: g.position, health: 20, dead: false, isDummy: true };
    this.dummies.push(d); return d;
  }
  addGangMember(x, z) {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.28), new THREE.MeshLambertMaterial({ color: 0x222831 })); legs.position.y = 0.36;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), new THREE.MeshLambertMaterial({ color: 0x8e44ad })); torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.38), new THREE.MeshLambertMaterial({ color: 0xe0ac69 })); head.position.y = 1.62;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.46), new THREE.MeshLambertMaterial({ color: 0x111111 })); gun.position.set(0.36, 1.12, 0.3);
    g.add(legs, torso, head, gun); g.position.set(x, 0, z); this.scene.add(g);
    const m = { group: g, pos: g.position, health: 50, dead: false, fireTimer: 1 + Math.random() * 1.5, isGang: true, x, z };
    Object.defineProperty(m, 'x', { get: () => g.position.x }); Object.defineProperty(m, 'z', { get: () => g.position.z });
    this.gang.push(m); return m;
  }
  shoot(game, origin, dir) {
    if (this.cooldown > 0) return false;
    this.cooldown = 0.22; game.audio.gunshot();
    for (const p of game.peds) if (Math.hypot(p.x - origin.x, p.z - origin.z) < 16) p.scare(origin.x, origin.z);
    // Nearest hit among gang, dummies, peds, cars within 70u along dir
    let best = null, bestT = 70;
    const test = (obj, px, pz, r, dmg) => { const ox = px - origin.x, oz = pz - origin.z; const t = ox * dir.x + oz * dir.z; if (t < 1 || t > bestT) return; const cx = origin.x + dir.x * t, cz = origin.z + dir.z * t; if (Math.hypot(px - cx, pz - cz) < r) { bestT = t; best = { obj, dmg }; } };
    for (const m of this.gang) if (!m.dead) test(m, m.x, m.z, 1.0, 34);
    for (const d of this.dummies) if (!d.dead) test(d, d.pos.x, d.pos.z, 1.1, 20);
    for (const p of game.peds) if (!p.dead) test(p, p.x, p.z, 0.8, 30);
    for (const c of game.allCars()) if (!c.dead) test(c, c.x, c.z, 2.2, 12);
    const end = new THREE.Vector3(origin.x + dir.x * bestT, 1.3, origin.z + dir.z * bestT);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(origin.x, 1.35, origin.z), end]), new THREE.LineBasicMaterial({ color: 0xffe66d }));
    this.scene.add(line); this.tracers.push({ line, life: 0.07 });
    if (best) game.onShotHit(best.obj, best.dmg);
    else game.onShotMiss();
    return true;
  }
  update(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) { this.tracers[i].life -= dt; if (this.tracers[i].life <= 0) { this.scene.remove(this.tracers[i].line); this.tracers.splice(i, 1); } }
    // Gang members shoot back when the player is near and armed trouble is on
    if (game.missions.gangActive) {
      const pp = game.playerPos();
      for (const m of this.gang) {
        if (m.dead) continue;
        m.group.rotation.y = Math.atan2(pp.x - m.x, pp.z - m.z);
        m.fireTimer -= dt;
        const d = Math.hypot(pp.x - m.x, pp.z - m.z);
        if (m.fireTimer <= 0 && d < 30) { m.fireTimer = 1.1 + Math.random(); game.audio.gunshot(); if (Math.random() < 0.45) game.damagePlayer(6 + Math.random() * 6, 'gang'); }
      }
    }
  }
  killUnit(u) { u.dead = true; if (u.group) { u.group.rotation.x = Math.PI / 2; u.group.position.y = Math.min(u.group.position.y, 0.3); } }
}
