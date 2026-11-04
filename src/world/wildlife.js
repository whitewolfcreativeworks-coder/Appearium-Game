// Wildlife: red foxes (skinned glTF, Khronos sample "Fox"), bird flocks and fish schools.
// Behaviour is simple but legible: animals keep to suitable ground, wander, rest, and flee.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadModel } from '../core/assets.js';
import { RNG } from '../core/rng.js';

const tmp = new THREE.Vector3();

export class Wildlife {
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.foxes = []; this.flocks = []; this.rng = new RNG(world.gen.seed ^ 0xf0f0);
    this.targetFoxes = opts.foxes ?? 2;
    this.fishMesh = null; this.fish = [];
    this.group = new THREE.Group(); this.group.name = 'wildlife'; scene.add(this.group);
  }

  async init() {
    try {
      this.foxGltf = await loadModel('fox');
    } catch (e) { console.warn('fox model failed', e); }
    this.buildBirds();
    this.buildFish();
  }

  dispose() { this.scene.remove(this.group); for (const f of this.foxes) f.mixer.stopAllAction(); this.foxes = []; }

  habitatOk(x, z) {
    const g = this.world.gen, h = g.height(x, z);
    if (h - g.p.water < 0.6) return false;
    const slope = Math.hypot(g.height(x + 1, z) - h, g.height(x, z + 1) - h);
    return slope < 0.55 && h < g.p.treeLine + 10;
  }

  spawnFox(near) {
    if (!this.foxGltf) return;
    for (let tries = 0; tries < 20; tries++) {
      const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(45, 100);
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (!this.habitatOk(x, z)) continue;
      const obj = SkeletonUtils.clone(this.foxGltf.scene);
      obj.scale.setScalar(0.0068);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      const mixer = new THREE.AnimationMixer(obj);
      const clips = {}; for (const c of this.foxGltf.animations) clips[c.name.toLowerCase()] = mixer.clipAction(c);
      const fox = { obj, mixer, clips, state: 'idle', timer: this.rng.range(2, 6), target: new THREE.Vector3(x, 0, z), pos: new THREE.Vector3(x, 0, z), heading: this.rng.range(0, 6.28), speed: 0, action: null, observed: 0, id: Math.random() };
      this.play(fox, 'survey');
      this.group.add(obj);
      this.foxes.push(fox);
      return fox;
    }
  }

  play(fox, name) {
    const a = fox.clips[name]; if (!a || fox.action === a) return;
    a.reset().play();
    if (fox.action) fox.action.crossFadeTo(a, 0.35, false);
    fox.action = a;
  }

  buildBirds() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.8, side: THREE.DoubleSide });
    const body = new THREE.CylinderGeometry(0.06, 0.12, 0.6, 5).rotateX(Math.PI / 2);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0.95, 0.02, -0.05, 0, 0, -0.18, 0.95, 0.02, -0.05, 0.6, 0, -0.25, 0, 0, -0.18], 3));
    wing.computeVertexNormals();
    for (let f = 0; f < 3; f++) {
      const g = new THREE.Group();
      const birds = [];
      const n = 4 + Math.floor(this.rng.next() * 6);
      for (let i = 0; i < n; i++) {
        const b = new THREE.Group();
        b.add(new THREE.Mesh(body, mat));
        const l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat); r.scale.x = -1;
        b.add(l, r);
        b.userData = { l, r, off: new THREE.Vector3((i % 3 - 1) * 2.5 + this.rng.range(-1, 1), this.rng.range(-1, 1), -Math.floor(i / 2) * 2), ph: this.rng.range(0, 6) };
        g.add(b); birds.push(b);
      }
      this.group.add(g);
      this.flocks.push({ g, birds, c: new THREE.Vector3(), r: this.rng.range(60, 140), alt: this.rng.range(35, 70), sp: this.rng.range(0.06, 0.12) * (this.rng.chance(0.5) ? 1 : -1), a: this.rng.range(0, 6.28) });
    }
  }

  buildFish() {
    const g = new THREE.SphereGeometry(0.1, 7, 5).scale(0.45, 0.35, 1.6);
    const tail = new THREE.ConeGeometry(0.06, 0.14, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.2);
    const merged = new THREE.BufferGeometry().copy(g);
    const geo = mergeSimple([g, tail]);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f2e, roughness: 0.6, transparent: true, opacity: 0.85 });
    this.fishMesh = new THREE.InstancedMesh(geo, mat, 48); this.fishMesh.count = 0; this.fishMesh.frustumCulled = false;
    this.group.add(this.fishMesh);
    merged.dispose();
  }

  // pick a few schools in water near the player
  seedFish(p) {
    const g = this.world.gen; this.fish = [];
    for (let tries = 0; tries < 160 && this.fish.length < 40; tries++) {
      const a = this.rng.range(0, 6.28), d = this.rng.range(6, 45);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const depth = g.p.water - g.height(x, z);
      if (depth < 0.7) continue;
      const n = 3 + Math.floor(this.rng.next() * 5);
      for (let i = 0; i < n && this.fish.length < 40; i++) this.fish.push({ x: x + this.rng.range(-1, 1), z: z + this.rng.range(-1, 1), h: this.rng.range(0, 6.28), sp: 0.3, y: -this.rng.range(0.3, Math.min(1.0, depth - 0.2)), panic: 0, s: this.rng.range(0.7, 1.4) });
    }
    this.fishCenter = p.clone();
  }

  update(dt, player, ctx) {
    const p = player.pos;
    // foxes
    if (this.foxes.length < this.targetFoxes && Math.random() < dt * 0.5) this.spawnFox(p);
    for (const fox of [...this.foxes]) {
      const d = fox.pos.distanceTo(tmp.set(p.x, fox.pos.y, p.z));
      if (d > 190) { this.group.remove(fox.obj); this.foxes.splice(this.foxes.indexOf(fox), 1); continue; }
      const scared = d < 8 || (d < 18 && player.running) || (d < 13 && player.speed > 2.5);
      if (scared && fox.state !== 'flee') {
        fox.state = 'flee'; fox.timer = 6;
        const away = Math.atan2(fox.pos.z - p.z, fox.pos.x - p.x);
        fox.target.set(fox.pos.x + Math.cos(away) * 45, 0, fox.pos.z + Math.sin(away) * 45);
        ctx.onFoxFlee && ctx.onFoxFlee(fox);
      }
      fox.timer -= dt;
      if (fox.state === 'idle' && fox.timer < 0) {
        fox.state = 'walk'; fox.timer = 15;
        for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 20; const tx = fox.pos.x + Math.cos(a) * r, tz = fox.pos.z + Math.sin(a) * r; if (this.habitatOk(tx, tz)) { fox.target.set(tx, 0, tz); break; } }
      }
      const moving = fox.state === 'walk' || fox.state === 'flee';
      if (moving) {
        const dx = fox.target.x - fox.pos.x, dz = fox.target.z - fox.pos.z, dist = Math.hypot(dx, dz);
        const want = fox.state === 'flee' ? 6.5 : 1.2;
        fox.speed += (want - fox.speed) * Math.min(1, dt * 3);
        const th = Math.atan2(dx, dz);
        let dh = th - fox.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        fox.heading += dh * Math.min(1, dt * (fox.state === 'flee' ? 6 : 2.5));
        const nx = fox.pos.x + Math.sin(fox.heading) * fox.speed * dt, nz = fox.pos.z + Math.cos(fox.heading) * fox.speed * dt;
        if (this.habitatOk(nx, nz)) { fox.pos.x = nx; fox.pos.z = nz; } else { fox.target.set(fox.pos.x - dx, 0, fox.pos.z - dz); }
        if (dist < 1.5 || fox.timer < 0) { fox.state = 'idle'; fox.timer = 3 + Math.random() * 6; fox.speed = 0; }
        this.play(fox, fox.state === 'flee' ? 'run' : 'walk');
        if (fox.action) fox.action.timeScale = fox.state === 'flee' ? 1.1 : Math.max(0.4, fox.speed / 1.2);
      } else this.play(fox, 'survey');
      fox.pos.y = this.world.gen.height(fox.pos.x, fox.pos.z);
      fox.obj.position.copy(fox.pos);
      fox.obj.rotation.y = fox.heading;
      // align pitch to slope
      const ahead = this.world.gen.height(fox.pos.x + Math.sin(fox.heading) * 0.5, fox.pos.z + Math.cos(fox.heading) * 0.5);
      fox.obj.rotation.x = -Math.atan2(ahead - fox.pos.y, 0.5) * 0.8;
      fox.mixer.update(dt);
    }
    // birds
    const t = performance.now() * 0.001;
    for (const f of this.flocks) {
      f.visible = ctx.day > 0.15; f.g.visible = f.visible;
      if (!f.visible) continue;
      if (f.c.distanceTo(p) > 250) f.c.set(p.x + (Math.random() - 0.5) * 200, 0, p.z + (Math.random() - 0.5) * 200);
      f.a += f.sp * dt;
      const cx = f.c.x + Math.cos(f.a) * f.r, cz = f.c.z + Math.sin(f.a) * f.r;
      const cy = Math.max(this.world.gen.height(cx, cz), this.world.gen.p.water) + f.alt;
      f.g.position.set(cx, cy, cz);
      f.g.rotation.y = -f.a + (f.sp > 0 ? Math.PI : 0);
      for (const b of f.birds) {
        b.position.copy(b.userData.off);
        const flap = Math.sin(t * 7 + b.userData.ph);
        const glide = Math.sin(t * 0.5 + b.userData.ph) > 0.3 ? 0.15 : 1;
        b.userData.l.rotation.z = flap * 0.6 * glide; b.userData.r.rotation.z = -flap * 0.6 * glide;
      }
    }
    // fish
    if (!this.fishCenter || this.fishCenter.distanceTo(p) > 30) this.seedFish(p);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    const g = this.world.gen;
    let n = 0;
    for (const fi of this.fish) {
      const dp = Math.hypot(fi.x - p.x, fi.z - p.z);
      if (dp < 4.5) { fi.panic = 1.5; fi.h = Math.atan2(fi.x - p.x, fi.z - p.z); }
      fi.panic = Math.max(0, fi.panic - dt);
      fi.h += (Math.random() - 0.5) * dt * 2.5;
      const sp = fi.panic > 0 ? 3.2 : 0.35;
      const nx = fi.x + Math.sin(fi.h) * sp * dt, nz = fi.z + Math.cos(fi.h) * sp * dt;
      if (g.p.water - g.height(nx, nz) > 0.55) { fi.x = nx; fi.z = nz; } else fi.h += Math.PI * 0.7;
      e.set(0, fi.h + Math.sin(t * 8 + fi.s * 10) * 0.12, 0); q.setFromEuler(e);
      s.setScalar(fi.s);
      m.compose(tmp.set(fi.x, g.p.water + fi.y, fi.z), q, s);
      this.fishMesh.setMatrixAt(n++, m);
    }
    this.fishMesh.count = n; this.fishMesh.instanceMatrix.needsUpdate = true;
  }

  nearestFox(p, maxD = 24) {
    let best = null, bd = maxD;
    for (const f of this.foxes) { const d = f.pos.distanceTo(p); if (d < bd && f.state !== 'flee') { bd = d; best = f; } }
    return best ? { fox: best, dist: bd } : null;
  }
}

function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
