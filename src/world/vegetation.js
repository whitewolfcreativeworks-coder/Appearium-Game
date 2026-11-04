// Vegetation & small-object kinds: procedural trees built from scanned (Poly Haven) bark and
// foliage cards, model-based plants/rocks, blade grass, mushrooms, crystals.
// Every kind is registered as an instanced pool; scatter code only pushes transforms.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../core/rng.js';
import { tex, modelParts, splitVariants } from '../core/assets.js';
import { buildMushroom, buildPlant, MUSHROOM_SPECS, PROCEDURAL_PLANTS, floraMaterials } from './flora.js';
import { definePrintKinds } from './trails.js';

export const MUSHROOM_WORLD_SCALE = 1.3; // slightly enlarged so finds read at a glance; still close to life size

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

const FRONT_FACING_FIX = THREE.ShaderChunk.normal_fragment_begin.replace(/gl_FrontFacing \? 1\.0 : - 1\.0/g, '1.0');

// Adds sway in the vertex shader. Geometry provides `aSway` (0 = rigid, 1 = tip).
export function addWind(mat, { amp = 0.14, flutter = 0.03, keepNormals = false, fadeDist = 0 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev && prev.call(mat, shader, r);
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aSway; uniform float uTime; uniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
  vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
  #endif
  float ph = dot(ip.xz, vec2(0.137, 0.173));
  float s = aSway * uWind;
  // rolling gusts: waves of wind travelling across the land (also used by the wind sound)
  float wave = 0.5 + 0.5 * sin(dot(ip.xz, vec2(0.045, 0.026)) - uTime * 0.85);
  float gust = 0.45 + 0.35 * sin(uTime * 0.37 + ip.x * 0.011) + 0.9 * wave * wave * wave;
  transformed.x += (sin(uTime * 1.25 + ph) * ${amp.toFixed(3)} * gust + sin(uTime * 6.3 + ph * 3.0 + position.y * 2.1) * ${flutter.toFixed(3)}) * s;
  transformed.z += (cos(uTime * 1.05 + ph * 1.3) * ${(amp * 0.7).toFixed(3)} * gust + cos(uTime * 5.7 + ph * 2.0 + position.x * 2.3) * ${flutter.toFixed(3)}) * s;
  ${fadeDist ? `
  vec4 wpos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  float camD = distance(wpos.xz, cameraPosition.xz);
  transformed.y *= smoothstep(${fadeDist.toFixed(1)}, ${(fadeDist * 0.72).toFixed(1)}, camD);` : ''}
}`);
    if (keepNormals) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', FRONT_FACING_FIX);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => key + `wind${amp}${flutter}${keepNormals}${fadeDist}`;
  return mat;
}

// ------------------------------------------------------------------ geometry helpers
function quad(P, out, uvRect, swayA, swayB, nrm) {
  // P: 4 corner Vector3 (base-left, tip-left, tip-right, base-right) ; uvRect [u0,v0,u1,v1]
  const [u0, v0, u1, v1] = uvRect;
  const base = out.pos.length / 3;
  for (const p of P) out.pos.push(p.x, p.y, p.z);
  out.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
  out.sway.push(swayA, swayB, swayB, swayA);
  for (const n of nrm) out.nrm.push(n.x, n.y, n.z);
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
function toGeometry(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(o.sway, 1));
  g.setIndex(o.idx);
  g.computeBoundingSphere();
  return g;
}
const newBuf = () => ({ pos: [], nrm: [], uv: [], sway: [], idx: [] });

function trunkGeo(height, r0, r1, seg = 8, hseg = 5, bend = 0, rng = null, uvScale = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, height, seg, hseg, true);
  g.translate(0, height / 2, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / height;
    p.setX(i, p.getX(i) + Math.sin(t * 2.2) * bend);
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r0 * 6.3 / 1.2)) * uvScale, (y / 1.6) * uvScale);
  }
  g.computeVertexNormals();
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count).map((_, i) => Math.pow(p.getY(i) / height, 2) * 0.25), 1));
  g.deleteAttribute('uv') ; g.setAttribute('uv', uv);
  return g;
}

function limbGeo(from, to, r0, r1) {
  const dir = new THREE.Vector3().subVectors(to, from); const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q); g.translate(from.x, from.y, from.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * len / 1.6);
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(0.3), 1));
  return g;
}

// ------------------------------------------------------------------ trees
export function buildConifer(seed, { height = 15, lod = 0 } = {}) {
  const rng = new RNG(seed);
  const H = height * rng.range(0.85, 1.15);
  const r0 = 0.018 * H + 0.08;
  const trunk = trunkGeo(H * 0.98, r0, r0 * 0.12, lod ? 6 : 8, lod ? 2 : 6, rng.range(-0.15, 0.15));
  const f = newBuf();
  const y0 = H * rng.range(0.18, 0.3);
  const crownR = H * rng.range(0.2, 0.26);
  const spacing = (lod ? 0.95 : 0.42) * (H / 15);
  const per = lod ? 4 : 7;
  const up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let y = y0; y < H * 0.96; y += spacing * rng.range(0.85, 1.15)) {
    const t = (y - y0) / (H - y0);
    const r = crownR * Math.pow(1 - t, 0.9) + 0.35;
    for (let i = 0; i < per; i++, k++) {
      const a = k * 2.39996 + rng.range(-0.3, 0.3);
      const droop = rng.range(-0.25, 0.05) - (1 - t) * 0.35;
      const dir = new THREE.Vector3(Math.cos(a), droop, Math.sin(a)).normalize();
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      const roll = rng.range(-0.95, 0.95);
      side.applyAxisAngle(dir, roll);
      const L = r * rng.range(0.85, 1.15), W = L * 0.52;
      const b = new THREE.Vector3(0, y, 0).addScaledVector(dir, Math.min(0.1, r0));
      const tip = b.clone().addScaledVector(dir, L);
      const P = [b.clone().addScaledVector(side, -W / 2), tip.clone().addScaledVector(side, -W / 2), tip.clone().addScaledVector(side, W / 2), b.clone().addScaledVector(side, W / 2)];
      const out = new THREE.Vector3(dir.x, 0.55, dir.z).normalize();
      const nTip = out.clone(), nBase = new THREE.Vector3(dir.x * 0.4, 1, dir.z * 0.4).normalize();
      // texture: u along branch (0 = stem base), v across
      quad(P, f, [0, 0, 1, 1], 0.15 + t * 0.2, 0.6 + t * 0.4, [nBase, nTip, nTip, nBase]);
    }
  }
  // leader tip: two crossed vertical cards
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI / 2 + rng.next();
    const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const L = Math.max(1.2, H * 0.09), W = L * 0.5, yb = H * 0.9;
    const P = [new THREE.Vector3(0, yb, 0).addScaledVector(side, -W / 2), new THREE.Vector3(0, yb + L, 0).addScaledVector(side, -W / 2), new THREE.Vector3(0, yb + L, 0).addScaledVector(side, W / 2), new THREE.Vector3(0, yb, 0).addScaledVector(side, W / 2)];
    quad(P, f, [0, 0, 1, 1], 0.6, 1.0, [up, up, up, up]);
  }
  return { trunk, foliage: toGeometry(f), height: H, radius: r0 };
}

export function buildBroadleaf(seed, { height = 13, lod = 0 } = {}) {
  const rng = new RNG(seed);
  const H = height * rng.range(0.85, 1.15);
  const r0 = 0.02 * H + 0.12;
  const tH = H * rng.range(0.45, 0.6);
  const parts = [trunkGeo(tH, r0, r0 * 0.6, lod ? 6 : 9, 4, rng.range(-0.2, 0.2))];
  const top = new THREE.Vector3(0, tH * 0.95, 0);
  const crownC = new THREE.Vector3(0, H * 0.66, 0);
  const Rx = H * rng.range(0.27, 0.36), Ry = H * rng.range(0.26, 0.33);
  const limbs = lod ? 3 : 5;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const end = new THREE.Vector3(Math.cos(a) * Rx * 0.6, crownC.y + rng.range(-0.1, 0.4) * Ry, Math.sin(a) * Rx * 0.6);
    parts.push(limbGeo(top, end, r0 * 0.55, r0 * 0.15));
  }
  const trunk = BGU.mergeGeometries(parts.map((g) => { g.deleteAttribute('normal'); return g; }));
  trunk.computeVertexNormals();
  const f = newBuf();
  const N = lod ? 26 : 64;
  for (let i = 0; i < N; i++) {
    const u = rng.next() * 2 - 1, th = rng.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const shell = Math.cbrt(rng.range(0.35, 1));
    const n = new THREE.Vector3(s * Math.cos(th), u * 0.9 + 0.1, s * Math.sin(th)).normalize();
    const c = new THREE.Vector3(n.x * Rx * shell, n.y * Ry * shell, n.z * Rx * shell).add(crownC);
    const size = (lod ? 3.2 : 2.3) * rng.range(0.8, 1.2) * (H / 13);
    // card plane: "up" (twig direction) roughly outward+up, facing direction random around the normal
    const upv = new THREE.Vector3(n.x, n.y + 0.7, n.z).normalize();
    const side = new THREE.Vector3().crossVectors(upv, n).normalize();
    side.applyAxisAngle(upv, rng.range(-0.8, 0.8));
    const base = c.clone().addScaledVector(upv, -size * 0.45);
    const tip = c.clone().addScaledVector(upv, size * 0.55);
    const P = [base.clone().addScaledVector(side, -size / 2), tip.clone().addScaledVector(side, -size / 2), tip.clone().addScaledVector(side, size / 2), base.clone().addScaledVector(side, size / 2)];
    const nn = n.clone().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
    quad(P, f, [0, 0, 1, 1], 0.45 * shell, 0.9 * shell + 0.1, [nn, nn, nn, nn]);
  }
  return { trunk, foliage: toGeometry(f), height: H, radius: r0 };
}

export function buildSnag(seed) {
  const rng = new RNG(seed);
  const H = rng.range(6, 11), r0 = rng.range(0.18, 0.3);
  const parts = [trunkGeo(H, r0, r0 * 0.25, 7, 5, rng.range(-0.3, 0.3))];
  for (let i = 0; i < 4; i++) {
    const y = H * rng.range(0.35, 0.85), a = rng.next() * 6.28, L = rng.range(0.8, 2.2);
    parts.push(limbGeo(new THREE.Vector3(0, y, 0), new THREE.Vector3(Math.cos(a) * L, y + rng.range(0.2, 1.0), Math.sin(a) * L), r0 * 0.3, 0.02));
  }
  const g = BGU.mergeGeometries(parts.map((p) => { p.deleteAttribute('normal'); return p; }));
  g.computeVertexNormals();
  return { trunk: g, height: H, radius: r0 };
}

// ------------------------------------------------------------------ grass, mushrooms, crystals, branches
export function buildGrassClump(seed, blades = 18) {
  const rng = new RNG(seed);
  const pos = [], nrm = [], col = [], sway = [], idx = [];
  const segs = 2;
  const base = new THREE.Color(), tip = new THREE.Color(), dryC = new THREE.Color().setRGB(0.7, 0.62, 0.4, THREE.SRGBColorSpace);
  for (let b = 0; b < blades; b++) {
    const r = Math.sqrt(rng.next()) * 0.32, a = rng.next() * 6.283;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    const h = rng.range(0.16, 0.42) * (1 - r * 0.8), w = rng.range(0.008, 0.016);
    const dir = rng.next() * 6.283, lean = rng.range(0.15, 0.55);
    const dx = Math.cos(dir), dz = Math.sin(dir);
    const sx = -dz, sz = dx;
    const dry = rng.chance(0.22) ? rng.range(0.3, 0.75) : rng.range(0, 0.15);
    base.setRGB(0.2, 0.25, 0.1, THREE.SRGBColorSpace); tip.setRGB(0.5, 0.56, 0.28, THREE.SRGBColorSpace).offsetHSL(rng.range(-0.025, 0.03), rng.range(-0.1, 0.05), rng.range(-0.04, 0.05));
    const v0 = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const off = lean * t * t * h;
      const cx = ox + dx * off, cz = oz + dz * off, cy = h * t * (1 - lean * 0.3 * t);
      const ww = w * (1 - t * 0.95);
      pos.push(cx - sx * ww, cy, cz - sz * ww, cx + sx * ww, cy, cz + sz * ww);
      const n = [dx * 0.25, 1, dz * 0.25];
      nrm.push(...n, ...n);
      const c = base.clone().lerp(tip, Math.pow(t, 0.7)).lerp(dryC, dry * t);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      sway.push(t * t, t * t);
    }
    for (let s = 0; s < segs; s++) { const i0 = v0 + s * 2; idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  return g;
}

function colorize(g, c) {
  const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

export function buildReeds(seed) {
  const rng = new RNG(seed);
  const pos = [], col = [], sway = [], idx = [];
  const c0 = new THREE.Color(), c1 = new THREE.Color();
  for (let b = 0; b < 26; b++) {
    const a = rng.next() * 6.28, r = Math.sqrt(rng.next()) * 0.5, ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    const h = rng.range(1.1, 1.9), w = rng.range(0.012, 0.022), lean = rng.range(0.05, 0.3), dir = rng.next() * 6.28;
    const dx = Math.cos(dir), dz = Math.sin(dir), sx = -dz, sz = dx;
    c0.setRGB(0.18, 0.24, 0.1); c1.setRGB(0.46, 0.5, 0.26).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.05, 0.05));
    const v0 = pos.length / 3;
    for (let k = 0; k <= 3; k++) {
      const t = k / 3, off = lean * t * t * h, ww = w * (1 - t * 0.9);
      const cx = ox + dx * off, cz = oz + dz * off, cy = h * t;
      pos.push(cx - sx * ww, cy, cz - sz * ww, cx + sx * ww, cy, cz + sz * ww);
      const c = c0.clone().lerp(c1, t); col.push(c.r, c.g, c.b, c.r, c.g, c.b); sway.push(t * t, t * t);
    }
    for (let k = 0; k < 3; k++) { const i0 = v0 + k * 2; idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); }
    if (b % 6 === 0) { // bulrush (cattail) seed head
      const ch = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6).translate(ox + dx * lean * h * 0.8, h * 0.82, oz + dz * lean * h * 0.8);
      const base = pos.length / 3; const p = ch.attributes.position, ix = ch.index.array;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(0.28, 0.16, 0.08); sway.push(0.7); }
      for (let i = 0; i < ix.length; i++) idx.push(base + ix[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildLilyPad(seed, flower) {
  const rng = new RNG(seed); const parts = [];
  for (let i = 0; i < 3; i++) {
    const R = rng.range(0.12, 0.2), notch = 0.35;
    const g = new THREE.CircleGeometry(R, 20, notch / 2, Math.PI * 2 - notch).rotateX(-Math.PI / 2).rotateY(rng.next() * 6.28).translate(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3));
    const c = new THREE.Color(0.16, 0.3, 0.1).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.04, 0.04));
    const p = g.attributes.position, a = new Float32Array(p.count * 3); const cx = p.getX(0), cz = p.getZ(0);
    for (let k = 0; k < p.count; k++) { const r = Math.hypot(p.getX(k) - cx, p.getZ(k) - cz) / R; const cc = c.clone().multiplyScalar(0.85 + r * 0.35); if (r > 0.92) cc.setRGB(0.4, 0.22, 0.12); a[k * 3] = cc.r; a[k * 3 + 1] = cc.g; a[k * 3 + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g);
  }
  if (flower) { // white water-lily
    for (let k = 0; k < 10; k++) { const pet = new THREE.SphereGeometry(0.03, 6, 4).scale(0.45, 0.3, 1).translate(0, 0.02, 0.03).rotateX(-0.5 - (k > 5 ? 0.4 : 0)).rotateY(k * 1.05); colorize(pet, new THREE.Color(0.95, 0.94, 0.9)); parts.push(pet); }
    const centre = new THREE.SphereGeometry(0.012, 6, 4).translate(0, 0.03, 0); colorize(centre, new THREE.Color(0.9, 0.75, 0.2)); parts.push(centre);
  }
  const g = BGU.mergeGeometries(parts.map((x) => { const n = x.index ? x.toNonIndexed() : x; if (n.attributes.uv) n.deleteAttribute('uv'); if (n.attributes.normal) n.deleteAttribute('normal'); return n; }));
  g.computeVertexNormals();
  return g;
}

export function buildCrystals(seed, color) {
  const rng = new RNG(seed);
  const parts = [];
  const n = rng.int(4, 8);
  for (let i = 0; i < n; i++) {
    const h = rng.range(0.15, 0.5), r = h * rng.range(0.12, 0.2);
    const g = new THREE.CylinderGeometry(0, r, h * 0.3, 6, 1).translate(0, h * 0.85, 0);
    const b = new THREE.CylinderGeometry(r, r * 0.9, h * 0.7, 6, 1).translate(0, h * 0.35, 0);
    let m = BGU.mergeGeometries([g.toNonIndexed(), b.toNonIndexed()]);
    m.rotateX(rng.range(-0.6, 0.6)); m.rotateZ(rng.range(-0.6, 0.6));
    m.translate(rng.range(-0.12, 0.12), 0, rng.range(-0.12, 0.12));
    parts.push(colorize(m, new THREE.Color(color).offsetHSL(0, 0, rng.range(-0.08, 0.08))));
  }
  const g = BGU.mergeGeometries(parts); g.computeVertexNormals();
  return g;
}

export function buildBranches(seed) {
  const rng = new RNG(seed);
  const parts = [];
  for (let i = 0; i < rng.int(3, 5); i++) {
    const L = rng.range(0.9, 1.8), r = rng.range(0.025, 0.05);
    const a = rng.next() * 6.28;
    const from = new THREE.Vector3(rng.range(-0.2, 0.2), r, rng.range(-0.2, 0.2));
    const to = from.clone().add(new THREE.Vector3(Math.cos(a) * L, rng.range(0, 0.08), Math.sin(a) * L));
    const g = limbGeo(from, to, r, r * 0.6); g.deleteAttribute('aSway');
    parts.push(g);
  }
  const g = BGU.mergeGeometries(parts); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ kind registry
export const KIND_INFO = {}; // key -> { radius (collider), modelHeight }

function prepModelMaterial(mat, { wind = false, amp = 0.05 } = {}) {
  const m = mat.clone();
  if (m.transparent || m.alphaTest > 0) {
    if (m.transparent) { m.transparent = false; m.alphaTest = 0.5; }
    m.alphaTest = Math.max(m.alphaTest, 0.4);
    m.side = THREE.DoubleSide;
  }
  m.envMapIntensity = 0.8;
  if (wind) addWind(m, { amp, flutter: 0.015 });
  return m;
}

function swayFromHeight(g, power = 1.5) {
  g.computeBoundingBox();
  const top = Math.max(0.01, g.boundingBox.max.y);
  const p = g.attributes.position; const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = Math.pow(Math.max(0, p.getY(i)) / top, power);
  g.setAttribute('aSway', new THREE.BufferAttribute(a, 1));
  return g;
}

export async function defineKinds(pools, quality) {
  const cap = quality.capacity;
  // materials ---------------------------------------------------------------
  const barkConifer = new THREE.MeshStandardMaterial({ map: tex('build/pine_bark_diff.jpg'), normalMap: tex('build/pine_bark_nor.jpg', { srgb: false }), roughness: 0.95 });
  const barkBroad = new THREE.MeshStandardMaterial({ map: tex('build/bark_brown_02_diff.jpg'), normalMap: tex('build/bark_brown_02_nor.jpg', { srgb: false }), roughness: 0.95 });
  const barkSnag = barkBroad.clone(); barkSnag.color = new THREE.Color(0.75, 0.72, 0.68);
  const firTex = tex('foliage/conifer_branch.png', { repeat: false });
  const leafTex = tex('foliage/leaf_cluster.png', { repeat: false });
  const firMat = addWind(new THREE.MeshStandardMaterial({ map: firTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, color: 0xd8e4d0, emissive: 0x2a3a1c, emissiveMap: firTex, emissiveIntensity: 0.55 }), { amp: 0.1, flutter: 0.02, keepNormals: true });
  const leafMat = addWind(new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, emissive: 0x30401c, emissiveMap: leafTex, emissiveIntensity: 0.5 }), { amp: 0.14, flutter: 0.05, keepNormals: true });
  // shadow casting uses alpha-tested depth automatically (map + alphaTest)
  for (const m of [barkConifer, barkBroad, barkSnag]) addWind(m, { amp: 0.06, flutter: 0 });
  KIND_INFO.materials = { barkConifer, barkBroad, firMat, leafMat };

  // procedural trees ---------------------------------------------------------
  const treeCap = cap.trees;
  for (let v = 0; v < 4; v++) {
    const H = [17, 13, 21, 9][v];
    const near = buildConifer(1000 + v, { height: H, lod: 0 });
    const far = buildConifer(1000 + v, { height: H, lod: 1 });
    pools.defineKind(`conifer${v}@near`, [{ geometry: near.trunk, material: barkConifer, castShadow: true }, { geometry: near.foliage, material: firMat, castShadow: true, colored: true }], treeCap.near);
    pools.defineKind(`conifer${v}@far`, [{ geometry: far.trunk, material: barkConifer }, { geometry: far.foliage, material: firMat, colored: true }], treeCap.far);
    KIND_INFO[`conifer${v}`] = { radius: near.radius + 0.1, height: near.height, tree: true };
  }
  for (let v = 0; v < 3; v++) {
    const H = [13, 10, 16][v];
    const near = buildBroadleaf(2000 + v, { height: H, lod: 0 });
    const far = buildBroadleaf(2000 + v, { height: H, lod: 1 });
    pools.defineKind(`broad${v}@near`, [{ geometry: near.trunk, material: barkBroad, castShadow: true }, { geometry: near.foliage, material: leafMat, castShadow: true, colored: true }], treeCap.near);
    pools.defineKind(`broad${v}@far`, [{ geometry: far.trunk, material: barkBroad }, { geometry: far.foliage, material: leafMat, colored: true }], treeCap.far);
    KIND_INFO[`broad${v}`] = { radius: near.radius + 0.1, height: near.height, tree: true };
  }
  for (let v = 0; v < 2; v++) {
    const s = buildSnag(3000 + v);
    pools.defineKind(`snag${v}@near`, [{ geometry: s.trunk, material: barkSnag, castShadow: true }], 600);
    pools.defineKind(`snag${v}@far`, [{ geometry: s.trunk, material: barkSnag }], 1200);
    KIND_INFO[`snag${v}`] = { radius: s.radius + 0.05, tree: true };
  }

  // grass ----------------------------------------------------------------------
  const grassMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.45 }), { amp: 0.07, flutter: 0.025, keepNormals: true, fadeDist: quality.grassRadius });
  for (let v = 0; v < 2; v++) pools.defineKind(`grass${v}`, [{ geometry: buildGrassClump(77 + v, quality.grassBlades), material: grassMat, castShadow: false, colored: true }], cap.grass);
  KIND_INFO.grassMat = grassMat;

  // models ---------------------------------------------------------------------
  const defineModel = async (name, key, { split = false, wind = false, amp = 0.05, capacity = 1500, castShadow = false, radius = 0, colored = false, scale = 1, gain = 1 } = {}) => {
    const { geometry, material } = await modelParts(name);
    const mat = prepModelMaterial(material, { wind, amp });
    if (gain !== 1) { mat.color.multiplyScalar(gain); mat.roughness = 1; mat.metalness = 0; mat.roughnessMap = null; mat.metalnessMap = null; mat.needsUpdate = true; }
    let geos = split ? splitVariants(geometry) : [geometry];
    if (!split) { geometry.computeBoundingBox(); const b = geometry.boundingBox; geometry.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); }
    geos = geos.slice(0, 4);
    geos.forEach((g, i) => {
      if (scale !== 1) g.scale(scale, scale, scale);
      if (wind) swayFromHeight(g);
      g.computeBoundingBox();
      pools.defineKind(`${key}${i}`, [{ geometry: g, material: mat, castShadow, colored }], capacity);
      KIND_INFO[`${key}${i}`] = { radius, height: g.boundingBox.max.y, geometry: g, material: mat };
    });
    KIND_INFO[key] = { variants: geos.length };
    return geos;
  };
  await Promise.all([
    defineModel('fern_02', 'fern', { split: true, wind: true, amp: 0.05, capacity: cap.small }),
    defineModel('nettle_plant', 'nettle', { split: true, wind: true, amp: 0.04, capacity: 600 }),
    defineModel('celandine_01', 'celandine', { split: true, wind: true, amp: 0.03, capacity: 600 }),
    defineModel('dandelion_01', 'dandelion', { split: true, wind: true, amp: 0.03, capacity: 600 }),
    defineModel('rock_07', 'pebble', { capacity: 800, castShadow: false, gain: 1.8 }),
    defineModel('rock_07', 'boulder', { capacity: 900, castShadow: true, radius: 0.9, scale: 9, gain: 2.0 }),
    defineModel('rock_moss_set_01', 'rockset', { split: true, capacity: 500, castShadow: true, radius: 1.2 }),
    defineModel('tree_stump_01', 'stump', { capacity: 400, castShadow: true, radius: 0.55 }),
    defineModel('dead_tree_trunk', 'log', { capacity: 400, castShadow: true }),
  ]);
  await defineModel('shrub_02', 'shrub', { split: true, wind: true, amp: 0.04, capacity: cap.small, castShadow: true });

  // species-accurate mushrooms & forage plants (see flora.js) -----------------
  const FM = floraMaterials();
  addWind(FM.plant, { amp: 0.035, flutter: 0.012 }); addWind(FM.berryMatte, { amp: 0.035, flutter: 0.012 }); addWind(FM.berryGloss, { amp: 0.035, flutter: 0.012 });
  const sway = (g, top) => { const p = g.attributes.position; const a = new Float32Array(p.count); for (let i = 0; i < p.count; i++) a[i] = Math.pow(Math.max(0, p.getY(i)) / top, 1.5); g.setAttribute('aSway', new THREE.BufferAttribute(a, 1)); };
  for (const id of Object.keys(MUSHROOM_SPECS)) {
    for (let v = 0; v < 2; v++) {
      const res = buildMushroom(id, 101 + v * 17, { scale: MUSHROOM_WORLD_SCALE });
      pools.defineKind(`mush_${id}${v}`, res.parts.map((p) => ({ geometry: p.geometry, material: p.material })), 260);
    }
    KIND_INFO[`mush_${id}`] = { variants: 2 };
  }
  for (const id of PROCEDURAL_PLANTS) {
    for (let v = 0; v < 2; v++) {
      const res = buildPlant(id, 301 + v * 23);
      for (const p of res.parts) sway(p.geometry, Math.max(0.15, res.top));
      pools.defineKind(`plant_${id}${v}`, res.parts.map((p) => ({ geometry: p.geometry, material: p.material, castShadow: res.top > 0.5 })), 400);
    }
    KIND_INFO[`plant_${id}`] = { variants: 2 };
  }
  KIND_INFO.floraMats = FM;
  definePrintKinds(pools);
  // water margins
  const reedMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), { amp: 0.09, flutter: 0.02, keepNormals: true });
  for (let v = 0; v < 2; v++) pools.defineKind(`reeds${v}`, [{ geometry: buildReeds(500 + v), material: reedMat }], 1500);
  const lilyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide });
  for (let v = 0; v < 2; v++) pools.defineKind(`lilies${v}`, [{ geometry: buildLilyPad(600 + v, v === 1), material: lilyMat }], 1500);
  const feather = new THREE.PlaneGeometry(0.03, 0.14).rotateX(-Math.PI / 2); colorize(feather, new THREE.Color(0.92, 0.92, 0.9));
  pools.defineKind('feather0', [{ geometry: feather, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }) }], 200);

  // procedural props ----------------------------------------------------------
  const crystalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.05, emissive: 0x111111, envMapIntensity: 1.6 });
  for (const [name, c] of [['quartz', 0xe8eef2], ['copper', 0x3fa27c], ['amethyst', 0x7a48b0], ['iron', 0x6b5a50]]) {
    pools.defineKind(`crystal_${name}`, [{ geometry: buildCrystals(40 + name.length, c), material: name === 'iron' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.6 }) : crystalMat }], 300);
  }
  pools.defineKind('branches0', [{ geometry: buildBranches(9), material: barkBroad }], 600);
  pools.defineKind('branches1', [{ geometry: buildBranches(19), material: barkConifer }], 600);
  return KIND_INFO;
}
