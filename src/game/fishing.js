// Fishing: find open water ahead, cast, wait (with nibbles), strike on the bite, then play the
// fish by managing line tension. River and lake waters hold different species.
import * as THREE from 'three';
import { FISH_SIZES, ITEMS } from './items.js';
import { RNG } from '../core/rng.js';

export class Fishing {
  constructor(game) {
    this.game = game; this.state = 'idle'; this.rng = new RNG(Date.now() & 0xffffff);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.6 });
    const rodGeo = new THREE.CylinderGeometry(0.004, 0.012, 1.5, 6).translate(0, 0.75, 0);
    this.rod = new THREE.Mesh(rodGeo, rodMat);
    this.rod.position.set(0.28, -0.32, -0.45); this.rod.rotation.set(-0.95, 0.15, -0.25);
    this.rod.visible = false; game.camera.add(this.rod);
    this.tip = new THREE.Object3D(); this.tip.position.set(0, 1.5, 0); this.rod.add(this.tip);
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.5 }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }));
    this.bobber.add(top, bot); this.bobber.visible = false; game.scene.add(this.bobber);
    this.lineGeo = new THREE.BufferGeometry(); this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.6 }));
    this.line.frustumCulled = false; this.line.visible = false; game.scene.add(this.line);
    this.ui = { wrap: document.getElementById('fish-ui'), status: document.getElementById('fish-status'), tension: document.getElementById('fish-tension'), progress: document.getElementById('fish-progress'), reel: document.getElementById('btn-reel'), bars: document.getElementById('fish-bars') };
    this.held = false;
    const down = (e) => { e.preventDefault(); this.held = true; if (this.state === 'bite') this.strike(); };
    const up = () => { this.held = false; };
    this.ui.reel.addEventListener('pointerdown', down); this.ui.reel.addEventListener('pointerup', up); this.ui.reel.addEventListener('pointercancel', up); this.ui.reel.addEventListener('pointerleave', up);
    window.addEventListener('mousedown', (e) => { if (this.state === 'fight' && e.button === 0) this.held = true; });
    window.addEventListener('mouseup', () => { if (!this.ui.reel.matches(':active')) this.held = false; });
  }

  get active() { return this.state !== 'idle'; }

  // returns a fishing spot in front of the player or null
  findSpot(player, world) {
    if (world.kind !== 'wild') return null;
    const water = world.gen.p.water;
    if (water - world.heightAt(player.pos.x, player.pos.z) > 0.7) return null;
    const f = player.forward(new THREE.Vector3());
    for (let d = 3; d <= 10; d += 1) {
      const x = player.pos.x + f.x * d, z = player.pos.z + f.z * d;
      const depth = water - world.heightAt(x, z);
      if (depth > 0.9) {
        const s = world.gen.sample(x, z);
        return { pos: new THREE.Vector3(x + f.x * 1.5, water, z + f.z * 1.5), type: s.river > 0.25 ? 'river' : 'lake', depth };
      }
    }
    return null;
  }

  start(spot) {
    const g = this.game;
    this.spot = spot; this.state = 'cast'; this.t = 0;
    this.rod.visible = true; this.bobber.visible = true; this.line.visible = true;
    this.ui.wrap.classList.remove('hidden'); this.ui.bars.classList.add('hidden'); this.ui.reel.classList.add('hidden');
    this.setStatus('Casting…');
    g.player.frozen = true;
    this.castFrom = new THREE.Vector3(); this.tip.getWorldPosition(this.castFrom);
    const rod = g.save.upgrades.rod;
    this.wait = rod >= 2 ? this.rng.range(2.5, 6) : this.rng.range(3.5, 9.5);
    this.nibbles = this.rng.int(0, 2);
  }

  setStatus(t, alert = false) { this.ui.status.textContent = t; this.ui.status.classList.toggle('alert', alert); }

  cancel(msg) {
    this.state = 'idle';
    this.rod.visible = false; this.bobber.visible = false; this.line.visible = false;
    this.ui.wrap.classList.add('hidden');
    this.game.player.frozen = false; this.held = false;
    if (msg) this.game.ui.toast(msg);
  }

  strike() {
    if (this.state !== 'bite') return;
    const g = this.game, exp = g.expedition;
    const pool = exp.fish[this.spot.type] || exp.fish.lake;
    this.species = this.rng.pick(pool);
    const [a, b] = FISH_SIZES[this.species];
    this.size = Math.round(a + (b - a) * Math.pow(this.rng.next(), 1.6));
    this.strength = 0.5 + (this.size - a) / (b - a) * 0.8 + (this.species === 'pike' ? 0.25 : 0);
    this.state = 'fight'; this.T = 0.25; this.P = 0.2; this.pull = 0; this.pullT = 1; this.lowT = 0;
    this.ui.bars.classList.remove('hidden');
    this.ui.reel.textContent = 'Hold to reel';
    this.setStatus('Fish on! Reel steadily — ease off when the line strains.');
    g.audio.splash(0.6);
  }

  update(dt, input) {
    if (this.state === 'idle') return;
    const g = this.game, water = g.world.gen.p.water;
    const tipW = new THREE.Vector3(); this.tip.getWorldPosition(tipW);
    if (input.wasPressed('Escape') || input.moveVector().y !== 0 || input.moveVector().x !== 0) { if (this.state !== 'cast') { this.cancel('You reel in your line.'); return; } }
    const pressE = input.wasPressed('KeyE');
    const holdE = input.keys.has('KeyE');
    this.t += dt;
    const bp = this.bobber.position;
    if (this.state === 'cast') {
      const k = Math.min(1, this.t / 0.8);
      bp.lerpVectors(this.castFrom, this.spot.pos, k); bp.y += Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) { this.state = 'wait'; this.t = 0; g.audio.plop(); this.setStatus('Waiting for a bite…'); this.ui.reel.classList.remove('hidden'); this.ui.reel.textContent = 'Reel in'; }
    } else if (this.state === 'wait') {
      bp.copy(this.spot.pos); bp.y = water + Math.sin(this.t * 2.2) * 0.012;
      if (this.nibbles > 0 && this.t > this.wait * (0.3 + 0.25 * this.nibbles)) { this.nibbles--; this.dip = 0.25; g.audio.plop(); }
      if (this.dip > 0) { this.dip -= dt; bp.y -= 0.03; }
      if (pressE || (this.held && this.t > 0.3)) { this.cancel('You reel in your line.'); return; }
      if (this.t > this.wait) { this.state = 'bite'; this.t = 0; this.window = g.save.upgrades.rod >= 2 ? 1.5 : 1.1; this.setStatus('A bite! Strike now!', true); this.ui.reel.textContent = 'Strike!'; g.audio.splash(0.35); }
    } else if (this.state === 'bite') {
      bp.copy(this.spot.pos); bp.y = water - 0.06 - Math.abs(Math.sin(this.t * 18)) * 0.04;
      if (pressE) this.strike();
      else if (this.t > this.window) { this.state = 'wait'; this.t = 0; this.wait = this.rng.range(3, 7); this.setStatus('Too slow — it took the bait. Waiting…'); this.ui.reel.textContent = 'Reel in'; }
    } else if (this.state === 'fight') {
      const hold = this.held || holdE;
      this.pullT -= dt;
      if (this.pullT < 0) { this.pull = this.rng.range(0.3, 1.0) * this.strength; this.pullT = this.rng.range(0.7, 2.0); }
      const pullNow = this.pullT > (this.pullT + 0.0) && this.pull > 0 ? this.pull : 0;
      const surge = this.pullT < 0.55 ? this.pull : 0;
      const rodK = g.save.upgrades.rod >= 2 ? 0.75 : 1;
      if (hold) { this.T += (0.38 + surge * 1.1) * rodK * dt; this.P += 0.19 * dt / (0.6 + this.strength * 0.4); if (Math.random() < dt * 12) g.audio.reel(); }
      else { this.T -= 0.6 * dt; this.T += surge * 0.25 * dt; this.P -= (0.035 + surge * 0.06) * dt; }
      this.T = Math.max(0, this.T);
      bp.copy(this.spot.pos).lerp(new THREE.Vector3(g.player.pos.x, water, g.player.pos.z), Math.max(0, this.P) * 0.8);
      bp.x += Math.sin(this.t * 7) * 0.15 * surge; bp.y = water - 0.05;
      if (this.T >= 1) { this.cancel('Snap! The line broke and the fish is gone.'); g.audio.splash(1); return; }
      if (this.P <= 0) { this.lowT += dt; if (this.lowT > 1.6) { this.cancel('The fish shook free.'); return; } } else this.lowT = 0;
      if (this.P >= 1) { this.land(); return; }
      this.ui.tension.style.width = `${Math.min(100, this.T * 100)}%`;
      this.ui.tension.style.background = this.T > 0.82 ? '#d27b62' : '';
      this.ui.progress.style.width = `${Math.max(0, this.P) * 100}%`;
      this.setStatus(surge ? 'It\'s pulling hard!' : 'Reel it in…', !!surge);
    }
    // line from tip to bobber with a slight sag
    const a = this.lineGeo.attributes.position.array;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const x = tipW.x + (bp.x - tipW.x) * t, z = tipW.z + (bp.z - tipW.z) * t;
      const y = tipW.y + (bp.y - tipW.y) * t - Math.sin(t * Math.PI) * (this.state === 'fight' ? 0.05 : 0.35);
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    this.lineGeo.attributes.position.needsUpdate = true;
  }

  land() {
    const g = this.game, sp = this.species, size = this.size;
    this.cancel();
    g.audio.splash(0.8);
    const ok = g.addToPack(sp, 1, true);
    const rec = g.save.journal.fish[sp] || (g.save.journal.fish[sp] = { count: 0, best: 0 });
    rec.count++;
    const isRecord = size > rec.best; if (isRecord) rec.best = size;
    g.showCard(`<div class="k">${isRecord ? 'New personal best' : 'Caught'}</div><div class="n">${ITEMS[sp].name}</div><div class="s">${size} cm · ${ITEMS[sp].desc}</div><div class="o">${ok ? 'Added to your pack.' : 'Your pack is full — you let it go.'}</div>`, 2600);
    g.persist();
  }
}
