// Water: per-chunk patches carrying a depth attribute (water level − terrain height) so the
// shader can do shoreline foam, depth tint and transparency without a depth pre-pass.
import * as THREE from 'three';
import { tex } from '../core/assets.js';

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
  }]);
  uniforms.tNormal.value = tex('waternormals.jpg', { srgb: false });
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute float aDepth;
      varying vec3 vWPos; varying float vDepth;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz; vDepth = aDepth;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uRain, uLight; uniform sampler2D tNormal;
      uniform vec3 uSunDir, uSunColor, uSkyZenith, uSkyHorizon, uShallow, uDeep;
      varying vec3 vWPos; varying float vDepth;
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      void main(){
        vec2 p = vWPos.xz;
        vec3 n1 = texture2D(tNormal, p * 0.045 + vec2(uTime * 0.011, uTime * 0.007)).rgb * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormal, p * 0.13 + vec2(-uTime * 0.016, uTime * 0.012)).rgb * 2.0 - 1.0;
        vec3 n3 = texture2D(tNormal, p * 0.37 + vec2(uTime * 0.03, -uTime * 0.025)).rgb * 2.0 - 1.0;
        vec3 nn = n1 + n2 * 0.7 + n3 * (0.35 + uRain * 0.8);
        vec3 n = normalize(vec3(nn.x, 3.2, nn.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
        float sd = max(dot(R, normalize(uSunDir)), 0.0);
        vec3 spec = uSunColor * (pow(sd, 600.0) * 6.0 + pow(sd, 60.0) * 0.25) * step(0.0, uSunDir.y);
        float dT = smoothstep(0.0, 4.5, vDepth);
        vec3 body = mix(uShallow, uDeep, dT) * uLight;
        // light scattering through shallow water picks up some sky colour
        body += uSkyHorizon * 0.06 * (1.0 - dT);
        vec3 col = mix(body, sky, fres * 0.9) + spec;
        float foamN = h21(floor(p * 9.0) + floor(uTime * 2.0)) * 0.5 + 0.5 * (n2.x * 0.5 + 0.5);
        float foam = (1.0 - smoothstep(0.0, 0.28, vDepth)) * smoothstep(0.35, 0.8, foamN);
        col = mix(col, vec3(0.78, 0.8, 0.78) * uLight, foam * 0.35);
        float alpha = mix(0.35, 0.94, smoothstep(0.0, 2.4, vDepth));
        alpha = clamp(alpha + fres * 0.4, 0.0, 1.0) * smoothstep(-0.02, 0.12, vDepth);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return mat;
}
