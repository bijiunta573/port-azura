// audio.js — WebAudio-synthesized SFX and a simple synth music loop. No audio files.
export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = null; this.note = 0; this.sirenOsc = null; }
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } } if (this.ctx?.state === 'suspended') this.ctx.resume(); }
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0) { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur); }
  noise(dur, vol = 0.2) { if (!this.ctx || this.muted) return; const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g).connect(this.ctx.destination); s.start(); }
  gunshot() { this.noise(0.12, 0.35); this.tone(140, 0.1, 'sawtooth', 0.2, -90); }
  thud() { this.tone(70, 0.18, 'sine', 0.35, -30); this.noise(0.08, 0.15); }
  chime() { this.tone(880, 0.12, 'sine', 0.15); setTimeout(() => this.tone(1320, 0.2, 'sine', 0.15), 90); }
  cash() { this.tone(660, 0.08, 'square', 0.1); setTimeout(() => this.tone(990, 0.14, 'square', 0.1), 70); }
  engine(speed) { if (!this.ctx || this.muted) return; this.tone(55 + Math.abs(speed) * 6, 0.09, 'sawtooth', 0.035); }
  startSiren() { if (!this.ctx || this.muted || this.sirenOsc) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; g.gain.value = 0.028; o.connect(g).connect(this.ctx.destination); o.start(); let hi = false; this.sirenOsc = { o, iv: setInterval(() => { hi = !hi; if (this.ctx) o.frequency.setValueAtTime(hi ? 960 : 640, this.ctx.currentTime); }, 420) }; }
  stopSiren() { if (this.sirenOsc) { clearInterval(this.sirenOsc.iv); try { this.sirenOsc.o.stop(); } catch {} this.sirenOsc = null; } }
  startMusic() { if (this.musicTimer || !this.ctx) return; const bass = [110, 110, 130.8, 98, 110, 110, 146.8, 164.8]; this.musicTimer = setInterval(() => { if (this.muted) return; const f = bass[this.note % bass.length]; this.tone(f, 0.32, 'triangle', 0.07); if (this.note % 2 === 0) this.tone(f * 2, 0.2, 'sine', 0.03); this.note++; }, 340); }
  toggleMute() { this.muted = !this.muted; if (this.muted) this.stopSiren(); return this.muted; }
}
