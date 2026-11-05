// Chunk streaming: terrain meshes (3 LOD rings with skirts), water patches, per-chunk scatter.
// The wilderness "develops as the player explores": chunks are generated on demand around
// the player and discarded when far away (scatter is deterministic so they come back identical).
import * as THREE from 'three';
import { hash2 } from '../core/rng.js';

export class Colliders {
  constructor(cell = 8) { this.cell = cell; this.grid = new Map(); this.nextId = 1; this.items = new Map(); }
  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(c) { // circle {x,z,r} or box {x,z,hw,hd,rot}
    const id = this.nextId++; c.id = id; this.items.set(id, c);
    const R = c.r ?? Math.hypot(c.hw, c.hd);
    const x0 = Math.floor((c.x - R) / this.cell), x1 = Math.floor((c.x + R) / this.cell);
    const z0 = Math.floor((c.z - R) / this.cell), z1 = Math.floor((c.z + R) / this.cell);
    c.cells = [];
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this._key(ix, iz); let s = this.grid.get(k); if (!s) this.grid.set(k, s = new Set());
      s.add(id); c.cells.push(k);
    }
    return id;
  }
  remove(id) {
    const c = this.items.get(id); if (!c) return;
    for (const k of c.cells) { const s = this.grid.get(k); if (s) { s.delete(id); if (!s.size) this.grid.delete(k); } }
    this.items.delete(id);
  }
  clear() { this.grid.clear(); this.items.clear(); }
  // pushes position (Vector3-like, xz) out of colliders for a body of radius r
  resolve(p, r) {
    const ix = Math.floor(p.x / this.cell), iz = Math.floor(p.z / this.cell);
    const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const s = this.grid.get(this._key(ix + dx, iz + dz)); if (!s) continue;
      for (const id of s) {
        if (seen.has(id)) continue; seen.add(id);
        const c = this.items.get(id);
        if (c.y !== undefined && (p.y > c.y + (c.h ?? 3) || p.y + 1.7 < c.y - 0.5)) continue;
        if (c.r !== undefined) {
          const ddx = p.x - c.x, ddz = p.z - c.z, d = Math.hypot(ddx, ddz), m = c.r + r;
          if (d < m && d > 1e-4) { p.x = c.x + ddx / d * m; p.z = c.z + ddz / d * m; }
        } else {
          const cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0));
          const lx = (p.x - c.x) * cs - (p.z - c.z) * sn, lz = (p.x - c.x) * sn + (p.z - c.z) * cs;
          const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
          let ddx = lx - qx, ddz = lz - qz, d = Math.hypot(ddx, ddz);
          let nlx = lx, nlz = lz;
          if (d < r) {
            if (d < 1e-4) { // inside box: push out along smallest axis
              const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
              if (px < pz) nlx = Math.sign(lx || 1) * (c.hw + r); else nlz = Math.sign(lz || 1) * (c.hd + r);
            } else { nlx = qx + ddx / d * r; nlz = qz + ddz / d * r; }
            const cs2 = Math.cos(c.rot || 0), sn2 = Math.sin(c.rot || 0);
            p.x = c.x + nlx * cs2 - nlz * sn2; p.z = c.z + nlx * sn2 + nlz * cs2;
          }
        }
      }
    }
  }
}

export class ChunkManager {
  constructor(o) {
    this.scene = o.scene; this.gen = o.gen; this.pools = o.pools;
    this.terrainMat = o.terrainMat; this.waterMat = o.waterMat;
    this.size = o.size || 64; this.radius = o.radius || 3;
    this.populate = o.populate || null; // (chunk) => {veg: Map(kind->InstanceList), interactables, colliders, objects}
    this.onLoad = o.onLoad || null; this.onUnload = o.onUnload || null;
    this.colliders = o.colliders;
    this.chunks = new Map();
    this.center = { cx: 1e9, cz: 1e9 };
    this.group = new THREE.Group(); this.group.name = 'terrain';
    this.scene.add(this.group);
    this.segs = [48, 24, 12];
    this.queue = [];
  }

  key(cx, cz) { return cx + ',' + cz; }
  ring(c) { return Math.max(Math.abs(c.cx - this.center.cx), Math.abs(c.cz - this.center.cz)); }
  lodFor(r) { return r <= 1 ? 0 : r <= 2 ? 1 : 2; }

  update(pos, budgetMs = 5, force = false) {
    const cx = Math.floor(pos.x / this.size), cz = Math.floor(pos.z / this.size);
    if (cx !== this.center.cx || cz !== this.center.cz) {
      this.center = { cx, cz };
      // unload
      for (const [k, c] of this.chunks) if (this.ring(c) > this.radius + 1) this.unload(k, c);
      // enqueue missing
      this.queue = [];
      for (let dx = -this.radius; dx <= this.radius; dx++) for (let dz = -this.radius; dz <= this.radius; dz++) {
        const k = this.key(cx + dx, cz + dz);
        if (!this.chunks.has(k)) this.queue.push({ cx: cx + dx, cz: cz + dz, d: Math.max(Math.abs(dx), Math.abs(dz)) + Math.hypot(dx, dz) * 0.01 });
      }
      this.queue.sort((a, b) => a.d - b.d);
      // re-LOD existing
      for (const c of this.chunks.values()) this.relod(c);
    }
    const t0 = performance.now();
    while (this.queue.length && (force || performance.now() - t0 < budgetMs)) {
      const q = this.queue.shift();
      this.load(q.cx, q.cz);
    }
    return this.queue.length;
  }

  load(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return;
    const c = { cx, cz, key: k, x0: cx * this.size, z0: cz * this.size, lod: -1, vegLod: -1, mesh: null, water: null, colliderIds: [], objects: [], interactables: [] };
    this.chunks.set(k, c);
    this.relod(c);
    if (this.populate) {
      const res = this.populate(c);
      c.veg = res.veg || new Map();
      c.interactables = res.interactables || [];
      for (const col of res.colliders || []) c.colliderIds.push(this.colliders.add(col));
      for (const obj of res.objects || []) { this.scene.add(obj); c.objects.push(obj); }
      this.applyVeg(c, true);
    }
    this.onLoad && this.onLoad(c);
  }

  unload(k, c) {
    if (c.mesh) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.water) { this.group.remove(c.water); c.water.geometry.dispose(); }
    this.pools.removeOwner(k);
    for (const id of c.colliderIds) this.colliders.remove(id);
    for (const o of c.objects) { this.scene.remove(o); o.traverse?.((m) => { if (m.isMesh && m.userData.disposable) m.geometry.dispose(); }); }
    this.onUnload && this.onUnload(c);
    this.chunks.delete(k);
  }

  dispose() {
    for (const [k, c] of [...this.chunks]) this.unload(k, c);
    this.scene.remove(this.group);
  }

  relod(c) {
    const r = this.ring(c);
    const lod = this.lodFor(r);
    if (lod !== c.lod) {
      if (c.mesh) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); }
      const { geo, minH } = this.buildTerrain(c, this.segs[lod]);
      c.mesh = new THREE.Mesh(geo, this.terrainMat);
      c.mesh.receiveShadow = true; c.mesh.castShadow = lod === 0 && r === 0 ? false : false;
      c.mesh.matrixAutoUpdate = false;
      this.group.add(c.mesh);
      if (minH < this.gen.p.water + 0.05 && !c.water) {
        c.water = new THREE.Mesh(this.buildWater(c), this.waterMat);
        c.water.renderOrder = 2; c.water.matrixAutoUpdate = false;
        this.group.add(c.water);
      }
      c.lod = lod;
    }
    if (c.veg) this.applyVeg(c);
  }

  applyVeg(c, initial = false) {
    const r = this.ring(c);
    const vl = r <= 1 ? 0 : 1;
    const smallOn = r <= 1;
    if (!initial && vl === c.vegLod && smallOn === c.smallOn) return;
    c.vegLod = vl; c.smallOn = smallOn;
    for (const [kind, data] of c.veg) {
      if (data.tree) {
        this.pools.set(`${kind}@near`, c.key, vl === 0 ? data.built : null);
        this.pools.set(`${kind}@far`, c.key, vl === 1 ? data.built : null);
      } else {
        this.pools.set(kind, c.key, smallOn || data.always ? data.built : null);
      }
    }
  }

  buildTerrain(c, N) {
    const S = this.size, step = S / N, gen = this.gen;
    const W = N + 3; // with 1-vertex border for normals
    const H = new Float32Array(W * W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = gen.height(c.x0 + (i - 1) * step, c.z0 + (j - 1) * step);
    const V = (N + 1) * (N + 1), E = 4 * (N + 1);
    const pos = new Float32Array((V + E) * 3), nrm = new Float32Array((V + E) * 3), eco = new Float32Array((V + E) * 3), eco2 = new Float32Array((V + E) * 3);
    let minH = Infinity;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const v = j * (N + 1) + i;
      const x = c.x0 + i * step, z = c.z0 + j * step;
      const h = H[(j + 1) * W + (i + 1)];
      if (h < minH) minH = h;
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
      const hl = H[(j + 1) * W + i], hr = H[(j + 1) * W + i + 2], hd = H[j * W + i + 1], hu = H[(j + 2) * W + i + 1];
      let nx = hl - hr, ny = 2 * step, nz = hd - hu; const l = Math.hypot(nx, ny, nz);
      nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l;
      const s = gen.sample(x, z);
      eco[v * 3] = s.moist; eco[v * 3 + 1] = s.forest; eco[v * 3 + 2] = s.river;
      eco2[v * 3] = s.biome; eco2[v * 3 + 1] = s.beach; eco2[v * 3 + 2] = s.cliff;
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    // skirts: duplicate the border ring 4 m lower to hide LOD cracks
    const ring = [];
    for (let i = 0; i <= N; i++) ring.push(i);                       // z0 edge
    for (let j = 1; j <= N; j++) ring.push(j * (N + 1) + N);          // x1 edge
    for (let i = N - 1; i >= 0; i--) ring.push(N * (N + 1) + i);      // z1 edge
    for (let j = N - 1; j >= 1; j--) ring.push(j * (N + 1));          // x0 edge
    ring.forEach((v, k) => {
      const s = V + k;
      pos[s * 3] = pos[v * 3]; pos[s * 3 + 1] = pos[v * 3 + 1] - 4; pos[s * 3 + 2] = pos[v * 3 + 2];
      for (let q = 0; q < 3; q++) { nrm[s * 3 + q] = nrm[v * 3 + q]; eco[s * 3 + q] = eco[v * 3 + q]; eco2[s * 3 + q] = eco2[v * 3 + q]; }
    });
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length], sa = V + k, sb = V + (k + 1) % ring.length;
      idx.push(a, b, sa, b, sb, sa, a, sa, b, b, sa, sb); // both windings
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('aEco', new THREE.BufferAttribute(eco, 3));
    geo.setAttribute('aEco2', new THREE.BufferAttribute(eco2, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return { geo, minH };
  }

  buildWater(c) {
    const S = this.size, w = this.gen.p.water;
    // the sea gets a finer grid so swell can be displaced in the vertex shader
    let seaProbe = 0; for (const [a, b] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) seaProbe += this.gen.seaAt(c.x0 + S * a, c.z0 + S * b);
    const N = seaProbe > 0.01 ? 32 : 16, step = S / N;
    const pos = [], depth = [], sea = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = c.x0 + i * step, z = c.z0 + j * step;
      pos.push(x, w, z);
      depth.push(w - this.gen.height(x, z));
      sea.push(seaProbe > 0.01 ? this.gen.seaAt(x, z) : 0);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1;
      if (depth[a] < -1.5 && depth[b] < -1.5 && depth[d] < -1.5 && depth[e] < -1.5) continue;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setAttribute('aSea', new THREE.Float32BufferAttribute(sea, 1));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }

  // deterministic per-chunk random
  rand(c, i, salt = 0) { return hash2(c.cx * 9176 + i, c.cz * 7919 + salt, this.gen.seed); }
}
