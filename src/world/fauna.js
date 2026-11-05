// Fauna with consequences: deer, bears, snakes, shore crabs, seals, dolphins and whales.
// They behave the way their real counterparts do:
//   deer are skittish and bound away; a bear forages, stands to smell you, bluff-charges when
//   pressed — and will attack if you crowd it or run; venomous snakes bask, warn and strike only
//   when you come too close, harmless snakes slip away; crabs scuttle sideways for the water;
//   seals hump into the sea when disturbed; far offshore a whale may blow, roll and show its tail.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG, smoothstep } from '../core/rng.js';
import { ANIMALS } from '../data/species.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function vc(g, col) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(col);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export function merge(list) {
  const g = BGU.mergeGeometries(list.map((x) => { const n = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(n.attributes)) if (!['position', 'color'].includes(k)) n.deleteAttribute(k); return n; }));
  g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ quadruped rigs (head towards +z)
export function deerGeometry() {
  const c = '#ffffff', belly = '#e8e0d4', dark = '#2a2420';
  return {
    body: merge([
      vc(new THREE.SphereGeometry(0.27, 12, 9).scale(0.85, 1.0, 2.1).translate(0, 0.98, 0), c),
      vc(new THREE.SphereGeometry(0.23, 9, 7).translate(0, 1.0, 0.42), c),
      vc(new THREE.SphereGeometry(0.24, 9, 7).translate(0, 1.02, -0.42), c),
      vc(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.6, 1).translate(0, 0.98, -0.62), belly), // rump patch
    ]),
    neck: merge([
      vc(new THREE.CylinderGeometry(0.08, 0.15, 0.6, 8).translate(0, 0.3, 0).rotateX(0.35), c),
      vc(new THREE.CylinderGeometry(0.05, 0.1, 0.38, 8).rotateX(Math.PI / 2 + 0.6).translate(0, 0.58, 0.3), c),
      vc(new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.45, 0.47), '#1a1614'),
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.05, 0.18, 4).scale(1, 1, 0.4).rotateZ(sd * 0.6).translate(sd * 0.1, 0.72, 0.18), c)),
    ]),
    antlers: merge([-1, 1].flatMap((sd) => [
      vc(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 5).rotateZ(sd * 0.35).translate(sd * 0.1, 0.92, 0.2), '#d8ccb4'),
      vc(new THREE.CylinderGeometry(0.01, 0.014, 0.18, 4).rotateX(0.9).translate(sd * 0.13, 0.95, 0.3), '#d8ccb4'),
      vc(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 4).rotateZ(sd * 0.9).translate(sd * 0.2, 1.08, 0.2), '#d8ccb4'),
    ])),
    leg: merge([
      vc(new THREE.CylinderGeometry(0.06, 0.035, 0.42, 6).translate(0, -0.2, 0), c),
      vc(new THREE.CylinderGeometry(0.025, 0.028, 0.44, 5).translate(0, -0.62, 0), c),
      vc(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 5).translate(0, -0.86, 0), dark),
    ]),
    hips: [[0.12, 0.88, 0.42], [-0.12, 0.88, 0.42], [0.12, 0.9, -0.44], [-0.12, 0.9, -0.44]],
    neckAt: [0, 1.08, 0.48],
  };
}
function bearGeometry() {
  const c = '#ffffff', dark = '#3a3028';
  return {
    body: merge([
      vc(new THREE.SphereGeometry(0.5, 14, 10).scale(0.95, 0.95, 1.65).translate(0, 0.95, 0), c),
      vc(new THREE.SphereGeometry(0.42, 10, 8).translate(0, 1.12, 0.5), c),  // shoulder hump
      vc(new THREE.SphereGeometry(0.45, 10, 8).translate(0, 0.98, -0.55), c),
    ]),
    neck: merge([
      vc(new THREE.CylinderGeometry(0.22, 0.32, 0.4, 9).rotateX(1.2).translate(0, 0.0, 0.18), c),
      vc(new THREE.SphereGeometry(0.25, 10, 8).scale(0.95, 0.9, 1.05).translate(0, 0.02, 0.42), c),
      vc(new THREE.CylinderGeometry(0.09, 0.14, 0.24, 8).rotateX(Math.PI / 2).translate(0, -0.04, 0.64), c), // muzzle
      vc(new THREE.SphereGeometry(0.05, 6, 4).translate(0, -0.02, 0.77), '#141210'),
      ...[-1, 1].map((sd) => vc(new THREE.SphereGeometry(0.07, 6, 5).scale(1, 1, 0.5).translate(sd * 0.17, 0.22, 0.36), c)),
    ]),
    antlers: null,
    leg: merge([
      vc(new THREE.CylinderGeometry(0.15, 0.12, 0.45, 8).translate(0, -0.2, 0), c),
      vc(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 7).translate(0, -0.55, 0), c),
      vc(new THREE.SphereGeometry(0.13, 7, 5).scale(1, 0.5, 1.4).translate(0, -0.7, 0.06), dark),
    ]),
    hips: [[0.26, 0.75, 0.55], [-0.26, 0.75, 0.55], [0.26, 0.75, -0.6], [-0.26, 0.75, -0.6]],
    neckAt: [0, 1.15, 0.85],
  };
}

export class Rig {
  constructor(group, geo, mat, N) {
    const mk = (g, n = N) => { const m = new THREE.InstancedMesh(g, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); group.add(m); return m; };
    this.geo = geo; this.body = mk(geo.body); this.neck = mk(geo.neck); this.leg = mk(geo.leg, N * 4); this.ant = geo.antlers ? mk(geo.antlers) : null; this.n = 0; this.na = 0;
  }
  begin() { this.n = 0; this.na = 0; }
  // a: { pos, h, pitch, scale, gait, sw, gallop, neck (rad), col, antlers, rear (0..1 standing up) }
  draw(a) {
    const G = this.geo, i = this.n++;
    const rear = a.rear || 0;
    const col = a.col.map((v) => Math.pow(v, 2.2)); // coat colours are given in sRGB
    _e.set(-(a.pitch || 0) - rear * 1.05, a.h, 0, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(a.pos.x, a.pos.y + (a.bounce || 0) + rear * 0.35, a.pos.z), _q, _s.setScalar(a.scale || 1));
    // rearing pivots about the hind legs
    if (rear) { _m2.makeTranslation(0, 0, -0.55).multiply(_r.makeRotationX(0)).premultiply(_m); }
    this.body.setMatrixAt(i, _m);
    _m2.makeTranslation(...G.neckAt).multiply(_r.makeRotationX(a.neck)).premultiply(_m);
    this.neck.setMatrixAt(i, _m2);
    if (this.ant && a.antlers) { this.ant.setMatrixAt(this.na, _m2); this.ant.instanceColor.setXYZ(this.na, 1, 1, 1); this.na++; }
    G.hips.forEach(([x, y, z], k) => {
      const ph = [0, Math.PI, Math.PI * (a.gallop > 0.5 ? 0.25 : 1) + 0.5, Math.PI * (a.gallop > 0.5 ? 1.25 : 0) + 0.5][k];
      let sw = Math.sin(a.gait + ph) * (0.45 * a.sw + a.gallop * 0.4);
      if (rear && k < 2) sw = 0.9 + Math.sin(a.gait * 0.3 + k) * 0.1; // forepaws hanging when standing up
      _m2.makeTranslation(x, y, z).multiply(_r.makeRotationX(sw)).premultiply(_m);
      this.leg.setMatrixAt(i * 4 + k, _m2); this.leg.instanceColor.setXYZ(i * 4 + k, col[0], col[1], col[2]);
    });
    for (const m of [this.body, this.neck]) m.instanceColor.setXYZ(i, col[0], col[1], col[2]);
  }
  end() {
    for (const m of [this.body, this.neck]) { m.count = this.n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    this.leg.count = this.n * 4; this.leg.instanceMatrix.needsUpdate = true; this.leg.instanceColor.needsUpdate = true;
    if (this.ant) { this.ant.count = this.na; this.ant.instanceMatrix.needsUpdate = true; }
  }
}

// ------------------------------------------------------------------ snakes
const SNAKES = {
  adder:        { len: 0.65, r: 0.022, base: '#8a7a5a', mark: '#1e1a14', belly: '#3a3430', pattern: 'zigzag', venom: true, head: 'viper' },
  grass_snake:  { len: 1.0, r: 0.022, base: '#5a6a3a', mark: '#22261a', belly: '#d8d0b0', pattern: 'bars', collar: '#e8d04a', venom: false },
  rattlesnake:  { len: 1.2, r: 0.04, base: '#a8987a', mark: '#4a3e2e', belly: '#e0d8c4', pattern: 'diamond', edge: '#efe8d8', venom: true, rattle: true, head: 'viper' },
  gopher_snake: { len: 1.3, r: 0.032, base: '#c8b07a', mark: '#4a3420', belly: '#efe6c8', pattern: 'blotch', venom: false, mimic: true },
  fer_de_lance: { len: 1.5, r: 0.04, base: '#7a6a4e', mark: '#2a2018', belly: '#e0d8a8', pattern: 'triangle', edge: '#d8c898', venom: true, head: 'viper' },
  boa:          { len: 2.2, r: 0.06, base: '#b09a7a', mark: '#4a3424', belly: '#e8dccc', pattern: 'saddle', tail: '#8a3a24', venom: false },
};
function snakeTexture(sp) {
  const W = 512, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const k = c.getContext('2d');
  const g = k.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sp.belly); g.addColorStop(0.25, sp.base); g.addColorStop(0.5, sp.base); g.addColorStop(0.75, sp.base); g.addColorStop(1, sp.belly);
  k.fillStyle = g; k.fillRect(0, 0, W, H);
  k.fillStyle = sp.mark; k.strokeStyle = sp.edge || sp.mark;
  const mid = H / 2;
  if (sp.pattern === 'zigzag') { k.lineWidth = 7; k.strokeStyle = sp.mark; k.beginPath(); for (let x = 0; x <= W; x += 12) k.lineTo(x, mid + (x / 12 % 2 ? 9 : -9)); k.stroke(); for (let x = 6; x < W; x += 12) for (const s of [-1, 1]) { k.beginPath(); k.arc(x, mid + s * 20, 3, 0, 7); k.fill(); } }
  else if (sp.pattern === 'diamond' || sp.pattern === 'triangle') { for (let x = 10; x < W; x += 26) { k.lineWidth = 3; k.beginPath(); if (sp.pattern === 'diamond') { k.moveTo(x, mid - 16); k.lineTo(x + 12, mid); k.lineTo(x, mid + 16); k.lineTo(x - 12, mid); } else { k.moveTo(x - 12, mid - 22); k.lineTo(x + 12, mid - 22); k.lineTo(x, mid); k.moveTo(x - 12, mid + 22); k.lineTo(x + 12, mid + 22); k.lineTo(x, mid); } k.closePath(); k.fill(); k.stroke(); } }
  else if (sp.pattern === 'bars') { for (let x = 8; x < W; x += 18) for (const s of [-1, 1]) k.fillRect(x, mid + s * 14 - 3, 5, 6); }
  else if (sp.pattern === 'blotch' || sp.pattern === 'saddle') { for (let x = 8; x < W; x += sp.pattern === 'saddle' ? 34 : 22) { k.beginPath(); k.ellipse(x, mid, sp.pattern === 'saddle' ? 12 : 7, 13, 0, 0, 7); k.fill(); } }
  if (sp.tail) { k.fillStyle = sp.tail; k.globalAlpha = 0.5; k.fillRect(0, 10, W * 0.22, H - 20); k.globalAlpha = 1; }
  if (sp.collar) { k.fillStyle = sp.collar; k.fillRect(W - 40, 0, 10, H); k.fillStyle = '#111'; k.fillRect(W - 30, 0, 6, H); }
  if (sp.rattle) { for (let x = 0; x < 34; x += 8) { k.fillStyle = x / 8 % 2 ? '#f0ece4' : '#1a1814'; k.fillRect(x + 6, 0, 8, H); } k.fillStyle = '#c8b88a'; k.fillRect(0, 0, 6, H); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const SEG = 30, SIDES = 7;
function makeSnakeMesh(id) {
  const sp = SNAKES[id];
  const g = new THREE.BufferGeometry();
  const n = (SEG + 1) * (SIDES + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= SEG; i++) for (let j = 0; j <= SIDES; j++) { uv[(i * (SIDES + 1) + j) * 2] = i / SEG; uv[(i * (SIDES + 1) + j) * 2 + 1] = j / SIDES; }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < SIDES; j++) { const a = i * (SIDES + 1) + j, b = a + SIDES + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: snakeTexture(sp), roughness: 0.7, metalness: 0, envMapIntensity: 0.6 }));
  m.castShadow = true; m.frustumCulled = false; return m;
}
// lay the tube along a list of points (tail → head), radius profile tapering at both ends
function poseSnake(mesh, pts, R, headUp = 0) {
  const pos = mesh.geometry.attributes.position, nrm = mesh.geometry.attributes.normal;
  const up = V3(0, 1, 0), t = V3(), side = V3(), nup = V3(), o = V3(), nn = V3();
  for (let i = 0; i <= SEG; i++) {
    const f = i / SEG, P = pts[i];
    t.subVectors(pts[Math.min(SEG, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    side.crossVectors(t, up).normalize(); nup.crossVectors(side, t).normalize();
    let r = R * Math.min(1, f * 5 + 0.15) * (f > 0.93 ? 0.75 + (1 - f) * 2 : 1);
    if (f > 0.9 && f < 0.97) r *= 1.3; // head wider than neck
    for (let j = 0; j <= SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2 - Math.PI / 2;
      nn.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(nup, Math.sin(a));
      o.copy(P).addScaledVector(nn, r).addScaledVector(nup, r * 0.15);
      const v = i * (SIDES + 1) + j;
      pos.setXYZ(v, o.x, o.y - (Math.sin(a) < 0 ? r * 0.25 * -Math.sin(a) : 0), o.z); nrm.setXYZ(v, nn.x, nn.y, nn.z);
    }
  }
  pos.needsUpdate = true; nrm.needsUpdate = true; mesh.geometry.computeBoundingSphere();
}

// ------------------------------------------------------------------
export class Fauna {
  constructor(game, world, spec = {}) {
    this.game = game; this.world = world; this.spec = spec;
    this.rng = new RNG((world.gen.seed ^ 0xfa0a) >>> 0);
    this.group = new THREE.Group(); this.group.name = 'fauna'; game.scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    this.deer = []; this.bear = null; this.snakes = []; this.crabs = []; this.seals = []; this.dolphins = []; this.t = 0;
    if (spec.deer) this.deerRig = new Rig(this.group, deerGeometry(), mat, 10);
    if (spec.bear) this.bearRig = new Rig(this.group, bearGeometry(), mat, 1);
    if (spec.crabs) {
      const crab = merge([vc(new THREE.SphereGeometry(0.045, 8, 5).scale(1.3, 0.45, 1).translate(0, 0.03, 0), '#6a5a2a'),
        ...[-1, 1].flatMap((sd) => [vc(new THREE.SphereGeometry(0.018, 6, 4).scale(1.4, 0.8, 1).translate(sd * 0.07, 0.035, 0.04), '#7a4a24'),
          ...[0, 1, 2].map((k) => vc(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 3).rotateZ(sd * 1.0).translate(sd * 0.065, 0.02, -0.025 + k * 0.022), '#5a4a22'))])]);
      this.crabMesh = new THREE.InstancedMesh(crab, mat, 24); this.crabMesh.count = 0; this.crabMesh.frustumCulled = false; this.group.add(this.crabMesh);
    }
    if (spec.seals) {
      const seal = merge([vc(new THREE.SphereGeometry(0.3, 12, 8).scale(1, 0.75, 2.6).translate(0, 0.2, 0), '#ffffff'),
        vc(new THREE.SphereGeometry(0.15, 9, 7).translate(0, 0.33, 0.78), '#ffffff'), vc(new THREE.SphereGeometry(0.03, 5, 4).translate(0, 0.32, 0.93), '#151515'),
        ...[-1, 1].map((sd) => vc(new THREE.SphereGeometry(0.09, 6, 4).scale(0.4, 0.2, 1).translate(sd * 0.22, 0.08, 0.35), '#ffffff')),
        vc(new THREE.ConeGeometry(0.12, 0.3, 6).rotateX(-Math.PI / 2).scale(1.6, 0.3, 1).translate(0, 0.16, -0.85), '#ffffff')]);
      this.sealMesh = new THREE.InstancedMesh(seal, mat, 8); this.sealMesh.count = 0; this.sealMesh.frustumCulled = false; this.sealMesh.castShadow = true;
      this.sealMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(24).fill(1), 3); this.group.add(this.sealMesh);
    }
    if (spec.dolphins) {
      const d = merge([vc(new THREE.SphereGeometry(0.3, 10, 7).scale(0.7, 0.75, 3.3).translate(0, 0, 0), '#5a6670'),
        vc(new THREE.ConeGeometry(0.16, 0.38, 4).scale(0.25, 1, 1).rotateX(-0.5).translate(0, 0.32, -0.15), '#4a5660'),
        vc(new THREE.ConeGeometry(0.24, 0.3, 4).rotateX(-Math.PI / 2).scale(1.8, 0.2, 1).translate(0, 0, -1.05), '#4a5660')]);
      this.dolphinMesh = new THREE.InstancedMesh(d, mat, 8); this.dolphinMesh.count = 0; this.dolphinMesh.frustumCulled = false; this.group.add(this.dolphinMesh);
    }
    if (spec.whales) {
      const back = merge([vc(new THREE.SphereGeometry(1, 16, 10).scale(2.6, 1.4, 14).translate(0, 0, 0), '#3e4852'),
        vc(new THREE.ConeGeometry(0.6, 1.0, 5).scale(0.3, 1, 1).translate(0, 1.4, -7), '#3a444e')]);
      this.whaleBack = new THREE.Mesh(back, mat); this.whaleBack.visible = false; this.group.add(this.whaleBack);
      const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.quadraticCurveTo(1.8, 0.6, 3.6, 2.6); fl.quadraticCurveTo(1.8, 1.6, 0, 1.4); fl.quadraticCurveTo(-1.8, 1.6, -3.6, 2.6); fl.quadraticCurveTo(-1.8, 0.6, 0, 0);
      const fluke = merge([vc(new THREE.ShapeGeometry(fl), '#2e363e'), vc(new THREE.CylinderGeometry(0.4, 0.8, 3, 8).translate(0, -1.5, 0), '#3a444e')]);
      this.whaleTail = new THREE.Mesh(fluke, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); this.whaleTail.visible = false; this.group.add(this.whaleTail);
      const N = 160, sp = new Float32Array(N * 3);
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.spout = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xeef2f4, size: 6, transparent: true, opacity: 0.7, depthWrite: false, map: dotTexture() }));
      this.spout.frustumCulled = false; this.spout.visible = false; this.group.add(this.spout);
      this.nextWhale = 25 + this.rng.range(0, 40);
    }
    this.nextSnake = 40 + this.rng.range(0, 60); this.bearTimer = 20 + this.rng.range(0, 40);
  }

  dispose() { this.game.scene.remove(this.group); }
  gen() { return this.world.gen; }
  inDest(x, z) { return this.world.gen.biomeT(x, z) > 0.55; }
  ground(x, z) { return this.world.gen.height(x, z); }

  update(dt, ctx) {
    this.t += dt;
    const p = ctx.player.pos;
    if (this.deerRig) this.updateDeer(dt, ctx);
    if (this.bearRig) this.updateBear(dt, ctx);
    if (this.spec.snakes?.length) this.updateSnakes(dt, ctx);
    if (this.crabMesh) this.updateCrabs(dt, ctx);
    if (this.sealMesh) this.updateSeals(dt, ctx);
    if (this.dolphinMesh) this.updateDolphins(dt, ctx);
    if (this.spout) this.updateWhale(dt, ctx);
  }

  spot(p, test, rMin, rMax, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng.next() * 6.283, r = this.rng.range(rMin, rMax), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (this.inDest(x, z) && test(x, z)) return { x, z };
    }
    return null;
  }

  // ---------------------------------------------------------------- deer: shy, alert, bounding away
  updateDeer(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (!this.deer.length && this.rng.chance(dt * 0.05)) {
      const coast = !!this.spec.crabs && this.rng.chance(0.4);
      const s = this.spot(p, (x, z) => { const q = g.sample(x, z); return q.h - W > 0.4 && (coast ? q.beach > 0.4 : q.forest < 0.5 && q.forest > 0.05); }, 60, 150);
      if (s) {
        const n = this.rng.int(2, 5);
        for (let i = 0; i < n; i++) this.deer.push({ pos: V3(s.x + this.rng.range(-8, 8), 0, s.z + this.rng.range(-8, 8)), h: this.rng.range(0, 6.28), state: 'graze', timer: this.rng.range(2, 6), speed: 0, gait: 0, neck: 1.6, ph: this.rng.range(0, 6), stag: i === 0 && this.rng.chance(0.6), scale: this.rng.range(0.9, 1.05) });
      }
    }
    let alarm = false;
    for (const d of this.deer) { const dist = d.pos.distanceTo(p); if (dist < 34 || (dist < 60 && ctx.player.running)) alarm = true; }
    const R = this.deerRig; R.begin();
    const col = this.spec.deer === 'mule_deer' ? [0.6, 0.52, 0.44] : [0.62, 0.4, 0.26];
    for (const d of this.deer) {
      const dist = d.pos.distanceTo(p);
      if (alarm && d.state !== 'flee') { d.state = d.state === 'alert' && d.timer < 0.8 ? 'flee' : d.state === 'alert' ? 'alert' : 'alert'; if (d.state === 'alert' && d.timer > 1.2) d.timer = this.rng.range(0.4, 1.2); }
      d.timer -= dt;
      if (d.state === 'alert' && d.timer < 0) { d.state = 'flee'; d.timer = 8; if (!this.deerBolted) { this.deerBolted = true; this.game.audio?.call?.('deer', d.pos); } }
      if (d.state === 'flee' && d.timer < 0) { d.dead = dist > 90; d.state = 'graze'; }
      if ((d.state === 'graze' || d.state === 'walk') && d.timer < 0) { d.state = this.rng.chance(0.6) ? 'graze' : 'walk'; d.timer = this.rng.range(2, 7); d.h += this.rng.range(-1, 1); }
      let target = 0, neckT = 1.7;
      if (d.state === 'walk') { target = 0.9; neckT = 0.4; }
      if (d.state === 'alert') { target = 0; neckT = -0.25; d.h += angDiff(Math.atan2(p.x - d.pos.x, p.z - d.pos.z), d.h) * Math.min(1, dt * 2); }
      if (d.state === 'flee') { target = 11; neckT = -0.1; d.h += angDiff(Math.atan2(d.pos.x - p.x, d.pos.z - p.z), d.h) * Math.min(1, dt * 2.5); }
      d.speed += (target - d.speed) * Math.min(1, dt * 3);
      d.neck += (neckT - d.neck) * Math.min(1, dt * 3);
      if (d.speed > 0.05) { const nx = d.pos.x + Math.sin(d.h) * d.speed * dt, nz = d.pos.z + Math.cos(d.h) * d.speed * dt; if (g.height(nx, nz) > W + 0.2) { d.pos.x = nx; d.pos.z = nz; } else d.h += 1.2; }
      d.pos.y = g.height(d.pos.x, d.pos.z);
      d.gait += dt * (d.speed < 3 ? d.speed * 3.2 : 7 + d.speed * 0.4);
      const gallop = smoothstep(3, 6, d.speed);
      R.draw({ pos: d.pos, h: d.h, scale: d.scale * (d.stag ? 1.08 : 1), gait: d.gait, sw: Math.min(1, d.speed), gallop, neck: d.neck, col, antlers: d.stag, bounce: gallop * Math.abs(Math.sin(d.gait)) * 0.35 });
    }
    this.deer = this.deer.filter((d) => !d.dead && d.pos.distanceTo(p) < 260);
    R.end();
  }

  // ---------------------------------------------------------------- bear
  updateBear(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water, pl = ctx.player;
    if (!this.bear) {
      if (this.bearRig.body.count) { this.bearRig.begin(); this.bearRig.end(); } // the bear has gone: don't leave its image behind
      this.bearTimer -= dt;
      if (this.bearTimer < 0) {
        this.bearTimer = this.rng.range(60, 140);
        if (this.rng.chance(0.55)) {
          const s = this.spot(p, (x, z) => { const q = g.sample(x, z); return q.h - W > 0.6 && q.forest > 0.15; }, 80, 160);
          if (s) this.bear = { pos: V3(s.x, g.height(s.x, s.z), s.z), h: this.rng.range(0, 6.28), state: 'forage', timer: 3, speed: 0, gait: 0, neck: 0.9, rear: 0, ph: 0, bluff: 0, warned: false };
        }
      }
      return;
    }
    const b = this.bear, d = b.pos.distanceTo(p), toP = Math.atan2(p.x - b.pos.x, p.z - b.pos.z);
    // is the player coming closer, standing still, backing off or running?
    const prevD = this.prevBearD ?? d; const closing = (prevD - d) / Math.max(dt, 1e-3); this.prevBearD = d;
    b.timer -= dt;
    switch (b.state) {
      case 'forage':
        if (b.timer < 0) { b.timer = this.rng.range(3, 8); b.h += this.rng.range(-1.2, 1.2); b.walking = this.rng.chance(0.5); }
        if (d < 40) { b.state = 'aware'; b.timer = this.rng.range(3, 5); this.game.audio?.call?.('bear_huff', b.pos); if (!b.warned) { b.warned = true; this.game.ui.toast(`<b>A ${ANIMALS[this.spec.bear].name.toLowerCase()}!</b> Don't run. Back away slowly.`, true); } }
        break;
      case 'aware': // stands up to smell you, then decides
        b.rear = Math.min(1, b.rear + dt * 1.5) * (b.timer > 1 ? 1 : b.timer);
        if (d < 14 || (pl.running && d < 30) || (closing > 0.6 && d < 24)) { b.state = 'charge'; b.bluff = pl.running ? 0.2 : 0.75; b.stopAt = this.rng.range(3, 7); this.game.audio?.call?.('bear_roar', b.pos); this.game.ui.toast('The bear charges!', true); }
        else if (b.timer < 0) { if (d > 26 || closing < -0.2) { b.state = 'leave'; b.timer = 20; b.h = toP + Math.PI + this.rng.range(-0.5, 0.5); } else b.timer = 1.5; }
        break;
      case 'charge': {
        b.rear = Math.max(0, b.rear - dt * 4);
        b.h += angDiff(toP, b.h) * Math.min(1, dt * 4);
        const bluffing = this.rng.next() < 1 && b.bluff > 0.5;
        if (pl.running) b.bluff = Math.max(0.15, b.bluff - dt * 0.3); // running away turns a bluff into a real chase
        if (b.bluff > 0.5 && d < b.stopAt) { b.state = 'bluffed'; b.timer = 2.5; this.game.audio?.call?.('bear_huff', b.pos); this.game.ui.toast('It stops short — a bluff charge. Keep backing away slowly.', true); break; }
        if (d < 1.7) { b.state = 'attack'; this.game.onBearAttack?.(this.spec.bear); }
        void bluffing; break;
      }
      case 'bluffed':
        if (b.timer < 0) { b.state = 'leave'; b.timer = 25; b.h = toP + Math.PI; }
        if (d < 3 && closing > 0.3) { b.state = 'charge'; b.bluff = 0; }
        break;
      case 'leave':
        if (b.timer < 0 || d > 120) { this.bear = null; return; }
        break;
      case 'attack': if (b.timer < -4) this.bear = null; return;
    }
    let target = 0, neckT = 0.9;
    if (b.state === 'forage') { target = b.walking ? 0.9 : 0; neckT = 1.0 + Math.sin(this.t * 0.7) * 0.2; }
    else if (b.state === 'aware' || b.state === 'bluffed') { b.h += angDiff(toP, b.h) * Math.min(1, dt * 2); neckT = 0.2; }
    else if (b.state === 'charge') { target = 13; neckT = 0.45; }
    else if (b.state === 'leave') { target = 1.6; neckT = 0.6; }
    b.speed += (target - b.speed) * Math.min(1, dt * (b.state === 'charge' ? 4 : 2));
    b.neck += (neckT - b.neck) * Math.min(1, dt * 3);
    if (b.speed > 0.05) { const nx = b.pos.x + Math.sin(b.h) * b.speed * dt, nz = b.pos.z + Math.cos(b.h) * b.speed * dt; if (g.height(nx, nz) > W - 0.5) { b.pos.x = nx; b.pos.z = nz; } else b.h += 1; }
    b.pos.y = g.height(b.pos.x, b.pos.z);
    b.gait += dt * (b.speed < 3 ? b.speed * 3 : 6 + b.speed * 0.4);
    const R = this.bearRig; R.begin();
    const col = this.spec.bear === 'black_bear' ? [0.16, 0.13, 0.11] : [0.42, 0.29, 0.18];
    R.draw({ pos: b.pos, h: b.h, scale: this.spec.bear === 'black_bear' ? 0.85 : 1, gait: b.gait, sw: Math.min(1, b.speed), gallop: smoothstep(3, 7, b.speed), neck: b.neck - 0.9, col, rear: b.rear, bounce: smoothstep(3, 7, b.speed) * Math.abs(Math.sin(b.gait)) * 0.15 });
    R.end();
  }

  // ---------------------------------------------------------------- snakes
  updateSnakes(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water, day = ctx.day;
    this.nextSnake -= dt;
    if (this.nextSnake < 0 && this.snakes.length < 2 && day > 0.2) {
      this.nextSnake = this.rng.range(50, 110);
      const f = ctx.player.forward ? ctx.player.forward(V3()) : V3(0, 0, -1);
      for (let k = 0; k < 20; k++) {
        const a = Math.atan2(f.x, f.z) + this.rng.range(-0.9, 0.9), r = this.rng.range(14, 30);
        const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        if (!this.inDest(x, z)) continue;
        const q = g.sample(x, z); if (q.h - W < 0.4 || q.forest > 0.75) continue;
        const id = this.rng.pick(this.spec.snakes);
        const mesh = makeSnakeMesh(id); this.group.add(mesh);
        this.snakes.push({ id, sp: SNAKES[id], mesh, pos: V3(x, q.h, z), h: this.rng.range(0, 6.28), state: this.rng.chance(0.6) ? 'bask' : 'move', timer: this.rng.range(6, 15), wave: 0, warned: false, seen: false, rattleT: 0, coil: 1 });
        break;
      }
    }
    for (const s of this.snakes) {
      const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z), sp = s.sp;
      s.timer -= dt;
      if (sp.venom) {
        if (d < 3.6 && s.state !== 'flee') { s.state = 'defend'; s.h += angDiff(Math.atan2(p.x - s.pos.x, p.z - s.pos.z), s.h) * Math.min(1, dt * 4); }
        else if (s.state === 'defend' && d > 5) { s.state = 'flee'; s.timer = 6; s.h = Math.atan2(s.pos.x - p.x, s.pos.z - p.z); }
        if (s.state === 'defend') {
          s.rattleT -= dt;
          if (s.rattleT < 0) { s.rattleT = sp.rattle ? 1.2 : 1.6; this.game.audio?.call?.(sp.rattle ? 'rattle' : 'hiss', s.pos); }
          if (!s.warned) { s.warned = true; this.game.ui.toast(sp.rattle ? '<b>A rattle at your feet!</b> Freeze, find the snake, then step slowly away.' : '<b>A snake hisses at your feet!</b> Step slowly back.', true); }
          // it strikes only when you are within reach (about half its length) — or step on it
          if (d < 0.35 + sp.len * 0.55 && !this.game.player.frozen && Math.random() < dt * 1.8) { s.state = 'flee'; s.timer = 8; s.h = Math.atan2(s.pos.x - p.x, s.pos.z - p.z); this.game.onSnakeBite?.(s.id); }
        }
      } else {
        if (d < 4 && s.state !== 'flee') { s.state = 'flee'; s.timer = 7; s.h = Math.atan2(s.pos.x - p.x, s.pos.z - p.z); if (sp.mimic && !s.warned) { s.warned = true; this.game.audio?.call?.('hiss', s.pos); this.game.ui.toast('A loud hiss and a buzzing tail — but no rattle…'); } }
      }
      if (s.state === 'bask' && s.timer < 0) { s.state = 'move'; s.timer = this.rng.range(5, 12); }
      if (s.state === 'move' && s.timer < 0) { s.state = 'bask'; s.timer = this.rng.range(8, 20); }
      if (s.state === 'flee' && s.timer < 0) { s.gone = true; }
      const moving = s.state === 'move' || s.state === 'flee';
      const v = s.state === 'flee' ? 1.4 : s.state === 'move' ? 0.35 : 0;
      if (moving) { s.h += Math.sin(this.t * 0.5 + s.pos.x) * dt * 0.4; const nx = s.pos.x + Math.sin(s.h) * v * dt, nz = s.pos.z + Math.cos(s.h) * v * dt; if (g.height(nx, nz) > W + 0.05 || s.id === 'grass_snake') { s.pos.x = nx; s.pos.z = nz; } else s.h += 1; }
      s.wave += dt * (moving ? 4 + v * 3 : 0.3);
      s.coil += ((s.state === 'bask' || s.state === 'defend' ? 1 : 0) - s.coil) * Math.min(1, dt * 2);
      // body points tail → head
      const pts = [], L = sp.len, ch = Math.sin(s.h), shh = Math.cos(s.h);
      for (let i = 0; i <= SEG; i++) {
        const f = i / SEG;
        // travelling S-wave behind the head
        const back = (1 - f) * L, lat = Math.sin(back * 7 / L * 2 - s.wave) * 0.11 * L * Math.min(1, back / (0.2 * L));
        let lx = lat, lz = -back + L * 0.5;
        // coil: wrap into a flat spiral, head raised in the middle (defend pose: S-loop neck)
        // a tight Archimedean coil: each turn lies against the last (spacing ≈ body width)
        const ell = (1 - f) * L, sp0 = sp.r * 2.3, r0 = sp.r * 1.5;
        const ang = (-r0 + Math.sqrt(r0 * r0 + sp0 * ell / Math.PI)) / (sp0 / (2 * Math.PI)), rad = r0 + sp0 * ang / (2 * Math.PI);
        const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
        lx = lx * (1 - s.coil) + cx * s.coil; lz = lz * (1 - s.coil) + cz * s.coil;
        let y = 0.02 + sp.r;
        if (f > 0.75) y += s.coil * (f - 0.75) * (s.state === 'defend' ? 1.2 : 0.3) * L * 0.8;
        const wx = s.pos.x + lx * shh + lz * ch, wz = s.pos.z - lx * ch + lz * shh;
        pts.push(V3(wx, g.height(wx, wz) + y, wz));
      }
      poseSnake(s.mesh, pts, sp.r);
    }
    for (const s of this.snakes) if (s.gone || s.pos.distanceTo(p) > 60) { this.group.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.map.dispose(); s.mesh.material.dispose(); s.dead = true; }
    this.snakes = this.snakes.filter((s) => !s.dead);
  }

  // ---------------------------------------------------------------- crabs
  updateCrabs(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (this.crabs.length < 10 && this.rng.chance(dt * 1.5)) {
      for (let k = 0; k < 8; k++) {
        const a = this.rng.next() * 6.28, r = this.rng.range(6, 26), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (!this.inDest(x, z)) continue;
        const q = g.sample(x, z), above = q.h - W;
        if (above < -0.05 || above > 1.6 || (q.beach < 0.3 && q.cliff < 0.2 && !(q.river > 0 && above < 0.6))) continue;
        this.crabs.push({ pos: V3(x, q.h, z), h: this.rng.range(0, 6.28), state: 'feed', timer: this.rng.range(1, 4), sp: 0 });
        break;
      }
    }
    let n = 0;
    for (const c of this.crabs) {
      const d = c.pos.distanceTo(p);
      if (d < (ctx.player.speed > 2 ? 4.5 : 2.4) && c.state !== 'flee') { c.state = 'flee'; c.timer = 3; c.dir = Math.atan2(c.pos.x - p.x, c.pos.z - p.z); }
      c.timer -= dt;
      if (c.state === 'feed' && c.timer < 0) { c.state = 'walk'; c.timer = this.rng.range(0.5, 2); c.dir = this.rng.range(0, 6.28); }
      else if (c.state === 'walk' && c.timer < 0) { c.state = 'feed'; c.timer = this.rng.range(1, 5); }
      else if (c.state === 'flee' && c.timer < 0) c.state = 'feed';
      const v = c.state === 'flee' ? 1.8 : c.state === 'walk' ? 0.3 : 0;
      if (v) { c.pos.x += Math.sin(c.dir) * v * dt; c.pos.z += Math.cos(c.dir) * v * dt; c.h = c.dir + Math.PI / 2; } // crabs walk sideways
      c.pos.y = g.height(c.pos.x, c.pos.z);
      if (c.pos.y < W - 0.25 || d > 40) { c.dead = true; continue; }
      if (n >= 24) continue;
      _e.set(0, c.h, 0); _q.setFromEuler(_e); _m.compose(_p.set(c.pos.x, Math.max(c.pos.y, W - 0.2) + (v ? Math.abs(Math.sin(this.t * 30)) * 0.005 : 0), c.pos.z), _q, _s.setScalar(1.2));
      this.crabMesh.setMatrixAt(n++, _m);
    }
    this.crabs = this.crabs.filter((c) => !c.dead);
    this.crabMesh.count = n; this.crabMesh.instanceMatrix.needsUpdate = true;
  }
  nearestCrab(p, r = 2) { let best = null, bd = r; for (const c of this.crabs) { const d = c.pos.distanceTo(p); if (d < bd && c.state !== 'flee') { bd = d; best = c; } } return best; }
  removeCrab(c) { c.dead = true; this.crabs = this.crabs.filter((x) => x !== c); }

  // ---------------------------------------------------------------- seals hauled out on the shore
  updateSeals(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (!this.seals.length && this.rng.chance(dt * 0.06)) {
      const s = this.spot(p, (x, z) => { const q = g.sample(x, z); const a = q.h - W; return a > 0.05 && a < 0.9 && (q.beach > 0.5 || q.cliff > 0.3) && g.seaAt(x, z - 0) < 0.9; }, 50, 160, 80);
      if (s) for (let i = 0; i < this.rng.int(3, 7); i++) {
        const x = s.x + this.rng.range(-7, 7), z = s.z + this.rng.range(-7, 7); if (g.height(x, z) < W) continue;
        this.seals.push({ pos: V3(x, 0, z), h: this.rng.range(0, 6.28), state: 'rest', ph: this.rng.range(0, 6), col: this.rng.chance(0.5) ? [0.45, 0.42, 0.38] : [0.62, 0.6, 0.55], banana: this.rng.next() });
      }
    }
    let n = 0;
    for (const s of this.seals) {
      const d = s.pos.distanceTo(p);
      if (s.state === 'rest' && (d < 22 || (d < 40 && ctx.player.running))) {
        s.state = 'flee'; // humps towards the nearest deep water
        let best = s.h, bd = 1e9; for (let a = 0; a < 6.28; a += 0.4) { const x = s.pos.x + Math.sin(a) * 15, z = s.pos.z + Math.cos(a) * 15, dd = g.height(x, z); if (dd < bd) { bd = dd; best = a; } }
        s.h = best; if (!this.sealSplash) { this.sealSplash = true; this.game.ui.toast('The seals hump down into the sea.'); }
      }
      if (s.state === 'flee') { s.pos.x += Math.sin(s.h) * 1.4 * dt; s.pos.z += Math.cos(s.h) * 1.4 * dt; }
      s.pos.y = g.height(s.pos.x, s.pos.z);
      if (s.pos.y < W - 0.5) { s.dead = true; this.game.audio?.splash?.(0.4); this.game.ripples?.drop(s.pos.x, s.pos.z, 1.0, 0.6); continue; }
      if (d > 250) { s.dead = true; continue; }
      const lift = s.state === 'rest' ? Math.max(0, Math.sin(this.t * 0.4 + s.ph)) * 0.25 * s.banana : Math.abs(Math.sin(this.t * 6 + s.ph)) * 0.12;
      _e.set(-lift, s.h, 0); _q.setFromEuler(_e); _m.compose(_p.set(s.pos.x, Math.max(s.pos.y, W - 0.2) - 0.03, s.pos.z), _q, _s.setScalar(1));
      this.sealMesh.setMatrixAt(n, _m); this.sealMesh.instanceColor.setXYZ(n, s.col[0] ** 2.2, s.col[1] ** 2.2, s.col[2] ** 2.2); n++;
    }
    this.seals = this.seals.filter((s) => !s.dead);
    this.sealMesh.count = n; this.sealMesh.instanceMatrix.needsUpdate = true; this.sealMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- dolphins: a pod rolling past offshore
  seaPoint(p, rMin, rMax, depthMin) {
    const g = this.gen();
    for (let i = 0; i < 40; i++) {
      const a = this.rng.next() * 6.28, r = this.rng.range(rMin, rMax), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (g.seaAt(x, z) > 0.9 && g.p.water - g.height(x, z) > depthMin) return V3(x, g.p.water, z);
    }
    return null;
  }
  updateDolphins(dt, ctx) {
    const p = ctx.player.pos;
    if (!this.pod && this.rng.chance(dt * 0.02)) {
      const c = this.seaPoint(p, 60, 160, 4);
      if (c) { const dir = this.rng.range(0, 6.28); this.pod = { c, dir, t: 0, members: Array.from({ length: this.rng.int(3, 6) }, (_, i) => ({ off: V3(this.rng.range(-6, 6), 0, this.rng.range(-8, 8)), ph: this.rng.range(0, 6) })) }; }
    }
    let n = 0;
    if (this.pod) {
      const P = this.pod; P.t += dt;
      if (P.t > 45) this.pod = null;
      else for (const m of P.members) {
        const ph = (P.t * 0.9 + m.ph) % 3.5, arc = ph < 1.1 ? Math.sin(ph / 1.1 * Math.PI) : -1; // surface roll, then under
        if (arc < 0) continue;
        const x = P.c.x + Math.sin(P.dir) * P.t * 6 + m.off.x, z = P.c.z + Math.cos(P.dir) * P.t * 6 + m.off.z;
        _e.set(-(ph / 1.1 - 0.5) * 1.6, P.dir, 0, 'YXZ'); _q.setFromEuler(_e);
        _m.compose(_p.set(x, this.gen().p.water - 0.45 + arc * 0.7, z), _q, _s.setScalar(1)); this.dolphinMesh.setMatrixAt(n++, _m);
      }
      if (this.pod && !this.podSeen && P.c.distanceTo(p) < 200) { this.podSeen = true; this.game.ui.toast('Dolphins, rolling through the swell offshore.'); }
    }
    this.dolphinMesh.count = n; this.dolphinMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- a whale blows far out at sea
  updateWhale(dt, ctx) {
    const p = ctx.player.pos, W = this.gen().p.water;
    if (!this.whale) {
      this.nextWhale -= dt;
      if (this.nextWhale < 0) {
        this.nextWhale = this.rng.range(70, 160);
        const c = this.seaPoint(p, 160, 380, 10);
        if (c) this.whale = { c, dir: this.rng.range(0, 6.28), t: 0 };
      }
      this.spout.visible = this.whaleBack.visible = this.whaleTail.visible = false;
      return;
    }
    const w = this.whale; w.t += dt;
    const T = w.t, fx = Math.sin(w.dir), fz = Math.cos(w.dir);
    // 0–4 s blow · 2–9 s back rolls through · 9–13 s flukes rise and slip under
    const sp = this.spout.geometry.attributes.position.array, N = sp.length / 3;
    this.spout.visible = T < 6;
    if (this.spout.visible) {
      for (let i = 0; i < N; i++) {
        const age = T - (i / N) * 1.4; if (age < 0) { sp[i * 3 + 1] = -999; continue; }
        const h = Math.min(9, age * 14) - Math.max(0, age - 1.2) * 1.5, spread = 0.3 + age * 1.6;
        sp[i * 3] = w.c.x + Math.sin(i * 12.9) * spread + age * 1.5; sp[i * 3 + 1] = W + 1 + h * (0.8 + 0.2 * Math.sin(i * 7.7)); sp[i * 3 + 2] = w.c.z + Math.cos(i * 4.3) * spread;
      }
      this.spout.geometry.attributes.position.needsUpdate = true;
      this.spout.material.opacity = 0.6 * Math.max(0, 1 - T / 6);
    }
    const roll = smoothstep(1.5, 4, T) * (1 - smoothstep(8, 10, T));
    this.whaleBack.visible = roll > 0.01;
    if (this.whaleBack.visible) { this.whaleBack.position.set(w.c.x + fx * (T - 5) * 2, W - 1.6 + roll * 1.2, w.c.z + fz * (T - 5) * 2); this.whaleBack.rotation.set(0, w.dir, 0); this.whaleBack.rotateX(0.25 * Math.sin((T - 2) * 0.5)); }
    const tail = smoothstep(9, 10.5, T) * (1 - smoothstep(12, 14, T));
    this.whaleTail.visible = tail > 0.01;
    if (this.whaleTail.visible) { this.whaleTail.position.set(w.c.x + fx * 10, W - 3.5 + tail * 4.5, w.c.z + fz * 10); this.whaleTail.rotation.set(0, w.dir + Math.PI / 2, 0); }
    if (T > 0.5 && !w.heard) { w.heard = true; this.game.audio?.call?.('whale', w.c); if (!this.whaleSeen && w.c.distanceTo(p) < 420) { this.whaleSeen = true; this.game.ui.toast('<b>A blow, far out at sea</b> — a tall, straight spout. A blue whale.', true); this.game.onAnimalSeen?.('blue_whale'); } }
    if (T > 15) this.whale = null;
  }

  // what large animal is the player looking at (for "observe")
  observable(p, look, cam) {
    let best = null, bd = 1e9;
    const consider = (pos, kind, ref, dmin, dmax, yo = 1) => {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz); if (d > dmax || d < dmin || d > bd) return;
      const dir = V3(dx, pos.y + yo - cam.y, dz).normalize(); if (look.dot(dir) < (d < 8 ? 0.9 : 0.96)) return;
      bd = d; best = { kind, ref, dist: d };
    };
    for (const d of this.deer) if (d.state !== 'flee') consider(d.pos, this.spec.deer, d, 0, 80);
    if (this.bear && this.bear.state !== 'charge' && this.bear.state !== 'attack') consider(this.bear.pos, this.spec.bear, this.bear, 18, 90);
    for (const s of this.snakes) if (s.state !== 'flee') consider(s.pos, s.id, s, 1.8, 14, 0.05);
    for (const s of this.seals) if (s.state === 'rest') consider(s.pos, 'harbour_seal', s, 15, 120, 0.3);
    return best;
  }
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const k = c.getContext('2d');
  const g = k.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  k.fillStyle = g; k.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}
