// Water: per-chunk patches carrying a depth attribute (water level − terrain height), a "sea"
// weight and a current (rivers and streams), so one shader does it all:
//  · the sea: a sum of Gerstner waves with deep-water dispersion (ω² = g·k) — sharp crests,
//    broad troughs, swell that shoals and runs up the beach, foam where it breaks;
//  · rivers and streams: flow-mapped surface detail that actually runs downstream, faster in
//    streams, with foam streaks near the banks;
//  · lakes and ponds: calm, wind-roughened, mirror-like;
//  · everywhere: real reflections (planar mirror pass), live ripples from the ripple solver,
//    depth tint, shoreline foam and transparency without a depth pre-pass.
import * as THREE from 'three';
import { tex } from '../core/assets.js';

// the swell: [angle from the main swell direction, wavelength m, steepness k·A]
const WAVES = [[0.0, 41, 0.085], [0.38, 27, 0.075], [-0.33, 19, 0.07], [0.75, 13, 0.065], [-0.7, 9.5, 0.06], [1.15, 6.6, 0.055], [-1.25, 4.6, 0.05], [0.22, 3.1, 0.045]];
const GLSL_WAVES = `const int NW = ${WAVES.length};
const vec3 WV[NW] = vec3[NW](${WAVES.map((w) => `vec3(${w.map((x) => x.toFixed(3)).join(',')})`).join(',')});`;

export function createWaterMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 },
    tNormal: { value: null },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uSkyZenith: { value: new THREE.Color(0.25, 0.45, 0.75) },
    uSkyHorizon: { value: new THREE.Color(0.7, 0.78, 0.85) },
    uShallow: { value: new THREE.Color(0.16, 0.22, 0.17) },
    uDeep: { value: new THREE.Color(0.02, 0.06, 0.08) },
    uRain: { value: 0 },
    uLight: { value: 1 },
    uWind: { value: 0.4 },
    uWave: { value: 0.6 },                          // sea state: 0.3 calm … 1.8 storm
    uWaveDir: { value: new THREE.Vector2(0, 1) },   // direction the swell travels (towards the shore)
    tRefl: { value: null }, uReflOn: { value: 0 }, uReflMat: { value: new THREE.Matrix4() },
    tRipple: { value: null }, uRippleOn: { value: 0 }, uRipple: { value: new THREE.Vector4(0, 0, 64, 1 / 256) },
  }]);
  uniforms.tNormal.value = tex('waternormals.jpg', { srgb: false });
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute float aDepth; attribute float aSea; attribute vec2 aFlow;
      uniform float uTime, uWave; uniform vec2 uWaveDir; uniform mat4 uReflMat;
      varying vec3 vWPos; varying float vDepth; varying float vSea; varying float vLift; varying vec2 vFlow; varying vec4 vReflUv; varying vec2 vBase;
      ${GLSL_WAVES}
      #include <fog_pars_vertex>
      vec2 rot(vec2 d, float a){ float c = cos(a), s = sin(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDepth = aDepth; vSea = aSea; vFlow = aFlow; vBase = wp.xz;
        vec3 disp = vec3(0.0);
        if (aSea > 0.001) {
          // shoaling: swell is damped in the shallows (and the big waves feel the bottom first)
          float amp = (0.25 + uWave * 0.75) * aSea;
          for (int i = 0; i < 5; i++) {
            vec3 w = WV[i]; vec2 d = rot(uWaveDir, w.x); float k = 6.2832 / w.y, om = sqrt(9.81 * k);
            float A = min(w.z / k * amp, max(0.0, aDepth) * 0.16);
            float th = k * dot(d, wp.xz) - om * uTime + float(i) * 1.7;
            float Q = min(1.6, 0.11 / max(1e-4, w.z * amp));
            disp.xz += Q * A * d * cos(th); disp.y += A * sin(th);
          }
          // swash: each set of the main swell runs up the beach and drains back
          vec2 d0 = uWaveDir; float k0 = 6.2832 / WV[0].y, om0 = sqrt(9.81 * k0);
          float run = pow(0.5 + 0.5 * sin(k0 * dot(d0, wp.xz) - om0 * uTime - 1.2), 2.5);
          float shore = smoothstep(-1.4, -0.1, aDepth) * (1.0 - smoothstep(0.6, 2.8, aDepth));
          disp.y += shore * run * (0.12 + 0.16 * uWave) * aSea;
        }
        vLift = disp.y;
        wp.xyz += disp;
        vWPos = wp.xyz;
        vReflUv = uReflMat * vec4(wp.x, wp.y - disp.y, wp.z, 1.0);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uRain, uLight, uWave, uWind, uReflOn, uRippleOn; uniform sampler2D tNormal, tRefl, tRipple;
      uniform vec3 uSunDir, uSunColor, uSkyZenith, uSkyHorizon, uShallow, uDeep; uniform vec2 uWaveDir; uniform vec4 uRipple;
      varying vec3 vWPos; varying float vDepth; varying float vSea; varying float vLift; varying vec2 vFlow; varying vec4 vReflUv; varying vec2 vBase;
      ${GLSL_WAVES}
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      vec2 rot(vec2 d, float a){ float c = cos(a), s = sin(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }
      vec3 tn(vec2 uv){ return texture2D(tNormal, uv).rgb * 2.0 - 1.0; }
      void main(){
        vec2 p = vBase;
        float depthEff = vDepth + vLift;
        // ---- surface normal (as slopes dh/dx, dh/dz)
        vec2 sl = vec2(0.0); float crest = 0.0, mainPh = 0.0;
        // sea: analytic slopes of all the swell components
        if (vSea > 0.001) {
          float amp = (0.25 + uWave * 0.75) * vSea;
          for (int i = 0; i < NW; i++) {
            vec3 w = WV[i]; vec2 d = rot(uWaveDir, w.x); float k = 6.2832 / w.y, om = sqrt(9.81 * k);
            float A = min(w.z / k * amp, max(0.0, vDepth) * 0.16);
            float th = k * dot(d, p) - om * uTime + float(i) * 1.7;
            sl += d * (k * A * cos(th)); crest += sin(th) * w.z * 8.0;
            if (i == 0) mainPh = th;
          }
        }
        // still water: wind ripples at three scales, stronger in wind and rain
        float rough = 0.35 + uWind * 0.9 + uRain * 0.8;
        vec3 n1 = tn(p * 0.045 + vec2(uTime * 0.011, uTime * 0.007));
        vec3 n2 = tn(p * 0.13 + vec2(-uTime * 0.016, uTime * 0.012));
        vec3 n3 = tn(p * 0.37 + vec2(uTime * 0.03, -uTime * 0.025));
        vec2 still = (n1.xy * 0.5 + n2.xy * 0.45 + n3.xy * (0.25 + uRain * 0.6)) * rough;
        // running water: the same detail carried downstream (two-phase flow map)
        float sp = length(vFlow);
        vec2 detail = still;
        float streak = 0.0;
        if (sp > 0.02) {
          float T = 3.0, j = h21(floor(p * 0.25)) * 0.0;
          float c0 = fract(uTime / T), c1 = fract(uTime / T + 0.5), wgt = abs(c0 - 0.5) * 2.0;
          vec2 o0 = vFlow * c0 * T, o1 = vFlow * c1 * T;
          vec3 a1 = tn((p - o0) * 0.16), a2 = tn((p - o0) * 0.42 + 0.3);
          vec3 b1 = tn((p - o1) * 0.16 + 0.5), b2 = tn((p - o1) * 0.42 + 0.8);
          vec2 run = mix(a1.xy * 0.6 + a2.xy * 0.5, b1.xy * 0.6 + b2.xy * 0.5, wgt) * (0.7 + sp * 0.9);
          detail = mix(still, run, smoothstep(0.05, 0.35, sp));
          // foam and bubbles drifting with the current, gathering near the banks and in fast water
          float fa = texture2D(tNormal, (p - o0) * vec2(0.6, 0.6) + 0.13).b, fb = texture2D(tNormal, (p - o1) * vec2(0.6, 0.6) + 0.61).b;
          streak = smoothstep(0.62, 0.9, mix(fa, fb, wgt)) * (smoothstep(0.4, 1.4, sp) * 0.7 + (1.0 - smoothstep(0.1, 0.7, vDepth)) * 0.6);
        }
        sl += detail * mix(0.09, 0.05, vSea);
        sl += (n3.xy * 0.03 + n2.xy * 0.03) * vSea * uWave;
        // live ripples from the solver (feet, bobbers, fish, frogs, rain)
        float ripH = 0.0;
        if (uRippleOn > 0.5) {
          vec2 ru = (p - uRipple.xy) / uRipple.z;
          if (ru.x > 0.0 && ru.y > 0.0 && ru.x < 1.0 && ru.y < 1.0) {
            float e = uRipple.w;
            float hl = texture2D(tRipple, ru - vec2(e, 0.0)).r, hr = texture2D(tRipple, ru + vec2(e, 0.0)).r;
            float hd = texture2D(tRipple, ru - vec2(0.0, e)).r, hu = texture2D(tRipple, ru + vec2(0.0, e)).r;
            vec2 bd = min(ru, 1.0 - ru); float fade = smoothstep(0.0, 0.08, min(bd.x, bd.y));
            sl += vec2(hr - hl, hu - hd) * 4.5 * fade;
            ripH = texture2D(tRipple, ru).r * fade;
          }
        }
        vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, n); R.y = abs(R.y);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
        // the world mirrored in the water (falls back to the sky colour)
        vec3 refl = sky;
        if (uReflOn > 0.5) {
          vec2 ruv = vReflUv.xy / vReflUv.w + n.xz * (0.035 + vSea * 0.04) * vec2(1.0, 1.0);
          refl = texture2D(tRefl, clamp(ruv, vec2(0.001), vec2(0.999))).rgb;
        }
        float sd = max(dot(R, normalize(uSunDir)), 0.0);
        vec3 spec = uSunColor * (pow(sd, 900.0) * 9.0 + pow(sd, 90.0) * 0.35 + pow(sd, 12.0) * 0.04 * vSea) * step(0.0, uSunDir.y);
        float dT = smoothstep(0.0, 4.5, vDepth);
        vec3 body = mix(uShallow, uDeep, dT) * uLight;
        // the sea: clear turquoise over sand in the shallows, deep blue offshore
        vec3 seaShallow = vec3(0.1, 0.34, 0.33), seaDeep = vec3(0.012, 0.06, 0.1);
        body = mix(body, mix(seaShallow, seaDeep, smoothstep(0.0, 9.0, vDepth)) * uLight, vSea);
        // light scattering through wave crests (the sea glows green-blue where it's thin)
        body += vec3(0.04, 0.16, 0.14) * uLight * vSea * smoothstep(0.2, 1.4, crest) * smoothstep(0.5, 3.0, vDepth);
        body += uSkyHorizon * 0.06 * (1.0 - dT);
        vec3 col = mix(body, refl, clamp(fres * (uReflOn > 0.5 ? 1.0 : 0.9), 0.0, 1.0)) + spec;
        // ---- foam
        float foamN = texture2D(tNormal, p * 0.7 + vec2(uTime * 0.02, 0.0)).b * 0.5 + 0.5 * (n2.x * 0.5 + 0.5);
        float fmAll = 0.0;
        float foam = (1.0 - smoothstep(0.0, 0.25, depthEff)) * smoothstep(0.35, 0.8, foamN) * (1.0 - vSea);
        foam += streak * 0.8;
        col = mix(col, vec3(0.8, 0.82, 0.8) * uLight, clamp(foam, 0.0, 1.0) * 0.4); fmAll = clamp(foam, 0.0, 1.0) * 0.4;
        if (vSea > 0.01) {
          // breaking surf rolling in, the lacy edge of each wash up the sand, and whitecaps in a blow
          // white water rides the crests of the main swell as it breaks in the shallows, with a
          // trail of spent foam behind each breaker
          float ph = mainPh + n1.x * 0.8;
          float surf = (smoothstep(0.6, 0.98, sin(ph)) + 0.55 * smoothstep(0.2, 0.9, sin(ph - 0.9)) * smoothstep(0.0, 0.6, cos(ph - 2.2)))
                       * smoothstep(0.05, 0.5, vDepth) * (1.0 - smoothstep(0.8, 3.0 + uWave * 1.5, vDepth));
          float edge = (1.0 - smoothstep(0.0, 0.14 + 0.1 * uWave, depthEff)) * smoothstep(-0.05, 0.02, depthEff);
          float lace = smoothstep(0.45, 0.8, texture2D(tNormal, p * 0.35 + vec2(0.0, uTime * 0.02)).b * 0.7 + texture2D(tNormal, p * 1.3).g * 0.3 + n2.y * 0.3);
          float caps = smoothstep(0.75, 1.25, crest + n2.y * 0.6) * smoothstep(0.7, 1.6, uWave);
          float fm = clamp((surf * (0.5 + 0.4 * uWave)) * smoothstep(0.3, 0.75, foamN + 0.15) + edge * lace * 1.2 + caps * 0.8, 0.0, 1.0) * vSea;
          col = mix(col, vec3(0.9, 0.92, 0.92) * (0.35 + 0.65 * uLight), fm * 0.85); fmAll = max(fmAll, fm * 0.85);
        }
        col += vec3(0.6) * uLight * clamp(-ripH * 0.0, 0.0, 0.2);
        float alpha = mix(0.32, 0.95, smoothstep(0.0, 2.4, depthEff));
        alpha = clamp(max(alpha + fres * 0.45, fmAll), 0.0, 1.0) * smoothstep(-0.02, 0.1, depthEff); // foam is opaque
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return mat;
}
