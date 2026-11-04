// Full-screen effects for altered states. Only active (and only costs anything) while the player
// is poisoned, tripping or collapsing; otherwise the scene renders straight to the screen.
import * as THREE from 'three';

export class PostFX {
  constructor(renderer, msaa = 0) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: msaa });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.rt.texture }, uTime: { value: 0 }, uSick: { value: 0 }, uTrip: { value: 0 }, uCollapse: { value: 0 }, uAspect: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tScene; uniform float uTime, uSick, uTrip, uCollapse, uAspect; varying vec2 vUv;
        vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
        void main(){
          vec2 uv = vUv; vec2 c = uv - 0.5; c.x *= uAspect; float r = length(c);
          // trip: breathing, flowing, kaleidoscopic warps
          float t = uTime;
          uv += uTrip * 0.012 * vec2(sin(uv.y * 14.0 + t * 1.3) + sin(uv.y * 5.0 - t * 0.7), cos(uv.x * 12.0 + t * 1.1) + cos(uv.x * 4.0 + t * 0.5));
          uv = mix(uv, 0.5 + (uv - 0.5) * (1.0 + 0.04 * sin(t * 0.9)), uTrip);
          // sickness: slow nauseous drift and double vision
          uv += uSick * 0.006 * vec2(sin(t * 0.8), cos(t * 0.63));
          float ca = uTrip * 0.006 + uSick * 0.004;
          vec2 dir = normalize(c + 1e-5) * ca;
          vec3 col;
          col.r = texture2D(tScene, uv + dir).r; col.g = texture2D(tScene, uv).g; col.b = texture2D(tScene, uv - dir).b;
          vec3 ghost = texture2D(tScene, uv + vec2(0.012, 0.004) * uSick * (0.6 + 0.4 * sin(t * 1.7))).rgb;
          col = mix(col, (col + ghost) * 0.5, uSick * 0.8);
          // trip colours: hue cycling bands and boosted saturation
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 sat = mix(vec3(l), col, 1.0 + uTrip * 0.9);
          col = mix(col, hueShift(sat, uTrip * (1.4 * sin(t * 0.4 + r * 6.0 - l * 4.0))), uTrip * 0.75);
          col += uTrip * 0.05 * vec3(sin(t + uv.x * 20.0), sin(t * 1.3 + uv.y * 17.0), sin(t * 0.7 + r * 30.0)) * l;
          // sickness: sallow green-yellow cast, desaturation, tunnel vision
          col = mix(col, vec3(l) * vec3(0.95, 1.05, 0.7), uSick * 0.45);
          float vig = smoothstep(0.35, 0.95, r);
          col *= 1.0 - vig * (uSick * 0.55 + uTrip * 0.15) - uCollapse * smoothstep(0.1, 0.7, r);
          col *= 1.0 - uCollapse * 0.8;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.time = 0;
  }

  active(fx) { return fx.sick > 0.01 || fx.trip > 0.01 || fx.collapse > 0.01; }

  render(scene, camera, fx, dt) {
    const r = this.renderer;
    const w = r.domElement.width, h = r.domElement.height;
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    this.time += dt;
    const u = this.mat.uniforms;
    u.uTime.value = this.time; u.uSick.value = fx.sick; u.uTrip.value = fx.trip; u.uCollapse.value = fx.collapse; u.uAspect.value = w / h;
    r.setRenderTarget(this.rt); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
}
