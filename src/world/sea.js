// Life under the water — only built while you are in it:
//   · schools of fish that drift, turn and scatter when you swim at them (perch and roach in
//     lakes and rivers, mackerel at sea, bright reef fish in the tropics);
//   · water plants swaying in the current: waterweed in fresh water, kelp forests at sea,
//     coral heads in warm shallow seas;
//   · sharks at sea (great white on cold coasts, bull shark in the tropics). A fin appears and
//     circles, closing in. Keep it in sight and make steadily for the shallows — thrashing
//     draws it in faster. Reach water too shallow for it and it turns away.
import * as THREE from 'three';
import { merge, vc } from './fauna.js';
import { hash2 } from '../core/rng.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

const FISH = {
  fresh: [{ col: '#7a8a5a', len: 0.24 }, { col: '#a8aca0', len: 0.2 }, { col: '#6a7a6a', len: 0.3 }],
  sea: [{ col: '#7a98a8', len: 0.34 }, { col: '#b8c0c4', len: 0.26 }],
  reef: [{ col: '#e8c83a', len: 0.18 }, { col: '#3a78d8', len: 0.16 }, { col: '#e86a3a', len: 0.15 }, { col: '#a8e0e8', len: 0.2 }],
};

export class SeaLife {
  constructor(game, world) {
    this.game = game; this.world = world; this.t = 0;
    this.region = world.exp?.region || 'temperate';
    this.group = new THREE.Group(); this.group.name = 'sealife'; game.scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
    // fish: a lens-shaped body and a forked tail (white = species colour), pale belly
    const fish = merge([vc(new THREE.SphereGeometry(0.5, 10, 6).scale(0.32, 0.55, 1.6), '#ffffff'), vc(new THREE.SphereGeometry(0.42, 8, 5).scale(0.28, 0.3, 1.3).translate(0, -0.12, 0.05), '#f4f0e8'),
      vc(new THREE.ConeGeometry(0.32, 0.5, 4).rotateX(Math.PI / 2).scale(0.15, 1.3, 1).translate(0, 0, -0.95), '#ffffff')]);
    this.fishMesh = new THREE.InstancedMesh(fish, mat, 64); this.fishMesh.count = 0; this.fishMesh.frustumCulled = false;
    this.fishMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3).fill(1), 3); this.group.add(this.fishMesh);
    this.schools = [];
    // swaying plants: the sway is done in the vertex shader from each instance's position
    this.plantU = { uT: { value: 0 } };
    const pmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1a2a10, emissiveIntensity: 0.6 }); // leaves let light through
    pmat.onBeforeCompile = (sh) => { sh.uniforms.uT = this.plantU.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float k = position.y * position.y; transformed.x += sin(uT * 0.9 + ip.x * 0.7 + ip.z * 0.3 + position.y * 0.8) * 0.12 * k; transformed.z += cos(uT * 0.7 + ip.z * 0.6 + position.y * 0.6) * 0.08 * k; }`); };
    pmat.customProgramCacheKey = () => 'seaplant';
    const ribbon = new THREE.PlaneGeometry(0.11, 1, 1, 8).translate(0, 0.5, 0); { const ps = ribbon.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setX(i, ps.getX(i) * (0.6 + 0.6 * Math.sin(y * 3.1)) + Math.sin(y * 7) * 0.02); } } vc(ribbon, '#ffffff');
    this.weed = new THREE.InstancedMesh(ribbon, pmat, 400); this.weed.count = 0; this.weed.frustumCulled = false;
    this.weed.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3).fill(1), 3); this.group.add(this.weed);
    const coral = merge([vc(new THREE.IcosahedronGeometry(0.3, 1), '#ffffff'), vc(new THREE.IcosahedronGeometry(0.18, 0).translate(0.22, 0.12, 0.05), '#ffffff'), vc(new THREE.IcosahedronGeometry(0.16, 0).translate(-0.18, 0.15, -0.08), '#ffffff')]);
    this.coral = new THREE.InstancedMesh(coral, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 160); this.coral.count = 0; this.coral.frustumCulled = false;
    this.coral.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(160 * 3).fill(1), 3); this.group.add(this.coral);
    this.plantAt = null;
    // the shark
    if (this.region === 'coast' || this.region === 'tropics') { // (tropical lagoons and rivers too)
      this.sharkKind = this.region === 'coast' ? 'great_white' : 'bull_shark';
      const L = this.sharkKind === 'great_white' ? 1 : 0.7, top = '#6a747c', belly = '#e8e8e4';
      const fin = new THREE.Shape(); fin.moveTo(-0.35, 0); fin.quadraticCurveTo(-0.1, 0.35, 0.15, 0.75); fin.quadraticCurveTo(0.12, 0.3, 0.4, 0); fin.lineTo(-0.35, 0);
      const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.quadraticCurveTo(-0.25, 0.5, -0.45, 1.0); tail.quadraticCurveTo(-0.1, 0.45, 0, 0.12); tail.quadraticCurveTo(-0.1, -0.3, -0.3, -0.6); tail.quadraticCurveTo(-0.05, -0.25, 0, 0);
      const g = merge([
        vc(new THREE.SphereGeometry(0.5, 16, 10).scale(1.0, 1.05, 3.6), top), vc(new THREE.SphereGeometry(0.47, 14, 8).scale(0.95, 0.7, 3.4).translate(0, -0.18, 0.05), belly),
        vc(new THREE.ShapeGeometry(fin).rotateY(Math.PI / 2).translate(0, 0.42, 0.2), '#5a646c'),
        vc(new THREE.ShapeGeometry(tail).rotateY(Math.PI / 2).translate(0, 0, -1.75), '#5a646c'),
        ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.25, 0.8, 3).rotateZ(sd * 1.9).scale(1, 1, 0.35).translate(sd * 0.55, -0.25, 0.5), '#5a646c')),
        vc(new THREE.SphereGeometry(0.035, 5, 4).translate(0.3, 0.12, 1.45), '#0a0a0a'), vc(new THREE.SphereGeometry(0.035, 5, 4).translate(-0.3, 0.12, 1.45), '#0a0a0a'),
      ]);
      g.scale(L * 1.1, L * 1.1, L * 1.1);
      this.shark = { mesh: new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide })), state: null, timer: 30 + Math.random() * 40 };
      this.shark.mesh.visible = false; this.shark.mesh.castShadow = false; this.group.add(this.shark.mesh);
    }
  }

  dispose() { this.game.scene.remove(this.group); }
  // salt (or warm lagoon) water: tropical lagoons count — bull sharks swim up into fresh water
  isSea(x, z) { const g = this.world.gen; return (g.seaAt?.(x, z) || 0) > 0.5 || (this.region === 'tropics' && g.biomeT(x, z) > 0.5); }

  update(dt, ctx) {
    this.t += dt; this.plantU.uT.value = this.t;
    const pl = ctx.player, p = pl.pos, w = this.world, W = w.gen.p.water;
    const inWater = pl.swimming || w.depthAt(p.x, p.z) > 0.6;
    this.group.visible = inWater || this.shark?.state;
    if (inWater) { this.updateFish(dt, pl, W); this.updatePlants(p, W); }
    else if (this.fishMesh.count) { this.fishMesh.count = 0; this.schools.length = 0; }
    if (this.shark) this.updateShark(dt, pl, W);
  }

  // ---------------------------------------------------------------- fish schools
  updateFish(dt, pl, W) {
    const w = this.world, p = pl.pos;
    if (this.schools.length < 4 && Math.random() < dt * 0.8) {
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * 6.28, r = 7 + Math.random() * 14, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, d = w.depthAt(x, z);
        if (d < 1.3) continue;
        const sea = this.isSea(x, z), list = sea ? (this.region === 'tropics' ? FISH.reef : FISH.sea) : FISH.fresh;
        const sp = list[Math.floor(Math.random() * list.length)], n = 6 + Math.floor(Math.random() * 9);
        const s = { c: V3(x, W - Math.min(d - 0.6, 0.6 + Math.random() * Math.max(0.5, d - 1.2)), z), h: Math.random() * 6.28, v: 0.5, sp, fish: [] };
        for (let i = 0; i < n; i++) s.fish.push({ o: V3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.6), ph: Math.random() * 6.28, sc: 0.85 + Math.random() * 0.3 });
        this.schools.push(s); break;
      }
    }
    let n = 0;
    for (const s of this.schools) {
      const dx = s.c.x - p.x, dz = s.c.z - p.z, d = Math.hypot(dx, dz), dy = s.c.y - (p.y + 1.4);
      const near = Math.hypot(d, dy) < 3.2 + (pl.running ? 2 : 0);
      if (near) { s.h += angDiff(Math.atan2(dx, dz), s.h) * Math.min(1, dt * 6); s.v += (3.2 - s.v) * Math.min(1, dt * 4); }
      else { s.h += Math.sin(this.t * 0.3 + s.c.x) * dt * 0.4; s.v += (0.55 - s.v) * Math.min(1, dt); }
      const nx = s.c.x + Math.sin(s.h) * s.v * dt, nz = s.c.z + Math.cos(s.h) * s.v * dt, nd = this.world.depthAt(nx, nz);
      if (nd > 0.9) { s.c.x = nx; s.c.z = nz; } else s.h += 2.0 * dt * 3;
      const bottom = W - nd + 0.35; s.c.y = Math.min(W - 0.35, Math.max(bottom, s.c.y + Math.sin(this.t * 0.5 + s.h) * dt * 0.1));
      if (d > 38) s.dead = true;
      for (const f of s.fish) {
        if (n >= 64) break;
        f.ph += dt * (6 + s.v * 5);
        const ox = f.o.x + Math.sin(this.t * 0.6 + f.ph * 0.05) * 0.25, oz = f.o.z + Math.cos(this.t * 0.5 + f.ph * 0.04) * 0.25;
        const ch = Math.cos(s.h), sh = Math.sin(s.h);
        _p.set(s.c.x + ox * ch + oz * sh, s.c.y + f.o.y, s.c.z - ox * sh + oz * ch);
        _e.set(0, s.h + Math.sin(f.ph) * 0.18, 0, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(s.sp.len * f.sc);
        _m.compose(_p, _q, _s); this.fishMesh.setMatrixAt(n, _m);
        _c.set(s.sp.col).convertSRGBToLinear(); this.fishMesh.instanceColor.setXYZ(n, _c.r, _c.g, _c.b); n++;
      }
    }
    this.schools = this.schools.filter((s) => !s.dead);
    this.fishMesh.count = n; this.fishMesh.instanceMatrix.needsUpdate = true; this.fishMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- plants on the bed, around you
  updatePlants(p, W) {
    if (this.plantAt && Math.hypot(p.x - this.plantAt.x, p.z - this.plantAt.z) < 5) return;
    this.plantAt = { x: p.x, z: p.z };
    const w = this.world, gen = w.gen, C = 2.2, R = 26, seed = gen.seed;
    let nw = 0, nc = 0;
    const cx0 = Math.floor((p.x - R) / C), cx1 = Math.floor((p.x + R) / C), cz0 = Math.floor((p.z - R) / C), cz1 = Math.floor((p.z + R) / C);
    for (let i = cx0; i <= cx1; i++) for (let j = cz0; j <= cz1; j++) {
      const h1 = hash2(i, j, seed ^ 0x5ea), h2 = hash2(j, i, seed ^ 0x77e), h3 = hash2(i * 3, j * 7, seed ^ 0x1c);
      const x = (i + h1) * C, z = (j + h2) * C; if (Math.hypot(x - p.x, z - p.z) > R) continue;
      const d = w.depthAt(x, z); if (d < 0.5) continue;
      const g = W - d, sea = this.isSea(x, z);
      if (sea && this.region === 'tropics' && d < 9 && h3 < 0.55 && nc < 160) { // coral heads
        const k = Math.floor(h3 * 97) % 5, cols = ['#e86a8a', '#e8a04a', '#a86ad8', '#e8d85a', '#6ad8c8'];
        _p.set(x, g + 0.1, z); _e.set(h1 * 0.3, h2 * 6.28, 0); _q.setFromEuler(_e); _s.set(0.8 + h2, 0.5 + h1 * 0.8, 0.8 + h3);
        _m.compose(_p, _q, _s); this.coral.setMatrixAt(nc, _m); _c.set(cols[k]).convertSRGBToLinear(); this.coral.instanceColor.setXYZ(nc, _c.r, _c.g, _c.b); nc++;
        continue;
      }
      const kelp = sea && this.region === 'coast' && d > 2;
      if (!(kelp ? h3 < 0.7 : sea ? h3 < 0.15 : d < 4.5 && h3 < 0.45)) continue;
      const blades = kelp ? 3 : 4;
      for (let b = 0; b < blades && nw < 400; b++) {
        const bx = x + (hash2(i + b, j, seed) - 0.5) * 0.8, bz = z + (hash2(i, j + b, seed) - 0.5) * 0.8;
        const ht = kelp ? Math.max(1.5, (d - 0.6) * (0.6 + 0.4 * h1)) : 0.5 + h2 * 1.0;
        _p.set(bx, W - w.depthAt(bx, bz), bz); _e.set(0, (h1 + b) * 2.1, 0); _q.setFromEuler(_e); _s.set(kelp ? 1.6 : 1, ht, 1);
        _m.compose(_p, _q, _s); this.weed.setMatrixAt(nw, _m);
        _c.set(kelp ? '#b89a44' : sea ? '#6a9a4a' : '#5a9a3a').convertSRGBToLinear(); this.weed.instanceColor.setXYZ(nw, _c.r, _c.g, _c.b); nw++;
      }
    }
    this.weed.count = nw; this.weed.instanceMatrix.needsUpdate = true; this.weed.instanceColor.needsUpdate = true;
    this.coral.count = nc; this.coral.instanceMatrix.needsUpdate = true; this.coral.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the shark
  updateShark(dt, pl, W) {
    const S = this.shark, p = pl.pos, w = this.world, g = this.game;
    const inSea = pl.swimming && this.isSea(p.x, p.z) && w.depthAt(p.x, p.z) > 2.2;
    if (!S.state) {
      S.mesh.visible = false;
      if (!inSea) return;
      S.timer -= dt; if (S.timer > 0) return;
      S.timer = 40 + Math.random() * 60;
      if (Math.random() > 0.65) return;
      const a = Math.random() * 6.28; S.pos = V3(p.x + Math.cos(a) * 42, W - 0.7, p.z + Math.sin(a) * 42); S.ang = a; S.r = 42; S.h = 0; S.state = 'circle'; S.closing = 0;
      g.ui.toast(`<b>A fin cuts the water</b> — a ${this.sharkKind === 'great_white' ? 'great white' : 'bull shark'}! Keep it in sight and swim steadily for the shallows. Don't splash.`, true);
      g.audio?.tension?.(0.3);
      return;
    }
    const dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz);
    const f = pl.forward(V3()), facing = (f.x * dx + f.z * dz) / (d || 1);
    const shallow = w.depthAt(p.x, p.z) < 1.4 || !pl.swimming;
    if (shallow && S.state !== 'leave') { S.state = 'leave'; g.ui.toast('The fin turns away into deeper water. Too shallow for it here.', true); g.audio?.tension?.(0); }
    if (S.state === 'circle') {
      // it circles in, faster if you thrash, slower while you watch it
      const rate = (pl.running ? 2.2 : 1) * (facing > 0.7 ? 0.45 : 1);
      S.r = Math.max(6, S.r - dt * 1.1 * rate);
      S.ang += dt * 3.2 / Math.max(6, S.r);
      const tx = p.x + Math.cos(S.ang) * S.r, tz = p.z + Math.sin(S.ang) * S.r;
      S.h = Math.atan2(tx - S.pos.x, tz - S.pos.z); S.pos.x += (tx - S.pos.x) * Math.min(1, dt * 2); S.pos.z += (tz - S.pos.z) * Math.min(1, dt * 2);
      S.pos.y += (W - 0.7 - S.pos.y) * Math.min(1, dt);
      g.audio?.tension?.(0.3 + 0.7 * (1 - S.r / 42));
      if (S.r <= 6.5 && (pl.running || facing < 0.4 || Math.random() < dt * 0.15)) { S.state = 'strike'; }
    } else if (S.state === 'strike') {
      const tx = p.x, tz = p.z; S.h += angDiff(Math.atan2(tx - S.pos.x, tz - S.pos.z), S.h) * Math.min(1, dt * 4);
      S.pos.x += Math.sin(S.h) * 7 * dt; S.pos.z += Math.cos(S.h) * 7 * dt; S.pos.y += (p.y + 1.2 - S.pos.y) * Math.min(1, dt * 3);
      if (Math.hypot(S.pos.x - p.x, S.pos.z - p.z) < 1.6) { S.state = null; S.mesh.visible = false; g.audio?.tension?.(0); g.onAnimalAttack?.('shark'); return; }
    } else if (S.state === 'leave') {
      S.h += angDiff(Math.atan2(dx, dz), S.h) * Math.min(1, dt * 2);
      S.pos.x += Math.sin(S.h) * 4 * dt; S.pos.z += Math.cos(S.h) * 4 * dt; S.pos.y -= dt * 0.4;
      if (d > 70) { S.state = null; S.mesh.visible = false; return; }
    }
    // stay in water deep enough to swim
    if (w.depthAt(S.pos.x, S.pos.z) < 1.6 && S.state === 'circle') S.ang += dt * 2; // skirt round the shallows
    S.mesh.visible = true; S.mesh.position.copy(S.pos);
    S.mesh.rotation.set(0, S.h + Math.sin(this.t * 3) * 0.06, 0, 'YXZ');
  }

  observable(p, look, cam) {
    const S = this.shark; if (!S?.state || S.state === 'strike') return null;
    const dx = S.pos.x - p.x, dz = S.pos.z - p.z, d = Math.hypot(dx, dz); if (d > 70) return null;
    const dir = V3(dx, S.pos.y + 0.4 - cam.y, dz).normalize(); if (look.dot(dir) < 0.95) return null;
    return { kind: this.sharkKind, ref: S, dist: d };
  }
}
