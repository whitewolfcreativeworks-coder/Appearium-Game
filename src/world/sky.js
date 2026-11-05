// Atmosphere: physically based sky (three.js Sky / Preetham model), sun & moon lights with
// player-following shadows, image-based lighting regenerated from the sky, a procedural cloud
// dome, stars, fog and rain.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, smoothstep, lerp } from '../core/rng.js';

const DEG = Math.PI / 180;

export const WEATHER = {
  clear:    { turbidity: 2.6, rayleigh: 1.4, clouds: 0.25, fog: 0.0035, rain: 0, snow: 0, light: 1.0, wind: 0.8, waves: 0.45, storm: 0 },
  hazy:     { turbidity: 7, rayleigh: 1.8, clouds: 0.35, fog: 0.0065, rain: 0, snow: 0, light: 0.92, wind: 0.6, waves: 0.35, storm: 0 },
  mist:     { turbidity: 9, rayleigh: 2.0, clouds: 0.5, fog: 0.016, rain: 0, snow: 0, light: 0.75, wind: 0.35, waves: 0.3, storm: 0 },
  overcast: { turbidity: 10, rayleigh: 2.2, clouds: 0.85, fog: 0.0075, rain: 0, snow: 0, light: 0.6, wind: 1.1, waves: 0.7, storm: 0 },
  rain:     { turbidity: 12, rayleigh: 2.4, clouds: 0.95, fog: 0.011, rain: 1, snow: 0, light: 0.48, wind: 1.5, waves: 0.9, storm: 0 },
  windy:    { turbidity: 4, rayleigh: 1.6, clouds: 0.55, fog: 0.005, rain: 0, snow: 0, light: 0.9, wind: 2.1, waves: 1.3, storm: 0 },
  storm:    { turbidity: 14, rayleigh: 2.6, clouds: 1.0, fog: 0.014, rain: 1.6, snow: 0, light: 0.32, wind: 2.6, waves: 1.9, storm: 1 },
  snow:     { turbidity: 10, rayleigh: 2.2, clouds: 0.92, fog: 0.012, rain: 0, snow: 1, light: 0.62, wind: 0.9, waves: 0.6, storm: 0 },
};

export class SkySystem {
  constructor(renderer, scene, quality) {
    this.renderer = renderer; this.scene = scene; this.q = quality;
    this.time = 9.5; this.weatherName = 'clear'; this.w = { ...WEATHER.clear }; this.wTarget = { ...WEATHER.clear };
    this.sky = new Sky(); this.sky.scale.setScalar(3400); this.sky.frustumCulled = false;
    scene.add(this.sky);
    // Image-based lighting is captured from a bounded gradient sky (the Preetham sky's sun disc
    // overflows half-float render targets and would poison PBR materials with NaNs).
    this.skyScene = new THREE.Scene();
    this.envUniforms = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() } };
    this.skyEnvMesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: this.envUniforms,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uZen, uHor, uGnd, uSun, uSunCol; varying vec3 vD;
        void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHor, uZen, pow(y, 0.6)) : mix(uHor, uGnd, pow(-y, 0.4));
          float s = max(dot(vD, normalize(uSun)), 0.0); c += uSunCol * (pow(s, 32.0) * 3.0 + pow(s, 4.0) * 0.35);
          gl_FragColor = vec4(min(c, vec3(8.0)), 1.0); }`,
    }));
    this.skyScene.add(this.skyEnvMesh);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null; this.lastEnvTime = -99; this.lastEnvWeather = '';

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows > 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(quality.shadows, quality.shadows);
      const S = quality.shadowRange;
      Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 400 });
      this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    }
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4030, 0.35); scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0xaabbcc, 0.004); scene.fog = this.fog;
    this.sunDir = new THREE.Vector3();
    this.buildClouds(); this.buildStars(); this.buildRain();
    this.horizon = new THREE.Color(); this.zenith = new THREE.Color();
  }

  // rate: how fast the sky eases towards the new weather (per second)
  setWeather(name, instant = false, rate = 0.3) {
    if (!WEATHER[name]) name = 'clear';
    this.weatherName = name; this.wTarget = { ...WEATHER[name] }; this.wRate = rate;
    if (instant) this.w = { ...this.wTarget };
  }

  buildClouds() {
    const g = new THREE.SphereGeometry(3000, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.cloudMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCover: { value: 0.4 }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uNight: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uCover, uNight; uniform vec3 uSunDir, uSunCol, uShade; varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          if (vDir.y < 0.0) discard;
          vec2 uv = vDir.xz / (vDir.y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
          float d = fbm(uv);
          float c = smoothstep(1.0 - uCover - 0.1, 1.0 - uCover + 0.35, d);
          float d2 = fbm(uv + uSunDir.xz * 0.06);
          float lit = clamp(0.55 + (d - d2) * 3.0, 0.0, 1.0);
          vec3 col = mix(uShade, uSunCol, lit);
          float horizon = smoothstep(0.0, 0.18, vDir.y);
          float a = c * horizon * (0.9 - uNight * 0.3);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.clouds = new THREE.Mesh(g, this.cloudMat); this.clouds.renderOrder = -1; this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
  }

  buildStars() {
    const N = 1800, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random(), v = Math.random() * 0.95;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      p[i * 3] = Math.sin(ph) * Math.cos(th) * 2900; p[i * 3 + 1] = Math.cos(ph) * 2900; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 2900;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(g, this.starMat); this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildRain() {
    const N = this.q.rainDrops, p = new Float32Array(N * 6);
    this.rainSeed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.rainSeed[i * 3] = Math.random() * 40 - 20; this.rainSeed[i * 3 + 1] = Math.random() * 20; this.rainSeed[i * 3 + 2] = Math.random() * 40 - 20; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(g, this.rainMat); this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  // sun direction for a time of day
  computeSun(t) {
    const dayT = (t - 6) / 12; // 0 sunrise, 1 sunset
    const elev = Math.sin(dayT * Math.PI) * 58 * DEG - 4 * DEG;
    const az = (-90 + dayT * 180) * DEG; // east -> south -> west
    // +x east, +z south: sun rises in the east, crosses the southern sky, sets in the west
    this.sunDir.set(-Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev) * 0.85 + 0.15).normalize();
    return elev;
  }

  update(dt, camera, focus) {
    // ease weather
    const k = 1 - Math.exp(-dt * (this.wRate ?? 0.3));
    for (const key of Object.keys(this.w)) this.w[key] = lerp(this.w[key], this.wTarget[key], k);
    const w = this.w;
    // lightning in a storm: a flicker of flashes, then thunder a few seconds later (sound by distance)
    this.flash = Math.max(0, (this.flash || 0) - dt * 5);
    if (w.storm > 0.6 && Math.random() < dt * 0.06 * w.storm) {
      this.flash = 1; const dist = 300 + Math.random() * 2500;
      this.onLightning && this.onLightning(dist);
      this.flashT = [0.08, 0.2 + Math.random() * 0.2];
    }
    if (this.flashT) { this.flashT[0] -= dt; this.flashT[1] -= dt; if (this.flashT[0] < 0 && this.flashT[0] > -dt * 1.5) this.flash = 0.7; if (this.flashT[1] < 0) { this.flash = Math.max(this.flash, 0.5); this.flashT = null; } }
    const elev = this.computeSun(this.time);
    const day = smoothstep(-0.12, 0.12, Math.sin(elev));
    const golden = smoothstep(0.45, 0.05, Math.sin(elev)) * day;
    this.dayFactor = day; this.golden = golden;

    const u = this.sky.material.uniforms;
    u.turbidity.value = w.turbidity; u.rayleigh.value = w.rayleigh * (0.6 + 0.4 * day);
    u.mieCoefficient.value = 0.004 + golden * 0.004; u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(this.sunDir);
    this.sky.position.copy(camera.position);
    this.clouds.position.copy(camera.position); this.stars.position.copy(camera.position);

    // lights
    const sunCol = new THREE.Color().setRGB(1, lerp(0.93, 0.62, golden), lerp(0.85, 0.38, golden));
    const sunI = day * 3.1 * w.light * (1 - w.clouds * 0.55);
    const moonI = (1 - day) * 0.42;
    if (day > 0.02) { this.sun.color.copy(sunCol); this.sun.intensity = sunI; this.sun.position.copy(this.sunDir); }
    else { this.sun.color.setRGB(0.55, 0.65, 0.9); this.sun.intensity = moonI; this.sun.position.set(-this.sunDir.x, Math.abs(this.sunDir.y) + 0.4, -this.sunDir.z).normalize(); }
    const lightDir = this.sun.position.clone();
    const S = this.q.shadowRange, texel = (2 * S) / Math.max(1, this.q.shadows);
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.copy(lightDir).multiplyScalar(160).add(this.sun.target.position);
    this.hemi.intensity = (0.22 + 0.36 * day) * (0.85 + w.clouds * 0.4) + this.flash * 2.5;
    this.hemi.color.setRGB(lerp(0.25, 0.72, day), lerp(0.3, 0.8, day), lerp(0.45, 0.95, day));
    this.hemi.groundColor.setRGB(lerp(0.05, 0.3, day), lerp(0.05, 0.27, day), lerp(0.06, 0.2, day));

    // horizon / zenith colours (approximate the sky shader for fog, water and clouds)
    const dayH = new THREE.Color(0.66, 0.74, 0.82), goldH = new THREE.Color(0.86, 0.66, 0.48), nightH = new THREE.Color(0.03, 0.045, 0.07), grey = new THREE.Color(0.58, 0.6, 0.62);
    this.horizon.copy(nightH).lerp(dayH, day).lerp(goldH, golden * 0.75).lerp(grey.clone().multiplyScalar(0.25 + 0.75 * day), w.clouds * 0.75);
    this.zenith.setRGB(lerp(0.01, 0.22, day), lerp(0.015, 0.4, day), lerp(0.03, 0.72, day)).lerp(grey.clone().multiplyScalar(0.25 + 0.6 * day), w.clouds * 0.7);
    if (this.flash > 0) { this.horizon.lerp(new THREE.Color(0.75, 0.78, 0.9), this.flash * 0.6); this.zenith.lerp(new THREE.Color(0.6, 0.62, 0.8), this.flash * 0.5); }
    this.fog.color.copy(this.horizon);
    this.fog.density = w.fog * this.q.fogScale;

    this.cloudMat.uniforms.uCover.value = w.clouds;
    this.cloudMat.uniforms.uTime.value += dt;
    this.cloudMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.cloudMat.uniforms.uSunCol.value.copy(sunCol).multiplyScalar(0.15 + 0.95 * day * w.light).lerp(this.horizon, golden * 0.3);
    this.cloudMat.uniforms.uShade.value.copy(this.horizon).multiplyScalar(0.55 + 0.2 * day);
    this.cloudMat.uniforms.uNight.value = 1 - day;
    this.starMat.opacity = (1 - smoothstep(0.0, 0.25, day)) * (1 - w.clouds * 0.9);
    this.renderer.toneMappingExposure = lerp(1.35, 0.64, day) * (1 + this.flash * 0.8);
    // ground: wet in rain, white in lasting snow
    this.wetness = clamp((this.wetness || 0) + dt * (w.rain > 0.3 ? 0.02 : -0.004), 0, 1);
    this.snowCover = clamp((this.snowCover || 0) + dt * (w.snow > 0.5 ? 0.006 : -0.003), 0, 1);

    // rain
    const snowing = w.snow > w.rain;
    const precip = Math.max(w.rain, w.snow);
    this.rainMat.opacity = snowing ? Math.min(0.9, w.snow * 0.85) : Math.min(0.6, w.rain * 0.45);
    this.rainMat.color.setRGB(snowing ? 0.95 : 0.67, snowing ? 0.96 : 0.71, snowing ? 1 : 0.75);
    this.rain.visible = precip > 0.02;
    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position.array, s = this.rainSeed, n = s.length / 3;
      const cp = camera.position, fall = snowing ? 1.4 : 14, slant = (w.wind - 0.6) * (snowing ? 0.9 : 0.35);
      const len = snowing ? 0.06 : 0.45, t = this.cloudMat.uniforms.uTime.value;
      const active = Math.floor(n * Math.min(1, precip));
      for (let i = 0; i < n; i++) {
        if (i >= active) { a[i * 6 + 1] = a[i * 6 + 4] = -9999; continue; }
        s[i * 3 + 1] -= dt * fall; if (s[i * 3 + 1] < -2) { s[i * 3 + 1] += 22; s[i * 3] = Math.random() * 40 - 20; s[i * 3 + 2] = Math.random() * 40 - 20; }
        let x = cp.x + s[i * 3] + slant * s[i * 3 + 1], y = cp.y + s[i * 3 + 1] - 4, z = cp.z + s[i * 3 + 2];
        if (snowing) { x += Math.sin(t * 0.9 + i) * 0.4; z += Math.cos(t * 0.7 + i * 1.3) * 0.4; }
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x + 0.03 + slant * len * 0.5 + (snowing ? 0.04 : 0); a[i * 6 + 4] = y - len; a[i * 6 + 5] = z + 0.02;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // image based lighting from the sky, refreshed occasionally
    const needEnv = Math.abs(this.time - this.lastEnvTime) > 0.35 || this.lastEnvWeather !== this.weatherName;
    if (needEnv) this.refreshEnv();
    this.scene.environmentIntensity = (0.35 + 0.65 * day) * (1 - w.clouds * 0.35);
  }

  refreshEnv() {
    const e = this.envUniforms, day = this.dayFactor ?? 1;
    e.uZen.value.copy(this.zenith).multiplyScalar(1.6); e.uHor.value.copy(this.horizon).multiplyScalar(1.3);
    e.uGnd.value.setRGB(0.16, 0.14, 0.1).multiplyScalar(0.25 + 0.75 * day);
    e.uSun.value.copy(day > 0.02 ? this.sunDir : this.sun.position.clone().normalize());
    e.uSunCol.value.copy(this.sun.color).multiplyScalar(day * (1 - this.w.clouds * 0.7) + 0.05);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.skyScene, 0, 1, 1000);
    this.scene.environment = this.envRT.texture;
    this.lastEnvTime = this.time; this.lastEnvWeather = this.weatherName;
  }

  applyToWater(mat) {
    const u = mat.uniforms;
    u.uSunDir.value.copy(this.dayFactor > 0.02 ? this.sunDir : this.sun.position.clone().normalize());
    u.uSunColor.value.copy(this.sun.color).multiplyScalar(Math.min(1.4, this.sun.intensity / 2.5));
    u.uSkyZenith.value.copy(this.zenith); u.uSkyHorizon.value.copy(this.horizon);
    u.uRain.value = Math.min(1, this.w.rain); u.uLight.value = 0.25 + 0.75 * this.dayFactor * this.w.light + (this.flash || 0) * 0.5;
    u.uWave.value = this.w.waves;
    u.fogColor.value.copy(this.fog.color); u.fogDensity.value = this.fog.density;
  }
}
