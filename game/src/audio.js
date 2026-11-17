// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
// Engine hum, siren, gunshot, pickup chime, mission sting and a lazy sun-soaked
// bassline loop. Everything is created lazily on first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  gunshot() { this.noise(0.18, 0.5, 2600); this.tone(140, 0.12, 'square', 0.18, 50); }
  pickup() { this.tone(880, 0.1, 'sine', 0.22); setTimeout(() => this.tone(1318, 0.16, 'sine', 0.22), 90); }
  cash() { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.2), i * 80)); }
  sting() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.2), i * 110)); }
  fail() { this.tone(220, 0.4, 'sawtooth', 0.16, 110); }
  horn() { this.tone(370, 0.25, 'square', 0.12); this.tone(466, 0.25, 'square', 0.1); }
  door() { this.noise(0.08, 0.2, 800); }

  setEngine(rpm01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = rpm01 > 0.02 ? 0.05 + rpm01 * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + rpm01 * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 950;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
    }
  }

  // A slow, warm bassline + soft pad chords. Very light: one note per step.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0];
    const chords = [220, 261.6, 329.6];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const step = this.musicStep++ % 16;
      const b = bass[step];
      if (b) this.tone(b, 0.42, 'triangle', 0.10);
      if (step % 4 === 0) {
        const root = chords[(this.musicStep >> 4) % 3];
        this.tone(root, 1.6, 'sine', 0.045);
        this.tone(root * 1.5, 1.6, 'sine', 0.03);
      }
    }, 300);
  }

  toggleMusic() { this.musicOn = !this.musicOn; return this.musicOn; }
}
