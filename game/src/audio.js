// SOLMAR · audio.js — all sound is WebAudio-synthesized: radio music (chord
// sequencer), engine hum, sirens, gunshots. No audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.radioOn = true;
    this.step = 0; this.nextTime = 0; this.timer = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    // Chord progression (frequencies, Hz). Sequencer indexes with modulo so
    // no step can ever read past the end of a chord.
    this.chords = [
      [130.81, 164.81, 196.00, 246.94], // Cmaj7
      [110.00, 130.81, 164.81, 196.00], // Am7
      [87.31, 110.00, 130.81, 164.81],  // Fmaj7
      [98.00, 123.47, 146.83, 196.00],  // G7
    ];
    this.bassNotes = [65.41, 55.00, 43.65, 49.00];
    this.melody = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 90);
      return true;
    } catch (e) { this.ctx = null; return false; }
  }
  schedule() {
    if (!this.ctx || !this.radioOn) return;
    const spb = 60 / 112 / 2; // 112 BPM eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % this.chords.length;
      const chord = this.chords[bar];
      const idx = this.step % chord.length; // modulo: never out of range
      const t = this.nextTime;
      // pad note (soft triangle) — one chord tone per step, cycling the chord
      this.tone(chord[idx] * 2, t, spb * 1.8, 'triangle', 0.05);
      // bass on the bar
      if (this.step % 8 === 0) this.tone(this.bassNotes[bar], t, spb * 6, 'sine', 0.11);
      // sparkle melody every other step
      if (this.step % 2 === 0) {
        const m = this.melody[(this.step * 3 + bar) % this.melody.length];
        this.tone(m, t, spb * 0.9, 'square', 0.018);
      }
      // hat tick
      if (this.step % 2 === 1) this.noise(t, 0.03, 0.02);
      this.step++;
      this.nextTime += spb;
    }
  }
  tone(freq, t, dur, type, vol) {
    if (!this.ctx || !isFinite(freq) || freq <= 0) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, vol) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start(t);
  }
  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const f = 50 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, this.ctx.currentTime, 0.1);
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.03;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 780;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenGain = null;
    }
  }
  gunshot() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.16, 0.22);
    this.tone(90, this.ctx.currentTime, 0.12, 'sine', 0.2);
  }
  blip(freq = 660) { if (this.ctx) this.tone(freq, this.ctx.currentTime, 0.09, 'sine', 0.08); }
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(523.25, t, 0.3, 'sine', 0.1);
    this.tone(783.99, t + 0.12, 0.35, 'sine', 0.1);
    this.tone(1046.5, t + 0.24, 0.4, 'sine', 0.09);
  }
}
