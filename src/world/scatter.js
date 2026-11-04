// Ecological scatter. For each chunk, candidate points are tested against the local habitat
// (height above water, slope, moisture, forest density, clearings) so species appear where they
// plausibly would: ferns and fungi in damp woods, pines on dry heights, nettles near water...
import * as THREE from 'three';
import { hash2, RNG, smoothstep } from '../core/rng.js';
import { InstanceList } from './pools.js';
import { KIND_INFO } from './vegetation.js';
import { ITEMS } from '../game/items.js';

const tmpC = new THREE.Color();

export function makePopulator(world) {
  const gen = world.gen, eco = world.eco, water = gen.p.water;
  const autumn = world.autumn || 0;
  return function populate(chunk) {
    const veg = new Map();
    const lists = new Map();
    const L = (kind, tree = false) => { let l = lists.get(kind); if (!l) { l = new InstanceList(); l.tree = tree; lists.set(kind, l); } return l; };
    const interactables = [], colliders = [];
    const rng = new RNG((gen.seed ^ (chunk.cx * 73856093) ^ (chunk.cz * 19349663)) >>> 0);
    const S = 64, x0 = chunk.x0, z0 = chunk.z0;
    const slopeAt = (x, z, h) => {
      const hx = gen.height(x + 1, z), hz = gen.height(x, z + 1);
      return 1 - 1 / Math.sqrt(1 + (hx - h) ** 2 + (hz - h) ** 2);
    };
    const collected = world.collected;
    let serial = 0;
    const addGather = (kind, poolKey, idx, x, y, z, item, qty, label, extra = {}) => {
      interactables.push({ id: extra.id, type: 'gather', poolKey, owner: chunk.key, index: idx, pos: new THREE.Vector3(x, y, z), item, qty, label, radius: extra.radius ?? 1.8, bonus: extra.bonus, chunk });
    };

    // ---------------------------------------------------------------- trees
    const cell = 3.4;
    for (let gx = 0; gx < S / cell; gx++) for (let gz = 0; gz < S / cell; gz++) {
      const id = serial++;
      const x = x0 + (gx + rng.next()) * cell, z = z0 + (gz + rng.next()) * cell;
      const r1 = rng.next(), r2 = rng.next(), r3 = rng.next(), r4 = rng.next();
      const s = gen.sample(x, z);
      if (s.clear > 0.35) continue;
      const h = s.h, above = h - water;
      if (above < 0.5) continue;
      const f = s.forest, m = s.moist;
      const pTree = (f * eco.treeDensity * cell * cell) + 0.008;
      if (r1 < pTree) {
        const slope = slopeAt(x, z, h);
        if (slope > 0.5) continue;
        // species choice by habitat
        const high = smoothstep(gen.p.treeLine - 35, gen.p.treeLine, h);
        let wCon = eco.conifer * (1 + high * 2 + (0.5 - m)), wBro = eco.broad * (1 - high) * (0.6 + m), wSnag = eco.snag * (1 + m * 0.5 + high);
        const tot = wCon + wBro + wSnag; let pick = r2 * tot;
        let kind, base;
        if ((pick -= wSnag) < 0) { kind = `snag${Math.floor(r3 * 2)}`; base = 'snag'; }
        else if ((pick -= wCon) < 0) { kind = `conifer${Math.floor(r3 * 4)}`; base = 'conifer'; }
        else { kind = `broad${Math.floor(r3 * 3)}`; base = 'broad'; }
        const sc = 0.7 + r4 * 0.6 - high * 0.25;
        let col = null;
        if (base !== 'snag') {
          if (base === 'broad') {
            tmpC.setRGB(0.95, 1.0, 0.92).offsetHSL((r4 - 0.5) * 0.06, 0, (r3 - 0.5) * 0.15);
            if (autumn > 0 && r3 < autumn) tmpC.lerp(new THREE.Color().setHSL(0.06 + r2 * 0.08, 0.75, 0.55), 0.45 + r4 * 0.5);
          } else tmpC.setRGB(0.88, 0.96, 0.9).offsetHSL((r4 - 0.5) * 0.05, 0, (r3 - 0.5) * 0.12 - high * 0.08);
          col = tmpC;
        }
        L(kind, true).push(x, h - 0.15, z, r2 * 6.283, sc, (r3 - 0.5) * 0.06, col);
        colliders.push({ x, z, r: (KIND_INFO[kind].radius || 0.3) * sc + 0.05 });
        continue;
      }
      // forest floor & understory
      if (r1 < pTree + 0.14 * f * eco.fern * (0.4 + m) && above > 0.8) {
        const v = Math.floor(r3 * (KIND_INFO.fern?.variants || 1));
        L(`fern${v}`).push(x, h - 0.05, z, r2 * 6.28, 0.7 + r4 * 0.6, 0, tmpC.setRGB(0.9 + r4 * 0.15, 1, 0.9));
        continue;
      }
    }

    // ---------------------------------------------------------------- scattered features (random points)
    const rnd = (n) => Array.from({ length: n }, () => [x0 + rng.next() * S, z0 + rng.next() * S, rng.next(), rng.next(), rng.next()]);
    const site = (x, z) => { const s = gen.sample(x, z); return { h: s.h, f: s.forest, m: s.moist, clear: s.clear, river: s.river, above: s.h - water }; };

    // fallen logs (wood ×3)
    for (const [x, z, a, b, c] of rnd(Math.round(4 * eco.logs))) {
      const id = `${chunk.key}:log:${serial++}`; const s = site(x, z);
      if (s.above < 0.8 || s.f < 0.3 || s.clear > 0.3 || a > s.f) continue;
      if (collected.has(id)) continue;
      const li = L('log0').push(x, s.h - 0.06, z, b * 6.28, 1 + c * 0.4);
      addGather('log', 'log0', li, x, s.h + 0.3, z, 'wood', 3, 'Break up the fallen log', { id, radius: 2.6 });
    }
    // branches (wood ×1–2)
    for (const [x, z, a, b, c] of rnd(10)) {
      const id = `${chunk.key}:br:${serial++}`; const s = site(x, z);
      if (s.above < 0.6 || s.clear > 0.5 || a > s.f * 0.9 + 0.08) continue;
      if (collected.has(id)) continue;
      const k = c < 0.5 ? 'branches0' : 'branches1';
      const li = L(k).push(x, s.h + 0.02, z, b * 6.28, 0.9 + c * 0.3);
      addGather('branches', k, li, x, s.h + 0.2, z, 'wood', 1 + (c > 0.6 ? 1 : 0), 'Gather fallen branches', { id });
    }
    // stumps (decor)
    for (const [x, z, a, b, c] of rnd(2)) { const s = site(x, z); if (s.f > 0.3 && s.above > 1 && s.clear < 0.3) { L('stump0').push(x, s.h - 0.1, z, b * 6.28, 0.8 + c * 0.6); colliders.push({ x, z, r: 0.55 }); } }

    // boulders and rock sets — on slopes, rocky ground
    for (const [x, z, a, b, c] of rnd(Math.round(6 * eco.rocks))) {
      const s = site(x, z); if (s.above < -0.5 || s.clear > 0.4) continue;
      const slope = slopeAt(x, z, s.h);
      if (a > 0.25 + slope * 2) continue;
      if (b < 0.6) { const sc = 0.6 + c * 1.6; L('boulder0').push(x, s.h - 0.25 * sc, z, b * 30, sc, (a - 0.5) * 0.3); colliders.push({ x, z, r: 0.85 * sc }); }
      else { const v = Math.floor(c * (KIND_INFO.rockset?.variants || 1)); L(`rockset${v}`).push(x, s.h - 0.2, z, b * 30, 0.8 + a * 0.6); colliders.push({ x, z, r: 1.0 }); }
    }
    // loose stones (gather)
    for (const [x, z, a, b, c] of rnd(5)) {
      const id = `${chunk.key}:st:${serial++}`; const s = site(x, z);
      if (s.above < 0.3 || s.clear > 0.6 || collected.has(id)) continue;
      if (a > 0.35 + (eco.rocks * 0.3) + (s.river * 0.6)) continue;
      const li = L('pebble0').push(x, s.h - 0.02, z, b * 6.28, 2.2 + c * 1.4);
      addGather('stones', 'pebble0', li, x, s.h + 0.1, z, 'stone', 2, 'Collect stones', { id });
    }
    // mineral outcrops
    if (eco.minerals.length) for (const [x, z, a, b, c] of rnd(3)) {
      const id = `${chunk.key}:mn:${serial++}`; const s = site(x, z);
      if (s.above < 2 || s.clear > 0.4 || collected.has(id)) continue;
      const slope = slopeAt(x, z, s.h);
      if (slope < 0.12 || a > 0.55) continue;
      const mineral = eco.minerals[Math.floor(b * eco.minerals.length)];
      const sc = 0.9 + c * 0.5;
      L('boulder0').push(x, s.h - 0.3 * sc, z, b * 40, sc);
      colliders.push({ x, z, r: 0.8 * sc });
      const li = L(`crystal_${mineral}`).push(x + 0.55 * sc, s.h + 0.15, z + 0.2, a * 6.28, 1.2 + c * 0.6);
      addGather('mineral', `crystal_${mineral}`, li, x + 0.5, s.h + 0.4, z, mineral, mineral === 'amethyst' ? 1 : 2, `Chip out ${ITEMS[mineral].name.toLowerCase()}`, { id, radius: 2.4 });
    }
    // mushrooms
    for (const [x, z, a, b, c] of rnd(9)) {
      const id = `${chunk.key}:mu:${serial++}`; const s = site(x, z);
      if (s.above < 0.4 || s.clear > 0.4 || collected.has(id)) continue;
      if (a > s.f * (0.35 + s.m * 0.65)) continue;
      let type = eco.mushrooms[Math.floor(b * eco.mushrooms.length)];
      if (type === 'ghostcap' && c > 0.35) type = eco.mushrooms[0];
      const key = type === 'ghostcap' ? 'mush_ghostcap0' : `mush_${type}${c < 0.5 ? 0 : 1}`;
      const li = L(key).push(x, s.h - 0.01, z, b * 6.28, 1.2 + c * 0.6);
      addGather('mushroom', key, li, x, s.h + 0.1, z, type, type === 'ghostcap' ? 1 : 2 + Math.floor(c * 2), `Pick ${ITEMS[type].name.toLowerCase()}s`, { id });
    }
    // berry bushes (some laden)
    const shrubVariants = KIND_INFO.shrub?.variants || 1;
    for (const [x, z, a, b, c] of rnd(6)) {
      const id = `${chunk.key}:sh:${serial++}`; const s = site(x, z);
      if (s.above < 0.7 || s.clear > 0.4) continue;
      const edge = 1 - Math.abs(s.f - 0.45) * 1.6; // forest edges
      if (a > 0.2 + edge * 0.5) continue;
      const v = Math.floor(b * shrubVariants);
      const sc = 0.6 + c * 0.45;
      L(`shrub${v}`).push(x, s.h - 0.05, z, a * 40, sc, 0, tmpC.setRGB(0.92 + c * 0.1, 1, 0.9));
      if (c < 0.6 && !collected.has(id)) {
        const berry = eco.shrub;
        const bi = L(`berries_${berry}${v}`).push(x, s.h - 0.05, z, a * 40, sc);
        addGather('berries', `berries_${berry}${v}`, bi, x, s.h + 0.6, z, berry, 3 + Math.floor(c * 4), `Pick ${ITEMS[berry].name.toLowerCase()}`, { id, radius: 2.2 });
      }
    }
    // herbs & flowers
    for (const [x, z, a, b, c] of rnd(Math.round(14 * (eco.flowers + 0.4)))) {
      const id = `${chunk.key}:hb:${serial++}`; const s = site(x, z);
      if (s.above < 0.3 || s.clear > 0.5) continue;
      const herb = eco.herbs[Math.floor(b * eco.herbs.length)];
      let ok = false;
      if (herb === 'nettle') ok = a < 0.25 + s.m * 0.5 + s.river * 0.5;
      else if (herb === 'celandine') ok = a < s.m * 0.55 * (0.3 + s.f);
      else ok = a < (1 - s.f) * 0.55 * eco.flowers;
      if (!ok) continue;
      const v = Math.floor(c * (KIND_INFO[herb]?.variants || 1));
      const gatherable = c < 0.55 && !collected.has(id);
      const li = L(`${herb}${v}`).push(x, s.h - 0.02, z, a * 40, herb === 'nettle' ? 1.1 + c * 0.6 : 1.0 + c * 0.6);
      if (gatherable) addGather('herb', `${herb}${v}`, li, x, s.h + 0.2, z, herb, herb === 'nettle' ? 2 : 1, herb === 'nettle' ? 'Cut nettles (wear gloves)' : `Pick ${ITEMS[herb].name.toLowerCase()}`, { id, bonus: herb === 'nettle' ? { fibre: 1 } : null });
    }
    // clay banks (wetland rivers)
    if (eco.clay) for (const [x, z, a, b, c] of rnd(3)) {
      const id = `${chunk.key}:cl:${serial++}`; const s = site(x, z);
      if (s.above < 0.05 || s.above > 0.8 || collected.has(id)) continue;
      const li = L('pebble0').push(x, s.h - 0.05, z, b * 6.28, 3.5, 0, tmpC.setRGB(0.55, 0.52, 0.5));
      addGather('clay', 'pebble0', li, x, s.h + 0.1, z, 'clay', 2, 'Dig river clay', { id });
    }

    for (const [kind, l] of lists) if (l.count) veg.set(kind, { built: l.build(), tree: l.tree });
    return { veg, interactables, colliders };
  };
}

// ---------------------------------------------------------------- grass field following the player
export class GrassField {
  constructor(world, pools, quality) {
    this.world = world; this.pools = pools; this.q = quality;
    this.tile = 12; this.tiles = new Map(); this.center = null;
  }
  update(pos) {
    const T = this.tile, R = Math.ceil(this.q.grassRadius / T);
    const cx = Math.floor(pos.x / T), cz = Math.floor(pos.z / T);
    if (this.center && this.center[0] === cx && this.center[1] === cz) return;
    this.center = [cx, cz];
    const want = new Set();
    let budget = 6;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      const k = `g${cx + dx},${cz + dz}`; want.add(k);
      if (!this.tiles.has(k)) this.build(k, cx + dx, cz + dz);
    }
    for (const k of [...this.tiles.keys()]) if (!want.has(k)) { this.pools.removeOwner(k); this.tiles.delete(k); }
  }
  build(k, tx, tz) {
    const gen = this.world.gen, eco = this.world.eco, water = gen.p.water, T = this.tile;
    const l0 = new InstanceList(), l1 = new InstanceList();
    const density = this.q.grassDensity * (eco.grass ?? 1);
    const n = Math.round(T * T * density);
    const c = new THREE.Color();
    const snow = gen.p.snowLine;
    for (let i = 0; i < n; i++) {
      const x = tx * T + hash2(tx * 131 + i, tz * 71, 11) * T, z = tz * T + hash2(tx * 37, tz * 113 + i, 23) * T;
      if (this.world.grassBlocked && this.world.grassBlocked(x, z)) continue;
      const s = gen.sample(x, z);
      const above = s.h - water;
      if (above < 0.35 || s.h > snow - 6) continue;
      const hx = gen.height(x + 0.8, z), hz = gen.height(x, z + 0.8);
      const slope = Math.hypot(hx - s.h, hz - s.h) / 0.8;
      const keep = (1 - s.forest * 0.75) * (1 - smoothstep(0.45, 0.8, slope)) * (1 - s.clear * (this.world.grassInClearings ? 0.2 : 0.85)) * smoothstep(0.35, 1.0, above);
      const r = hash2(i, tx * 17 + tz, 5);
      if (r > keep) continue;
      const dry = this.world.dryGrass ?? 0;
      c.setRGB(1, 1, 1).lerp(new THREE.Color(1.35, 1.15, 0.7), dry * (0.4 + 0.6 * (1 - s.moist)));
      c.offsetHSL((r - 0.5) * 0.04, 0, (hash2(i, 3, 7) - 0.5) * 0.12);
      const sc = 0.75 + r * 0.6 + s.moist * 0.3;
      (i & 1 ? l1 : l0).push(x, s.h - 0.03, z, r * 31, sc, 0, c);
    }
    this.pools.set('grass0', k, l0.build()); this.pools.set('grass1', k, l1.build());
    this.tiles.set(k, true);
  }
  clear() { for (const k of this.tiles.keys()) this.pools.removeOwner(k); this.tiles.clear(); this.center = null; }
}
