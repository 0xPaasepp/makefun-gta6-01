// SOLMAR audio — all WebAudio-synthesized: engine/gear/tires, collision,
// gunshots, and SOL FM procedural radio. No external audio files.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.radioOn = true; this.radioT = 0; this.radioStep = 0;
    this.noiseBuf = null;
    this._started = false;
  }
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // engine: sawtooth through lowpass, pitch follows speed/gear
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
        this.engineOsc.start();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._started = true;
    } catch (e) { /* audio is best-effort */ }
  }
  engine(speed, inCar, gear) {
    if (!this._started || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const rpm = inCar ? 55 + (Math.abs(speed) % 9) * 14 + gear * 6 : 0;
    this.engineOsc.frequency.setTargetAtTime(inCar ? rpm : 40, t, 0.08);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.abs(speed) * 0.0012 : 0.0, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 28, t, 0.1);
  }
  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this._started) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g).connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }
  noise(dur, vol, freq = 800) {
    if (!this._started) return;
    try {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      s.connect(f).connect(g).connect(this.master);
      s.start(); s.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }
  shoot() { this.noise(0.14, 0.5, 2400); this.blip(180, 0.1, 'square', 0.25); }
  hit() { this.blip(90, 0.15, 'square', 0.2); }
  collide(hard) { this.noise(hard ? 0.3 : 0.12, hard ? 0.5 : 0.2, 500); }
  pickup() { this.blip(660, 0.12); setTimeout(() => this.blip(990, 0.16), 110); }
  // SOL FM: lazy chord-pad loop, Am–F–C–G, soft triangle pads + bass.
  radio(dt) {
    if (!this._started || !this.radioOn) return;
    this.radioT += dt;
    if (this.radioT < 0.5) return;
    this.radioT = 0;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    const ch = chords[this.radioStep % 4];
    this.radioStep++;
    for (const f of ch) this.blip(f, 0.9, 'triangle', 0.045);
    this.blip(ch[0] / 2, 0.9, 'sine', 0.07);
  }
}
