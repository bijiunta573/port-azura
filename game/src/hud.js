// hud.js — DOM HUD (health, cash, stars, objective, dialogue) and the 2D canvas minimap.
import { WORLD } from './city.js';

export class HUD {
  constructor() {
    this.el = id => document.getElementById(id);
    this.hud = this.el('hud'); this.healthBar = this.el('healthBar'); this.cash = this.el('cash');
    this.stars = this.el('stars'); this.objective = this.el('objective'); this.dialogue = this.el('dialogue');
    this.prompt = this.el('prompt'); this.mode = this.el('modeLabel'); this.clock = this.el('clock');
    this.map = this.el('minimap').getContext('2d'); this.dialogueTimer = 0;
  }
  show() { this.hud.classList.remove('hidden'); document.getElementById('touch').classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }
  say(text, secs = 4) { this.dialogue.textContent = text; this.dialogue.classList.remove('hidden'); this.dialogueTimer = secs; }
  setPrompt(text) { if (text) { this.prompt.textContent = text; this.prompt.classList.remove('hidden'); } else this.prompt.classList.add('hidden'); }
  update(game, dt) {
    this.healthBar.style.width = Math.max(0, game.player.health) + '%';
    this.cash.textContent = game.cash;
    const w = game.police.wanted;
    this.stars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    this.stars.style.color = w ? '#ffd23f' : '#8899aa';
    this.mode.textContent = game.player.inCar ? 'Driving' : 'On Foot';
    this.clock.textContent = (game.police.bustMeter > 0.2 ? '⚠ BUSTED IN ' + (2.6 - game.police.bustMeter).toFixed(1) + 's · ' : '') + 'Golden Hour';
    this.objective.textContent = game.missions.objectiveText(game);
    if (this.dialogueTimer > 0) { this.dialogueTimer -= dt; if (this.dialogueTimer <= 0) this.dialogue.classList.add('hidden'); }
    this.drawMap(game);
  }
  drawMap(game) {
    const c = this.map, S = 170, H = WORLD.half + 30, sc = S / (H * 2);
    const px = v => (v + H) * sc;
    c.fillStyle = '#274b63'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#e9d8a6'; c.fillRect(px(WORLD.beachX + 8), 0, S, S); // sand
    c.fillStyle = '#0e7fc4'; c.fillRect(px(WORLD.beachX + 55), 0, S, S); // sea
    c.strokeStyle = '#454b54'; c.lineWidth = 3;
    for (let v = -176; v <= 176; v += WORLD.roadEvery) { c.beginPath(); c.moveTo(px(v), 0); c.lineTo(px(v), S); c.stroke(); c.beginPath(); c.moveTo(0, px(v)); c.lineTo(S, px(v)); c.stroke(); }
    const dot = (x, z, col, r = 3) => { c.fillStyle = col; c.beginPath(); c.arc(px(x), px(z), r, 0, 7); c.fill(); };
    for (const car of game.traffic) if (!car.dead) dot(car.x, car.z, '#cccccc', 2);
    for (const cop of game.police.cars) dot(cop.x, cop.z, Math.floor(performance.now() / 300) % 2 ? '#ff3333' : '#3388ff', 3.5);
    const obj = game.missions.objectivePos(game);
    if (obj) { c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.arc(px(obj.x), px(obj.z), 6 + Math.sin(performance.now() / 200) * 1.5, 0, 7); c.stroke(); dot(obj.x, obj.z, '#ffd23f', 2.5); }
    const pp = game.playerPos();
    c.save(); c.translate(px(pp.x), px(pp.z)); c.rotate(Math.atan2(Math.sin(game.playerAngle()), Math.cos(game.playerAngle())) * 0 + (Math.PI - game.playerAngle())); c.fillStyle = '#00ff88'; c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill(); c.restore();
  }
}
