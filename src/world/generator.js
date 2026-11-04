// WorldGen: the continuous height / ecology field of one world (village or expedition).
// All values are pure functions of (x, z) + seed, so terrain can stream in any order.
import { Noise2D } from '../core/noise.js';
import { hashString, smoothstep, lerp, clamp } from '../core/rng.js';

export const DEFAULT_TERRAIN = {
  water: 0,
  base: 5,          // average land height above water
  hills: 16, hillScale: 0.0035,
  mountains: 0, mountainScale: 0.0019, mountainCover: 0.0,
  rivers: 0.6, riverWidth: 0.028,
  lakes: 0.3,
  wetland: 0,
  moisture: 0, forest: 0, forestScale: 0.0055,
  treeLine: 95, snowLine: 9999,
  roughness: 1,
};

export class WorldGen {
  constructor(seedStr, terrain = {}) {
    this.p = { ...DEFAULT_TERRAIN, ...terrain };
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
    this.zones = []; // flatten zones {x, z, r, fall, h, clear}
    this.out = { h: 0, moist: 0, forest: 0, river: 0, valley: 0, clear: 0 };
  }

  addZone(x, z, r, fall = 18, opts = {}) {
    const h = opts.h !== undefined ? opts.h : Math.max(this.baseHeight(x, z), this.p.water + 1.6);
    const zone = { x, z, r, fall, h, clear: opts.clear ?? 1, id: opts.id };
    this.zones.push(zone);
    return zone;
  }

  // terrain without flatten zones (used to site points of interest)
  baseHeight(x, z) { return this._base(x, z, null); }

  _base(x, z, o) {
    const p = this.p;
    const wx = x + 55 * this.nWarp.fbm(x * 0.0021, z * 0.0021, 2);
    const wz = z + 55 * this.nWarp.fbm(x * 0.0021 + 31.7, z * 0.0021 - 12.1, 2);
    let h = p.base + p.hills * (this.nHill.fbm(wx * p.hillScale, wz * p.hillScale, 5) + 0.25);
    // fine detail — small undulations and roughness
    h += p.roughness * (this.nDetail.fbm(x * 0.045, z * 0.045, 3) * 0.9 + this.nDetail.noise(x * 0.21, z * 0.21) * 0.12);
    if (p.mountains > 0) {
      const mask = smoothstep(0.05, 0.55, this.nMask.fbm(x * 0.0011, z * 0.0011, 3) * 0.6 + p.mountainCover);
      if (mask > 0) {
        const r = this.nMount.ridged(wx * p.mountainScale, wz * p.mountainScale, 6, 2.05, 0.5);
        h += Math.pow(r, 1.7) * p.mountains * mask;
      }
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
      // a broad basin first (so shores shelve gently), then the lake bed itself
      const basin = smoothstep(0.05, 0.42, ln);
      if (basin > 0 && h > p.water) h = p.water + (h - p.water) * (1 - 0.85 * basin);
      const L = smoothstep(0.36, 0.62, ln);
      if (L > 0) h = lerp(h, Math.min(h, p.water - 4.5), L);
    }
    let channel = 0, valley = 0;
    if (p.rivers > 0) {
      const rn = this.nRiver.fbm(wx * 0.0014, wz * 0.0014, 3);
      const d = Math.abs(rn);
      const w = p.riverWidth;
      valley = 1 - smoothstep(0, w * 8, d);
      channel = 1 - smoothstep(w * 0.2, w * 1.5, d);
      // a broad valley and floodplain that funnel down to the river, then a gently shelving channel
      const above = h - p.water;
      if (above > 0) h = p.water + above * (1 - 0.93 * Math.pow(valley, 1.4) * p.rivers);
      h = Math.min(h, lerp(h, p.water - 1.9, channel * p.rivers));
    }
    if (o) { o.river = channel * p.rivers; o.valley = valley * p.rivers; }
    return h;
  }

  height(x, z) {
    let h = this._base(x, z, null);
    for (let i = 0; i < this.zones.length; i++) {
      const zn = this.zones[i];
      const dx = x - zn.x, dz = z - zn.z;
      const d2 = dx * dx + dz * dz, R = zn.r + zn.fall;
      if (d2 < R * R) {
        const t = smoothstep(R, zn.r, Math.sqrt(d2));
        h = lerp(h, zn.h + this.nDetail.noise(x * 0.08, z * 0.08) * 0.12, t);
      }
    }
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
      if (d2 < R * R) {
        const t = smoothstep(R, zn.r, Math.sqrt(d2));
        h = lerp(h, zn.h + this.nDetail.noise(x * 0.08, z * 0.08) * 0.12, t);
        clear = Math.max(clear, t * zn.clear);
      }
    }
    o.h = h; o.clear = clear;
    const above = h - p.water;
    let m = 0.5 + 0.38 * this.nMoist.fbm(x * 0.0042, z * 0.0042, 3) + p.moisture + o.valley * 0.25;
    if (above < 2.5) m += (2.5 - Math.max(above, 0)) * 0.08;
    o.moist = clamp(m, 0, 1);
    let f = smoothstep(-0.35, 0.3, this.nForest.fbm(x * p.forestScale, z * p.forestScale, 4) + p.forest);
    f *= 1 - smoothstep(p.treeLine - 18, p.treeLine + 6, h);
    f *= smoothstep(0.4, 1.8, above);
    f *= 1 - clear;
    o.forest = f;
    return o;
  }
}
