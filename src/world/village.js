// The permanent village: home, storehouse (whose piles grow with your stores), workshop,
// Hall of Discoveries (every artifact you bring home is displayed on a pedestal), noticeboard,
// palisade and the North Gate that leads into a new wilderness.
import * as THREE from 'three';
import { World } from './world.js';
import { Builder, M, cabin, postsAndRoof, palisade, lanternPost, well, pedestal, prop, cloth } from './structures.js';
import { InstanceList } from './pools.js';
import { campfire, chimneySmoke } from './effects.js';
import { Ambience } from './critters.js';
import { buildArtifactMesh } from '../game/artifacts3d.js';
import { tex } from '../core/assets.js';
import { KIND_INFO } from './vegetation.js';
import { ITEMS } from '../game/items.js';
import { makeHomeGen, homeRoadCurve, HOME_R, ROAD_START } from './generator.js';
import { buildRoadMesh } from './road.js';
import { buildPiece } from '../game/building.js';

export const HOME_LAYERS = { home: 'rocky_terrain_02', forest: 'forest_leaves_03', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02', dest: 'rocky_terrain_02' };
export const HOME_ECO = { treeDensity: 0.026, conifer: 0.55, broad: 0.45, snag: 0.02, fern: 0.5, grass: 1.1, flowers: 0.6, rocks: 0.3, logs: 0.3, minerals: [], fungi: 0.6, flora: 0.8 };

// keep scatter out of the village yard (the palisade ring is the boundary)
export function filterYard(res, R) {
  const inside = (x, z) => x * x + z * z < (R + 6) ** 2;
  res.interactables = res.interactables.filter((i) => !inside(i.pos.x, i.pos.z));
  res.colliders = res.colliders.filter((col) => !inside(col.x, col.z));
  for (const [k, v] of res.veg) {
    const b = v.built, keep = [];
    for (let i = 0; i < b.count; i++) if (!inside(b.mats[i * 16 + 12], b.mats[i * 16 + 14])) keep.push(i);
    if (keep.length === b.count) continue;
    const mats = new Float32Array(keep.length * 16), cols = b.cols ? new Float32Array(keep.length * 3) : null;
    keep.forEach((i, n) => { mats.set(b.mats.subarray(i * 16, i * 16 + 16), n * 16); if (cols) cols.set(b.cols.subarray(i * 3, i * 3 + 3), n * 3); });
    v.built = { mats, cols, count: keep.length };
  }
  return res;
}

export class Village extends World {
  constructor(game) {
    super(game, {
      gen: makeHomeGen(),
      layers: HOME_LAYERS, eco: HOME_ECO,
    });
    this.kind = 'village';
    this.R = HOME_R;
    this.h0 = this.gen.zones[0].h;
    // the road out of the North Gate (the same road every expedition starts on)
    this.gen.buildRoad(ROAD_START, 0, 320, homeRoadCurve(this.gen));
    this.grassInClearings = true;
    this.gateAngle = -Math.PI / 2;
    this.spawn = { x: 0, z: 9, yaw: 0 };
  }

  populate(c, base) { return filterYard(base(c), this.R); }

  async build() {
    this.buildBackdrop();
    this.initStreaming();
    this.ambience = new Ambience(this.game, this);
  }

  // everything you can see of the village (also shown behind you as you set out on an expedition)
  buildBackdrop() {
    const h0 = this.h0;
    this.noGrass.push({ x: 0, z: 0, r: 7.5 });
    // ------------------------------------------------ static structures
    const b = new Builder();
    const pal = palisade(b, this.R, this.gateAngle);
    this.gatePos = pal.gate.clone().setY(h0);
    // well & square
    well(b, 0, 0);
    // home
    const homeP = { x: -15, z: 5 }, homeRy = Math.atan2(15, -5);
    const home = cabin(b, { x: homeP.x, z: homeP.z, ry: homeRy, w: 7, d: 5.5, h: 2.8, wall: M.logs, roof: M.thatch, windows: [2.2, -2.2] });
    this.noGrass.push({ x: homeP.x, z: homeP.z, r: 4.5 });
    // storehouse
    const stP = { x: 15, z: 6 }, stRy = Math.atan2(-15, -6);
    const store = cabin(b, { x: stP.x, z: stP.z, ry: stRy, w: 5.5, d: 4.5, h: 2.6, wall: M.planks, roof: M.tiles, chimney: false, windows: [] , sideWindows: [] });
    this.noGrass.push({ x: stP.x, z: stP.z, r: 4 });
    // workshop: open shed
    const wsP = { x: -14, z: -11 };
    postsAndRoof(b, { w: 6, d: 4, x: wsP.x, z: wsP.z, roof: M.thatch, H: 2.6, posts: 3 });
    b.box(M.planks, 2.6, 0.12, 0.9, wsP.x, 0.92, wsP.z - 0.9); // workbench
    for (const sx of [-1.1, 1.1]) b.box(M.darkwood, 0.12, 0.9, 0.8, wsP.x + sx, 0.45, wsP.z - 0.9);
    b.box(M.iron, 0.5, 0.35, 0.3, wsP.x + 1.8, 0.72, wsP.z + 0.6); b.cyl(M.logs, 0.3, 0.3, 0.55, wsP.x + 1.8, 0.27, wsP.z + 0.6);
    b.colliders.push({ x: wsP.x, z: wsP.z - 0.9, hw: 1.4, hd: 0.5, rot: 0 }, { x: wsP.x + 1.8, z: wsP.z + 0.6, r: 0.4 });
    this.noGrass.push({ x: wsP.x, z: wsP.z, r: 3.5 });
    // noticeboard
    // herbalist's hut, south side of the yard, herbs drying under the eaves
    const hbP = { x: 0, z: 22 };
    const herb = cabin(b, { x: hbP.x, z: hbP.z, ry: Math.PI, w: 5, d: 4.2, h: 2.5, wall: M.plaster, roof: M.thatch, windows: [1.4], sideWindows: [] });
    const herbMats = [cloth(0x6a7a3a), cloth(0x8a7a40)];
    for (let i = 0; i < 7; i++) { const hx = -1.9 + i * 0.62; b.cyl(herbMats[i % 2], 0.07, 0.01, 0.38, hbP.x - hx, 2.55, hbP.z - 2.55, { seg: 6 }); }
    b.box(M.planks, 1.6, 0.08, 0.6, hbP.x + 1.6, 0.85, hbP.z - 2.7); for (const sx of [-0.7, 0.7]) b.box(M.darkwood, 0.08, 0.85, 0.5, hbP.x + 1.6 + sx, 0.42, hbP.z - 2.7);
    b.colliders.push({ x: hbP.x + 1.6, z: hbP.z - 2.7, hw: 0.8, hd: 0.3, rot: 0 });
    this.noGrass.push({ x: hbP.x, z: hbP.z, r: 3.8 });
    this.herbDoor = herb.door; this.herbChimney = herb.chimney;
    const nbP = { x: 5.5, z: -10 };
    for (const s of [-0.8, 0.8]) b.box(M.darkwood, 0.12, 2.2, 0.12, nbP.x + s, 1.1, nbP.z);
    b.box(M.planks, 1.9, 1.1, 0.08, nbP.x, 1.5, nbP.z);
    b.box(M.darkwood, 2.2, 0.1, 0.4, nbP.x, 2.15, nbP.z, { rx: 0.2 });
    b.colliders.push({ x: nbP.x, z: nbP.z, hw: 1.0, hd: 0.2, rot: 0 });
    // lanterns
    const lanterns = [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5], [-1.5, -this.R + 2.5], [1.5, -this.R + 2.5]].map(([x, z]) => lanternPost(b, x, z));
    // benches & crates
    b.box(M.planks, 1.8, 0.08, 0.45, -3.5, 0.48, 6.2); for (const s of [-0.7, 0.7]) b.box(M.darkwood, 0.1, 0.45, 0.4, -3.5 + s, 0.23, 6.2);
    b.colliders.push({ x: -3.5, z: 6.2, hw: 0.9, hd: 0.25, rot: 0 });
    const g = b.finish('village');
    g.position.y = h0;
    this.add(g);
    this.addColliders(b.colliders);
    // window glow for home
    this.windowMat = M.glass;

    // square cobbles and gravel paths
    const cob = new THREE.Mesh(new THREE.CircleGeometry(7.2, 40), M.cobble);
    cob.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 5.5; });
    cob.rotation.x = -Math.PI / 2; cob.position.y = h0 + 0.04; cob.receiveShadow = true; this.add(cob);
    const gravel = new THREE.MeshStandardMaterial({ map: tex('terrain/grass_path_2_diff.jpg'), normalMap: tex('terrain/grass_path_2_nor.jpg', { srgb: false }), roughness: 1, color: 0xc8c0b0, polygonOffset: true, polygonOffsetFactor: -2 });
    const path = (x0, z0, x1, z1, w = 2.2) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const segs = Math.max(1, Math.ceil(L / 2));
      const geo = new THREE.PlaneGeometry(w, L, 2, segs); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2.5, uv.getY(i) * L / 2.5);
      geo.rotateX(-Math.PI / 2); geo.rotateY(Math.atan2(x1 - x0, z1 - z0) + Math.PI); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, this.heightAt(pa.getX(i), pa.getZ(i)) + 0.035);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, gravel); m.receiveShadow = true; m.userData.disposable = true; this.add(m);
      const n = Math.ceil(L / 3); for (let i = 0; i <= n; i++) this.noGrass.push({ x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, r: w * 0.6 });
    };
    path(0, -7, 0, -this.R + 0.5, 2.6);
    this.add(buildRoadMesh(this, { to: 330, fadeEnd: 80 })); path(-6, 2.5, homeP.x + 3, homeP.z - 1); path(6, 2.5, stP.x - 2.6, stP.z - 1); path(-5, -4.5, wsP.x + 2, wsP.z + 1.5); path(5, -4.5, 12, -8.5); path(0, 7, 0, 19.2, 2);

    // ------------------------------------------------ trees inside the yard (hand placed)
    const trees = new Map();
    const T = (kind, x, z, s, r = 0) => { if (!trees.has(kind)) trees.set(kind, new InstanceList()); trees.get(kind).push(x, this.heightAt(x, z) - 0.1, z, r, s, 0, new THREE.Color(0.95, 1, 0.92)); this.colliders.add({ x, z, r: (KIND_INFO[kind].radius || 0.4) * s }); };
    T('broad0', -6, 15, 1.25, 1); T('broad2', 9, 17, 0.9, 2); T('conifer1', -26, 5, 1.0, 3); T('conifer3', 25, -6, 1.1, 1); T('conifer0', -22, -22, 0.8, 4); T('broad1', 24, 14, 1.0, 5); T('conifer2', 20, -24, 0.75, 6);
    for (const [k, l] of trees) this.game.pools.set(`${k}@near`, 'village-trees', l.build());
    const ferns = new InstanceList(); for (let i = 0; i < 18; i++) { const a = i * 2.4, r = this.R - 2.2 - (i % 3) * 0.6; ferns.push(Math.cos(a) * r, this.h0 - 0.05, Math.sin(a) * r, a, 0.9); }
    this.game.pools.set('fern0', 'village-ferns', { ...ferns.build(), always: true });

    // ------------------------------------------------ interactables
    const P = (x, z, y = 1) => new THREE.Vector3(x, h0 + y, z);
    this.addStatic({ type: 'gate', pos: this.gatePos.clone().add(new THREE.Vector3(0, 1, 2.5)), radius: 4, label: 'Set out through the North Gate' });
    this.addStatic({ type: 'store', pos: P(stP.x - 2.6, stP.z - 1.0), radius: 2.6, label: 'Open the storehouse' });
    this.addStatic({ type: 'craft', pos: P(wsP.x, wsP.z - 0.2), radius: 2.8, label: 'Work at the workbench' });
    this.addStatic({ type: 'rest', pos: new THREE.Vector3(home.door.x, h0 + 1, home.door.z), radius: 2.2, label: 'Rest at home' });
    this.addStatic({ type: 'journal', pos: P(nbP.x, nbP.z + 0.6), radius: 2.4, label: 'Read the expedition journal' });
    this.addStatic({ type: 'well', pos: P(0, 0), radius: 2.0, label: 'Draw water from the well' });
    this.addStatic({ type: 'herbalist', pos: new THREE.Vector3(this.herbDoor.x, h0 + 1, this.herbDoor.z), radius: 2.6, label: 'Visit Maren the herbalist' });
    for (const [x, z] of [[1.6, 19.3]]) this.addStatic({ type: 'herbalist', pos: P(x, z), radius: 1.6, label: 'Ask Maren to check your basket' });

    // smoke & hearth
    this.emitters.add(chimneySmoke(home.chimney.clone().setY(home.chimney.y + h0), 1));
    const hearth = campfire(new THREE.Vector3(6.5, h0, 2.5)); this.baseFires = [new THREE.Vector3(6.5, h0, 2.5)];
    this.emitters.add(hearth);
    const ring = new InstanceList(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; ring.push(6.5 + Math.cos(a) * 0.65, h0, 2.5 + Math.sin(a) * 0.65, a * 3, 2.6); }
    this.game.pools.set('pebble0', 'village-hearth', { ...ring.build(), always: true });
    this.colliders.add({ x: 6.5, z: 2.5, r: 0.8 });
    // night lights (a couple of real point lights; the rest glow)
    for (const p of [lanterns[0], lanterns[3]]) { const l = new THREE.PointLight(0xffb060, 0, 16, 1.8); l.position.copy(p).setY(p.y + h0); this.add(l); this.lights.push(l); }

    this.hall = { x: 14, z: -11, ry: Math.atan2(-14, 11) };
    this.store = { x: stP.x, z: stP.z, ry: stRy };
    this.baseColliders = [...this.colliders.items.values()].map((c) => ({ ...c }));
    this.buildDynamic();
    this.buildPlaced();
    this.emitters.add(chimneySmoke(this.herbChimney.clone().setY(this.herbChimney.y + h0), 0.8));
  }

  // everything the player has built and placed (rebuilt whenever something changes)
  buildPlaced() {
    if (this.placedGroup) { this.scene.remove(this.placedGroup); this.objects = this.objects.filter((o) => o !== this.placedGroup); this.placedGroup.traverse((m) => { if (m.isMesh && m.userData.disposable) m.geometry.dispose(); }); }
    for (const id of this.placedColliders || []) this.colliders.remove(id);
    for (const e of this.placedEmitters || []) this.emitters.remove?.(e);
    this.placedFires = [];
    this.statics = this.statics.filter((s) => !s.placed);
    this.placedColliders = []; this.placedEmitters = [];
    const save = this.game.save, h0 = this.h0, b = new Builder(), extras = [];
    this.placedNoGrass = [];
    for (const piece of save.builds || []) {
      const r = buildPiece(b, piece, h0, save); if (!r) continue;
      if (r.def?.snap === 'cell' && !r.def.roof) this.placedNoGrass.push({ x: piece.x, z: piece.z, r: 1.05 });
      if (piece.t === 'pelt_rug' || piece.t === 'stone_path') this.placedNoGrass.push({ x: piece.x, z: piece.z, r: 0.8 });
      for (const c of r.colliders) this.placedColliders.push(this.colliders.add(c));
      for (const x of r.extra || []) extras.push(x);
      const at = new THREE.Vector3(piece.x, h0 + 1, piece.z);
      if (r.def?.use === 'rest') this.statics.push({ type: 'rest', placed: true, pos: at, radius: 2, label: 'Rest in your bed' });
      if (r.def?.use === 'store') this.statics.push({ type: 'store', placed: true, pos: at, radius: 1.8, label: 'Open your chest (the storehouse)' });
      if (r.def?.use === 'hearth') { this.statics.push({ type: 'hearth', placed: true, pos: at, radius: 2, label: 'Cook at your hearth' }); const f = campfire(new THREE.Vector3(piece.x, h0, piece.z)); this.emitters.add(f); this.placedEmitters.push(f); this.placedFires.push(new THREE.Vector3(piece.x, h0, piece.z)); }
      if (piece.t === 'artifact') { const a = save.artifacts.find((q) => q.uid === piece.uid); if (a) this.statics.push({ type: 'artifact-view', placed: true, artifact: a, pos: new THREE.Vector3(piece.x, h0 + 1.1, piece.z), radius: 1.4, label: `Examine: ${a.name}` }); }
    }
    const grp = b.finish('placed');
    for (const x of extras) grp.add(x.obj);
    this.placedGroup = grp; this.add(grp);
    if (this.grass) this.grass.clear(); // regrow grass around the new floors
  }

  // parts that depend on the save: Hall pedestals + artifacts, store piles, upgrades
  buildDynamic() {
    if (this.dyn) { this.scene.remove(this.dyn); this.objects = this.objects.filter((o) => o !== this.dyn); for (const id of this.dynColliders || []) this.colliders.remove(id); }
    this.statics = this.statics.filter((s) => !s.dynamic);
    const save = this.game.save, h0 = this.h0;
    const dyn = new THREE.Group(); this.dyn = dyn; this.dynColliders = [];
    const b = new Builder();
    // ---- Hall of Discoveries
    const big = save.upgrades.hall;
    const { x: hx, z: hz } = this.hall;
    const W = big ? 13 : 9, D = big ? 7.5 : 6;
    b.box(M.stone, W + 0.8, 0.4, D + 0.8, hx, 0.15, hz, { ts: 2.5 });
    b.box(M.cobble, W + 0.6, 0.04, D + 0.6, hx, 0.37, hz, { ts: 2.5 });
    postsAndRoof(b, { w: W, d: D, x: hx, z: hz, roof: M.tiles, H: 3.2, posts: big ? 5 : 4, pitch: 0.45 });
    b.box(M.plaster, W - 0.4, 2.6, 0.3, hx, 1.65, hz - D / 2 + 0.25, { ts: 2.5 }); // back wall (north)
    b.colliders.push({ x: hx, z: hz - D / 2 + 0.25, hw: W / 2, hd: 0.2, rot: 0 });
    const slots = [];
    const cols = big ? 6 : 4, rows = big ? 3 : 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = hx - (W - 2.4) / 2 + c * (W - 2.4) / (cols - 1), pz = hz - D / 2 + 1.5 + r * (D - 2.6) / Math.max(1, rows - 1);
      slots.push(pedestal(b, px, pz, 0, 0.39));
    }
    // sign board
    b.box(M.darkwood, 2.6, 0.5, 0.08, hx, 3.1, hz + D / 2 - 0.1);
    // ---- Upgrades
    if (save.upgrades.tower) {
      const tx = -24, tz = -15;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(M.logs, 0.18, 0.15, 8.5, tx + sx * 1.3, 4.25, tz + sz * 1.3, { seg: 7 }); b.colliders.push({ x: tx + sx * 1.3, z: tz + sz * 1.3, r: 0.25 }); }
      b.box(M.planks, 3.4, 0.18, 3.4, tx, 6.4, tz);
      for (const s of [-1, 1]) { b.box(M.darkwood, 3.4, 0.9, 0.1, tx, 6.9, tz + s * 1.65); b.box(M.darkwood, 0.1, 0.9, 3.4, tx + s * 1.65, 6.9, tz); }
      for (const s of [-1, 1]) b.box(M.thatch, 4.2, 0.12, 2.6, tx, 9.1, tz + s * 1.0, { rx: s * 0.55 });
      for (let i = 0; i < 9; i++) b.box(M.darkwood, 0.9, 0.06, 0.12, tx + 1.9, 0.5 + i * 0.7, tz, { rz: 0.0 });
      for (const s of [-0.45, 0.45]) b.box(M.darkwood, 0.08, 6.4, 0.08, tx + 1.9, 3.2, tz + s);
    }
    if (save.upgrades.garden) {
      for (let i = 0; i < 3; i++) { const gx = -22 + i * 2.2, gz = 12.5; b.box(M.planks, 1.6, 0.35, 3, gx, 0.17, gz); b.box(M.cobble, 1.4, 0.05, 2.8, gx, 0.33, gz, { ts: 4 }); b.colliders.push({ x: gx, z: gz, hw: 0.8, hd: 1.5, rot: 0 }); }
      const herbs = new InstanceList(); const herbs2 = new InstanceList();
      for (let i = 0; i < 24; i++) { const gx = -22 + (i % 3) * 2.2 + (Math.sin(i * 7.1) * 0.4), gz = 12.5 + (Math.floor(i / 3) - 3.5) * 0.36; (i % 2 ? herbs : herbs2).push(gx, h0 + 0.33, gz, i, 0.8 + (i % 4) * 0.1); }
      this.game.pools.set('nettle0', 'village-garden', { ...herbs.build(), always: true }); this.game.pools.set('celandine0', 'village-garden', { ...herbs2.build(), always: true });
    }
    // ---- Storehouse piles: these grow and shrink with what is stored
    const st = save.store, sp = this.store;
    const c = Math.cos(sp.ry), s = Math.sin(sp.ry);
    const local = (lx, lz) => [sp.x + lx * c + lz * s, sp.z - lx * s + lz * c];
    const wood = Math.min(st.wood || 0, 48);
    for (let i = 0; i < wood; i++) {
      const row = Math.floor(i / 8), k = i % 8; const [x, z] = local(3.6 + (row % 2) * 0.12, -1.6 + k * 0.42);
      b.cyl(M.logs, 0.17, 0.17, 1.4, x, 0.18 + row * 0.3, z, { rz: Math.PI / 2, ry: sp.ry, seg: 7 });
    }
    if (wood) { const [x, z] = local(3.6, 0); b.colliders.push({ x, z, hw: 0.8, hd: 1.8, rot: -sp.ry }); }
    const stone = Math.min(st.stone || 0, 40);
    for (let i = 0; i < stone; i++) { const a = i * 2.4, r = 0.15 + Math.sqrt(i) * 0.14; const [x, z] = local(-3.6 + Math.cos(a) * r, -1 + Math.sin(a) * r); const geo = KIND_INFO.pebble0.geometry; const m = new THREE.Mesh(geo, KIND_INFO.pebble0.material); m.position.set(x, h0 + Math.max(0, 0.35 - r * 0.4), z); m.scale.setScalar(2.4); m.rotation.set(i, i * 2, 0); m.castShadow = true; dyn.add(m); }
    // fish drying rack
    const fishTotal = Object.entries(st).filter(([k]) => ITEMS[k]?.cat === 'fish').reduce((a, [, v]) => a + v, 0);
    const [rx, rz] = local(-3.6, 1.4);
    for (const sx of [-1, 1]) b.box(M.darkwood, 0.08, 1.9, 0.08, rx + sx * c * 1.1, 0.95, rz - sx * s * 1.1);
    b.box(M.darkwood, 2.4, 0.07, 0.07, rx, 1.85, rz, { ry: sp.ry });
    for (let i = 0; i < Math.min(fishTotal, 10); i++) {
      const f = prop('fish'); const t = (i / 9 - 0.5) * 2;
      f.position.set(rx + t * c * 1.0, h0 + 1.45, rz - t * s * 1.0); f.rotation.set(Math.PI / 2, 0, sp.ry + Math.PI / 2); f.scale.setScalar(0.9 + (i % 3) * 0.12);
      dyn.add(f);
    }
    // forage baskets and crates
    const forage = Object.entries(st).filter(([k]) => ITEMS[k]?.cat === 'forage').reduce((a, [, v]) => a + v, 0);
    const crates = Math.min(4, Math.ceil(((st.copper || 0) + (st.quartz || 0) + (st.iron || 0) + (st.amethyst || 0) + (st.clay || 0)) / 3));
    for (let i = 0; i < crates; i++) { const cr = prop('wooden_crate_01'); const [x, z] = local(-1.2 + i * 0.9, 2.9); cr.position.set(x, h0, z); cr.rotation.y = sp.ry + i * 0.2; dyn.add(cr); }
    for (let i = 0; i < Math.min(3, Math.ceil(forage / 6)); i++) { const bk = prop('wooden_bucket_01'); const [x, z] = local(1.2 + i * 0.5, 2.8); bk.position.set(x, h0, z); dyn.add(bk); }
    const pelts = Math.min(st.pelt || 0, 6);
    for (let i = 0; i < pelts; i++) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), cloth(0x8a6a4a)); const [x, z] = local(-2.75 + i * 0.01, -0.2 - i * 0.55); pm.position.set(x, h0 + 1.6, z); pm.rotation.y = sp.ry + Math.PI / 2; dyn.add(pm); }

    const bg = b.finish('village-dyn'); bg.position.y = h0; dyn.add(bg);
    for (const col of b.colliders) this.dynColliders.push(this.colliders.add({ ...col }));
    // ---- artifacts on pedestals (most recent first)
    const placedArts = new Set((save.builds || []).filter((q) => q.t === 'artifact').map((q) => q.uid));
    const arts = save.artifacts.filter((a) => !placedArts.has(a.uid)).reverse().slice(0, slots.length);
    arts.forEach((a, i) => {
      const m = buildArtifactMesh(a);
      m.scale.multiplyScalar(1.9);
      m.position.copy(slots[i]).setY(h0 + slots[i].y);
      m.rotation.y = this.hall.ry + Math.PI;
      dyn.add(m);
      this.statics.push({ type: 'artifact-view', dynamic: true, artifact: a, pos: m.position.clone().add(new THREE.Vector3(0, 0.2, 0)), radius: 1.3, label: `Examine: ${a.name}` });
    });
    this.statics.push({ type: 'hall', dynamic: true, pos: new THREE.Vector3(hx, h0 + 1, hz + D / 2 + 0.8), radius: 3.2, label: 'Browse the Hall of Discoveries' });
    this.hallSlots = slots.length;
    this.add(dyn);
  }

  // keep the player inside the palisade; walking out through the gate starts an expedition
  constrain(p, prev) {
    const r = Math.hypot(p.x, p.z);
    const ang = Math.atan2(p.z, p.x);
    const nearGate = Math.abs(Math.atan2(Math.sin(ang - this.gateAngle), Math.cos(ang - this.gateAngle))) < 0.16;
    if (r > this.R + 3.2 && nearGate) { p.x = prev.x; p.z = prev.z; this.game.onGateReached(); }
    else if (r > this.R - 0.6 && !nearGate) { const k = (this.R - 0.6) / r; p.x *= k; p.z *= k; }
  }

  update(dt, ctx) {
    super.update(dt, ctx);
    const night = ctx.night;
    M.glow.emissiveIntensity = night ? 2.2 : 0.05;
    for (const l of this.lights) l.intensity = night ? 9 : 0;
    this.windowMat.emissive.setRGB(night ? 0.5 : 0, night ? 0.32 : 0, night ? 0.12 : 0);
  }
}
