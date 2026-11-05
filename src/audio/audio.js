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
    this.bees = loop('bandpass', 230, 6);
    this.surf = loop('lowpass', 600, 0.6);      // the sea: a breathing roar
    this.cicada = loop('bandpass', 4600, 9);   // tropical insects by day
    this.timers = { wood: 20, cuckoo: 30, crow: 15, buzz: 40, frog: 4, wave: 3, gull: 6, wren: 12, coyote: 30, parrot: 8, treefrog: 2 };
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
    this.bees.g.gain.setTargetAtTime(s.bees ? 0.05 : 0, t, 0.3);
    // the sea: surf breathes with the swell; bigger seas are louder and lower
    const sea = s.sea || 0, wv = s.waves || 0.5;
    this.surfPhase = (this.surfPhase || 0) + dt * (0.55 + wv * 0.1);
    const breathe = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(this.surfPhase), 2);
    this.surf.g.gain.setTargetAtTime(sea * (0.05 + wv * 0.09) * breathe, t, 0.3);
    this.surf.f.frequency.setTargetAtTime(380 + 500 * breathe - wv * 80, t, 0.3);
    this.cicada.g.gain.setTargetAtTime(s.region === 'tropics' && s.day > 0.4 && s.rain < 0.5 ? 0.012 * (0.7 + 0.3 * Math.sin(t * 0.8)) : s.region === 'canyon' && s.day > 0.6 ? 0.004 : 0, t, 0.8);
    const T = this.timers; for (const key of Object.keys(T)) T[key] -= dt;
    if (T.wave < 0) { T.wave = 6 / (0.55 + wv * 0.1) * (0.6 + Math.random() * 0.8); if (sea > 0.25) this.waveCrash(sea * (0.6 + wv * 0.5)); }
    if (T.gull < 0) { T.gull = 5 + Math.random() * 12; if (sea > 0.1 && s.day > 0.25) this.call('gull', null, 0.5 + sea * 0.5); }
    if (T.wren < 0) { T.wren = 25 + Math.random() * 40; if (s.region === 'canyon' && s.day > 0.4) this.canyonWren(); }
    if (T.coyote < 0) { T.coyote = 50 + Math.random() * 80; if (s.region === 'canyon' && s.day < 0.25) this.coyote(); }
    if (T.parrot < 0) { T.parrot = 6 + Math.random() * 14; if (s.region === 'tropics' && s.day > 0.3) this.call('parrot', null, 0.5); }
    if (T.treefrog < 0) { T.treefrog = 0.3 + Math.random() * 1.2; if (s.region === 'tropics' && s.day < 0.35) this.treeFrog(); }
    const temperate = !s.region || s.region === 'temperate' || s.region === 'coast';
    if (T.wood < 0) { T.wood = 25 + Math.random() * 40; if (s.forest > 0.45 && s.day > 0.3) this.woodpecker(); }
    if (T.cuckoo < 0) { T.cuckoo = 40 + Math.random() * 80; if (s.day > 0.5 && s.rain < 0.3 && !s.home && temperate) this.cuckoo(); }
    if (T.crow < 0) { T.crow = 20 + Math.random() * 40; if (s.day > 0.3) this.crow(); }
    if (T.buzz < 0) { T.buzz = 45 + Math.random() * 60; if (s.day > 0.5 && s.forest < 0.6 && !s.home) this.buzzard(); }
    if (T.frog < 0) { T.frog = 1.5 + Math.random() * 5; if (s.water > 0.2 && (s.day < 0.6 || s.rain > 0.3)) this.frog(); }
    // birds by day, crickets & owls by night
    this.nextBird -= dt; this.nextCricket -= dt; this.nextOwl -= dt;
    if (this.nextBird < 0) { this.nextBird = 1.5 + Math.random() * 5 / (0.3 + s.forest); if (s.day > 0.3 && s.rain < 0.5 && (temperate || s.forest > 0.3)) this.bird(); }
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

  // ---------------------------------------------------------------- positional helpers
  spatial(pos) {
    const L = this.listener; if (!pos || !L) return { pan: Math.random() * 1.4 - 0.7, gain: 0.7 };
    const dx = pos.x - L.pos.x, dz = pos.z - L.pos.z, d = Math.hypot(dx, dz) || 1;
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    return { pan: Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)), gain: 1 / (1 + d / 10) };
  }
  out(pos, vol = 1) { const sp = this.spatial(pos); const g = this.ctx.createGain(); g.gain.value = vol * sp.gain; this.pan(g, sp.pan); return g; }
  note(dest, t, f0, f1, dur, vol, type = 'sine') {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, Math.min(0.02, dur / 4), vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noiseBurst(dest, t, freq, q, dur, vol, type = 'bandpass') {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, 0.004, vol, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- sea, storms and the voices of other lands
  waveCrash(vol = 1) {
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.6;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(380, t + 2.6);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    s.connect(f); f.connect(g); this.pan(g, Math.random() * 0.8 - 0.4); s.start(t, Math.random()); s.stop(t + 3.4);
  }
  thunder(dist = 1000) {
    if (!this.ready) return;
    const delay = Math.min(7, dist / 343), t = this.ctx.currentTime + delay, near = Math.max(0.15, 1 - dist / 3000);
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.35;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160 + near * 500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * near, t + 0.08 + (1 - near) * 0.6);
    for (let i = 1; i < 6; i++) g.gain.exponentialRampToValueAtTime(0.25 * near * (1 - i / 7) + 0.01, t + 0.4 + i * 0.55 + Math.random() * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    s.connect(f); f.connect(g); this.pan(g, Math.random() * 1.2 - 0.6); s.start(t, Math.random()); s.stop(t + 6);
  }
  call(kind, pos, vol = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol * (pos ? 3 : 0.7));
    if (kind === 'gull') { const n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) { const tt = t + i * 0.32; this.note(o, tt, 1500, 2300, 0.08, 0.03, 'sawtooth'); this.note(o, tt + 0.08, 2300, 1200, 0.18, 0.03, 'sawtooth'); } }
    else if (kind === 'goose') { for (let i = 0; i < 6; i++) { const tt = t + i * 0.28 + Math.random() * 0.1; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; f.connect(o); this.note(f, tt, 520, 430, 0.14, 0.25, 'sawtooth'); } }
    else if (kind === 'raven') { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2.5; f.connect(o); for (let i = 0; i < 2; i++) this.note(f, t + i * 0.5, 360, 300, 0.22, 0.3, 'sawtooth'); }
    else if (kind === 'parrot') { for (let i = 0; i < 3; i++) { const tt = t + i * 0.2; this.note(o, tt, 1800 + Math.random() * 600, 2600, 0.1, 0.035, 'square'); this.noiseBurst(o, tt, 3000, 2, 0.1, 0.03); } }
    else if (kind === 'flamingo') { for (let i = 0; i < 8; i++) { const tt = t + i * 0.18 + Math.random() * 0.1; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3; f.connect(o); this.note(f, tt, 700, 620, 0.12, 0.2, 'sawtooth'); } }
    else if (kind === 'stork') { for (let i = 0; i < 18; i++) this.noiseBurst(o, t + i * 0.06, 1500, 3, 0.03, 0.12); }
    else if (kind === 'horse') { // a whinny, then hooves
      this.note(o, t, 900, 1300, 0.25, 0.04, 'sawtooth'); for (let i = 0; i < 7; i++) this.note(o, t + 0.25 + i * 0.1, 1100 - i * 90, 1000 - i * 90, 0.09, 0.035, 'sawtooth');
      for (let i = 0; i < 20; i++) this.noiseBurst(o, t + 0.9 + i * 0.11 + (i % 3) * 0.03, 220, 1, 0.05, 0.2, 'lowpass');
    }
  }
  canyonWren() { const t = this.ctx.currentTime, o = this.out(null, 0.5); for (let i = 0; i < 11; i++) { const f = 4200 * Math.pow(0.9, i); this.note(o, t + i * 0.12, f * 1.05, f, 0.09, 0.035); } }
  coyote() { const t = this.ctx.currentTime, o = this.out(null, 0.45); this.note(o, t, 500, 900, 0.5, 0.03); this.note(o, t + 0.55, 900, 600, 0.9, 0.03); for (let i = 0; i < 5; i++) this.note(o, t + 1.6 + i * 0.13, 1200, 800, 0.1, 0.02, 'triangle'); }
  treeFrog() { const t = this.ctx.currentTime, o = this.out(null, 0.5), f0 = 1800 + Math.random() * 1600; for (let i = 0; i < 2; i++) this.note(o, t + i * 0.09, f0, f0 * 1.2, 0.05, 0.03, 'square'); }

  // ---------------------------------------------------------------- birdsong (one voice per species)
  song(call, pos) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1);
    if (call === 'robin') { let tt = t; for (let i = 0; i < 9; i++) { const f = 3000 + Math.random() * 3500; const d = 0.05 + Math.random() * 0.1; this.note(o, tt, f, f * (Math.random() < 0.5 ? 0.7 : 1.3), d, 0.03); tt += d + Math.random() * 0.05; } }
    else if (call === 'blackbird') { let tt = t; for (let i = 0; i < 6; i++) { const f = 1500 + Math.random() * 1400; const d = 0.12 + Math.random() * 0.18; this.note(o, tt, f, f * (1 + (Math.random() - 0.5) * 0.3), d, 0.04); tt += d + 0.03; } this.note(o, tt, 5000, 3800, 0.2, 0.012); }
    else if (call === 'chaffinch') { let tt = t, gap = 0.11; for (let i = 0; i < 12; i++) { const f = 4600 - i * 140; this.note(o, tt, f, f * 0.85, 0.05, 0.03); tt += gap; gap *= 0.9; } this.note(o, tt + 0.05, 3000, 4400, 0.18, 0.035); }
    else if (call === 'tit') { for (let i = 0; i < 3; i++) { this.note(o, t + i * 0.36, 5200, 5000, 0.1, 0.035); this.note(o, t + i * 0.36 + 0.15, 3600, 3500, 0.12, 0.035); } }
    else this.bird();
  }
  alarm(call, pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 4; i++) this.note(o, t + i * 0.07, call === 'blackbird' ? 2400 : 5200, call === 'blackbird' ? 2200 : 4800, 0.03, 0.04, 'triangle'); }
  flush(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 8; i++) this.noiseBurst(o, t + i * 0.045, 900, 0.8, 0.03, 0.09); }
  quack(pos, loud) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, loud ? 1.6 : 1); const n = loud ? 4 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3; f.connect(o); this.note(f, t + i * 0.2, 260 - i * 15, 220, 0.14, 0.5 / (1 + i * 0.3), 'sawtooth'); } }
  chatter(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 14; i++) this.noiseBurst(o, t + i * 0.04, 4200, 6, 0.02, 0.06); }
  rustle(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); this.noiseBurst(o, t, 1800, 0.6, 0.35, 0.08); }
  plopAt(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.8); this.note(o, t, 500, 180, 0.08, 0.05); this.noiseBurst(o, t, 900, 1.5, 0.1, 0.04); }
  woodpecker() { const t = this.ctx.currentTime, o = this.out(null, 0.6); for (let i = 0; i < 16; i++) this.noiseBurst(o, t + i * 0.055, 1300, 4, 0.025, 0.12 * (1 - i / 20)); }
  cuckoo() { const t = this.ctx.currentTime, o = this.out(null, 0.6); for (let k = 0; k < 2; k++) { this.note(o, t + k * 0.9, 760, 740, 0.25, 0.04); this.note(o, t + k * 0.9 + 0.3, 610, 590, 0.35, 0.04); } }
  crow() { const t = this.ctx.currentTime, o = this.out(null, 0.5); for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2; f.connect(o); this.note(f, t + i * 0.45, 640, 560, 0.3, 0.3, 'sawtooth'); } }
  buzzard() { const t = this.ctx.currentTime, o = this.out(null, 0.5); this.note(o, t, 1900, 1150, 1.1, 0.035); this.noiseBurst(o, t, 1600, 2, 1.0, 0.01); }
  frog() { const t = this.ctx.currentTime, o = this.out(null, 0.7); const base = 140 + Math.random() * 120; for (let i = 0; i < 6 + Math.floor(Math.random() * 6); i++) this.note(o, t + i * 0.045, base * 1.3, base, 0.03, 0.08, 'square'); }

  // ---------------------------------------------------------------- the body & camp
  retch() { if (!this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(this.master, t, 400, 0.7, 0.5, 0.15, 'lowpass'); this.note(this.master, t + 0.05, 140, 90, 0.5, 0.05, 'sawtooth'); }
  eat() { if (!this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 4; i++) this.noiseBurst(this.master, t + i * 0.16, 2500, 1.2, 0.06, 0.05); }
  cook() { if (!this.ready) return; const t = this.ctx.currentTime; this.noiseBurst(this.master, t, 5200, 0.6, 1.6, 0.06, 'highpass'); }
  dig() { if (!this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.noiseBurst(this.master, t + i * 0.3, 300, 0.8, 0.12, 0.12, 'lowpass'); }
  tripStart() {
    if (!this.ready || this.drone) return; const ctx = this.ctx, g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.connect(g);
    const oscs = [110, 113.5, 165.2].map((fr) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 400; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 4);
    this.drone = { g, oscs: [...oscs, lfo] };
  }
  tripEnd() { if (!this.drone) return; const d = this.drone; this.drone = null; d.g.gain.setTargetAtTime(0, this.ctx.currentTime, 3); setTimeout(() => d.oscs.forEach((o) => o.stop()), 9000); }
  reel() { this.burst(3200, 4, 0.03, 0.03); }
  craft() { this.burst(2600, 2, 0.07, 0.07); setTimeout(() => this.burst(2200, 2, 0.07, 0.06), 120); setTimeout(() => this.tone([523, 659, 784], 0.08, 0.04), 280); }
}
