// Ecological scatter. For each chunk, candidate points are tested against the local habitat
// (height above water, slope, moisture, forest density, clearings) so species appear where they
// plausibly would: ferns and fungi in damp woods, pines on dry heights, nettles near water...
import * as THREE from 'three';
import { hash2, RNG, smoothstep } from '../core/rng.js';
import { InstanceList } from './pools.js';
import { KIND_INFO } from './vegetation.js';
import { ITEMS } from '../game/items.js';
import { MUSHROOMS, PLANTS } from '../data/species.js';
import { populateTrails, trailsFor } from './trails.js';

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
      interactables.push({ id: extra.id, type: 'gather', poolKey, owner: chunk.key, index: idx, pos: new THREE.Vector3(x, y, z), item, qty, label, radius: extra.radius ?? 1.8, bonus: extra.bonus, bonusChance: extra.bonusChance, chunk });
    };

    const woodHosts = []; // broadleaf trunks, stumps and logs where wood-rotting fungi can grow
    // expeditions blend from the village woods (home ecology) into the destination's ecology
    const homeEco = world.homeEco || null;
    // ecology changes over a shorter stretch than the land itself, so a canyon rim is not lined with home woods
    const ecoAt = (s, r) => (homeEco && r >= smoothstep(0.25, 0.6, s.biome) ? homeEco : eco);
    const regionOf = (s, r) => ecoAt(s, r).region || 'temperate';
    const wind = new THREE.Vector2(world.gen.dir?.x ?? 0, world.gen.dir?.z ?? -1); // sea winds blow inland
    // ---------------------------------------------------------------- trees
    const cell = 3.4;
    for (let gx = 0; gx < S / cell; gx++) for (let gz = 0; gz < S / cell; gz++) {
      const id = serial++;
      const x = x0 + (gx + rng.next()) * cell, z = z0 + (gz + rng.next()) * cell;
      const r1 = rng.next(), r2 = rng.next(), r3 = rng.next(), r4 = rng.next(), r5 = rng.next();
      const s = gen.sample(x, z);
      if (s.clear > 0.35 || s.road > 0.05) continue;
      const h = s.h, above = h - water;
      if (above < 0.5) continue;
      const E = ecoAt(s, r5);
      const f = s.forest, m = s.moist;
      const T = E.trees;
      // riverside trees (cottonwoods along a desert river, palms along tropical shores)
      const riverside = T && (T.cottonwood || T.palm) ? Math.min(1, s.river * 3 + (s.valley > 0.85 ? 0.5 : 0)) * smoothstep(5, 1.2, above) : 0;
      const beachPalm = T?.palm && s.beach > 0.2 ? 0.25 : 0;
      const pTree = (f * E.treeDensity * cell * cell) + 0.008 + riverside * 0.35 + beachPalm;
      if (r1 < pTree) {
        const slope = slopeAt(x, z, h);
        if (slope > 0.5) continue;
        if (s.beach > 0.55 && !T?.palm) continue;
        // species choice by habitat
        const high = smoothstep(gen.p.treeLine - 35, gen.p.treeLine, h);
        const W = [];
        if (T) {
          if (T.conifer) W.push(['conifer', T.conifer * (1 + high * 2 + (0.5 - m))]);
          if (T.broad) W.push(['broad', T.broad * (0.6 + m) * (1 - s.beach)]);
          if (T.snag) W.push(['snag', T.snag]);
          if (T.palm) W.push(['palm', T.palm * (0.4 + s.beach * 3 + riverside * 2 + smoothstep(8, 2, above))]);
          if (T.treefern) W.push(['treefern', T.treefern * m * (0.3 + f)]);
          if (T.juniper) W.push(['juniper', T.juniper * (1 - riverside)]);
          if (T.pinyon) W.push(['pinyon', T.pinyon * (1 - riverside) * (above > 20 ? 1.5 : 0.6)]);
          if (T.cottonwood) W.push(['cottonwood', T.cottonwood * riverside * 6 + 0.001]);
        } else {
          W.push(['snag', E.snag * (1 + m * 0.5 + high)], ['conifer', E.conifer * (1 + high * 2 + (0.5 - m))], ['broad', E.broad * (1 - high) * (0.6 + m)]);
        }
        let tot = 0; for (const w of W) tot += w[1]; let pick = r2 * tot, base = W[W.length - 1][0];
        for (const [k, w] of W) { if ((pick -= w) < 0) { base = k; break; } }
        const VAR = { conifer: 4, broad: 3, snag: 2, palm: 3, treefern: 2, juniper: 3, pinyon: 2, cottonwood: 3 };
        const kind = `${base === 'cottonwood' ? 'broad' : base}${Math.floor(r3 * VAR[base])}`;
        let sc = 0.7 + r4 * 0.6 - high * 0.25, tilt = (r3 - 0.5) * 0.06, ry = r2 * 6.283, sy = null;
        if (E.windswept && (base === 'conifer' || base === 'broad')) { // bent away from the sea
          const exposure = smoothstep(150, 360, (x - gen.start.x) * wind.x + (z - gen.start.z) * wind.y);
          if (exposure > 0) { ry = Math.atan2(-wind.x, -wind.y) + (r4 - 0.5) * 0.6; tilt = 0.06 + exposure * 0.14; sy = sc * (1 - exposure * 0.35); }
        }
        if (base === 'cottonwood') sc *= 1.25;
        let col = null;
        if (base !== 'snag') {
          if (base === 'broad' || base === 'cottonwood') {
            tmpC.setRGB(0.95, 1.0, 0.92).offsetHSL((r4 - 0.5) * 0.06, 0, (r3 - 0.5) * 0.15);
            if (base === 'cottonwood') tmpC.setRGB(1.08, 1.06, 0.74);
            if (E.lush) tmpC.setRGB(0.8, 1.05, 0.78).offsetHSL((r4 - 0.5) * 0.05, 0.05, (r3 - 0.5) * 0.12);
            if (autumn > 0 && r3 < autumn && E === eco) tmpC.lerp(new THREE.Color().setHSL(0.06 + r2 * 0.08, 0.75, 0.55), 0.45 + r4 * 0.5);
          } else if (base === 'conifer') tmpC.setRGB(0.88, 0.96, 0.9).offsetHSL((r4 - 0.5) * 0.05, 0, (r3 - 0.5) * 0.12 - high * 0.08);
          else tmpC.setRGB(1, 1, 1).offsetHSL((r4 - 0.5) * 0.04, 0, (r3 - 0.5) * 0.12);
          col = tmpC;
        }
        L(kind, true).push(x, h - 0.15, z, ry, sc, tilt, col, sy);
        if (base === 'palm' && r5 < 0.35) { const fid = `${chunk.key}:fr:${id}`; if (!collected.has(fid)) addGather('fronds', null, -1, x, h + 0.6, z, 'frond', 3, 'Cut palm fronds', { id: fid, radius: 2.2 }); }
        if (base === 'broad' || base === 'snag' || base === 'cottonwood') woodHosts.push({ x, z, h, r: (KIND_INFO[kind].radius || 0.3) * sc, tree: base !== 'snag', snag: base === 'snag' });
        colliders.push({ x, z, r: (KIND_INFO[kind].radius || 0.3) * sc + 0.05 });
        continue;
      }
      // forest floor & understory
      if (r1 < pTree + 0.14 * f * E.fern * (0.4 + m) && above > 0.8) {
        if (E.bananas && r4 < 0.18 && m > 0.6) { L(`banana${Math.floor(r3 * 2)}`, true).push(x, h - 0.05, z, r2 * 6.28, 0.8 + r4 * 0.5); colliders.push({ x, z, r: 0.35 }); continue; }
        const v = Math.floor(r3 * (KIND_INFO.fern?.variants || 1));
        L(`fern${v}`).push(x, h - 0.05, z, r2 * 6.28, (0.7 + r4 * 0.6) * (E.lush ? 1.5 : 1), 0, tmpC.setRGB(0.9 + r4 * 0.15, 1, 0.9));
        continue;
      }
      // dry-country and shore plants
      if (E !== homeEco && r1 < pTree + 0.06) {
        if (E.yucca && m < 0.45 && slopeAt(x, z, h) < 0.35 && r4 < 0.45) { L(`yucca${Math.floor(r3 * 2)}`).push(x, h - 0.03, z, r2 * 6.28, 0.8 + r4 * 0.7); continue; }
        if (E.sage && m < 0.5 && r4 < 0.9) { L(`sage${Math.floor(r3 * (KIND_INFO.sage?.variants || 1))}`).push(x, h - 0.05, z, r2 * 6.28, 0.6 + r4 * 0.6, 0, tmpC.setRGB(0.82 + r4 * 0.1, 0.9, 0.82)); continue; }
        if (E.marram && (s.beach > 0.2 || r4 < 0.2)) { for (let k = 0; k < 3; k++) { const px = x + (rng.next() - 0.5) * 2.5, pz = z + (rng.next() - 0.5) * 2.5; L(`marram${k & 1}`).push(px, gen.height(px, pz) - 0.04, pz, rng.next() * 6.28, 0.8 + rng.next() * 0.6, 0, tmpC.setRGB(0.66, 0.68, 0.5).offsetHSL(0, 0, (rng.next() - 0.5) * 0.08)); } continue; }
      }
    }

    // ---------------------------------------------------------------- scattered features (random points)
    const rnd = (n) => Array.from({ length: n }, () => [x0 + rng.next() * S, z0 + rng.next() * S, rng.next(), rng.next(), rng.next()]);
    const site = (x, z) => { const s = gen.sample(x, z); return { h: s.h, f: s.forest, m: s.moist, c: s.conifer, clear: s.clear, river: s.river, pond: s.pond, stream: s.stream, above: s.h - water, biome: s.biome, beach: s.beach, cliff: s.cliff, road: s.road, valley: s.valley }; };

    // fallen logs (wood ×3)
    for (const [x, z, a, b, c] of rnd(Math.round(4 * eco.logs))) {
      const id = `${chunk.key}:log:${serial++}`; const s = site(x, z);
      if (s.above < 0.8 || s.f < 0.3 || s.clear > 0.3 || a > s.f) continue;
      if (collected.has(id)) continue;
      const li = L('log0').push(x, s.h - 0.06, z, b * 6.28, 1 + c * 0.4);
      addGather('log', 'log0', li, x, s.h + 0.3, z, 'wood', 3, 'Break up the fallen log', { id, radius: 2.6, bonusChance: { grub: [0.6, 1, 3] } });
      woodHosts.push({ x, z, h: s.h, r: 0.5, log: true });
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
    for (const [x, z, a, b, c] of rnd(3)) { const s = site(x, z); if (s.f > 0.3 && s.above > 1 && s.clear < 0.3) { L('stump0').push(x, s.h - 0.1, z, b * 6.28, 0.8 + c * 0.6); colliders.push({ x, z, r: 0.55 }); woodHosts.push({ x, z, h: s.h, r: 0.55 * (0.8 + c * 0.6), stump: true }); } }

    // boulders and rock sets — on slopes, rocky ground
    for (const [x, z, a, b, c] of rnd(Math.round(6 * eco.rocks))) {
      const s = site(x, z); if (s.above < -0.5 || s.clear > 0.4) continue;
      const slope = slopeAt(x, z, s.h);
      if (a > 0.25 + slope * 2) continue;
      if (b < 0.6) { const sc = 0.6 + c * 1.6; const red = regionOf(s, a) === 'canyon';
        if (red) { L('tintrock0').push(x, s.h - 0.25 * sc, z, b * 30, sc * 1.3, (a - 0.5) * 0.3, tmpC.setRGB(1.2, 0.78, 0.6));
          const id = `${chunk.key}:ss:${serial++}`; if (c < 0.55 && !collected.has(id)) addGather('sandstone', null, -1, x + 1.1 * sc, s.h + 0.3, z, 'sandstone', 2, 'Split sandstone slabs', { id, radius: 1.6 + sc }); }
        else L('boulder0').push(x, s.h - 0.25 * sc, z, b * 30, sc, (a - 0.5) * 0.3);
        colliders.push({ x, z, r: 0.85 * sc * (red ? 1.3 : 1) }); }
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
    // ---------------------------------------------------------------- fungi (real species, real habitats)
    const fungi = (eco.fungi ?? 1) * (1 + autumn * 0.8);
    const forage = (id, kindBase, x, y, z, ry, qty, extra = {}) => {
      const fid = `${chunk.key}:fg:${serial++}`;
      if (collected.has(fid)) return null;
      const v = rng.next() < 0.5 ? 0 : 1;
      const k = `${kindBase}${v}`;
      const li = L(k).push(x, y, z, ry, extra.scale || 1, extra.tilt || 0, null, null, extra.tiltZ || 0);
      const sp = MUSHROOMS[id] || PLANTS[id];
      interactables.push({ id: fid, type: 'forage', species: id, poolKey: k, owner: chunk.key, index: li, pos: new THREE.Vector3(x, y + 0.12, z), qty, radius: extra.radius ?? 1.7, chunk, mushroom: !!MUSHROOMS[id], label: sp.name });
      return li;
    };
    const groundW = (id, s) => {
      const f = s.f, m = s.m, c = s.c;
      switch (id) {
        case 'chanterelle': return f * (0.5 + m * 0.6) * 1.1;
        case 'false_chanterelle': return f * c * 0.8;
        case 'porcini': return f * 0.75;
        case 'bitter_bolete': return f * c * 0.6;
        case 'hedgehog': return f * 0.6;
        case 'death_cap': return f * (1 - c) * 0.6;
        case 'fly_agaric': return f * c * 0.7;
        case 'earthball': return f * (1 - c) * (1.1 - m) * 0.6;
        case 'giant_puffball': return (1 - f) * (m > 0.45 ? 0.35 : 0.1);
        case 'liberty_cap': return (1 - f) * m * 0.35;
        case 'parasol': return (1 - f) * 0.45 * (f > 0.05 ? 1.5 : 1);
        case 'shaggy_inkcap': return (1 - f) * 0.3 + s.clear * 0.6;
        case 'field_mushroom': return (1 - f) * (0.35 + m * 0.4) * (1 - s.beach * 0.6);
        case 'yellow_stainer': return (1 - f) * 0.25 + f * 0.1;
        case 'termite_mushroom': return (1 - f * 0.6) * 0.55;
        case 'green_spored_parasol': return (1 - f) * 0.5;
        case 'desert_shaggy_mane': return (1 - f) * (0.4 + s.river * 2);
      }
      return 0;
    };
    const TEMPERATE_FUNGI = ['chanterelle', 'false_chanterelle', 'porcini', 'bitter_bolete', 'hedgehog', 'death_cap', 'fly_agaric', 'earthball', 'giant_puffball', 'liberty_cap', 'parasol', 'shaggy_inkcap'];
    const FUNGI_BY_REGION = {
      temperate: TEMPERATE_FUNGI,
      coast: ['field_mushroom', 'yellow_stainer', 'field_mushroom', 'parasol', 'giant_puffball', 'shaggy_inkcap', 'liberty_cap', 'chanterelle', 'false_chanterelle', 'fly_agaric', 'death_cap'],
      tropics: ['termite_mushroom', 'green_spored_parasol', 'termite_mushroom'],
      canyon: ['desert_shaggy_mane'],
    };

    const qtyOf = (id) => ({ giant_puffball: 1, earthball: 2, liberty_cap: 6, chicken_of_the_woods: 2 }[id] || 2 + Math.floor(rng.next() * 3));
    const placeMush = (id, x, z, s) => forage(id, `mush_${id}`, x, s.h - 0.01, z, rng.next() * 6.28, qtyOf(id));
    for (const [x, z, a, rb] of rnd(Math.round(9 * fungi))) {
      const s = site(x, z);
      if (s.above < 0.5 || s.clear > 0.6 || s.road > 0.2) continue;
      if (slopeAt(x, z, s.h) > 0.35) continue;
      const GROUND = FUNGI_BY_REGION[regionOf(s, rb)] || TEMPERATE_FUNGI;
      if (rb < s.biome && (ecoAt(s, rb).fungi ?? 1) < 0.5 && a > (ecoAt(s, rb).fungi ?? 1)) continue;
      let tot = 0; const w = GROUND.map((id) => { const v = Math.max(0, groundW(id, s)) * (eco.fungiW?.[id] ?? 1); tot += v; return v; });
      if (a > Math.min(0.9, tot * 0.9)) continue;
      let r = rng.next() * tot, pick = GROUND[0];
      for (let i = 0; i < GROUND.length; i++) { r -= w[i]; if (r <= 0) { pick = GROUND[i]; break; } }
      placeMush(pick, x, z, s);
      if (pick === 'termite_mushroom') { L('mound0').push(x + 0.9, s.h - 0.2, z + 0.4, a * 6, 0.6 + a * 0.6); colliders.push({ x: x + 0.9, z: z + 0.4, r: 0.7 }); }
      // edible species often grow near a dangerous lookalike — compare before you pick
      const look = MUSHROOMS[pick].lookalikes?.filter((l) => GROUND.includes(l) && l !== pick);
      if (look && look.length && rng.next() < 0.4) {
        const la = rng.next() * 6.28, ld = 4 + rng.next() * 10, lx = x + Math.cos(la) * ld, lz = z + Math.sin(la) * ld;
        if (lx > x0 && lx < x0 + S && lz > z0 && lz < z0 + S) { const s2 = site(lx, lz); if (s2.above > 0.5 && s2.clear < 0.6) placeMush(look[Math.floor(rng.next() * look.length)], lx, lz, s2); }
      }
    }
    // wood-rotting fungi on stumps, logs and broadleaf trunks
    for (const host of woodHosts) {
      const p = rng.next();
      if (homeEco && eco.region === 'canyon' && gen.biomeT(host.x, host.z) > 0.5) continue;
      if (host.tree && !host.snag) {
        if (p < 0.035 * fungi) { const a = rng.next() * 6.28, hh = 0.6 + rng.next() * 1.2; forage('chicken_of_the_woods', 'mush_chicken_of_the_woods', host.x + Math.cos(a) * host.r * 0.9, host.h + hh, host.z + Math.sin(a) * host.r * 0.9, -a, 2, { radius: 2.2 }); }
        else if (p < 0.06 * fungi) { const a = rng.next() * 6.28; forage('jack_o_lantern', 'mush_jack_o_lantern', host.x + Math.cos(a) * (host.r + 0.12), host.h - 0.02, host.z + Math.sin(a) * (host.r + 0.12), a, 3); }
        continue;
      }
      if (p > 0.55 * fungi) continue;
      const id = rng.next() < 0.5 ? 'sulphur_tuft' : 'honey_fungus';
      const a = rng.next() * 6.28, off = host.log ? 0.35 : host.r * 0.85;
      forage(id, `mush_${id}`, host.x + Math.cos(a) * off, host.h + (host.stump ? 0.05 : 0.02), host.z + Math.sin(a) * off, a, 3);
    }

    // ---------------------------------------------------------------- berries & greens
    const flora = eco.flora ?? 1;
    const plantW = (id, s) => {
      const f = s.f, m = s.m, c = s.c, open = 1 - f, wetEdge = s.above < 1.8 || s.river > 0.05;
      switch (id) {
        case 'bilberry': return (f > 0.15 && f < 0.85) ? c * (1 - Math.abs(m - 0.5)) * 1.3 : 0.05;
        case 'lingonberry': return c > 0.45 && m < 0.55 ? (0.4 + f * 0.6) * 0.9 : 0;
        case 'cloudberry': return m > 0.72 && f < 0.45 ? 1.2 : 0;
        case 'raspberry': return f > 0.1 && f < 0.55 ? 0.9 : open * 0.15;
        case 'deadly_nightshade': return f > 0.15 && f < 0.6 && c < 0.55 ? 0.3 : 0;
        case 'bittersweet': return wetEdge && m > 0.55 ? 0.7 : 0;
        case 'ramsons': return f > 0.35 && m > 0.58 && c < 0.55 ? 1.1 : 0;
        case 'lily_of_the_valley': return f > 0.35 && m > 0.3 && m < 0.62 && c < 0.6 ? 0.45 : 0;
        case 'wood_sorrel': return f > 0.45 ? 0.6 : 0;
        case 'nettle': return (m > 0.55 && wetEdge ? 1.2 : 0) + s.clear * 0.6 + (m > 0.6 ? 0.2 : 0);
        case 'dandelion': return open > 0.6 ? 0.8 * (eco.flowers ?? 1) : 0;
        case 'celandine': return m > 0.6 && wetEdge ? 0.6 : 0;
        // coast
        case 'sea_beet': return (s.beach > 0.15 && s.beach < 0.8 ? 1.2 : 0) + (open > 0.7 && s.above < 4 ? 0.3 : 0);
        case 'marsh_samphire': return s.above < 1.2 && (s.beach > 0.3 || m > 0.7) ? 1.3 : 0;
        case 'sea_buckthorn': return s.beach > 0.25 && s.beach < 0.9 && open > 0.5 ? 0.9 : 0;
        case 'wild_celery': return m > 0.55 && (wetEdge || s.beach > 0.1) ? 0.8 : 0;
        case 'hemlock_water_dropwort': return wetEdge && m > 0.55 ? 0.7 : 0;
        case 'mussels': return s.above < 0.8 && (s.cliff > 0.15 || s.beach > 0.5) ? 1.4 : 0;
        // canyon
        case 'prickly_pear': return m < 0.45 && open > 0.6 ? 1.1 : 0.1;
        case 'juniper': return m < 0.5 ? 0.6 : 0;
        case 'pinyon': return s.above > 18 ? 0.7 : 0.1;
        case 'wild_onion': return m > 0.25 && open > 0.5 ? 0.8 : 0.2;
        case 'death_camas': return open > 0.5 ? 0.6 : 0.1;
        case 'datura': return (s.river > 0.02 || s.valley > 0.9 || s.above < 6) ? 0.9 : 0.15;
        // tropics
        case 'wild_banana': return m > 0.55 && f > 0.25 ? 1.0 : 0.1;
        case 'guava': return f > 0.15 && f < 0.7 ? 0.9 : 0.2;
        case 'coconut': return s.above < 4 && (s.beach > 0.1 || wetEdge) ? 1.2 : 0.05;
        case 'manchineel': return s.above < 3.5 && (s.beach > 0.1 || wetEdge) ? 0.6 : 0;
        case 'physic_nut': return open > 0.5 ? 0.7 : 0.15;
      }
      return 0;
    };
    const TEMPERATE_PLANTS = ['bilberry', 'lingonberry', 'cloudberry', 'raspberry', 'deadly_nightshade', 'bittersweet', 'ramsons', 'lily_of_the_valley', 'wood_sorrel', 'nettle', 'dandelion', 'celandine'];
    const PLANTS_BY_REGION = {
      temperate: TEMPERATE_PLANTS,
      coast: ['sea_beet', 'marsh_samphire', 'sea_buckthorn', 'wild_celery', 'hemlock_water_dropwort', 'mussels', 'raspberry', 'bittersweet', 'nettle', 'dandelion', 'bilberry', 'lingonberry', 'deadly_nightshade'],
      canyon: ['prickly_pear', 'juniper', 'pinyon', 'wild_onion', 'death_camas', 'datura'],
      tropics: ['wild_banana', 'guava', 'coconut', 'manchineel', 'physic_nut'],
    };
    const plantKind = (id) => (['nettle', 'dandelion', 'celandine'].includes(id) ? id : `plant_${id}`);
    const plantPatch = (id, x, z, s, gather = true) => {
      const kb = plantKind(id);
      const variants = KIND_INFO[kb]?.variants || KIND_INFO[id]?.variants || 2;
      const n = id === 'deadly_nightshade' ? 1 : 2 + Math.floor(rng.next() * 4);
      for (let i = 0; i < n; i++) {
        const a = rng.next() * 6.28, d = i ? 0.5 + rng.next() * 1.6 : 0;
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = gen.height(px, pz);
        const k = `${kb}${Math.floor(rng.next() * variants)}`;
        const sc = 0.8 + rng.next() * 0.4;
        if (i === 0 && gather) {
          const fid = `${chunk.key}:pl:${serial++}`;
          if (collected.has(fid)) continue;
          const li = L(k).push(px, h - 0.02, pz, rng.next() * 6.28, sc);
          const sp = PLANTS[id];
          interactables.push({ id: fid, type: 'forage', species: id, poolKey: k, owner: chunk.key, index: li, pos: new THREE.Vector3(px, h + 0.25, pz), qty: sp.kind === 'berry' ? 3 + Math.floor(rng.next() * 4) : 2 + Math.floor(rng.next() * 2), radius: 1.8, chunk, mushroom: false, label: sp.name });
        } else L(k).push(px, h - 0.02, pz, rng.next() * 6.28, sc * 0.9);
      }
    };
    for (const [x, z, a, rb] of rnd(Math.round(13 * flora))) {
      const s = site(x, z);
      if (s.clear > 0.7 || s.road > 0.2) continue;
      const PLANT_IDS = PLANTS_BY_REGION[regionOf(s, rb)] || TEMPERATE_PLANTS;
      if (s.above < (PLANT_IDS.includes('mussels') ? -0.2 : 0.25)) continue;
      let tot = 0; const w = PLANT_IDS.map((id) => { const v = Math.max(0, plantW(id, s)) * (eco.floraW?.[id] ?? 1); tot += v; return v; });
      if (a > Math.min(0.92, tot * 0.75)) continue;
      let r = rng.next() * tot, pick = PLANT_IDS[0];
      for (let i = 0; i < PLANT_IDS.length; i++) { r -= w[i]; if (r <= 0) { pick = PLANT_IDS[i]; break; } }
      plantPatch(pick, x, z, s);
      const look = PLANTS[pick].lookalikes?.filter((l) => PLANT_IDS.includes(l));
      if (look && look.length && rng.next() < 0.35) { const la = rng.next() * 6.28, ld = 3 + rng.next() * 8, lx = x + Math.cos(la) * ld, lz = z + Math.sin(la) * ld; if (lx > x0 && lx < x0 + S && lz > z0 && lz < z0 + S) { const s2 = site(lx, lz); if (s2.above > 0.25) plantPatch(look[0], lx, lz, s2); } }
    }
    // understory carpets (decorative): bilberry and lingonberry under conifers, wood sorrel in shade
    for (const [x, z, a, rb] of rnd(10)) {
      const s = site(x, z); if (s.above < 0.6 || s.clear > 0.4 || s.f < 0.3) continue;
      if (regionOf(s, rb) !== 'temperate') continue;
      const id = s.c > 0.55 ? (s.m < 0.45 ? 'lingonberry' : 'bilberry') : 'wood_sorrel';
      if (a < 0.7) for (let i = 0; i < 4; i++) { const px = x + (rng.next() - 0.5) * 4, pz = z + (rng.next() - 0.5) * 4; L(`plant_${id}${i & 1}`).push(px, gen.height(px, pz) - 0.02, pz, rng.next() * 6.28, 0.7 + rng.next() * 0.4); }
    }
    // decorative shrubs at forest edges
    const shrubVariants = KIND_INFO.shrub?.variants || 1;
    for (const [x, z, a, b, c] of rnd(4)) { const s = site(x, z); if (s.above < 0.7 || s.clear > 0.4) continue; if (regionOf(s, c) === 'canyon') continue; if (a > 0.25 + (1 - Math.abs(s.f - 0.45) * 1.6) * 0.5) continue; L(`shrub${Math.floor(b * shrubVariants)}`).push(x, s.h - 0.05, z, a * 40, 0.6 + c * 0.45, 0, tmpC.setRGB(0.92 + c * 0.1, 1, 0.9)); }

    // ---------------------------------------------------------------- water margins: reeds, lily pads, feathers
    const spots = [];
    for (const [x, z, a, b, c] of rnd(26)) {
      const depth = water - gen.height(x, z);
      if (depth < -0.3 || depth > 2.6) continue;
      const s = site(x, z);
      const still = s.river < 0.15;
      if (depth > -0.3 && depth < 0.7 && (still || s.stream > 0.2) && a < 0.75) {
        const n = 2 + Math.floor(b * 4);
        for (let i = 0; i < n; i++) { const px = x + (rng.next() - 0.5) * 3.5, pz = z + (rng.next() - 0.5) * 3.5; const d2 = water - gen.height(px, pz); if (d2 < -0.25 || d2 > 0.8) continue; L(`reeds${i & 1}`).push(px, Math.min(gen.height(px, pz), water) - 0.05, pz, rng.next() * 6.28, 0.8 + rng.next() * 0.5); }
        spots.push({ x, z, type: 'weeds' });
      } else if (still && depth > 0.5 && depth < 2.5 && (s.pond > 0.2 || (eco.lilies ?? 0.5) > rng.next())) {
        const n = 4 + Math.floor(b * 7);
        for (let i = 0; i < n; i++) { const px = x + (rng.next() - 0.5) * 5, pz = z + (rng.next() - 0.5) * 5; const d2 = water - gen.height(px, pz); if (d2 < 0.35) continue; L(`lilies${i % 3 === 0 ? 1 : 0}`).push(px, water + 0.012, pz, rng.next() * 6.28, 0.7 + rng.next() * 0.6); }
        spots.push({ x, z, type: 'lilies' });
      }
      if (depth < 0 && depth > -0.6 && c < 0.12) { // a moulted feather on the shore
        const fid = `${chunk.key}:fe:${serial++}`;
        if (!collected.has(fid)) { const li = L('feather0').push(x, gen.height(x, z) + 0.01, z, b * 6.28, 1); interactables.push({ id: fid, type: 'gather', poolKey: 'feather0', owner: chunk.key, index: li, pos: new THREE.Vector3(x, gen.height(x, z) + 0.1, z), item: 'feather', qty: 1, label: 'Pick up a feather', radius: 1.4, chunk }); }
      }
    }
    chunk.spots = spots;

    // the strand line: shells, wrack and driftwood where the tide reaches
    if (eco.driftwood) for (const [x, z, a, b, c] of rnd(22)) {
      const s = site(x, z); if (s.beach < 0.3 || s.above < 0.05 || s.above > 2.2) continue;
      if (a < 0.45) { L('wrack0').push(x, s.h + 0.005, z, b * 6.28, 0.8 + c * 0.6); continue; }
      if (a < 0.75) { const id = `${chunk.key}:sh:${serial++}`; if (collected.has(id)) continue; const li = L('shells0').push(x, s.h + 0.005, z, b * 6.28, 1); addGather('shells', 'shells0', li, x, s.h + 0.1, z, 'shell', 2, 'Pick up seashells', { id, radius: 1.5 }); continue; }
      if (a < 0.86) { const id = `${chunk.key}:dw:${serial++}`; if (collected.has(id)) continue; const li = L('drift0').push(x, s.h - 0.1, z, b * 6.28, 0.6 + c * 0.5, 0, tmpC.setRGB(0.85, 0.82, 0.78)); addGather('drift', 'drift0', li, x, s.h + 0.3, z, 'driftwood', 2, 'Gather driftwood', { id, radius: 2.4 }); }
      else if (c < 0.4) { const id = `${chunk.key}:sg:${serial++}`; if (collected.has(id)) continue; const li = L('shells0').push(x, s.h + 0.005, z, b * 6.28, 0.6); addGather('seaglass', 'shells0', li, x, s.h + 0.1, z, 'sea_glass', 1, 'Pick up sea glass', { id, radius: 1.4 }); }
    }

    // clay banks (wetland rivers)
    if (eco.clay) for (const [x, z, a, b, c] of rnd(3)) {
      const id = `${chunk.key}:cl:${serial++}`; const s = site(x, z);
      if (s.above < 0.05 || s.above > 0.8 || collected.has(id)) continue;
      const li = L('pebble0').push(x, s.h - 0.05, z, b * 6.28, 3.5, 0, tmpC.setRGB(0.55, 0.52, 0.5));
      addGather('clay', 'pebble0', li, x, s.h + 0.1, z, 'clay', 2, 'Dig river clay', { id });
    }

    const objects = world.kind === 'wild' ? populateTrails(world, chunk, L, interactables) : [];
    for (const [kind, l] of lists) if (l.count) veg.set(kind, { built: l.build(), tree: l.tree });
    return { veg, interactables, colliders, objects };
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
    // keep animal runs visible: no grass on trail segments crossing this tile
    const segs = [];
    if (this.world.kind === 'wild') { const cx = Math.floor(tx * T / 64), cz = Math.floor(tz * T / 64); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const tr of trailsFor(this.world, cx + dx, cz + dz)) for (let i = 0; i < tr.pts.length - 1; i++) { const [ax, az] = tr.pts[i], [bx, bz] = tr.pts[i + 1]; if (Math.max(ax, bx) < tx * T - 1 || Math.min(ax, bx) > tx * T + T + 1 || Math.max(az, bz) < tz * T - 1 || Math.min(az, bz) > tz * T + T + 1) continue; segs.push([ax, az, bx, bz]); } }
    const onTrail = (x, z) => { for (const [ax, az, bx, bz] of segs) { const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)); if (Math.hypot(ax + vx * t - x, az + vz * t - z) < 0.42) return true; } return false; };
    const homeEco = this.world.homeEco;
    const gMax = Math.max(eco.grass ?? 1, homeEco?.grass ?? 0);
    const density = this.q.grassDensity * gMax;
    const tintD = eco.grassTint ? new THREE.Color(...eco.grassTint) : null;
    const n = Math.round(T * T * density);
    const c = new THREE.Color();
    const snow = gen.p.snowLine;
    for (let i = 0; i < n; i++) {
      const x = tx * T + hash2(tx * 131 + i, tz * 71, 11) * T, z = tz * T + hash2(tx * 37, tz * 113 + i, 23) * T;
      if (this.world.grassBlocked && this.world.grassBlocked(x, z)) continue;
      if (segs.length && onTrail(x, z)) continue;
      const s = gen.sample(x, z);
      const above = s.h - water;
      if (above < 0.35 || s.h > snow - 6 || s.road > 0.35 || s.beach > 0.45) continue;
      const dest = !homeEco || hash2(i, tx * 5 + tz * 3, 41) < smoothstep(0.25, 0.6, s.biome);
      const E = dest ? eco : homeEco;
      const hx = gen.height(x + 0.8, z), hz = gen.height(x, z + 0.8);
      const slope = Math.hypot(hx - s.h, hz - s.h) / 0.8;
      const keep = ((E.grass ?? 1) / gMax) * (1 - s.beach) * (1 - s.forest * 0.75) * (1 - smoothstep(0.45, 0.8, slope)) * (1 - s.clear * (this.world.grassInClearings ? 0.2 : 0.85)) * smoothstep(0.35, 1.0, above);
      const r = hash2(i, tx * 17 + tz, 5);
      if (r > keep) continue;
      const dry = dest ? (this.world.dryGrass ?? 0) : 0;
      c.setRGB(1, 1, 1).lerp(new THREE.Color(1.35, 1.15, 0.7), dry * (0.4 + 0.6 * (1 - s.moist)));
      if (dest && tintD) c.multiply(tintD);
      c.offsetHSL((r - 0.5) * 0.04, 0, (hash2(i, 3, 7) - 0.5) * 0.12);
      const sc = 0.75 + r * 0.6 + s.moist * 0.3;
      (i & 1 ? l1 : l0).push(x, s.h - 0.03, z, r * 31, sc, 0, c);
    }
    this.pools.set('grass0', k, l0.build()); this.pools.set('grass1', k, l1.build());
    this.tiles.set(k, true);
  }
  clear() { for (const k of this.tiles.keys()) this.pools.removeOwner(k); this.tiles.clear(); this.center = null; }
}
