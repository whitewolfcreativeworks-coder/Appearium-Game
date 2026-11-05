// Herds and flocks: the bigger animal life of each land.
//   gulls wheeling over the shore · a V of geese passing high overhead · ravens tumbling over the
//   canyon rim · parrots crossing the forest · a starling murmuration at dusk · storks and
//   flamingos wading in the shallows · a herd of wild horses grazing in the open.
// Everything is instanced (a few draw calls per species) and recycled around the player.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG, smoothstep } from '../core/rng.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function vc(g, col) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(col);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function merge(list) {
  const g = BGU.mergeGeometries(list.map((x) => { const n = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(n.attributes)) if (!['position', 'color'].includes(k)) n.deleteAttribute(k); return n; }));
  g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ bird bodies (head towards +z)
const BIRDS = {
  gull:     { len: 0.5, wing: 0.7, body: '#f2f2f0', back: '#a8b0b6', tip: '#202022', beak: '#e8c030', legs: '#d8a070', neck: 0.05 },
  goose:    { len: 0.8, wing: 0.85, body: '#8a8478', back: '#6a6458', tip: '#3a3630', beak: '#e88a3a', legs: '#e88a3a', neck: 0.22 },
  raven:    { len: 0.62, wing: 0.68, body: '#121216', back: '#16161c', tip: '#0c0c10', beak: '#16161a', legs: '#101012', neck: 0.06, wedge: true },
  parrot:   { len: 0.42, wing: 0.36, body: '#2aa040', back: '#3ab84a', tip: '#2040c8', beak: '#e8e0c8', legs: '#4a4a4a', neck: 0.04, tail: '#c82a2a' },
  stork:    { len: 0.85, wing: 1.0, body: '#f4f4f0', back: '#f0f0ec', tip: '#141414', beak: '#d83a22', legs: '#d83a22', neck: 0.3, legLen: 0.8 },
  flamingo: { len: 0.75, wing: 0.8, body: '#f0a0a8', back: '#f2b0b4', tip: '#141414', beak: '#f4e8e0', legs: '#e88a90', neck: 0.55, legLen: 0.95, flamingo: true },
};
function birdGeometry(k) {
  const B = BIRDS[k], L = B.len;
  const parts = [];
  parts.push(vc(new THREE.SphereGeometry(L * 0.22, 8, 6).scale(0.8, 0.75, 1.9), B.body));
  parts.push(vc(new THREE.SphereGeometry(L * 0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.82, 0.55, 1.8), B.back));
  // neck & head
  const nk = B.neck * (k === 'flamingo' ? 1 : 1);
  if (nk > 0.1) parts.push(vc(new THREE.CylinderGeometry(L * 0.05, L * 0.07, nk * L * 2.2, 6).rotateX(B.flamingo ? -0.3 : -0.9).translate(0, nk * L * (B.flamingo ? 1.0 : 0.5), L * 0.42 + nk * L * (B.flamingo ? 0.2 : 0.7)), B.body));
  const hy = nk > 0.1 ? nk * L * (B.flamingo ? 2.0 : 1.0) : L * 0.05, hz = L * 0.45 + nk * L * (B.flamingo ? 0.45 : 1.3);
  parts.push(vc(new THREE.SphereGeometry(L * 0.1, 7, 5).translate(0, hy, hz), k === 'goose' ? '#2a2826' : k === 'stork' ? B.body : B.body));
  parts.push(vc(new THREE.ConeGeometry(L * 0.035, L * (B.flamingo ? 0.16 : k === 'stork' ? 0.3 : 0.14), 5).rotateX(B.flamingo ? 2.2 : Math.PI / 2).translate(0, hy - (B.flamingo ? L * 0.05 : 0), hz + L * 0.12), B.beak));
  // tail
  parts.push(vc(new THREE.ConeGeometry(L * 0.12, L * 0.35, 4).rotateX(-Math.PI / 2).scale(1, 0.3, 1).translate(0, 0, -L * 0.5), B.tail || B.back));
  if (B.legLen) { // dangling legs (in flight they trail behind; standing birds get them from the wader rig)
    for (const s of [-1, 1]) parts.push(vc(new THREE.CylinderGeometry(0.008, 0.008, B.legLen, 4).rotateX(Math.PI / 2).translate(s * 0.04, -0.02, -L * 0.4 - B.legLen / 2), B.legs));
  }
  const body = merge(parts);
  // wing: root at x = 0 (shoulder), span along +x
  const W = B.wing, wingG = new THREE.BufferGeometry();
  const P = [0, 0, L * 0.18, W * 0.55, 0, L * 0.12, W, 0, -L * 0.05, W * 0.55, 0, -L * 0.2, 0, 0, -L * 0.2];
  wingG.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  wingG.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]);
  const c = new THREE.Color(B.back), t = new THREE.Color(B.tip), cols = [c, c, t, c.clone().lerp(t, 0.5), c];
  wingG.setAttribute('color', new THREE.Float32BufferAttribute(cols.flatMap((x) => [x.r, x.g, x.b]), 3));
  wingG.computeVertexNormals();
  return { body, wing: wingG };
}

// standing wader: body, long neck (moves for feeding), legs
function waderGeometry(k) {
  const B = BIRDS[k], L = B.len, LL = B.legLen;
  const body = merge([
    vc(new THREE.SphereGeometry(L * 0.24, 9, 7).scale(0.8, 0.8, 1.6).translate(0, LL + 0.1, 0), B.body),
    vc(new THREE.ConeGeometry(L * 0.14, L * 0.4, 5).rotateX(-Math.PI / 2 - 0.4).scale(1, 0.4, 1).translate(0, LL + 0.12, -L * 0.42), B.tip),
    ...[-1, 1].map((s) => vc(new THREE.CylinderGeometry(0.012, 0.01, LL + 0.05, 5).translate(s * 0.06, (LL + 0.05) / 2, 0), B.legs)),
  ]);
  // neck + head pivot at the front of the body (rotated to feed)
  const NL = B.neck * L * (B.flamingo ? 2.3 : 1.8);
  const neck = merge([
    vc(new THREE.CylinderGeometry(L * 0.035, L * 0.05, NL, 6).translate(0, NL / 2, 0), B.body),
    vc(new THREE.SphereGeometry(L * 0.08, 7, 5).translate(0, NL, 0.02), B.body),
    vc(new THREE.ConeGeometry(L * 0.03, L * (k === 'stork' ? 0.32 : 0.16), 5).rotateX(B.flamingo ? 2.4 : Math.PI / 2 + 0.3).translate(0, NL - (B.flamingo ? 0.03 : 0.02), L * 0.12), B.beak),
  ]);
  return { body, neck, neckPivot: V3(0, LL + 0.16, L * 0.32), neckLen: NL };
}

// ------------------------------------------------------------------ horse
function horseGeometry() {
  const coat = '#ffffff', dark = '#2a2420';
  const body = merge([
    vc(new THREE.SphereGeometry(0.38, 16, 12).scale(0.92, 1.08, 2.2).translate(0, 1.2, 0), coat),
    vc(new THREE.SphereGeometry(0.36, 12, 9).scale(0.95, 1.1, 1).translate(0, 1.24, 0.6), coat),   // chest & shoulders
    vc(new THREE.SphereGeometry(0.37, 12, 9).scale(1.02, 1.02, 1.15).translate(0, 1.27, -0.6), coat), // rump & croup
    ...[-1, 1].map((sd) => vc(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.6, 1.2).translate(sd * 0.2, 1.02, -0.62), coat)), // thighs
  ]);
  // neck and head pivot at the withers; the neck reaches forward-up, the head hangs at its end
  const neckHead = merge([
    vc(new THREE.CylinderGeometry(0.14, 0.27, 0.92, 10).translate(0, 0.44, 0).rotateX(0.6), coat),
    vc(new THREE.BoxGeometry(0.07, 0.16, 0.86).translate(0, 0.52, -0.1).rotateX(0.6), dark), // mane
    vc(new THREE.CylinderGeometry(0.075, 0.13, 0.62, 9).rotateX(Math.PI / 2 + 0.55).translate(0, 0.7, 0.74), coat), // head
    vc(new THREE.SphereGeometry(0.13, 8, 6).scale(0.85, 1, 1.1).translate(0, 0.84, 0.58), coat), // cheeks
    vc(new THREE.SphereGeometry(0.09, 7, 5).translate(0, 0.53, 1.0), '#3a3430'), // muzzle
    ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.04, 0.14, 4).translate(sd * 0.075, 1.02, 0.52), coat)),
  ]);
  const leg = merge([
    vc(new THREE.CylinderGeometry(0.11, 0.065, 0.52, 8).translate(0, -0.24, 0), coat),
    vc(new THREE.SphereGeometry(0.06, 6, 5).translate(0, -0.52, 0), '#3a3230'),
    vc(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 6).translate(0, -0.74, 0), '#3a3230'),
    vc(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 7).translate(0, -0.98, 0), '#1a1614'),
  ]);
  const tail = merge([vc(new THREE.ConeGeometry(0.11, 0.8, 7).rotateX(Math.PI).translate(0, -0.4, 0), dark)]);
  return { body, neckHead, leg, tail };
}
const COATS = [[0.45, 0.27, 0.16], [0.6, 0.34, 0.18], [0.24, 0.18, 0.14], [0.78, 0.76, 0.72], [0.66, 0.54, 0.38], [0.15, 0.13, 0.12]].map((c) => c.map((v) => v ** 2.2));

// ------------------------------------------------------------------
export class Herds {
  constructor(game, world, kinds = []) {
    this.game = game; this.world = world; this.kinds = new Set(kinds);
    this.rng = new RNG((world.gen.seed ^ 0x5eed) >>> 0);
    this.group = new THREE.Group(); this.group.name = 'herds'; game.scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    this.flyers = []; this.waders = []; this.horses = []; this.t = 0;
    this.pools = {};
    const flyKinds = [];
    if (this.kinds.has('gulls')) flyKinds.push('gull');
    if (this.kinds.has('geese')) flyKinds.push('goose');
    if (this.kinds.has('ravens')) flyKinds.push('raven');
    if (this.kinds.has('parrots')) flyKinds.push('parrot');
    if (this.kinds.has('storks')) flyKinds.push('stork');
    if (this.kinds.has('flamingos')) flyKinds.push('flamingo');
    for (const k of flyKinds) {
      const { body, wing } = birdGeometry(k), N = 40;
      const mk = (g) => { const m = new THREE.InstancedMesh(g, this.mat, N); m.count = 0; m.frustumCulled = false; m.castShadow = k !== 'parrot'; this.group.add(m); return m; };
      this.pools[k] = { body: mk(body), wl: mk(wing), wr: mk(wing.clone().scale(-1, 1, 1)), n: 0 };
    }
    for (const k of ['stork', 'flamingo']) if (this.pools[k]) {
      const w = waderGeometry(k), N = 30;
      const mk = (g) => { const m = new THREE.InstancedMesh(g, this.mat, N); m.count = 0; m.frustumCulled = false; m.castShadow = true; this.group.add(m); return m; };
      this.pools[`${k}W`] = { body: mk(w.body), neck: mk(w.neck), pivot: w.neckPivot, n: 0 };
    }
    if (this.kinds.has('horses')) {
      const h = horseGeometry(), N = 12;
      const mk = (g, n = N) => { const m = new THREE.InstancedMesh(g, this.mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); this.group.add(m); return m; };
      this.pools.horse = { body: mk(h.body), neck: mk(h.neckHead), leg: mk(h.leg, N * 4), tail: mk(h.tail) };
    }
    if (this.kinds.has('murmuration')) {
      const g = new THREE.TetrahedronGeometry(0.16).scale(1.6, 0.4, 1); const N = 420;
      this.murm = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x141418 }), N); this.murm.count = 0; this.murm.frustumCulled = false; this.group.add(this.murm);
      this.murmBase = Array.from({ length: N }, () => new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random())));
    }
    this.nextPass = 20 + this.rng.range(0, 40);
  }

  dispose() { this.game.scene.remove(this.group); }

  ground(x, z) { return this.world.gen.height(x, z); }
  water() { return this.world.gen.p.water; }
  inDest(x, z) { return this.world.gen.biomeT(x, z) > 0.45; }

  // ---------------------------------------------------------------- spawning
  findSpot(p, test, rMin = 60, rMax = 170, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng.next() * 6.283, r = this.rng.range(rMin, rMax), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!this.inDest(x, z)) continue;
      if (test(x, z)) return { x, z };
    }
    return null;
  }

  spawnSoarers(p, kind, n) { // gulls and ravens circling
    const g = this.world.gen;
    const test = kind === 'gull' ? (x, z) => { const s = g.sample(x, z); return s.sea > 0.2 || s.beach > 0.3; } : (x, z) => g.sample(x, z).cliff > 0.3 || g.baseHeight(x, z) > g.p.water + 20;
    const s = this.findSpot(p, test, 30, 150); if (!s) return;
    const c = V3(s.x, 0, s.z);
    for (let i = 0; i < n; i++) this.flyers.push({ kind, mode: 'soar', c, r: this.rng.range(14, 40), a: this.rng.range(0, 6.28), sp: this.rng.range(0.18, 0.35) * (this.rng.chance(0.5) ? 1 : -1), alt: this.rng.range(kind === 'gull' ? 8 : 18, kind === 'gull' ? 30 : 45), ph: this.rng.range(0, 6), pos: V3(), life: 9999, pair: kind === 'raven' ? i % 2 : 0 });
  }
  spawnPass(p, kind) { // a skein of geese (V), a flock of parrots or storks passing over
    const n = kind === 'goose' ? this.rng.int(7, 15) : kind === 'parrot' ? this.rng.int(8, 16) : this.rng.int(4, 8);
    const a = this.rng.range(0, 6.28), dir = V3(Math.cos(a), 0, Math.sin(a));
    const start = p.clone().addScaledVector(dir, -260).add(V3(-dir.z, 0, dir.x).multiplyScalar(this.rng.range(-80, 80)));
    const alt = kind === 'goose' ? this.rng.range(45, 75) : kind === 'parrot' ? this.rng.range(14, 26) : this.rng.range(30, 50);
    const speed = kind === 'goose' ? 13 : kind === 'parrot' ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
      const off = kind === 'goose' ? V3(-dir.z * side * row * 2.4, row * 0.25, dir.x * side * row * 2.4).addScaledVector(dir, -row * 2.2)
        : V3(this.rng.range(-8, 8), this.rng.range(-3, 3), this.rng.range(-8, 8));
      this.flyers.push({ kind, mode: 'pass', o: start.clone().add(off), dir, speed: speed * (kind === 'parrot' ? this.rng.range(0.9, 1.1) : 1), alt, baseY: Math.max(this.ground(p.x, p.z), this.water()), ph: this.rng.range(0, 6), pos: V3(), t: 0, life: 520 / speed });
    }
    this.game.audio?.call?.(kind, start.clone().addScaledVector(dir, 120));
  }
  spawnWaders(p, kind) {
    const g = this.world.gen;
    const test = kind === 'flamingo' ? (x, z) => { const d = g.p.water - g.height(x, z); return d > 0.1 && d < 0.5; }
      : (x, z) => { const s = g.sample(x, z); const d = g.p.water - s.h; return (d > -0.6 && d < 0.3) || (s.moist > 0.7 && s.forest < 0.2 && d > -2); };
    const s = this.findSpot(p, test, 50, 160, 80); if (!s) return false;
    const n = kind === 'flamingo' ? this.rng.int(9, 18) : this.rng.int(3, 7);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 8; k++) {
        const x = s.x + this.rng.range(-12, 12), z = s.z + this.rng.range(-12, 12);
        if (!test(x, z)) continue;
        this.waders.push({ kind, pos: V3(x, 0, z), h: this.rng.range(0, 6.28), feed: this.rng.range(0, 1), timer: this.rng.range(1, 6), state: 'feed', ph: this.rng.range(0, 6), vy: 0 });
        break;
      }
    }
    return true;
  }
  spawnHerd(p) {
    const g = this.world.gen;
    const test = (x, z) => { const s = g.sample(x, z); if (s.forest > 0.25 || s.h - g.p.water < 0.8 || s.beach > 0.3) return false; const sl = Math.hypot(g.height(x + 2, z) - s.h, g.height(x, z + 2) - s.h) / 2; return sl < 0.25; };
    const s = this.findSpot(p, test, 70, 170, 60); if (!s) return false;
    const n = this.rng.int(5, 9);
    this.herdC = V3(s.x, 0, s.z); this.herdDir = this.rng.range(0, 6.28);
    for (let i = 0; i < n; i++) {
      const foal = i > 1 && this.rng.chance(0.2);
      this.horses.push({ pos: V3(s.x + this.rng.range(-14, 14), 0, s.z + this.rng.range(-14, 14)), h: this.rng.range(0, 6.28), state: 'graze', timer: this.rng.range(2, 8), speed: 0, gait: 0, neck: 1, ph: this.rng.range(0, 6),
        scale: foal ? 0.62 : this.rng.range(0.92, 1.05), coat: COATS[this.rng.int(0, COATS.length - 1)], tail: 0, seen: false });
    }
    return true;
  }

  // ---------------------------------------------------------------- update
  update(dt, ctx) {
    const p = ctx.player.pos, day = ctx.day, gen = this.world.gen, W = this.water();
    this.t += dt; const t = this.t;
    // population
    if (this.kinds.has('gulls') && day > 0.2 && this.flyers.filter((f) => f.kind === 'gull').length < 6 && this.rng.chance(dt * 0.2)) this.spawnSoarers(p, 'gull', this.rng.int(3, 6));
    if (this.kinds.has('ravens') && day > 0.2 && !this.flyers.some((f) => f.kind === 'raven') && this.rng.chance(dt * 0.1)) this.spawnSoarers(p, 'raven', 2);
    this.nextPass -= dt;
    if (this.nextPass < 0 && day > 0.25) {
      this.nextPass = this.rng.range(50, 120);
      const opts = ['goose', 'parrot', 'stork'].filter((k) => this.pools[k] && (k !== 'stork' || this.rng.chance(0.4)));
      if (opts.length && this.inDest(p.x, p.z)) this.spawnPass(p, this.rng.pick(opts));
    }
    for (const k of ['stork', 'flamingo']) if (this.pools[k] && !this.waders.some((w) => w.kind === k) && this.rng.chance(dt * 0.05)) this.spawnWaders(p, k);
    if (this.pools.horse && !this.horses.length && this.rng.chance(dt * 0.08)) this.spawnHerd(p);
    if (this.horses.length && this.herdC && this.herdC.distanceTo(p) > 330) this.horses = [];
    this.waders = this.waders.filter((w) => w.pos.distanceTo(p) < 320);

    // ---- flying birds
    const counts = {};
    for (const k of Object.keys(this.pools)) if (BIRDS[k]) { this.pools[k].n = 0; counts[k] = 0; }
    this.flyers = this.flyers.filter((f) => {
      let x, y, z, yaw, bank = 0;
      if (f.mode === 'soar') {
        if (f.c.distanceTo(p) > 300) return false;
        f.a += f.sp * dt / Math.max(0.6, f.r / 25);
        const tumble = f.kind === 'raven' && Math.sin(t * 0.4 + f.ph) > 0.92 ? Math.sin(t * 6) * 0.9 : 0;
        x = f.c.x + Math.cos(f.a) * f.r; z = f.c.z + Math.sin(f.a) * f.r;
        y = Math.max(this.ground(x, z), W) + f.alt + Math.sin(t * 0.3 + f.ph) * 3 + (f.pair ? 1.5 : 0);
        yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.sp), Math.cos(f.a) * Math.sign(f.sp)); bank = -0.35 * Math.sign(f.sp) + tumble;
      } else {
        f.t += dt; if (f.t > f.life) return false;
        const q = f.o.clone().addScaledVector(f.dir, f.speed * f.t);
        x = q.x + Math.sin(t * 0.7 + f.ph) * (f.kind === 'parrot' ? 1.5 : 0.3); z = q.z;
        y = Math.max(f.baseY + f.alt + f.o.y, this.ground(x, z) + 12) + Math.sin(t * 0.9 + f.ph) * 0.6;
        yaw = Math.atan2(f.dir.x, f.dir.z);
      }
      f.pos.set(x, y, z);
      const P = this.pools[f.kind]; if (!P || P.n >= 40) return true;
      const glide = f.kind === 'gull' || f.kind === 'raven' || f.kind === 'stork' ? (Math.sin(t * 0.45 + f.ph) > -0.2 ? 0.08 : 1) : 1;
      const rate = f.kind === 'parrot' ? 13 : f.kind === 'goose' ? 5.5 : f.kind === 'stork' || f.kind === 'flamingo' ? 3.5 : 6;
      const flap = Math.sin(t * rate + f.ph) * 0.65 * glide + (glide < 1 ? 0.06 : 0);
      _e.set(0, yaw, bank, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
      P.body.setMatrixAt(P.n, _m);
      _m2.makeRotationZ(flap).premultiply(_m); P.wl.setMatrixAt(P.n, _m2);
      _m2.makeRotationZ(-flap).premultiply(_m); P.wr.setMatrixAt(P.n, _m2);
      P.n++;
      return true;
    });
    // ---- waders (standing birds) — fly off when you come close
    const WP = {};
    for (const k of ['stork', 'flamingo']) if (this.pools[`${k}W`]) { WP[k] = this.pools[`${k}W`]; WP[k].n = 0; }
    for (const w of this.waders) {
      const d = w.pos.distanceTo(p);
      if (w.state !== 'fly' && (d < (w.kind === 'flamingo' ? 26 : 20) || (d < 40 && ctx.player.running))) {
        w.state = 'fly'; w.vy = 0; w.h = Math.atan2(w.pos.x - p.x, w.pos.z - p.z) + this.rng.range(-0.5, 0.5);
        if (!w.called) { w.called = true; this.game.audio?.call?.(w.kind, w.pos); }
      }
      if (w.state === 'fly') {
        w.vy = Math.min(4, w.vy + dt * 3); w.pos.y += w.vy * dt; w.pos.x += Math.sin(w.h) * 8 * dt; w.pos.z += Math.cos(w.h) * 8 * dt;
        const P = this.pools[w.kind]; if (P && P.n < 40) {
          const flap = Math.sin(t * 5 + w.ph) * 0.7;
          _e.set(-0.15, w.h, 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.copy(w.pos), _q, _s.set(1, 1, 1)); P.body.setMatrixAt(P.n, _m);
          _m2.makeRotationZ(flap).premultiply(_m); P.wl.setMatrixAt(P.n, _m2); _m2.makeRotationZ(-flap).premultiply(_m); P.wr.setMatrixAt(P.n, _m2); P.n++;
        }
        if (w.pos.y > 60) w.dead = true;
        continue;
      }
      // feeding / walking slowly
      w.timer -= dt;
      if (w.timer < 0) { w.timer = this.rng.range(2, 7); w.state = this.rng.chance(0.6) ? 'feed' : 'walk'; if (w.state === 'walk') w.h += this.rng.range(-1, 1); }
      if (w.state === 'walk') {
        const nx = w.pos.x + Math.sin(w.h) * 0.35 * dt, nz = w.pos.z + Math.cos(w.h) * 0.35 * dt, dep = W - this.ground(nx, nz);
        if (w.kind === 'flamingo' ? dep > 0.05 && dep < 0.6 : dep < 0.4) { w.pos.x = nx; w.pos.z = nz; } else w.h += 1.5;
      }
      w.feed += ((w.state === 'feed' ? 1 : 0) - w.feed) * Math.min(1, dt * 2);
      w.pos.y = w.kind === 'flamingo' ? Math.max(this.ground(w.pos.x, w.pos.z), W - 0.6) : Math.max(this.ground(w.pos.x, w.pos.z), W - 0.35);
      const P = WP[w.kind]; if (!P || P.n >= 30) continue;
      const bob = w.state === 'walk' ? Math.sin(t * 4 + w.ph) * 0.02 : 0;
      _e.set(0, w.h, 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(w.pos.x, w.pos.y + bob, w.pos.z), _q, _s.set(1, 1, 1));
      P.body.setMatrixAt(P.n, _m);
      const dip = w.feed * (w.kind === 'flamingo' ? 2.5 : 1.9) + Math.sin(t * 2 + w.ph) * 0.05 * w.feed;
      _m2.makeTranslation(P.pivot.x, P.pivot.y, P.pivot.z).multiply(new THREE.Matrix4().makeRotationX(dip * 0.9 + (w.kind === 'flamingo' ? -0.15 : 0.15))).premultiply(_m);
      P.neck.setMatrixAt(P.n, _m2); P.n++;
    }
    this.waders = this.waders.filter((w) => !w.dead);
    for (const k of Object.keys(this.pools)) {
      const P = this.pools[k];
      if (BIRDS[k]) { for (const m of [P.body, P.wl, P.wr]) { m.count = P.n; m.instanceMatrix.needsUpdate = true; } }
      else if (k.endsWith('W')) { for (const m of [P.body, P.neck]) { m.count = P.n; m.instanceMatrix.needsUpdate = true; } }
    }
    // ---- horses
    if (this.pools.horse) this.updateHorses(dt, ctx);
    // ---- starling murmuration around dusk
    if (this.murm) this.updateMurmuration(dt, ctx);
  }

  updateHorses(dt, ctx) {
    const P = this.pools.horse, p = ctx.player.pos, t = this.t, gen = this.world.gen, W = this.water();
    let n = 0, threat = null;
    for (const h of this.horses) { const d = h.pos.distanceTo(p); if (d < 20 || (d < 38 && ctx.player.running)) threat = p; }
    if (threat && !this.herdFleeing) { this.herdFleeing = 6; this.game.audio?.call?.('horse', this.herdC); }
    if (this.herdFleeing) this.herdFleeing = Math.max(0, this.herdFleeing - dt);
    // the herd drifts slowly as a group
    this.herdDir += (this.rng.next() - 0.5) * dt * 0.2;
    if (this.herdC) { this.herdC.x += Math.sin(this.herdDir) * 0.25 * dt; this.herdC.z += Math.cos(this.herdDir) * 0.25 * dt; }
    for (const h of this.horses) {
      const d = h.pos.distanceTo(p);
      if (this.herdFleeing > 0) { h.state = 'flee'; }
      else if (h.state === 'flee') { h.state = 'alert'; h.timer = 3; }
      else if (d < 45 && h.state !== 'alert' && this.rng.chance(dt * 0.6)) { h.state = 'alert'; h.timer = this.rng.range(3, 6); }
      h.timer -= dt;
      if (h.timer < 0 && h.state !== 'flee') {
        h.timer = this.rng.range(3, 10);
        const toC = this.herdC ? Math.hypot(this.herdC.x - h.pos.x, this.herdC.z - h.pos.z) : 0;
        h.state = toC > 16 ? 'walk' : this.rng.chance(0.7) ? 'graze' : 'walk';
        h.h = toC > 16 ? Math.atan2(this.herdC.x - h.pos.x, this.herdC.z - h.pos.z) : h.h + this.rng.range(-1.2, 1.2);
      }
      let target = 0, neckT = 1;
      if (h.state === 'walk') { target = 1.2; neckT = 0.35; }
      else if (h.state === 'graze') { target = this.rng.chance(dt * 0.3) ? 0.6 : 0; neckT = 1; }
      else if (h.state === 'alert') { target = 0; neckT = -0.35; h.h += Math.atan2(Math.sin(Math.atan2(p.x - h.pos.x, p.z - h.pos.z) - h.h), Math.cos(Math.atan2(p.x - h.pos.x, p.z - h.pos.z) - h.h)) * Math.min(1, dt * 1.5); }
      else if (h.state === 'flee') { target = 9 * (h.scale < 0.8 ? 0.95 : 1); neckT = -0.1; const away = Math.atan2(h.pos.x - p.x, h.pos.z - p.z); h.h += Math.atan2(Math.sin(away - h.h), Math.cos(away - h.h)) * Math.min(1, dt * 2); }
      h.speed += (target - h.speed) * Math.min(1, dt * (h.state === 'flee' ? 2.5 : 1.5));
      h.neck += (neckT - h.neck) * Math.min(1, dt * 2);
      if (h.speed > 0.05) {
        const nx = h.pos.x + Math.sin(h.h) * h.speed * dt, nz = h.pos.z + Math.cos(h.h) * h.speed * dt;
        const ok = gen.height(nx, nz) > W + 0.3 && Math.abs(gen.height(nx, nz) - gen.height(h.pos.x, h.pos.z)) < 0.8 * h.speed * dt + 0.15;
        if (ok) { h.pos.x = nx; h.pos.z = nz; } else h.h += 2 * dt + 0.3;
      }
      // keep apart a little
      for (const o of this.horses) if (o !== h) { const dx = h.pos.x - o.pos.x, dz = h.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd < 2.2 && dd > 0.01) { h.pos.x += dx / dd * (2.2 - dd) * 0.5; h.pos.z += dz / dd * (2.2 - dd) * 0.5; } }
      h.pos.y = gen.height(h.pos.x, h.pos.z);
      h.gait += dt * (h.speed < 3 ? h.speed * 2.6 : 5 + h.speed * 0.55);
      if (n >= 12) continue;
      const S = h.scale, sw = Math.min(1, h.speed / 1.2), gallop = smoothstep(3, 6, h.speed);
      const slope = Math.atan2(gen.height(h.pos.x + Math.sin(h.h), h.pos.z + Math.cos(h.h)) - gen.height(h.pos.x - Math.sin(h.h), h.pos.z - Math.cos(h.h)), 2);
      const bounce = Math.abs(Math.sin(h.gait)) * 0.05 * sw + gallop * Math.sin(h.gait * 2) * 0.06;
      _e.set(-slope + gallop * Math.sin(h.gait) * 0.05, h.h, 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(h.pos.x, h.pos.y + bounce, h.pos.z), _q, _s.set(S, S, S));
      P.body.setMatrixAt(n, _m);
      // neck: 1 = grazing (head to the ground), 0 = carried, negative = head high
      const bite = h.state === 'graze' ? Math.sin(t * 3 + h.ph) * 0.05 : 0;
      _m2.makeTranslation(0, 1.36, 0.7).multiply(new THREE.Matrix4().makeRotationX(0.15 + h.neck * 1.05 + bite)).premultiply(_m);
      P.neck.setMatrixAt(n, _m2);
      const legs = [[0.17, 0.98, 0.6, 0], [-0.17, 0.98, 0.6, Math.PI], [0.17, 1.0, -0.62, Math.PI * (gallop > 0.5 ? 0.25 : 1) + 0.5], [-0.17, 1.0, -0.62, Math.PI * (gallop > 0.5 ? 1.25 : 0) + 0.5]];
      legs.forEach(([lx, ly, lz, ph], i) => {
        const swing = Math.sin(h.gait + ph) * (0.42 * sw + gallop * 0.35);
        _m2.makeTranslation(lx, ly, lz).multiply(new THREE.Matrix4().makeRotationX(swing)).premultiply(_m);
        P.leg.setMatrixAt(n * 4 + i, _m2);
      });
      h.tail += (Math.sin(t * 1.3 + h.ph) * 0.25 - h.tail) * Math.min(1, dt * 3);
      _m2.makeTranslation(0, 1.38, -0.95).multiply(new THREE.Matrix4().makeRotationX(0.35 + gallop * 0.9).multiply(new THREE.Matrix4().makeRotationZ(h.tail))).premultiply(_m);
      P.tail.setMatrixAt(n, _m2);
      const c = h.coat;
      for (const m of [P.body, P.neck, P.tail]) m.instanceColor.setXYZ(n, c[0], c[1], c[2]);
      for (let i = 0; i < 4; i++) P.leg.instanceColor.setXYZ(n * 4 + i, c[0], c[1], c[2]);
      n++;
    }
    for (const m of [P.body, P.neck, P.tail]) { m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    P.leg.count = n * 4; P.leg.instanceMatrix.needsUpdate = true; P.leg.instanceColor.needsUpdate = true;
  }

  // thousands of starlings turning as one before they roost (a few hundred here)
  updateMurmuration(dt, ctx) {
    const time = this.game.sky.time, p = ctx.player.pos;
    const on = time > 16.3 && time < 19.4 && ctx.day > 0.08;
    if (!on) { this.murm.count = 0; this.murmC = null; return; }
    if (!this.murmC || this.murmC.distanceTo(p) > 380) {
      const a = this.rng.range(0, 6.28); this.murmC = V3(p.x + Math.cos(a) * 170, 0, p.z + Math.sin(a) * 170);
      this.murmC.y = Math.max(this.ground(this.murmC.x, this.murmC.z), this.water()) + 55;
    }
    const t = this.t, N = this.murmBase.length, C = this.murmC;
    C.x += Math.sin(t * 0.05) * dt * 3; C.z += Math.cos(t * 0.04) * dt * 3;
    for (let i = 0; i < N; i++) {
      const b = this.murmBase[i];
      // a sphere of birds folded by slow travelling waves into sheets, funnels and ribbons
      const s1 = Math.sin(b.y * 2.2 + t * 0.55), s2 = Math.sin(b.x * 1.7 - t * 0.43 + b.z), s3 = Math.cos(b.z * 2.5 + t * 0.37);
      const R = 26 + 10 * Math.sin(t * 0.21);
      const x = C.x + (b.x * (1 + 0.6 * s1) + 0.45 * s3) * R * 1.6;
      const y = C.y + (b.y * 0.55 + 0.35 * s2) * R;
      const z = C.z + (b.z * (1 + 0.6 * s2) + 0.45 * s1) * R;
      _e.set(0, t * 0.3 + b.x * 2, s3 * 0.6, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
      this.murm.setMatrixAt(i, _m);
    }
    this.murm.count = N; this.murm.instanceMatrix.needsUpdate = true;
    if (!this.murmHeard && C.distanceTo(p) < 260) { this.murmHeard = true; this.game.ui?.toast('Starlings — thousands of them — gathering over the land before they roost.'); }
  }

  // closest large animal the player is looking at (for "observe")
  observable(p, look, cam) {
    let best = null, bd = 60;
    const consider = (pos, kind, ref, dmax) => {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz); if (d > dmax || d > bd) return;
      const dir = new THREE.Vector3(dx, pos.y + 1 - cam.y, dz).normalize(); if (look.dot(dir) < 0.95) return;
      bd = d; best = { kind, ref, dist: d };
    };
    for (const h of this.horses) if (h.state !== 'flee') consider(h.pos, 'horse', h, 60);
    for (const w of this.waders) if (w.state !== 'fly') consider(w.pos, w.kind, w, 45);
    return best;
  }
}
