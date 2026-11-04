// Procedural, species-accurate mushrooms and forage plants.
// Each species is built so that its real identification features are physically present:
// gills vs. ridges vs. pores vs. spines, rings, volvas, stem nets, warts, scales, berry calyces...
// Everything is vertex-coloured so a species is one or two instanced draw calls.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG } from '../core/rng.js';

const C = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- shared materials & textures
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
let MATS = null;
export function floraMaterials() {
  if (MATS) return MATS;
  const pore = canvasTex(128, (g, s) => { // stippled pore surface (greyscale, tinted by vertex colour)
    g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 5) for (let x = 0; x < s; x += 5) {
      g.fillStyle = `rgba(60,50,30,${0.35 + Math.random() * 0.25})`;
      g.beginPath(); g.arc(x + 2.5 + (y % 10 ? 2.5 : 0) + Math.random(), y + 2.5 + Math.random(), 1.2 + Math.random() * 0.6, 0, 7); g.fill();
    }
  });
  const net = (light) => canvasTex(128, (g, s) => {
    g.fillStyle = light ? '#cfc8bb' : '#ffffff'; g.fillRect(0, 0, s, s);
    g.strokeStyle = light ? '#ffffff' : '#3b2a1c'; g.lineWidth = light ? 2 : 3;
    for (let i = 0; i < 60; i++) { // irregular mesh of elongated cells
      const x = Math.random() * s, y = Math.random() * s;
      g.beginPath(); g.ellipse(x, y, 6 + Math.random() * 5, 12 + Math.random() * 8, 0, 0, Math.PI * 2); g.stroke();
    }
  });
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide });
  MATS = {
    body,
    glossy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: THREE.DoubleSide }),
    pore: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, map: pore, side: THREE.DoubleSide }),
    netLight: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, map: net(true) }),
    netDark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, map: net(false) }),
    glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x7dff9c, emissiveIntensity: 0 }),
    plant: leafLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide })),
    berryMatte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    berryGloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.05 }),
  };
  return MATS;
}

// leaves are thin and translucent: light both faces with the same (upward) normal
function leafLit(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/gl_FrontFacing \? 1\.0 : - 1\.0/g, '1.0')); };
  m.customProgramCacheKey = () => 'leafLit';
  return m;
}

// ---------------------------------------------------------------- geometry helpers
function paint(geo, fn) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function solid(geo, color) { const c = C(color); return paint(geo, (o) => o.copy(c)); }
function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) n.deleteAttribute(a);
  const cnt = n.attributes.position.count;
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.color) n.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(1), 3));
  return n;
}
function merge(list) { if (!list.length) return null; const g = BGU.mergeGeometries(list.map(clean)); g.computeVertexNormals(); return g; }
function lathe(points, seg = 18) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg); }
const lerpC = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

// ---------------------------------------------------------------- mushroom specification
// sizes in metres. shapes: convex | bun | umbo | funnel | conical | bell | flatconvex
const M_SPEC = {
  chanterelle: { capR: 0.038, capH: 0.03, shape: 'funnel', cap: '#e8a628', cap2: '#f0b43a', under: 'ridges', underCol: '#e9ad35', stemH: 0.045, stemR: 0.009, stemR0: 0.006, stemCol: '#e8aa38', wavy: 0.12, count: [2, 5] },
  false_chanterelle: { capR: 0.03, capH: 0.016, shape: 'funnel', cap: '#d9701c', cap2: '#a8471a', under: 'gills', underCol: '#f07e1c', gillN: 70, stemH: 0.035, stemR: 0.005, stemR0: 0.004, stemCol: '#c86a20', wavy: 0.05, count: [2, 5], curve: 0.4 },
  jack_o_lantern: { capR: 0.05, capH: 0.03, shape: 'funnel', cap: '#e8681a', cap2: '#d2520f', under: 'gills', underCol: '#ef7a1e', gillN: 60, decurrent: true, stemH: 0.07, stemR: 0.009, stemR0: 0.006, stemCol: '#d8621a', wavy: 0.06, cluster: [5, 8], glow: true },
  porcini: { capR: 0.08, capH: 0.065, shape: 'bun', cap: '#7a4a24', cap2: '#9a6434', under: 'pores', underCol: '#e6dca0', stemH: 0.08, stemR: 0.026, stemR0: 0.04, stemCol: '#d8ccb0', stemMat: 'netLight', count: [1, 3] },
  bitter_bolete: { capR: 0.075, capH: 0.055, shape: 'bun', cap: '#8a6440', cap2: '#9c7550', under: 'pores', underCol: '#e3c2c0', stemH: 0.08, stemR: 0.022, stemR0: 0.032, stemCol: '#d6c3a6', stemMat: 'netDark', count: [1, 3] },
  hedgehog: { capR: 0.05, capH: 0.022, shape: 'flatconvex', cap: '#e2b47a', cap2: '#d8a868', under: 'spines', underCol: '#f0c890', stemH: 0.035, stemR: 0.01, stemR0: 0.011, stemCol: '#efe4d0', wavy: 0.14, offset: 0.25, count: [2, 5] },
  death_cap: { capR: 0.055, capH: 0.035, shape: 'flatconvex', cap: '#b3b277', cap2: '#8f9255', pattern: 'streaks', under: 'gills', underCol: '#f4f2ea', gillN: 64, stemH: 0.11, stemR: 0.008, stemR0: 0.012, stemCol: '#f0eee4', ring: { at: 0.78, size: 2.4, col: '#efede0' }, volva: true, bulb: true, count: [1, 3] },
  fly_agaric: { capR: 0.08, capH: 0.042, shape: 'flatconvex', cap: '#d41c12', cap2: '#e35a14', pattern: 'warts', under: 'gills', underCol: '#f6f3ea', gillN: 70, stemH: 0.15, stemR: 0.012, stemR0: 0.02, stemCol: '#f4f1e6', ring: { at: 0.8, size: 2.2, col: '#f6f2e2' }, bulb: true, baseScales: true, count: [1, 3] },
  liberty_cap: { capR: 0.009, capH: 0.016, shape: 'conical', cap: '#b28a4c', cap2: '#7c5a30', under: 'gills', underCol: '#4e3a3c', gillN: 20, stemH: 0.07, stemR: 0.0012, stemR0: 0.0014, stemCol: '#d8c8a4', curve: 0.5, mat: 'glossy', count: [4, 9], spread: 0.25 },
  parasol: { capR: 0.13, capH: 0.045, shape: 'umbo', cap: '#e4d8c2', cap2: '#6a4a2c', pattern: 'scales', under: 'gills', underCol: '#f2ece0', gillN: 90, stemH: 0.26, stemR: 0.009, stemR0: 0.016, stemCol: '#d6c6a8', stemPattern: 'snake', ring: { at: 0.85, size: 2.4, col: '#e8e0d0', double: true }, bulb: true, count: [1, 2] },
  shaggy_inkcap: { capR: 0.024, capH: 0.1, shape: 'bell', cap: '#f2efe8', cap2: '#b8a890', pattern: 'shaggy', under: 'gills', underCol: '#e9d6d2', gillEdge: '#2a2626', gillN: 40, stemH: 0.12, stemR: 0.007, stemR0: 0.009, stemCol: '#f4f2ee', ring: { at: 0.15, size: 1.8, col: '#ece8e0' }, count: [2, 5] },
  sulphur_tuft: { capR: 0.026, capH: 0.016, shape: 'flatconvex', cap: '#d8c43a', cap2: '#c27a2a', pattern: 'darkCenter', under: 'gills', underCol: '#a8b04a', gillN: 44, stemH: 0.06, stemR: 0.004, stemR0: 0.003, stemCol: '#d2b440', curve: 0.5, cluster: [8, 14] },
  honey_fungus: { capR: 0.04, capH: 0.022, shape: 'flatconvex', cap: '#c09450', cap2: '#6e4e2a', pattern: 'darkCenter', under: 'gills', underCol: '#eadfc6', gillN: 48, stemH: 0.08, stemR: 0.006, stemR0: 0.006, stemCol: '#c2a274', ring: { at: 0.82, size: 2.0, col: '#f0e8d6' }, curve: 0.4, cluster: [6, 10] },
  giant_puffball: { ball: true, r: 0.14, col: '#f4f1ea', inside: '#fbfaf6', count: [1, 2] },
  earthball: { ball: true, r: 0.04, col: '#b8954e', crack: '#6a5030', inside: '#2c1e2c', marbled: true, count: [2, 4] },
  chicken_of_the_woods: { bracket: true, r: 0.14, col: '#f2a01e', col2: '#f8d43a', count: [3, 5] },
};

function capProfile(shape, s) {
  // returns [topPoints, underPoints] in normalised units (r 0..1 of capR, y 0..1 of capH); under goes rim → stem
  const st = s.stemR / s.capR;
  switch (shape) {
    case 'bun': return [[[0, 1], [0.4, 0.97], [0.72, 0.84], [0.93, 0.52], [1, 0.2], [0.97, 0.04]], [[0.9, 0.0], [0.55, -0.02], [st, 0.02]]];
    case 'umbo': return [[[0, 0.62], [0.1, 0.7], [0.2, 0.52], [0.5, 0.32], [0.82, 0.14], [1, 0.02], [0.98, -0.03]], [[0.85, -0.02], [0.5, 0.05], [st, 0.12]]];
    case 'funnel': return [[[0, 0.18], [0.3, 0.42], [0.65, 0.78], [0.92, 1.0], [1.0, 0.86]], [[0.88, 0.5], [0.55, 0.12], [st * 1.05, -0.6]]];
    case 'conical': return [[[0, 1.25], [0.08, 1.1], [0.25, 0.95], [0.6, 0.55], [0.9, 0.15], [1, 0]], [[0.75, 0.04], [st, 0.12]]];
    case 'bell': return [[[0, 1], [0.5, 0.97], [0.8, 0.82], [0.95, 0.45], [1, 0.0]], [[0.92, 0.02], [0.6, 0.25], [st * 1.1, 0.75]]];
    case 'flatconvex': default: return [[[0, 0.78], [0.4, 0.72], [0.75, 0.52], [0.95, 0.22], [1, 0.05], [0.97, 0]], [[0.85, 0.02], [0.55, 0.07], [st, 0.12]]];
  }
}

function interpUnder(under, r) { // y at radius r along under profile (rim → stem)
  for (let i = 0; i < under.length - 1; i++) {
    const a = under[i], b = under[i + 1];
    if ((r <= a[0] && r >= b[0]) || (r >= a[0] && r <= b[0])) { const t = (r - a[0]) / ((b[0] - a[0]) || 1e-6); return a[1] + (b[1] - a[1]) * t; }
  }
  return under[under.length - 1][1];
}

// one fruiting body. returns {parts:{mat: [geos]}, top}
function agaric(s, rng, scale = 1) {
  const parts = { body: [], pore: [], netLight: [], netDark: [], glow: [], glossy: [] };
  const bodyKey = s.mat || 'body';
  const R = s.capR * scale, H = s.capH * scale, SH = s.stemH * scale * rng.range(0.85, 1.15), sr = s.stemR * scale, sr0 = s.stemR0 * scale;
  const [topN, under0] = capProfile(s.shape, s);
  const underN = [topN[topN.length - 1], ...under0];
  const capY = SH;
  const wav = s.wavy || 0, ph = rng.range(0, 6.28), lobes = rng.int(4, 7);
  const warp = (g) => { // wavy rim, slight asymmetry
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / R; const a = Math.atan2(z, x); const k = 1 + wav * Math.sin(a * lobes + ph) * r * r; p.setX(i, x * k); p.setZ(i, z * k); }
    return g;
  };
  // --- cap top
  const capC = C(s.cap), capC2 = C(s.cap2 || s.cap);
  const top = warp(lathe(topN.map(([r, y]) => [r * R, capY + y * H]), 28));
  const stripes = s.pattern === 'streaks';
  paint(top, (c, x, y, z) => {
    const r = Math.hypot(x, z) / R, a = Math.atan2(z, x);
    c.copy(lerpC(capC2, capC, s.pattern === 'darkCenter' || s.pattern === 'scales' ? Math.pow(r, 0.6) : r));
    if (stripes) c.multiplyScalar(0.94 + 0.08 * Math.sin(a * 80 + Math.sin(a * 7) * 3));
    if (s.pattern === 'scales' && r < 0.16) c.copy(capC2);
    c.multiplyScalar(0.94 + rng.next() * 0.08);
  });
  parts[bodyKey].push(top);
  // --- underside
  const under = warp(lathe(underN.map(([r, y]) => [r * R, capY + y * H]), 28));
  const uC = C(s.underCol);
  if (s.under === 'pores') { paint(under, (c) => c.copy(uC)); const uv = under.attributes.uv; const p = under.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / R * 3, p.getZ(i) / R * 3); parts.pore.push(under); }
  else { paint(under, (c) => c.copy(uC).multiplyScalar(0.92)); parts[s.glow ? 'glow' : bodyKey].push(under); }
  const yAt = (r) => capY + interpUnder(underN, r / R) * H;
  if (s.under === 'gills') {
    const n = s.gillN || 48, depth = (s.shape === 'bell' ? 0.12 : s.shape === 'funnel' ? 0.045 : 0.16) * R;
    const edgeC = C(s.gillEdge || s.underCol);
    const gills = [];
    for (let i = 0; i < n * 2; i++) {
      const full = i % 2 === 0;
      const a = (i / (n * 2)) * Math.PI * 2;
      const r0 = full ? sr * 1.2 : R * 0.55, r1 = R * 0.95;
      const segs = 4, pos = [], idx = [];
      for (let k = 0; k <= segs; k++) {
        const r = r0 + (r1 - r0) * (k / segs); const y = yAt(r);
        const d = depth * Math.sin(Math.PI * Math.min(1, (k / segs) * 1.1 + 0.05)) * (s.decurrent && k === 0 ? 0.3 : 1);
        const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        pos.push(cx, y - 0.0004, cz, cx, y - d, cz);
      }
      for (let k = 0; k < segs; k++) { const b = k * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      paint(g, (c, x, y) => c.copy(uC).lerp(edgeC, s.gillEdge ? 0.7 : 0).multiplyScalar(0.85 + 0.15 * ((y - capY) / H + 1)));
      gills.push(warp(g));
    }
    parts[s.glow ? 'glow' : bodyKey].push(...gills);
  } else if (s.under === 'ridges') {
    // blunt, forking, decurrent ridges running from the rim down onto the stem
    const n = 26, ridges = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.04, 0.04);
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; const r = R * 0.92 * (1 - t) + sr * 1.02 * t; pts.push([r, yAt(r), a + Math.sin(t * 5 + i) * 0.03]); }
      const add = (list, a0, fork) => {
        const pos = [], idx = [];
        list.forEach(([r, y, aa], k) => { const A = aa + (fork ? fork * (1 - k / (list.length - 1)) : 0); const cx = Math.cos(A) * r, cz = Math.sin(A) * r; pos.push(cx, y - 0.0003, cz, cx * 0.99, y - 0.0022 * scale, cz * 0.99); });
        for (let k = 0; k < list.length - 1; k++) { const b = k * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        ridges.push(warp(paint(g, (c) => c.copy(uC).multiplyScalar(1.05))));
      };
      add(pts, a, 0);
      if (i % 2 === 0) add(pts.slice(0, 3), a, 0.12); // fork near the rim
    }
    parts[bodyKey].push(...ridges);
  } else if (s.under === 'spines') {
    const cone = new THREE.ConeGeometry(0.0016 * scale * 2, 0.007 * scale * 2.2, 4).rotateX(Math.PI).translate(0, -0.0035 * scale * 2.2, 0);
    for (let i = 0; i < 260; i++) {
      const r = Math.sqrt(rng.next()) * R * 0.92 + sr; if (r > R * 0.94) continue;
      const a = rng.next() * 6.283;
      parts[bodyKey].push(solid(cone.clone().translate(Math.cos(a) * r, yAt(r), Math.sin(a) * r), s.underCol));
    }
  }
  // --- cap ornaments
  if (s.pattern === 'warts') {
    const w = new THREE.IcosahedronGeometry(0.0045 * scale * 2, 0).scale(1, 0.55, 1);
    const prof = topN.map(([r, y]) => [r * R, capY + y * H]);
    for (let i = 0; i < 70; i++) {
      const r = Math.sqrt(rng.next()) * R * 0.9, a = rng.next() * 6.283;
      let y = capY; for (let k = 0; k < prof.length - 1; k++) if (r >= prof[k][0] && r <= prof[k + 1][0]) { const t = (r - prof[k][0]) / (prof[k + 1][0] - prof[k][0]); y = prof[k][1] + (prof[k + 1][1] - prof[k][1]) * t; }
      parts.body.push(solid(w.clone().scale(rng.range(0.6, 1.4), 1, rng.range(0.6, 1.4)).translate(Math.cos(a) * r, y + 0.0008, Math.sin(a) * r), '#f4efe2'));
    }
  }
  if (s.pattern === 'scales' || s.pattern === 'shaggy') {
    const flake = new THREE.PlaneGeometry(0.008 * scale * (s.pattern === 'shaggy' ? 1.6 : 2.2), 0.006 * scale * 2).rotateX(-Math.PI / 2);
    const prof = topN.map(([r, y]) => [r * R, capY + y * H]);
    const hAt = (r) => { for (let k = 0; k < prof.length - 1; k++) { const a0 = prof[k], b0 = prof[k + 1]; if ((r >= a0[0] && r <= b0[0]) || (r <= a0[0] && r >= b0[0])) return a0[1] + (b0[1] - a0[1]) * ((r - a0[0]) / ((b0[0] - a0[0]) || 1e-6)); } return capY; };
    const rings = s.pattern === 'shaggy' ? 9 : 6;
    for (let ring = 1; ring <= rings; ring++) {
      const n = 8 + ring * 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + ring * 0.4 + rng.range(-0.1, 0.1);
        let r, y, tilt;
        if (s.pattern === 'shaggy') { y = capY + H * (0.15 + ring / (rings + 1) * 0.8); r = R * 1.0 * Math.sqrt(1 - Math.pow((y - capY) / H, 4)) + 0.0006; tilt = 1.2; }
        else { r = R * (0.18 + ring * 0.13); y = hAt(r) + 0.0006; tilt = 0.25; }
        const g = flake.clone().rotateZ(-tilt).translate(r, 0, 0).rotateY(-a).translate(0, y, 0);
        parts.body.push(solid(g, s.pattern === 'shaggy' ? (ring > rings - 2 ? '#c7b69c' : '#e9e4da') : '#7a5634'));
      }
    }
  }
  // --- stem
  const base = s.volva ? -0.018 * scale : 0;
  const bulb = s.bulb ? 1.7 : 1;
  const stemPts = [[sr0 * 0.6, base - 0.002], [sr0 * bulb, base + 0.006 * scale], [sr0 * (bulb * 0.8), base + Math.min(SH * 0.12, 0.02 * scale)], [sr * 1.05, SH * 0.5], [sr, SH * 0.9], [sr * 0.95, SH + 0.002]];
  const stem = lathe(stemPts, 14);
  const curve = (s.curve || 0) * rng.range(0.4, 1);
  if (curve) { const p = stem.attributes.position; for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / SH); p.setX(i, p.getX(i) + Math.sin(t * 1.6) * curve * SH * 0.25); } }
  const sC = C(s.stemCol);
  if (s.stemMat) { paint(stem, (c, x, y) => c.copy(sC).multiplyScalar(s.stemMat === 'netLight' ? 1.0 : 1.0)); const uv = stem.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 2); parts[s.stemMat].push(stem); }
  else {
    paint(stem, (c, x, y) => {
      c.copy(sC);
      if (s.stemPattern === 'snake') { const t = y / SH; c.multiplyScalar(0.75 + 0.3 * (0.5 + 0.5 * Math.sin(t * 60 + Math.atan2(z0(x), 1) * 2))); if (t > 0.8) c.copy(sC).multiplyScalar(1.1); }
      c.multiplyScalar(0.92 + 0.12 * Math.min(1, y / SH));
    });
    parts[bodyKey].push(stem);
  }
  function z0(x) { return x * 120; }
  // ring (annulus)
  if (s.ring) {
    const ry = SH * s.ring.at, rr = sr * s.ring.size;
    const skirt = lathe([[sr * 1.05, ry], [rr * 0.8, ry - 0.004 * scale], [rr, ry - 0.011 * scale]], 18);
    paint(skirt, (c) => c.copy(C(s.ring.col)));
    parts.body.push(skirt);
    if (s.ring.double) parts.body.push(paint(lathe([[sr * 1.05, ry - 0.004], [rr * 0.85, ry - 0.008], [rr * 0.9, ry - 0.011]], 18), (c) => c.copy(C('#6a4a2c'))));
  }
  if (s.volva) {
    const v = lathe([[sr0 * 1.2, base - 0.004], [sr0 * 1.9, base + 0.004 * scale], [sr0 * 2.1, base + 0.014 * scale], [sr0 * 1.85, base + 0.022 * scale], [sr0 * 1.75, base + 0.02 * scale]], 16);
    paint(v, (c, x, y) => c.copy(C('#efece2')).multiplyScalar(0.9 + 0.1 * Math.sin(x * 900)));
    parts.body.push(v);
  }
  if (s.baseScales) {
    for (let k = 0; k < 3; k++) { const t = new THREE.TorusGeometry(sr0 * (1.5 - k * 0.15), 0.0016 * scale * 2, 4, 16).rotateX(Math.PI / 2).translate(0, 0.006 * scale * 2 + k * 0.007 * scale * 2, 0); parts.body.push(solid(t, '#f6f1e4')); }
  }
  if (curve) { // everything attached to the stem follows its bend
    for (const k of Object.keys(parts)) for (const g of parts[k]) {
      if (g === stem) continue;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1.2, p.getY(i) / SH)); p.setX(i, p.getX(i) + Math.sin(t * 1.6) * curve * SH * 0.25); }
    }
  }
  return { parts, top: capY + H };
}

function ball(s, rng, scale, cut) {
  const parts = { body: [] };
  const r = s.r * scale * rng.range(0.75, 1.2);
  const g = cut ? new THREE.SphereGeometry(r, 24, 14, 0, Math.PI) : new THREE.SphereGeometry(r, 24, 16);
  g.scale(1, 0.78, 1).translate(0, r * 0.7, 0);
  const col = C(s.col), crack = C(s.crack || s.col);
  // cracked rind (earthball) or smooth leathery skin (puffball)
  const cells = Array.from({ length: 40 }, () => new THREE.Vector3().randomDirection());
  paint(g, (c, x, y, z) => {
    const v = new THREE.Vector3(x, (y - r * 0.7) / 0.78, z).normalize();
    let d1 = 9, d2 = 9; for (const p of cells) { const d = v.distanceTo(p); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const edge = s.crack ? 1 - Math.min(1, (d2 - d1) * 14) : 0;
    c.copy(col).lerp(crack, edge).multiplyScalar(0.93 + 0.07 * Math.sin(x * 400 + z * 300));
    if (y < r * 0.25) c.multiplyScalar(0.8);
  });
  parts.body.push(g);
  if (cut) { // cross-section showing the interior
    const disc = new THREE.CircleGeometry(r * 0.98, 32).rotateY(-Math.PI / 2).scale(1, 0.78, 1).translate(0, r * 0.7, 0);
    const ins = C(s.inside);
    paint(disc, (c, x, y, z) => { c.copy(ins); if (s.marbled) c.lerp(C('#d8d0c8'), Math.max(0, Math.sin(z * 260 + Math.sin(y * 300) * 2) - 0.75) * 2); });
    disc.rotateY(Math.PI); parts.body.push(disc);
  }
  return { parts, top: r * 1.4 };
}

function bracket(s, rng, scale) {
  // overlapping shelves growing out of a trunk (trunk face at x = 0, shelves extend to +x)
  const parts = { body: [], pore: [] };
  const n = rng.int(3, 5);
  const c1 = C(s.col), c2 = C(s.col2);
  for (let i = 0; i < n; i++) {
    const R = s.r * scale * rng.range(0.6, 1.1), y = i * 0.06 * scale + rng.range(-0.01, 0.01), dz = rng.range(-0.08, 0.08) * scale;
    const top = new THREE.SphereGeometry(R, 18, 6, -Math.PI / 2, Math.PI, 0, Math.PI / 2).rotateY(Math.PI).scale(1, 0.22, 1);
    const p = top.attributes.position; for (let k = 0; k < p.count; k++) { const r = Math.hypot(p.getX(k), p.getZ(k)) / R; p.setY(k, p.getY(k) + Math.sin(Math.atan2(p.getZ(k), p.getX(k)) * 5) * 0.01 * scale * r); }
    paint(top, (c, x, yy, z) => { const r = Math.hypot(x, z) / R; c.copy(c1).lerp(c2, 0.5 + 0.5 * Math.sin(r * 18)); if (r > 0.85) c.copy(c2).multiplyScalar(1.05); });
    const under = new THREE.CircleGeometry(R, 18, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    paint(under, (c) => c.copy(c2));
    const uv = under.attributes.uv; const up = under.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, up.getX(k) / R * 4, up.getZ(k) / R * 4);
    top.translate(0, y, dz); under.translate(0, y - 0.002, dz);
    parts.body.push(top); parts.pore.push(under);
  }
  return { parts, top: n * 0.06 * scale };
}

// Build a patch (several individuals) of a species. opts.single → one specimen (viewer); opts.cut → sliced (balls)
export function buildMushroom(id, seed, opts = {}) {
  const s = M_SPEC[id]; const rng = new RNG(seed);
  const scale = opts.scale || 1;
  const all = { body: [], pore: [], netLight: [], netDark: [], glow: [], glossy: [] };
  const push = (res, tx, tz, ry, tilt = 0) => {
    for (const k of Object.keys(res.parts)) for (const g of res.parts[k]) { g.rotateZ(tilt); g.rotateY(ry); g.translate(tx, 0, tz); all[k].push(g); }
  };
  let top = 0;
  if (s.bracket) { const r = bracket(s, rng, scale); push(r, 0, 0, 0); top = r.top; }
  else if (s.ball) {
    const n = opts.single ? 1 : rng.int(s.count[0], s.count[1]);
    for (let i = 0; i < n; i++) { const r = ball(s, rng, scale * (i ? 0.7 : 1), opts.cut); const a = rng.next() * 6.28, d = i ? s.r * scale * rng.range(1.6, 2.6) : 0; push(r, Math.cos(a) * d, Math.sin(a) * d, opts.cut ? 0 : rng.next() * 6); top = Math.max(top, r.top); }
  } else if (s.cluster && !opts.single) {
    const n = rng.int(s.cluster[0], s.cluster[1]);
    for (let i = 0; i < n; i++) {
      const sc = rng.range(0.55, 1.05);
      const r = agaric(s, rng, scale * sc);
      const a = (i / n) * 6.283 + rng.range(-0.3, 0.3), d = rng.range(0.004, 0.03) * scale;
      push(r, Math.cos(a) * d, Math.sin(a) * d, -a, rng.range(0.12, 0.45));
      top = Math.max(top, r.top);
    }
  } else {
    const n = opts.single ? 1 : rng.int(s.count[0], s.count[1]);
    const spread = (s.spread || 0.12) * scale;
    for (let i = 0; i < n; i++) {
      const sc = i === 0 ? 1 : rng.range(0.55, 0.95);
      const r = agaric(s, rng, scale * sc);
      const a = rng.next() * 6.28, d = i === 0 ? 0 : rng.range(0.4, 1) * spread;
      push(r, Math.cos(a) * d, Math.sin(a) * d, rng.next() * 6.28, i === 0 ? 0 : rng.range(-0.08, 0.08));
      top = Math.max(top, r.top);
    }
  }
  const M = floraMaterials();
  const parts = [];
  for (const k of Object.keys(all)) { const g = merge(all[k]); if (g) parts.push({ geometry: g, material: M[k], key: k }); }
  return { parts, top, spec: s };
}
export const MUSHROOM_SPECS = M_SPEC;

// ---------------------------------------------------------------- plants
function leaf(len, wid, col, rng, { tip = 1, base = 0.35 } = {}) {
  const pos = [0, 0, 0, wid / 2, len * base * 0.6, 0.004, wid * 0.5, len * base, 0.006, wid * 0.35, len * 0.72, 0.003, 0, len * tip, 0, -wid * 0.35, len * 0.72, 0.003, -wid * 0.5, len * base, 0.006, -wid / 2, len * base * 0.6, 0.004, 0, len * 0.5, -0.004];
  const idx = [0, 1, 8, 1, 2, 8, 2, 3, 8, 3, 4, 8, 4, 5, 8, 5, 6, 8, 6, 7, 8, 7, 0, 8];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const c0 = C(col).offsetHSL(rng.range(-0.015, 0.015), 0, rng.range(-0.05, 0.05));
  return paint(g, (c, x, y) => c.copy(c0).multiplyScalar(0.8 + 0.25 * (y / len)));
}
function place(g, x, y, z, ry, rx = 0, rz = 0) { return g.rotateX(rx).rotateZ(rz).rotateY(ry).translate(x, y, z); }
function stemSeg(from, to, r, col) {
  const d = new THREE.Vector3().subVectors(to, from), L = d.length();
  const g = new THREE.CylinderGeometry(r * 0.7, r, L, 4).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(from.x, from.y, from.z);
  return solid(g, col);
}
function berry(r, col, rng, bloom = false) {
  const g = new THREE.IcosahedronGeometry(r * rng.range(0.85, 1.15), 1);
  const c0 = C(col);
  return paint(g, (c, x, y) => { c.copy(c0); if (bloom) c.lerp(C('#8a94b4'), 0.25); if (y > r * 0.6) c.multiplyScalar(0.85); });
}
function star(r, col) { // five-pointed calyx
  const pos = [0, 0, 0], idx = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.35 : r; pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
  for (let i = 1; i <= 10; i++) idx.push(0, i, i % 10 + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return solid(g, col);
}

export function buildPlant(id, seed) {
  const rng = new RNG(seed);
  const body = [], fruit = [];
  let gloss = false, top = 0.3;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  switch (id) {
    case 'bilberry': case 'lingonberry': {
      const lingon = id === 'lingonberry';
      const stems = rng.int(10, 16); top = lingon ? 0.2 : 0.35;
      for (let i = 0; i < stems; i++) {
        const a = rng.next() * 6.28, d = rng.range(0, 0.2), h = top * rng.range(0.55, 1);
        const b = V(Math.cos(a) * d, 0, Math.sin(a) * d), t = V(b.x + rng.range(-0.08, 0.08), h, b.z + rng.range(-0.08, 0.08));
        body.push(stemSeg(b, t, 0.0025, lingon ? '#5a4a30' : '#4f7a2e'));
        const br = V(t.x + rng.range(-0.07, 0.07), h * 0.85, t.z + rng.range(-0.07, 0.07)), bs = b.clone().lerp(t, 0.55);
        body.push(stemSeg(bs, br, 0.002, lingon ? '#5a4a30' : '#4f7a2e'));
        for (let k = 0; k < 14; k++) {
          const p = k < 9 ? b.clone().lerp(t, 0.25 + k / 12) : bs.clone().lerp(br, (k - 8) / 6);
          body.push(place(leaf(lingon ? 0.017 : 0.026, lingon ? 0.011 : 0.015, lingon ? '#356a26' : '#5a9634', rng), p.x, p.y, p.z, rng.next() * 6.28, rng.range(0.7, 1.3)));
        }
        if (lingon) { for (let k = 0; k < rng.int(2, 6); k++) fruit.push(berry(0.0048, '#c0141c', rng).translate(t.x + rng.range(-0.012, 0.012), t.y - rng.range(0, 0.02), t.z + rng.range(-0.012, 0.012))); gloss = true; }
        else for (let k = 0; k < rng.int(1, 3); k++) { const p = b.clone().lerp(t, rng.range(0.35, 0.85)); fruit.push(berry(0.0046, '#232a52', rng, true).translate(p.x + 0.008, p.y - 0.008, p.z)); }
      }
      break;
    }
    case 'cloudberry': {
      top = 0.18;
      for (let i = 0; i < rng.int(3, 6); i++) {
        const a = rng.next() * 6.28, d = rng.range(0, 0.15); const x = Math.cos(a) * d, z = Math.sin(a) * d;
        body.push(stemSeg(V(x, 0, z), V(x, 0.12, z), 0.002, '#5a7a30'));
        body.push(place(leaf(0.05, 0.06, '#5a8a34', rng, { tip: 0.9, base: 0.45 }), x, 0.1, z, rng.next() * 6, 1.25));
        if (i < 3) { const g = new THREE.IcosahedronGeometry(0.008, 1); paint(g, (c, X, Y, Z) => c.copy(C('#e8962c')).multiplyScalar(0.85 + 0.25 * Math.abs(Math.sin(X * 2000 + Z * 1700)))); fruit.push(g.translate(x, 0.135, z)); }
      }
      break;
    }
    case 'raspberry': {
      top = 1.2;
      for (let i = 0; i < rng.int(4, 7); i++) {
        const a = rng.next() * 6.28, b = V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), mid = V(b.x * 2.5, rng.range(0.7, 1.1), b.z * 2.5), t = V(b.x * 5, rng.range(0.6, 1.0), b.z * 5);
        body.push(stemSeg(b, mid, 0.008, '#8a5a48'), stemSeg(mid, t, 0.006, '#8a5a48'));
        for (let k = 0; k < 6; k++) { const p = k < 3 ? b.clone().lerp(mid, 0.4 + k * 0.2) : mid.clone().lerp(t, (k - 3) * 0.3); for (let l = 0; l < 3; l++) body.push(place(leaf(0.1, 0.065, '#5a8a34', rng), p.x, p.y, p.z, rng.next() * 6.28 + l * 2.1, 1.0 + rng.range(-0.2, 0.3))); }
        for (let k = 0; k < rng.int(2, 4); k++) { const p = mid.clone().lerp(t, rng.range(0.2, 0.9)); const g = new THREE.IcosahedronGeometry(0.009, 1).scale(1, 1.15, 1); paint(g, (c, X, Y, Z) => c.copy(C('#b41a2a')).multiplyScalar(0.8 + 0.3 * Math.abs(Math.sin(X * 1800 + Y * 1500)))); fruit.push(g.translate(p.x, p.y - 0.02, p.z)); }
      }
      break;
    }
    case 'deadly_nightshade': {
      top = 1.1; gloss = true;
      const main = [V(0, 0, 0), V(0.05, 0.55, 0), V(0.0, 1.05, 0.04)];
      body.push(stemSeg(main[0], main[1], 0.014, '#5a6a34'), stemSeg(main[1], main[2], 0.01, '#5a6a34'));
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + rng.next(); const s = V(main[1].x, main[1].y + i * 0.08, main[1].z), e = V(s.x + Math.cos(a) * 0.35, s.y + 0.3, s.z + Math.sin(a) * 0.35); body.push(stemSeg(s, e, 0.007, '#5a6a34'));
        for (let k = 0; k < 4; k++) { const p = s.clone().lerp(e, 0.3 + k * 0.22); body.push(place(leaf(0.16, 0.1, '#4a7a30', rng), p.x, p.y, p.z, a + rng.range(-1, 1), 1.0)); }
        for (let k = 0; k < 2; k++) { const p = s.clone().lerp(e, 0.45 + k * 0.3); fruit.push(berry(0.0095, '#0b0b10', rng).translate(p.x, p.y - 0.03, p.z)); body.push(star(0.02, '#4f7a2a').translate(p.x, p.y - 0.03 + 0.006, p.z)); }
        body.push(place(new THREE.ConeGeometry(0.01, 0.025, 6, 1, true), e.x, e.y - 0.05, e.z, 0, Math.PI)); paint(body[body.length - 1], (c) => c.copy(C('#5a2a3a')));
      }
      for (let k = 0; k < 8; k++) body.push(place(leaf(0.18, 0.1, '#4a7a30', rng), 0, 0.2 + k * 0.08, 0, k * 2.4, 1.1));
      break;
    }
    case 'bittersweet': {
      top = 0.9; gloss = true;
      let p = V(0, 0, 0);
      for (let k = 0; k < 10; k++) {
        const n = V(p.x + rng.range(-0.12, 0.12), p.y + rng.range(0.08, 0.16), p.z + rng.range(-0.15, 0.15)); body.push(stemSeg(p, n, 0.004, '#4a5a2a'));
        for (let l = 0; l < 3; l++) body.push(place(leaf(0.07, 0.035, '#4a7a30', rng), n.x, n.y, n.z, rng.next() * 6, 1.1));
        if (k % 2) { for (let b = 0; b < 6; b++) fruit.push(berry(0.0055, b < 4 ? '#d01818' : '#e8701a', rng).scale(1, 1.4, 1).translate(n.x + rng.range(-0.02, 0.02), n.y - 0.04 - b * 0.008, n.z + rng.range(-0.02, 0.02))); }
        else body.push(star(0.009, '#7a3ab0').translate(n.x, n.y + 0.01, n.z));
        p = n;
      }
      break;
    }
    case 'ramsons': {
      top = 0.35;
      for (let i = 0; i < rng.int(6, 10); i++) { const a = rng.next() * 6.28, d = rng.range(0.02, 0.15); const x = Math.cos(a) * d, z = Math.sin(a) * d;
        body.push(stemSeg(V(x, 0, z), V(x, 0.05, z), 0.002, '#7aa04a'));
        body.push(place(leaf(0.24, 0.06, '#3f8a2c', rng, { base: 0.45 }), x, 0.05, z, a + rng.range(-0.3, 0.3), rng.range(0.3, 0.7))); }
      for (let i = 0; i < rng.int(1, 3); i++) { const x = rng.range(-0.06, 0.06), z = rng.range(-0.06, 0.06); body.push(stemSeg(V(x, 0, z), V(x, 0.3, z), 0.0025, '#6a9a44'));
        for (let k = 0; k < 14; k++) { const d = new THREE.Vector3().randomDirection(); if (d.y < -0.2) d.y = -d.y; fruit.push(star(0.006, '#f6f6f0').translate(x + d.x * 0.025, 0.31 + d.y * 0.02, z + d.z * 0.025)); } }
      break;
    }
    case 'lily_of_the_valley': {
      top = 0.22;
      for (let i = 0; i < rng.int(3, 5); i++) { const x = rng.range(-0.1, 0.1), z = rng.range(-0.1, 0.1), a = rng.next() * 6.28;
        body.push(stemSeg(V(x, 0, z), V(x, 0.05, z), 0.004, '#4a7a34')); // shared sheath
        body.push(place(leaf(0.17, 0.055, '#2f6a2a', rng), x, 0.04, z, a, 0.25), place(leaf(0.15, 0.05, '#2f6a2a', rng), x, 0.04, z, a + Math.PI, 0.3));
        const s0 = V(x + 0.01, 0.03, z), s1 = V(x + 0.05, 0.18, z); body.push(stemSeg(s0, s1, 0.0015, '#5a8a40'));
        for (let k = 0; k < 6; k++) { const p = s0.clone().lerp(s1, 0.45 + k * 0.1); const bell = new THREE.SphereGeometry(0.0045, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6).rotateX(Math.PI); fruit.push(solid(bell, '#f8f8f2').translate(p.x + 0.006, p.y - 0.008, p.z)); } }
      break;
    }
    case 'wood_sorrel': {
      top = 0.08;
      for (let i = 0; i < rng.int(8, 14); i++) { const a = rng.next() * 6.28, d = rng.range(0, 0.12); const x = Math.cos(a) * d, z = Math.sin(a) * d, h = rng.range(0.03, 0.055);
        body.push(stemSeg(V(x, 0, z), V(x, h, z), 0.001, '#a07a5a'));
        for (let l = 0; l < 3; l++) { const g = new THREE.CircleGeometry(0.011, 8).scale(1, 1.15, 1); g.translate(0, 0.011, 0); body.push(place(solid(g, '#6aa83a'), x, h, z, a + l * 2.09, 1.35)); } }
      break;
    }
  }
  const M = floraMaterials();
  const parts = [];
  const gb = merge(body);
  if (gb) { const n = gb.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); parts.push({ geometry: gb, material: M.plant, key: 'plant' }); }
  const gf = merge(fruit); if (gf) parts.push({ geometry: gf, material: gloss ? M.berryGloss : M.berryMatte, key: 'fruit' });
  return { parts, top };
}
export const PROCEDURAL_PLANTS = ['bilberry', 'lingonberry', 'cloudberry', 'raspberry', 'deadly_nightshade', 'bittersweet', 'ramsons', 'lily_of_the_valley', 'wood_sorrel'];
