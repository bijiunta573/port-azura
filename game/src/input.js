// input.js — keyboard, mouse-look and touch controls for Port Azura.
export class Input {
  constructor(canvas) {
    this.keys = {}; this.yaw = Math.PI; this.pitch = 0.18;
    this.fireHeld = false; this.firePressed = false; this.actPressed = false;
    this.joyX = 0; this.joyY = 0; this.touchRun = false; this.touchFire = false; this.touchAct = false;
    addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'KeyE') this.actPressed = true; if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) { this.fireHeld = true; this.firePressed = true; } });
    addEventListener('mouseup', () => { this.fireHeld = false; });
    canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas && matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.(); });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        this.yaw -= e.movementX * 0.0026; this.pitch += e.movementY * 0.0022;
        this.pitch = Math.max(-0.15, Math.min(1.0, this.pitch));
      }
    });
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let sid = null;
    const setKnob = (dx, dy) => { if (knob) { knob.style.left = (35 + dx * 32) + 'px'; knob.style.top = (35 + dy * 32) + 'px'; } };
    stick?.addEventListener('touchstart', e => { sid = e.changedTouches[0].identifier; }, { passive: true });
    addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === sid && stick) { const r = stick.getBoundingClientRect(); let dx = (t.clientX - (r.left + 55)) / 45, dy = (t.clientY - (r.top + 55)) / 45; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } this.joyX = dx; this.joyY = dy; setKnob(dx, dy); } }, { passive: true });
    addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; this.joyX = this.joyY = 0; setKnob(0, 0); } });
    const bind = (id, on, off) => { const el = document.getElementById(id); el?.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false }); el?.addEventListener('touchend', () => { if (off) off(); }); };
    bind('btnAct', () => { this.touchAct = true; this.actPressed = true; });
    bind('btnFire', () => { this.touchFire = true; this.firePressed = true; }, () => { this.touchFire = false; });
    bind('btnRun', () => { this.touchRun = true; }, () => { this.touchRun = false; });
    let lid = null, lx = 0, ly = 0;
    canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t.clientX > innerWidth * 0.45) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: true });
    canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lid) { this.yaw -= (t.clientX - lx) * 0.006; this.pitch += (t.clientY - ly) * 0.004; this.pitch = Math.max(-0.15, Math.min(1, this.pitch)); lx = t.clientX; ly = t.clientY; } }, { passive: true });
  }
  get moveX() { return (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0) + this.joyX; }
  get moveZ() { return (this.keys.KeyS ? 1 : 0) - (this.keys.KeyW ? 1 : 0) + this.joyY; }
  get run() { return !!this.keys.ShiftLeft || !!this.keys.ShiftRight || this.touchRun; }
  get firing() { return this.fireHeld || this.touchFire || !!this.keys.KeyF; }
  consumeFire() { const v = this.firePressed || this.firing; this.firePressed = false; return v; }
  consumeAct() { const v = this.actPressed; this.actPressed = false; return v; }
}
