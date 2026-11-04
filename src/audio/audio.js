// Procedural soundscape with the Web Audio API — everything is synthesized, no audio files.
export class SoundScape {
  constructor() { this.ctx = null; this.ready = false; this.vol = 0.8; this.nextBird = 2; this.nextCricket = 0; this.nextOwl = 20; }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    this.noise = buf;
    const loop = (filterType, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { f, g };
    };
    this.wind = loop('lowpass', 420, 0.7);
    this.water = loop('bandpass', 1100, 0.5);
    this.rain = loop('highpass', 2400, 0.4);
    this.leaves = loop('bandpass', 3800, 0.9);
    this.ready = true;
    const resume = () => ctx.resume?.();
    window.addEventListener('touchend', resume, { passive: true }); window.addEventListener('click', resume);
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  update(dt, s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, k = 0.25;
    const w = s.wind;
    this.wind.g.gain.setTargetAtTime(0.06 + w * 0.08, t, k);
    this.wind.f.frequency.setTargetAtTime(300 + w * 260 + Math.sin(t * 0.3) * 120, t, 0.8);
    this.leaves.g.gain.setTargetAtTime(s.forest * w * 0.035, t, k);
    this.water.g.gain.setTargetAtTime(Math.min(0.2, s.water * 0.2), t, k);
    this.rain.g.gain.setTargetAtTime(s.rain * 0.12, t, k);
    // birds by day, crickets & owls by night
    this.nextBird -= dt; this.nextCricket -= dt; this.nextOwl -= dt;
    if (this.nextBird < 0) { this.nextBird = 1.5 + Math.random() * 5 / (0.3 + s.forest); if (s.day > 0.3 && s.rain < 0.5) this.bird(); }
    if (this.nextCricket < 0) { this.nextCricket = 0.4 + Math.random() * 0.8; if (s.day < 0.25) this.cricket(); }
    if (this.nextOwl < 0) { this.nextOwl = 18 + Math.random() * 30; if (s.day < 0.2 && s.forest > 0.2) this.owl(); }
  }

  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  pan(node, p) { if (this.ctx.createStereoPanner) { const sp = this.ctx.createStereoPanner(); sp.pan.value = p; node.connect(sp); sp.connect(this.master); return sp; } node.connect(this.master); return node; }

  bird() {
    const ctx = this.ctx, t0 = ctx.currentTime, type = Math.floor(Math.random() * 4);
    const notes = 2 + Math.floor(Math.random() * 5), base = 2400 + Math.random() * 2200, p = Math.random() * 1.6 - 0.8, vol = 0.02 + Math.random() * 0.03;
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (type === 0 ? 0.09 : 0.16) + Math.random() * 0.02;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      const f = base * (type === 1 ? 1 + i * 0.06 : type === 2 ? 1 - i * 0.05 : 1 + (i % 2) * 0.18);
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (type === 3 ? 0.7 : 1.25), t + 0.07);
      this.env(g, t, 0.01, vol, 0.09); o.connect(g); this.pan(g, p); o.start(t); o.stop(t + 0.12);
    }
  }
  cricket() {
    const ctx = this.ctx, t0 = ctx.currentTime, p = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.05, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 4300 + Math.random() * 300;
      this.env(g, t, 0.004, 0.008, 0.035); o.connect(g); this.pan(g, p); o.start(t); o.stop(t + 0.05);
    }
  }
  owl() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    [[0, 0.35], [0.55, 0.25], [0.85, 0.6]].forEach(([dt, d]) => {
      const t = t0 + dt, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(390, t); o.frequency.linearRampToValueAtTime(360, t + d);
      this.env(g, t, 0.05, 0.04, d); o.connect(g); this.pan(g, -0.6); o.start(t); o.stop(t + d + 0.05);
    });
  }
  burst(freq, q, dur, vol, type = 'bandpass', rate = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); this.env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return f;
  }
  step(intensity, surface) {
    if (surface === 'water') { this.burst(900, 0.8, 0.22, 0.1 * intensity); return; }
    if (surface === 'stone') { this.burst(2400, 1.2, 0.06, 0.06 * intensity); return; }
    this.burst(surface === 'forest' ? 700 : 1100, 0.9, 0.09, 0.07 * intensity, 'bandpass', 0.8 + Math.random() * 0.4);
  }
  tone(freqs, gap = 0.09, vol = 0.05, type = 'sine') {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    freqs.forEach((f, i) => { const t = t0 + i * gap, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; this.env(g, t, 0.01, vol, 0.5); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.6); });
  }
  pickup() { this.tone([660, 990], 0.07, 0.04); this.burst(1800, 1, 0.08, 0.03); }
  discover() { this.tone([392, 494, 587, 784], 0.14, 0.05, 'triangle'); }
  splash(big = 1) { const f = this.burst(1400, 0.6, 0.35 * big, 0.14 * big); f && f.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.3); }
  plop() { this.tone([220, 160], 0.05, 0.06); this.burst(700, 1.5, 0.12, 0.07); }
  click() { this.tone([880], 0.0, 0.02, 'triangle'); }
  reel() { this.burst(3200, 4, 0.03, 0.03); }
  craft() { this.burst(2600, 2, 0.07, 0.07); setTimeout(() => this.burst(2200, 2, 0.07, 0.06), 120); setTimeout(() => this.tone([523, 659, 784], 0.08, 0.04), 280); }
}
