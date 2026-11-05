// Building & decorating your own place in the village.
// Everything you carry home can become part of it: planks and logs, stone, sandstone from the
// canyon, palm fronds from the tropics, driftwood, shells and sea glass from the beach, crystals,
// pelts, clay pots, your best fish and the artifacts you found.
//
// Structure snaps to a 2 m grid (floors and roofs on cells, walls on cell edges); furniture and
// decorations go anywhere on a 25 cm grid and can be turned. Placed pieces are saved and merged
// into a handful of meshes, so a whole house costs only a few draw calls.
import * as THREE from 'three';
import { Builder, M, cloth } from '../world/structures.js';
import { KIND_INFO } from '../world/vegetation.js';
import { buildArtifactMesh } from './artifacts3d.js';
import { itemInfo } from './inventory.js';
import { FISH, PLANTS } from '../data/species.js';
import { buildFish } from '../world/fishModel.js';

const H = 2.6; // wall height
const vcol = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
let VC = null; // vertex-coloured materials for small decorative parts
function vcMats() {
  if (VC) return VC;
  VC = { matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.05 }), glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, transparent: true, opacity: 0.75, emissive: 0x223333 }) };
  return VC;
}
// geometry needs uv + normal for merging with textured parts
const prim = (g) => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };

function shellsGeo(n, spread, y, seed = 1) {
  const parts = []; let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const k = rnd(), r = 0.025 + rnd() * 0.03;
    let g = k < 0.5 ? new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(1, 0.45, 1.15) : k < 0.8 ? new THREE.ConeGeometry(r * 0.6, r * 2.2, 8).rotateZ(Math.PI / 2) : new THREE.SphereGeometry(r, 8, 4).scale(1.6, 0.35, 0.7);
    g = g.toNonIndexed(); vcol(g, k > 0.8 ? '#1e2230' : new THREE.Color().setHSL(0.05 + rnd() * 0.05, 0.2 + rnd() * 0.3, 0.72 + rnd() * 0.16));
    g.rotateY(rnd() * 6.28).translate((rnd() - 0.5) * spread, y + rnd() * 0.03, (rnd() - 0.5) * spread);
    parts.push(prim(g));
  }
  return parts;
}

// ---------------------------------------------------------------- the catalogue
// snap: 'cell' (2 m floor/roof), 'edge' (2 m wall), 'free' (decor). make(b, ctx) builds in local space (front = +z).
export const BUILD = {
  // house: floors
  floor_wood:   { cat: 'house', name: 'Plank floor', cost: { wood: 3 }, snap: 'cell', make: (b) => b.box(M.planks, 2, 0.08, 2, 0, 0.04, 0, { ts: 1.4 }) },
  floor_stone:  { cat: 'house', name: 'Flagstone floor', cost: { stone: 4 }, snap: 'cell', make: (b) => b.box(M.cobble, 2, 0.08, 2, 0, 0.04, 0, { ts: 1.6 }) },
  floor_sand:   { cat: 'house', name: 'Sandstone floor', cost: { sandstone: 3 }, snap: 'cell', make: (b) => b.box(M.sandstone, 2, 0.08, 2, 0, 0.04, 0, { ts: 1.2 }) },
  // house: walls
  wall_plank:   { cat: 'house', name: 'Plank wall', cost: { wood: 3 }, snap: 'edge', make: (b) => { b.box(M.planks, 2, H, 0.14, 0, H / 2, 0, { ts: 1.6 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.1, rot: 0 }); } },
  wall_log:     { cat: 'house', name: 'Log wall', cost: { wood: 5 }, snap: 'edge', make: (b) => { for (let i = 0; i < 9; i++) b.cyl(M.logs, 0.15, 0.15, 2.1, 0, 0.15 + i * 0.29, 0, { rz: Math.PI / 2, seg: 8, ts: 1.4 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.16, rot: 0 }); } },
  wall_window:  { cat: 'house', name: 'Wall with window', cost: { wood: 3, quartz: 1 }, snap: 'edge', make: (b) => {
    b.box(M.planks, 2, 0.95, 0.14, 0, 0.475, 0, { ts: 1.6 }); b.box(M.planks, 2, 0.55, 0.14, 0, H - 0.275, 0, { ts: 1.6 });
    for (const s of [-1, 1]) b.box(M.planks, 0.5, 1.1, 0.14, s * 0.75, 1.5, 0, { ts: 1.6 });
    b.box(M.glass, 1.0, 1.1, 0.03, 0, 1.5, 0); b.box(M.darkwood, 1.08, 0.08, 0.2, 0, 0.98, 0); b.box(M.darkwood, 0.06, 1.1, 0.06, 0, 1.5, 0.04);
    b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.1, rot: 0 }); } },
  wall_door:    { cat: 'house', name: 'Doorway', cost: { wood: 3 }, snap: 'edge', make: (b) => {
    for (const s of [-1, 1]) { b.box(M.planks, 0.55, H, 0.14, s * 0.725, H / 2, 0, { ts: 1.6 }); b.colliders.push({ x: s * 0.725, z: 0, hw: 0.28, hd: 0.1, rot: 0 }); }
    b.box(M.planks, 0.9, H - 2.1, 0.14, 0, 2.1 + (H - 2.1) / 2, 0, { ts: 1.6 }); b.box(M.darkwood, 1.0, 0.1, 0.22, 0, 2.1, 0); } },
  wall_stone:   { cat: 'house', name: 'Stone wall', cost: { stone: 5, clay: 1 }, snap: 'edge', make: (b) => { b.box(M.stone, 2, H, 0.3, 0, H / 2, 0, { ts: 1.8 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.17, rot: 0 }); } },
  wall_sand:    { cat: 'house', name: 'Sandstone wall', cost: { sandstone: 4 }, snap: 'edge', make: (b) => { b.box(M.sandstone, 2, H, 0.3, 0, H / 2, 0, { ts: 1.2 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.17, rot: 0 }); } },
  wall_drift:   { cat: 'house', name: 'Driftwood wall', cost: { driftwood: 4 }, snap: 'edge', make: (b) => { for (let i = 0; i < 10; i++) b.cyl(M.grey, 0.13 - (i % 3) * 0.015, 0.12, 2.0 + (i % 2) * 0.15, (i % 2) * 0.05, 0.13 + i * 0.255, 0, { rz: Math.PI / 2 + (i % 3 - 1) * 0.03, seg: 7, ts: 1.4 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.14, rot: 0 }); } },
  // house: roofs (one 2 × 2 m panel per cell; turn it to choose which way it slopes)
  roof_thatch:  { cat: 'house', name: 'Thatch roof', cost: { wood: 1, fibre: 3 }, snap: 'cell', roof: true, make: (b) => roofPanel(b, M.thatch) },
  roof_tiles:   { cat: 'house', name: 'Tiled roof', cost: { wood: 1, clay: 3 }, snap: 'cell', roof: true, make: (b) => roofPanel(b, M.tiles) },
  roof_frond:   { cat: 'house', name: 'Palm-frond roof', cost: { frond: 4 }, snap: 'cell', roof: true, make: (b) => roofPanel(b, M.frond) },
  roof_flat:    { cat: 'house', name: 'Plank roof', cost: { wood: 3 }, snap: 'cell', roof: true, make: (b) => { b.box(M.planks, 2.1, 0.1, 2.1, 0, H + 0.05, 0, { ts: 1.4 }); } },
  // furniture
  bed:          { cat: 'furniture', name: 'Bed', cost: { wood: 4, fibre: 3, pelt: 1 }, snap: 'free', use: 'rest', make: (b) => {
    b.box(M.darkwood, 1.0, 0.35, 2.0, 0, 0.18, 0); b.box(M.darkwood, 1.0, 0.8, 0.08, 0, 0.4, -1.0);
    b.box(cloth(0xd8d0bc), 0.9, 0.14, 1.85, 0, 0.42, 0.02); b.box(cloth(0x7a4a32), 0.92, 0.06, 1.2, 0, 0.5, 0.35); b.box(cloth(0xeee8dc), 0.55, 0.12, 0.3, 0, 0.53, -0.75);
    b.colliders.push({ x: 0, z: 0, hw: 0.5, hd: 1.0, rot: 0 }); } },
  table:        { cat: 'furniture', name: 'Table', cost: { wood: 3 }, snap: 'free', make: (b) => { b.box(M.planks, 1.4, 0.07, 0.8, 0, 0.76, 0, { ts: 1 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.darkwood, 0.07, 0.74, 0.07, sx * 0.62, 0.37, sz * 0.32); b.colliders.push({ x: 0, z: 0, hw: 0.7, hd: 0.4, rot: 0 }); } },
  bench:        { cat: 'furniture', name: 'Bench', cost: { wood: 2 }, snap: 'free', make: (b) => { b.box(M.planks, 1.4, 0.06, 0.36, 0, 0.45, 0, { ts: 1 }); for (const sx of [-1, 1]) b.box(M.darkwood, 0.08, 0.44, 0.32, sx * 0.6, 0.22, 0); b.colliders.push({ x: 0, z: 0, hw: 0.7, hd: 0.2, rot: 0 }); } },
  chest:        { cat: 'furniture', name: 'Storage chest', cost: { wood: 4, iron: 1 }, snap: 'free', use: 'store', make: (b) => { b.box(M.planks, 1.0, 0.5, 0.6, 0, 0.25, 0, { ts: 0.8 }); b.box(M.darkwood, 1.04, 0.12, 0.64, 0, 0.56, 0); b.box(M.iron, 1.06, 0.05, 0.05, 0, 0.35, 0.31); b.colliders.push({ x: 0, z: 0, hw: 0.5, hd: 0.3, rot: 0 }); } },
  shelf:        { cat: 'furniture', name: 'Display shelf', cost: { wood: 3 }, snap: 'free', make: (b) => { for (let i = 0; i < 3; i++) b.box(M.planks, 1.2, 0.04, 0.35, 0, 0.4 + i * 0.5, 0, { ts: 1 }); for (const sx of [-1, 1]) b.box(M.darkwood, 0.05, 1.5, 0.35, sx * 0.6, 0.75, 0); b.colliders.push({ x: 0, z: 0, hw: 0.6, hd: 0.2, rot: 0 }); } },
  hearth:       { cat: 'furniture', name: 'Stone hearth', cost: { stone: 6, clay: 1 }, snap: 'free', use: 'hearth', fire: true, make: (b) => { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; b.box(M.stone, 0.32, 0.22, 0.24, Math.cos(a) * 0.55, 0.11, Math.sin(a) * 0.55, { ry: -a }); } b.cyl(M.logs, 0.07, 0.07, 0.7, 0, 0.12, 0, { rz: Math.PI / 2, ry: 0.6 }); b.colliders.push({ x: 0, z: 0, r: 0.7 }); } },
  lantern:      { cat: 'furniture', name: 'Lantern post', cost: { wood: 1, copper: 1 }, snap: 'free', light: true, make: (b) => { b.cyl(M.darkwood, 0.06, 0.05, 2.0, 0, 1.0, 0); b.box(M.darkwood, 0.5, 0.05, 0.05, 0.22, 1.95, 0); b.box(M.glow, 0.16, 0.22, 0.16, 0.42, 1.78, 0); b.colliders.push({ x: 0, z: 0, r: 0.12 }); } },
  // decorations
  shell_bowl:   { cat: 'decor', name: 'Bowl of seashells', cost: { shell: 6, clay: 1 }, snap: 'free', make: (b) => {
    const bowl = new THREE.LatheGeometry([[0.0, 0], [0.16, 0.0], [0.22, 0.08], [0.24, 0.12], [0.22, 0.12], [0.15, 0.03], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
    b.add(M.pot, bowl); b.box(M.planks, 0.6, 0.6, 0.6, 0, 0.3, 0, { ts: 0.8 }); bowl.translate(0, 0.6, 0);
    for (const g of shellsGeo(14, 0.28, 0.66, 3)) b.add(vcMats().gloss, g); b.colliders.push({ x: 0, z: 0, r: 0.35 }); } },
  shell_chime:  { cat: 'decor', name: 'Shell wind chime', cost: { shell: 8, fibre: 1, driftwood: 1 }, snap: 'free', chime: true, make: (b) => {
    b.cyl(M.grey, 0.06, 0.05, 2.2, 0, 1.1, 0, { seg: 6 }); b.cyl(M.grey, 0.04, 0.04, 0.9, 0.35, 2.1, 0, { rz: Math.PI / 2, seg: 6 });
    for (let k = 0; k < 5; k++) { const x = 0.0 + k * 0.17; b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.003, 0.003, 0.6, 3).translate(x, 1.8, 0), '#d8d0b8'))); for (const g of shellsGeo(3, 0.02, 0, 10 + k)) { g.translate(x, 1.45 + Math.random() * 0.3, 0); b.add(vcMats().gloss, g); } }
    b.colliders.push({ x: 0, z: 0, r: 0.12 }); } },
  sea_glass:    { cat: 'decor', name: 'Sea-glass mobile', cost: { sea_glass: 4, fibre: 1, driftwood: 1 }, snap: 'free', make: (b) => {
    b.cyl(M.grey, 0.06, 0.05, 2.2, 0, 1.1, 0, { seg: 6 }); b.cyl(M.grey, 0.035, 0.035, 0.8, 0.3, 2.1, 0, { rz: Math.PI / 2, seg: 6 });
    const cols = ['#7ac8b8', '#a8d8c8', '#5aa890', '#c8e0d8', '#6a98c8', '#e8e0c8'];
    for (let k = 0; k < 6; k++) { const x = 0.05 + k * 0.12, y = 1.5 + (k % 3) * 0.15; b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.003, 0.003, 2.1 - y, 3).translate(x, (2.1 + y) / 2, 0), '#d8d0b8'))); b.add(vcMats().glass, prim(vcol(new THREE.DodecahedronGeometry(0.045, 0).scale(1, 1.3, 0.4).toNonIndexed().translate(x, y, 0), cols[k]))); }
    b.colliders.push({ x: 0, z: 0, r: 0.12 }); } },
  drift_sculpture: { cat: 'decor', name: 'Driftwood sculpture', cost: { driftwood: 3 }, snap: 'free', make: (b) => {
    b.box(M.stone, 0.5, 0.15, 0.5, 0, 0.075, 0); for (let k = 0; k < 6; k++) { const a = k * 1.1; b.cyl(M.grey, 0.06 - k * 0.006, 0.03, 1.3 - k * 0.1, Math.cos(a) * 0.12, 0.7 + k * 0.08, Math.sin(a) * 0.12, { rz: 0.3 * Math.sin(a * 2), rx: 0.35 * Math.cos(a), seg: 6 }); }
    b.colliders.push({ x: 0, z: 0, r: 0.3 }); } },
  drift_bench:  { cat: 'decor', name: 'Driftwood bench', cost: { driftwood: 3 }, snap: 'free', make: (b) => { b.cyl(M.grey, 0.16, 0.14, 1.8, 0, 0.42, 0, { rz: Math.PI / 2, seg: 8 }); for (const sx of [-1, 1]) b.cyl(M.grey, 0.12, 0.12, 0.4, sx * 0.6, 0.2, 0, { seg: 7 }); b.colliders.push({ x: 0, z: 0, hw: 0.9, hd: 0.2, rot: 0 }); } },
  drift_fence:  { cat: 'decor', name: 'Driftwood fence', cost: { driftwood: 2 }, snap: 'free', make: (b) => { for (const sx of [-0.95, 0, 0.95]) b.cyl(M.grey, 0.06, 0.05, 1.1, sx, 0.55, 0, { seg: 6 }); for (const y of [0.45, 0.85]) b.cyl(M.grey, 0.045, 0.04, 2.05, 0, y, 0, { rz: Math.PI / 2, seg: 6 }); b.colliders.push({ x: 0, z: 0, hw: 1, hd: 0.08, rot: 0 }); } },
  crystals:     { cat: 'decor', name: 'Crystal display', cost: { quartz: 2 }, snap: 'free', make: (b) => { b.box(M.stone, 0.5, 0.7, 0.5, 0, 0.35, 0); const k = KIND_INFO.crystalGeo?.quartz; if (k) b.add(M.crystal, prim(k.clone().scale(1.6, 1.6, 1.6).translate(0, 0.7, 0))); b.colliders.push({ x: 0, z: 0, r: 0.3 }); } },
  amethyst:     { cat: 'decor', name: 'Amethyst geode', cost: { amethyst: 1 }, snap: 'free', make: (b) => { b.box(M.darkwood, 0.45, 0.6, 0.45, 0, 0.3, 0); const k = KIND_INFO.crystalGeo?.amethyst; if (k) b.add(M.crystal, prim(k.clone().scale(1.5, 1.5, 1.5).translate(0, 0.6, 0))); b.colliders.push({ x: 0, z: 0, r: 0.3 }); } },
  pelt_rug:     { cat: 'decor', name: 'Pelt rug', cost: { pelt: 2 }, snap: 'free', make: (b) => { const s = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, r = 1 + 0.12 * Math.sin(a * 5); s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.7, Math.sin(a) * r * 1.0); } const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).translate(0, 0.095, 0); b.add(M.pelt, g); } },
  flower_pot:   { cat: 'decor', name: 'Pot of wildflowers', cost: { clay: 2 }, snap: 'free', make: (b) => {
    b.add(M.pot, new THREE.CylinderGeometry(0.2, 0.15, 0.35, 14).translate(0, 0.175, 0));
    for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 0.03 + (k % 3) * 0.04, x = Math.cos(a) * r, z = Math.sin(a) * r; b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.004, 0.005, 0.35, 3).translate(x, 0.5, z), '#4a7a30'))); b.add(vcMats().matte, prim(vcol(new THREE.SphereGeometry(0.035, 6, 4).toNonIndexed().translate(x, 0.68, z), ['#e8d040', '#f0f0e8', '#c84a8a', '#8a6ad8'][k % 4]))); }
    b.colliders.push({ x: 0, z: 0, r: 0.2 }); } },
  stone_path:   { cat: 'decor', name: 'Stepping stones', cost: { stone: 2 }, snap: 'free', make: (b) => { for (const [x, z, r] of [[-0.4, -0.3, 0.3], [0.35, 0.1, 0.26], [-0.1, 0.5, 0.24]]) b.cyl(M.stone, r, r * 1.05, 0.06, x, 0.03, z, { seg: 9 }); } },
  stone_cairn:  { cat: 'decor', name: 'Stone cairn', cost: { stone: 4 }, snap: 'free', make: (b) => { let y = 0; for (let k = 0; k < 5; k++) { const r = 0.3 - k * 0.05, h = 0.16 - k * 0.015; b.cyl(M.stone, r, r * 0.9, h, (k % 2) * 0.03, y + h / 2, 0, { seg: 7, ry: k }); y += h; } b.colliders.push({ x: 0, z: 0, r: 0.3 }); } },
  // ---- made with what the village's buildings produce (and for inside your buildings)
  shell_chandelier: { cat: 'decor', name: 'Seashell chandelier', cost: { shell: 16, driftwood: 2, rope: 1, sea_glass: 2 }, snap: 'free', hang: true, light: true, make: (b) => {
    // a driftwood hoop hung from the ceiling on rope, strings of shells and sea glass, candles on the hoop
    b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4).translate(0, -0.35, 0), '#b8a888')));
    const hoop = new THREE.TorusGeometry(0.42, 0.035, 6, 20).rotateX(Math.PI / 2).translate(0, -0.72, 0); b.add(M.grey, prim(hoop));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 3).rotateZ(Math.cos(a) * 0.6).rotateX(-Math.sin(a) * 0.6).translate(Math.cos(a) * 0.21, -0.5, Math.sin(a) * 0.21), '#b8a888'))); }
    for (let k = 0; k < 12; k++) { const a = k * 0.5236, x = Math.cos(a) * 0.42, z = Math.sin(a) * 0.42, len = 0.25 + (k % 3) * 0.12;
      b.add(VCline(), prim(vcol(new THREE.CylinderGeometry(0.003, 0.003, len, 3).translate(x, -0.72 - len / 2, z), '#d8d0b8')));
      for (const g of shellsGeo(2, 0.01, 0, 40 + k)) { g.translate(x, -0.75 - len * 0.5, z); b.add(vcMats().gloss, g); }
      if (k % 3 === 0) b.add(vcMats().glass, prim(vcol(new THREE.DodecahedronGeometry(0.035, 0).translate(x, -0.74 - len, z), ['#7ac8b8', '#a8d8c8', '#6a98c8', '#c8e0d8'][k % 4]))); }
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + 0.4; b.cyl(M.planks, 0.03, 0.03, 0.12, Math.cos(a) * 0.42, -0.62, Math.sin(a) * 0.42, { seg: 6 }); b.box(M.glow, 0.025, 0.04, 0.025, Math.cos(a) * 0.42, -0.53, Math.sin(a) * 0.42); }
  } },
  crystal_lamp: { cat: 'decor', name: 'Crystal lamp', cost: { quartz: 2, copper_ingot: 1, wood: 1 }, snap: 'free', light: true, make: (b) => {
    b.cyl(M.darkwood, 0.18, 0.2, 0.08, 0, 0.04, 0, { seg: 10 }); b.cyl(M.iron, 0.02, 0.02, 1.2, 0, 0.64, 0, { seg: 6 }); b.box(M.glow, 0.14, 0.16, 0.14, 0, 1.3, 0);
    const k = KIND_INFO.crystalGeo?.quartz; if (k) b.add(M.crystal, prim(k.clone().scale(1.1, 1.1, 1.1).translate(0, 1.32, 0))); b.colliders.push({ x: 0, z: 0, r: 0.2 }); } },
  clay_vases: { cat: 'decor', name: 'Clay vases', cost: { pottery: 2 }, snap: 'free', make: (b) => {
    for (const [x, z, h, r] of [[-0.15, 0, 0.55, 0.16], [0.18, 0.08, 0.38, 0.13], [0.02, -0.2, 0.28, 0.1]]) b.add(M.pot, new THREE.LatheGeometry([[0, 0], [r * 0.7, 0], [r, h * 0.35], [r * 0.9, h * 0.7], [r * 0.45, h * 0.88], [r * 0.55, h]].map(([a, y]) => new THREE.Vector2(a, y)), 14).translate(x, 0, z));
    b.colliders.push({ x: 0, z: 0, r: 0.3 }); } },
  woven_rug: { cat: 'decor', name: 'Woven rug', cost: { cloth: 2 }, snap: 'free', make: (b) => {
    const cols = ['#8a3a2a', '#d8c070', '#3a5a7a', '#e8e0cc'];
    for (let k = 0; k < 7; k++) b.add(vcMats().matte, prim(vcol(new THREE.BoxGeometry(2.0, 0.015, 0.2).translate(0, 0.01, -0.6 + k * 0.2), cols[k % 4])));
    b.add(vcMats().matte, prim(vcol(new THREE.BoxGeometry(2.1, 0.012, 1.5).translate(0, 0.004, 0), '#5a2a20'))); } },
  tapestry: { cat: 'decor', name: 'Woven hanging', cost: { cloth: 3, rope: 1, wood: 2 }, snap: 'free', make: (b) => {
    for (const sx of [-1, 1]) b.box(M.darkwood, 0.06, 2.1, 0.06, sx * 0.7, 1.05, 0); b.box(M.darkwood, 1.6, 0.06, 0.06, 0, 2.05, 0);
    const cols = ['#3a5a7a', '#d8c070', '#8a3a2a', '#e8e0cc', '#4a6a3a'];
    for (let k = 0; k < 8; k++) b.add(vcMats().matte, prim(vcol(new THREE.BoxGeometry(1.3, 0.16, 0.02).translate(0, 1.9 - k * 0.16, 0), cols[(k * 3) % 5])));
    b.colliders.push({ x: 0, z: 0, hw: 0.75, hd: 0.08, rot: 0 }); } },
  bookshelf: { cat: 'furniture', name: 'Shelves of curios', cost: { wood: 6, pottery: 1 }, snap: 'free', make: (b) => {
    for (let i = 0; i < 4; i++) b.box(M.planks, 1.2, 0.05, 0.35, 0, 0.1 + i * 0.5, 0); for (const sx of [-1, 1]) b.box(M.darkwood, 0.05, 1.7, 0.35, sx * 0.6, 0.85, 0); b.box(M.darkwood, 1.2, 1.7, 0.03, 0, 0.85, -0.17);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) b.add(M.pot, new THREE.CylinderGeometry(0.05, 0.05, 0.14 + (k % 2) * 0.06, 8).translate(-0.4 + k * 0.27, 0.2 + i * 0.5 + 0.08, 0));
    b.colliders.push({ x: 0, z: 0, hw: 0.62, hd: 0.2, rot: 0 }); } },
  fish_trophy:  { cat: 'decor', name: 'Mounted fish', cost: { wood: 1, anyfish: 1 }, snap: 'free', fish: true, make: (b) => { b.box(M.darkwood, 0.08, 1.4, 0.08, 0, 0.7, 0); b.box(M.planks, 0.9, 0.4, 0.05, 0, 1.45, 0, { ts: 0.6 }); b.colliders.push({ x: 0, z: 0, r: 0.15 }); } },
};
function roofPanel(b, mat) {
  // a pitched panel spanning a 2 m cell, high edge at the back (−z), low edge at the front (+z)
  const pitch = 0.42, L = 2.25 / Math.cos(pitch);
  b.box(mat, 2.25, 0.14, L, 0, H + Math.tan(pitch) * 1.0 + 0.07, 0, { rx: pitch, ts: 2.2 });
  b.box(M.darkwood, 2.2, 0.12, 0.12, 0, H + 0.04, 1.0);
}
let LINE = null; function VCline() { return LINE || (LINE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); }

export const BUILD_CATS = [['house', 'House'], ['furniture', 'Furniture'], ['decor', 'Decorations'], ['display', 'Your finds']];

// ---------------------------------------------------------------- placement maths
export function snapPose(def, x, z, rot) {
  if (def.snap === 'cell') return { x: Math.floor(x / 2) * 2 + 1, z: Math.floor(z / 2) * 2 + 1, rot: Math.round(rot / (Math.PI / 2)) * (Math.PI / 2) };
  if (def.snap === 'edge') {
    // nearest cell edge: horizontal edges lie on even z, vertical edges on even x
    const ex = Math.round(x / 2) * 2, ez = Math.round(z / 2) * 2;
    if (Math.abs(z - ez) < Math.abs(x - ex)) return { x: Math.floor(x / 2) * 2 + 1, z: ez, rot: 0 };
    return { x: ex, z: Math.floor(z / 2) * 2 + 1, rot: Math.PI / 2 };
  }
  return { x: Math.round(x * 4) / 4, z: Math.round(z * 4) / 4, rot: Math.round(rot / (Math.PI / 8)) * (Math.PI / 8) };
}
// "any of a kind" costs: any fish, any game meat, any edible green you have identified
const MEAT = ['hare', 'squirrel', 'crab', 'crayfish'];
export function anyKeys(store, kind) {
  return Object.keys(store).filter((k) => store[k] > 0 && (kind === 'anyfish' ? !!FISH[k] : kind === 'anymeat' ? MEAT.includes(k) : kind === 'anygreen' ? k.startsWith('v:') && PLANTS[k.slice(2)]?.kind === 'green' && ['edible', 'caution'].includes(PLANTS[k.slice(2)]?.status) : false));
}
const ANY = { anyfish: 'fish', anymeat: 'game meat', anygreen: 'edible greens' };
export function canAfford(store, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if (ANY[k]) { if (anyKeys(store, k).reduce((a, x) => a + store[x], 0) < v) return false; continue; }
    if ((store[k] || 0) < v) return false;
  }
  return true;
}
export function payCost(store, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if (ANY[k]) { let n = v; for (const x of anyKeys(store, k)) { const t = Math.min(n, store[x]); store[x] -= t; n -= t; if (!store[x]) delete store[x]; if (!n) break; } continue; }
    store[k] -= v; if (store[k] <= 0) delete store[k];
  }
}
export function costText(cost, store = null) { return Object.entries(cost).map(([k, v]) => { const have = store ? (ANY[k] ? anyKeys(store, k).reduce((a, x) => a + store[x], 0) : store[k] || 0) : null; const t = `${v} ${ANY[k] || itemInfo(k).name.toLowerCase()}`; return store ? `<span class="${have >= v ? 'ok' : 'no'}">${t} (${have})</span>` : t; }).join(', '); }

// build one placed piece into a master builder (world space). Returns { colliders, statics, extra }
export function buildPiece(master, piece, h0, save) {
  const def = BUILD[piece.t]; if (!def && piece.t !== 'artifact') return null;
  const tb = new Builder();
  const extra = [];
  if (piece.t === 'artifact') { tb.box(M.darkwood, 0.55, 0.9, 0.55, 0, 0.45, 0); tb.box(M.planks, 0.62, 0.05, 0.62, 0, 0.92, 0); tb.colliders.push({ x: 0, z: 0, r: 0.35 }); }
  else def.make(tb, piece);
  const mx = new THREE.Matrix4().makeRotationY(piece.rot || 0).setPosition(piece.x, h0 + (piece.y || 0), piece.z);
  for (const [mat, geos] of tb.parts) for (const g of geos) { g.applyMatrix4(mx); master.add(mat, g); }
  const c = Math.cos(piece.rot || 0), s = Math.sin(piece.rot || 0);
  const colliders = tb.colliders.map((col) => ({ ...col, x: piece.x + col.x * c + col.z * s, z: piece.z - col.x * s + col.z * c, rot: (col.rot || 0) - (piece.rot || 0), y: def?.roof ? h0 + H : undefined }));
  if (def?.roof) colliders.length = 0;
  // things that are objects of their own: artifacts and mounted fish
  if (piece.t === 'artifact') { const a = save.artifacts.find((q) => q.uid === piece.uid); if (a) { const m = buildArtifactMesh(a); m.scale.multiplyScalar(1.6); m.position.set(piece.x, h0 + 0.95, piece.z); m.rotation.y = piece.rot || 0; extra.push({ obj: m, artifact: a }); } }
  if (def?.fish && piece.fish) { const f = buildFish(piece.fish); const L = (FISH[piece.fish].size[1] * 0.75) / 100; f.scale.setScalar(Math.min(0.85, L)); f.position.set(piece.x + s * 0.06, h0 + 1.45, piece.z + c * 0.06); f.rotation.y = (piece.rot || 0) - Math.PI / 2; extra.push({ obj: f }); }
  return { colliders, def, mx };
}

// what aiming at this point would place (with validity), or which piece it would remove
export function aimPoint(camera, h0, maxD = 9) {
  const o = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
  if (d.y > -0.04) return null;
  const t = (o.y - h0) / -d.y; if (t > maxD) return null;
  return new THREE.Vector3(o.x + d.x * t, h0, o.z + d.z * t);
}
