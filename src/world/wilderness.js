// One expedition's temporary wilderness. Built from a scenario roll; points of interest are sited
// on suitable ground (hilltops for standing stones, crags for the grotto, dry flats for settlements).
import * as THREE from 'three';
import { World } from './world.js';
import { Builder, M, cabin, ruinWalls, stall, well, lanternPost, prop, rockMesh, cloth } from './structures.js';
import { campfire, chimneySmoke, fireflies, sparkle } from './effects.js';
import { InstanceList } from './pools.js';
import { RNG } from '../core/rng.js';
import { generateArtifact } from '../game/items.js';
import { buildArtifactMesh } from '../game/artifacts3d.js';
import { Wildlife } from './wildlife.js';
import { Ambience } from './critters.js';

const LABEL = { hamlet: (n) => n, ruins: (n) => `Ruins of ${n}`, stones: (n) => `The ${n} Stones`, grotto: (n) => `${n} Grotto`, cabin: (n) => `${n} Cabin`, find: () => 'Something glinting' };
const SPECIALTY_COLOR = { potters: 0x8a3b2a, smiths: 0x2f3e52, carvers: 0x5a6b2e, weavers: 0x6b3f72 };

export class Wilderness extends World {
  constructor(game, exp) {
    super(game, { seed: `exp-${exp.seed}`, terrain: exp.terrain, layers: exp.layers, extraMode: exp.extraMode, eco: exp.eco, autumn: exp.autumn, dryGrass: exp.scenario === 'heath' ? 0.6 : exp.autumn * 0.5, collected: [] });
    this.kind = 'wild'; this.exp = exp;
    this.rng = new RNG(exp.seed ^ 0xabc);
  }

  slope(x, z) { const g = this.gen, h = g.baseHeight(x, z); return Math.hypot(g.baseHeight(x + 2, z) - h, g.baseHeight(x, z + 2) - h) / 2; }

  findSite(cx, cz, { radius = 40, minAbove = 1.8, maxSlope = 0.18, prefer = 'flat', tries = 70 } = {}) {
    const g = this.gen, w = g.p.water;
    let best = null, bestScore = -1e9;
    for (let i = 0; i < tries; i++) {
      const a = i * 2.39996, r = radius * Math.sqrt(i / tries);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = g.baseHeight(x, z); if (h - w < minAbove) continue;
      const s = this.slope(x, z);
      let score = -s * 20 - r * 0.02;
      if (prefer === 'high') score += h * 0.25;
      if (prefer === 'crag') score += (s > 0.25 && s < 0.7 ? 6 : 0) + h * 0.1;
      if (prefer !== 'crag' && s > maxSlope) score -= 50;
      if (score > bestScore) { bestScore = score; best = { x, z, h }; }
    }
    return best;
  }

  async build() {
    const exp = this.exp, g = this.gen;
    // trailhead camp
    const t = this.findSite(0, 0, { radius: 120, minAbove: 2.0, maxSlope: 0.12, tries: 160 }) || { x: 0, z: 0, h: g.p.water + 2 };
    this.trail = new THREE.Vector3(t.x, 0, t.z);
    g.addZone(t.x, t.z, 7, 12, { clear: 1, h: Math.max(t.h, g.p.water + 1.8) });
    // POIs
    const sites = [];
    for (const p of exp.pois) {
      const cx = t.x + Math.cos(p.angle) * p.dist, cz = t.z + Math.sin(p.angle) * p.dist;
      const prefer = p.type === 'stones' ? 'high' : p.type === 'grotto' ? 'crag' : 'flat';
      const s = this.findSite(cx, cz, { radius: 60, prefer, maxSlope: p.type === 'hamlet' ? 0.1 : 0.2 });
      if (!s) continue;
      const r = { hamlet: 20, ruins: 9, stones: 8, grotto: 6, cabin: 7, find: 0 }[p.type];
      if (r) g.addZone(s.x, s.z, r, 14, { clear: p.type === 'grotto' ? 0.6 : 1 });
      sites.push({ ...p, x: s.x, z: s.z });
    }
    this.initStreaming();
    this.spawn = { x: t.x + 2.5, z: t.z + 2.5, yaw: Math.atan2(-(sites[0]?.x ?? 1) + t.x, -(sites[0]?.z ?? 1) + t.z) };
    this.buildCamp();
    for (const s of sites) this.buildPOI(s);
    // wildlife & ambience
    this.wildlife = new Wildlife(this.scene, this, { foxes: exp.foxes });
    await this.wildlife.init();
    this.ambience = new Ambience(this.game, this);
    if (exp.eco.fireflies) this.emitters.add(fireflies(this.trail, 60, 90, (x, z) => this.heightAt(x, z)));
  }

  buildCamp() {
    const p = this.trail, h = this.heightAt(p.x, p.z);
    const fire = campfire(new THREE.Vector3(p.x, h, p.z)); this.emitters.add(fire);
    const ring = new InstanceList(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; ring.push(p.x + Math.cos(a) * 0.62, h, p.z + Math.sin(a) * 0.62, a * 3, 2.4); }
    this.game.pools.set('pebble0', 'camp', ring.build());
    const b = new Builder();
    // bedroll & pack
    b.box(cloth(0x5b4a3a), 0.8, 0.12, 2.0, 1.9, 0.06, -0.4, { ry: 0.3 });
    b.box(cloth(0x3f4a3a), 0.82, 0.2, 0.5, 1.6, 0.1, -1.3, { ry: 0.3 });
    b.cyl(M.logs, 0.18, 0.18, 1.6, -1.6, 0.18, 0.6, { rz: Math.PI / 2, ry: 0.8 });
    // waymarker with a lantern: the way home
    b.cyl(M.darkwood, 0.07, 0.06, 1.8, -1.2, 0.9, -1.4);
    b.box(M.glow, 0.18, 0.24, 0.18, -1.2, 1.9, -1.4);
    const grp = b.finish('camp'); grp.position.set(p.x, h, p.z); this.add(grp);
    this.addColliders([{ x: 0, z: 0, r: 0.8 }, { x: -1.6, z: 0.6, r: 0.4 }], p.x, p.z);
    this.addStatic({ type: 'camp', pos: new THREE.Vector3(p.x, h + 1, p.z), radius: 2.5, label: 'Rest by the campfire' });
    this.pois.push({ type: 'camp', name: 'Camp', pos: new THREE.Vector3(p.x, h, p.z), discovered: true, known: true, radius: 10 });
  }

  buildPOI(s) {
    const rng = new RNG(s.seed);
    const h = this.heightAt(s.x, s.z);
    const name = s.name ? LABEL[s.type](s.name) : LABEL.find();
    const poi = { type: s.type, name, pos: new THREE.Vector3(s.x, h, s.z), discovered: false, known: s === this.exp.pois.find((q) => q.type !== 'find') || false, radius: { hamlet: 30, ruins: 16, stones: 14, grotto: 12, cabin: 12, find: 4 }[s.type], seed: s.seed, specialty: s.specialty };
    poi.known = this.exp.pois.filter((q) => q.type !== 'find')[0]?.seed === s.seed;
    this.pois.push(poi);
    const ctx = { expedition: this.exp.no, region: this.exp.name, scenario: this.exp.title, place: s.name ? LABEL[s.type](s.name) : null, specialty: s.specialty };
    const b = new Builder();
    const placeArtifact = (lx, lz, y, source, label) => {
      const art = generateArtifact(s.seed ^ 0x77, { ...ctx, source });
      const m = buildArtifactMesh(art);
      const wx = s.x + lx, wz = s.z + lz;
      m.position.set(wx, (y ?? this.heightAt(wx, wz)), wz); m.rotation.y = rng.next() * 6;
      this.add(m);
      this.addStatic({ type: 'artifact', artifact: art, mesh: m, pos: m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), radius: 1.8, label: label || `Examine the ${art.name.toLowerCase()}`, poi });
    };
    switch (s.type) {
      case 'hamlet': {
        const style = rng.pick([{ wall: M.plaster, roof: M.tiles }, { wall: M.logs, roof: M.thatch }, { wall: M.grey, roof: M.thatch }, { wall: M.planks, roof: M.tiles }]);
        const n = rng.int(3, 4);
        const chimneys = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3), r = rng.range(11, 14);
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          const c = cabin(b, { x, z, ry: Math.atan2(-x, -z), w: rng.range(5.5, 7.5), d: rng.range(4.5, 5.5), wall: style.wall, roof: style.roof, windows: [1.6, -1.6] });
          if (c.chimney) chimneys.push(c.chimney);
        }
        stall(b, 0, -3, SPECIALTY_COLOR[s.specialty] || 0x7a5a3a);
        well(b, 4.5, 3.5);
        lanternPost(b, -4, 2); lanternPost(b, 3, -6);
        const grp = b.finish('hamlet'); grp.position.set(s.x, h, s.z); this.add(grp);
        this.addColliders(b.colliders, s.x, s.z);
        for (const c of chimneys) this.emitters.add(chimneySmoke(new THREE.Vector3(c.x + s.x, c.y + h, c.z + s.z), 1));
        // goods on the stall table
        for (let i = 0; i < 4; i++) { const v = prop(['ceramic_vase_01', 'antique_ceramic_vase_01', 'wooden_bucket_01', 'brass_vase_01'][i]); v.position.set(s.x - 1 + i * 0.65, h + 1.0, s.z - 2.55); v.scale.setScalar(i === 3 ? 0.6 : 0.85); this.add(v); }
        const crate = prop('wooden_crate_01'); crate.position.set(s.x + 1.9, h, s.z - 2.3); this.add(crate);
        this.addStatic({ type: 'trade', pos: new THREE.Vector3(s.x, h + 1, s.z - 1.6), radius: 2.6, label: `Trade at the ${s.specialty}' stall`, poi, offers: this.tradeOffers(s, ctx) });
        break;
      }
      case 'ruins': {
        ruinWalls(b, s.seed, 9);
        const grp = b.finish('ruins'); const ry = rng.range(0, 6.28); grp.rotation.y = ry; grp.position.set(s.x, h, s.z); this.add(grp);
        const cs = Math.cos(ry), sn = Math.sin(ry);
        for (const c of b.colliders) this.colliders.add({ ...c, x: s.x + c.x * cs + c.z * sn, z: s.z - c.x * sn + c.z * cs });
        const chest = prop('wooden_crate_01'); chest.position.set(s.x - 1.5, h + 0.05, s.z + 0.8); chest.rotation.y = ry + 0.3; this.add(chest);
        placeArtifact(-1.5, 0.8, h + 0.42, 'ruins');
        for (let i = 0; i < 4; i++) { const m = rockMesh('rockset0', 0.6 + rng.next() * 0.3, rng.next() * 6); const a = rng.next() * 6.28; m.position.set(s.x + Math.cos(a) * 8, h - 0.3, s.z + Math.sin(a) * 8); this.add(m); }
        break;
      }
      case 'stones': {
        const n = rng.int(7, 10), R = rng.range(5, 6.5);
        for (let i = 0; i < n; i++) {
          if (rng.chance(0.12)) continue; // a fallen gap
          const a = (i / n) * Math.PI * 2;
          const x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
          const m = rockMesh('boulder0', 1, a + Math.PI / 2);
          m.scale.set(rng.range(0.45, 0.6), rng.range(2.0, 2.8), rng.range(0.35, 0.45));
          m.position.set(x, this.heightAt(x, z) - 0.3, z); m.rotation.z = rng.range(-0.08, 0.08);
          this.add(m); this.colliders.add({ x, z, r: 0.55 });
        }
        const altar = rockMesh('boulder0', 1, rng.next() * 6); altar.scale.set(0.9, 0.42, 0.7); altar.position.set(s.x, h - 0.2, s.z); this.add(altar);
        this.colliders.add({ x: s.x, z: s.z, r: 0.9 });
        placeArtifact(0, 0, h + 0.33, 'stones', 'Examine the offering on the altar');
        break;
      }
      case 'grotto': {
        const ry = rng.range(0, 6.28);
        const ring = [[-2.6, 0, 1.0], [-2.0, 2.2, 1.1], [0, 3.0, 1.25], [2.0, 2.2, 1.1], [2.6, 0, 1.0]];
        const cs = Math.cos(ry), sn = Math.sin(ry);
        const W = (lx, lz) => [s.x + lx * cs + lz * sn, s.z - lx * sn + lz * cs];
        for (const [lx, lz, sc] of ring) { const [x, z] = W(lx, lz); const m = rockMesh('boulder0', sc * 1.9, rng.next() * 6, 1.4); m.position.set(x, this.heightAt(x, z) - 0.5, z); this.add(m); this.colliders.add({ x, z, r: 1.5 * sc }); }
        const [rx, rz] = W(0, 1.2); const roof = rockMesh('boulder0', 3.8, ry, 0.45); roof.position.set(rx, h + 1.9, rz); this.add(roof);
        // crystals inside
        for (let i = 0; i < 5; i++) {
          const kind = rng.pick(['crystal_amethyst', 'crystal_quartz', 'crystal_quartz']);
          const [x, z] = W(rng.range(-1.4, 1.4), rng.range(0.6, 2.2));
          const geo = this.game.pools.kinds.get(kind).parts[0];
          const m = new THREE.Mesh(geo.geometry, geo.material); m.position.set(x, this.heightAt(x, z), z); m.scale.setScalar(rng.range(1.3, 2.2)); m.rotation.y = rng.next() * 6; this.add(m);
          if (i < 3) this.addStatic({ type: 'gather', item: kind.split('_')[1], qty: kind === 'crystal_amethyst' ? 2 : 3, mesh: m, pos: m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), radius: 1.4, label: `Chip out ${kind === 'crystal_amethyst' ? 'amethyst' : 'quartz'}` });
        }
        const glow = new THREE.PointLight(0x9a7aff, 2.5, 7, 1.5); const [gx, gz] = W(0, 1.5); glow.position.set(gx, h + 1, gz); this.add(glow);
        const [ax, az] = W(0.4, 1.8); placeArtifact(ax - s.x, az - s.z, this.heightAt(ax, az), 'grotto');
        break;
      }
      case 'cabin': {
        const c = cabin(b, { x: 0, z: 0, ry: 0, w: 5, d: 4.2, wall: M.grey, roof: M.thatch, brokenRoof: rng.chance(0.6), chimney: true, windows: [1.4] });
        b.box(M.grey, 2.2, 0.1, 1.4, 0, 0.35, 2.8); // porch
        const grp = b.finish('cabin'); const ry = rng.range(0, 6.28); grp.rotation.y = ry; grp.position.set(s.x, h, s.z); this.add(grp);
        const cs = Math.cos(ry), sn = Math.sin(ry);
        for (const col of b.colliders) this.colliders.add({ ...col, x: s.x + col.x * cs + col.z * sn, z: s.z - col.x * sn + col.z * cs, rot: (col.rot || 0) - ry });
        const lx = 0.6, lz = 2.9;
        placeArtifact(lx * cs + lz * sn, -lx * sn + lz * cs, h + 0.42, 'cabin');
        const bucket = prop('wooden_bucket_01'); bucket.position.set(s.x + (-0.8) * cs + 2.7 * sn, h + 0.4, s.z - (-0.8) * sn + 2.7 * cs); this.add(bucket);
        break;
      }
      case 'find': {
        const wx = s.x, wz = s.z;
        this.emitters.add(sparkle(new THREE.Vector3(wx, this.heightAt(wx, wz) + 0.25, wz)));
        placeArtifact(0, 0, this.heightAt(wx, wz) + 0.02, 'find', 'Pick up the glinting object');
        break;
      }
    }
  }

  tradeOffers(s, ctx) {
    const rng = new RNG(s.seed ^ 0x3131);
    const T = {
      potters: [{ give: { cat: 'fish', qty: 3 }, get: { clay: 3 } }, { give: { cat: 'forage', qty: 5 }, get: { copper: 1 } }],
      smiths: [{ give: { item: 'wood', qty: 5 }, get: { copper: 2 } }, { give: { item: 'stone', qty: 4 }, get: { iron: 2 } }],
      carvers: [{ give: { item: 'wood', qty: 4 }, get: { fibre: 3 } }, { give: { cat: 'fish', qty: 2 }, get: { pelt: 1 } }],
      weavers: [{ give: { item: 'v:nettle', qty: 3 }, get: { fibre: 4 } }, { give: { cat: 'forage', qty: 4 }, get: { pelt: 1 } }],
    }[s.specialty] || [];
    const art = generateArtifact(s.seed ^ 0x5151, { ...ctx, source: 'trade' });
    const uniqueGive = rng.pick([{ cat: 'fish', qty: 4 }, { cat: 'forage', qty: 6 }, { cat: 'mineral', qty: 2 }, { cat: 'game', qty: 2 }]); // forage must be identified & checked
    return [...T.map((o) => ({ ...o })), { give: uniqueGive, artifact: art, once: true }];
  }

  update(dt, ctx) {
    super.update(dt, ctx);
    this.wildlife?.update(dt, ctx.player, ctx);
    // discovery
    const p = ctx.player.pos;
    for (const poi of this.pois) {
      if (poi.discovered) continue;
      if (poi.pos.distanceTo(p) < poi.radius + (poi.type === 'find' ? 2 : 10)) { poi.discovered = true; ctx.onDiscover && ctx.onDiscover(poi); }
    }
  }

  dispose() { this.wildlife?.dispose(); super.dispose(); }
}
