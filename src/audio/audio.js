// The soundscape.
//
// Real field recordings (Wikimedia Commons and other open-licence sources, see CREDITS) are
// placed in the world with Web Audio's 3D panner (HRTF), so every sound comes from somewhere:
//   · crickets sit in the grass — you walk past them, they fall quiet when you get close and
//     fade away behind you; birds sing from perches in the trees, a few songs then a pause,
//     each with its own voice, more at dawn and dusk; the river is where the river is;
//   · each land has its own repertoire — loons on the lakes, curlews and oystercatchers at the
//     shore, the canyon wren's falling song, howler monkeys at a jungle dawn;
//   · background beds (wind, rain, surf, a far-off forest, the night's insect chorus) never loop
//     audibly: each is played from a fresh random point and crossfaded every 15–35 s;
//   · a slowly wandering "activity" level gives the wild its lulls and its busy moments.
// Anything without a recording falls back to the synthesised voices (everything here worked
// without audio files before, and still does if they fail to load).

const BASE = 'assets/audio/';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// how each kind of sound carries: reference distance (m) at which it plays at full volume, and a base gain
const VOICE = {
  insect: { ref: 2.2, gain: 0.32 }, songbird: { ref: 9, gain: 0.5 }, bigbird: { ref: 30, gain: 0.55 }, loud: { ref: 45, gain: 0.7 },
  mammal: { ref: 20, gain: 0.7 }, small: { ref: 4, gain: 0.5 }, near: { ref: 3, gain: 0.7 }, water: { ref: 6, gain: 0.6 }, element: { ref: 60, gain: 0.8 },
};
// game sound names → recording ids (first one that exists wins)
const CALLS = {
  gull: ['herring_gull'], goose: ['goose'], raven: ['raven', 'crow'], parrot: ['macaw', 'parrot'], rattle: ['rattlesnake'],
  bear_huff: ['bear_huff', 'bear_growl'], bear_roar: ['bear_growl', 'bear_huff'], deer: ['deer_bark', 'red_deer_roar'], whale: ['whale_blow', 'humpback_whale'],
  horse: ['horse'], elk: ['elk_bugle'], wolf: ['wolf_howl'], coyote: ['coyote'], cougar: ['mountain_lion'], cougar_hiss: ['mountain_lion'], moose: ['moose'],
  boar: ['wild_boar'], otter: ['otter'], seal: ['seal', 'sea_lion', 'fur_seal'], dolphin: ['dolphin'], stork: [], flamingo: [], hiss: [], bite: [],
};
const CALL_VOICE = { gull: 'bigbird', goose: 'bigbird', raven: 'bigbird', parrot: 'bigbird', rattle: 'small', bear_huff: 'mammal', bear_roar: 'loud', deer: 'mammal', whale: 'loud', horse: 'mammal', elk: 'loud', wolf: 'loud', coyote: 'loud', cougar: 'loud', cougar_hiss: 'mammal', moose: 'mammal', boar: 'mammal', otter: 'small', seal: 'mammal', dolphin: 'mammal' };
const SONGS = { robin: 'robin', blackbird: 'blackbird', chaffinch: 'chaffinch', tit: 'great_tit', wren: 'wren', thrush: 'song_thrush' };

// which birds sing where (weights), and the occasional voices of each land
const SINGERS = {
  temperate: { forest: [['robin', 3], ['blackbird', 3], ['song_thrush', 2], ['chaffinch', 3], ['great_tit', 2], ['wren', 2]], open: [['skylark', 3], ['chaffinch', 1], ['robin', 1]] },
  coast: { forest: [['robin', 1], ['wren', 2], ['chaffinch', 1]], open: [['skylark', 3], ['oystercatcher', 1]] },
  canyon: { forest: [['canyon_wren', 3]], open: [['canyon_wren', 2]] },
  tropics: { forest: [['macaw', 1], ['toucan', 2], ['parrot', 1]], open: [['parrot', 1]] },
};
// [id, voice, when(ctx) → weight, mean seconds between]
const EVENTS = [
  ['woodpecker_drum', 'bigbird', (c) => c.temperate * c.forest * c.dayW, 45],
  ['cuckoo', 'bigbird', (c) => c.temperate * c.dayW * (c.home ? 0.4 : 1) * (1 - c.rain), 70],
  ['wood_pigeon', 'songbird', (c) => c.temperate * c.forest * c.dayW, 50],
  ['tawny_owl', 'bigbird', (c) => (c.temperate + c.coast * 0.5) * c.forest * c.nightW, 40],
  ['crow', 'bigbird', (c) => (c.temperate + c.coast) * c.dayW, 45],
  ['raven', 'bigbird', (c) => (c.highland + c.canyon + 0.3 * c.temperate) * c.dayW, 55],
  ['buzzard', 'bigbird', (c) => c.temperate * c.dayW * (1 - c.forest) * (1 - c.rain), 70],
  ['golden_eagle', 'bigbird', (c) => c.highland * c.dayW, 90], ['red_tailed_hawk', 'bigbird', (c) => c.canyon * c.dayW, 70],
  ['curlew', 'bigbird', (c) => (c.coast + c.heath) * (c.dayW + c.duskW), 50],
  ['oystercatcher', 'bigbird', (c) => c.coast * c.sea * c.dayW, 40],
  ['herring_gull', 'bigbird', (c) => c.coast * c.sea * c.dayW, 22],
  ['common_loon', 'loud', (c) => c.lake * (c.nightW + c.duskW * 1.5 + c.dayW * 0.25), 35],
  ['heron', 'bigbird', (c) => c.water * c.temperate * (c.dayW + c.duskW), 90],
  ['goose', 'bigbird', (c) => (c.lake + c.water) * c.temperate * c.dayW, 80],
  ['mallard', 'songbird', (c) => c.water * c.temperate * c.dayW, 50],
  ['canyon_wren', 'songbird', (c) => c.canyon * c.dayW, 30],
  ['coyote', 'loud', (c) => c.canyon * (c.nightW + c.duskW), 70],
  ['howler_monkey', 'loud', (c) => c.tropics * (c.duskW * 2 + c.dayW * 0.25), 60],
  ['macaw', 'bigbird', (c) => c.tropics * c.dayW, 25], ['toucan', 'bigbird', (c) => c.tropics * c.dayW, 35],
  ['red_fox', 'mammal', (c) => c.temperate * c.nightW, 120],
  ['seal', 'mammal', (c) => c.coast * c.sea, 60], ['fur_seal', 'mammal', (c) => c.coast * c.sea * 0.5, 80],
  ['water_drip', 'near', (c) => 0, 999], ['bee', 'small', (c) => c.temperate * c.dayW * (1 - c.forest) * 0.5, 40],
  ['tree_creak', 'near', (c) => c.forest * c.wind * 1.2, 35],
  ['branch_snap', 'mammal', (c) => c.forest * (0.4 + c.nightW), 80],
  ['rockfall', 'element', (c) => (c.highland + c.canyon) * 0.6, 180],
  ['marmot', 'bigbird', (c) => c.highland * c.dayW, 80],
  ['squirrel', 'small', (c) => c.temperate * c.forest * c.dayW, 70],
];

// ------------------------------------------------------------------ recordings
class Bank {
  constructor(ctx) {
    this.ctx = ctx; this.buf = new Map(); this.loading = new Map(); this.last = new Map(); this.used = new Map(); this.manifest = null; this.bytes = 0;
    // decoded audio is big (≈ 4 bytes per sample): keep a budget and drop what hasn't been heard lately
    this.budget = (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)) ? 110 : 240) * 1e6;
    this.ready = fetch(BASE + 'manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { this.manifest = m; }).catch(() => {});
  }
  list(id) { const m = this.manifest; return m ? (m.calls?.[id] || m.beds?.[id] || []) : []; }
  has(id) { return this.list(id).length > 0; }
  load(file) {
    if (this.buf.has(file)) return Promise.resolve(this.buf.get(file));
    if (this.loading.has(file)) return this.loading.get(file);
    const p = fetch(BASE + file).then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej)))
      .then((b) => { this.buf.set(file, b); this.used.set(file, performance.now()); this.bytes += b.length * b.numberOfChannels * 4; this.trim(); return b; })
      .catch(() => { this.buf.set(file, null); return null; }).finally(() => this.loading.delete(file));
    this.loading.set(file, p); return p;
  }
  trim() {
    if (this.bytes <= this.budget) return;
    const now = performance.now(), byAge = [...this.used.entries()].sort((a, b) => a[1] - b[1]);
    for (const [f, t] of byAge) {
      if (this.bytes <= this.budget * 0.8 || now - t < 20000) break;
      const b = this.buf.get(f); if (b) this.bytes -= b.length * b.numberOfChannels * 4;
      this.buf.delete(f); this.used.delete(f);
    }
  }
  prefetch(ids, max = 2) { for (const id of ids) this.list(id).slice(0, max).forEach((v) => this.load(v.file)); }
  // a decoded variant of this id, never the same one twice running (null if none loaded yet)
  get(id) {
    const L = this.list(id); if (!L.length) return null;
    const ready = L.filter((v) => this.buf.get(v.file)); if (!ready.length) { this.prefetch([id], 4); return null; }
    if (ready.length < L.length) this.prefetch([id], 4);
    let v = pick(ready); if (ready.length > 1 && v.file === this.last.get(id)) v = pick(ready.filter((x) => x.file !== v.file));
    this.last.set(id, v.file); this.used.set(v.file, performance.now()); return this.buf.get(v.file);
  }
}

// a background bed that never loops audibly: random start point, crossfade to a new one every so often
class Bed {
  constructor(eng, id, dest) { this.e = eng; this.id = id; this.g = eng.ctx.createGain(); this.g.gain.value = 0; this.g.connect(dest); this.cur = null; this.t = 0; this.level = 0; }
  update(dt, level) {
    const ctx = this.e.ctx, now = ctx.currentTime;
    this.level = level;
    this.g.gain.setTargetAtTime(level, now, 0.8);
    if (level < 0.002) { if (this.cur && (this.idle = (this.idle || 0) + dt) > 4) { this.stopCur(0.5); } return; }
    this.idle = 0; this.t -= dt;
    if (!this.cur || this.t < 0) {
      const b = this.e.bank.get(this.id); if (!b) return;
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rnd(0.97, 1.03);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + 3);
      s.connect(g); g.connect(this.g); s.start(now, rnd(0, Math.max(0.01, b.duration - 1)));
      this.stopCur(3); this.cur = { s, g }; this.t = rnd(15, 35);
    }
  }
  stopCur(fade) { const c = this.cur; if (!c) return; const now = this.e.ctx.currentTime; c.g.gain.cancelScheduledValues(now); c.g.gain.setValueAtTime(Math.max(0.0001, c.g.gain.value), now); c.g.gain.exponentialRampToValueAtTime(0.0001, now + fade); c.s.stop(now + fade + 0.1); this.cur = null; }
}

export class SoundScape {
  constructor() { this.ctx = null; this.ready = false; this.vol = 0.8; this.nextBird = 2; this.nextCricket = 0; this.nextOwl = 20; this.activity = 0.7; this.actT = 0; this.region = 'temperate'; }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let ctx; try { ctx = new AC({ sampleRate: 32000, latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
    this.ctx = ctx;
    // everything goes through a gentle limiter so a bear's roar over a river can't clip
    this.limiter = ctx.createDynamicsCompressor(); this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 6; this.limiter.attack.value = 0.005; this.limiter.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.limiter); this.limiter.connect(ctx.destination);
    this.bedBus = ctx.createGain(); this.bedBus.connect(this.master);
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
    // synthesised layers: the wind's gusts follow the grass, so they stay; the rest are fallbacks
    this.wind = loop('lowpass', 420, 0.7);
    this.water = loop('bandpass', 1100, 0.5);
    this.rain = loop('highpass', 2400, 0.4);
    this.leaves = loop('bandpass', 3800, 0.9);
    this.bees = loop('bandpass', 230, 6);
    this.surf = loop('lowpass', 600, 0.6);
    this.cicada = loop('bandpass', 4600, 9);
    this.timers = { wood: 20, cuckoo: 30, crow: 15, buzz: 40, frog: 4, wave: 3, gull: 6, wren: 12, coyote: 30, parrot: 8, treefrog: 2 };
    this.bank = new Bank(ctx);
    this.beds = {};
    for (const id of ['forest_day', 'night_crickets', 'wind_soft', 'wind_strong', 'rain_light', 'rain_heavy', 'surf_beach', 'surf_rocks', 'rainforest_day', 'rainforest_night', 'cicadas', 'marsh_frogs'])
      this.beds[id] = new Bed(this, id, this.bedBus);
    // positional loops: the nearest running water, still water, and fire
    this.spots = {};
    for (const id of ['stream', 'river', 'rapids_or_waterfall', 'lake_lapping', 'campfire']) this.spots[id] = this.makeSpot(id);
    this.crickets = []; this.singers = []; this.evT = {};
    this.ready = true;
    this.bank.ready.then(() => { this.hasRec = !!this.bank.manifest; this.prefetchRegion(this.region); });
    const resume = () => ctx.resume?.();
    window.addEventListener('touchend', resume, { passive: true }); window.addEventListener('click', resume);
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  // ---------------------------------------------------------------- 3D plumbing
  panner(pos, ref = 8) {
    const ctx = this.ctx, p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1; p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    return p;
  }
  movePanner(p, x, y, z) { const t = this.ctx.currentTime; if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.3); p.positionY.setTargetAtTime(y, t, 0.3); p.positionZ.setTargetAtTime(z, t, 0.3); } else p.setPosition(x, y, z); }
  updateListener() {
    const L = this.listener; if (!L) return; const l = this.ctx.listener, t = this.ctx.currentTime;
    const x = L.pos.x, y = L.pos.y + 1.6, z = L.pos.z, fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw);
    if (l.positionX) { l.positionX.setValueAtTime(x, t); l.positionY.setValueAtTime(y, t); l.positionZ.setValueAtTime(z, t); l.forwardX.setValueAtTime(fx, t); l.forwardY.setValueAtTime(0, t); l.forwardZ.setValueAtTime(fz, t); l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t); }
    else { l.setPosition(x, y, z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  }
  dist(pos) { const L = this.listener; return L ? Math.hypot(pos.x - L.pos.x, pos.z - L.pos.z) : 10; }
  // an output node at a place in the world (with air absorption), or a plain stereo spot if no place given
  out(pos, vol = 1, ref = 8) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (pos && this.listener) {
      const d = this.dist(pos), f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(1200, 20000 * Math.exp(-d / 260));
      const p = this.panner({ x: pos.x, y: (pos.y ?? this.listener.pos.y) + 0.5, z: pos.z }, ref); g.connect(f); f.connect(p); p.connect(this.master);
    } else this.pan(g, Math.random() * 1.4 - 0.7);
    return g;
  }
  // somewhere around the listener: dist metres away, random bearing, height h
  around(dMin, dMax, h = 0) { const L = this.listener, a = Math.random() * 6.283, r = rnd(dMin, dMax); return L ? { x: L.pos.x + Math.cos(a) * r, y: L.pos.y + h, z: L.pos.z + Math.sin(a) * r } : null; }
  // play a recording; returns false if there isn't one (so the caller can synthesise instead)
  rec(id, pos, { voice = 'songbird', vol = 1, rate = 1, ref } = {}) {
    if (!this.ready) return false; const b = this.bank?.get(id); if (!b) return false;
    const V = VOICE[voice] || VOICE.songbird, s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * rnd(0.96, 1.04);
    const o = this.out(pos, V.gain * vol, ref ?? V.ref); s.connect(o); s.start(); return true;
  }

  // ---------------------------------------------------------------- per-land preparation
  prefetchRegion(region) {
    if (!this.bank?.manifest) return;
    const S = SINGERS[region] || SINGERS.temperate;
    this.bank.prefetch(['cricket', 'katydid', 'step_grass', 'step_leaves', 'step_gravel', 'step_water', ...[...S.forest, ...S.open].map(([id]) => id)], 2);
  }

  // ---------------------------------------------------------------- the frame update
  update(dt, s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, k = 0.25;
    if (this.listener) this.updateListener();
    const region = s.region || 'temperate';
    if (region !== this.region) { this.region = region; this.prefetchRegion(region); this.singers.length = 0; }
    const rec = this.hasRec;
    // a slowly wandering level of activity gives the wild its lulls
    this.actT -= dt; if (this.actT < 0) { this.actT = rnd(20, 60); this.actTarget = Math.random() < 0.25 ? rnd(0.15, 0.4) : rnd(0.55, 1); }
    this.activity += ((this.actTarget ?? 0.7) - this.activity) * Math.min(1, dt * 0.05);
    const w = s.wind, day = s.day, rain = s.rain;
    const dawnDusk = smooth(0.05, 0.3, day) * (1 - smooth(0.45, 0.7, day));
    const C = {
      temperate: region === 'temperate' ? 1 : 0, coast: region === 'coast' ? 1 : 0, canyon: region === 'canyon' ? 1 : 0, tropics: region === 'tropics' ? 1 : 0,
      highland: s.scenario === 'highlands' ? 1 : 0, heath: s.scenario === 'heath' || s.scenario === 'hamlet' ? 1 : 0, lake: (s.scenario === 'lakeland' ? 1 : 0.3) * (s.water > 0.05 ? 1 : 0.3) * (s.home ? 0.3 : 1),
      forest: s.forest, dayW: smooth(0.3, 0.55, day) * (1 - rain * 0.7), birdW: smooth(0.01, 0.22, day) * (1 - Math.min(1, rain) * 0.75), nightW: 1 - smooth(0.12, 0.3, day), duskW: dawnDusk, rain: Math.min(1, rain), wind: Math.min(1.5, w),
      water: Math.min(1, s.water * 2), sea: s.sea || 0, home: s.home ? 1 : 0,
    };
    if (region === 'temperate' && s.home) { C.highland = 0; }
    // wind (synth, follows the gusts) + a recorded wind bed for body
    this.wind.g.gain.setTargetAtTime((rec ? 0.04 : 0.06) + w * (rec ? 0.05 : 0.08), t, k);
    this.wind.f.frequency.setTargetAtTime(300 + w * 260 + Math.sin(t * 0.3) * 120, t, 0.8);
    this.leaves.g.gain.setTargetAtTime(s.forest * w * 0.035, t, k);
    this.bees.g.gain.setTargetAtTime(s.bees ? 0.05 : 0, t, 0.3);
    const B = this.beds, bed = (id, lvl) => B[id]?.update(dt, this.bank.has(id) ? lvl : 0);
    bed('wind_soft', clamp01(0.5 - Math.abs(w - 0.6)) * 0.35 * (1 - C.forest * 0.3));
    bed('wind_strong', smooth(0.9, 1.6, w) * 0.4);
    // rain: recorded rain when we have it
    const rainRec = this.bank.has('rain_light');
    this.rain.g.gain.setTargetAtTime(rain * (rainRec ? 0.03 : 0.12), t, k);
    bed('rain_light', clamp01(rain * 1.6) * (1 - smooth(0.7, 1.2, rain)) * 0.6);
    bed('rain_heavy', smooth(0.6, 1.2, rain) * 0.7);
    // the forest's own murmur by day, the night's insect chorus (quieter under trees and in the wet)
    bed('forest_day', C.temperate * C.dayW * (0.2 + 0.55 * C.forest) * (0.5 + 0.5 * this.activity) * (s.home ? 0.6 : 1) * 0.5);
    bed('night_crickets', (C.temperate + C.coast * 0.6) * C.nightW * (1 - C.rain) * (1 - 0.5 * C.forest) * 0.35);
    bed('rainforest_day', C.tropics * smooth(0.25, 0.5, day) * 0.55);
    bed('rainforest_night', C.tropics * (1 - smooth(0.2, 0.4, day)) * 0.55);
    bed('cicadas', (C.canyon * 0.6 + C.tropics * 0.4) * smooth(0.5, 0.8, day) * (1 - C.rain) * 0.35);
    bed('marsh_frogs', C.temperate * C.water * (C.nightW + C.duskW * 0.5) * (1 - s.home * 0.5) * 0.4);
    // the sea: recorded surf where there is one; otherwise the synthesised breathing roar and crashes
    const sea = s.sea || 0, wv = s.waves || 0.5, surfRec = this.bank.has('surf_beach');
    this.surfPhase = (this.surfPhase || 0) + dt * (0.55 + wv * 0.1);
    const breathe = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(this.surfPhase), 2);
    this.surf.g.gain.setTargetAtTime(sea * (0.05 + wv * 0.09) * breathe * (surfRec ? 0.35 : 1), t, 0.3);
    this.surf.f.frequency.setTargetAtTime(380 + 500 * breathe - wv * 80, t, 0.3);
    bed('surf_beach', sea * (0.35 + wv * 0.35) * (1 - (s.rocky || 0)));
    bed('surf_rocks', sea * (0.25 + wv * 0.3) * (s.rocky || 0.25));
    // synth fallbacks for insects of hot lands
    const cicRec = this.bank.has('cicadas');
    this.cicada.g.gain.setTargetAtTime(cicRec ? 0 : region === 'tropics' && day > 0.4 && rain < 0.5 ? 0.012 * (0.7 + 0.3 * Math.sin(t * 0.8)) : region === 'canyon' && day > 0.6 ? 0.004 : 0, t, 0.8);
    // running and still water, and fire, from where they are
    this.updateSpots(dt, s);
    const waterRec = this.bank.has('stream');
    this.water.g.gain.setTargetAtTime(waterRec ? 0 : Math.min(0.2, s.water * 0.2), t, k);
    // crickets in the grass, birds in the trees
    this.updateCrickets(dt, s, C);
    this.updateSingers(dt, s, C, region);
    // the occasional voices of the land
    this.updateEvents(dt, C);
    // a few synthesised extras that recordings don't cover
    const T = this.timers; for (const key of Object.keys(T)) T[key] -= dt;
    if (T.wave < 0) { T.wave = 6 / (0.55 + wv * 0.1) * (0.6 + Math.random() * 0.8); if (sea > 0.25 && !surfRec) this.waveCrash(sea * (0.6 + wv * 0.5)); }
    if (T.frog < 0) { T.frog = 1.5 + Math.random() * 5; if (s.water > 0.2 && (day < 0.6 || rain > 0.3)) { const p = this.waterPoint ? this.offsetFrom(this.waterPoint, 2, 15) : this.around(8, 25); if (!this.rec(pick(['common_frog', 'common_frog', 'toad', 'bullfrog'].filter((x) => this.bank.has(x)).concat(['common_frog'])), p, { voice: 'small', vol: 0.8 })) this.frog(p); } }
    if (T.treefrog < 0) { T.treefrog = 0.3 + Math.random() * 1.2; if (region === 'tropics' && day < 0.35 && !this.bank.has('rainforest_night')) this.treeFrog(); }
    if (!rec) this.updateSynthOnly(dt, s, C);
  }

  // ---------------------------------------------------------------- water and fire, placed
  makeSpot(id) {
    const g = this.ctx.createGain(); g.gain.value = 0; const p = this.panner({ x: 0, y: 0, z: 0 }, id === 'campfire' ? 2.5 : 7); g.connect(p); p.connect(this.master);
    return { id, g, p, bed: new Bed(this, id, g), lvl: 0 };
  }
  updateSpots(dt, s) {
    const L = this.listener, w = this.world; if (!L || !w?.gen) return;
    this.spotT = (this.spotT || 0) - dt;
    if (this.spotT < 0) {
      this.spotT = 0.8;
      // search rings for the nearest running water and the nearest still water
      let run = null, still = null, best = 1e9, bestS = 1e9, sp = 0, seaP = null, bestSea = 1e9;
      const coast = w.gen.p.kind === 'coast';
      for (let r = 4; r <= 64; r += 6) for (let a = 0; a < 6.283; a += 6.283 / Math.max(8, r / 3)) {
        const x = L.pos.x + Math.cos(a) * r, z = L.pos.z + Math.sin(a) * r, d = w.depthAt(x, z); if (d < 0.05) continue;
        if (coast && r < bestSea && w.gen.seaAt(x, z) > 0.5) { bestSea = r; seaP = { x, y: w.gen.p.water, z }; continue; }
        const f = w.gen.flowAt ? w.gen.flowAt(x, z) : [0, 0], v = Math.hypot(f[0], f[1]);
        if (v > 0.2 && r < best) { best = r; run = { x, z }; sp = v; }
        if (v <= 0.2 && r < bestS && (w.gen.seaAt?.(x, z) || 0) < 0.3) { bestS = r; still = { x, z }; }
      }
      this.waterPoint = run || still ? { x: (run || still).x, y: w.gen.p.water, z: (run || still).z } : null;
      this.run = run; this.runSpeed = sp; this.still = still; this.seaPoint = seaP;
      const fires = [...(w.baseFires || []), ...(w.placedFires || []), ...(w.fires || [])];
      let fb = null, fd = 1e9; for (const f of fires) { const d = Math.hypot(f.x - L.pos.x, f.z - L.pos.z); if (d < fd) { fd = d; fb = f; } }
      this.fire = fd < 40 ? fb : null;
    }
    const W = w.gen.p.water, set = (spot, at, lvl) => {
      if (at) this.movePanner(spot.p, at.x, (at.y ?? W) + 0.3, at.z);
      spot.g.gain.setTargetAtTime(at ? lvl : 0, this.ctx.currentTime, 0.6);
      spot.bed.update(dt, at && this.bank.has(spot.id) ? 1 : 0);
    };
    const fast = this.runSpeed > 1.0;
    set(this.spots.stream, this.run && !fast ? this.run : null, 0.9);
    set(this.spots.river, this.run ? this.run : null, fast ? 0.9 : 0.35);
    set(this.spots.rapids_or_waterfall, this.run && this.runSpeed > 1.2 ? this.run : null, 0.5);
    set(this.spots.lake_lapping, this.still, 0.8);
    set(this.spots.campfire, this.fire, 0.9);
  }

  // ---------------------------------------------------------------- crickets: each one somewhere, each with its own voice
  updateCrickets(dt, s, C) {
    const L = this.listener, w = this.world; if (!L || !w?.gen) return;
    const want = Math.round((C.temperate + C.coast * 0.6 + C.canyon * 0.5) * C.nightW * (1 - C.rain) * (1 - 0.6 * C.forest) * 9 * (0.5 + 0.5 * this.activity));
    while (this.crickets.length > want) { const c = this.crickets.pop(); this.stopCricket(c); }
    for (let i = this.crickets.length; i < want; i++) { const c = this.placeCricket(w); if (c) this.crickets.push(c); else break; }
    for (const c of this.crickets) {
      const d = Math.hypot(c.x - L.pos.x, c.z - L.pos.z);
      // they fall silent when you come close, and start again once you've passed
      if (d < 2.6) c.hush = rnd(6, 14);
      if (c.hush > 0) { c.hush -= dt; c.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); continue; }
      c.g.gain.setTargetAtTime(c.vol, this.ctx.currentTime, 1.2);
      if (d > 34) { this.stopCricket(c); const n = this.placeCricket(w, true); if (n) Object.assign(c, n); else c.dead = true; }
      if (c.synth) { c.next -= dt; if (c.next < 0) { c.next = c.period * rnd(0.9, 1.1); this.chirp(c); } }
    }
    this.crickets = this.crickets.filter((c) => !c.dead);
  }
  placeCricket(w, ahead = false) {
    const L = this.listener;
    for (let k = 0; k < 12; k++) {
      let a = Math.random() * 6.283; if (ahead) a = Math.atan2(-Math.cos(L.yaw), -Math.sin(L.yaw)) + rnd(-1.2, 1.2); // roughly the way you are heading
      const r = rnd(4, 26), x = L.pos.x + Math.cos(a) * r, z = L.pos.z + Math.sin(a) * r;
      if (w.depthAt(x, z) > -0.2) continue;
      const y = w.gen.height(x, z) + 0.05, g = this.ctx.createGain(); g.gain.value = 0;
      const p = this.panner({ x, y, z }, VOICE.insect.ref); g.connect(p); p.connect(this.master);
      const c = { x, z, y, g, p, vol: VOICE.insect.gain * rnd(0.5, 1), hush: 0 };
      const b = this.bank.get(Math.random() < 0.3 && this.bank.has('katydid') ? 'katydid' : 'cricket');
      if (b) { const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rnd(0.88, 1.12); s.connect(g); s.start(this.ctx.currentTime, rnd(0, b.duration)); c.src = s; }
      else { c.synth = true; c.freq = rnd(3600, 5200); c.pulses = Math.floor(rnd(2, 5)); c.period = rnd(0.35, 1.1); c.next = rnd(0, 1); }
      return c;
    }
    return null;
  }
  stopCricket(c) { const t = this.ctx.currentTime, p = c.p, src = c.src; c.g.gain.setTargetAtTime(0, t, 0.3); try { src?.stop(t + 1.2); } catch (e) { void e; } setTimeout(() => { try { p.disconnect(); } catch (e) { void e; } }, 1500); c.src = null; }
  chirp(c) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < c.pulses; i++) { const t = t0 + i * 0.045, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = c.freq; this.env(g, t, 0.004, 0.18, 0.03); o.connect(g); g.connect(c.g); o.start(t); o.stop(t + 0.05); }
  }

  // ---------------------------------------------------------------- songbirds on their perches
  updateSingers(dt, s, C, region) {
    const L = this.listener; if (!L) return;
    const R = SINGERS[region] || SINGERS.temperate;
    const chorus = 1 + C.duskW * 1.6 * (s.day < 0.5 ? 1 : 0.6); // the dawn chorus
    const want = Math.round(C.birdW * (0.8 + C.duskW) * (2.5 + 4 * Math.max(C.forest, 0.25)) * chorus * this.activity);
    while (this.singers.length > want) this.singers.pop();
    while (this.singers.length < want) {
      const open = Math.random() > C.forest + 0.15, list = open ? R.open : R.forest;
      let tot = 0; for (const [, wt] of list) tot += wt; let r = Math.random() * tot, sp = list[0][0]; for (const [id, wt] of list) { r -= wt; if (r <= 0) { sp = id; break; } }
      const pos = this.around(12, 55, open && sp === 'skylark' ? 25 : rnd(3, 9));
      this.singers.push({ sp, pos, next: rnd(0.5, 6), bout: Math.floor(rnd(3, 12)) });
    }
    for (const b of this.singers) {
      b.next -= dt;
      if (b.next > 0) continue;
      if (this.dist(b.pos) > 75 || b.bout-- <= 0) { b.retire = true; continue; }
      b.next = rnd(4, 11) * (b.sp === 'wren' ? 1.4 : 1);
      if (!this.rec(b.sp, b.pos, { voice: 'songbird', vol: rnd(0.6, 1) })) {
        const syn = { robin: 'robin', blackbird: 'blackbird', chaffinch: 'chaffinch', great_tit: 'tit', canyon_wren: 'canyonWren' }[b.sp];
        if (syn === 'canyonWren') this.canyonWren(b.pos); else if (syn) this.song(syn, b.pos, true); else this.bird(b.pos);
      }
    }
    this.singers = this.singers.filter((b) => !b.retire);
  }

  // ---------------------------------------------------------------- the occasional voices
  updateEvents(dt, C) {
    if (!this.listener) return;
    for (const [id, voice, when, mean] of EVENTS) {
      const wgt = when(C) * this.activity; if (wgt <= 0.01) continue;
      this.evT[id] = (this.evT[id] ?? rnd(0.2, 1) * mean) - dt * wgt;
      if (this.evT[id] > 0) continue;
      this.evT[id] = rnd(0.5, 1.5) * mean;
      const far = voice === 'loud' || voice === 'element' ? [120, 380] : voice === 'bigbird' ? [40, 160] : voice === 'near' ? [6, 20] : [15, 60];
      const pos = id === 'herring_gull' || id === 'oystercatcher' || id === 'seal' ? (this.seaPoint || this.around(...far)) : (id === 'common_loon' || id === 'heron' || id === 'mallard') && this.waterPoint ? this.offsetFrom(this.waterPoint, 20, 120) : this.around(...far, voice === 'bigbird' ? 8 : 1);
      if (!this.rec(id, pos, { voice })) this.synthEvent(id, pos);
    }
  }
  offsetFrom(p, a, b) { const ang = Math.random() * 6.283, r = rnd(a, b); return { x: p.x + Math.cos(ang) * r, y: p.y, z: p.z + Math.sin(ang) * r }; }
  synthEvent(id, pos) {
    if (id === 'woodpecker_drum') this.woodpecker(pos); else if (id === 'cuckoo') this.cuckoo(pos); else if (id === 'crow' || id === 'raven') this.crow(pos);
    else if (id === 'buzzard' || id === 'golden_eagle' || id === 'red_tailed_hawk') this.buzzard(pos); else if (id === 'tawny_owl') this.owl(pos);
    else if (id === 'canyon_wren') this.canyonWren(pos); else if (id === 'coyote') this.coyote(pos); else if (id === 'macaw' || id === 'toucan') this.call('parrot', pos, 0.5);
    else if (id === 'herring_gull') this.call('gull', pos, 0.6);
  }

  // synthesised-only behaviour (no recordings at all): the old procedural soundscape
  updateSynthOnly(dt, s) {
    this.nextBird -= dt; this.nextCricket -= dt; this.nextOwl -= dt;
    if (this.nextOwl < 0) { this.nextOwl = 18 + Math.random() * 30; if (s.day < 0.2 && s.forest > 0.2) this.owl(this.around(40, 120, 6)); }
  }

  // ---------------------------------------------------------------- one-shots used by the game
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  pan(node, p) { if (this.ctx.createStereoPanner) { const sp = this.ctx.createStereoPanner(); sp.pan.value = p; node.connect(sp); sp.connect(this.master); return sp; } node.connect(this.master); return node; }

  bird(pos) {
    const ctx = this.ctx, t0 = ctx.currentTime, type = Math.floor(Math.random() * 4), o0 = this.out(pos, 1, 9);
    const notes = 2 + Math.floor(Math.random() * 5), base = 2400 + Math.random() * 2200, vol = 0.02 + Math.random() * 0.03;
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (type === 0 ? 0.09 : 0.16) + Math.random() * 0.02;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      const f = base * (type === 1 ? 1 + i * 0.06 : type === 2 ? 1 - i * 0.05 : 1 + (i % 2) * 0.18);
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (type === 3 ? 0.7 : 1.25), t + 0.07);
      this.env(g, t, 0.01, vol * 3, 0.09); o.connect(g); g.connect(o0); o.start(t); o.stop(t + 0.12);
    }
  }
  owl(pos) {
    const ctx = this.ctx, t0 = ctx.currentTime, o0 = this.out(pos, 1, 30);
    [[0, 0.35], [0.55, 0.25], [0.85, 0.6]].forEach(([dt, d]) => {
      const t = t0 + dt, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(390, t); o.frequency.linearRampToValueAtTime(360, t + d);
      this.env(g, t, 0.05, 0.12, d); o.connect(g); g.connect(o0); o.start(t); o.stop(t + d + 0.05);
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
    if (!this.ready) return;
    const id = { water: 'step_water', stone: 'step_gravel', forest: Math.random() < 0.5 && this.bank?.has('step_forest') ? 'step_forest' : 'step_leaves', sand: 'step_sand', wood: 'step_wood', snow: 'step_snow' }[surface] || 'step_grass';
    const b = this.bank?.get(id) || (id === 'step_leaves' ? this.bank?.get('step_grass') : null);
    if (b) { const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rnd(0.9, 1.1); const g = this.ctx.createGain(); g.gain.value = 0.22 * intensity * rnd(0.8, 1.1); s.connect(g); g.connect(this.master); s.start(); return; }
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
    const delay = Math.min(7, dist / 343), near = Math.max(0.15, 1 - dist / 3000);
    const b = this.bank?.get('thunder');
    if (b) { const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rnd(0.85, 1.05) - (1 - near) * 0.15; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400 + near * 6000; const g = this.ctx.createGain(); g.gain.value = 0.9 * near + 0.15; s.connect(f); f.connect(g); this.pan(g, rnd(-0.5, 0.5)); s.start(this.ctx.currentTime + delay); return; }
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.35;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160 + near * 500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * near, t + 0.08 + (1 - near) * 0.6);
    for (let i = 1; i < 6; i++) g.gain.exponentialRampToValueAtTime(0.25 * near * (1 - i / 7) + 0.01, t + 0.4 + i * 0.55 + Math.random() * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    s.connect(f); f.connect(g); this.pan(g, Math.random() * 1.2 - 0.6); s.start(t, Math.random()); s.stop(t + 6);
  }
  call(kind, pos, vol = 1) {
    if (!this.ready) return;
    // a recording if we have one
    for (const id of CALLS[kind] || []) if (this.rec(id, pos, { voice: CALL_VOICE[kind] || 'mammal', vol, rate: kind === 'cougar_hiss' ? 1.15 : 1 })) return;
    const t = this.ctx.currentTime, o = this.out(pos, vol * (pos ? 3 : 0.7), VOICE[CALL_VOICE[kind]]?.ref || 10);
    if (kind === 'gull') { const n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) { const tt = t + i * 0.32; this.note(o, tt, 1500, 2300, 0.08, 0.03, 'sawtooth'); this.note(o, tt + 0.08, 2300, 1200, 0.18, 0.03, 'sawtooth'); } }
    else if (kind === 'goose') { for (let i = 0; i < 6; i++) { const tt = t + i * 0.28 + Math.random() * 0.1; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; f.connect(o); this.note(f, tt, 520, 430, 0.14, 0.25, 'sawtooth'); } }
    else if (kind === 'raven') { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2.5; f.connect(o); for (let i = 0; i < 2; i++) this.note(f, t + i * 0.5, 360, 300, 0.22, 0.3, 'sawtooth'); }
    else if (kind === 'parrot') { for (let i = 0; i < 3; i++) { const tt = t + i * 0.2; this.note(o, tt, 1800 + Math.random() * 600, 2600, 0.1, 0.035, 'square'); this.noiseBurst(o, tt, 3000, 2, 0.1, 0.03); } }
    else if (kind === 'flamingo') { for (let i = 0; i < 8; i++) { const tt = t + i * 0.18 + Math.random() * 0.1; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3; f.connect(o); this.note(f, tt, 700, 620, 0.12, 0.2, 'sawtooth'); } }
    else if (kind === 'stork') { for (let i = 0; i < 18; i++) this.noiseBurst(o, t + i * 0.06, 1500, 3, 0.03, 0.12); }
    else if (kind === 'rattle') { const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500; f.connect(o); for (let i = 0; i < 40; i++) this.noiseBurst(f, t + i * 0.022, 6000, 1.2, 0.015, 0.5); }
    else if (kind === 'hiss' || kind === 'cougar_hiss') { this.noiseBurst(o, t, 5200, 0.5, 1.1, 0.35, 'highpass'); }
    else if (kind === 'bite') { this.noiseBurst(this.master, t, 2400, 2, 0.08, 0.2); this.note(this.master, t, 300, 120, 0.25, 0.08, 'sawtooth'); }
    else if (kind === 'bear_huff' || kind === 'boar' || kind === 'moose') { for (let i = 0; i < 3; i++) { this.noiseBurst(o, t + i * 0.35, 260, 1, 0.22, 0.8, 'lowpass'); this.note(o, t + i * 0.35, 90, 70, 0.2, 0.15, 'sawtooth'); } }
    else if (kind === 'bear_roar' || kind === 'cougar') { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'cougar' ? 1600 : 700; f.connect(o); this.note(f, t, kind === 'cougar' ? 420 : 160, kind === 'cougar' ? 300 : 110, 1.4, 0.6, 'sawtooth'); this.noiseBurst(o, t, 500, 0.7, 1.3, 0.6, 'lowpass'); }
    else if (kind === 'deer') { this.note(o, t, 900, 500, 0.18, 0.12, 'sawtooth'); for (let i = 0; i < 10; i++) this.noiseBurst(o, t + 0.3 + i * 0.13, 300, 1, 0.05, 0.25, 'lowpass'); }
    else if (kind === 'whale') { const s2 = this.ctx.createBufferSource(); s2.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); s2.connect(f); f.connect(g); g.connect(o); s2.start(t); s2.stop(t + 2.6); }
    else if (kind === 'wolf' || kind === 'coyote' || kind === 'elk') { this.note(o, t, kind === 'elk' ? 900 : 420, kind === 'elk' ? 1800 : 640, 0.9, 0.05); this.note(o, t + 0.9, kind === 'elk' ? 1800 : 640, kind === 'elk' ? 1200 : 400, 1.4, 0.05); }
    else if (kind === 'horse') {
      this.note(o, t, 900, 1300, 0.25, 0.04, 'sawtooth'); for (let i = 0; i < 7; i++) this.note(o, t + 0.25 + i * 0.1, 1100 - i * 90, 1000 - i * 90, 0.09, 0.035, 'sawtooth');
      for (let i = 0; i < 20; i++) this.noiseBurst(o, t + 0.9 + i * 0.11 + (i % 3) * 0.03, 220, 1, 0.05, 0.2, 'lowpass');
    }
  }
  canyonWren(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.5, 9); for (let i = 0; i < 11; i++) { const f = 4200 * Math.pow(0.9, i); this.note(o, t + i * 0.12, f * 1.05, f, 0.09, 0.035); } }
  coyote(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.45, 40); this.note(o, t, 500, 900, 0.5, 0.03); this.note(o, t + 0.55, 900, 600, 0.9, 0.03); for (let i = 0; i < 5; i++) this.note(o, t + 1.6 + i * 0.13, 1200, 800, 0.1, 0.02, 'triangle'); }
  treeFrog() { const t = this.ctx.currentTime, o = this.out(this.around(5, 25, 2), 1.5, 4), f0 = 1800 + Math.random() * 1600; for (let i = 0; i < 2; i++) this.note(o, t + i * 0.09, f0, f0 * 1.2, 0.05, 0.03, 'square'); }

  // ---------------------------------------------------------------- birdsong (one voice per species)
  song(call, pos, synthOnly = false) {
    if (!this.ready) return;
    if (!synthOnly && SONGS[call] && this.rec(SONGS[call], pos, { voice: 'songbird' })) return;
    const t = this.ctx.currentTime, o = this.out(pos, 1, 9);
    if (call === 'robin') { let tt = t; for (let i = 0; i < 9; i++) { const f = 3000 + Math.random() * 3500; const d = 0.05 + Math.random() * 0.1; this.note(o, tt, f, f * (Math.random() < 0.5 ? 0.7 : 1.3), d, 0.03); tt += d + Math.random() * 0.05; } }
    else if (call === 'blackbird') { let tt = t; for (let i = 0; i < 6; i++) { const f = 1500 + Math.random() * 1400; const d = 0.12 + Math.random() * 0.18; this.note(o, tt, f, f * (1 + (Math.random() - 0.5) * 0.3), d, 0.04); tt += d + 0.03; } this.note(o, tt, 5000, 3800, 0.2, 0.012); }
    else if (call === 'chaffinch') { let tt = t, gap = 0.11; for (let i = 0; i < 12; i++) { const f = 4600 - i * 140; this.note(o, tt, f, f * 0.85, 0.05, 0.03); tt += gap; gap *= 0.9; } this.note(o, tt + 0.05, 3000, 4400, 0.18, 0.035); }
    else if (call === 'tit') { for (let i = 0; i < 3; i++) { this.note(o, t + i * 0.36, 5200, 5000, 0.1, 0.035); this.note(o, t + i * 0.36 + 0.15, 3600, 3500, 0.12, 0.035); } }
    else this.bird(pos);
  }
  alarm(call, pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 4; i++) this.note(o, t + i * 0.07, call === 'blackbird' ? 2400 : 5200, call === 'blackbird' ? 2200 : 4800, 0.03, 0.04, 'triangle'); }
  flush(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 8; i++) this.noiseBurst(o, t + i * 0.045, 900, 0.8, 0.03, 0.09); }
  quack(pos, loud) {
    if (!this.ready) return; if (this.rec('mallard', pos, { voice: 'songbird', vol: loud ? 1.3 : 0.9 })) return;
    const t = this.ctx.currentTime, o = this.out(pos, loud ? 1.6 : 1); const n = loud ? 4 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3; f.connect(o); this.note(f, t + i * 0.2, 260 - i * 15, 220, 0.14, 0.5 / (1 + i * 0.3), 'sawtooth'); }
  }
  chatter(pos) { if (!this.ready) return; if (this.rec('squirrel', pos, { voice: 'small' })) return; const t = this.ctx.currentTime, o = this.out(pos, 1); for (let i = 0; i < 14; i++) this.noiseBurst(o, t + i * 0.04, 4200, 6, 0.02, 0.06); }
  rustle(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1); this.noiseBurst(o, t, 1800, 0.6, 0.35, 0.08); }
  plopAt(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.8, 5); this.note(o, t, 500, 180, 0.08, 0.05); this.noiseBurst(o, t, 900, 1.5, 0.1, 0.04); }
  woodpecker(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.6, 25); for (let i = 0; i < 16; i++) this.noiseBurst(o, t + i * 0.055, 1300, 4, 0.025, 0.12 * (1 - i / 20)); }
  cuckoo(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.6, 30); for (let k = 0; k < 2; k++) { this.note(o, t + k * 0.9, 760, 740, 0.25, 0.04); this.note(o, t + k * 0.9 + 0.3, 610, 590, 0.35, 0.04); } }
  crow(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.5, 30); for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2; f.connect(o); this.note(f, t + i * 0.45, 640, 560, 0.3, 0.3, 'sawtooth'); } }
  buzzard(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.5 : 0.5, 30); this.note(o, t, 1900, 1150, 1.1, 0.035); this.noiseBurst(o, t, 1600, 2, 1.0, 0.01); }
  frog(pos) { const t = this.ctx.currentTime, o = this.out(pos, pos ? 1.4 : 0.7, 5); const base = 140 + Math.random() * 120; for (let i = 0; i < 6 + Math.floor(Math.random() * 6); i++) this.note(o, t + i * 0.045, base * 1.3, base, 0.03, 0.08, 'square'); }

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
  // your own breathing when tired: an in-breath and a longer out-breath, harder when winded
  breath(k = 0.5) {
    if (!this.ready) return; const t = this.ctx.currentTime, g = this.ctx.createGain(); g.gain.value = 0.5 + k * 0.6; g.connect(this.master);
    this.noiseBurst(g, t, 1500 + k * 400, 0.7, 0.28, 0.05 * (0.5 + k));
    this.noiseBurst(g, t + 0.36, 900 + k * 300, 0.6, 0.45, 0.07 * (0.5 + k), 'lowpass');
  }
  reel() { this.burst(3200, 4, 0.03, 0.03); }
  craft() { this.burst(2600, 2, 0.07, 0.07); setTimeout(() => this.burst(2200, 2, 0.07, 0.06), 120); setTimeout(() => this.tone([523, 659, 784], 0.08, 0.04), 280); }

  // (dev/testing) what the soundscape is doing right now
  debugState() {
    const beds = Object.fromEntries(Object.entries(this.beds || {}).map(([k, b]) => [k, +b.level.toFixed(3)]).filter(([, v]) => v > 0));
    return { rec: !!this.hasRec, loaded: this.bank ? [...this.bank.buf.keys()].filter((k) => this.bank.buf.get(k)).length : 0, crickets: this.crickets?.length, singers: this.singers?.map((b) => b.sp), beds, activity: +this.activity.toFixed(2), water: !!this.waterPoint, fire: !!this.fire };
  }
}
