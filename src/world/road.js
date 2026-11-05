// The road out of the village: a worn two-track gravel road draped over the terrain.
// Every expedition starts on it; where it leads is different each time.
import * as THREE from 'three';
import { tex } from '../core/assets.js';

let MAT = null;
function roadMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.MeshStandardMaterial({
    map: tex('terrain/gravel_road_diff.jpg'), normalMap: tex('terrain/gravel_road_nor.jpg', { srgb: false }),
    color: 0xa4a8a8, roughness: 1, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  MAT.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.a;'); };
  MAT.customProgramCacheKey = () => 'roadStrip';
  return MAT;
}

// columns across the road: worn edges, two wheel tracks and a grassy crown in the middle
const COLS = [[-2.7, 0], [-1.9, 0.8], [-1.1, 1], [-0.35, 0.55], [0.35, 0.55], [1.1, 1], [1.9, 0.8], [2.7, 0]];

export function buildRoadMesh(world, { from = 0, to = Infinity, fadeStart = 0, fadeEnd = 0 } = {}) {
  const gen = world.gen, R = gen.road; if (!R) return null;
  const P = R.pts, pos = [], col = [], uv = [], idx = [];
  const i0 = Math.max(0, Math.floor(from / 4)), i1 = Math.min(P.length - 1, Math.ceil(to / 4));
  let dist = 0, rows = 0;
  for (let i = i0; i <= i1; i++) {
    const [x, z] = P[i], [nx, nz] = P[Math.min(P.length - 1, i + 1)], [px, pz] = P[Math.max(0, i - 1)];
    let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > i0) dist += 4;
    const s = i * 4;
    let a = 1;
    if (fadeStart) a *= Math.min(1, (s - from) / fadeStart);
    if (fadeEnd) a *= Math.min(1, Math.max(0, (Math.min(to, (P.length - 1) * 4) - s) / fadeEnd));
    for (const [k, w] of COLS) {
      const sx = -dz * k, sz = dx * k;
      pos.push(x + sx, gen.height(x + sx, z + sz) + 0.05, z + sz);
      uv.push(k / 3, dist / 3);
      col.push(1, 1, 1, w * a);
    }
    rows++;
  }
  const C = COLS.length;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < C - 1; c++) { const a = r * C + c; idx.push(a, a + 1, a + C, a + 1, a + C + 1, a + C); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, roadMaterial()); m.receiveShadow = true; m.renderOrder = 1; m.userData.disposable = true;
  return m;
}

// a point along the road `s` metres from its start, with the road's heading
export function roadPoint(gen, s) {
  const P = gen.road.pts, f = Math.max(0, Math.min(P.length - 1.001, s / 4)), i = Math.floor(f), t = f - i;
  const [ax, az, ay] = P[i], [bx, bz, by] = P[i + 1];
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, y: ay + (by - ay) * t, angle: Math.atan2(bx - ax, -(bz - az)) };
}
