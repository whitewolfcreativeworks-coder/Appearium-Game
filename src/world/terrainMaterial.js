// Terrain material: MeshStandardMaterial extended with a splat driven by slope, biome (home → destination),
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

// layers: { home, forest, rock, shore, dest } texture names.
// opts: water, snowLine, mode ('wet'|'snow'|'dry'|'desert'), hasDest (expedition: blend home → destination
// by the per-vertex biome value), strata (banded canyon rock), tints {ground, forest, shore} for the destination.
const MODES = { none: 0, snow: 1, wet: 2, dry: 3, desert: 4 };
export function createTerrainMaterial(layers, opts = {}) {
  const L = (name, kind) => tex(`terrain/${name}_${kind}.jpg`, { srgb: kind === 'diff' });
  const T = opts.tints || {};
  const col = (v) => new THREE.Color(v ?? 0xffffff);
  const uniforms = {
    tD0: { value: L(layers.home, 'diff') }, tN0: { value: L(layers.home, 'nor') },
    tD1: { value: L(layers.forest, 'diff') }, tN1: { value: L(layers.forest, 'nor') },
    tD2: { value: L(layers.rock, 'diff') }, tN2: { value: L(layers.rock, 'nor') },
    tD3: { value: L(layers.shore, 'diff') }, tN3: { value: L(layers.shore, 'nor') },
    tD4: { value: L(layers.dest || layers.home, 'diff') }, tN4: { value: L(layers.dest || layers.home, 'nor') },
    uWater: { value: opts.water ?? 0 },
    uSnow: { value: opts.snowLine ?? 9999 },
    uMode: { value: MODES[opts.mode] ?? 0 },
    uHasDest: { value: opts.hasDest ? 1 : 0 },
    uStrata: { value: opts.strata ? 1 : 0 },
    uSnowCover: { value: 0 }, // weather-driven snowfall on everything
    uWetness: { value: 0 },   // rain darkens and glosses the ground
    uScale: { value: new THREE.Vector4(1 / 3.2, 1 / 3.6, 1 / 7.0, 1 / 4.0) }, // ground, forest, rock, shore
    uGroundTint: { value: col(T.ground) }, uForestTint: { value: col(T.forest) }, uShoreTint: { value: col(T.shore) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aEco; attribute vec3 aEco2;
varying vec3 vEco; varying vec3 vEco2; varying vec3 vWPos; varying vec3 vWNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vEco = aEco; vEco2 = aEco2;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tD0, tD1, tD2, tD3, tD4, tN0, tN1, tN2, tN3, tN4;
uniform float uWater, uSnow, uMode, uHasDest, uStrata, uSnowCover, uWetness; uniform vec4 uScale; uniform vec3 uGroundTint, uForestTint, uShoreTint;
varying vec3 vEco; varying vec3 vEco2; varying vec3 vWPos; varying vec3 vWNormal;
${NOISE_GLSL}
float wF, wR, wS, wD, wX, wWet, bio; vec2 uvG, uvF, uvS; vec3 triW; vec2 rUv;`)
      .replace('#include <map_fragment>', `
vec3 Nw = normalize(vWNormal);
vec2 wp = vWPos.xz;
float n1 = tFbm(wp * 0.11);
float macro = tFbm(wp * 0.012);
float slope = 1.0 - Nw.y;
bio = uHasDest > 0.5 ? vEco2.x : 0.0;   // 0 = home woods (and the village itself), 1 = destination land
float beach = vEco2.y, cliff = vEco2.z;
uvG = wp * uScale.x; uvF = wp * uScale.y; uvS = wp * uScale.w;
mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
float at = 0.45 * smoothstep(0.3, 0.7, macro);
// ground: home ground and destination ground (anti-tiling: second rotated larger-scale sample)
vec3 cH = mix(texture2D(tD0, uvG).rgb, texture2D(tD0, rot * uvG * 0.31).rgb, at);
vec3 cD = mix(texture2D(tD4, uvG).rgb, texture2D(tD4, rot * uvG * 0.31).rgb, at) * uGroundTint;
vec3 cF = mix(texture2D(tD1, uvF).rgb, texture2D(tD1, rot * uvF * 0.37).rgb, 0.4 * smoothstep(0.35, 0.65, n1)) * mix(vec3(1.0), uForestTint, bio);
triW = pow(abs(Nw), vec3(4.0)); triW /= (triW.x + triW.y + triW.z);
vec3 cR = texture2D(tD2, vWPos.zy * uScale.z).rgb * triW.x + texture2D(tD2, wp * uScale.z).rgb * triW.y + texture2D(tD2, vWPos.xy * uScale.z).rgb * triW.z;
rUv = triW.y > max(triW.x, triW.z) ? wp * uScale.z : (triW.x > triW.z ? vWPos.zy * uScale.z : vWPos.xy * uScale.z);
// layered sandstone: colour bands by height, slightly wavy
if (uStrata > 0.5) {
  float yb = vWPos.y * 0.36 + tFbm(wp * 0.02) * 2.4;
  float band = fract(yb), id = floor(yb);
  vec3 b1 = vec3(1.18, 0.78, 0.56), b2 = vec3(1.05, 0.93, 0.78), b3 = vec3(0.86, 0.52, 0.38), b4 = vec3(1.2, 1.02, 0.82);
  float hsh = tHash(vec2(id, 3.7));
  vec3 bc = hsh < 0.3 ? b1 : hsh < 0.55 ? b2 : hsh < 0.8 ? b3 : b4;
  cR = mix(cR, cR * bc * 1.05, bio) * (0.9 + 0.12 * smoothstep(0.0, 0.08, band) * smoothstep(1.0, 0.9, band));
}
// home rock is the grey stone around the village
cR = mix(vec3(lum(cR)) * vec3(0.98, 0.98, 0.95), cR, smoothstep(0.0, 0.6, bio));
vec3 cS = texture2D(tD3, uvS).rgb * mix(vec3(1.0), uShoreTint, bio);
// near home the river banks are dark wet earth rather than the destination's sand
cS = mix(mix(cH * vec3(0.72, 0.66, 0.56), cS, 0.35), cS, smoothstep(0.1, 0.7, bio));
float above = vWPos.y - uWater;
// destination ground replaces home ground across the transition, with a ragged edge
wD = uHasDest > 0.5 ? smoothstep(0.35, 0.65, bio + (n1 - 0.5) * 0.5 + (macro - 0.5) * 0.4) : 0.0;
wF = smoothstep(0.28, 0.72, vEco.y + (n1 - 0.5) * 0.45);
wR = smoothstep(0.24, 0.42, slope + (n1 - 0.5) * 0.12);
wR = max(wR, cliff * smoothstep(0.08, 0.2, slope + (n1 - 0.5) * 0.1));
wS = 1.0 - smoothstep(0.35, 1.7, above + (n1 - 0.5) * 0.9);
wS = max(wS, vEco.z * (1.0 - smoothstep(0.5, 2.6, above)));
wS = max(wS, smoothstep(0.2, 0.7, beach + (n1 - 0.5) * 0.35) * (1.0 - wR));
// home: patches of bare leaf litter where the soil is dry
float bare = smoothstep(0.42, 0.18, vEco.x + (n1 - 0.5) * 0.3) * (1.0 - wD);
vec3 col = mix(cH, cD, wD);
col = mix(col, cF * vec3(1.02, 0.95, 0.85), hblend(bare * 0.8, lum(col), lum(cF)));
col = mix(col, cF, hblend(wF, lum(col), lum(cF)));
// destination character
float dm = wD * (1.0 - wS);
wX = 0.0;
if (uMode > 0.5 && uMode < 1.5) { // snow on high flat ground
  wX = smoothstep(uSnow - 6.0, uSnow + 5.0, vWPos.y + (n1 - 0.5) * 16.0) * (1.0 - smoothstep(0.42, 0.62, slope)) * bio;
} else if (uMode > 1.5 && uMode < 2.5) { // wet: moss in damp hollows
  float moss = smoothstep(0.6, 0.85, vEco.x + (n1 - 0.5) * 0.3) * dm;
  col = mix(col, col * vec3(0.62, 0.86, 0.42), moss * 0.7);
} else if (uMode > 2.5 && uMode < 3.5) { // dry: straw-coloured grassland
  float dry = smoothstep(0.5, 0.25, vEco.x + (n1 - 0.5) * 0.3) * dm;
  col = mix(col, vec3(lum(col)) * vec3(1.35, 1.12, 0.72), dry * 0.55);
}
col = mix(col, cS, hblend(wS, lum(col), lum(cS)));
col = mix(col, cR, hblend(wR, lum(col), lum(cR)));
// snow: by altitude (snow mode) and from falling snow (weather)
float snowAll = clamp(uSnowCover * (1.0 - smoothstep(0.35, 0.7, slope)) * smoothstep(0.2, 1.2, above) * (0.75 + 0.5 * n1), 0.0, 1.0);
wX = max(wX, snowAll);
vec3 snowC = vec3(0.93, 0.95, 1.0) * (0.92 + 0.08 * tNoise(wp * 3.0));
col = mix(col, snowC, smoothstep(0.0, 1.0, wX + (n1 - 0.5) * 0.3 * wX));
wWet = (1.0 - smoothstep(0.0, 0.9, above)) * (1.0 - wR);
wWet = max(wWet, uWetness * 0.4 * (1.0 - wX));
col *= mix(1.0, 0.62, wWet);
col *= (0.86 + 0.28 * macro);
diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.42, wWet);
roughnessFactor = mix(roughnessFactor, 0.78, wR * 0.6);
roughnessFactor = mix(roughnessFactor, 0.6, wX);`)
      .replace('#include <normal_fragment_maps>', `
{
  vec3 nH = texture2D(tN0, uvG).xyz * 2.0 - 1.0;
  vec3 nD = texture2D(tN4, uvG).xyz * 2.0 - 1.0;
  vec3 nF = texture2D(tN1, uvF).xyz * 2.0 - 1.0;
  vec3 nR = texture2D(tN2, rUv).xyz * 2.0 - 1.0;
  vec3 nS = texture2D(tN3, uvS).xyz * 2.0 - 1.0;
  vec3 tn = mix(nH, nD, wD);
  tn = mix(tn, nF, wF); tn = mix(tn, nS, wS); tn = mix(tn, nR, wR); tn = mix(tn, vec3(0.0, 0.0, 1.0), wX * 0.7);
  tn.xy *= 0.9;
  vec3 Nn = normalize(vWNormal);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - Nn * Nn.x);
  vec3 B = cross(T, Nn);
  vec3 wn = normalize(T * tn.x + B * tn.y + Nn * max(tn.z, 0.15));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v2';
  return mat;
}
