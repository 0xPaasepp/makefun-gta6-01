// All audio is synthesized with WebAudio — no audio files, no network.
// Three radio stations, each with a named DJ who idents the station when
// you switch to it (rebuild 12): OLA 104.5 with DJ Marea, NEON 88 with
// DJ Vela, PALM 92 with DJ Sol. Plus engine hum, siren, gunshot, car horn,
// paint-spray hiss, pickup blips and UI clicks. Everything is guarded:
// no gesture, no crash.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.station = 0;
    this.lastHornAt = 0; // rebuild 13: testable horn stamp (headless has no ears)
    this.stations = [
      { name: 'OLA 104.5', dj: 'DJ Marea', bpm: 108, root: 246.9, minor: true, wave: 'square', tag: 'Solmar\'s Latin heat — DJ Marea on the mic.',
        tracks: ['Café con Leche', 'Baila el Atardecer', 'Calle Luna Nights'] },
      { name: 'NEON 88', dj: 'DJ Vela', bpm: 122, root: 196, minor: false, wave: 'sawtooth', tag: 'Neon nights, synth all night — DJ Vela.',
        tracks: ['Neon Skyline', 'Midnight Drive', 'Sunset Overdrive'] },
      { name: 'PALM 92', dj: 'DJ Sol', bpm: 96, root: 220, minor: true, wave: 'triangle', tag: 'Slow sunset grooves with DJ Sol.',
        tracks: ['Golden Hour', 'Palms in the Wind', 'Low Tide Love'] },
    ];
    this._track = 0;
    this._step = 0; this._nextTime = 0; this._engineOsc = null; this._engineGain = null;
    this._sirenOsc = null; this._sirenGain = null; this._sirenPhase = 0;
    this._radioTimer = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._nextTime = this.ctx.currentTime + 0.1;
      this._radioTimer = setInterval(() => this._scheduleRadio(), 120);
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  cycleStation() {
    this.station = (this.station + 1) % this.stations.length;
    this._track = (this._track + 1) % this.stations[this.station].tracks.length;
    this._identJingle();
    return this.stations[this.station];
  }
  stationName() { return this.stations[this.station].name; }
  stationDj() { return this.stations[this.station].dj; }
  stationTag() { return this.stations[this.station].tag; }
  // Rebuild 13: the track currently playing on this station — the HUD
  // shows it, so the radio reads as a real station, not a label.
  stationTrack() { return this.stations[this.station].tracks[this._track]; }
  // DJ ident: a bright three-note station jingle when you switch.
  _identJingle() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1318].forEach((f, i) => this._blip(f, t + i * 0.09, 0.16, 'sine', 0.12));
  }
  _scheduleRadio() {
    if (!this.ctx || this.muted) return;
    const st = this.stations[this.station];
    const stepDur = 60 / st.bpm / 2;
    while (this._nextTime < this.ctx.currentTime + 0.35) {
      const s = this._step % 16;
      const chordRoots = st.minor ? [0, 0.891, 0.794, 1.122] : [0, 1.122, 1.335, 1.498];
      const chord = chordRoots[Math.floor(s / 4) % 4];
      const notes = [1, 1.189, 1.498];
      if (s % 2 === 0) {
        const f = st.root * chord * notes[(s / 2) % 3 | 0];
        this._blip(f, this._nextTime, stepDur * 1.8, st.wave, 0.05);
      }
      if (s % 4 === 0) this._blip(st.root * chord * 0.5, this._nextTime, stepDur * 3.5, 'sine', 0.07);
      if (s === 4 || s === 12) this._noise(this._nextTime, 0.05, 0.04);
      this._step++; this._nextTime += stepDur;
    }
  }
  _blip(freq, when, dur, wave, vol) {
    try {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = wave; o.frequency.value = freq;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  _noise(when, dur, vol) {
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(when);
    } catch (e) { /* ignore */ }
  }
  gunshot() {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.14, 0.35);
    this._blip(90, this.ctx.currentTime, 0.1, 'square', 0.18);
  }
  // Two-tone car horn (H).
  horn() {
    this.lastHornAt = Date.now();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(370, t, 0.22, 'square', 0.14);
    this._blip(466, t, 0.22, 'square', 0.12);
  }
  // Paint-shop spray hiss (C at the garage).
  spray() {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.5, 0.12);
    this._blip(1400, this.ctx.currentTime, 0.3, 'sine', 0.04);
  }
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(660, t, 0.09, 'sine', 0.16);
    this._blip(990, t + 0.08, 0.14, 'sine', 0.16);
  }
  shellChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1047, 1319, 1568].forEach((f, i) => this._blip(f, t + i * 0.07, 0.18, 'sine', 0.12));
  }
  missionDone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this._blip(f, t + i * 0.11, 0.22, 'triangle', 0.16));
  }
  click() { if (this.ctx) this._blip(880, this.ctx.currentTime, 0.06, 'sine', 0.1); }
  alarm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) { this._blip(1200, t + i * 0.22, 0.09, 'square', 0.08); this._blip(900, t + i * 0.22 + 0.11, 0.09, 'square', 0.08); }
  }
  setEngine(on, speedNorm) {
    if (!this.ctx) return;
    try {
      if (on && !this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineGain = this.ctx.createGain();
        this._engineOsc.type = 'sawtooth';
        this._engineGain.gain.value = 0.02;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        this._engineOsc.connect(f); f.connect(this._engineGain); this._engineGain.connect(this.master);
        this._engineOsc.start();
      } else if (!on && this._engineOsc) {
        this._engineOsc.stop(); this._engineOsc = null; this._engineGain = null;
      }
      if (this._engineOsc) {
        this._engineOsc.frequency.value = 55 + speedNorm * 140;
        this._engineGain.gain.value = 0.015 + speedNorm * 0.03;
      }
    } catch (e) { /* ignore */ }
  }
  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this._sirenOsc) {
        this._sirenOsc = this.ctx.createOscillator();
        this._sirenGain = this.ctx.createGain();
        this._sirenOsc.type = 'sine'; this._sirenOsc.frequency.value = 750;
        this._sirenGain.gain.value = 0.035;
        this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.master);
        this._sirenOsc.start();
        this._sirenPhase = 0;
      } else if (!on && this._sirenOsc) {
        this._sirenOsc.stop(); this._sirenOsc = null; this._sirenGain = null;
      }
      if (this._sirenOsc) {
        this._sirenPhase += 0.06;
        this._sirenOsc.frequency.value = 700 + Math.sin(this._sirenPhase) * 220;
      }
    } catch (e) { /* ignore */ }
  }
}
