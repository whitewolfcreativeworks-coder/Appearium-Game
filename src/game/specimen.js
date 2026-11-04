// Specimen viewer: a small second WebGL view used inside panels to examine a find up close.
// Drag to turn it; buttons tilt it to look underneath, dig up the base, or slice it open.
import * as THREE from 'three';
import { buildMushroom, buildPlant, MUSHROOM_SPECS } from '../world/flora.js';
import { buildFish } from '../world/fishModel.js';
import { tex } from '../core/assets.js';
import { MUSHROOMS } from '../data/species.js';

export class SpecimenViewer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'specimen';
    this.renderer = null; this.running = false;
    this.yaw = 0.6; this.pitch = 0.35; this.dist = 1; this.targetPitch = 0.35; this.auto = true;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.005, 20);
    this.scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x4a3a28, 1.3));
    const d = new THREE.DirectionalLight(0xfff2dd, 2.6); d.position.set(1.5, 3, 2); this.scene.add(d);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.8); fill.position.set(-2, -1, -1.5); this.scene.add(fill);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    const gmat = new THREE.MeshStandardMaterial({ map: tex('terrain/forest_leaves_03_diff.jpg'), roughness: 1, color: 0xb8b0a0 });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), gmat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; this.auto = false; try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ } e.stopPropagation(); });
    this.canvas.addEventListener('pointermove', (e) => { if (!drag) return; this.yaw -= (e.clientX - drag.x) * 0.012; this.targetPitch = Math.max(-1.2, Math.min(1.35, this.targetPitch + (e.clientY - drag.y) * 0.01)); drag = { x: e.clientX, y: e.clientY }; e.stopPropagation(); });
    const up = () => { drag = null; };
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
    this.canvas.style.touchAction = 'none';
  }

  ensureRenderer() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x232822);
  }

  mount(el) {
    this.ensureRenderer();
    el.appendChild(this.canvas);
    const w = el.clientWidth || 320, h = el.clientHeight || 260;
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    if (!this.running) { this.running = true; this.loop(); }
  }
  unmount() { this.running = false; this.canvas.remove(); }

  clear() { for (const c of [...this.holder.children]) this.holder.remove(c); this.substrate && this.scene.remove(this.substrate); this.substrate = null; }

  show(kind, id, opts = {}) {
    this.clear();
    this.kind = kind; this.id = id; this.opts = opts;
    let obj, groundY = 0;
    if (kind === 'mushroom') {
      const res = buildMushroom(id, opts.seed || 7, { single: true, cut: !!opts.cut });
      obj = new THREE.Group(); for (const p of res.parts) obj.add(new THREE.Mesh(p.geometry, p.material));
      const hab = MUSHROOMS[id].habitat;
      if (hab === 'tree') { // shelf on a trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.9, 16), new THREE.MeshStandardMaterial({ map: tex('build/bark_brown_02_diff.jpg'), roughness: 0.95 }));
        trunk.position.set(-0.25, 0.3, 0); this.substrate = trunk; this.scene.add(trunk); obj.position.set(0.0, 0.18, 0);
      } else if (hab === 'wood') {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex('build/bark_brown_02_diff.jpg'), roughness: 0.95, color: 0x8a7a6a }));
        log.position.set(0, 0.03, -0.06); this.substrate = log; this.scene.add(log);
      }
    } else if (kind === 'plant') {
      const res = buildPlant(id, opts.seed || 3);
      obj = new THREE.Group(); for (const p of res.parts) obj.add(new THREE.Mesh(p.geometry, p.material));
    } else if (kind === 'fish') {
      obj = buildFish(id); obj.position.y = 0.12; obj.rotation.y = 0;
    } else if (kind === 'object') { obj = opts.object; }
    this.holder.add(obj);
    // frame the specimen
    const box = new THREE.Box3().setFromObject(this.holder);
    if (this.substrate) box.expandByObject(this.substrate);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const R = Math.max(size.x, size.y, size.z) * 0.5;
    if (kind === 'fish') { const s = 0.5 / R; obj.scale.setScalar(s); obj.position.y = 0.0; box.setFromObject(this.holder); box.getCenter(c); }
    this.radius = kind === 'fish' ? 0.5 : R;
    this.center = c;
    this.dist = this.radius / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * 1.35;
    this.ground.scale.setScalar(Math.max(this.radius * 2.4, 0.15));
    this.ground.visible = kind !== 'fish' && kind !== 'object';
    this.ground.position.y = groundY;
    this.dug = false;
    this.targetPitch = kind === 'fish' ? 0.15 : 0.32; this.pitch = this.targetPitch; this.auto = true;
  }

  view(which) {
    this.auto = false;
    if (which === 'under') this.targetPitch = -0.9;
    else if (which === 'top') this.targetPitch = 1.2;
    else this.targetPitch = 0.25;
  }
  dig() { // lower the soil to reveal what is buried (e.g. an Amanita volva)
    this.dug = true; this.ground.position.y = -0.06;
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    if (this.auto) this.yaw += 0.006;
    this.pitch += (this.targetPitch - this.pitch) * 0.12;
    const c = this.center || new THREE.Vector3();
    const cp = Math.cos(this.pitch);
    this.cam.position.set(c.x + Math.sin(this.yaw) * cp * this.dist, c.y + Math.sin(this.pitch) * this.dist, c.z + Math.cos(this.yaw) * cp * this.dist);
    this.cam.near = this.dist * 0.05; this.cam.far = this.dist * 10; this.cam.updateProjectionMatrix();
    this.cam.lookAt(c);
    // when looking from below, hide the ground disc so the underside is visible
    if (this.ground.visible || this.kind === 'mushroom' || this.kind === 'plant') this.ground.visible = this.pitch > -0.05;
    this.renderer.render(this.scene, this.cam);
  }
}

let shared = null;
export function viewer() { return shared || (shared = new SpecimenViewer()); }
export const isBall = (id) => !!MUSHROOM_SPECS[id]?.ball;
