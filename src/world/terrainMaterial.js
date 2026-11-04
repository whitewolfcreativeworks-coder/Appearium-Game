// Terrain material: MeshStandardMaterial extended with a 5-layer splat driven by slope,
// height above water, snow line and the per-vertex ecology attribute (moisture, forest, river).
import * as THREE from 'three';
import { tex } from '../core/assets.js';

const NOISE_GLSL = /* glsl */`
float tHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float tNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(tHash(i),tHash(i+vec2(1,0)),f.x), mix(tHash(i+vec2(0,1)),tHash(i+vec2(1,1)),f.x), f.y); }
float tFbm(vec2 p){ return tNoise(p)*0.55 + tNoise(p*2.13+7.1)*0.3 + tNoise(p*4.7-3.3)*0.15; }
float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
float hblend(float w, float hA, float hB){ // height-aware blend sharpening
  float t = clamp(w + (hB - hA) * 0.9 * w * (1.0 - w) * 4.0, 0.0, 1.0);
  return smoothstep(0.0, 1.0, t);
}
`;

export function createTerrainMaterial(layers, opts = {}) {
  const L = (name, kind) => tex(`terrain/${name}_${kind}.jpg`, { srgb: kind === 'diff' });
  const uniforms = {
    tD0: { value: L(layers.grass, 'diff') }, tN0: { value: L(layers.grass, 'nor') },
    tD1: { value: L(layers.forest, 'diff') }, tN1: { value: L(layers.forest, 'nor') },
    tD2: { value: L(layers.rock, 'diff') }, tN2: { value: L(layers.rock, 'nor') },
    tD3: { value: L(layers.shore, 'diff') }, tN3: { value: L(layers.shore, 'nor') },
    tD4: { value: L(layers.extra || layers.forest, 'diff') }, tN4: { value: L(layers.extra || layers.forest, 'nor') },
    uWater: { value: opts.water ?? 0 },
    uSnow: { value: opts.snowLine ?? 9999 },
    uExtraMode: { value: opts.extraMode ?? 0 }, // 0 none, 1 snow by height, 2 wet (moisture), 3 dry (low moisture)
    uScale: { value: new THREE.Vector4(1 / 3.2, 1 / 3.6, 1 / 7.0, 1 / 4.0) }, // grass, forest, rock, shore
    uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) },
    uGrassTint: { value: new THREE.Color(opts.grassTint ?? 0xffffff) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aEco;
varying vec3 vEco; varying vec3 vWPos; varying vec3 vWNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vEco = aEco;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tD0, tD1, tD2, tD3, tD4, tN0, tN1, tN2, tN3, tN4;
uniform float uWater, uSnow, uExtraMode; uniform vec4 uScale; uniform vec3 uTint, uGrassTint;
varying vec3 vEco; varying vec3 vWPos; varying vec3 vWNormal;
${NOISE_GLSL}
float wF, wR, wS, wX, wWet; vec2 uvG, uvF, uvS; vec3 triW; vec2 rUv;`)
      .replace('#include <map_fragment>', `
vec3 Nw = normalize(vWNormal);
vec2 wp = vWPos.xz;
float n1 = tFbm(wp * 0.11);
float macro = tFbm(wp * 0.012);
float slope = 1.0 - Nw.y;
uvG = wp * uScale.x; uvF = wp * uScale.y; uvS = wp * uScale.w;
// anti-tiling: second, rotated & larger-scale sample blended by macro noise
mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
vec3 cG = mix(texture2D(tD0, uvG).rgb, texture2D(tD0, rot * uvG * 0.31).rgb, 0.45 * smoothstep(0.3, 0.7, macro)) * uGrassTint;
vec3 cF = mix(texture2D(tD1, uvF).rgb, texture2D(tD1, rot * uvF * 0.37).rgb, 0.4 * smoothstep(0.35, 0.65, n1));
// rock: tri-planar (cliffs)
triW = pow(abs(Nw), vec3(4.0)); triW /= (triW.x + triW.y + triW.z);
vec3 cR = texture2D(tD2, vWPos.zy * uScale.z).rgb * triW.x + texture2D(tD2, wp * uScale.z).rgb * triW.y + texture2D(tD2, vWPos.xy * uScale.z).rgb * triW.z;
rUv = triW.y > max(triW.x, triW.z) ? wp * uScale.z : (triW.x > triW.z ? vWPos.zy * uScale.z : vWPos.xy * uScale.z);
vec3 cS = texture2D(tD3, uvS).rgb;
vec3 cX = texture2D(tD4, uExtraMode > 0.5 && uExtraMode < 1.5 ? wp * 0.18 : uvF * 0.9).rgb;
float above = vWPos.y - uWater;
wF = smoothstep(0.28, 0.72, vEco.y + (n1 - 0.5) * 0.45);
wR = smoothstep(0.24, 0.42, slope + (n1 - 0.5) * 0.12);
wS = 1.0 - smoothstep(0.35, 1.7, above + (n1 - 0.5) * 0.9);
wS = max(wS, vEco.z * (1.0 - smoothstep(0.5, 2.6, above)));
wX = 0.0;
if (uExtraMode > 0.5 && uExtraMode < 1.5) wX = smoothstep(uSnow - 6.0, uSnow + 5.0, vWPos.y + (n1 - 0.5) * 16.0) * (1.0 - smoothstep(0.42, 0.62, slope));
else if (uExtraMode > 1.5 && uExtraMode < 2.5) wX = smoothstep(0.62, 0.86, vEco.x + (n1 - 0.5) * 0.3) * (1.0 - wS * 0.5);
else if (uExtraMode > 2.5) wX = smoothstep(0.42, 0.18, vEco.x + (n1 - 0.5) * 0.3);
vec3 col = cG;
col = mix(col, cF, hblend(wF, lum(col), lum(cF)));
col = mix(col, cX, hblend(wX, lum(col), lum(cX)));
col = mix(col, cS, hblend(wS, lum(col), lum(cS)));
col = mix(col, cR, hblend(wR, lum(col), lum(cR)));
if (uExtraMode > 0.5 && uExtraMode < 1.5) col = mix(col, cX, hblend(wX * 0.85 * smoothstep(0.0, 0.3, wR), lum(col), lum(cX)) * wR);
wWet = (1.0 - smoothstep(0.0, 0.9, above)) * (1.0 - wR);
col *= mix(1.0, 0.62, wWet);
col *= (0.86 + 0.28 * macro) * uTint;
diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.42, wWet);
roughnessFactor = mix(roughnessFactor, 0.78, wR * 0.6);`)
      .replace('#include <normal_fragment_maps>', `
{
  vec3 nG = texture2D(tN0, uvG).xyz * 2.0 - 1.0;
  vec3 nF = texture2D(tN1, uvF).xyz * 2.0 - 1.0;
  vec3 nR = texture2D(tN2, rUv).xyz * 2.0 - 1.0;
  vec3 nS = texture2D(tN3, uvS).xyz * 2.0 - 1.0;
  vec3 nX = texture2D(tN4, uExtraMode > 0.5 && uExtraMode < 1.5 ? vWPos.xz * 0.18 : uvF * 0.9).xyz * 2.0 - 1.0;
  vec3 tn = nG;
  tn = mix(tn, nF, wF); tn = mix(tn, nX, wX); tn = mix(tn, nS, wS); tn = mix(tn, nR, wR);
  tn.xy *= 0.9;
  vec3 Nn = normalize(vWNormal);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - Nn * Nn.x);
  vec3 B = cross(T, Nn);
  vec3 wn = normalize(T * tn.x + B * tn.y + Nn * max(tn.z, 0.15));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v1';
  return mat;
}
