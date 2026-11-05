// First-person player controller + unified input (keyboard/mouse and touch).
import * as THREE from 'three';
import { clamp } from '../core/rng.js';

export class Input {
  constructor(dom, settings) {
    this.dom = dom; this.settings = settings;
    this.keys = new Set(); this.look = { x: 0, y: 0 }; this.joy = { x: 0, y: 0 };
    this.pressed = new Set(); this.locked = false; this.enabled = true; this.touchRun = false;
    this.runMode = false; this.autoRun = false; this.touchDive = false; this.touchUp = false; // the Run button: a steady long-distance pace, and auto-run
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.code; if (!this.keys.has(k)) this.pressed.add(k); this.keys.add(k);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) { this.look.x += e.movementX; this.look.y += e.movementY; }
    });
    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouchEvent) return;
      if (!this.locked && dom.requestPointerLock) {
        try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => { this.dragging = true; }); } catch (_) { this.dragging = true; }
      }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    this.setupTouch();
  }

  setupTouch() {
    const layer = document.getElementById('touch-layer');
    const joyEl = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    this.joyPtr = null; this.lookPtrs = new Map();
    const R = 56;
    layer.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.isTouchEvent = true;
      if (!this.enabled) return;
      try { layer.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or already-released pointers */ }
      if (e.clientX < window.innerWidth * 0.42 && this.joyPtr === null) {
        this.joyPtr = e.pointerId; this.joyOrigin = { x: e.clientX, y: e.clientY };
        joyEl.style.left = (e.clientX - 70) + 'px'; joyEl.style.top = (e.clientY - 70) + 'px'; joyEl.classList.add('on');
        knob.style.transform = 'translate(0px,0px)';
      } else this.lookPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.preventDefault();
    }, { passive: false });
    layer.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyPtr) {
        let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.joy.x = dx / R; this.joy.y = -dy / R;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.touchRun = l > R * 0.98 && this.settings.autoRun !== false;
      } else if (this.lookPtrs.has(e.pointerId)) {
        const p = this.lookPtrs.get(e.pointerId);
        this.look.x += (e.clientX - p.x) * 2.2; this.look.y += (e.clientY - p.y) * 2.2;
        p.x = e.clientX; p.y = e.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      if (e.pointerId === this.joyPtr) { this.joyPtr = null; this.joy.x = this.joy.y = 0; joyEl.classList.remove('on'); this.touchRun = false; }
      this.lookPtrs.delete(e.pointerId);
    };
    layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
  }

  releaseAll() { this.keys.clear(); this.joy.x = this.joy.y = 0; this.joyPtr = null; this.lookPtrs?.clear(); document.getElementById('joy')?.classList.remove('on'); if (this.locked) document.exitPointerLock?.(); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.look.x = this.look.y = 0; }

  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.joy.x; y += this.joy.y;
    // auto-run: keep going forward, steering with your eyes; pulling back stops it
    if (this.autoRun) { if (y < -0.3) this.autoRun = false; else y = Math.max(y, 1); }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  get diving() { return this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.touchDive; }
  get rising() { return this.keys.has('Space') || this.touchUp; }
  get running() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchRun || this.runMode || this.autoRun; }
}

export class Player {
  constructor(camera) {
    this.camera = camera; camera.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(); this.vy = 0; this.yaw = 0; this.pitch = 0;
    this.onGround = true; this.running = false; this.speed = 0; this.bob = 0; this.stepAcc = 0;
    this.radius = 0.35; this.eye = 1.62; this.frozen = false;
    this.vel = new THREE.Vector3(); this.inWater = 0; this.lastSafe = new THREE.Vector3();
    this.onStep = null;
  }
  place(x, z, yaw, world) { this.pos.set(x, world.heightAt(x, z), z); this.yaw = yaw; this.pitch = -0.05; this.vy = 0; this.lastSafe.copy(this.pos); this.syncCamera(0); }

  update(dt, input, world, settings) {
    const sens = 0.0022 * (settings.lookSens || 1);
    this.yaw -= input.look.x * sens;
    this.pitch -= input.look.y * sens * (settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
    const mv = this.frozen ? { x: 0, y: 0 } : input.moveVector();
    const body = this.body;
    this.running = input.running && mv.y > 0.3 && !this.frozen && (!body || body.canRun());
    const water = world.gen.p.water;
    const ground = world.heightAt(this.pos.x, this.pos.z);
    // swimming: once the water is deeper than about chest height you float, and can dive
    if (water - ground > 1.3 || (this.swimming && water - ground > 1.0)) { this.swimUpdate(dt, input, world, mv, water, ground); return; }
    if (this.swimming) { this.swimming = false; this.underwater = false; this.onGround = true; }
    const depth = water - ground;
    this.inWater = Math.max(0, depth);
    // a steady long-distance run, slowing as you tire
    let target = (this.running ? 6.5 * (body ? body.runFactor() : 1) : 2.9) * Math.hypot(mv.x, mv.y);
    if (depth > 0) target *= Math.max(0.35, 1 - depth * 0.55);
    if (body) target *= body.speedMul();
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let dx = fx * mv.y + rx * mv.x, dz = fz * mv.y + rz * mv.x;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const prev = this.pos.clone();
    if (mv.x || mv.y) { this.pos.x += dx * this.speed * dt; this.pos.z += dz * this.speed * dt; }
    else { this.speed *= 0.8; }
    // steep slopes resist climbing
    const nh = world.heightAt(this.pos.x, this.pos.z);
    const rise = (nh - ground) / Math.max(0.001, Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z));
    if (rise > 1.25 && this.onGround) { this.pos.x = prev.x + (this.pos.x - prev.x) * 0.15; this.pos.z = prev.z + (this.pos.z - prev.z) * 0.15; }
    world.colliders.resolve(this.pos, this.radius);
    world.constrain && world.constrain(this.pos, prev);
    const ndepth = water - world.heightAt(this.pos.x, this.pos.z);
    // vertical
    const gh = world.heightAt(this.pos.x, this.pos.z);
    if (input.wasPressed('Space') && this.onGround && !this.frozen && ndepth < 0.5) { this.vy = 4.6; this.onGround = false; }
    this.vy -= 13 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= gh) { if (!this.onGround && this.vy < -6) this.onStep && this.onStep(1.4); this.pos.y = gh; this.vy = 0; this.onGround = true; }
    else if (this.pos.y > gh + 0.05 && this.vy <= 0 && this.pos.y - gh < 0.35) { this.pos.y = gh; this.onGround = true; this.vy = 0; } // stick to downhill
    else this.onGround = this.pos.y - gh < 0.02;
    if (ndepth < 0.3) this.lastSafe.copy(this.pos);
    // footsteps & bob
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    if (moved > 0.01) this.climb = (this.climb || 0) + ((this.pos.y - prev.y) / moved - (this.climb || 0)) * Math.min(1, dt * 2);
    if (this.onGround) {
      this.bob += moved * (this.running ? 1.9 : 2.3);
      this.stepAcc += moved;
      const stride = this.running ? 1.5 : 0.85;
      if (this.stepAcc > stride) { this.stepAcc = 0; this.onStep && this.onStep(this.running ? 1 : 0.6, depth > 0.05); }
    }
    // standing still for a few seconds you sit down to rest (and get your breath back faster)
    const still = this.speed < 0.15 && this.onGround && depth < 0.05 && !this.frozen;
    this.stillT = still ? (this.stillT || 0) + dt : 0;
    this.resting = this.stillT > 4;
    this.sit = (this.sit || 0) + ((this.resting ? 1 : 0) - (this.sit || 0)) * Math.min(1, dt * 2);
    this.syncCamera(dt);
  }

  // in the water: float at the surface; dive (and swim where you look) while holding Dive; rise with
  // Up/Space; rivers carry you downstream; the bottom and the banks stop you
  swimUpdate(dt, input, world, mv, W, ground) {
    const body = this.body, prev = this.pos.clone();
    if (!this.swimming) { this.swimming = true; this.vy = 0; this.pos.y = Math.max(this.pos.y, W - 1.45); this.onSwimStart?.(); }
    this.onGround = false; this.running = input.running && mv.y > 0.3 && (!body || body.canRun());
    const swell = this.swell ? this.swell(this.pos.x, this.pos.z) : 0; this.surfaceH = W + swell;
    const surfaceY = W + swell - 1.36 + Math.sin(performance.now() * 0.0016) * 0.04; // feet; eyes just above the water, riding the swell
    const target = (this.running ? 2.5 : 1.6) * Math.hypot(mv.x, mv.y) * (body ? Math.max(0.6, body.speedMul()) : 1);
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let dx = -sy * mv.y + cy * mv.x, dz = -cy * mv.y - sy * mv.x; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const under = this.pos.y < surfaceY - 0.25;
    // underwater, forward follows your gaze (look down to swim down)
    let vyWant = 0;
    if (input.diving) vyWant = -1.5; else if (input.rising) vyWant = 1.5;
    else if (under) vyWant = mv.y > 0.3 ? Math.sin(this.pitch) * this.speed : 0.35; // drift gently up when still
    const horiz = under && mv.y > 0.3 && !input.diving && !input.rising ? Math.cos(this.pitch) : 1;
    if (mv.x || mv.y) { this.pos.x += dx * this.speed * horiz * dt; this.pos.z += dz * this.speed * horiz * dt; } else this.speed *= 0.9;
    this.vy += (vyWant - this.vy) * Math.min(1, dt * 3);
    this.pos.y += this.vy * dt;
    // the current
    const f = world.gen.flowAt ? world.gen.flowAt(this.pos.x, this.pos.z) : [0, 0];
    this.pos.x += f[0] * 0.8 * dt; this.pos.z += f[1] * 0.8 * dt;
    world.colliders.resolve(this.pos, this.radius);
    world.constrain && world.constrain(this.pos, prev);
    const g = world.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y > surfaceY && !this.underwater) { this.pos.y += (surfaceY - this.pos.y) * Math.min(1, dt * 6); this.vy = Math.min(this.vy, 0); } else if (this.pos.y > surfaceY) { this.pos.y = surfaceY; this.vy = Math.min(this.vy, 0); }
    if (this.pos.y < g + 0.15) { this.pos.y = g + 0.15; this.vy = Math.max(0, this.vy); }
    // walking out: where it's shallow, stand up
    if (W - g < 1.0 && this.pos.y >= g - 0.05) { this.swimming = false; this.underwater = false; this.pos.y = g; this.onGround = true; }
    this.underwater = this.pos.y + this.eye < W + swell - 0.12;
    this.inWater = W - g; this.lastSafe.copy(this.pos);
    // strokes
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    this.bob += moved * 1.2; this.stepAcc += moved;
    if (this.stepAcc > 1.4) { this.stepAcc = 0; this.onStroke?.(this.underwater, this.running); }
    this.stillT = 0; this.resting = false; this.sit = 0; this.climb = 0;
    this.syncCamera(dt);
  }

  syncCamera() {
    const bobY = Math.sin(this.bob * 2) * (0.035 + Math.max(0, this.speed - 4) * 0.006) * Math.min(1, this.speed / 3), bobX = Math.cos(this.bob) * 0.02 * Math.min(1, this.speed / 3);
    this.camera.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.pos.y + this.eye - (this.sit || 0) * 0.7 + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
