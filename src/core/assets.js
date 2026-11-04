// Asset loading & caching. Textures come from Poly Haven / ambient sources processed by
// tools/fetch_assets.py; models are meshopt-compressed GLBs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const texCache = new Map();
const modelCache = new Map();
let maxAniso = 4;
export function setAnisotropy(a) { maxAniso = a; }

let pending = 0, done = 0, onProgress = null;
export function setProgressHandler(fn) { onProgress = fn; }
function track(p) {
  pending++;
  return p.finally(() => { done++; onProgress && onProgress(done, pending); });
}

export function tex(path, { srgb = true, repeat = true } = {}) {
  const key = path + (srgb ? ':s' : ':l');
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load('assets/tex/' + path);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  texCache.set(key, t);
  return t;
}

export function texAsync(path, opts) {
  const t = tex(path, opts);
  if (t.image) return Promise.resolve(t);
  return track(new Promise((res) => {
    const check = () => (t.image && (t.image.complete || t.image.width) ? res(t) : setTimeout(check, 30));
    check();
  }));
}

export function preloadTextures(paths) {
  return Promise.all(paths.map((p) => texAsync(p.path || p, p.opts)));
}

export function loadModel(name) {
  if (modelCache.has(name)) return modelCache.get(name);
  const p = track(gltfLoader.loadAsync('assets/models/' + name + '.glb'));
  modelCache.set(name, p);
  return p;
}

// Poly Haven "set" models lay several plant/rock variants out in a row along X.
// Split the (single) mesh into connected spatial clusters so each can be scattered separately.
export function splitVariants(geometry, gap = 0.08) {
  const g = geometry.index ? geometry : geometry; // indexed expected
  const idx = g.index.array, pos = g.attributes.position;
  const triCount = idx.length / 3;
  const cx = new Float32Array(triCount), minX = new Float32Array(triCount), maxX = new Float32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < 3; k++) { const x = pos.getX(idx[t * 3 + k]); if (x < mn) mn = x; if (x > mx) mx = x; }
    minX[t] = mn; maxX[t] = mx; cx[t] = (mn + mx) / 2;
  }
  const order = Array.from({ length: triCount }, (_, i) => i).sort((a, b) => minX[a] - minX[b]);
  const groups = []; let cur = [], curMax = -Infinity;
  for (const t of order) {
    if (cur.length && minX[t] > curMax + gap) { groups.push(cur); cur = []; curMax = -Infinity; }
    cur.push(t); curMax = Math.max(curMax, maxX[t]);
  }
  if (cur.length) groups.push(cur);
  const big = groups.filter((gr) => gr.length > 60);
  return big.map((gr) => extract(g, gr));
}

function extract(g, tris) {
  const idx = g.index.array;
  const remap = new Map(); const newIdx = [];
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const v = idx[t * 3 + k];
    let n = remap.get(v); if (n === undefined) { n = remap.size; remap.set(v, n); }
    newIdx.push(n);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const arr = new Float32Array(remap.size * a.itemSize);
    for (const [o, n] of remap) for (let c = 0; c < a.itemSize; c++) arr[n * a.itemSize + c] = a.getComponent(o, c);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(newIdx);
  // centre on XZ, rest on y=min
  out.computeBoundingBox();
  const b = out.boundingBox;
  out.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

// Return the first mesh's geometry (de-quantised into float attributes) and material.
export async function modelParts(name) {
  const gltf = await loadModel(name);
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  mesh.updateWorldMatrix(true, false);
  const geo = dequantize(mesh.geometry).applyMatrix4(mesh.matrixWorld);
  return { geometry: geo, material: mesh.material, gltf };
}

export function dequantize(geo) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = geo.attributes[name];
    if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (geo.index) out.setIndex(new THREE.BufferAttribute(Uint32Array.from(geo.index.array), 1));
  return out;
}
