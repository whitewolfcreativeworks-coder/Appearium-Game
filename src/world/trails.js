// Animal trails: narrow worn runs through the grass with real track patterns pressed into them.
// Trails are a pure function of chunk coordinates, so grass, scatter and traps can all query them.
import * as THREE from 'three';
import { RNG, hashString } from '../core/rng.js';
import { tex } from '../core/assets.js';

// canvas atlas of track prints (each cell 128px): hare, fox, roe deer, squirrel
let ATLAS = null;
function atlas() {
  if (ATLAS) return ATLAS;
  const S = 128, c = document.createElement('canvas'); c.width = S * 4; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, c.width, c.height);
  const pad = (x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
  g.fillStyle = 'rgba(40,30,20,0.85)';
  // hare: two long hind prints ahead (top), two small front prints behind, offset (Y pattern)
  pad(44, 30, 9, 22); pad(84, 30, 9, 22); pad(58, 82, 7, 9); pad(66, 106, 7, 9);
  // fox: oval, four toes, X-shaped gap between pads
  { const ox = 128 + 64, oy = 64; pad(ox, oy + 16, 16, 13); pad(ox - 13, oy - 8, 6, 8, -0.2); pad(ox + 13, oy - 8, 6, 8, 0.2); pad(ox - 5, oy - 24, 6, 8); pad(ox + 5, oy - 24, 6, 8); }
  // roe deer: two heart-shaped halves of a cloven slot
  { const ox = 256 + 64, oy = 64; g.beginPath(); g.moveTo(ox - 3, oy - 32); g.quadraticCurveTo(ox - 22, oy, ox - 14, oy + 26); g.lineTo(ox - 3, oy + 22); g.closePath(); g.fill(); g.beginPath(); g.moveTo(ox + 3, oy - 32); g.quadraticCurveTo(ox + 22, oy, ox + 14, oy + 26); g.lineTo(ox + 3, oy + 22); g.closePath(); g.fill(); }
  // squirrel: paired hind feet ahead, small front feet behind
  { const ox = 384 + 64, oy = 64; for (const s of [-1, 1]) { pad(ox + s * 18, oy - 18, 8, 14); for (let t = 0; t < 4; t++) pad(ox + s * 18 + (t - 1.5) * 5, oy - 36, 2.5, 4); pad(ox + s * 9, oy + 26, 5, 6); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  ATLAS = t; return t;
}
export const PRINT_INDEX = { hare: 0, fox: 1, roe_deer: 2, squirrel: 3 };

export function definePrintKinds(pools) {
  const atlasTex = atlas();
  for (const [sp, i] of Object.entries(PRINT_INDEX)) {
    const size = sp === 'hare' ? 0.2 : sp === 'roe_deer' ? 0.13 : sp === 'squirrel' ? 0.11 : 0.13;
    const g = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 4);
    const m = new THREE.MeshStandardMaterial({ map: atlasTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.95 });
    pools.defineKind(`print_${sp}`, [{ geometry: g, material: m, receiveShadow: true }], 4000);
  }
}

// deterministic trails for a chunk
export function trailsFor(world, cx, cz) {
  const cache = world.trailCache || (world.trailCache = new Map());
  const key = cx + ',' + cz;
  if (cache.has(key)) return cache.get(key);
  const gen = world.gen, water = gen.p.water, S = 64;
  const rng = new RNG((hashString(key) ^ gen.seed ^ 0x7a11) >>> 0);
  const out = [];
  const n = rng.next() < 0.75 ? (rng.next() < 0.45 ? 2 : 1) : 0;
  for (let t = 0; t < n; t++) {
    let x = cx * S + 8 + rng.next() * (S - 16), z = cz * S + 8 + rng.next() * (S - 16);
    const s0 = gen.sample(x, z);
    if (s0.h - water < 0.6 || s0.clear > 0.3) continue;
    const species = s0.forest > 0.55 ? (rng.next() < 0.4 ? 'squirrel' : rng.next() < 0.6 ? 'roe_deer' : 'fox') : (rng.next() < 0.7 ? 'hare' : 'fox');
    let a = rng.next() * Math.PI * 2;
    const pts = [[x, z]];
    for (let i = 0; i < (species === 'squirrel' ? 10 : 26); i++) {
      a += (rng.next() - 0.5) * 0.7;
      let nx = x + Math.cos(a) * 2, nz = z + Math.sin(a) * 2;
      for (let k = 0; k < 6 && gen.height(nx, nz) - water < 0.4; k++) { a += 0.9; nx = x + Math.cos(a) * 2; nz = z + Math.sin(a) * 2; }
      if (gen.height(nx, nz) - water < 0.4) break;
      if (nx < cx * S - 6 || nx > cx * S + S + 6 || nz < cz * S - 6 || nz > cz * S + S + 6) break;
      x = nx; z = nz; pts.push([x, z]);
    }
    if (pts.length > 4) out.push({ species, pts });
  }
  cache.set(key, out);
  return out;
}

export function nearestTrail(world, x, z, maxD = 3) {
  const S = 64, cx = Math.floor(x / S), cz = Math.floor(z / S);
  let best = null, bd = maxD;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const tr of trailsFor(world, cx + dx, cz + dz)) {
    for (let i = 0; i < tr.pts.length - 1; i++) {
      const [ax, az] = tr.pts[i], [bx, bz] = tr.pts[i + 1];
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
      const d = Math.hypot(ax + vx * t - x, az + vz * t - z);
      if (d < bd) { bd = d; best = tr; }
    }
  }
  return best ? { trail: best, dist: bd } : null;
}

// populate a chunk: track prints (instanced), a worn strip mesh, and "examine tracks" interactables
export function populateTrails(world, chunk, L, interactables) {
  const gen = world.gen;
  const trails = trailsFor(world, chunk.cx, chunk.cz);
  if (!trails.length) return [];
  const pos = [], idx = [], col = [], uv = [];
  const W = 0.32;
  for (const tr of trails) {
    const P = tr.pts;
    // worn strip: three columns so the edges fade into the grass
    const base = pos.length / 3;
    for (let i = 0; i < P.length; i++) {
      const [x, z] = P[i], [nx, nz] = P[Math.min(P.length - 1, i + 1)], [px, pz] = P[Math.max(0, i - 1)];
      let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const fade = Math.min(1, Math.min(i, P.length - 1 - i) / 3);
      for (const k of [-1, 0, 1]) {
        const sx = -dz * W * k, sz = dx * W * k;
        pos.push(x + sx, gen.height(x + sx, z + sz) + 0.025, z + sz);
        uv.push((x + sx) * 0.4, (z + sz) * 0.4);
        col.push(0, 0, 0, k === 0 ? fade * 0.8 : 0);
      }
    }
    for (let i = 0; i < P.length - 1; i++) { const a = base + i * 3; for (const c of [0, 1]) idx.push(a + c, a + 3 + c, a + 1 + c, a + 1 + c, a + 3 + c, a + 4 + c); }
    // prints along the trail
    const step = tr.species === 'roe_deer' ? 0.7 : tr.species === 'hare' ? 1.4 : 0.9;
    let acc = 0, side = 1;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1]; const L2 = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
      for (let d = acc; d < L2; d += step) {
        const t = d / L2, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const off = tr.species === 'fox' ? 0 : 0.06 * side; side = -side;
        const ox = Math.cos(ang) * off, oz = -Math.sin(ang) * off;
        L(`print_${tr.species}`).push(x + ox, gen.height(x + ox, z + oz) + 0.03, z + oz, ang + Math.PI, 1 + (Math.random() - 0.5) * 0.1);
      }
      acc = (acc + step - (L2 % step)) % step;
    }
    const mid = P[Math.floor(P.length / 2)];
    interactables.push({ type: 'tracks', species: tr.species, pos: new THREE.Vector3(mid[0], gen.height(mid[0], mid[1]) + 0.2, mid[1]), radius: 2.2, label: 'Examine the tracks', chunk });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mat = world.trailMat || (world.trailMat = new THREE.MeshStandardMaterial({ map: tex('terrain/brown_mud_leaves_01_diff.jpg'), color: 0x9a8a78, roughness: 1, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3 }));
  // use vertex alpha only for fading the ends
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.a;'); };
  mat.customProgramCacheKey = () => 'trailStrip';
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.disposable = true;
  return [m];
}
