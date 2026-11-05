// Procedural architecture kit: cabins, pavilion hall, workshop, storehouse, palisade, ruins,
// standing stones, grotto, trading stall. Geometry is merged per material for few draw calls;
// surfaces use scanned Poly Haven textures with UVs scaled in metres.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { tex, loadModel } from '../core/assets.js';
import { RNG } from '../core/rng.js';
import { KIND_INFO } from './vegetation.js';

const MATS = {};
// `gain` brightens dark scans so timber and plaster read at a natural albedo under ACES tone mapping
function surf(name, { rough = 0.9, color = 0xffffff, gain = 1, folder = 'build' } = {}) {
  const key = folder + name + color + gain;
  if (MATS[key]) return MATS[key];
  const c = new THREE.Color(color).multiplyScalar(gain);
  return (MATS[key] = new THREE.MeshStandardMaterial({ map: tex(`${folder}/${name}_diff.jpg`), normalMap: tex(`${folder}/${name}_nor.jpg`, { srgb: false }), roughness: rough, color: c }));
}
export const M = {
  get planks() { return surf('weathered_planks', { gain: 1.8 }); },
  get logs() { return surf('rough_wood', { gain: 1.35 }); },
  get thatch() { return surf('thatch_roof_angled', { gain: 1.6 }); },
  get tiles() { return surf('roof_tiles_14', { rough: 0.8, gain: 1.5 }); },
  get plaster() { return surf('plastered_stone_wall', { gain: 2.6 }); },
  get brick() { return surf('rock_wall_08', { folder: 'terrain', color: 0xc8ccb8, gain: 1.5 }); },
  get cobble() { return surf('cobblestone_floor_08'); },
  get grey() { return surf('wood_planks_grey', { gain: 2.2 }); },
  get stone() { return surf('stone_wall'); },
  get sandstone() { return surf('red_sandstone_wall', { folder: 'terrain', color: 0xe0a478, gain: 1.25 }); },
  get darkwood() { return surf('weathered_planks', { color: 0x8a7462 }); },
  get pot() { return surf('red_dirt_mud_01', { folder: 'terrain', color: 0xd88a60, gain: 1.4, rough: 0.8 }); },
  get frond() { return surf('thatch_roof_angled', { color: 0xa8c070, gain: 1.4 }); },
  pelt: new THREE.MeshStandardMaterial({ color: 0x8a6448, roughness: 1, side: THREE.DoubleSide }),
  crystal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, emissive: 0x111111, envMapIntensity: 1.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a1d1c, roughness: 0.12, metalness: 0.2, emissive: 0x000000 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffb25a, emissiveIntensity: 0.0, roughness: 0.6 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.5, metalness: 0.8 }),
};
export const cloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide });

// ---------------------------------------------------------------- builder
export class Builder {
  constructor() { this.parts = new Map(); this.colliders = []; this.points = []; this.extra = []; }
  add(mat, geo) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push(geo); return geo; }
  // box with UVs scaled in metres (ts = metres per texture repeat)
  box(mat, w, h, d, x, y, z, { ry = 0, rx = 0, rz = 0, ts = 2 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
    g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z);
    return this.add(mat, g);
  }
  cyl(mat, r0, r1, h, x, y, z, { seg = 8, ry = 0, rx = 0, rz = 0, ts = 2 } = {}) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * r0) / ts, uv.getY(i) * h / ts);
    g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z);
    return this.add(mat, g);
  }
  gable(mat, w, h, x, y, z, ry = 0, ts = 2) { // triangular gable wall, base width w, height h, centred at x,z, base at y
    const g = new THREE.BufferGeometry();
    const t = 0.18;
    const P = [[-w / 2, 0, t / 2], [w / 2, 0, t / 2], [0, h, t / 2], [-w / 2, 0, -t / 2], [0, h, -t / 2], [w / 2, 0, -t / 2]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(P.map((p) => [(p[0] + w / 2) / ts, p[1] / ts]).flat(), 2));
    g.setIndex([0, 1, 2, 3, 4, 5]); g.computeVertexNormals();
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    ng.rotateY(ry); ng.translate(x, y, z);
    return this.add(mat, ng);
  }
  finish(name = 'structure') {
    const group = new THREE.Group(); group.name = name;
    for (const [mat, geos] of this.parts) {
      const keep = mat.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
      const clean = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!keep.includes(a)) n.deleteAttribute(a); if (!n.attributes.normal) n.computeVertexNormals(); if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
      const merged = BGU.mergeGeometries(clean);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.disposable = true;
      group.add(mesh);
    }
    for (const e of this.extra) group.add(e);
    return group;
  }
}

// ---------------------------------------------------------------- props from models
const PROPS = {};
export async function loadProps() {
  for (const n of ['wooden_crate_01', 'wooden_bucket_01', 'ceramic_vase_01', 'antique_ceramic_vase_01', 'brass_vase_01', 'wooden_axe', 'fish']) {
    const gltf = await loadModel(n);
    let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    mesh.updateWorldMatrix(true, false);
    PROPS[n] = mesh;
  }
}
export function prop(name, { tint = null } = {}) {
  const src = PROPS[name]; if (!src) return new THREE.Group();
  const m = new THREE.Mesh(src.geometry, tint ? src.material.clone() : src.material);
  if (tint) m.material.color = new THREE.Color(tint);
  m.applyMatrix4(src.matrixWorld);
  const g = new THREE.Group(); g.add(m); m.castShadow = true; m.receiveShadow = true;
  return g;
}

// ---------------------------------------------------------------- buildings
// All builders produce a structure in local space; `place` transforms it into the world.
export function cabin(b, o = {}) {
  const w = o.w ?? 6, d = o.d ?? 5, H = o.h ?? 2.7, pitch = o.pitch ?? 0.68;
  const wall = o.wall ?? M.logs, roof = o.roof ?? M.thatch, t = 0.24;
  const ox = o.x ?? 0, oz = o.z ?? 0, ry = o.ry ?? 0;
  const B = (mat, ww, hh, dd, x, y, z, opt = {}) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    return b.box(mat, ww, hh, dd, ox + x * c + z * s, y, oz - x * s + z * c, { ...opt, ry: (opt.ry || 0) + ry });
  };
  // foundation
  B(M.stone, w + 0.3, 0.5, d + 0.3, 0, 0.1, 0, { ts: 2.5 });
  // walls
  B(wall, w, H, t, 0, 0.35 + H / 2, d / 2 - t / 2, { ts: 2.2 });
  B(wall, w, H, t, 0, 0.35 + H / 2, -d / 2 + t / 2, { ts: 2.2 });
  B(wall, t, H, d - 2 * t, w / 2 - t / 2, 0.35 + H / 2, 0, { ts: 2.2 });
  B(wall, t, H, d - 2 * t, -w / 2 + t / 2, 0.35 + H / 2, 0, { ts: 2.2 });
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(M.darkwood, 0.32, H + 0.1, 0.32, sx * (w / 2 - 0.08), 0.35 + H / 2, sz * (d / 2 - 0.08), { ts: 1.5 });
  // door + frame (front = +z)
  const dx = o.doorX ?? 0;
  B(M.darkwood, 1.1, 2.05, 0.08, dx, 0.35 + 1.03, d / 2 + 0.03, { ts: 1.2 });
  B(M.darkwood, 1.4, 0.14, 0.14, dx, 0.35 + 2.12, d / 2 + 0.05);
  // windows
  for (const wx of o.windows ?? [w / 2 - 1.3]) {
    B(M.glass, 0.8, 0.7, 0.05, wx, 0.35 + 1.55, d / 2 + 0.02);
    B(M.darkwood, 0.96, 0.08, 0.1, wx, 0.35 + 1.94, d / 2 + 0.05); B(M.darkwood, 0.96, 0.08, 0.1, wx, 0.35 + 1.16, d / 2 + 0.05);
    B(M.darkwood, 0.06, 0.7, 0.08, wx, 0.35 + 1.55, d / 2 + 0.05);
  }
  for (const wz of o.sideWindows ?? [0]) B(M.glass, 0.05, 0.6, 0.7, w / 2 + 0.02, 0.35 + 1.55, wz);
  // gables & roof
  const rise = (d / 2) * Math.tan(pitch);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const sx of [-1, 1]) {
    const lx = sx * (w / 2 - t / 2);
    b.gable(o.gableMat ?? wall, d, rise, ox + lx * c, 0.35 + H, oz - lx * s, ry + Math.PI / 2);
  }
  const over = 0.45, L = w + 2 * over, slope = (d / 2 + over) / Math.cos(pitch);
  for (const sz of [-1, 1]) {
    if (o.brokenRoof && sz === 1) {
      B(roof, L * 0.45, 0.16, slope, -L * 0.27, 0.35 + H + rise / 2 - over * Math.tan(pitch) / 2 + 0.05, sz * (d / 4 + over / 2 - 0.05), { rx: sz * pitch, ts: 2.5 });
      continue;
    }
    B(roof, L, 0.18, slope, 0, 0.35 + H + rise / 2 - over * Math.tan(pitch) / 2 + 0.05, sz * (d / 4 + over / 2 - 0.05), { rx: sz * pitch, ts: 2.5 });
  }
  B(M.darkwood, L, 0.2, 0.2, 0, 0.35 + H + rise + 0.05, 0);
  let chimney = null;
  if (o.chimney !== false) {
    const cx = -w / 2 + 1.0, ch = rise + 1.4;
    B(M.stone, 0.7, ch + H * 0.3, 0.7, cx, 0.35 + H * 0.85 + ch / 2, -d / 4, { ts: 1.6 });
    chimney = new THREE.Vector3(ox + cx * c + (-d / 4) * s, 0.35 + H * 0.85 + ch + H * 0.15, oz - cx * s + (-d / 4) * c);
  }
  b.colliders.push({ x: ox, z: oz, hw: w / 2 + 0.25, hd: d / 2 + 0.25, rot: -ry });
  const door = new THREE.Vector3(ox + dx * c + (d / 2 + 1.0) * s, 0, oz - dx * s + (d / 2 + 1.0) * c);
  return { chimney, door, windowMat: M.glass };
}

export function postsAndRoof(b, o) {
  const { w, d, H = 2.8, x = 0, z = 0, roof = M.thatch, pitch = 0.5, posts = 3 } = o;
  for (let i = 0; i < posts; i++) for (const sz of [-1, 1]) {
    const px = x - w / 2 + 0.2 + (i / (posts - 1)) * (w - 0.4), pz = z + sz * (d / 2 - 0.2);
    b.cyl(M.logs, 0.14, 0.12, H, px, H / 2, pz, { seg: 7, ts: 1.5 });
    b.colliders.push({ x: px, z: pz, r: 0.2 });
  }
  const rise = (d / 2) * Math.tan(pitch), over = 0.5, slope = (d / 2 + over) / Math.cos(pitch);
  for (const sz of [-1, 1]) b.box(roof, w + 1.0, 0.16, slope, x, H + rise / 2 - over * Math.tan(pitch) / 2 + 0.08, z + sz * (d / 4 + over / 2 - 0.05), { rx: sz * pitch, ts: 2.5 });
  b.box(M.darkwood, w + 1, 0.2, 0.2, x, H + rise + 0.08, z);
  for (const sz of [-1, 1]) b.box(M.darkwood, w, 0.2, 0.2, x, H, z + sz * (d / 2 - 0.2));
}

export function palisade(b, R, gateAngle, gateHalf = 0.11, extra = []) {
  const inExtra = (a, pad = 0) => extra.some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) < g.half + pad);
  const n = Math.floor((Math.PI * 2 * R) / 0.42);
  const logs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let da = Math.atan2(Math.sin(a - gateAngle), Math.cos(a - gateAngle));
    if (Math.abs(da) < gateHalf || inExtra(a)) continue;
    const h = 3.0 + Math.sin(i * 12.9) * 0.25;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    b.cyl(M.logs, 0.2, 0.19, h, x, h / 2 - 0.3, z, { seg: 6, ts: 1.4 });
    b.cyl(M.logs, 0.19, 0.0, 0.45, x, h - 0.3 + 0.22, z, { seg: 6, ts: 1.4 });
    if (i % 2 === 0) b.colliders.push({ x, z, r: 0.42 });
  }
  // cross rails inside
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2;
    const am = (a0 + a1) / 2; let da = Math.atan2(Math.sin(am - gateAngle), Math.cos(am - gateAngle));
    if (Math.abs(da) < gateHalf + 0.06 || inExtra(am, 0.04)) continue;
    const r2 = R - 0.25, x0 = Math.cos(a0) * r2, z0 = Math.sin(a0) * r2, x1 = Math.cos(a1) * r2, z1 = Math.sin(a1) * r2;
    const len = Math.hypot(x1 - x0, z1 - z0);
    b.box(M.darkwood, len + 0.1, 0.14, 0.12, (x0 + x1) / 2, 1.9, (z0 + z1) / 2, { ry: -Math.atan2(z1 - z0, x1 - x0) });
  }
  // gate posts & lintel
  const gx = Math.cos(gateAngle) * R, gz = Math.sin(gateAngle) * R;
  const tx = -Math.sin(gateAngle), tz = Math.cos(gateAngle);
  const half = R * gateHalf;
  for (const s of [-1, 1]) {
    b.cyl(M.logs, 0.3, 0.28, 5, gx + tx * half * s, 2.2, gz + tz * half * s, { seg: 8 });
    b.colliders.push({ x: gx + tx * half * s, z: gz + tz * half * s, r: 0.4 });
  }
  b.box(M.darkwood, half * 2 + 1.0, 0.35, 0.4, gx, 4.4, gz, { ry: -Math.atan2(tz, tx) });
  b.box(M.darkwood, half * 2 + 0.6, 0.25, 0.3, gx, 3.9, gz, { ry: -Math.atan2(tz, tx) });
  // smaller gates (e.g. to the garden)
  for (const g of extra) {
    const ex = Math.cos(g.a) * R, ez = Math.sin(g.a) * R, etx = -Math.sin(g.a), etz = Math.cos(g.a), eh = R * g.half;
    for (const s of [-1, 1]) { b.cyl(M.logs, 0.22, 0.2, 3.6, ex + etx * eh * s, 1.5, ez + etz * eh * s, { seg: 8 }); b.colliders.push({ x: ex + etx * eh * s, z: ez + etz * eh * s, r: 0.32 }); }
    b.box(M.darkwood, eh * 2 + 0.6, 0.25, 0.3, ex, 3.2, ez, { ry: -Math.atan2(etz, etx) });
  }
  return { gate: new THREE.Vector3(gx, 0, gz), tangent: new THREE.Vector3(tx, 0, tz) };
}

export function lanternPost(b, x, z, h = 2.4) {
  b.cyl(M.darkwood, 0.08, 0.07, h, x, h / 2, z, { seg: 6 });
  b.box(M.darkwood, 0.5, 0.06, 0.06, x + 0.22, h - 0.05, z);
  b.box(M.glow, 0.2, 0.28, 0.2, x + 0.42, h - 0.3, z);
  b.box(M.iron, 0.24, 0.04, 0.24, x + 0.42, h - 0.14, z);
  b.colliders.push({ x, z, r: 0.15 });
  return new THREE.Vector3(x + 0.42, h - 0.3, z);
}

export function well(b, x, z) {
  b.cyl(M.stone, 0.95, 0.95, 0.85, x, 0.42, z, { seg: 14, ts: 1.6 });
  b.cyl(M.glass, 0.78, 0.78, 0.02, x, 0.75, z, { seg: 14 });
  for (const s of [-1, 1]) b.box(M.darkwood, 0.14, 2.2, 0.14, x + s * 0.85, 1.1, z);
  b.box(M.darkwood, 2.0, 0.12, 0.12, x, 2.0, z);
  for (const s of [-1, 1]) b.box(M.thatch, 2.4, 0.08, 1.2, x, 2.35, z + s * 0.45, { rx: s * 0.6 });
  b.colliders.push({ x, z, r: 1.05 });
}

// broken stone walls of a ruin
export function ruinWalls(b, seed, size = 9) {
  const rng = new RNG(seed);
  const segs = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, 0.2, 1], [-0.3, 1, -1, 1], [-1, 1, -1, -1]];
  for (const [ax, az, bx, bz] of segs) {
    const x0 = ax * size / 2, z0 = az * size / 2, x1 = bx * size / 2, z1 = bz * size / 2;
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 1.2), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, h = Math.max(0.3, rng.range(0.4, 3.8) * (0.4 + 0.6 * Math.sin(t * 3.1)));
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      b.box(M.brick, len / n + 0.02, h, 0.7, x, h / 2 - 0.2, z, { ry, ts: 2.2 });
      b.colliders.push({ x, z, r: 0.6 });
    }
  }
  for (let i = 0; i < 10; i++) {
    const s = rng.range(0.3, 0.7);
    b.box(M.brick, s * 1.4, s, s, rng.range(-size, size) * 0.7, s / 2 - 0.1, rng.range(-size, size) * 0.7, { ry: rng.next() * 3, rz: rng.range(-0.3, 0.3), ts: 2.2 });
  }
  b.box(M.cobble, size - 0.6, 0.1, size - 0.6, 0, -0.02, 0, { ts: 2.5 });
  // a fallen arch / doorway
  b.box(M.brick, 0.7, 3.2, 0.8, size * 0.1 - 0.9, 1.4, size / 2, { ts: 2.2 });
  b.box(M.brick, 0.7, 2.1, 0.8, size * 0.1 + 1.2, 0.85, size / 2, { ts: 2.2 });
}

export function stall(b, x, z, color) {
  postsAndRoof(b, { w: 3.2, d: 2.2, H: 2.3, x, z, roof: null, posts: 2 }); // posts only (roof replaced by cloth)
  b.parts.delete(null);
  const c = cloth(color);
  for (const sz of [-1, 1]) b.box(c, 4.0, 0.04, 1.5, x, 2.65, z + sz * 0.6, { rx: sz * 0.42, ts: 2 });
  b.box(M.planks, 2.8, 0.1, 0.9, x, 0.95, z + 0.45);
  for (const s of [-1, 1]) b.box(M.darkwood, 0.1, 0.9, 0.8, x + s * 1.3, 0.45, z + 0.45);
  b.colliders.push({ x, z: z + 0.45, hw: 1.5, hd: 0.5, rot: 0 });
}

// pedestal for artifact display; returns the top position
export function pedestal(b, x, z, ry = 0, base = 0) {
  b.box(M.stone, 0.62, 0.9, 0.62, x, base + 0.45, z, { ts: 1.4, ry });
  b.box(M.planks, 0.72, 0.06, 0.72, x, base + 0.93, z, { ry });
  b.colliders.push({ x, z, r: 0.42 });
  return new THREE.Vector3(x, base + 0.96, z);
}

// The rock-model kinds are defined in vegetation.js; structures sometimes reuse them as meshes
export function rockMesh(kind, scale, rot = 0, sy = 1) {
  const info = KIND_INFO[kind];
  const m = new THREE.Mesh(info.geometry, info.material);
  m.scale.set(scale, scale * sy, scale); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
  return m;
}
