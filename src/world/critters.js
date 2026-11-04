// Ambient life around the player: songbirds that flush as you approach, ducks on still water,
// hares in open country, squirrels in the woods, butterflies over meadows, dragonflies over water,
// bees, falling leaves, drifting seeds and pollen, midges at dusk, fish rising.
// Everything is spawned near the player, behaves simply but believably, and is recycled.
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { buildFish } from './fishModel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();

function colorGeo(g, c) { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function merged(list) { return BGU.mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; })); }
const ANIMAL_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// ---------------------------------------------------------------- small bird models (body + wings)
const BIRDS = {
  robin: { body: '#7a6248', breast: '#d8682a', head: '#7a6248', face: '#d8682a', beak: '#2a2420', size: 1, call: 'robin' },
  blackbird: { body: '#18181a', breast: '#202022', head: '#18181a', beak: '#e0a020', size: 1.35, call: 'blackbird' },
  chaffinch: { body: '#8a6a52', breast: '#c88a7a', head: '#6a7a90', beak: '#9a9aa0', size: 1, bars: true, call: 'chaffinch' },
  great_tit: { body: '#6a7a40', breast: '#e8d040', head: '#141414', cheek: '#f4f4f0', beak: '#202020', size: 1.05, call: 'tit' },
};
function birdBody(sp) {
  const s = sp.size * 0.075;
  const body = colorGeo(new THREE.SphereGeometry(s, 10, 8).scale(0.8, 0.8, 1.3), sp.body);
  const breast = colorGeo(new THREE.SphereGeometry(s * 0.82, 10, 8).scale(0.78, 0.8, 1.0).translate(0, -s * 0.12, s * 0.35), sp.breast);
  const head = colorGeo(new THREE.SphereGeometry(s * 0.58, 10, 8).translate(0, s * 0.62, s * 0.95), sp.head);
  const parts = [body, breast, head];
  if (sp.face) parts.push(colorGeo(new THREE.SphereGeometry(s * 0.5, 10, 8).scale(0.95, 0.9, 0.6).translate(0, s * 0.5, s * 1.18), sp.face));
  if (sp.cheek) for (const k of [-1, 1]) parts.push(colorGeo(new THREE.SphereGeometry(s * 0.25, 6, 5).translate(k * s * 0.42, s * 0.6, s * 1.05), sp.cheek));
  parts.push(colorGeo(new THREE.ConeGeometry(s * 0.14, s * 0.5, 5).rotateX(Math.PI / 2).translate(0, s * 0.55, s * 1.55), sp.beak));
  parts.push(colorGeo(new THREE.BoxGeometry(s * 0.5, s * 0.08, s * 1.2).translate(0, s * 0.15, -s * 1.5).rotateX(-0.25), sp.body));
  for (const k of [-1, 1]) parts.push(colorGeo(new THREE.SphereGeometry(s * 0.1, 5, 4).translate(k * s * 0.4, s * 0.78, s * 1.25), '#050505'));
  for (const k of [-1, 1]) parts.push(colorGeo(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.7, 4).translate(k * s * 0.25, -s * 0.95, 0), '#6a5040'));
  return merged(parts);
}
function birdWings(sp) {
  const s = sp.size * 0.075;
  const wing = (k) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, s * 0.6, k * s * 2.4, 0, -s * 0.1, 0, 0, -s * 0.9, k * s * 2.4, 0, -s * 0.1, k * s * 1.6, 0, -s * 0.9, 0, 0, -s * 0.9], 3)); g.computeVertexNormals(); return colorGeo(g, sp.body); };
  const parts = [wing(1), wing(-1)];
  if (sp.bars) for (const k of [-1, 1]) parts.push(colorGeo(new THREE.PlaneGeometry(s * 1.4, s * 0.15).rotateX(-Math.PI / 2).translate(k * s * 1.1, 0.002, -s * 0.3), '#f0f0e8'));
  return merged(parts);
}

// ---------------------------------------------------------------- mammals
function hareGeo() {
  const c = '#8a6a48', d = '#6e543a', b = '#d8c8a8';
  const p = [];
  p.push(colorGeo(new THREE.SphereGeometry(0.16, 12, 9).scale(0.8, 0.85, 1.35).translate(0, 0.2, -0.04), c));
  p.push(colorGeo(new THREE.SphereGeometry(0.13, 10, 8).scale(0.85, 0.8, 1.1).translate(0, 0.16, -0.2), d)); // haunches
  p.push(colorGeo(new THREE.SphereGeometry(0.075, 10, 8).scale(0.85, 0.9, 1.25).translate(0, 0.34, 0.2), c));
  for (const k of [-1, 1]) {
    p.push(colorGeo(new THREE.CapsuleGeometry(0.02, 0.15, 3, 6).rotateX(-0.35).rotateZ(k * 0.18).translate(k * 0.03, 0.47, 0.15), c));
    p.push(colorGeo(new THREE.SphereGeometry(0.019, 6, 5).translate(k * 0.048, 0.555, 0.11), '#141414')); // black ear tips
    p.push(colorGeo(new THREE.SphereGeometry(0.013, 6, 5).translate(k * 0.05, 0.36, 0.27), '#2a1a0a'));
    p.push(colorGeo(new THREE.CapsuleGeometry(0.018, 0.07, 3, 6).translate(k * 0.06, 0.055, 0.14), c));
    p.push(colorGeo(new THREE.CapsuleGeometry(0.03, 0.17, 3, 6).rotateX(Math.PI / 2).translate(k * 0.08, 0.035, -0.18), d));
  }
  p.push(colorGeo(new THREE.SphereGeometry(0.035, 6, 5).translate(0, 0.24, -0.33), b));
  p.push(colorGeo(new THREE.SphereGeometry(0.1, 8, 6).scale(0.9, 0.7, 1.2).translate(0, 0.12, 0.02), b));
  return merged(p);
}
function squirrelGeo() {
  const c = '#a84a22', b = '#f0e0c8';
  const p = [];
  p.push(colorGeo(new THREE.SphereGeometry(0.06, 10, 8).scale(0.8, 0.9, 1.4).translate(0, 0.08, 0), c));
  p.push(colorGeo(new THREE.SphereGeometry(0.045, 10, 8).scale(0.6, 0.7, 1).translate(0, 0.07, 0.03), b));
  p.push(colorGeo(new THREE.SphereGeometry(0.038, 10, 8).translate(0, 0.14, 0.08), c));
  for (const k of [-1, 1]) { p.push(colorGeo(new THREE.ConeGeometry(0.012, 0.04, 5).translate(k * 0.02, 0.185, 0.07), c)); p.push(colorGeo(new THREE.SphereGeometry(0.008, 5, 4).translate(k * 0.025, 0.15, 0.105), '#0a0a0a')); }
  // the great bushy tail, curved up over the back
  for (let i = 0; i < 7; i++) { const t = i / 6; p.push(colorGeo(new THREE.SphereGeometry(0.04 + Math.sin(t * Math.PI) * 0.018, 8, 6).translate(0, 0.06 + Math.sin(t * 2.4) * 0.16, -0.08 - Math.sin(t * 1.4) * 0.06 + t * 0.02), c)); }
  return merged(p);
}
function duckGeo(drake) {
  const body = drake ? '#a8a8a0' : '#8a6a48', head = drake ? '#1c5a2c' : '#7a5a3a';
  const p = [];
  p.push(colorGeo(new THREE.SphereGeometry(0.14, 12, 9).scale(0.85, 0.6, 1.5).translate(0, 0.04, 0), body));
  p.push(colorGeo(new THREE.SphereGeometry(0.12, 10, 8).scale(0.7, 0.4, 0.6).translate(0, 0.05, 0.12), drake ? '#6a3a2a' : body));
  p.push(colorGeo(new THREE.SphereGeometry(0.065, 10, 8).translate(0, 0.17, 0.18), head));
  if (drake) p.push(colorGeo(new THREE.TorusGeometry(0.052, 0.008, 4, 12).rotateX(Math.PI / 2).translate(0, 0.12, 0.17), '#f4f4f0'));
  p.push(colorGeo(new THREE.BoxGeometry(0.04, 0.015, 0.08).translate(0, 0.16, 0.27), drake ? '#d8c840' : '#b8803a'));
  p.push(colorGeo(new THREE.ConeGeometry(0.05, 0.12, 6).rotateX(-Math.PI / 2.4).translate(0, 0.08, -0.22), drake ? '#1a1a1a' : body));
  for (const k of [-1, 1]) p.push(colorGeo(new THREE.SphereGeometry(0.01, 5, 4).translate(k * 0.045, 0.19, 0.22), '#050505'));
  return merged(p);
}

// ---------------------------------------------------------------- insect & leaf textures
function insectAtlas() {
  const S = 128, n = 7, c = document.createElement('canvas'); c.width = S * n; c.height = S; const g = c.getContext('2d');
  const wing = (ox, fill, extra) => { g.save(); g.translate(ox, 0); g.fillStyle = fill; g.beginPath(); g.moveTo(64, 64); g.bezierCurveTo(70, 4, 124, 0, 120, 52); g.bezierCurveTo(124, 70, 100, 124, 64, 70); g.closePath(); g.fill(); extra && extra(g); g.restore(); };
  // 0 peacock: rust red with blue-black eye spots
  wing(0, '#a8261c', (g) => { g.fillStyle = '#2a1a1a'; g.beginPath(); g.arc(100, 36, 15, 0, 7); g.fill(); g.fillStyle = '#3a62b0'; g.beginPath(); g.arc(100, 36, 9, 0, 7); g.fill(); g.fillStyle = '#e8d070'; g.beginPath(); g.arc(98, 34, 3, 0, 7); g.fill(); });
  // 1 brimstone: leaf-shaped sulphur yellow
  wing(S, '#e8dc5a', (g) => { g.fillStyle = '#d07a2a'; g.beginPath(); g.arc(92, 50, 3, 0, 7); g.fill(); });
  // 2 red admiral: black with red band, white spots
  wing(S * 2, '#1a1414', (g) => { g.strokeStyle = '#d8401c'; g.lineWidth = 9; g.beginPath(); g.moveTo(70, 70); g.quadraticCurveTo(100, 50, 114, 26); g.stroke(); g.fillStyle = '#f0f0f0'; for (const [x, y] of [[106, 14], [114, 20], [96, 18]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); } });
  // 3 small tortoiseshell: orange with black/yellow patches
  wing(S * 3, '#e0701c', (g) => { g.fillStyle = '#1a1a1a'; for (const [x, y, r] of [[88, 30, 7], [104, 24, 6], [80, 52, 5]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.fillStyle = '#e8d070'; g.beginPath(); g.arc(112, 34, 4, 0, 7); g.fill(); g.strokeStyle = '#2a4aa0'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 92); g.quadraticCurveTo(110, 80, 118, 52); g.stroke(); });
  // 4 common blue
  wing(S * 4, '#5a7ae0', (g) => { g.strokeStyle = '#f4f4f4'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 70); g.bezierCurveTo(100, 124, 124, 70, 120, 52); g.stroke(); });
  // 5 dragonfly: clear veined wing
  g.save(); g.translate(S * 5, 0); g.fillStyle = 'rgba(210,230,240,0.45)'; g.beginPath(); g.ellipse(96, 64, 32, 9, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,50,60,0.6)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(66 + i * 7, 56); g.lineTo(66 + i * 7, 72); g.stroke(); } g.restore();
  // 6 bee: small translucent wing
  g.save(); g.translate(S * 6, 0); g.fillStyle = 'rgba(230,230,220,0.6)'; g.beginPath(); g.ellipse(88, 56, 24, 12, -0.4, 0, 7); g.fill(); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, n };
}
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(58, 18, 52, 50, 32, 62); g.bezierCurveTo(12, 50, 6, 18, 32, 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 62); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- the ambience manager
export class Ambience {
  constructor(game, world) {
    this.game = game; this.world = world; this.scene = game.scene;
    this.group = new THREE.Group(); this.group.name = 'ambience'; this.scene.add(this.group);
    this.birds = []; this.ducks = []; this.hares = []; this.squirrels = []; this.rises = [];
    this.autumn = world.autumn || 0;
    this.t = 0;
    const mat = ANIMAL_MAT();
    this.birdKinds = Object.entries(BIRDS).map(([id, sp]) => ({ id, sp, body: birdBody(sp), wings: birdWings(sp), mat }));
    this.hareGeo = hareGeo(); this.squirrelGeo = squirrelGeo(); this.duckGeos = [duckGeo(true), duckGeo(false)]; this.animalMat = mat;
    this.buildInsects(); this.buildLeaves(); this.buildMotes(); this.buildRises();
  }

  dispose() { this.scene.remove(this.group); }

  // ---------------------------------------------------------------- helpers
  ground(x, z) { return this.world.heightAt(x, z); }
  depth(x, z) { return this.world.depthAt(x, z); }
  rndAround(p, r0, r1) { const a = Math.random() * 6.283, d = rand(r0, r1); return [p.x + Math.cos(a) * d, p.z + Math.sin(a) * d]; }
  near(list, p, r) { return list.some((o) => o.pos.distanceTo(p) < r); }
  risesNear(p, r) { const now = this.t; return this.rises.some((rr) => now - rr.t0 < 6 && Math.hypot(rr.x - p.x, rr.z - p.z) < r); }

  // ---------------------------------------------------------------- songbirds on the ground
  spawnBird(p) {
    for (let k = 0; k < 6; k++) {
      const [x, z] = this.rndAround(p, 10, 32); if (this.depth(x, z) > -0.3) continue;
      const s = this.world.gen.sample(x, z); if (s.forest > 0.85) continue;
      const kind = this.birdKinds[Math.floor(Math.random() * this.birdKinds.length)];
      if (kind.id === 'blackbird' && s.forest < 0.2 && Math.random() < 0.6) continue;
      const g = new THREE.Group(); const body = new THREE.Mesh(kind.body, kind.mat); const wings = new THREE.Mesh(kind.wings, kind.mat);
      wings.position.set(0, kind.sp.size * 0.075 * 0.4, 0); wings.scale.set(0.35, 1, 1); g.add(body, wings);
      body.castShadow = true;
      const y = this.ground(x, z) + kind.sp.size * 0.075 * 1.0;
      g.position.set(x, y, z); g.rotation.y = Math.random() * 6.28; this.group.add(g);
      this.birds.push({ g, body, wings, kind, pos: g.position, state: 'ground', t: rand(0.3, 1.5), vy: 0, vel: V(0, 0, 0), hop: 0 });
      return;
    }
  }
  updateBirds(dt, p, running, day) {
    if (day > 0.25 && this.birds.length < (this.game.quality.ambient ?? 1) * 7 && Math.random() < dt * 0.8) this.spawnBird(p);
    for (const b of [...this.birds]) {
      const d = b.pos.distanceTo(p);
      if (b.state === 'ground') {
        if (d < (running ? 10 : 5.5)) { // flush!
          b.state = 'fly'; b.t = 4;
          const away = Math.atan2(b.pos.z - p.z, b.pos.x - p.x) + rand(-0.6, 0.6);
          b.vel.set(Math.cos(away) * rand(5, 8), rand(3, 4.5), Math.sin(away) * rand(5, 8));
          b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z); b.wings.scale.x = 1;
          this.game.audio.flush?.(b.pos); if (Math.random() < 0.6) this.game.audio.alarm?.(b.kind.sp.call, b.pos);
          continue;
        }
        b.t -= dt;
        if (b.t < 0) { // hop or peck
          if (Math.random() < 0.55) { b.hop = 0.22; b.g.rotation.y += rand(-1.2, 1.2); }
          else b.peck = 0.35;
          b.t = rand(0.3, 1.4);
          if (Math.random() < 0.08) this.game.audio.song?.(b.kind.sp.call, b.pos);
        }
        if (b.hop > 0) { b.hop -= dt; const k = 1 - b.hop / 0.22; const fx = Math.sin(b.g.rotation.y) * dt * 0.7, fz = Math.cos(b.g.rotation.y) * dt * 0.7; b.pos.x += fx; b.pos.z += fz; b.pos.y = this.ground(b.pos.x, b.pos.z) + b.kind.sp.size * 0.075 + Math.sin(k * Math.PI) * 0.06; }
        b.body.rotation.x = b.peck > 0 ? Math.sin((b.peck -= dt) / 0.35 * Math.PI) * 0.6 : 0;
        if (d > 70) { this.group.remove(b.g); this.birds.splice(this.birds.indexOf(b), 1); }
      } else {
        b.t -= dt; b.vel.y -= dt * 0.8;
        b.pos.addScaledVector(b.vel, dt);
        // wingbeat: fold and spread the wings, with a slight up-and-down stroke
        const f = Math.sin(this.t * 38 + b.kind.id.length);
        b.wings.scale.set(0.45 + 0.55 * Math.abs(f), 1, 1); b.wings.position.y = 0.01 + f * 0.012; b.wings.rotation.x = f * 0.15;
        b.g.rotation.x = -0.3;
        if (b.t < 0) { this.group.remove(b.g); this.birds.splice(this.birds.indexOf(b), 1); }
      }
    }
  }

  // ---------------------------------------------------------------- ducks on still water
  updateDucks(dt, p) {
    if (this.ducks.length < 4 && Math.random() < dt * 0.3) {
      for (let k = 0; k < 8; k++) {
        const [x, z] = this.rndAround(p, 14, 45); if (this.depth(x, z) < 0.8) continue;
        const s = this.world.gen.sample(x, z); if (s.river > 0.3) continue;
        const n = Math.random() < 0.6 ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(this.duckGeos[i === 0 ? 0 : 1], this.animalMat); m.castShadow = true;
          m.position.set(x + i * 0.5, this.world.gen.p.water - 0.03, z + i * 0.3); m.rotation.y = Math.random() * 6; this.group.add(m);
          this.ducks.push({ m, pos: m.position, heading: m.rotation.y, speed: 0.25, flee: 0, t: rand(2, 6), dip: 0, leader: i === 0 });
        }
        break;
      }
    }
    for (const d of [...this.ducks]) {
      const dist = d.pos.distanceTo(p);
      if (dist < 9 && d.flee <= 0) { d.flee = 5; d.heading = Math.atan2(d.pos.x - p.x, d.pos.z - p.z); this.game.audio.quack?.(d.pos, true); }
      d.t -= dt; if (d.t < 0) { d.t = rand(3, 8); d.heading += rand(-1, 1); if (Math.random() < 0.3) d.dip = 1.5; if (Math.random() < 0.25) this.game.audio.quack?.(d.pos); }
      d.flee -= dt;
      const sp = d.flee > 0 ? 1.4 : d.speed;
      const nx = d.pos.x + Math.sin(d.heading) * sp * dt, nz = d.pos.z + Math.cos(d.heading) * sp * dt;
      if (this.depth(nx, nz) > 0.5) { d.pos.x = nx; d.pos.z = nz; } else d.heading += 1.5 * dt * 3;
      let dh = d.heading - d.m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); d.m.rotation.y += dh * Math.min(1, dt * 3);
      d.dip = Math.max(0, d.dip - dt); d.m.rotation.x = d.dip > 0 ? Math.sin(d.dip / 1.5 * Math.PI) * 1.3 : Math.sin(this.t * 1.3 + d.pos.x) * 0.03;
      d.pos.y = this.world.gen.p.water - 0.03 + Math.sin(this.t * 1.7 + d.pos.z) * 0.008;
      if (dist > 110) { this.group.remove(d.m); this.ducks.splice(this.ducks.indexOf(d), 1); }
    }
  }

  // ---------------------------------------------------------------- hares in open country, squirrels in woods
  updateMammals(dt, p, running, day) {
    const gen = this.world.gen;
    if (this.hares.length < 2 && Math.random() < dt * 0.15) {
      for (let k = 0; k < 6; k++) {
        const [x, z] = this.rndAround(p, 25, 55); const s = gen.sample(x, z);
        if (s.h - gen.p.water < 0.8 || s.forest > 0.35) continue;
        const m = new THREE.Mesh(this.hareGeo, this.animalMat); m.castShadow = true; m.position.set(x, s.h, z); m.rotation.y = Math.random() * 6; this.group.add(m);
        this.hares.push({ m, pos: m.position, state: 'graze', t: rand(2, 6), heading: m.rotation.y, speed: 0, phase: 0, seen: false });
        break;
      }
    }
    for (const h of [...this.hares]) {
      const d = h.pos.distanceTo(p);
      if (h.state !== 'flee' && (d < 13 || (running && d < 22))) { h.state = 'flee'; h.t = 6; h.heading = Math.atan2(h.pos.x - p.x, h.pos.z - p.z); this.game.audio.rustle?.(h.pos); this.game.onAnimalSeen?.('hare'); }
      h.t -= dt;
      if (h.state === 'graze' || h.state === 'sit') { if (h.t < 0) { h.state = Math.random() < 0.5 ? 'hop' : (h.state === 'graze' ? 'sit' : 'graze'); h.t = h.state === 'hop' ? rand(0.8, 2) : rand(2, 6); h.heading += rand(-1.5, 1.5); } }
      else if (h.state === 'hop' && h.t < 0) { h.state = 'graze'; h.t = rand(2, 6); }
      else if (h.state === 'flee') { if (Math.random() < dt * 1.2) h.heading += rand(-0.8, 0.8); if (h.t < 0 && d > 45) { this.group.remove(h.m); this.hares.splice(this.hares.indexOf(h), 1); continue; } }
      const sp = h.state === 'flee' ? 11 : h.state === 'hop' ? 1.6 : 0;
      if (sp) {
        h.phase += dt * (h.state === 'flee' ? 9 : 5);
        const nx = h.pos.x + Math.sin(h.heading) * sp * dt, nz = h.pos.z + Math.cos(h.heading) * sp * dt;
        if (gen.height(nx, nz) - gen.p.water > 0.3) { h.pos.x = nx; h.pos.z = nz; } else h.heading += Math.PI * 0.6;
      }
      let dh = h.heading - h.m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); h.m.rotation.y += dh * Math.min(1, dt * 8);
      const bound = sp ? Math.abs(Math.sin(h.phase)) : 0;
      h.pos.y = gen.height(h.pos.x, h.pos.z) + bound * (sp > 5 ? 0.25 : 0.08);
      h.m.rotation.x = sp ? Math.cos(h.phase) * 0.25 : h.state === 'graze' ? 0.35 : -0.25;
      h.m.scale.set(1, h.state === 'sit' ? 1.1 : 1, sp ? 1 + bound * 0.15 : 1);
    }
    // squirrels
    if (this.squirrels.length < 2 && day > 0.3 && Math.random() < dt * 0.2) {
      for (let k = 0; k < 6; k++) {
        const [x, z] = this.rndAround(p, 12, 30); const s = gen.sample(x, z); if (s.forest < 0.45 || s.h - gen.p.water < 0.8) continue;
        const m = new THREE.Mesh(this.squirrelGeo, this.animalMat); m.position.set(x, s.h, z); this.group.add(m);
        this.squirrels.push({ m, pos: m.position, state: 'forage', t: rand(1, 3), heading: Math.random() * 6, phase: 0 });
        break;
      }
    }
    for (const q of [...this.squirrels]) {
      const d = q.pos.distanceTo(p);
      if (q.state !== 'flee' && d < 8) { q.state = 'flee'; q.t = 4; q.heading = Math.atan2(q.pos.x - p.x, q.pos.z - p.z); this.game.audio.chatter?.(q.pos); this.game.onAnimalSeen?.('squirrel'); }
      q.t -= dt;
      if (q.t < 0) { if (q.state === 'flee') { this.group.remove(q.m); this.squirrels.splice(this.squirrels.indexOf(q), 1); continue; } q.state = q.state === 'run' ? 'forage' : 'run'; q.t = q.state === 'run' ? rand(0.4, 1.2) : rand(1, 3); q.heading += rand(-2, 2); if (Math.random() < 0.15) this.game.audio.chatter?.(q.pos); }
      const sp = q.state === 'flee' ? 6 : q.state === 'run' ? 2.5 : 0;
      if (sp) { q.phase += dt * 14; q.pos.x += Math.sin(q.heading) * sp * dt; q.pos.z += Math.cos(q.heading) * sp * dt; }
      q.m.rotation.y = q.heading; q.pos.y = gen.height(q.pos.x, q.pos.z) + (sp ? Math.abs(Math.sin(q.phase)) * 0.06 : 0);
      q.m.rotation.x = q.state === 'forage' ? -0.5 + Math.sin(this.t * 6) * 0.05 : 0;
      if (d > 60) { this.group.remove(q.m); this.squirrels.splice(this.squirrels.indexOf(q), 1); }
    }
  }

  // ---------------------------------------------------------------- insects (instanced, flapping in the shader)
  buildInsects() {
    const { tex, n } = insectAtlas();
    this.insectTypes = n;
    const pos = [], uv = [], side = [], idx = [];
    for (const s of [-1, 1]) { const b = pos.length / 3; pos.push(0, 0, 0.5, s, 0, 0.5, s, 0, -0.5, 0, 0, -0.5); uv.push(0.5, 1, s > 0 ? 1 : 0, 1, s > 0 ? 1 : 0, 0, 0.5, 0); side.push(s, s, s, s); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    // body: thin quad along z
    { const b = pos.length / 3; pos.push(-0.05, 0.001, 0.55, 0.05, 0.001, 0.55, 0.05, 0.001, -0.6, -0.05, 0.001, -0.6); uv.push(0.5, 0.52, 0.5, 0.52, 0.5, 0.48, 0.5, 0.48); side.push(0, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setIndex(idx);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const N = 48;
    this.insectAttr = { phase: new THREE.InstancedBufferAttribute(new Float32Array(N), 1), type: new THREE.InstancedBufferAttribute(new Float32Array(N), 1), rate: new THREE.InstancedBufferAttribute(new Float32Array(N), 1) };
    g.setAttribute('aPhase', this.insectAttr.phase); g.setAttribute('aType', this.insectAttr.type); g.setAttribute('aRate', this.insectAttr.rate);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.7, transparent: false });
    const uTime = { value: 0 }; this.insectTime = uTime;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float aSide, aPhase, aType, aRate; uniform float uTime;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x = (vMapUv.x + aType) / ${n}.0;\n#endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat flap = aSide == 0.0 ? 0.0 : (0.15 + 0.95 * abs(sin(uTime * aRate + aPhase)));\nfloat ax = abs(transformed.x);\ntransformed.y += ax * sin(flap);\ntransformed.x = sign(transformed.x) * ax * cos(flap);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/gl_FrontFacing \? 1\.0 : - 1\.0/g, '1.0'));
    };
    mat.customProgramCacheKey = () => 'insects';
    this.insectMesh = new THREE.InstancedMesh(g, mat, N); this.insectMesh.count = 0; this.insectMesh.frustumCulled = false;
    this.group.add(this.insectMesh);
    this.insects = [];
  }
  updateInsects(dt, p, day, weather, night) {
    const gen = this.world.gen, water = gen.p.water;
    const warm = day > 0.45 && weather !== 'rain' && weather !== 'mist';
    const want = warm ? 26 : 0;
    // spawn: butterflies over open ground & flowers, bees on flowers, dragonflies over water
    let guard = 0;
    while (this.insects.length < want && guard++ < 4) {
      const [x, z] = this.rndAround(p, 3, 26); const s = gen.sample(x, z); const dep = water - s.h;
      let type;
      if (dep > 0.2 && dep < 3) type = 5; // dragonfly
      else if (dep > -0.2) continue;
      else if (s.forest > 0.6) { if (Math.random() < 0.7) continue; type = 1; }
      else type = Math.random() < 0.3 ? 6 : [0, 1, 2, 3, 4][Math.floor(Math.random() * 5)];
      const base = Math.max(s.h, water);
      this.insects.push({ type, x, z, y: base + rand(0.4, 1.4), home: V(x, base, z), vx: 0, vz: 0, vy: 0, t: 0, phase: Math.random() * 6, land: 0, life: rand(20, 60) });
    }
    if (!warm) for (const i of this.insects) i.life = Math.min(i.life, 2);
    let n = 0; const mesh = this.insectMesh;
    for (const it of [...this.insects]) {
      it.life -= dt; it.t -= dt;
      const dPlayer = Math.hypot(it.x - p.x, it.z - p.z);
      if (it.life < 0 || dPlayer > 40) { this.insects.splice(this.insects.indexOf(it), 1); continue; }
      const dragon = it.type === 5, bee = it.type === 6;
      if (it.t < 0) {
        it.t = dragon ? rand(0.3, 1.2) : bee ? rand(0.2, 0.6) : rand(0.4, 1.5);
        const sp = dragon ? rand(2, 6) : bee ? 1.5 : rand(0.6, 1.6);
        const a = Math.atan2(it.home.z - it.z, it.home.x - it.x) * (Math.hypot(it.home.x - it.x, it.home.z - it.z) > 5 ? 1 : 0) + rand(-1.6, 1.6);
        it.vx = Math.cos(a) * sp; it.vz = Math.sin(a) * sp; it.vy = rand(-0.4, 0.4);
        if (dragon && Math.random() < 0.4) { it.vx = it.vz = 0; } // hover
        if (!dragon && !bee && Math.random() < 0.12) it.land = rand(2, 5);
      }
      if (it.land > 0) { it.land -= dt; it.y += ((gen.height(it.x, it.z) + 0.25) - it.y) * Math.min(1, dt * 3); }
      else {
        it.x += it.vx * dt; it.z += it.vz * dt; it.y += it.vy * dt + Math.sin(this.t * (dragon ? 3 : 6) + it.phase) * dt * (dragon ? 0.2 : 0.6);
        const floor = Math.max(gen.height(it.x, it.z), water) + (dragon ? 0.4 : 0.3); if (it.y < floor) it.y = floor + 0.05; if (it.y > floor + 2.2) it.y -= dt;
      }
      if (n >= mesh.count + 0 && n >= 48) break;
      const size = dragon ? 0.045 : bee ? 0.012 : 0.03;
      tmpE.set(it.land > 0 ? 0 : 0.2, Math.atan2(it.vx, it.vz), 0); tmpQ.setFromEuler(tmpE);
      tmpS.set(size, size, size * (dragon ? 1.6 : 1));
      tmpM.compose(tmpP.set(it.x, it.y, it.z), tmpQ, tmpS); mesh.setMatrixAt(n, tmpM);
      this.insectAttr.phase.array[n] = it.phase; this.insectAttr.type.array[n] = it.type;
      this.insectAttr.rate.array[n] = it.land > 0 ? 1.2 : dragon ? 60 : bee ? 70 : 13;
      n++;
      if (bee && dPlayer < 3) this.beeNear = true;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
    for (const a of Object.values(this.insectAttr)) a.needsUpdate = true;
    this.insectTime.value = this.t;
  }

  // ---------------------------------------------------------------- falling leaves
  buildLeaves() {
    const N = 70;
    const g = new THREE.PlaneGeometry(0.06, 0.07);
    const mat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    this.leafMesh = new THREE.InstancedMesh(g, mat, N); this.leafMesh.count = 0; this.leafMesh.frustumCulled = false;
    this.leafMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.group.add(this.leafMesh); this.leaves = [];
  }
  updateLeaves(dt, p, wind) {
    const gen = this.world.gen;
    const s0 = gen.sample(p.x, p.z);
    const rate = (s0.forest * 6 + 0.4) * (1 + this.autumn * 3) * (0.6 + wind * 0.6);
    if (this.leaves.length < 70 && Math.random() < dt * rate) {
      const [x, z] = this.rndAround(p, 0, 16); const s = gen.sample(x, z);
      if (s.forest > 0.25) {
        const c = new THREE.Color().setHSL(this.autumn > 0 && Math.random() < 0.3 + this.autumn * 0.6 ? rand(0.04, 0.12) : rand(0.18, 0.25), rand(0.5, 0.75), rand(0.25, 0.42));
        this.leaves.push({ x, y: s.h + rand(5, 11), z, rx: Math.random() * 6, ry: Math.random() * 6, spin: rand(1, 4), c, ground: 0, life: 12 });
      }
    }
    const m = this.leafMesh; let n = 0;
    const gx = Math.cos(0.6) * wind, gz = Math.sin(0.6) * wind;
    for (const L of [...this.leaves]) {
      const gy = gen.height(L.x, L.z) + 0.02;
      if (L.y > gy) { L.y -= dt * (0.6 + Math.sin(this.t * 2 + L.rx) * 0.3); L.x += (gx * 0.8 + Math.sin(this.t * 1.7 + L.ry) * 0.5) * dt; L.z += (gz * 0.8 + Math.cos(this.t * 1.3 + L.rx) * 0.5) * dt; L.rx += L.spin * dt; L.ry += L.spin * 0.7 * dt; }
      else { L.y = gy; L.ground += dt; L.rx = -Math.PI / 2; }
      if (L.ground > 6 || Math.hypot(L.x - p.x, L.z - p.z) > 30) { this.leaves.splice(this.leaves.indexOf(L), 1); continue; }
      tmpE.set(L.rx, L.ry, 0); tmpQ.setFromEuler(tmpE); const sc = L.ground > 5 ? 6 - L.ground : 1;
      tmpM.compose(tmpP.set(L.x, L.y, L.z), tmpQ, tmpS.set(sc, sc, sc)); m.setMatrixAt(n, tmpM); m.setColorAt(n, L.c); n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- pollen, seeds and midges
  buildMotes() {
    const N = 220, g = new THREE.BufferGeometry(); this.motePos = new Float32Array(N * 3); this.moteSeed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { this.moteSeed[i * 4] = Math.random() * 30 - 15; this.moteSeed[i * 4 + 1] = Math.random() * 4; this.moteSeed[i * 4 + 2] = Math.random() * 30 - 15; this.moteSeed[i * 4 + 3] = Math.random() * 6; }
    g.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dg = dot.getContext('2d'); const gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
    this.dotTex = new THREE.CanvasTexture(dot);
    this.moteMat = new THREE.PointsMaterial({ color: 0xfff6dc, size: 0.022, map: this.dotTex, transparent: true, opacity: 0.6, depthWrite: false });
    this.motes = new THREE.Points(g, this.moteMat); this.motes.frustumCulled = false; this.group.add(this.motes);
    const M = 90, mg = new THREE.BufferGeometry(); this.midgePos = new Float32Array(M * 3);
    mg.setAttribute('position', new THREE.BufferAttribute(this.midgePos, 3));
    this.midgeMat = new THREE.PointsMaterial({ color: 0x202018, size: 0.018, map: this.dotTex, transparent: true, opacity: 0.8, depthWrite: false });
    this.midges = new THREE.Points(mg, this.midgeMat); this.midges.frustumCulled = false; this.group.add(this.midges);
    this.midgeCentre = null;
  }
  updateMotes(dt, p, day, wind, golden, weather) {
    const a = this.motePos, s = this.moteSeed, n = a.length / 3, gen = this.world.gen;
    const vis = day > 0.3 && weather !== 'rain' ? 0.25 + golden * 0.5 : 0;
    this.moteMat.opacity = vis; this.motes.visible = vis > 0.02;
    if (this.motes.visible) {
      for (let i = 0; i < n; i++) {
        s[i * 4] += wind * 0.35 * dt; s[i * 4 + 2] += wind * 0.2 * dt; s[i * 4 + 1] += Math.sin(this.t * 0.5 + s[i * 4 + 3]) * dt * 0.08;
        if (s[i * 4] > 15) s[i * 4] -= 30; if (s[i * 4 + 2] > 15) s[i * 4 + 2] -= 30;
        let x = p.x + s[i * 4], z = p.z + s[i * 4 + 2]; const dd = Math.hypot(s[i * 4], s[i * 4 + 2]); if (dd < 2) { x += s[i * 4] / (dd + 0.01) * 2; z += s[i * 4 + 2] / (dd + 0.01) * 2; }
        a[i * 3] = x; a[i * 3 + 1] = p.y + 0.2 + s[i * 4 + 1] + Math.sin(this.t + s[i * 4 + 3]) * 0.2; a[i * 3 + 2] = z;
      }
      this.motes.geometry.attributes.position.needsUpdate = true;
    }
    // midges dance over water at dusk
    const dusk = this.game.sky.time > 17 && this.game.sky.time < 21.5 && weather !== 'rain';
    if (dusk && (!this.midgeCentre || this.midgeCentre.distanceTo(p) > 30)) {
      this.midgeCentre = null;
      for (let k = 0; k < 10; k++) { const [x, z] = this.rndAround(p, 4, 20); const d = this.world.depthAt(x, z); if (d > -0.5 && d < 1.5) { this.midgeCentre = V(x, Math.max(gen.height(x, z), gen.p.water) + 1.2, z); break; } }
    }
    this.midges.visible = dusk && !!this.midgeCentre;
    if (this.midges.visible) {
      const m = this.midgePos, c = this.midgeCentre;
      for (let i = 0; i < m.length / 3; i++) { m[i * 3] = c.x + Math.sin(this.t * 3.1 + i * 1.7) * 0.6 + Math.sin(this.t * 7 + i) * 0.1; m[i * 3 + 1] = c.y + Math.sin(this.t * 2.3 + i * 2.3) * 0.5; m[i * 3 + 2] = c.z + Math.cos(this.t * 2.7 + i * 1.3) * 0.6; }
      this.midges.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- fish rising: rings and jumps
  buildRises() {
    const N = 10;
    const g = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0.5, depthWrite: false });
    this.rings = Array.from({ length: N }, () => { const m = new THREE.Mesh(g, this.ringMat.clone()); m.visible = false; this.group.add(m); return { m, t: 99 }; });
    this.nextRise = 2; this.jumpers = [];
  }
  ring(x, z, size = 1) {
    const r = this.rings.find((q) => q.t > 1.6) || this.rings[0];
    r.t = 0; r.size = size; r.m.position.set(x, this.world.gen.p.water + 0.015, z); r.m.visible = true;
  }
  updateRises(dt, p, tod) {
    const water = this.world.gen.p.water;
    this.nextRise -= dt;
    const active = tod === 'dawn' || tod === 'dusk' ? 1.8 : 1;
    if (this.nextRise < 0) {
      this.nextRise = rand(1.5, 5) / active;
      for (let k = 0; k < 8; k++) {
        const [x, z] = this.rndAround(p, 5, 30); if (this.world.depthAt(x, z) < 0.9) continue;
        this.ring(x, z, rand(0.6, 1.2)); this.rises.push({ x, z, t0: this.t });
        this.game.audio.plopAt?.(V(x, water, z));
        if (Math.random() < 0.25) { // a fish leaps clear
          const f = buildFish(Math.random() < 0.5 ? 'roach' : 'trout'); f.scale.setScalar(rand(0.15, 0.3)); f.position.set(x, water, z); f.userData = { t: 0, dir: Math.random() * 6.28 }; this.group.add(f); this.jumpers.push(f);
        }
        break;
      }
    }
    this.rises = this.rises.filter((r) => this.t - r.t0 < 10);
    for (const r of this.rings) {
      if (r.t > 1.6) { r.m.visible = false; continue; }
      r.t += dt; const k = r.t / 1.6;
      r.m.scale.setScalar(0.05 + k * 0.9 * r.size); r.m.material.opacity = 0.5 * (1 - k);
    }
    for (const f of [...this.jumpers]) {
      f.userData.t += dt; const t = f.userData.t / 0.6;
      if (t > 1) { this.ring(f.position.x, f.position.z, 0.8); this.group.remove(f); this.jumpers.splice(this.jumpers.indexOf(f), 1); continue; }
      f.position.x += Math.cos(f.userData.dir) * dt * 1.2; f.position.z += Math.sin(f.userData.dir) * dt * 1.2;
      f.position.y = water + Math.sin(t * Math.PI) * 0.5; f.rotation.set(0, -f.userData.dir, Math.cos(t * Math.PI) * 0.9);
    }
  }

  update(dt, ctx) {
    this.t += dt;
    const p = ctx.player.pos, sky = this.game.sky;
    const tod = sky.time >= 4.5 && sky.time < 8 ? 'dawn' : sky.time < 17 ? 'day' : sky.time < 21 ? 'dusk' : 'night';
    this.beeNear = false;
    this.updateBirds(dt, p, ctx.player.running, sky.dayFactor);
    this.updateDucks(dt, p);
    this.updateMammals(dt, p, ctx.player.running, sky.dayFactor);
    this.updateInsects(dt, p, sky.dayFactor, sky.weatherName, ctx.night);
    this.updateLeaves(dt, p, sky.w.wind);
    this.updateMotes(dt, p, sky.dayFactor, sky.w.wind, sky.golden || 0, sky.weatherName);
    this.updateRises(dt, p, tod);
  }
}
