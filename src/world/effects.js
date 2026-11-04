// Small particle effects: campfire flames, chimney smoke, fireflies, sparkles.
import * as THREE from 'three';

function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let SOFT = null, SMOKE = null;
function soft() { return SOFT || (SOFT = radialTexture()); }
function smokeTex() {
  if (SMOKE) return SMOKE;
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = s / 2 + (Math.random() - 0.5) * s * 0.4, y = s / 2 + (Math.random() - 0.5) * s * 0.4, r = s * (0.18 + Math.random() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  SMOKE = new THREE.CanvasTexture(c); SMOKE.colorSpace = THREE.SRGBColorSpace; return SMOKE;
}

export class Emitters {
  constructor(scene) { this.scene = scene; this.list = []; }
  add(e) { this.list.push(e); this.scene.add(e.object); return e; }
  remove(e) { this.scene.remove(e.object); this.list = this.list.filter((x) => x !== e); e.dispose?.(); }
  clear() { for (const e of this.list) { this.scene.remove(e.object); e.dispose?.(); } this.list = []; }
  update(dt, ctx) { for (const e of this.list) e.update(dt, ctx); }
}

export function campfire(pos) {
  const group = new THREE.Group(); group.position.copy(pos);
  const N = 26;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3), life = new Float32Array(N), sz = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.PointsMaterial({ map: soft(), color: 0xffa040, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); group.add(pts);
  const light = new THREE.PointLight(0xff8a3a, 6, 14, 1.6); light.position.y = 0.6; group.add(light);
  const smoke = chimneySmoke(new THREE.Vector3(0, 0.8, 0), 0.6);
  group.add(smoke.object);
  return {
    object: group, light,
    update(dt, ctx) {
      for (let i = 0; i < N; i++) {
        life[i] += dt * (1.4 + (i % 5) * 0.2);
        if (life[i] > 1) life[i] -= 1;
        const t = life[i], a = i * 2.4;
        p[i * 3] = Math.cos(a) * 0.18 * (1 - t) + Math.sin(t * 9 + i) * 0.03;
        p[i * 3 + 1] = 0.1 + t * 0.85;
        p[i * 3 + 2] = Math.sin(a) * 0.18 * (1 - t);
      }
      geo.attributes.position.needsUpdate = true;
      mat.size = 0.5 + Math.sin(performance.now() * 0.01) * 0.05;
      light.intensity = (5 + Math.sin(performance.now() * 0.013) * 0.8 + Math.sin(performance.now() * 0.031) * 0.6) * (ctx.night ? 1.4 : 0.6);
      smoke.update(dt, ctx);
    },
  };
}

export function chimneySmoke(pos, scale = 1) {
  const N = 14;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = i / N;
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ map: smokeTex(), color: 0xc8c8c8, size: 2.6 * scale, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.position.copy(pos); pts.frustumCulled = false;
  return {
    object: pts,
    update(dt, ctx) {
      const wind = ctx.wind || 0.8;
      for (let i = 0; i < N; i++) {
        life[i] += dt * 0.12; if (life[i] > 1) life[i] -= 1;
        const t = life[i];
        p[i * 3] = t * 3.5 * wind * scale + Math.sin(t * 6 + i) * 0.2;
        p[i * 3 + 1] = t * 6 * scale;
        p[i * 3 + 2] = t * 1.2 * wind * scale;
      }
      geo.attributes.position.needsUpdate = true;
      mat.color.setScalar(ctx.night ? 0.25 : 0.8);
    },
  };
}

export function fireflies(center, radius = 25, count = 60, heightFn) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), base = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * radius;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    base[i * 3] = x; base[i * 3 + 1] = heightFn(x, z) + 0.4 + Math.random() * 1.6; base[i * 3 + 2] = z; ph[i] = Math.random() * 10;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ map: soft(), color: 0xd8ff7a, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return {
    object: pts,
    update(dt, ctx) {
      const t = performance.now() * 0.001;
      mat.opacity = ctx.night ? 0.9 : 0;
      if (!ctx.night) return;
      for (let i = 0; i < count; i++) {
        p[i * 3] = base[i * 3] + Math.sin(t * 0.4 + ph[i]) * 1.2;
        p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.7 + ph[i] * 2) * 0.4;
        p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 + ph[i]) * 1.2;
      }
      geo.attributes.position.needsUpdate = true;
      mat.size = 0.14 + 0.06 * Math.sin(t * 3);
    },
  };
}

// glint that marks a rare find
export function sparkle(pos) {
  const mat = new THREE.SpriteMaterial({ map: soft(), color: 0xfff2c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat); s.position.copy(pos); s.scale.setScalar(0.3);
  return {
    object: s,
    update() { const t = performance.now() * 0.001; const k = Math.max(0, Math.sin(t * 2.3)) ** 6; s.scale.setScalar(0.12 + k * 0.5); mat.opacity = 0.3 + k * 0.7; },
  };
}
