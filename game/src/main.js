// main.js — Port Azura boot, fixed-timestep game loop and state machine.
import * as THREE from 'three';
import { buildCity, mulberry, collide, WORLD } from './city.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { Player } from './player.js';
import { Car, spawnTraffic, carCollide } from './vehicles.js';
import { PoliceSystem } from './police.js';
import { spawnPeds } from './pedestrians.js';
import { Combat } from './combat.js';
import { Missions, makeMarker } from './missions.js';
import { HUD } from './hud.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT = params.get('shot');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb37a);
scene.fog = new THREE.Fog(0xffc38f, 120, 420);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
scene.add(new THREE.AmbientLight(0xffe0b8, 1.2));
const sunLight = new THREE.DirectionalLight(0xffb066, 1.7); sunLight.position.set(140, 90, -80); scene.add(sunLight);
const hemi = new THREE.HemisphereLight(0x87b5ff, 0x8a6f4d, 0.75); scene.add(hemi);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const rnd = mulberry(SEED * 31 + 7);
const cityData = buildCity(scene, SEED);
const input = new Input(canvas);
const audio = new GameAudio();

class Game {
  constructor() {
    this.city = cityData; this.audio = audio; this.input = input;
    this.state = 'menu'; this.cash = 0; this.time = 0;
    this.player = new Player(scene);
    this.police = new PoliceSystem(scene);
    this.combat = new Combat(scene);
    this.missions = new Missions();
    this.hud = new HUD();
    this.traffic = spawnTraffic(scene, rnd, cityData.colliders);
    this.peds = spawnPeds(scene, rnd, 22);
    this.targetCar = null; this.marker = makeMarker(scene);
    this.camPos = new THREE.Vector3(-20, 8, 30);
    this.engineTick = 0; this.shake = 0;
    for (let i = 0; i < 3; i++) this.combat.addDummy(cityData.landmarks.pierEnd.x - 6 - i * 5, cityData.landmarks.pierEnd.z + (i % 2 ? 4 : -4));
    this.bindMenu();
  }
  bindMenu() {
    const sv = loadSave();
    const info = document.getElementById('saveInfo');
    if (sv) info.textContent = `Saved run found: $${sv.cash}, mission ${Math.min(sv.mission + 1, 4)}/4${sv.done ? ' — story complete' : ''}.`;
    document.getElementById('btnContinue').style.display = sv ? '' : 'none';
    document.getElementById('btnNew').onclick = () => { clearSave(); this.start(0, 0); };
    document.getElementById('btnContinue').onclick = () => { const s = loadSave(); this.start(s ? s.mission : 0, s ? s.cash : 0); };
    document.getElementById('btnResume').onclick = () => this.setState('playing');
    document.getElementById('btnRestart').onclick = () => location.reload();
    document.getElementById('btnRestart2').onclick = () => location.reload();
  }
  start(mission, cash) {
    audio.ensure(); audio.startMusic();
    this.cash = cash; this.missions.startFrom(mission);
    if (mission >= 2) this.spawnTargetCar(), this.retireTargetCar();
    if (mission === 1) this.spawnTargetCar();
    this.setState('playing');
    this.hud.show();
    this.hud.say(mission === 0 ? 'Rico Vale: "One more debt to pay off. Marina\'s waiting at the marina — east, by the water."' : 'Welcome back to Port Azura, Rico.', 6);
    this.persist();
  }
  setState(s) {
    this.state = s;
    document.getElementById('menu').classList.toggle('hidden', s !== 'menu');
    document.getElementById('pauseScr').classList.toggle('hidden', s !== 'paused');
    document.getElementById('endScr').classList.toggle('hidden', !(s === 'busted' || s === 'wasted' || s === 'won'));
    if (s === 'playing') this.hud.show();
  }
  persist() { writeSave({ cash: this.cash, mission: this.missions.index, done: this.missions.done }); }
  addCash(v) { this.cash += v; }
  playerPos() { return this.player.inCar ? this.player.inCar.pos : this.player.pos; }
  playerAngle() { return this.player.inCar ? this.player.inCar.angle : this.player.facing; }
  playerSpeed() { return this.player.inCar ? Math.abs(this.player.inCar.speed) : 0; }
  allCars() { return [...this.traffic, ...this.police.cars, ...(this.targetCar ? [this.targetCar] : [])]; }
  spawnTargetCar() {
    if (this.targetCar) return;
    const L = this.city.landmarks;
    this.targetCar = new Car(scene, L.garage.x + 8, L.garage.z + 6, 0.6, 0xf5c542, { parked: true, targetCar: true });
  }
  retireTargetCar() { if (this.targetCar) { scene.remove(this.targetCar.group); this.targetCar = null; } }
  spawnGang() { const L = this.city.landmarks; for (let i = 0; i < 3; i++) this.combat.addGangMember(L.pierEnd.x - 4 - i * 4, L.pierEnd.z + (i - 1) * 5); }
  nearestCar(maxD = 4.2) { let best = null, bd = maxD; for (const c of this.allCars()) { if (c.dead || c.isPolice) continue; const d = Math.hypot(c.x - this.player.x, c.z - this.player.z); if (d < bd) { bd = d; best = c; } } return best; }
  enterCar(car) {
    this.player.inCar = car; this.player.group.visible = false; car.parked = false; car.isTraffic = false;
    const idx = this.traffic.indexOf(car); if (idx >= 0) this.traffic.splice(idx, 1);
    // Theft witnessed near peds/cops = crime
    const witnessed = this.peds.some(p => Math.hypot(p.x - car.x, p.z - car.z) < 18) || this.police.cars.length > 0;
    if (witnessed) { this.police.addCrime(car === this.targetCar ? 1.2 : 0.8, this); this.hud.say(witnessed ? '🚨 Car theft witnessed! The Azura PD is rolling.' : '', 3); }
    audio.chime();
  }
  exitCar(silent = false) {
    const car = this.player.inCar; if (!car) return;
    this.player.inCar = null; this.player.group.visible = true;
    this.player.pos.set(car.x + Math.cos(car.angle) * 2.4, 0, car.z - Math.sin(car.angle) * 2.4);
    car.speed = 0; if (!silent) this.traffic.push(car);
  }
  onWantedUp(n) { this.hud.say(`⭐ Wanted level ${n} — Azura PD is coming for you, Rico!`, 3.5); }
  onRam(cop) {
    if (this.player.inCar) { this.player.inCar.health -= 9; this.damagePlayer(4, 'ram'); if (this.player.inCar.health <= 0) { this.player.inCar.dead = true; this.exitCar(); this.hud.say('Your ride is wrecked!', 3); } }
    else this.damagePlayer(11, 'ram');
    this.shake = 0.35; audio.thud();
  }
  damagePlayer(v, why) {
    if (this.state !== 'playing') return;
    this.player.hurt(v); this.shake = Math.max(this.shake, 0.18);
    if (this.player.health <= 0) this.onWasted(why);
  }
  onBusted() { if (this.state !== 'playing') return; this.setState('busted'); audio.stopSiren(); document.getElementById('endTitle').textContent = '🚓 BUSTED'; document.getElementById('endText').textContent = `Azura PD pinned Rico with ${this.police.wanted} star${this.police.wanted > 1 ? 's' : ''} on his head. Cash kept: $${this.cash}. Missions done: ${this.missions.index}/4.`; this.persist(); }
  onWasted(why) { if (this.state !== 'playing') return; this.setState('wasted'); audio.stopSiren(); document.getElementById('endTitle').textContent = '💀 WASTED'; document.getElementById('endText').textContent = `Rico flatlined in Port Azura (${why === 'gang' ? 'Viper gunfire' : 'police pressure'}). Cash kept: $${this.cash}. The marina clinic patched him up — try again.`; this.persist(); }
  onWin() { this.setState('won'); document.getElementById('endTitle').textContent = '🏆 PORT AZURA IS YOURS'; document.getElementById('endText').textContent = `All 4 jobs done. Rico and Marina run the port now. Final cash: $${this.cash}. Keep free-roaming — your save keeps the crown.`; }
  onShotHit(obj, dmg) {
    if (obj.isGang) { obj.health -= dmg; this.hud.say(`Hit! Viper health ${Math.max(0, obj.health)}`, 1.2); if (obj.health <= 0) { this.combat.killUnit(obj); this.addCash(40); this.hud.say('Viper down! +$40', 2); } this.police.addCrime(0.35, this); }
    else if (obj.isDummy) { obj.health -= dmg; if (obj.health <= 0 && !obj.dead) { obj.dead = true; obj.group.visible = false; this.addCash(25); audio.chime(); this.hud.say('🎯 Target down! +$25 practice bonus', 2); } }
    else if (obj.hurt) { const died = obj.hurt(dmg); this.police.addCrime(1.4, this); this.hud.say(died ? '⚠ You shot a civilian! Major heat!' : '⚠ You shot a civilian!', 2.5); }
    else if (obj.health !== undefined) { obj.health -= dmg; this.police.addCrime(0.5, this); if (obj.health <= 0) { obj.dead = true; obj.bodyMat.color.setHex(0x333333); } }
  }
  onShotMiss() { this.police.addCrime(0.22, this); }
  update(dt) {
    this.time += dt;
    if (this.state !== 'playing') return;
    const inputRef = input;
    // Enter / exit car
    if (inputRef.consumeAct()) {
      if (this.player.inCar) this.exitCar();
      else { const c = this.nearestCar(); if (c) this.enterCar(c); }
    }
    if (!this.player.inCar) {
      const near = this.nearestCar();
      this.hud.setPrompt(near ? 'Press E / ENTER to steal this car' : (this.missions.index === 0 ? '' : ''));
    } else this.hud.setPrompt('E to exit · W/S drive · A/D steer · Space brake');
    // Driving or walking
    if (this.player.inCar) {
      const car = this.player.inCar;
      const throttle = (inputRef.keys.KeyW || inputRef.joyY < -0.3) ? 1 : (inputRef.keys.KeyS || inputRef.joyY > 0.3) ? -1 : 0;
      const steer = (inputRef.keys.KeyA ? 1 : 0) - (inputRef.keys.KeyD ? 1 : 0) + (-inputRef.joyX);
      const before = Math.abs(car.speed);
      car.drive(dt, throttle, steer * (inputRef.keys.Space ? 0.4 : 1));
      if (inputRef.keys.Space) car.speed -= car.speed * 3.2 * dt;
      if (carCollide(car, this.city.colliders)) { if (before > 7) { this.damagePlayer(3, 'crash'); audio.thud(); this.police.addCrime(0.3, this); } car.speed *= -0.35; }
      // Car vs car / ped collisions
      for (const o of this.allCars()) { if (o !== car && !o.dead && Math.hypot(o.x - car.x, o.z - car.z) < 3.4) { o.health -= Math.abs(car.speed) * 1.4; car.speed *= 0.55; if (Math.abs(car.speed) > 3) { audio.thud(); this.police.addCrime(0.55, this); this.shake = 0.25; } if (o.health <= 0) { o.dead = true; o.bodyMat?.color.setHex(0x333333); } } }
      for (const p of this.peds) { if (!p.dead && Math.hypot(p.x - car.x, p.z - car.z) < 2.2 && Math.abs(car.speed) > 2) { p.hurt(100); this.police.addCrime(1.5, this); this.hud.say('⚠ You ran someone over! Serious heat!', 3); audio.thud(); } else if (!p.dead && Math.hypot(p.x - car.x, p.z - car.z) < 9) p.scare(car.x, car.z); }
      this.engineTick -= dt; if (throttle !== 0 && this.engineTick <= 0) { audio.engine(car.speed); this.engineTick = 0.1; }
      this.player.pos.copy(car.pos);
    } else {
      this.player.update(dt, inputRef, this.city.colliders);
    }
    // Shooting on foot
    if (!this.player.inCar && inputRef.consumeFire()) {
      const dir = { x: -Math.sin(inputRef.yaw) * Math.cos(0) , z: -Math.cos(inputRef.yaw) };
      // Aim follows camera yaw: forward vector
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      this.combat.shoot(this, { x: this.player.x, z: this.player.z }, { x: fwd.x, z: fwd.z });
      this.player.facing = inputRef.yaw + Math.PI;
    }
    for (const c of this.traffic) if (c.isTraffic) c.updateTraffic(dt, this.city.colliders);
    const danger = this.player.inCar && Math.abs(this.player.inCar.speed) > 6 ? this.player.inCar.pos : null;
    for (const p of this.peds) p.update(dt, this.city.colliders, danger);
    this.police.update(dt, this);
    this.combat.update(dt, this);
    this.missions.update(this, dt);
    // Objective marker follows current target
    const obj = this.missions.objectivePos(this);
    if (obj) { this.marker.visible = true; this.marker.position.set(obj.x, 0, obj.z); this.marker.rotation.y += dt; }
    else this.marker.visible = false;
    if (this.city.water) this.city.water.position.y = -0.4 + Math.sin(this.time * 0.8) * 0.08;
    this.hud.update(this, dt);
    this.updateCamera(dt);
  }
  updateCamera(dt) {
    const target = this.playerPos();
    const back = this.player.inCar ? 11.5 : 8.5, height = this.player.inCar ? 4.6 : 3.4 + input.pitch * 3;
    const yaw = this.player.inCar ? this.player.inCar.angle : input.yaw;
    const desired = new THREE.Vector3(target.x - Math.sin(yaw) * back * Math.cos(input.pitch * 0.4), height, target.z - Math.cos(yaw) * back * Math.cos(input.pitch * 0.4));
    if (this.player.inCar) desired.set(target.x - Math.sin(yaw) * back, height, target.z - Math.cos(yaw) * back);
    this.camPos.lerp(desired, 1 - Math.pow(0.0001, dt));
    camera.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; camera.position.x += (Math.random() - 0.5) * this.shake; camera.position.y += (Math.random() - 0.5) * this.shake * 0.6; }
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }
}

const game = new Game();
window.__game = game;

// Shot hooks: deterministic scenes for screenshots
function setupShot(name) {
  game.start(0, 250);
  const L = cityData.landmarks;
  if (name === 'cover') { game.player.pos.set(106, 0, -3); game.player.facing = Math.PI / 2; input.yaw = Math.PI / 2 + 0.3; game.missions.index = 0; }
  if (name === 'drive') {
    const car = game.traffic.find(c => !c.isTraffic) || game.traffic[0];
    car.pos.set(3, 0, -52); car.angle = 0; game.enterCarSilent(car); game.player.inCar.speed = 13; input.yaw = 0;
    game.missions.index = 1; game.spawnTargetCar();
  }
  if (name === 'chase') {
    const car = game.traffic.find(c => !c.isTraffic) || game.traffic[0];
    car.pos.set(3, 0, 20); car.angle = 0; game.enterCarSilent(car); game.player.inCar.speed = 15;
    game.missions.index = 1; game.missions.stage = 1; game.spawnTargetCar();
    game.police.heat = 3.2; game.police.wanted = 3;
    const spots = [[-4, 44], [7, 52], [0, 6]];
    for (let i = 0; i < 3; i++) { const cop = game.police.spawnNear(car.pos); cop.pos.set(spots[i][0], 0, spots[i][1]); cop.angle = i === 2 ? 0 : Math.PI; cop.speed = i === 2 ? 13 : 0; }
    game.hud.say('🚨 Azura PD: "PULL OVER, RICO!"', 30);
  }
  if (name === 'pier') {
    game.missions.index = 3; game.player.pos.set(L.pierEnd.x - 21, 0, L.pierEnd.z + 2); game.player.facing = Math.PI / 2;
    input.yaw = Math.PI / 2; game.missions.gangActive = true; game.missions.timer = 120; game.missions.gangLeft = 3; game.spawnGang();
    game.police.heat = 1.2; game.police.wanted = 1;
    game.hud.say('Viper Leader: "Wrong pier, courier!"', 30);
  }
  game.updateCamera(1);
}
Game.prototype.enterCarSilent = function (car) { this.player.inCar = car; this.player.group.visible = false; car.parked = false; car.isTraffic = false; const i = this.traffic.indexOf(car); if (i >= 0) this.traffic.splice(i, 1); this.player.pos.copy(car.pos); };

if (SHOT) { setupShot(SHOT); document.getElementById('menu').classList.add('hidden'); }

addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { if (game.state === 'playing') game.setState('paused'); else if (game.state === 'paused') game.setState('playing'); }
  if (e.code === 'KeyM') { audio.ensure(); const m = audio.toggleMute(); game.hud.say(m ? '🔇 Audio muted' : '🔊 Audio on', 1.5); }
});

// Fixed-timestep loop with delta clamp
let last = performance.now(), acc = 0; const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.1); acc += dt;
  let n = 0;
  while (acc >= STEP && n < 6) { game.update(STEP); acc -= STEP; n++; }
  if (n === 6) acc = 0;
  if (game.state === 'menu') { // slow menu orbit
    const t = now / 9000; camera.position.set(Math.sin(t) * 55, 24, Math.cos(t) * 55); camera.lookAt(0, 4, 0);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
