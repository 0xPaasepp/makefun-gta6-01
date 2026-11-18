// All audio is synthesized with WebAudio — no audio files, no network.
// Radio-style music is a tiny sequencer: bass + lead over a swung beat.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.master);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();
      this.startMusic();
      return true;
    } catch {
      return false;
    }
  }

  setEngine(speed01) {
    if (!this.ctx) return;
    this.engineOsc.frequency.value = 50 + speed01 * 130;
    this.engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0.0;
  }

  blip(freq = 880, dur = 0.08, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.4;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  alarm() {
    this.blip(1200, 0.15, 'sawtooth', 0.12);
    setTimeout(() => this.blip(900, 0.15, 'sawtooth', 0.12), 180);
  }

  // A minor-key loop: Am — F — C — G bass, plucky lead on top.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 87.31, 130.81, 98];
    const lead = [
      440, 0, 523.25, 659.25, 0, 523.25, 440, 0,
      349.23, 0, 440, 523.25, 0, 440, 392, 0,
    ];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const bar = Math.floor(this.step / 8) % 4;
      const s = this.step % 8;
      if (s === 0) this.note(bass[bar], 0.5, 'triangle', 0.16);
      const l = lead[this.step % 16];
      if (l) this.note(l, 0.18, 'square', 0.05);
      this.step++;
    }, 190);
  }

  note(freq, dur, type, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
