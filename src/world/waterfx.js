// Water that responds and reflects.
//
//  Ripples — a small GPU wave-equation solver (the height-field method popularised by Evan
//  Wallace's "WebGL Water", MIT) running in a 64 m square that follows the player. Anything that
//  touches the water drops a disturbance in: your feet when you wade, the bobber, a jumping
//  fish, a frog, raindrops. The rings spread, interfere, pass each other and die away, and the
//  water shader bends its normals with them.
//
//  Reflections — a planar mirror pass (the oblique-clip technique from three.js's Reflector, MIT).
//  All open water in a world sits at one level, so a single mirrored camera reflects trees,
//  hills, the village and the sky in every lake and river. Rendered at reduced resolution and
//  only when water is actually in view.
import * as THREE from 'three';

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Ripples {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.N = opts.res || 256; this.size = opts.size || 64; // metres covered
    const ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'));
    this.enabled = ok && opts.enabled !== false;
    this.origin = new THREE.Vector2(-this.size / 2, -this.size / 2); // world xz of texel (0,0)
    this.drops = []; this.acc = 0; this.rainAcc = 0;
    if (!this.enabled) return;
    const mk = () => new THREE.WebGLRenderTarget(this.N, this.N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    this.a = mk(); this.b = mk();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const d = 1 / this.N;
    this.step = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, uDelta: { value: new THREE.Vector2(d, d) }, uC2: { value: 0.3 }, uDamp: { value: 0.992 } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D tPrev; uniform vec2 uDelta; uniform float uC2, uDamp; varying vec2 vUv;
        void main(){
          vec4 info = texture2D(tPrev, vUv);
          float avg = (texture2D(tPrev, vUv - vec2(uDelta.x, 0.0)).r + texture2D(tPrev, vUv + vec2(uDelta.x, 0.0)).r +
                       texture2D(tPrev, vUv - vec2(0.0, uDelta.y)).r + texture2D(tPrev, vUv + vec2(0.0, uDelta.y)).r) * 0.25;
          info.g += (avg - info.r) * uC2;
          info.g *= uDamp;
          info.r = (info.r + info.g) * 0.9995;
          // absorb at the edges of the window so rings don't bounce off an invisible wall
          vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, 0.06, min(e.x, e.y));
          gl_FragColor = vec4(info.r * edge, info.g * edge, 0.0, 1.0);
        }`,
    });
    this.dropMat = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, uDrops: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uCount: { value: 0 }, uSize: { value: this.size } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D tPrev; uniform vec4 uDrops[8]; uniform int uCount; uniform float uSize; varying vec2 vUv;
        void main(){
          vec4 info = texture2D(tPrev, vUv); vec2 p = vUv * uSize;
          for (int i = 0; i < 8; i++) {
            if (i >= uCount) break;
            vec4 d = uDrops[i];
            float k = max(0.0, 1.0 - length(p - d.xy) / d.z);
            info.r -= (0.5 - 0.5 * cos(k * 3.14159)) * d.w;
          }
          gl_FragColor = info;
        }`,
    });
    this.shiftMat = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, uShift: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VS, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D tPrev; uniform vec2 uShift; varying vec2 vUv;
        void main(){ vec2 uv = vUv + uShift; gl_FragColor = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(tPrev, uv); }`,
    });
    // clear both targets
    const r = renderer, prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    r.setClearColor(0x000000, 0); for (const t of [this.a, this.b]) { r.setRenderTarget(t); r.clear(true, false, false); }
    r.setRenderTarget(prev); r.setClearColor(cc, ca);
  }

  get texture() { return this.enabled ? this.a.texture : null; }

  // push water down at (x, z): radius in metres, strength ~0.02 (raindrop) … 0.6 (big splash)
  drop(x, z, radius = 0.5, strength = 0.15) {
    if (!this.enabled) return;
    const lx = x - this.origin.x, lz = z - this.origin.y;
    if (lx < 0 || lz < 0 || lx > this.size || lz > this.size) return;
    if (this.drops.length < 8) this.drops.push([lx, lz, Math.max(radius, this.size / this.N * 1.5), strength]);
  }

  pass(mat) { mat.uniforms.tPrev.value = this.a.texture; this.quad.material = mat; this.renderer.setRenderTarget(this.b); this.renderer.render(this.scene, this.cam); const t = this.a; this.a = this.b; this.b = t; }

  update(dt, center, rain = 0, waterNear = true) {
    if (!this.enabled) return;
    // keep the window centred on the player, moving in whole 4 m steps
    const snap = 4, ox = Math.round((center.x - this.size / 2) / snap) * snap, oz = Math.round((center.z - this.size / 2) / snap) * snap;
    const r = this.renderer, prevRT = r.getRenderTarget(), auto = r.autoClear; r.autoClear = false;
    if (ox !== this.origin.x || oz !== this.origin.y) {
      this.shiftMat.uniforms.uShift.value.set((ox - this.origin.x) / this.size, (oz - this.origin.y) / this.size);
      this.pass(this.shiftMat); this.origin.set(ox, oz);
    }
    if (!waterNear && !this.drops.length) { this.idle = (this.idle || 0) + dt; if (this.idle > 6) { r.setRenderTarget(prevRT); r.autoClear = auto; return; } } else this.idle = 0;
    // rain: rings everywhere on the water
    if (rain > 0.05 && waterNear) {
      this.rainAcc += dt * rain * 60;
      while (this.rainAcc > 1 && this.drops.length < 8) { this.rainAcc -= 1; this.drop(center.x + (Math.random() - 0.5) * this.size * 0.8, center.z + (Math.random() - 0.5) * this.size * 0.8, 0.12 + Math.random() * 0.1, 0.05 + Math.random() * 0.05); }
      this.rainAcc = Math.min(this.rainAcc, 3);
    }
    if (this.drops.length) {
      const u = this.dropMat.uniforms; this.drops.forEach((d, i) => u.uDrops.value[i].set(d[0], d[1], d[2], d[3])); u.uCount.value = this.drops.length;
      this.pass(this.dropMat); this.drops.length = 0;
    }
    // fixed-rate simulation (60 steps a second, at most 3 a frame)
    this.acc = Math.min(this.acc + dt, 0.05);
    while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.pass(this.step); }
    r.setRenderTarget(prevRT); r.autoClear = auto;
  }

  bind(u) { // water material uniforms
    u.tRipple.value = this.texture; u.uRippleOn.value = this.enabled ? 1 : 0;
    u.uRipple.value.set(this.origin.x, this.origin.y, this.size, 1 / this.N);
  }
}

export class Reflection {
  constructor(renderer, opts = {}) {
    this.renderer = renderer; this.scale = opts.scale ?? 0.5; this.enabled = opts.enabled !== false && this.scale > 0;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
    this.cam = new THREE.PerspectiveCamera();
    this.texMat = new THREE.Matrix4();
    this.active = false;
    this._v = { n: new THREE.Vector3(0, 1, 0), rp: new THREE.Vector3(), cp: new THREE.Vector3(), view: new THREE.Vector3(), look: new THREE.Vector3(), target: new THREE.Vector3(), rot: new THREE.Matrix4(), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4() };
    this.frustum = new THREE.Frustum(); this.pm = new THREE.Matrix4();
  }

  // is any water mesh in view (and near enough to matter)?
  waterVisible(camera, chunks) {
    if (!chunks) return false;
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    for (const c of chunks.values()) {
      if (!c.water) continue; const bs = c.water.geometry.boundingSphere;
      if (bs && bs.center.distanceTo(camera.position) < 420 && this.frustum.intersectsSphere(bs)) return true;
    }
    return false;
  }

  render(scene, camera, level, hide = [], waterMat) {
    this.active = false;
    if (!this.enabled) return;
    const v = this._v, r = this.renderer;
    camera.updateMatrixWorld();
    v.cp.setFromMatrixPosition(camera.matrixWorld);
    if (v.cp.y < level + 0.05) return; // under (or at) the surface
    const w = Math.max(64, Math.floor(r.domElement.width * this.scale)), h = Math.max(64, Math.floor(r.domElement.height * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    // mirror the camera in the plane y = level
    v.rp.set(v.cp.x, level, v.cp.z);
    v.view.subVectors(v.rp, v.cp).reflect(v.n).negate().add(v.rp);
    v.rot.extractRotation(camera.matrixWorld);
    v.look.set(0, 0, -1).applyMatrix4(v.rot).add(v.cp);
    v.target.subVectors(v.rp, v.look).reflect(v.n).negate().add(v.rp);
    const vc = this.cam;
    vc.position.copy(v.view); vc.up.set(0, 1, 0).applyMatrix4(v.rot).reflect(v.n); vc.lookAt(v.target);
    vc.far = camera.far; vc.near = camera.near; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // oblique near plane = the water surface, so nothing below it shows in the mirror
    v.plane.setFromNormalAndCoplanarPoint(v.n, v.rp).applyMatrix4(vc.matrixWorldInverse);
    v.clip.set(v.plane.normal.x, v.plane.normal.y, v.plane.normal.z, v.plane.constant);
    const e = vc.projectionMatrix.elements;
    v.q.set((Math.sign(v.clip.x) + e[8]) / e[0], (Math.sign(v.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    v.clip.multiplyScalar(2 / v.clip.dot(v.q));
    e[2] = v.clip.x; e[6] = v.clip.y; e[10] = v.clip.z + 1 - 0.003; e[14] = v.clip.w;
    // render the mirror image (no water, no rain, shadows reused from the last frame)
    const was = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
    const wmv = waterMat.visible; waterMat.visible = false;
    const sAuto = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    const prevRT = r.getRenderTarget();
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, vc);
    r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = sAuto; waterMat.visible = wmv; hide.forEach((o, i) => { o.visible = was[i]; });
    this.active = true;
  }

  bind(u) { u.tRefl.value = this.rt.texture; u.uReflOn.value = this.active ? 1 : 0; u.uReflMat.value.copy(this.texMat); }
}
