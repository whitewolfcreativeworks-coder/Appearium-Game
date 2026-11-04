// Instanced pools: one InstancedMesh per (kind, part) shared by every loaded chunk.
// Chunks contribute flat arrays of instance transforms; dirty pools are re-packed once per frame.
// This keeps draw calls roughly constant (≈ number of kinds) no matter how many chunks are loaded.
import * as THREE from 'three';

export class PoolManager {
  constructor(scene) {
    this.scene = scene;
    this.kinds = new Map();       // key -> { parts: [{geometry, material, castShadow, receiveShadow}], capacity, meshes: [] }
    this.contrib = new Map();     // key -> Map(ownerId -> {mats: Float32Array, cols: Float32Array|null, count, hidden:Set})
    this.dirty = new Set();
  }

  defineKind(key, parts, capacity = 2048) {
    if (this.kinds.has(key)) return;
    const meshes = parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geometry, p.material, capacity);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = !!p.castShadow;
      m.receiveShadow = p.receiveShadow !== false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (p.colored) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      m.matrixAutoUpdate = false;
      m.userData.poolKey = key;
      this.scene.add(m);
      return m;
    });
    this.kinds.set(key, { parts, capacity, meshes });
    this.contrib.set(key, new Map());
  }

  has(key) { return this.kinds.has(key); }

  // instances: { mats: Float32Array(16*n), cols?: Float32Array(3*n), count }
  set(key, owner, instances) {
    const c = this.contrib.get(key);
    if (!c) return;
    if (!instances || instances.count === 0) { if (c.delete(owner)) this.dirty.add(key); return; }
    instances.hidden = instances.hidden || new Set();
    c.set(owner, instances);
    this.dirty.add(key);
  }
  hide(key, owner, index) {
    const c = this.contrib.get(key); const inst = c && c.get(owner);
    if (inst) { inst.hidden.add(index); this.dirty.add(key); }
  }
  removeOwner(owner) {
    for (const [key, c] of this.contrib) if (c.delete(owner)) this.dirty.add(key);
  }
  clearAll() {
    for (const [key, c] of this.contrib) { c.clear(); this.dirty.add(key); }
    this.flush();
  }

  flush() {
    for (const key of this.dirty) {
      const kind = this.kinds.get(key); const c = this.contrib.get(key);
      let n = 0;
      for (const mesh of kind.meshes) {
        const dst = mesh.instanceMatrix.array; const dcol = mesh.instanceColor ? mesh.instanceColor.array : null;
        n = 0;
        for (const inst of c.values()) {
          for (let i = 0; i < inst.count && n < kind.capacity; i++) {
            if (inst.hidden.size && inst.hidden.has(i)) continue;
            dst.set(inst.mats.subarray(i * 16, i * 16 + 16), n * 16);
            if (dcol) { if (inst.cols) dcol.set(inst.cols.subarray(i * 3, i * 3 + 3), n * 3); else dcol.fill(1, n * 3, n * 3 + 3); }
            n++;
          }
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (dcol) mesh.instanceColor.needsUpdate = true;
      }
    }
    this.dirty.clear();
  }

  stats() {
    let draws = 0, inst = 0;
    for (const k of this.kinds.values()) for (const m of k.meshes) if (m.count) { draws++; inst += m.count; }
    return { draws, inst };
  }
}

// Helper that accumulates transforms for one owner/kind.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export class InstanceList {
  constructor() { this.m = []; this.c = []; this.count = 0; this.hasColor = false; }
  push(x, y, z, rotY, scale, tilt = 0, color = null, sy = null, tiltZ = 0) {
    _e.set(tilt, rotY, tiltZ, 'YXZ'); _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(scale, sy ?? scale, scale);
    _m.compose(_p, _q, _s);
    for (let i = 0; i < 16; i++) this.m.push(_m.elements[i]);
    if (color) { this.hasColor = true; this.c.push(color.r, color.g, color.b); } else this.c.push(1, 1, 1);
    return this.count++;
  }
  build() { return { mats: new Float32Array(this.m), cols: this.hasColor ? new Float32Array(this.c) : null, count: this.count }; }
}
