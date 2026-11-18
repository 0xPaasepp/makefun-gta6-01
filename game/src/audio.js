// SOLMAR — audio. Everything synthesized with WebAudio: engine hum,
// three radio stations (sequenced bass + lead), two-tone siren, gunshot
// noise bursts, pickup chimes, wave ambience. No audio files, no network.

import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0;
    this.radioOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._step = 0;
    this._nextNote = 0;
    this._noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren: two alternating tones
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      // noise buffer for gunshots
      const len = this.ctx.sampleRate * 0.25;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this._nextNote = this.ctx.currentTime + 0.1;
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEngine(speedKmh, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedKmh / 900 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.6, t, 0.08);
  }

  setSiren(wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (wanted > 0) {
      this.sirenGain.gain.setTargetAtTime(0.045, t, 0.2);
      const f = 660 + (Math.floor(t * 2.2) % 2) * 220;
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0, t, 0.2);
    }
  }

  /** Radio sequencer tick — call every frame; schedules bass+lead notes. */
  tickRadio() {
    if (!this.ctx || !this.radioOn) return;
    const st = CONFIG.radioStations[this.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this._nextNote < this.ctx.currentTime + 0.25) {
      const step = this._step % 32;
      const scale = [1, 1.189, 1.335, 1.498, 1.782];
      const bassNote = st.root * [1, 1, 0.891, 1.335][Math.floor(step / 8) % 4];
      if (step % 2 === 0) this._note(bassNote / 2, this._nextNote, spb * 1.8, 'triangle', 0.16);
      if (step % 4 === 2) {
        const lead = st.root * 2 * scale[(step * 3 + 1) % 5];
        this._note(lead, this._nextNote, spb * 0.9, 'square', 0.05);
      }
      if (step % 8 === 4) this._hat(this._nextNote);
      this._step++;
      this._nextNote += spb;
    }
  }

  _note(freq, when, dur, type, vol) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.02);
  }

  _hat(when) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    s.connect(hp); hp.connect(g); g.connect(this.master);
    s.start(when); s.stop(when + 0.06);
  }

  playShot(distant = false) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    g.gain.value = distant ? 0.12 : 0.5;
    s.connect(g); g.connect(this.master);
    s.start();
  }

  playChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(880, t, 0.18, 'sine', 0.22);
    this._note(1318, t + 0.09, 0.25, 'sine', 0.22);
  }

  playBust() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._note(220, t, 0.3, 'sawtooth', 0.15);
    this._note(165, t + 0.15, 0.4, 'sawtooth', 0.15);
  }

  nextStation() {
    this.station = (this.station + 1) % CONFIG.radioStations.length;
    return CONFIG.radioStations[this.station].name;
  }

  get stationName() { return CONFIG.radioStations[this.station].name; }
}
