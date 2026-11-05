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
import { WorldGen, makeHomeGen, homeRoadCurve, HOME_R, ROAD_START } from './generator.js';
import { Village, HOME_LAYERS, HOME_ECO, filterYard } from './village.js';
import { buildRoadMesh, roadPoint } from './road.js';
import { Herds } from './herds.js';
import { Fauna } from './fauna.js';
import { Beasts } from './beasts.js';
import { smoothstep } from '../core/rng.js';
import { placeName } from './scenarios.js';

const LABEL = { hamlet: (n) => n, ruins: (n) => `Ruins of ${n}`, stones: (n) => `The ${n} Stones`, grotto: (n) => `${n} Grotto`, cabin: (n) => `${n} Cabin`, find: () => 'Something glinting', wreck: (n) => `Wreck at ${n}`, alcove: (n) => `${n} Cliff Dwellings`, carvings: (n) => `${n} Rock Carvings` };
function petroglyphTexture(seed) {
  const rng = new RNG(seed), c = document.createElement('canvas'); c.width = 512; c.height = 320; const k = c.getContext('2d');
  k.strokeStyle = 'rgba(232,214,190,0.85)'; k.fillStyle = 'rgba(232,214,190,0.85)'; k.lineWidth = 7; k.lineCap = 'round';
  const fig = (x, y, s) => { // a horned human figure
    k.beginPath(); k.moveTo(x, y - s); k.lineTo(x, y + s * 0.6); k.moveTo(x - s * 0.6, y - s * 0.3); k.lineTo(x + s * 0.6, y - s * 0.3); k.moveTo(x, y + s * 0.6); k.lineTo(x - s * 0.4, y + s * 1.3); k.moveTo(x, y + s * 0.6); k.lineTo(x + s * 0.4, y + s * 1.3);
    k.moveTo(x - s * 0.2, y - s * 1.2); k.lineTo(x - s * 0.45, y - s * 1.6); k.moveTo(x + s * 0.2, y - s * 1.2); k.lineTo(x + s * 0.45, y - s * 1.6); k.stroke(); k.beginPath(); k.arc(x, y - s * 1.1, s * 0.22, 0, 7); k.fill(); };
  const sheep = (x, y, s) => { k.beginPath(); k.ellipse(x, y, s, s * 0.45, 0, 0, 7); k.stroke(); for (const d of [-0.6, -0.2, 0.2, 0.6]) { k.beginPath(); k.moveTo(x + d * s, y + s * 0.4); k.lineTo(x + d * s, y + s * 1.0); k.stroke(); } k.beginPath(); k.arc(x + s * 1.1, y - s * 0.5, s * 0.45, 3.4, 6.0); k.stroke(); };
  const spiral = (x, y, s) => { k.beginPath(); for (let t = 0; t < 18; t += 0.2) { const r = t / 18 * s; k.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); } k.stroke(); };
  for (let i = 0; i < 9; i++) { const x = rng.range(40, 470), y = rng.range(60, 260), sz = rng.range(18, 34); [fig, sheep, spiral, fig, sheep][i % 5](x, y, sz); }
  // weathering: pits and lichen-free patches
  k.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`; k.fillRect(Math.random() * 512, Math.random() * 320, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SPECIALTY_COLOR = { potters: 0x8a3b2a, smiths: 0x2f3e52, carvers: 0x5a6b2e, weavers: 0x6b3f72 };

export class Wilderness extends World {
  constructor(game, exp) {
    const homeGen = makeHomeGen();
    const gen = new WorldGen(`exp-${exp.seed}`, exp.terrain, { homeGen, start: ROAD_START, dir: { x: 0, z: -1 }, blend: [30, 175] });
    super(game, {
      gen, eco: exp.eco, autumn: exp.autumn, dryGrass: exp.scenario === 'heath' ? 0.6 : exp.autumn * 0.5, collected: [],
      layers: { home: HOME_LAYERS.home, forest: HOME_LAYERS.forest, rock: exp.layers.rock, shore: exp.layers.shore, dest: exp.layers.ground },
      mode: exp.mode, strata: exp.strata, tints: exp.tints,
    });
    this.kind = 'wild'; this.exp = exp;
    this.homeEco = HOME_ECO; this.R = HOME_R;
    this.rng = new RNG(exp.seed ^ 0xabc);
  }

  slope(x, z) { const g = this.gen, h = g.baseHeight(x, z); return Math.hypot(g.baseHeight(x + 2, z) - h, g.baseHeight(x, z + 2) - h) / 2; }

  findSite(cx, cz, { radius = 40, minAbove = 1.8, maxAbove = 1e9, maxSlope = 0.18, prefer = 'flat', tries = 70, avoidRoad = 9 } = {}) {
    const g = this.gen, w = g.p.water;
    let best = null, bestScore = -1e9;
    for (let i = 0; i < tries; i++) {
      const a = i * 2.39996, r = radius * Math.sqrt(i / tries);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (x * x + z * z < (HOME_R + 30) ** 2) continue;
      const h = g.baseHeight(x, z); if (h - w < minAbove || h - w > maxAbove) continue;
      const ri = g.roadInfo(x, z); if (ri && ri.d < avoidRoad) continue;
      const s = this.slope(x, z);
      let score = -s * 20 - r * 0.02;
      if (prefer === 'high') score += h * 0.25;
      if (prefer === 'crag') score += (s > 0.25 && s < 0.7 ? 6 : 0) + h * 0.1;
      if (prefer === 'ledge') { const s2 = this.slope(x + 7, z) + this.slope(x - 7, z) + this.slope(x, z + 7) + this.slope(x, z - 7); score += Math.min(s2, 2.5) * 6; }
      if (prefer === 'beach') { const sm = g.sample(x, z); score += sm.beach * 12 - Math.abs(h - w - 1.2) * 3; }
      if (prefer !== 'crag' && s > maxSlope) score -= 50;
      if (score > bestScore) { bestScore = score; best = { x, z, h }; }
    }
    return best;
  }

  // the road: the same as it leaves the gate, then wandering off towards this expedition's land
  layRoad() {
    const g = this.gen, home = homeRoadCurve(g.homeGen), mine = (s) => g.nMask.noise(s * 0.009 + 7, 2.2) * 0.07;
    const curve = (s) => { const k = smoothstep(60, 160, s); return home(s) * (1 - k) + mine(s) * k; };
    let len = 760;
    g.buildRoad(ROAD_START, 0, len, curve);
    // the road stops where the land does: at the dunes, at the canyon rim, at a lake shore
    const P = g.road.pts, stop = (i) => { len = i * 4; g.road.pts = P.slice(0, i + 1); };
    for (let i = 30; i < P.length; i++) {
      const [x, z] = P[i], s = g.sample(x, z), bh = g.baseHeight(x, z);
      if (s.beach > 0.35 || s.sea > 0.05) { stop(Math.max(30, i - 6)); break; }
      if (this.exp.region === 'canyon' && bh < g.p.water + g.p.plateau - 7) { stop(Math.max(30, i - 8)); break; }
      if (bh < g.p.water - 0.4 && i > 45) { stop(i - 2); break; } // a lake
    }
    g.buildRoad(ROAD_START, 0, len, curve); // rebuild so the grid and smoothing match the final length
    this.roadLen = len;
  }

  async build() {
    const exp = this.exp, g = this.gen;
    this.layRoad();
    // camp where the new land begins, a little off the road
    const cp = roadPoint(g, Math.min(190, this.roadLen - 30));
    const side = this.rng.chance(0.5) ? 1 : -1;
    const t = this.findSite(cp.x + Math.cos(cp.angle) * 13 * side, cp.z + Math.sin(cp.angle) * 13 * side, { radius: 30, minAbove: 1.6, maxSlope: 0.12, tries: 120, avoidRoad: 5 })
      || { x: cp.x + Math.cos(cp.angle) * 10 * side, z: cp.z + Math.sin(cp.angle) * 10 * side, h: g.p.water + 2 };
    this.trail = new THREE.Vector3(t.x, 0, t.z);
    g.addZone(t.x, t.z, 6, 10, { clear: 1, h: Math.max(t.h, g.p.water + 1.6) });
    // points of interest ahead, in the new land, on either side of the road
    const end = roadPoint(g, this.roadLen);
    const sites = [];
    for (const p of exp.pois) {
      const ang = Math.PI * 0 + p.side; // relative to straight ahead (north)
      const sx = ROAD_START.x + Math.sin(ang) * p.dist, sz = ROAD_START.z - Math.cos(ang) * p.dist;
      const prefer = { stones: 'high', grotto: 'crag', alcove: 'ledge', carvings: 'crag', wreck: 'beach' }[p.type] || 'flat';
      const opt = { radius: 70, prefer, maxSlope: p.type === 'hamlet' ? 0.1 : 0.2 };
      if (p.type === 'wreck') Object.assign(opt, { minAbove: 0.4, maxAbove: 2.6, radius: 120, tries: 160 });
      if (p.type === 'alcove') Object.assign(opt, { minAbove: 3, maxAbove: exp.terrain.plateau - 6, radius: 110, tries: 180, maxSlope: 0.14 });
      const s = this.findSite(p.type === 'wreck' ? end.x + (sx - end.x) * 0.5 : sx, p.type === 'wreck' ? end.z - 60 + (sz - end.z) * 0.3 : sz, opt);
      if (!s) continue;
      const r = { hamlet: 20, ruins: 9, stones: 8, grotto: 6, cabin: 7, find: 0, wreck: 0, alcove: 7, carvings: 4 }[p.type];
      if (r) g.addZone(s.x, s.z, r, 12, { clear: p.type === 'grotto' ? 0.6 : 1 });
      sites.push({ ...p, x: s.x, z: s.z });
    }
    // the village you just left stands behind you
    this.home = new Village(this.game);
    this.home.buildBackdrop();
    for (const c of this.home.colliders.items.values()) this.colliders.add({ ...c });
    this.noGrass.push(...this.home.noGrass);
    this.initStreaming();
    this.add(buildRoadMesh(this, { fadeEnd: 30 }));
    this.spawn = { x: ROAD_START.x, z: ROAD_START.z - 4, yaw: 0 };
    this.buildSignpost();
    this.buildCamp();
    for (const s of sites) this.buildPOI(s);
    // wildlife & ambience
    this.wildlife = new Wildlife(this.scene, this, { foxes: exp.foxes });
    await this.wildlife.init();
    this.ambience = new Ambience(this.game, this);
    this.herds = new Herds(this.game, this, exp.herds);
    this.fauna = new Fauna(this.game, this, exp.fauna || {});
    this.beasts = new Beasts(this.game, this, exp.fauna?.beasts || []);
    if (exp.eco.fireflies) this.emitters.add(fireflies(this.trail, 60, 90, (x, z) => this.heightAt(x, z)));
  }

  populate(c, base) { return filterYard(base(c), this.R); }

  // a fingerpost outside the gate: home one way, the unknown the other
  buildSignpost() {
    const g = this.gen, p = roadPoint(g, 10), x = p.x + 3.1, z = p.z, h = this.heightAt(x, z);
    const b = new Builder();
    b.cyl(M.darkwood, 0.09, 0.08, 2.6, 0, 1.3, 0, { seg: 7 });
    const sign = (text, y, dir) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const k = c.getContext('2d');
      k.fillStyle = '#6a5440'; k.fillRect(0, 0, 512, 96);
      for (let i = 0; i < 40; i++) { k.fillStyle = `rgba(30,20,10,${Math.random() * 0.15})`; k.fillRect(0, Math.random() * 96, 512, 1 + Math.random() * 2); }
      k.fillStyle = '#efe4cc'; k.font = 'bold 50px Georgia, serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, 256, 52);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.05), [M.darkwood, M.darkwood, M.darkwood, M.darkwood, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })]);
      // fingers stick out along the road (local −z is the way ahead)
      m.position.set(0, y, dir * 0.66); m.rotation.y = Math.PI / 2; m.castShadow = true;
      return m;
    };
    const grp = b.finish('signpost');
    grp.add(sign(this.exp.place, 2.25, -1), sign('Home', 1.9, 1));
    grp.position.set(x, h, z); grp.rotation.y = -p.angle; this.add(grp);
    this.colliders.add({ x, z, r: 0.3 });
    this.addStatic({ type: 'signpost', pos: new THREE.Vector3(x, h + 1.6, z), radius: 2.2, label: 'Read the signpost' });
  }

  // walking back in through the North Gate takes you home
  constrain(p, prev) {
    const r = Math.hypot(p.x, p.z);
    if (r > HOME_R + 3) { this.gateArmed = true; return; }
    const ang = Math.atan2(p.z, p.x), da = Math.atan2(Math.sin(ang + Math.PI / 2), Math.cos(ang + Math.PI / 2));
    if (Math.abs(da) < 0.2 && r < HOME_R + 1.5) { p.x = prev.x; p.z = prev.z; if (this.gateArmed) { this.gateArmed = false; this.game.confirmReturnHome(true); } }
  }

  buildCamp() {
    const p = this.trail, h = this.heightAt(p.x, p.z);
    const fire = campfire(new THREE.Vector3(p.x, h, p.z)); this.emitters.add(fire); (this.fires = this.fires || []).push(new THREE.Vector3(p.x, h, p.z));
    const ring = new InstanceList(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; ring.push(p.x + Math.cos(a) * 0.62, h, p.z + Math.sin(a) * 0.62, a * 3, 2.4); }
    this.game.pools.set('pebble0', 'camp', ring.build());
    const b = new Builder();
    b.box(cloth(0x5b4a3a), 0.8, 0.12, 2.0, 1.9, 0.06, -0.4, { ry: 0.3 });
    b.box(cloth(0x3f4a3a), 0.82, 0.2, 0.5, 1.6, 0.1, -1.3, { ry: 0.3 });
    b.cyl(M.logs, 0.18, 0.18, 1.6, -1.6, 0.18, 0.6, { rz: Math.PI / 2, ry: 0.8 });
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
    const poi = { type: s.type, name, pos: new THREE.Vector3(s.x, h, s.z), discovered: false, known: s === this.exp.pois.find((q) => q.type !== 'find') || false, radius: { hamlet: 30, ruins: 16, stones: 14, grotto: 12, cabin: 12, find: 4, wreck: 14, alcove: 14, carvings: 8 }[s.type], seed: s.seed, specialty: s.specialty };
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
      case 'wreck': {
        // the bones of a wooden ship, heeled over and half sunk in the sand
        const ry = rng.range(0, 6.28), L = rng.range(12, 16), heel = rng.range(0.25, 0.45);
        const wood = M.grey, dark = M.darkwood;
        b.box(dark, 0.45, 0.5, L, 0, 0.0, 0, { ts: 1.5 }); // keel
        b.box(dark, 0.4, 2.4, 0.45, 0, 1.0, L / 2 - 0.2, { rx: -0.35 }); // stem post
        b.box(dark, 0.4, 2.0, 0.45, 0, 0.8, -L / 2 + 0.2, { rx: 0.2 }); // sternpost
        for (let i = 0; i < 11; i++) {
          const zz = -L / 2 + 1 + i * (L - 2) / 10, t = (i + 0.5) / 11, w = Math.sin(t * Math.PI) * 2.4 + 0.5;
          for (const sd of [-1, 1]) {
            if (rng.chance(sd > 0 ? 0.12 : 0.3)) continue;
            const arc = Math.PI / 2 * (sd > 0 ? rng.range(0.75, 1) : rng.range(0.45, 0.85));
            const tor = new THREE.TorusGeometry(w, 0.16, 5, 9, arc);
            tor.rotateZ(sd > 0 ? -Math.PI / 2 : Math.PI + Math.PI / 2 - arc); tor.rotateY(Math.PI / 2); tor.translate(0, w, zz);
            b.add(dark, tor);
          }
        }
        // surviving planking on the high side
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + k * 0.17, len = L * rng.range(0.45, 0.8), z0 = rng.range(-L * 0.15, L * 0.15);
          for (let q = 0; q < 1; q++) b.box(wood, 0.08, 0.3, len, Math.cos(a) * 2.6 * -1 * -1, 2.6 + Math.sin(a) * 2.6, z0, { rz: a, ts: 1.2 });
        }
        for (let k = 0; k < 6; k++) b.box(wood, 0.08, 0.3, rng.range(1.5, 4), rng.range(-3, 3), 0.1, rng.range(-L / 2, L / 2), { ry: rng.range(-0.6, 0.6), rz: rng.range(-0.3, 0.3), ts: 1.2 });
        b.cyl(dark, 0.18, 0.14, rng.range(5, 8), 0, 2.4, L * 0.12, { rz: rng.range(0.9, 1.3), seg: 7 }); // broken mast
        const grp = b.finish('wreck'); grp.rotation.set(0, ry, 0); grp.rotateZ(heel); grp.position.set(s.x, h - 0.6, s.z); this.add(grp);
        const cs = Math.cos(ry), sn = Math.sin(ry);
        for (let i = -2; i <= 2; i++) this.colliders.add({ x: s.x + (i * L / 5) * sn, z: s.z + (i * L / 5) * cs, r: 1.2 });
        const cx = s.x + 3.4 * cs, cz = s.z - 3.4 * sn;
        const chest = prop('wooden_crate_01'); chest.position.set(cx, this.heightAt(cx, cz) - 0.15, cz); chest.rotation.set(0.15, ry, 0.1); this.add(chest);
        placeArtifact(3.4 * cs, -3.4 * sn, null, 'wreck', 'Search the sea chest');
        break;
      }
      case 'alcove': {
        // small stone rooms built into a canyon ledge, long abandoned
        const sand = M.sandstone, ry = rng.range(0, 6.28);
        const rooms = rng.int(3, 5);
        for (let i = 0; i < rooms; i++) {
          const x = (i - (rooms - 1) / 2) * 3.1 + rng.range(-0.3, 0.3), z = rng.range(-0.6, 0.6), H = rng.range(1.6, 2.6) * (i % 2 ? 1 : 1.25), W = rng.range(2.3, 2.9), D = rng.range(2.2, 2.8);
          b.box(sand, W, H, 0.32, x, H / 2, z - D / 2, { ts: 1.2 });
          b.box(sand, 0.32, H, D, x - W / 2, H / 2, z, { ts: 1.2 }); b.box(sand, 0.32, H, D, x + W / 2, H / 2, z, { ts: 1.2 });
          // front wall with a small T-shaped doorway
          b.box(sand, W * 0.3, H, 0.32, x - W * 0.35, H / 2, z + D / 2, { ts: 1.2 }); b.box(sand, W * 0.3, H, 0.32, x + W * 0.35, H / 2, z + D / 2, { ts: 1.2 });
          b.box(sand, W * 0.4, H * 0.35, 0.32, x, H * 0.82, z + D / 2, { ts: 1.2 });
          if (i % 2 === 0) for (let k = 0; k < 6; k++) b.cyl(M.darkwood, 0.05, 0.05, W + 0.5, x, H + 0.02, z - D / 2 + 0.2 + k * D / 6, { rz: Math.PI / 2, seg: 5 }); // roof beams
          b.colliders.push({ x, z: z - D / 2, hw: W / 2, hd: 0.2, rot: 0 }, { x: x - W / 2, z, hw: 0.2, hd: D / 2, rot: 0 }, { x: x + W / 2, z, hw: 0.2, hd: D / 2, rot: 0 });
        }
        const grp = b.finish('alcove'); grp.rotation.y = ry; grp.position.set(s.x, h - 0.1, s.z); this.add(grp);
        const cs = Math.cos(ry), sn = Math.sin(ry);
        for (const c of b.colliders) this.colliders.add({ ...c, x: s.x + c.x * cs + c.z * sn, z: s.z - c.x * sn + c.z * cs, rot: (c.rot || 0) - ry });
        const pot = prop('antique_ceramic_vase_01'); pot.position.set(s.x + 0.5 * cs, h, s.z - 0.5 * sn); pot.scale.setScalar(0.9); this.add(pot);
        placeArtifact(-0.4 * cs, 0.4 * sn, h + 0.02, 'alcove');
        break;
      }
      case 'carvings': {
        // figures pecked into a dark, varnished rock face
        const ry = rng.range(0, 6.28);
        const rock = rockMesh('boulder0', 2.6, ry, 1.2); rock.position.set(s.x, h - 0.6, s.z); this.add(rock);
        this.colliders.add({ x: s.x, z: s.z, r: 2.2 });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ map: petroglyphTexture(s.seed), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
        const fx = Math.sin(ry), fz = Math.cos(ry);
        panel.position.set(s.x + fx * 2.05, h + 0.9, s.z + fz * 2.05); panel.rotation.y = ry; this.add(panel);
        placeArtifact(fx * 3.2, fz * 3.2, null, 'carvings', 'Look at what lies beneath the carvings');
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
    this.home?.update(dt, ctx);
    this.herds?.update(dt, ctx);
    this.fauna?.update(dt, ctx);
    this.beasts?.update(dt, ctx);
    this.wildlife?.update(dt, ctx.player, ctx);
    // far zones: name each new land you run into, and seed it with places to find before you arrive
    this.zoneT = (this.zoneT || 0) - dt;
    if (this.zoneT < 0) { this.zoneT = 1; this.farZones(ctx.player.pos); }
    // discovery
    const p = ctx.player.pos;
    for (const poi of this.pois) {
      if (poi.discovered) continue;
      if (poi.pos.distanceTo(p) < poi.radius + (poi.type === 'find' ? 2 : 10)) { poi.discovered = true; ctx.onDiscover && ctx.onDiscover(poi); }
    }
  }

  farZones(p) {
    const g = this.gen, Z = g.zoneMod(p.x, p.z);
    // announce the zone you are in
    if (Z.cell && Z.kind && Z.k > 0.7 && this.zoneHere !== Z.cell.key) {
      this.zoneHere = Z.cell.key; const c = Z.cell;
      if (!c.name) c.name = `The ${placeName(new RNG(c.seed), this.exp.region)}`;
      if (!(this.zonesSeen = this.zonesSeen || new Set()).has(c.key)) { this.zonesSeen.add(c.key); this.game.ui.region(c.name, `Far beyond the road · ${Z.kind.name}`); this.game.ui.toast(`The land changes: <b>${Z.kind.name}</b>. You have come a long way from the road.`); this.game.audio?.discover?.();
        const wx = { peaks: ['overcast', 'clear', 'hazy'], marsh: ['mist', 'mist', 'overcast'], plains: ['clear', 'hazy'], oldwood: ['hazy', 'mist'], lakes: ['clear', 'hazy'], hills: ['hazy', 'clear', 'overcast'] }[Z.kind.id];
        if (wx && this.game.sky.weatherName !== 'rain' && Math.random() < 0.6) this.game.sky.setWeather(new RNG(c.seed).pick(wx)); }
    }
    // populate cells ahead with places to discover, while they are still too far away to be loaded
    const C = 1300, cx = Math.floor(p.x / C), cz = Math.floor(p.z / C);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = g.zoneCell(cx + i, cz + j); if (!c.kind || c.populated) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z); if (d > 1150) continue;
      c.populated = true;
      const rng = new RNG(c.seed ^ 0x1f00), types = { peaks: ['grotto', 'stones', 'cabin'], lakes: ['cabin', 'ruins', 'find'], marsh: ['ruins', 'find', 'stones'], plains: ['hamlet', 'stones', 'ruins'], oldwood: ['cabin', 'ruins', 'find'], hills: ['stones', 'ruins', 'cabin'] }[c.kind.id];
      const n = rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        const type = k === n - 1 ? 'find' : rng.pick(types.filter((t) => t !== 'grotto' || this.exp.region !== 'tropics'));
        const a = rng.next() * 6.283, r = rng.range(0, 420), sx = c.x + Math.cos(a) * r, sz = c.z + Math.sin(a) * r;
        if (Math.hypot(sx - p.x, sz - p.z) < 560) continue; // never build where the land is already loaded
        const site = this.findSite(sx, sz, { radius: 90, prefer: type === 'stones' ? 'high' : type === 'grotto' ? 'crag' : 'flat', maxSlope: type === 'hamlet' ? 0.1 : 0.2, tries: 80 });
        if (!site || Math.hypot(site.x - p.x, site.z - p.z) < 530) continue;
        const R = { hamlet: 20, ruins: 9, stones: 8, grotto: 6, cabin: 7, find: 0 }[type];
        if (R) g.addZone(site.x, site.z, R, 12, { clear: type === 'grotto' ? 0.6 : 1 });
        this.buildPOI({ type, x: site.x, z: site.z, seed: Math.floor(rng.next() * 1e9), name: type === 'find' ? null : placeName(rng, this.exp.region), specialty: rng.pick(['potters', 'smiths', 'carvers', 'weavers']), far: true });
      }
    }
  }

  dispose() { this.wildlife?.dispose(); this.herds?.dispose(); this.fauna?.dispose(); this.beasts?.dispose(); if (this.home) { for (const o of this.home.objects) this.scene.remove(o); this.home.emitters.clear(); } super.dispose(); }
}
