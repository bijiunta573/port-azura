// missions.js — Marina Sol's story chain: four jobs that take Rico from broke courier to port boss.
import * as THREE from 'three';

export const MISSION_NAMES = ['Meet the Fixer', 'The Gold Comet', 'Lose the Heat', 'Pier Showdown'];
export class Missions {
  constructor() { this.index = 0; this.stage = 0; this.timer = 0; this.gangLeft = 0; this.gangActive = false; this.done = false; this.started = false; }
  startFrom(n) { this.index = n; this.stage = 0; this.done = n >= 4; }
  objectiveText(game) {
    if (this.done) return '🏆 You own Port Azura. Free-roam: cause chaos, outrun the PD, stack cash.';
    const L = game.city.landmarks;
    switch (this.index) {
      case 0: return '📍 Mission 1/4 — Meet fixer Marina Sol at the Marina (east beach, gold marker)';
      case 1: return this.stage === 0 ? '🚗 Mission 2/4 — Steal the GOLD COMET near the Old Garage (NW)' : '🏁 Mission 2/4 — Deliver the Gold Comet to the Depot (SW) — reward $400';
      case 2: return '🚨 Mission 3/4 — LOSE THE HEAT: break line of sight until your wanted stars clear';
      case 3: return this.gangActive ? `🔫 Mission 4/4 — PIER SHOWDOWN: drop the Violet Vipers! ${this.gangLeft} left · ⏱ ${Math.max(0, Math.ceil(this.timer))}s` : '📍 Mission 4/4 — Head to the Pier (east, past the marina) and face the Violet Vipers';
    }
    return '';
  }
  objectivePos(game) {
    if (this.done) return null;
    const L = game.city.landmarks;
    if (this.index === 0) return L.marina;
    if (this.index === 1) return this.stage === 0 ? (game.targetCar ? game.targetCar.pos : L.garage) : L.depot;
    if (this.index === 2) return null;
    return L.pierEnd;
  }
  complete(game, reward, text) {
    game.addCash(reward); game.audio.cash(); game.hud.say(text, 6);
    this.index++; this.stage = 0; game.persist();
    if (this.index >= 4) { this.done = true; game.onWin(); }
  }
  update(game, dt) {
    if (this.done || game.state !== 'playing') return;
    const pp = game.playerPos(), L = game.city.landmarks;
    const near = (v, r) => Math.hypot(pp.x - v.x, pp.z - v.z) < r;
    if (this.index === 0 && near(L.marina, 7)) {
      game.hud.say('Marina Sol: "Rico! The Vipers stole my gold Comet. Steal it back from the Old Garage, deliver it to the Depot. And try not to get pinched."', 7);
      game.audio.chime(); this.index = 1; game.spawnTargetCar(); game.persist();
    } else if (this.index === 1) {
      if (this.stage === 0 && game.player.inCar === game.targetCar && game.targetCar) { this.stage = 1; game.hud.say('Marina (phone): "That\'s my Comet! Depot, south-west. The PD saw you — move!"', 5); }
      else if (this.stage === 1 && game.player.inCar === game.targetCar && near(L.depot, 9)) {
        game.exitCar(true); game.retireTargetCar();
        this.complete(game, 400, 'Marina Sol: "Beautiful. $400 wired. Now shake those sirens for good — job three."');
        game.police.addCrime(2.2, game);
      }
    } else if (this.index === 2) {
      if (game.police.wanted === 0) this.complete(game, 250, 'Marina Sol: "Clean. Last job: the Vipers are waiting on MY pier. End it. $750."');
    } else if (this.index === 3) {
      if (!this.gangActive && near(L.pierEnd, 26)) {
        this.gangActive = true; this.timer = 150; this.gangLeft = 3;
        game.spawnGang(); game.hud.say('Viper Leader: "Wrong pier, courier!" — Marina: "Drop them, Rico!"', 6);
        game.police.addCrime(0.6, game);
      }
      if (this.gangActive) {
        this.timer -= dt;
        this.gangLeft = game.combat.gang.filter(m => !m.dead).length;
        if (this.gangLeft <= 0) { this.gangActive = false; this.complete(game, 750, 'Marina Sol: "The port is ours, partner. Port Azura belongs to us now. 🏆"'); }
        else if (this.timer <= 0) { this.gangActive = false; for (const m of game.combat.gang) if (!m.dead) { m.dead = true; m.group.visible = false; } game.hud.say('The Vipers slipped away into the night. Return to the pier to try again.', 5); }
      }
    }
  }
}
export function makeMarker(scene, color = 0xffd23f) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 13; const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 24), new THREE.MeshBasicMaterial({ color })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
  g.add(beam, ring); scene.add(g); return g;
}
