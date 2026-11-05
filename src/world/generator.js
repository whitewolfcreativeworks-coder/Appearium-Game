// WorldGen: the continuous height / ecology field of one world (village or expedition).
// All values are pure functions of (x, z) + seed, so terrain can stream in any order.
//
// An expedition world is a BLEND of two landscapes: around the start of the road the land looks
// like the forest around your village ("home"); walking on, it turns into the destination
// landscape (the sea, a canyon, tropical forest…). biomeT(x, z) is 0 at home and 1 in the destination.
import { Noise2D } from '../core/noise.js';
import { hashString, smoothstep, lerp, clamp } from '../core/rng.js';

export const DEFAULT_TERRAIN = {
  kind: 'temperate',
  water: 0,
  base: 5,          // average land height above water
  hills: 16, hillScale: 0.0035,
  mountains: 0, mountainScale: 0.0019, mountainCover: 0.0,
  rivers: 0.6, riverWidth: 0.028,
  streams: 0.6, ponds: 0.5,
  lakes: 0.3,
  wetland: 0,
  moisture: 0, forest: 0, forestScale: 0.0055,
  treeLine: 95, snowLine: 9999,
  roughness: 1,
  coastAt: 430, plateau: 34, canyonWidth: 0.11,
};

export const HOME_TERRAIN = { base: 6, hills: 11, rivers: 0.75, riverWidth: 0.026, lakes: 0.2, forest: 0.12, moisture: 0.05, streams: 0.5, ponds: 0.3 };
export const HOME_SEED = 'appearium-home-v1';
export const HOME_R = 34;            // palisade radius
export const ROAD_START = { x: 0, z: -HOME_R - 1.5 }; // just outside the North Gate, heading north

// the land around the village — shared by the village and by the first stretch of every expedition
export function makeHomeGen() {
  const g = new WorldGen(HOME_SEED, HOME_TERRAIN);
  g.addZone(0, 0, HOME_R + 10, 26, { clear: 1, h: Math.max(g.baseHeight(0, 0), g.p.water + 3) });
  return g;
}
// the road's gentle bends near home are fixed, so the road you see from the gate is always the same
export function homeRoadCurve(home) { return (s) => home.nMask.noise(s * 0.012 + 1, 4.4) * 0.05; }

const tmpA = { river: 0, valley: 0, stream: 0, pond: 0, sea: 0, beach: 0, cliff: 0 };
const tmpB = { river: 0, valley: 0, stream: 0, pond: 0, sea: 0, beach: 0, cliff: 0 };

export class WorldGen {
  constructor(seedStr, terrain = {}, opts = {}) {
    this.p = { ...DEFAULT_TERRAIN, ...terrain };
    this.homeGen = opts.homeGen || null; // a WorldGen of the village land
    this.home = this.homeGen ? this.homeGen.p : opts.home ? { ...DEFAULT_TERRAIN, ...opts.home } : null;
    this.start = opts.start || { x: 0, z: 0 };
    this.dir = opts.dir || { x: 0, z: -1 };
    this.blend = opts.blend || [130, 340];
    const s = hashString(String(seedStr));
    this.seed = s;
    this.nWarp = new Noise2D(s ^ 0x1234);
    this.nHill = new Noise2D(s ^ 0x2345);
    this.nMount = new Noise2D(s ^ 0x3456);
    this.nMask = new Noise2D(s ^ 0x4567);
    this.nLake = new Noise2D(s ^ 0x5678);
    this.nRiver = new Noise2D(s ^ 0x6789);
    this.nMoist = new Noise2D(s ^ 0x789a);
    this.nForest = new Noise2D(s ^ 0x89ab);
    this.nDetail = new Noise2D(s ^ 0x9abc);
    this.nStream = new Noise2D(s ^ 0xa1b2);
    this.nPond = new Noise2D(s ^ 0xb2c3);
    this.nBiome = new Noise2D(s ^ 0xc3d4);
    this.zones = []; // flatten zones {x, z, r, fall, h, clear}
    this.road = null;
    this.out = { h: 0, moist: 0, forest: 0, river: 0, valley: 0, clear: 0, stream: 0, pond: 0, conifer: 0.5, biome: 0, sea: 0, beach: 0, cliff: 0, road: 0 };
  }

  setStart(x, z, angle) { this.start = { x, z }; this.dir = { x: Math.sin(angle), z: -Math.cos(angle) }; }

  // 0 = home landscape, 1 = destination landscape
  biomeT(x, z) {
    if (!this.home) return 1;
    const dx = x - this.start.x, dz = z - this.start.z;
    const u = dx * this.dir.x + dz * this.dir.z, r = Math.hypot(dx, dz);
    const v = Math.max(u, r * 0.72) + this.nBiome.fbm(x * 0.006, z * 0.006, 2) * 45;
    return smoothstep(this.blend[0], this.blend[1], v);
  }
  // coordinates along / across the road direction
  roadCoords(x, z) { const dx = x - this.start.x, dz = z - this.start.z; return [dx * this.dir.x + dz * this.dir.z, dx * this.dir.z - dz * this.dir.x]; }

  addZone(x, z, r, fall = 18, opts = {}) {
    const h = opts.h !== undefined ? opts.h : Math.max(this.baseHeight(x, z), this.p.water + 1.6);
    const zone = { x, z, r, fall, h, clear: opts.clear ?? 1, id: opts.id };
    this.zones.push(zone);
    return zone;
  }

  // terrain without flatten zones or road (used to site points of interest)
  baseHeight(x, z) { return this._base(x, z, null); }

  _temperate(p, x, z, o) {
    const wx = x + 55 * this.nWarp.fbm(x * 0.0021, z * 0.0021, 2);
    const wz = z + 55 * this.nWarp.fbm(x * 0.0021 + 31.7, z * 0.0021 - 12.1, 2);
    let h = p.base + p.hills * (this.nHill.fbm(wx * p.hillScale, wz * p.hillScale, 5) + 0.25);
    h += p.roughness * (this.nDetail.fbm(x * 0.045, z * 0.045, 3) * 0.9 + this.nDetail.noise(x * 0.21, z * 0.21) * 0.12);
    if (p.mountains > 0) {
      const mask = smoothstep(0.05, 0.55, this.nMask.fbm(x * 0.0011, z * 0.0011, 3) * 0.6 + p.mountainCover);
      if (mask > 0) { const r = this.nMount.ridged(wx * p.mountainScale, wz * p.mountainScale, 6, 2.05, 0.5); h += Math.pow(r, 1.7) * p.mountains * mask; }
    }
    if (p.wetland > 0) {
      const wm = smoothstep(-0.3, 0.3, this.nMask.fbm(x * 0.0017 + 9.3, z * 0.0017, 2) + p.wetland - 0.5);
      if (wm > 0) {
        const pond = smoothstep(0.32, 0.6, this.nLake.noise(x * 0.018, z * 0.018) * 0.7 + this.nLake.noise(x * 0.05, z * 0.05) * 0.3);
        const flat = p.water + 0.9 + this.nDetail.fbm(x * 0.03, z * 0.03, 2) * 0.7 - pond * 2.3;
        h = lerp(h, flat, wm * 0.85);
      }
    }
    if (p.lakes > 0) {
      const ln = this.nLake.fbm(x * 0.0032, z * 0.0032, 3) + (p.lakes - 0.5) * 0.4;
      const basin = smoothstep(0.05, 0.42, ln);
      if (basin > 0 && h > p.water) h = p.water + (h - p.water) * (1 - 0.85 * basin);
      const L = smoothstep(0.36, 0.62, ln);
      if (L > 0) h = lerp(h, Math.min(h, p.water - 4.5 - (p.lakeDepth || 0) * L), L);
      // islands in big lakes
      if (p.islands && L > 0.6) { const isl = smoothstep(0.62, 0.8, this.nPond.noise(x * 0.012, z * 0.012)); if (isl > 0) h = lerp(h, p.water + 2.5 + this.nDetail.fbm(x * 0.03, z * 0.03, 2) * 2, isl); }
    }
    let pondK = 0;
    if (p.ponds > 0) {
      const above = h - p.water, low = smoothstep(7, 2.5, above);
      if (low > 0) {
        const pv = this.nPond.noise(x * 0.011, z * 0.011) * 0.8 + this.nPond.noise(x * 0.04, z * 0.04) * 0.2;
        const k = smoothstep(0.78 - p.ponds * 0.14, 0.95 - p.ponds * 0.12, pv) * low;
        if (k > 0) { h = lerp(h, Math.min(h, p.water - 2.6), k); pondK = smoothstep(0.35, 0.8, k); }
      }
    }
    let stream = 0;
    if (p.streams > 0) {
      const above = h - p.water, low = smoothstep(10, 3.5, above);
      if (low > 0) {
        const sn = this.nStream.fbm(wx * 0.0034, wz * 0.0034, 3);
        const d = Math.abs(sn), w = 0.016;
        const v = (1 - smoothstep(0, w * 6, d)) * low * p.streams;
        const ch = (1 - smoothstep(w * 0.25, w * 1.2, d)) * low * p.streams;
        if (above > 0) h = p.water + above * (1 - 0.7 * v);
        h = Math.min(h, lerp(h, p.water - 0.85, ch));
        stream = ch;
      }
    }
    let channel = 0, valley = 0;
    if (p.rivers > 0) {
      const rn = this.nRiver.fbm(wx * 0.0014, wz * 0.0014, 3);
      const d = Math.abs(rn), w = p.riverWidth;
      valley = 1 - smoothstep(0, w * 8, d);
      channel = 1 - smoothstep(w * 0.2, w * 1.5, d);
      const above = h - p.water;
      if (above > 0) h = p.water + above * (1 - 0.93 * Math.pow(valley, 1.4) * p.rivers);
      h = Math.min(h, lerp(h, p.water - 1.9, channel * p.rivers));
    }
    if (o) { o.river = Math.max(channel * p.rivers, stream); o.valley = valley * p.rivers; o.stream = stream; o.pond = pondK; o.sea = 0; o.beach = 0; o.cliff = 0; }
    return h;
  }

  // the destination landscape: temperate base reshaped by the destination kind
  _dest(x, z, o) {
    const p = this.p;
    let h = this._temperate(p, x, z, o);
    if (p.kind === 'coast') {
      const [u, lat] = this.roadCoords(x, z);
      const head = smoothstep(0.3, 0.62, this.nMount.noise(lat * 0.0055 + 3.1, 1.7) * 0.8 + this.nMount.noise(lat * 0.02, 5.5) * 0.2);
      const coastU = p.coastAt + 95 * this.nMask.fbm(lat * 0.0028 + 11, 3.1, 3) + 25 * this.nDetail.noise(lat * 0.02, 7.7) - head * 70;
      const c = u - coastU; // < 0 land, > 0 sea
      if (c < 0) {
        const dune = this.nHill.ridged(x * 0.018, z * 0.018, 3) * 3.5 * smoothstep(-20, -55, c) * smoothstep(-220, -110, c) * (1 - head);
        const land = p.water + 1.1 + (-c) * 0.028 + dune;
        h = lerp(land, Math.max(h, land), smoothstep(-60, -300, c));
        // rocky headlands end in cliffs
        if (head > 0) { const cliffH = p.water + 5 + 11 * head + this.nDetail.fbm(x * 0.05, z * 0.05, 2) * 2; h = lerp(h, Math.max(h, cliffH), head * smoothstep(1, -6, c)); }
      } else {
        const bed = p.water + 1.1 - c * (0.075 + head * 0.9) - 9 * smoothstep(60, 320, c);
        h = Math.max(bed, p.water - 32);
        // sea stacks offshore
        const st = smoothstep(0.87, 0.94, this.nPond.noise(x * 0.022, z * 0.022) + this.nDetail.noise(x * 0.12, z * 0.12) * 0.04) * smoothstep(15, 40, c) * smoothstep(200, 110, c);
        if (st > 0) h = lerp(h, p.water + 3 + st * 6 + this.nHill.ridged(x * 0.09, z * 0.09, 3) * 4, Math.min(1, st * 1.6));
        if (o) o.cliff = Math.max(o.cliff, st);
      }
      if (o) { o.sea = smoothstep(-8, 12, c); o.beach = smoothstep(-80, -25, c) * (1 - smoothstep(6, 18, c)) * (1 - head * 0.8); o.cliff = Math.max(o.cliff, head * smoothstep(-25, 0, c)); o.river *= smoothstep(10, -20, c); }
    } else if (p.kind === 'canyon') {
      const top = p.water + p.plateau;
      const plateau = top + (h - p.base) * 0.35;
      const wx = x + 40 * this.nWarp.fbm(x * 0.003, z * 0.003, 2), wz = z + 40 * this.nWarp.fbm(x * 0.003 + 9, z * 0.003, 2);
      const cn = this.nRiver.fbm(wx * 0.0021, wz * 0.0021, 3);
      const d = Math.abs(cn), W = p.canyonWidth;
      const f = 1 - smoothstep(0, W, d);
      const S = 6, ramp = smoothstep(0.35, 0.75, this.nMask.noise(x * 0.004, z * 0.004));
      const q = smoothstep(0, 1, f) * S;
      const stepped = (Math.floor(q) + smoothstep(0.45 - ramp * 0.4, 0.9 + ramp * 0.1, q - Math.floor(q))) / S;
      const floor = p.water + 1.3;
      h = plateau - (plateau - floor) * stepped;
      // river along the canyon floor
      const ch = 1 - smoothstep(W * 0.05, W * 0.12, d);
      h = lerp(h, p.water - 1.6, ch);
      // buttes on the plateau
      const butte = smoothstep(0.82, 0.86, this.nPond.noise(x * 0.008, z * 0.008)) * (1 - f);
      if (butte > 0) h += butte * 14;
      if (o) { o.river = ch; o.valley = f; o.stream = 0; o.pond = 0; o.cliff = f > 0.02 && f < 0.98 ? 1 : butte; }
    }
    return h;
  }

  _home(x, z, o) {
    if (!this.homeGen) return this._temperate(this.home, x, z, o);
    const H = this.homeGen; let h = H._base(x, z, o);
    for (const zn of H.zones) { const dx = x - zn.x, dz = z - zn.z, d2 = dx * dx + dz * dz, R = zn.r + zn.fall; if (d2 < R * R) h = lerp(h, zn.h + H.nDetail.noise(x * 0.08, z * 0.08) * 0.12, smoothstep(R, zn.r, Math.sqrt(d2))); }
    return h;
  }

  _base(x, z, o) {
    const t = this.biomeT(x, z);
    if (t >= 0.999 || !this.home) { if (o) o.biome = 1; return this._dest(x, z, o); }
    if (t <= 0.001) { const h = this._home(x, z, o); if (o) o.biome = 0; return h; }
    const a = o ? tmpA : null, b = o ? tmpB : null;
    const hh = this._home(x, z, a), hd = this._dest(x, z, b);
    if (o) { for (const k of ['river', 'valley', 'stream', 'pond', 'sea', 'beach', 'cliff']) o[k] = lerp(a[k], b[k], t); o.biome = t; }
    // (the home generator stamps biome = 1 on its own output; the blend above sets the real value)
    return lerp(hh, hd, t);
  }

  // ---------------------------------------------------------------- the road
  buildRoad(from, angle, length, curve = null) {
    const pts = []; let x = from.x, z = from.z, a = angle;
    curve = curve || ((s) => this.nMask.noise(s * 0.012 + 1, 4.4) * 0.05);
    for (let s = 0; s <= length; s += 4) {
      pts.push([x, z, 0]);
      a += curve(s);
      x += Math.sin(a) * 4; z -= Math.cos(a) * 4;
    }
    // road surface follows the land, smoothed, never under water
    // sit the road on the average of the ground across it, so it neither tunnels nor perches
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], r = pts[Math.max(0, i - 1)];
      let dx = q[0] - r[0], dz = q[1] - r[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const c = this.baseHeight(p[0], p[1]), L = this.baseHeight(p[0] - dz * 6, p[1] + dx * 6), R = this.baseHeight(p[0] + dz * 6, p[1] - dx * 6);
      p[2] = Math.max((c * 2 + L + R) / 4, this.p.water + 0.9);
    }
    for (let pass = 0; pass < 8; pass++) for (let i = 1; i < pts.length - 1; i++) pts[i][2] = (pts[i - 1][2] + pts[i][2] * 2 + pts[i + 1][2]) / 4;
    const grid = new Map(), C = 24;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      for (const [gx, gz] of [[ax, az], [bx, bz]]) for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const k = (Math.floor(gx / C) + ox) + ',' + (Math.floor(gz / C) + oz); let l = grid.get(k); if (!l) grid.set(k, l = new Set()); l.add(i);
      }
    }
    this.road = { pts, grid, C, width: 2.2 };
    return this.road;
  }
  roadInfo(x, z) {
    const R = this.road; if (!R) return null;
    const l = R.grid.get(Math.floor(x / R.C) + ',' + Math.floor(z / R.C)); if (!l) return null;
    let bd = 1e9, by = 0, bt = 0, bi = 0;
    for (const i of l) {
      const [ax, az, ay] = R.pts[i], [bx, bz, byy] = R.pts[i + 1];
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
      const d = Math.hypot(ax + vx * t - x, az + vz * t - z);
      if (d < bd) { bd = d; by = ay + (byy - ay) * t; bt = t; bi = i; }
    }
    return { d: bd, y: by, i: bi + bt };
  }

  height(x, z) {
    let h = this._base(x, z, null);
    for (let i = 0; i < this.zones.length; i++) {
      const zn = this.zones[i];
      const dx = x - zn.x, dz = z - zn.z;
      const d2 = dx * dx + dz * dz, R = zn.r + zn.fall;
      if (d2 < R * R) { const t = smoothstep(R, zn.r, Math.sqrt(d2)); h = lerp(h, zn.h + this.nDetail.noise(x * 0.08, z * 0.08) * 0.12, t); }
    }
    if (this.road) { const r = this.roadInfo(x, z); if (r && r.d < 11) h = lerp(h, r.y + (r.d < 2.6 ? -0.05 : 0), smoothstep(11, 2.6, r.d)); }
    return h;
  }

  // full ecological sample (reuses one object — copy values you need)
  sample(x, z) {
    const o = this.out, p = this.p;
    let h = this._base(x, z, o);
    let clear = 0;
    for (let i = 0; i < this.zones.length; i++) {
      const zn = this.zones[i];
      const dx = x - zn.x, dz = z - zn.z;
      const d2 = dx * dx + dz * dz, R = zn.r + zn.fall;
      if (d2 < R * R) { const t = smoothstep(R, zn.r, Math.sqrt(d2)); h = lerp(h, zn.h + this.nDetail.noise(x * 0.08, z * 0.08) * 0.12, t); clear = Math.max(clear, t * zn.clear); }
    }
    o.road = 0;
    if (this.road) { const r = this.roadInfo(x, z); if (r && r.d < 11) { h = lerp(h, r.y + (r.d < 2.6 ? -0.05 : 0), smoothstep(11, 2.6, r.d)); o.road = smoothstep(5, 2.2, r.d); clear = Math.max(clear, smoothstep(6, 3, r.d)); } }
    o.h = h; o.clear = clear;
    const t = o.biome, H = this.home || p;
    const moisture = lerp(H.moisture, p.moisture, t), forestBias = lerp(H.forest, p.forest, t), treeLine = lerp(H.treeLine, p.treeLine, t), fs = lerp(H.forestScale, p.forestScale, t);
    const above = h - p.water;
    let m = 0.5 + 0.38 * this.nMoist.fbm(x * 0.0042, z * 0.0042, 3) + moisture + o.valley * 0.25;
    if (above < 2.5) m += (2.5 - Math.max(above, 0)) * 0.08;
    o.moist = clamp(m, 0, 1);
    let f = smoothstep(-0.35, 0.3, this.nForest.fbm(x * fs, z * fs, 4) + forestBias);
    f *= 1 - smoothstep(treeLine - 18, treeLine + 6, h);
    f *= smoothstep(0.4, 1.8, above);
    f *= 1 - clear;
    f *= 1 - o.beach * 0.9;
    f *= 1 - o.cliff * 0.8;
    o.forest = f;
    o.conifer = clamp(0.5 + (0.5 - o.moist) * 1.2 + smoothstep(treeLine - 40, treeLine, h) * 0.6 + this.nForest.noise(x * 0.01 + 40, z * 0.01) * 0.25, 0, 1);
    if (this.homeGen && t < 0.999) { // near home the woods are exactly the woods around the village
      const hs = this.homeGen.sample(x, z), k = 1 - t;
      o.moist = lerp(o.moist, hs.moist, k); o.conifer = lerp(o.conifer, hs.conifer, k);
      o.forest = lerp(o.forest, hs.forest * (1 - clear), k);
      o.clear = Math.max(clear, hs.clear * k);
    }
    return o;
  }

  // how "sea-like" the water is here (waves, surf) — cheap, for water meshes and fishing
  seaAt(x, z) {
    if (this.p.kind !== 'coast') return 0;
    const t = this.biomeT(x, z); if (t <= 0) return 0;
    const o = tmpB; this._dest(x, z, o); return o.sea * t;
  }
}
