// Appearium — entry point and game orchestration.
// Loop: Village → New wilderness → Explore → Gather & discover → Return home → Preserve → New expedition.
import * as THREE from 'three';
import { setAnisotropy, setProgressHandler, preloadTextures, loadModel } from './core/assets.js';
import { PoolManager } from './world/pools.js';
import { defineKinds, windUniforms, KIND_INFO } from './world/vegetation.js';
import { createWaterMaterial, seaSurface } from './world/water.js';
import { SkySystem } from './world/sky.js';
import { loadProps } from './world/structures.js';
import { BuildMode } from './game/buildmode.js';
import { Village } from './world/village.js';
import { Wilderness } from './world/wilderness.js';
import { generateExpedition, SCENARIOS } from './world/scenarios.js';
import { Input, Player } from './game/player.js';
import { Fishing } from './game/fishing.js';
import { ITEMS, CATS, RECIPES } from './game/items.js';
import { loadSave, writeSave, resetSave } from './game/save.js';
import { SoundScape } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Body, CONDITIONS } from './game/body.js';
import { PostFX } from './world/postfx.js';
import { Ripples, Reflection } from './world/waterfx.js';
import { itemInfo, parseKey, know, CATS as ICATS, recognised, speciesOf, catOf } from './game/inventory.js';
import { interactForage, forageLabel, eatRaw, herbalist } from './game/foraging.js';
import { openCooking } from './game/cooking.js';
import { setTrap, checkTrap, lessonPanel, trapsPanelHtml } from './game/traps.js';
import { MUSHROOMS, PLANTS, FISH, ANIMALS, TRAPS, BAIT, STATUS, SAFETY_NOTE } from './data/species.js';
import { viewer } from './game/specimen.js';

const QUALITY = {
  low: { pixelRatio: 1, chunkRadius: 2, shadows: 1024, shadowRange: 38, grassRadius: 18, grassDensity: 1.5, grassBlades: 12, capacity: { trees: { near: 2000, far: 3000 }, grass: 2200, small: 1200 }, rainDrops: 350, fogScale: 1.5, streamBudget: 4, antialias: false },
  medium: { pixelRatio: 1.25, chunkRadius: 3, shadows: 1536, shadowRange: 50, grassRadius: 24, grassDensity: 2.3, grassBlades: 16, capacity: { trees: { near: 2600, far: 5000 }, grass: 4800, small: 2200 }, rainDrops: 650, fogScale: 1.15, streamBudget: 5, antialias: false },
  high: { pixelRatio: 2, chunkRadius: 4, shadows: 2048, shadowRange: 68, grassRadius: 34, grassDensity: 3.0, grassBlades: 22, capacity: { trees: { near: 3200, far: 7000 }, grass: 11000, small: 3200 }, rainDrops: 1100, fogScale: 0.95, streamBudget: 6, antialias: true },
};

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// species grouped by the lands they belong to (for the field guide)
const REGION_TITLES = { temperate: 'Woods, meadows & rivers', coast: 'The coast', canyon: 'Canyon country', tropics: 'The tropics' };
function byRegion(list) {
  const out = [];
  for (const r of Object.keys(REGION_TITLES)) {
    const items = Object.entries(list).filter(([, sp]) => (sp.regions || ['temperate'])[0] === r);
    items.forEach(([id, sp], i) => out.push([id, sp, i === 0 ? REGION_TITLES[r] : null]));
  }
  return out;
}

// weather drifts towards what is typical for the land, one step at a time
function weatherShift(exp, cur) {
  const W = exp.weathers || [[exp.weather, 1]];
  const NEAR = { clear: ['hazy', 'windy', 'overcast'], hazy: ['clear', 'overcast', 'mist'], mist: ['hazy', 'overcast', 'rain'], overcast: ['rain', 'clear', 'windy', 'mist', 'snow'], rain: ['overcast', 'storm', 'mist'], windy: ['clear', 'overcast', 'storm'], storm: ['rain', 'windy', 'overcast'], snow: ['overcast', 'clear'] };
  const opts = W.filter(([n]) => n === cur || (NEAR[cur] || []).includes(n));
  let tot = 0; for (const [, w] of opts) tot += w; let r = Math.random() * tot;
  for (const [n, w] of opts) { r -= w; if (r <= 0) return n; }
  return cur;
}

class Game {
  constructor() {
    this.save = loadSave();
    const params = new URLSearchParams(location.search);
    this.qualityName = params.get('quality') || this.save.settings.quality || (isTouch ? 'medium' : 'high');
    this.quality = { ...QUALITY[this.qualityName] };
    this.quality.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
    this.debug = params.has('debug');
    this.forceScenario = params.get('scenario');
    this.params = params;
    this.state = 'loading';
    this.pack = { items: {}, artifacts: [] };
    this.traps = [];
    this.clock = new THREE.Clock();
    this.fps = 60;
    this.gameTime = 0;
  }

  async init() {
    const canvas = $('c');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      $('loadtext').textContent = 'WebGL 2 is not available in this browser.'; throw e;
    }
    this.renderer = renderer;
    renderer.setPixelRatio(this.quality.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = this.quality.shadows > 0;
    renderer.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 3600);
    this.scene.add(this.camera);
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });

    this.ui = new UI(this);
    this.input = new Input(canvas, this.save.settings);
    this.player = new Player(this.camera);
    this.body = new Body(this); this.player.body = this.body;
    this.body.restore(this.save.body);
    this.audio = new SoundScape(); this.audio.vol = this.save.settings.volume;
    this.player.onStep = (k, wet) => { this.audio.step(k, wet ? 'water' : this.surface()); if (wet) this.ripples?.drop(this.player.pos.x + (Math.random() - 0.5) * 0.4, this.player.pos.z + (Math.random() - 0.5) * 0.4, 0.55, 0.25 * k); };
    this.pools = new PoolManager(this.scene);
    this.waterMat = createWaterMaterial();
    this.sky = new SkySystem(renderer, this.scene, this.quality);
    this.sky.onLightning = (d) => this.audio?.thunder?.(d);
    this.postfx = new PostFX(renderer, this.quality.antialias ? 4 : 0);
    // live ripples and mirror reflections on the water (scaled down on slower devices)
    const wq = { low: [false, 0], medium: [true, 0.38], high: [true, 0.5] }[this.qualityName] || [true, 0.4];
    this.ripples = new Ripples(renderer, { enabled: wq[0] && !this.params.has('noripples') });
    const rs = this.save.settings.reflections; // low quality: off unless switched on in settings
    this.reflection = new Reflection(renderer, { scale: this.params.has('norefl') || rs === false ? 0 : wq[1] || (rs === true ? 0.3 : 0) });
    this.lantern = new THREE.PointLight(0xffc88a, 0, 18, 1.6); this.lantern.position.set(0.25, -0.3, -0.3); this.camera.add(this.lantern);

    setProgressHandler((d, t) => { $('loadfill').style.width = `${Math.round((d / Math.max(t, 1)) * 100)}%`; });
    const T = [];
    for (const n of ['leafy_grass', 'sparse_grass', 'aerial_grass_rock', 'forest_ground_04', 'brown_mud_leaves_01', 'forrest_ground_01', 'aerial_rocks_02', 'rock_face', 'rocky_terrain_02', 'coast_sand_rocks_02', 'mud_forest', 'snow_02', 'gravel_floor', 'dry_riverbed_rock', 'forest_leaves_04', 'forest_floor', 'cliff_side', 'aerial_rocks_04', 'grass_path_2', 'forest_leaves_03', 'aerial_ground_rock', 'coast_land_rocks_01', 'rock_wall_08'])
      for (const k of ['diff', 'nor']) T.push({ path: `terrain/${n}_${k}.jpg`, opts: { srgb: k === 'diff' } });
    for (const n of ['weathered_planks', 'rough_wood', 'thatch_roof_angled', 'roof_tiles_14', 'plastered_stone_wall', 'castle_brick_07', 'cobblestone_floor_08', 'wood_planks_grey', 'stone_wall', 'bark_brown_02', 'pine_bark'])
      for (const k of ['diff', 'nor']) T.push({ path: `build/${n}_${k}.jpg`, opts: { srgb: k === 'diff' } });
    T.push({ path: 'foliage/conifer_branch.png', opts: { repeat: false } }, { path: 'foliage/leaf_cluster.png', opts: { repeat: false } }, { path: 'waternormals.jpg', opts: { srgb: false } });
    $('loadtext').textContent = 'Gathering textures…';
    await preloadTextures(T);
    $('loadtext').textContent = 'Growing the forest…';
    await defineKinds(this.pools, this.quality);
    await loadProps();
    await loadModel('fox');
    this.fishing = new Fishing(this);
    this.bindUI();
    $('loadtext').textContent = '';
    $('loadbar').classList.add('hidden');
    $('title-buttons').classList.remove('hidden');
    $('btn-start').textContent = this.save.expeditionCount > 0 || this.save.artifacts.length ? 'Continue' : 'Begin';
    document.querySelectorAll('.quality-row button').forEach((b) => b.classList.toggle('on', b.dataset.q === this.qualityName));
    this.state = 'title';
    // render a backdrop of the village behind the title
    await this.enterVillage({ silent: true });
    this.loop();
    if (this.debug) window.game = this;
    window.__appearium = this; // handy for automated tests
  }

  bindUI() {
    $('btn-start').onclick = () => this.start();
    document.querySelectorAll('.quality-row button').forEach((b) => b.onclick = () => {
      this.save.settings.quality = b.dataset.q; writeSave(this.save); location.reload();
    });
    $('btn-home').onclick = () => this.confirmReturnHome();
    $('btn-pack').onclick = () => this.openPack();
    $('btn-build').onclick = () => this.buildMode.open();
    this.buildMode = new BuildMode(this);
    $('btn-journal').onclick = () => this.openJournal();
    $('btn-menu').onclick = () => this.openMenu();
    $('btn-light').onclick = () => this.toggleLantern();
    $('btn-jump').onpointerdown = (e) => { e.preventDefault(); this.input.pressed.add('Space'); };
    // Run: tap to toggle a steady run; hold to set off on auto-run (steer by looking)
    // Dive (hold) while swimming; the ⤒ button swims up while held
    const db = $('btn-dive'), jb = $('btn-jump');
    db.onpointerdown = (e) => { e.preventDefault(); this.input.touchDive = true; }; db.onpointerup = db.onpointerleave = db.onpointercancel = () => { this.input.touchDive = false; };
    jb.addEventListener('pointerdown', () => { this.input.touchUp = true; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) jb.addEventListener(ev, () => { this.input.touchUp = false; });
    this.player.onSwimStart = () => { this.audio.splash(0.8); const q = this.player.pos; this.ripples?.drop(q.x, q.z, 1.0, 0.6); if (!this.save.flags?.swam) { (this.save.flags = this.save.flags || {}).swam = true; this.ui.toast(isTouch ? 'Swimming. Hold <b>Dive</b> to go under, ⤒ to come up — watch your breath.' : 'Swimming. Hold <b>C</b> to dive (swim where you look), Space to come up — watch your breath.', true); } };
    // floating on the swell: the same waves as the water shader
    this.player.swell = (x, z) => { const w = this.world, u = this.waterMat.uniforms; if (!w || w.gen.p.kind !== 'coast') return 0; const sea = w.gen.seaAt(x, z); return seaSurface(x, z, u.uTime.value, u.uWave.value, u.uWaveDir.value.x, u.uWaveDir.value.y, sea, w.depthAt(x, z)); };
    this.player.onStroke = (under, fast) => { if (under) this.audio.bubbles?.(); else { this.audio.stroke?.(fast); const q = this.player.pos; this.ripples?.drop(q.x, q.z, 0.7, fast ? 0.18 : 0.1); } };
    const rb = $('btn-run');
    rb.onpointerdown = (e) => { e.preventDefault(); clearTimeout(this.runHold); this.runHeld = false; this.runHold = setTimeout(() => { this.runHeld = true; this.setRun(true, true); }, 550); };
    rb.onpointerup = (e) => { e.preventDefault(); clearTimeout(this.runHold); if (!this.runHeld) this.setRun(!(this.input.runMode || this.input.autoRun), false); };
    rb.onpointerleave = () => clearTimeout(this.runHold);
    $('btn-interact').onpointerdown = (e) => { e.preventDefault(); this.interact(); };
    this.input.dom.addEventListener('mousedown', (e) => { if (this.input.locked && e.button === 0 && !this.fishing.active) { if (this.buildMode.active) this.buildMode.commit(); else this.interact(); } });
  }

  start() {
    this.audio.init();
    $('title').classList.add('gone');
    setTimeout(() => $('title').classList.add('hidden'), 1100);
    $('hud').classList.remove('hidden');
    this.state = 'play';
    if (this.save.pendingPack) {
      const p = this.save.pendingPack; const n = this.storePack(p);
      this.save.pendingPack = null; writeSave(this.save);
      if (n) this.ui.toast(`You wake at home. Your pack from the last journey made it back — ${n} things stored.`, true);
      this.world.buildDynamic?.();
    }
    if (!this.save.tutorial.welcome) {
      this.save.tutorial.welcome = true; writeSave(this.save);
      setTimeout(() => this.ui.toast('Welcome home. Your village keeps everything you bring back.', true), 600);
      setTimeout(() => this.ui.toast('When you are ready, walk out through the <b>North Gate</b>.'), 4200);
    }
  }

  // ------------------------------------------------------------------ world transitions
  async loadWorld(world, spawn) {
    this.buildMode?.stop();
    if (this.world) this.world.dispose();
    this.traps = [];
    this.world = world;
    await world.build();
    const sp = spawn || world.spawn;
    world.stream(new THREE.Vector3(sp.x, 0, sp.z), true);
    this.pools.flush();
    this.player.place(sp.x, sp.z, sp.yaw, world);
    this.sky.refreshEnv();
    // compile shaders up front to avoid hitches
    try { this.renderer.compile(this.scene, this.camera); } catch (_) { /* optional */ }
  }

  async enterVillage({ silent = false, fromExpedition = false } = {}) {
    if (!silent) await this.ui.fade(true, fromExpedition ? { kicker: 'Homeward', title: 'The Village', sub: 'The land behind you fades like a dream. What you carried is yours to keep.' } : null);
    this.expedition = null;
    const v = new Village(this);
    const spawn = fromExpedition ? { x: 0, z: -v.R + 6, yaw: Math.PI } : v.spawn;
    await this.loadWorld(v, spawn);
    // home weather: whatever you walked back in with slowly settles; a fresh start is fair
    const homeW = Math.random() < 0.7 ? 'clear' : Math.random() < 0.6 ? 'hazy' : 'overcast';
    if (fromExpedition) this.sky.setWeather(this.sky.weatherName === 'storm' ? 'overcast' : homeW, false, 0.02);
    else { this.sky.setWeather(homeW, true); this.sky.time = this.save.time; }
    this.ui.region('Home', `Your village · ${this.save.expeditionCount} expedition${this.save.expeditionCount === 1 ? '' : 's'} so far`);
    $('btn-home').classList.add('hidden');
    $('btn-build').classList.remove('hidden');
    $('packmeter').classList.add('hidden');
    $('btn-light').classList.toggle('hidden', !this.save.upgrades.lantern);
    this.lantern.intensity = 0;
    await this.ui.fade(false);
  }

  onGateReached() {
    if (this.ui.panelOpen || this.state !== 'play' || this.transitioning) return;
    this.openGate();
  }

  openGate() {
    const n = this.save.expeditionCount + 1;
    this.ui.showPanel(`<button class="close" data-act="close">Not yet</button><h2>Expedition ${n}</h2>
      <div class="sub">Beyond the North Gate lies land no one has walked before — it will exist only for this journey.
      Gather what you can; whatever you carry home will be kept forever. You can return home at any time.</div>
      <div class="kv">Rod <b>${this.save.upgrades.rod >= 2 ? 'sturdy' : 'simple'}</b> · Snares <b>${this.save.tools.snare || 0}</b>${this.save.upgrades.lantern ? ' · Lantern' : ''}</div>
      <div class="actions"><button class="btn ghost" data-act="close">Stay home</button><button class="btn primary" data-act="go">Set out</button></div>`,
    (act) => { if (act === 'go') { this.ui.closePanel(); this.startExpedition(); } });
  }

  async startExpedition() {
    if (this.transitioning) return; this.transitioning = true;
    try {
      this.save.expeditionCount++;
      const no = this.save.expeditionCount;
      const seed = (Math.random() * 2 ** 31) | 0;
      const exp = generateExpedition(no, seed, this.save.lastScenario, this.forceScenario);
      this.save.lastScenario = exp.scenario;
      this.expedition = exp; exp.discovered = []; exp.started = Date.now();
      this.pack = { items: {}, artifacts: [] };
      writeSave(this.save);
      await this.ui.fade(true, { kicker: `Expedition ${no}`, title: 'The road north', sub: `Beyond the village woods, the road leads somewhere new: ${exp.title.toLowerCase().replace(/^the /, 'the ')}.`, rumor: exp.rumor });
      const w = new Wilderness(this, exp);
      await this.loadWorld(w);
      // same hour, same sky as when you left the gate; the new land's weather rolls in as you walk
      this.sky.setWeather(exp.weather, false, 0.008);
      exp.arrived = false; this.weatherClock = 0;
      this.ui.region('The road north', `Expedition ${no} · the village is behind you`);
      $('btn-home').classList.remove('hidden');
      $('btn-build').classList.add('hidden');
      $('packmeter').classList.remove('hidden');
      this.updatePackMeter();
      await new Promise((r) => setTimeout(r, 1200));
      await this.ui.fade(false);
      if (!this.save.tutorial.firstExpedition) {
        this.save.tutorial.firstExpedition = true; writeSave(this.save);
        setTimeout(() => this.ui.toast('Look for fallen wood, mushrooms, berries and greens. Examine what you find closely — some are deadly lookalikes.', true), 800);
        setTimeout(() => this.ui.toast('Face open water to fish. Look for worn animal runs to set traps. Your handbook is in the Journal.'), 5200);
      }
    } finally { this.transitioning = false; }
  }

  confirmReturnHome(atGate = false) {
    if (!this.expedition || this.transitioning || this.ui.panelOpen) return;
    const n = this.packCount(), a = this.pack.artifacts.length, traps = this.traps.length;
    this.ui.showPanel(`<button class="close" data-act="close">Stay</button><h2>${atGate ? 'Back at the North Gate' : 'Return home?'}</h2>
      <div class="sub">${this.ui.esc(this.expedition.name)} will be lost once you leave — no one will ever walk it again.</div>
      <div class="kv">You carry <b>${n}</b> item${n === 1 ? '' : 's'}${a ? ` and <b>${a}</b> artifact${a === 1 ? '' : 's'}` : ''}.${traps ? ` <br><span style="color:var(--bad)">${traps} snare${traps > 1 ? 's are' : ' is'} still set and will be left behind.</span>` : ''}</div>
      <div class="actions"><button class="btn ghost" data-act="close">Keep exploring</button><button class="btn primary" data-act="home">⌂ Return home</button></div>`,
    (act) => { if (act === 'home') { this.ui.closePanel(); this.returnHome(); } });
  }

  async returnHome() {
    if (this.transitioning) return; this.transitioning = true;
    try {
      this.fishing.cancel();
      const exp = this.expedition;
      const brought = { ...this.pack.items };
      const arts = this.pack.artifacts.map((a) => a.name);
      this.storePack(this.pack);
      this.save.journal.expeditions.push({ no: exp.no, name: exp.name, scenario: exp.title, date: new Date().toISOString(), brought, artifacts: arts, places: exp.discovered, weather: exp.weather, minutes: Math.round((Date.now() - exp.started) / 60000) });
      this.save.pendingPack = null;
      this.pack = { items: {}, artifacts: [] };
      this.traps = [];
      writeSave(this.save);
      await this.enterVillage({ fromExpedition: true });
      if (this.body.conds.some((c) => c.type === 'envenomed')) { this.body.conds = this.body.conds.filter((c) => c.type !== 'envenomed'); setTimeout(() => this.ui.toast('Maren cleans and dresses the snakebite, and gives you something for the pain. You made it home in time.', true), 900); }
      const parts = Object.entries(brought).map(([k, v]) => `${v} ${itemInfo(k).name.toLowerCase()}`);
      if (parts.length || arts.length) setTimeout(() => this.ui.toast(`Brought home: ${[...parts, ...arts].slice(0, 6).join(', ')}${parts.length + arts.length > 6 ? '…' : ''}`, true), 400);
      if (arts.length) setTimeout(() => this.ui.toast('Your new discoveries are on display in the <b>Hall of Discoveries</b>.'), 3800);
      if (!this.save.tutorial.build && Object.keys(this.save.store).some((k) => ['shell', 'driftwood', 'sandstone', 'frond', 'sea_glass'].includes(k) || (this.save.store.wood || 0) >= 6)) { this.save.tutorial.build = true; setTimeout(() => this.ui.toast('You can build your own house and decorate it with what you bring home — tap <b>Build</b> (or press B).', true), 10500); }
      if (Object.keys(brought).some((k) => k.startsWith('f:'))) setTimeout(() => this.ui.toast('Take your foraged finds to <b>Maren the herbalist</b> — she will check your identifications.'), 7000);
    } finally { this.transitioning = false; }
  }

  storePack(p) {
    let n = 0;
    for (const [k, v] of Object.entries(p.items || {})) { this.save.store[k] = (this.save.store[k] || 0) + v; n += v; }
    for (const a of p.artifacts || []) { this.save.artifacts.push(a); n++; }
    return n;
  }

  // ------------------------------------------------------------------ pack
  packCount() {
    const half = this.save.upgrades.basket;
    let n = 0; for (const [k, v] of Object.entries(this.pack.items)) n += (half && (k.startsWith('f:') || k.startsWith('v:'))) ? v * 0.5 : v;
    return Math.ceil(n) + this.pack.artifacts.length * 2;
  }
  updatePackMeter() { this.ui.pack(this.packCount()); }
  addToPack(item, qty, partial = false) {
    const per = this.save.upgrades.basket && (item.startsWith('f:') || item.startsWith('v:')) ? 0.5 : 1;
    const room = Infinity; // carry as much as you like
    if (room <= 0 || (!partial && room < qty)) return 0;
    const n = Math.min(qty, room);
    this.pack.items[item] = (this.pack.items[item] || 0) + n;
    this.updatePackMeter(); this.persist();
    return n;
  }
  persist() {
    if (this.expedition) this.save.pendingPack = this.pack;
    this.save.time = this.sky.time;
    this.save.body = this.body.serialize();
    clearTimeout(this.persistT); this.persistT = setTimeout(() => writeSave(this.save), 400);
  }

  // ------------------------------------------------------------------ interactions
  surface() {
    if (!this.world) return 'grass';
    if (this.world.kind === 'village' && Math.hypot(this.player.pos.x, this.player.pos.z) < 7.2) return 'stone';
    const s = this.world.gen.sample(this.player.pos.x, this.player.pos.z);
    if (this.world.gen.roadInfo?.(this.player.pos.x, this.player.pos.z)?.d < 1.6) return 'stone';
    if (s.beach > 0.5 || (this.expedition?.region === 'canyon' && s.biome > 0.5 && s.forest < 0.3)) return 'sand';
    if (s.cliff > 0.5) return 'stone';
    return s.forest > 0.5 ? 'forest' : 'grass';
  }

  findInteraction() {
    if (this.buildMode?.active) return null;
    if (!this.world || this.ui.panelOpen || this.fishing.active || this.transitioning) return null;
    const p = this.player.pos, f = this.player.forward(new THREE.Vector3());
    let best = null, bestScore = Infinity;
    const consider = (i) => {
      const dx = i.pos.x - p.x, dz = i.pos.z - p.z, d = Math.hypot(dx, dz);
      const r = (i.radius || 1.8);
      if (d > r + 0.6) return;
      if (Math.abs(i.pos.y - (p.y + 1)) > 3.2) return;
      const dot = d < 0.01 ? 1 : (dx * f.x + dz * f.z) / d;
      if (dot < 0.15 && d > 1.4) return;
      const score = d * (1.6 - dot);
      if (score < bestScore) { bestScore = score; best = i; }
    };
    for (const i of this.world.interactablesNear(p, 4)) consider(i);
    for (const t of this.traps) consider(t);
    if (best) return best;
    // wildlife observation
    if (this.world.wildlife) {
      const nf = this.world.wildlife.nearestFox(p, 24);
      if (nf) {
        const dx = nf.fox.pos.x - p.x, dz = nf.fox.pos.z - p.z, d = Math.hypot(dx, dz);
        const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
        const dir = new THREE.Vector3(dx, nf.fox.pos.y + 0.3 - this.camera.position.y, dz).normalize();
        if (look.dot(dir) > 0.93) return { type: 'observe', fox: nf.fox, label: `Observe the red fox (${Math.round(d)} m) — keep still` };
      }
    }
    if (this.world.fauna) {
      const cr = this.world.fauna.nearestCrab(p, 1.8);
      if (cr) return { type: 'crab', crab: cr, pos: cr.pos, label: 'Catch the crab (from behind!)' };
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
      const ob = this.world.fauna.observable(p, look, this.camera.position);
      if (ob) { const A = ANIMALS[ob.kind]; return { type: 'observe', herd: ob, label: `Observe the ${A.name.toLowerCase()} (${Math.round(ob.dist)} m)${A.danger ? ' — keep your distance' : ' — keep still'}` }; }
    }
    if (this.world.sea) {
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
      const ob = this.world.sea.observable(p, look, this.camera.position);
      if (ob) return { type: 'observe', herd: ob, label: `Observe the ${ANIMALS[ob.kind].name.toLowerCase()} (${Math.round(ob.dist)} m) — keep it in sight, head for shallow water` };
    }
    if (this.world.beasts) {
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
      const ob = this.world.beasts.observable(p, look, this.camera.position);
      if (ob) { const A = ANIMALS[ob.kind]; return { type: 'observe', herd: ob, label: `Observe the ${A.name.toLowerCase()}${['wolf', 'coyote', 'elk', 'capybara', 'coati', 'bighorn', 'mountain_goat', 'wild_boar'].includes(ob.kind) ? 's' : ''} (${Math.round(ob.dist)} m)${A.danger ? ' — keep your distance' : ' — keep still'}`.replace('wolfs', 'wolves').replace('elks', 'elk').replace('bighorn sheeps', 'bighorn sheep').replace('wild boars', 'wild boar').replace('(wapiti)s', '(wapiti)') }; }
    }
    if (this.world.herds) {
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
      const ob = this.world.herds.observable(p, look, this.camera.position);
      if (ob) return { type: 'observe', herd: ob, label: `Observe the ${ANIMALS[ob.kind].name.toLowerCase()}${ob.kind === 'horse' ? 's' : ''} (${Math.round(ob.dist)} m) — keep still` };
    }
    if (this.world.ambience) {
      const look = new THREE.Vector3(); this.camera.getWorldDirection(look);
      for (const h of this.world.ambience.hares) {
        const dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz); if (d > 30 || h.state === 'flee') continue;
        const dir = new THREE.Vector3(dx, h.pos.y + 0.2 - this.camera.position.y, dz).normalize();
        if (look.dot(dir) > 0.94) return { type: 'observe', hare: h, label: `Observe the hare (${Math.round(d)} m) — keep still` };
      }
    }
    const spot = this.fishing.findSpot(this.player, this.world);
    if (spot) return { type: 'fish', spot, label: `Fish here (${{ riffle: 'riffle', pool: 'deep pool', weeds: 'reed bed', lilies: 'lily pads', deep: 'deep water', shore: 'shallows', surf: 'surf', rocks: 'off the rocks' }[spot.spot] || 'open water'})` };
    return null;
  }

  interact() {
    const i = this.current; if (!i) return;
    const w = this.world;
    switch (i.type) {
      case 'gather': {
        const got = this.addToPack(i.item, i.qty, true);
        if (!got) { this.ui.toast('Your pack is full. Return home to store what you carry.'); return; }
        let bonusTxt = '';
        if (i.bonus) for (const [k, v] of Object.entries(i.bonus)) { const b = this.addToPack(k, v, true); if (b) bonusTxt += `, +${b} ${ITEMS[k].name.toLowerCase()}`; }
        if (i.bonusChance?.grub && Math.random() < i.bonusChance.grub[0]) { const g = 1 + Math.floor(Math.random() * 3); this.save.bait.grub = (this.save.bait.grub || 0) + g; bonusTxt += `, +${g} grubs (bait)`; }
        w.removeGatherable(i);
        this.audio.pickup();
        this.ui.toast(`+${got} ${ITEMS[i.item].name}${bonusTxt}`);
        this.current = null; break;
      }
      case 'artifact': {
        const a = i.artifact;
        this.ui.showPanel(`<div class="k" style="color:var(--accent);letter-spacing:.16em;font-size:12px;text-transform:uppercase">Discovery</div><h2>${this.ui.esc(a.name)}</h2>
          <div class="sub" style="font-style:italic">${this.ui.esc(a.story)}</div><div class="kv">Once home, it can go in the Hall of Discoveries — or in your own house.</div>
          <div class="actions"><button class="btn ghost" data-act="close">Leave it</button><button class="btn primary" data-act="take">Take it home</button></div>`,
        (act) => {
          if (act !== 'take') return;
          this.pack.artifacts.push(a); w.removeGatherable(i); this.updatePackMeter(); this.persist();
          this.ui.closePanel(); this.audio.discover(); this.ui.toast(`Taken: <b>${this.ui.esc(a.name)}</b>`, true);
        });
        break;
      }
      case 'trade': this.openTrade(i); break;
      case 'gate': this.openGate(); break;
      case 'store': this.openStore(); break;
      case 'craft': this.openWorkshop(); break;
      case 'rest': this.openRest(); break;
      case 'journal': this.openJournal(); break;
      case 'hall': this.openHall(); break;
      case 'artifact-view': this.showArtifactCard(i.artifact); break;
      case 'well': this.audio.splash(0.4); this.ui.toast('The well water is cold and clear.'); break;
      case 'camp': this.openCamp(); break;
      case 'signpost': this.ui.toast(`The fingerpost reads <b>${this.ui.esc(this.expedition.place)}</b> to the north, and <b>Home</b> back the way you came.`); break;
      case 'trap': checkTrap(this, i); break;
      case 'crab': {
        if (Math.random() < 0.6) { this.world.fauna.removeCrab(i.crab); this.addToPack('crab', 1); know(this.save, 'shore_crab').seen++; this.ui.toast('Got it — pinched from behind, claws waving harmlessly. (Cook it before eating.)'); }
        else { i.crab.state = 'flee'; i.crab.timer = 3; i.crab.dir = Math.random() * 6.28; this.ui.toast('It darts sideways under the weed. Too slow!'); }
        break;
      }
      case 'observe': this.observing = i.fox ? { fox: i.fox, t: 0 } : i.herd ? { herd: i.herd, t: 0 } : { hare: i.hare, t: 0 }; break;
      case 'fish': this.fishing.prepare(i.spot); break;
      case 'forage': interactForage(this, i); break;
      case 'tracks': this.examineTracks(i); break;
      case 'herbalist': herbalist(this); break;
      case 'hearth': openCooking(this, 'hearth'); break;
    }
  }

  showArtifactCard(a) {
    const o = a.origin, d = new Date(o.date);
    this.showCard(`<div class="k">Hall of Discoveries</div><div class="n">${this.ui.esc(a.name)}</div><div class="s">${this.ui.esc(a.story)}</div>
      <div class="o">Expedition ${o.expedition} · ${this.ui.esc(o.region)} (${this.ui.esc(o.scenario)})<br>${d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} — that land is gone now.</div>`, 6000);
  }
  showCard(html, ms) { this.ui.card(html, ms); }

  examineTracks(i) {
    const A = ANIMALS[i.species]; const k = know(this.save, i.species); const first = !k.seen; k.seen++;
    this.showCard(`<div class="k">Tracks${first ? ' — new' : ''}</div><div class="n">${this.ui.esc(A.name)}</div><div class="s">${this.ui.esc(A.track)}</div><div class="o">${i.species === 'hare' ? 'A well-used hare run — a good place for a snare.' : this.ui.esc(A.facts)}</div>`, 6000);
    this.persist();
  }
  onAnimalSeen(id) { const k = know(this.save, id); k.seen++; }
  clockNow() { return this.gameTime; }

  digWorms() {
    const p = this.player.pos, w = this.world;
    if (!this.expedition) return;
    const s = w.gen.sample(p.x, p.z);
    if (w.depthAt(p.x, p.z) > -0.15) { this.ui.toast('Too wet here — step up onto the bank.'); return; }
    if (s.moist < 0.45 && this.sky.weatherName !== 'rain') { this.ui.toast('The soil here is dry and hard. Worms live in damp, rich soil — try near water or in the woods.'); return; }
    const n = 2 + Math.floor(Math.random() * 3) + (this.sky.weatherName === 'rain' ? 2 : 0);
    this.save.bait.worm = (this.save.bait.worm || 0) + n;
    this.sky.time = (this.sky.time + 0.15) % 24;
    this.audio.dig?.();
    this.ui.toast(`You turn over the soil with a stick: <b>+${n} earthworms</b>${this.sky.weatherName === 'rain' ? ' — the rain brings them up' : ''}.`);
    this.persist();
  }

  onCollapse(reason = 'poison') {
    // a deadly poisoning, a snakebite left too long or a bear: the expedition ends and you wake at home, weakened
    if (this.collapsing) return; this.collapsing = true;
    (async () => {
      this.fishing.cancel(); this.ui.closePanel();
      const inExp = !!this.expedition;
      const T = {
        poison: { kicker: 'Poisoned', title: 'Everything goes dark', sub: inExp ? 'You collapse in the wilderness. Travellers find you and carry you home. You lie in bed for days while Maren nurses you through it.' : 'You collapse at home. For days Maren nurses you through it.', rumor: 'Death cap and deadly nightshade poisonings begin hours after eating, when it is already too late to simply spit it out. Most real-world mushroom deaths are from death caps.' },
        snake: { kicker: 'Snakebite', title: 'The venom takes hold', sub: 'Your leg swells, your vision swims, and you sink down. Travellers find you and carry you home, where Maren treats the bite.', rumor: 'With a venomous bite, time matters: keep still and calm, keep the limb below the heart, take off rings, and get to medical help for antivenom. Never cut, suck, ice or tourniquet a snakebite.' },
        drown: { kicker: 'Out of breath', title: 'The water closes over you', sub: inExp ? 'Everything goes dark. You wake on the bank, coughing, pulled out by a passing traveller who carries you home.' : 'Everything goes dark. You wake on the bank, coughing.', rumor: 'Keep an eye on your breath. Come up before your lungs burn — the deeper you are, the longer the swim back up.' },
        shark: { kicker: 'Attacked', title: 'The shark strikes', sub: 'A blow like a truck, then a tearing pain. You fight it off and somehow reach the shallows. Travellers carry you home.', rumor: 'If a shark circles, keep it in sight and leave the water calmly and steadily — splashing and thrashing draw it in. If it attacks, strike at its eyes and gills.' },
        wolf: { kicker: 'Attacked', title: 'The pack is on you', sub: 'You go down under a rush of grey bodies, kicking and shouting until they break off. Travellers find you torn and shaken and carry you home.', rumor: 'One or two wolves avoid people; a big pack can be bold. Never approach them and never run. Face them, stand tall, shout, and back away steadily. If they attack, stay on your feet and fight back.' },
        mountain_lion: { kicker: 'Attacked', title: 'The lion strikes', sub: 'It hits you from behind and you go down fighting. It breaks off and is gone. Travellers find you and carry you home.', rumor: 'Mountain lions attack what runs or turns away. Face it, stand tall, make yourself big and loud, and back off slowly. If it attacks, fight back — never play dead.' },
        moose: { kicker: 'Trampled', title: 'The moose runs you down', sub: 'It knocks you flat and stamps before trotting off. Travellers find you bruised and battered and carry you home.', rumor: 'Moose give warning — ears laid back, hackles up, lip-licking. Back off at once. If it charges, run and get a tree between you; if you are knocked down, curl up and cover your head.' },
        bear: { kicker: 'Attacked', title: 'The bear is on you', sub: 'You curl up, hands over your neck. After a terrible moment it leaves. Travellers find you hurt and carry you home.', rumor: 'Most bear charges are bluffs — running turns them into a chase. Back away slowly, talking calmly. If a brown bear makes contact, lie flat and play dead; if a black bear attacks, fight back.' },
      }[reason] || {};
      await this.ui.fade(true, T);
      this.body.clearAll(); this.body.satiety = 40; this.body.stamina = 40;
      if (inExp) {
        this.pack.items = Object.fromEntries(Object.entries(this.pack.items).filter(([k]) => !k.startsWith('f:') && !k.startsWith('v:') && !FISH[k]));
        this.transitioning = false; await new Promise((r) => setTimeout(r, 3500));
        await this.returnHome();
      } else { this.sky.time = 8; const sp = this.world.spawn; if (sp) this.player.place(sp.x, sp.z, sp.yaw || 0, this.world); await new Promise((r) => setTimeout(r, 3500)); await this.ui.fade(false); }
      this.ui.toast(reason === 'poison' ? 'You survived — barely. Your spoiled food was thrown away.' : reason === 'snake' ? 'Maren treated the bite. You will mend — slowly.' : reason === 'moose' ? 'Battered and sore, but alive. Your food was lost.' : reason === 'drown' ? 'You coughed up half the lake, but you are alive. Your food was lost.' : 'Bruised and torn, but alive. Your food was lost.', true);
      this.collapsing = false;
    })();
  }

  // ------------------------------------------------------------------ panels
  itemGrid(items, empty = 'Nothing yet.', { eat = false } = {}) {
    const ents = Object.entries(items).filter(([, v]) => v > 0);
    if (!ents.length) return `<div class="sub">${empty}</div>`;
    const by = {};
    for (const [k, v] of ents) { const c = catOf(k); (by[c] = by[c] || []).push([k, v]); }
    return Object.entries(by).map(([c, list]) => `<h3>${(ICATS[c] || ICATS.material).label}</h3><div class="grid">${list.map(([k, v]) => {
      const i = itemInfo(k);
      const eatBtn = eat && i.forage ? `<button class="mini" data-act="eat" data-k="${this.ui.esc(k)}">Eat</button>` : '';
      return `<div class="item ${i.forage && !i.verified ? 'unverified' : ''}" title="${this.ui.esc(i.desc || '')}"><span><span class="sw" style="background:${(ICATS[c] || ICATS.material).color}"></span>${this.ui.esc(i.name)}</span><span class="q">${v}${eatBtn}</span></div>`;
    }).join('')}</div>`).join('');
  }

  openPack() {
    if (this.ui.panelOpen) { this.ui.closePanel(); return; }
    const inExp = !!this.expedition;
    const arts = this.pack.artifacts.map((a) => `<div class="art"><div class="n">${this.ui.esc(a.name)}</div><div class="s">${this.ui.esc(a.story)}</div></div>`).join('');
    const b = this.save.bait;
    const bait = Object.entries(BAIT).map(([id, bt]) => `<span class="pill">${bt.name}: <b>${b[id] || 0}</b></span>`).join('');
    const body = this.body;
    const html = `<button class="close" data-act="close">Close</button><h2>Pack</h2>
      <div class="sub"> ${inExp ? `${this.packCount()} things carried. Everything here is kept once you return home.` : 'You are at home. Your belongings are in the storehouse.'}</div>
      <div class="kv">Hunger <b>${body.satiety > 70 ? 'satisfied' : body.satiety > 35 ? 'peckish' : body.satiety > 15 ? 'hungry' : 'starving'}</b>${body.chips().length ? ' · ' + body.chips().map((c) => CONDITIONS[c].label).join(', ') : ''}</div>
      ${inExp ? this.itemGrid(this.pack.items, 'Your pack is empty. Look around for things to gather.', { eat: true }) : ''}
      ${arts ? `<h3>Artifacts</h3>${arts}` : ''}
      <h3>Fishing bait</h3><div class="pills">${bait}</div>
      <h3>Traps</h3>${trapsPanelHtml(this)}
      <h3>Equipment</h3><div class="kv">${this.save.upgrades.rod >= 2 ? 'Sturdy' : 'Simple'} fishing rod${this.save.upgrades.basket ? ' · forager\'s basket' : ''}${this.save.upgrades.lantern ? ' · lantern (L)' : ''}</div>
      <div class="actions">${inExp ? '<button class="btn ghost" data-act="worms">Dig for worms here</button>' : ''}<button class="btn ghost" data-act="close">Close</button></div>`;
    this.ui.showPanel(html, (act, d) => {
      if (act === 'eat') { eatRaw(this, d.k); this.ui.closePanel(); this.openPack(); }
      if (act === 'worms') { this.ui.closePanel(); this.digWorms(); }
      if (act === 'trapset') { this.ui.closePanel(); setTrap(this, d.id); }
      if (act === 'trapmake') {
        const T = TRAPS[d.id]; const need = T.needs;
        if (!Object.entries(need).every(([k, v]) => (this.pack.items[k] || 0) >= v)) { this.ui.toast(`You need ${Object.entries(need).map(([k, v]) => `${v} ${k}`).join(' and ')} in your pack.`); return; }
        for (const [k, v] of Object.entries(need)) { this.pack.items[k] -= v; if (!this.pack.items[k]) delete this.pack.items[k]; }
        this.save.tools[d.id] = (this.save.tools[d.id] || 0) + 1; this.audio.craft(); this.updatePackMeter(); this.persist();
        this.ui.toast(`You make a ${T.name.toLowerCase()}.`); this.ui.closePanel(); this.openPack();
      }
    });
  }

  openStore() {
    const s = this.save.store;
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Storehouse</h2>
      <div class="sub">Everything you have carried home. The workshop draws on these stores.</div>${this.itemGrid(s, 'The shelves are bare. Bring something home from an expedition.')}
      <h3>Discoveries</h3><div class="kv">${this.save.artifacts.length} artifact${this.save.artifacts.length === 1 ? '' : 's'} in the Hall of Discoveries.</div>`, null);
  }

  openWorkshop() {
    const s = this.save.store, u = this.save.upgrades;
    const done = (r) => !!r.upgrade && (r.upgrade[0] === 'rod' ? u.rod >= 2 : r.upgrade[0] === 'pack' ? u.pack >= 50 : !!u[r.upgrade[0]]);
    const rows = RECIPES.map((r) => {
      const can = Object.entries(r.needs).every(([k, v]) => (s[k] || 0) >= v);
      const needs = Object.entries(r.needs).map(([k, v]) => `<span class="${(s[k] || 0) >= v ? 'ok' : 'no'}">${v} ${itemInfo(k).name.toLowerCase()} (${s[k] || 0})</span>`).join(' · ');
      return `<div class="row"><div><div>${r.name}</div><div class="need">${r.desc}<br>${needs}</div></div>${done(r) ? '<span class="q" style="color:var(--good)">Done ✓</span>' : `<button class="btn" data-act="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>Make</button>`}</div>`;
    }).join('');
    const lessons = Object.entries(TRAPS).map(([id, T]) => {
      const learned = this.save.lessons[id];
      const can = Object.entries(T.needs).every(([k, v]) => (s[k] || 0) >= v);
      const needs = Object.entries(T.needs).map(([k, v]) => `<span class="${(s[k] || 0) >= v ? 'ok' : 'no'}">${v} ${itemInfo(k).name.toLowerCase()} (${s[k] || 0})</span>`).join(' · ');
      return `<div class="row"><div><div>${T.name} <span class="q">×${this.save.tools[id] || 0}</span></div><div class="need">${learned ? needs : 'Learn how it works first.'}</div></div>${learned ? `<button class="btn" data-act="maketrap" data-id="${id}" ${can ? '' : 'disabled'}>Make</button>` : `<button class="btn primary" data-act="lesson" data-id="${id}">Learn</button>`}</div>`;
    }).join('');
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Workshop</h2><div class="sub">Craft equipment and improve the village with what you have stored.</div><div class="actions" style="justify-content:flex-start"><button class="btn primary" data-act="build">Build &amp; decorate your place…</button></div>${rows}<h3>Bushcraft: traps</h3>${lessons}`, (act, d) => {
      if (act === 'build') { this.buildMode.open(); return; }
      if (act === 'lesson') { lessonPanel(this, d.id, () => {}); return; }
      if (act === 'maketrap') { const T = TRAPS[d.id]; for (const [k, v] of Object.entries(T.needs)) s[k] -= v; this.save.tools[d.id] = (this.save.tools[d.id] || 0) + 1; writeSave(this.save); this.audio.craft(); this.ui.toast(`Made: <b>${T.name}</b>`); this.openWorkshop(); return; }
      if (act !== 'craft') return;
      const r = RECIPES.find((x) => x.id === d.id);
      for (const [k, v] of Object.entries(r.needs)) s[k] -= v;
      if (r.gives) for (const [k, v] of Object.entries(r.gives)) s[k] = (s[k] || 0) + v;
      if (r.bait) for (const [k, v] of Object.entries(r.bait)) this.save.bait[k] = (this.save.bait[k] || 0) + v;
      if (r.upgrade) u[r.upgrade[0]] = r.upgrade[1];
      writeSave(this.save); this.audio.craft();
      this.ui.toast(`Made: <b>${r.name}</b>`, true);
      this.world.buildDynamic?.();
      $('btn-light').classList.toggle('hidden', !u.lantern);
      this.openWorkshop();
    });
  }

  openRest() {
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Home</h2><div class="sub">A warm hearth and a dry bed. The fire has been banked since you left.</div>
      <div class="actions"><button class="btn" data-act="cook">Cook at the hearth</button><button class="btn" data-act="morning">Sleep until morning</button><button class="btn" data-act="evening">Rest until evening</button></div>`, async (act) => {
      if (act === 'cook') { openCooking(this, 'hearth'); return; }
      this.ui.closePanel();
      await this.ui.fade(true, { title: act === 'morning' ? 'Morning' : 'Evening' });
      this.sky.time = act === 'morning' ? 7.2 : 18.3; this.sky.refreshEnv(); this.persist();
      await this.ui.fade(false);
    });
  }

  openCamp() {
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Campfire</h2><div class="sub">Your camp at the edge of ${this.ui.esc(this.expedition.name)}. ${this.ui.esc(this.expedition.rumor)}</div>
      <div class="actions"><button class="btn" data-act="cook">Cook a meal</button><button class="btn" data-act="wait">Rest an hour</button><button class="btn primary" data-act="home">⌂ Return home</button></div>`, (act) => {
      if (act === 'cook') { openCooking(this, 'camp'); return; }
      if (act === 'wait') { this.ui.closePanel(); this.sky.time = (this.sky.time + 1) % 24; this.ui.toast('You rest by the fire for an hour.'); }
      if (act === 'home') { this.ui.closePanel(); this.confirmReturnHome(); }
    });
  }

  openHall() {
    const arts = this.save.artifacts.slice().reverse();
    const list = arts.map((a) => `<div class="art"><div class="n">${this.ui.esc(a.name)}</div><div class="o">Expedition ${a.origin.expedition} · ${this.ui.esc(a.origin.region)}${a.origin.place ? ' · ' + this.ui.esc(a.origin.place) : ''}</div><div class="s">${this.ui.esc(a.story)}</div></div>`).join('');
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Hall of Discoveries</h2>
      <div class="sub">Objects from lands that no longer exist. ${this.world.hallSlots ? `The most recent ${Math.min(arts.length, this.world.hallSlots)} are on display.` : ''}</div>${list || '<div class="sub">The pedestals are empty. Bring something remarkable home.</div>'}`, null);
  }

  openJournal(tab = 'exp') {
    const j = this.save.journal;
    let body = '';
    if (tab === 'exp') {
      body = j.expeditions.slice().reverse().map((e) => {
        const items = Object.entries(e.brought || {}).map(([k, v]) => `${v} ${ITEMS[k]?.name.toLowerCase() || k}`).join(', ');
        return `<div class="art"><div class="n">${e.no}. ${this.ui.esc(e.name)}</div><div class="o">${this.ui.esc(e.scenario)} · ${new Date(e.date).toLocaleDateString()} · ${e.minutes ?? '?'} min</div>
        <div class="s">${items ? 'Brought home ' + items + '.' : 'Came home empty-handed.'}${e.artifacts?.length ? ' Found ' + e.artifacts.map((x) => this.ui.esc(x)).join(', ') + '.' : ''}${e.places?.length ? ' Visited ' + e.places.map((x) => this.ui.esc(x)).join(', ') + '.' : ''}</div></div>`;
      }).join('') || '<div class="sub">No journeys yet. The North Gate is waiting.</div>';
      if (this.expedition) body = `<div class="art"><div class="n">Now: ${this.ui.esc(this.expedition.name)}</div><div class="s">${this.ui.esc(this.expedition.rumor)}</div></div>` + body;
    } else if (tab === 'nature') {
      body = this.fieldGuide();
    } else if (tab === 'places') {
      body = j.places.slice().reverse().map((p) => `<div class="item"><span>${this.ui.esc(p.name)}</span><span class="q">Exp. ${p.exp}</span></div>`).join('') || '<div class="sub">No landmarks discovered yet.</div>';
      body = `<div class="grid" style="grid-template-columns:1fr">${body}</div>`;
    }
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Journal</h2>
      <div class="tabs"><button data-act="tab" data-t="exp" class="${tab === 'exp' ? 'on' : ''}">Expeditions</button><button data-act="tab" data-t="nature" class="${tab === 'nature' ? 'on' : ''}">Field guide</button><button data-act="tab" data-t="places" class="${tab === 'places' ? 'on' : ''}">Places</button></div>${body}`,
    (act, d) => {
      if (act === 'tab') this.openJournal(d.t);
      if (act === 'gsec') { this.guideSection = d.s; this.openJournal('nature'); }
      if (act === 'gview') { this.guideView = this.guideView === d.id ? null : d.id; this.openJournal('nature'); }
    });
    if (tab === 'nature' && this.guideView) { const el = document.getElementById('spec-view'); if (el) { const v = viewer(); v.show(this.guideSection === 'fish' ? 'fish' : this.guideSection === 'fungi' ? 'mushroom' : 'plant', this.guideView); v.mount(el); } }
  }

  // the forager's handbook: every species, plus your own notes
  fieldGuide() {
    const sec = this.guideSection || 'fungi';
    const K = this.save.knowledge || {};
    const tabs = [['fungi', 'Mushrooms'], ['plants', 'Berries & greens'], ['fish', 'Fish'], ['animals', 'Animals & tracks'], ['bush', 'Bushcraft'], ['safety', 'Safety']]
      .map(([k, l]) => `<button class="chip ${sec === k ? 'on' : ''}" data-act="gsec" data-s="${k}">${l}</button>`).join('');
    const e = (t) => this.ui.esc(t);
    const notes = (id) => { const k = K[id]; if (!k) return '<span class="dim">Not yet encountered.</span>'; const bits = []; if (k.seen) bits.push(`seen ${k.seen}×`); if (k.confirmed) bits.push(`identified correctly ${k.confirmed}×`); if (k.wrong) bits.push(`mistaken ${k.wrong}×`); if (k.eaten) bits.push(`eaten ${k.eaten}×`); if (k.caught) bits.push(`caught ${k.caught}×`); if (k.released) bits.push(`released ${k.released}×`); if (k.best) bits.push(`best ${k.best} cm`); return (recognised(this.save, id) ? '<b style="color:#9fc27a">Recognised at a glance.</b> ' : '') + bits.join(' · '); };
    let out = '';
    const entry = (id, sp, lines, viewable) => `<div class="art guide"><div class="n">${e(sp.name)} <i>${e(sp.latin || '')}</i>${sp.status ? ` <span class="st" style="color:${STATUS[sp.status].color}">${STATUS[sp.status].label}</span>` : ''}${viewable ? ` <button class="mini" data-act="gview" data-id="${id}">${this.guideView === id ? 'Hide' : 'View'}</button>` : ''}</div>
      ${this.guideView === id ? '<div class="guideview"><div id="spec-view"></div></div>' : ''}<ul class="obs">${lines}</ul><div class="o">Your notes: ${notes(id)}</div></div>`;
    if (sec === 'fungi' || sec === 'plants') {
      const list = sec === 'fungi' ? MUSHROOMS : PLANTS;
      for (const [id, sp, hd] of byRegion(list)) {
        if (hd) out += `<h3 class="guide-h">${hd}</h3>`;
        const lines = Object.entries(sp.look).map(([k, v]) => `<li><b>${{ cap: 'Cap', under: 'Underneath', stem: 'Stem', flesh: 'Flesh', smell: 'Smell', spore: 'Spore print', grows: 'Grows', plant: 'Plant', fruit: 'Fruit' }[k] || k}:</b> ${e(v)}</li>`).join('') + `<li>${e(sp.facts)}</li>` + (sp.lookalikes?.length ? `<li><b>Lookalikes:</b> ${sp.lookalikes.map((l) => e(list[l].name)).join(', ')}. ${e(sp.tell || '')}</li>` : '');
        out += entry(id, sp, lines, true);
      }
    } else if (sec === 'fish') {
      for (const [id, f, hd] of byRegion(FISH)) {
        if (hd) out += `<h3 class="guide-h">${hd}</h3>`;
        const where = Object.keys(f.water).join(', '), baits = Object.entries(f.bait).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([b]) => BAIT[b].name.toLowerCase()).join(', ');
        const best = Object.entries(f.time).sort((a, b) => b[1] - a[1])[0][0];
        out += entry(id, f, `<li><b>Look:</b> ${e(f.look)}</li><li><b>Water:</b> ${where} · <b>Best at:</b> ${best} · <b>Bait:</b> ${baits} · ${f.size[0]}–${f.size[1]} cm</li><li>${e(f.facts)}</li>`, true);
      }
    } else if (sec === 'animals') {
      for (const [id, a] of Object.entries(ANIMALS)) out += entry(id, { ...a, status: a.danger ? (a.danger === 'venomous' ? 'deadly' : 'toxic') : null }, `${a.track ? `<li><b>Tracks:</b> ${e(a.track)}</li>` : ''}<li>${e(a.facts)}</li>${a.safety ? `<li><b>${a.danger ? 'Staying safe' : 'Good to know'}:</b> ${e(a.safety)}</li>` : ''}`, false);
    } else if (sec === 'bush') {
      for (const [id, T] of Object.entries(TRAPS)) out += `<div class="art guide"><div class="n">${e(T.name)} ${this.save.lessons[id] ? '<span class="st" style="color:#9fc27a">Learned</span>' : '<span class="st dim">Learn at the workshop</span>'}</div><ol class="obs">${T.steps.map(([h, b]) => `<li><b>${e(h)}.</b> ${e(b)}</li>`).join('')}</ol><div class="o">${e(T.where)} ${e(T.note)}</div></div>`;
      out += `<div class="art guide"><div class="n">Bait for fishing</div><ul class="obs">${Object.values(BAIT).map((b) => `<li><b>${e(b.name)}:</b> ${e(b.desc)}</li>`).join('')}</ul></div>`;
    } else {
      out = `<div class="art guide"><div class="n">Before you eat anything wild</div><div class="s" style="font-style:normal">${e(SAFETY_NOTE)}</div><ul class="obs">
        <li>Identify with every feature: cap, underside, stem, ring, base (dig it up), smell, spore print and habitat. One feature is never enough.</li>
        <li>White gills + a ring + a sac at the base = Amanita. Never eat it.</li>
        <li>Know the deadly lookalikes of anything you collect, and check every single specimen.</li>
        <li>Cook wild mushrooms; try a small amount of a new species; never eat anything you are not 100% sure of.</li>
        <li>If someone may have eaten a poisonous mushroom or berry, get medical help immediately — don't wait for symptoms — and keep a sample.</li></ul></div>`;
    }
    return `<div class="chips">${tabs}</div>${out}`;
  }

  takeFromPack(req) {
    const items = this.pack.items;
    if (req.item) { if ((items[req.item] || 0) < req.qty) return false; items[req.item] -= req.qty; if (!items[req.item]) delete items[req.item]; return true; }
    const cands = Object.entries(items).filter(([k]) => catOf(k) === req.cat && !(k.startsWith('f:'))).sort((a, b) => b[1] - a[1]);
    if (cands.reduce((a, [, v]) => a + v, 0) < req.qty) return false;
    let need = req.qty;
    for (const [k, v] of cands) { const t = Math.min(v, need); items[k] -= t; if (!items[k]) delete items[k]; need -= t; if (!need) break; }
    return true;
  }
  hasInPack(req) { return req.item ? (this.pack.items[req.item] || 0) >= req.qty : Object.entries(this.pack.items).filter(([k]) => catOf(k) === req.cat && !k.startsWith('f:')).reduce((a, [, v]) => a + v, 0) >= req.qty; }
  reqText(req) { return req.item ? `${req.qty} ${itemInfo(req.item).name.toLowerCase()}` : `${req.qty} ${ICATS[req.cat].label.toLowerCase()} (any${req.cat === 'forage' ? ', checked' : ''})`; }

  openTrade(i) {
    const poi = i.poi;
    const rows = i.offers.map((o, idx) => {
      if (o.done) return '';
      const can = this.hasInPack(o.give);
      const get = o.artifact ? `<b>${this.ui.esc(o.artifact.name)}</b> <span style="color:var(--dim)">(unique)</span>` : Object.entries(o.get).map(([k, v]) => `${v} ${itemInfo(k).name.toLowerCase()}`).join(', ');
      return `<div class="row"><div><div>${get}</div><div class="need">for <span class="${can ? 'ok' : 'no'}">${this.reqText(o.give)}</span></div></div><button class="btn" data-act="trade" data-i="${idx}" ${can ? '' : 'disabled'}>Exchange</button></div>`;
    }).join('');
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>${this.ui.esc(poi.name)}</h2>
      <div class="sub">The ${poi.specialty} of ${this.ui.esc(poi.name)} keep an honesty stall: leave goods of fair value and take what you need. A slate lists today's exchanges.</div>${rows || '<div class="sub">Nothing more to trade today.</div>'}`, (act, d) => {
      if (act !== 'trade') return;
      const o = i.offers[+d.i];
      if (!this.takeFromPack(o.give)) return;
      if (o.artifact) { this.pack.artifacts.push(o.artifact); o.done = true; this.audio.discover(); this.ui.toast(`Traded for <b>${this.ui.esc(o.artifact.name)}</b>`, true); }
      else { for (const [k, v] of Object.entries(o.get)) this.addToPack(k, v, true); this.audio.pickup(); this.ui.toast('A fair exchange.'); }
      this.updatePackMeter(); this.persist(); this.openTrade(i);
    });
  }

  openMenu() {
    const s = this.save.settings;
    this.ui.showPanel(`<button class="close" data-act="close">Resume</button><h2>Appearium</h2><div class="sub">Every journey, a world of its own.</div>
      <label class="set">Graphics quality <span class="quality-row">${['low', 'medium', 'high'].map((q) => `<button data-act="q" data-q="${q}" class="${q === this.qualityName ? 'on' : ''}">${q}</button>`).join('')}</span></label>
      <label class="set">Look sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${s.lookSens}" data-set="lookSens"></label>
      <label class="set">Invert look <input type="checkbox" ${s.invertY ? 'checked' : ''} data-set="invertY"></label>
      <label class="set">Water reflections <input type="checkbox" ${this.reflection.enabled ? 'checked' : ''} data-set="reflections"></label>
      <label class="set">Volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
      <h3>Controls</h3><div class="kv">${isTouch ? 'Left thumb moves · Run button: tap to run, hold to auto-run (steer by looking) · right thumb looks · ✋ interacts · ⤒ jumps · stand still to sit and rest' : 'WASD move · mouse look (click to capture, Esc to release) · Shift or R run · Q auto-run · Space jump · E or click interact · I pack · J journal · H return home · L lantern'}</div>
      <div class="actions"><button class="btn ghost" data-act="reset">Erase all progress</button><button class="btn ghost" data-act="credits">Credits</button><button class="btn primary" data-act="close">Resume</button></div>`, (act, d, el) => {
      if (act === 'q') { s.quality = d.q; writeSave(this.save); location.reload(); }
      if (act === 'set') {
        if (d.set === 'invertY' || d.set === 'reflections') s[d.set] = el.checked; else s[d.set] = parseFloat(el.value);
        if (d.set === 'reflections') { const wq = { low: 0.3, medium: 0.38, high: 0.5 }[this.qualityName] ?? 0.4; this.reflection.scale = el.checked ? wq : 0; this.reflection.enabled = this.reflection.scale > 0; }
        if (d.set === 'volume') this.audio.setVolume(s.volume);
        writeSave(this.save);
      }
      if (act === 'credits') window.open('CREDITS.md', '_blank');
      if (act === 'reset') {
        this.ui.showPanel('<h2>Erase everything?</h2><div class="sub">Your village stores, artifacts and journal will be lost.</div><div class="actions"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="really">Erase</button></div>', (a) => { if (a === 'really') { resetSave(); location.reload(); } });
      }
    });
  }

  toggleLantern() {
    if (!this.save.upgrades.lantern) return;
    this.lantern.intensity = this.lantern.intensity > 0 ? 0 : 7;
  }

  onSnakeBite(id) {
    const A = ANIMALS[id]; const venom = ['adder', 'rattlesnake', 'fer_de_lance'].includes(id);
    this.audio.call?.('bite'); this.ui.flash?.('hurt');
    know(this.save, id).seen++;
    if (venom) this.body.add('envenomed', { sev: 2, dur: id === 'adder' ? 420 : 300 });
    else this.body.add('bitten', { dur: 15 });
    this.showCard(`<div class="k">${venom ? 'Snakebite!' : 'Bitten'}</div><div class="n">${this.ui.esc(A.name)}</div><div class="s">${venom ? 'Keep calm. Do not run — it spreads the venom. Return home; Maren can treat it.' : 'Not venomous. It only wanted you to go away.'}</div><div class="o">${this.ui.esc(A.safety)}</div>`, 9000);
    this.persist();
  }
  // other animals: a big cat or a moose ends the expedition; a boar sow just knocks you over
  onAnimalAttack(id) {
    know(this.save, id).seen++; this.ui.flash?.('hurt');
    if (id === 'wild_boar') {
      this.audio.call?.('boar'); this.body.stamina = Math.min(this.body.stamina, 15); this.body.add('bruised', { dur: 120, msg: false });
      this.ui.toast('The sow bowls you over, then trots off after her piglets. <b>Bruised</b>, but nothing broken. Never get between a sow and her young.', true);
      this.persist(); return;
    }
    if (id === 'shark') { this.audio.splash(1.5); this.body.fx.collapse = 1; this.onCollapse('shark'); return; }
    this.audio.call?.(id === 'moose' ? 'moose' : id === 'wolf' ? 'wolf' : 'cougar');
    this.body.fx.collapse = 1; this.onCollapse(id);
  }
  onBearAttack(id) {
    know(this.save, id).seen++; this.audio.call?.('bear_roar'); this.ui.flash?.('hurt');
    this.body.fx.collapse = 1; this.onCollapse('bear');
  }

  // how close the open sea is (for the sound of the surf)
  seaNear(p) {
    const g = this.world.gen; if (g.p.kind !== 'coast') return 0;
    this.seaT = (this.seaT || 0) - 1; if (this.seaT > 0) return this.seaV || 0;
    this.seaT = 20; let best = 0;
    for (let r = 0; r <= 120; r += 20) for (let a = 0; a < 6.28; a += 0.785) { if (g.seaAt(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) > 0.5) { best = Math.max(best, 1 - r / 140); } }
    return (this.seaV = best);
  }

  // arriving in the new land, and weather that changes during the journey
  expeditionTick(dt, s) {
    const exp = this.expedition;
    if (!exp.arrived && s.biome > 0.55) {
      exp.arrived = true;
      this.ui.region(exp.name, `Expedition ${exp.no} · ${exp.title}`);
      this.ui.toast(`<b>${this.ui.esc(exp.name)}</b> — ${this.ui.esc(exp.blurb)}`, true);
    }
    this.weatherClock = (this.weatherClock || 0) + dt;
    if (this.weatherClock > 150 && Math.random() < dt / 120) { // every few minutes the sky may turn
      this.weatherClock = 0;
      const next = weatherShift(exp, this.sky.weatherName);
      if (next !== this.sky.weatherName) {
        this.sky.setWeather(next, false, 0.015);
        const msg = { storm: 'The sky darkens fast. A storm is coming in.', rain: 'Clouds gather; the first drops of rain.', windy: 'The wind is rising.', clear: 'The clouds break up.', mist: 'Mist creeps in.', snow: 'Snow begins to fall.', overcast: 'The sky clouds over.', hazy: 'A warm haze settles.' }[next];
        if (msg) this.ui.toast(msg);
      }
    }
  }

  onDiscover(poi) {
    if (poi.type === 'camp') return;
    this.audio.discover();
    this.ui.toast(`Discovered — <b>${this.ui.esc(poi.name)}</b>`, true);
    if (this.expedition && poi.type !== 'find') {
      this.expedition.discovered.push(poi.name);
      this.save.journal.places.push({ name: poi.name, exp: this.expedition.no, region: this.expedition.name });
      this.persist();
    }
  }

  // ------------------------------------------------------------------ frame
  loop() {
    requestAnimationFrame(() => this.loop());
    this.frame(Math.min(0.05, this.clock.getDelta()));
  }

  // one simulation + render step (also driven directly by automated tests)
  frame(dt, render = true) {
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (this.state === 'play') this.gameTime += dt;
    this.adaptResolution(dt);
    const input = this.input;
    if (this.state === 'play' && !this.transitioning) {
      if (!this.ui.panelOpen) {
        if (this.buildMode.active) this.buildMode.update();
        else if (input.wasPressed('KeyE') && !this.fishing.active) this.interact();
        if (input.wasPressed('KeyB') && this.world?.kind === 'village' && !this.buildMode.active) this.buildMode.open();
        if (input.wasPressed('KeyI') || input.wasPressed('Tab')) this.openPack();
        if (input.wasPressed('KeyJ')) this.openJournal();
        if (input.wasPressed('KeyH') && this.expedition) this.confirmReturnHome();
        if (input.wasPressed('KeyL')) this.toggleLantern();
        if (input.wasPressed('KeyR') && !this.buildMode.active) this.setRun(!(input.runMode || input.autoRun), false);
        if (input.wasPressed('KeyQ')) this.setRun(!input.autoRun, !input.autoRun);
        if (input.wasPressed('Escape') && !this.fishing.active && !input.locked && !this.buildMode.active) this.openMenu();
      } else if (input.wasPressed('Escape')) this.ui.closePanel();
      this.player.update(dt, input, this.world, this.save.settings);
      this.body.update(dt, this.player.running, this.player.speed > 0.5, this.player.resting, this.player.climb || 0);
      this.body.breathUpdate(dt, this.player.swimming && this.player.underwater);
      this.runTick(dt);
      this.fishing.update(dt, input);
      // wildlife observation
      if (this.observing) {
        const o = this.observing, a = o.fox || o.hare || o.herd.ref, d = a.pos.distanceTo(this.player.pos);
        if (a.state === 'flee' || a.state === 'fly' || a.state === 'charge' || d > (o.herd ? 95 : 32) || this.player.speed > 0.6) { this.ui.observe(null); this.observing = null; if (a.state === 'flee' || a.state === 'fly') this.ui.toast(o.fox ? 'The fox noticed you and bolted.' : o.hare ? 'The hare bolts away in a zig-zag.' : o.herd.kind === 'horse' ? 'The herd wheels away at a gallop.' : /deer/.test(o.herd.kind) ? 'They bound away, white rumps flashing.' : ANIMALS[o.herd.kind]?.group === 'snake' ? 'It slides away into cover.' : 'They lift off, legs trailing.'); }
        else if (o.herd && o.t > 3) {
          this.ui.observe(null); this.observing = null; const kind = o.herd.kind, k = know(this.save, kind); const first = !k.seen; k.seen++;
          const notes = {
            red_deer: ['A hind lifts her head, ears swivelling, nose working the wind.', 'They browse along the edge of the trees, tails flicking.'], mule_deer: ['Huge ears turn towards you. It stamps a forefoot.'],
            brown_bear: ['It rips at a rotten log for grubs, then lifts its nose to the wind.', 'A great hump of muscle over the shoulders — the digging muscle of a brown bear.'], black_bear: ['It rakes berries off a bush with its lips, unhurried.'],
            harbour_seal: ['They lie in banana shapes, heads and tails raised off the warm rock.', 'One scratches its belly with a front flipper, eyes half closed.'],
            adder: ['Coiled flat to soak up the sun, the zigzag plain along its back.'], grass_snake: ['The yellow collar shows clearly as it lifts its head.'], rattlesnake: ['The rattle — a column of dry, hollow segments — is held up, ready.'],
            gopher_snake: ['Narrow head, round pupils, no rattle — a harmless mimic.'], fer_de_lance: ['Motionless among the leaves, the spearhead pattern almost invisible.'], boa: ['Thick and slow, tongue flickering, tail turning reddish.'],
            horse: ['The lead mare lifts her head, ears on you, then goes back to grazing.', 'A foal sticks close to its mother\'s flank.', 'Two of them stand nose to tail, flicking flies off each other\'s faces.'],
            flamingo: ['They feed with their heads upside down, sieving the water through their bills.', 'One stands on a single leg, the other tucked up under its body.'],
            stork: ['It stalks slowly through the grass, then stabs down at something.', 'It clatters its long red bill.'] }[kind] || ['You watch quietly.'];
          this.showCard(`<div class="k">Field note${first ? ' — new species' : ''}</div><div class="n">${this.ui.esc(ANIMALS[kind].name)}</div><div class="s">${notes[Math.floor(Math.random() * notes.length)]}</div><div class="o">${this.ui.esc(ANIMALS[kind].facts)}${ANIMALS[kind].safety ? `<br><b>${ANIMALS[kind].danger ? 'Staying safe' : 'Good to know'}:</b> ${this.ui.esc(ANIMALS[kind].safety)}` : ''}</div>`, 9000);
          this.persist();
        }
        else if (o.hare && o.t > 2.6) {
          this.ui.observe(null); this.observing = null; const k = know(this.save, 'hare'); k.seen++;
          this.showCard(`<div class="k">Field note</div><div class="n">European hare</div><div class="s">${['It sits up, long black-tipped ears turning like radar dishes.', 'It nibbles at the grass, one eye always on you.', 'Its long hind legs are folded beneath it, ready to bolt.'][Math.floor(Math.random() * 3)]}</div><div class="o">${this.ui.esc(ANIMALS.hare.facts)}</div>`, 4200); this.persist();
        }
        else {
          o.t += dt; this.ui.observe(Math.min(1, o.t / (o.herd ? 3 : 2.6)), 'Watching…');
          if (o.fox && o.t > 2.6) {
            this.ui.observe(null); this.observing = null;
            const j = { fox: know(this.save, 'fox') }; const first = !j.fox.seen; j.fox.seen++;
            const notes = ['It pauses, ears swivelling towards some sound you cannot hear.', 'It noses through the leaf litter, hunting voles.', 'Its coat is thick — winter is coming early to this land.', 'It glances your way, unbothered, then trots on.'];
            this.showCard(`<div class="k">Field note${first ? ' — new species' : ''}</div><div class="n">Red fox</div><div class="s">${notes[Math.floor(Math.random() * notes.length)]}</div><div class="o">Observed ${j.fox.seen} time${j.fox.seen > 1 ? 's' : ''}.</div>`, 3600);
            this.persist();
          }
        }
      }
      this.current = this.findInteraction();
      const c = this.current;
      this.ui.prompt(c ? (c.type === 'trap' && this.gameTime < c.setAt + c.readyAfter ? `${TRAPS[c.trap].name} set — check back later` : c.type === 'forage' ? forageLabel(this, c) : c.label) : null);
      this.updateBodyHud(dt);
    }
    if (this.world) {
      const p = this.player.pos;
      // at a run, stream the land ahead of you first so it's ready when you get there
      const sp = this.player.speed;
      if (sp > 3.5) { const f = this.player.forward(this.tmpLead || (this.tmpLead = new THREE.Vector3())); this.world.stream(p, false, { x: p.x + f.x * Math.min(56, sp * 7), z: p.z + f.z * Math.min(56, sp * 7) }, 1.4); }
      else this.world.stream(p);
      this.pools.flush();
      this.sky.time = (this.sky.time + dt / 120) % 24;
      // under water? (the camera, not the feet) — set the murk before the sky shares its fog out
      const W = this.world.gen.p.water, cam = this.camera.position, camUnder = cam.y < W + (this.player.swimming ? this.player.swell(cam.x, cam.z) : 0) - 0.06 && this.world.depthAt(cam.x, cam.z) > 0;
      if (camUnder) {
        const reg = this.expedition && this.world.gen.sample(cam.x, cam.z).biome > 0.5 ? this.expedition.region : 'temperate', sea = this.world.sea ? this.world.sea.isSea(cam.x, cam.z) : false;
        const col = reg === 'tropics' ? [0.07, 0.42, 0.45] : sea ? [0.04, 0.2, 0.3] : [0.07, 0.2, 0.17];
        this.sky.under = { col: (this.underCol || (this.underCol = new THREE.Color())).setRGB(...col), density: reg === 'tropics' ? 0.04 : sea ? 0.055 : 0.07, depth: W - cam.y };
      } else this.sky.under = null;
      this.body.fx.under = (this.body.fx.under || 0) + ((camUnder ? 1 : 0) - (this.body.fx.under || 0)) * Math.min(1, dt * 8);
      if (camUnder !== this.wasUnder) { this.wasUnder = camUnder; this.audio.setUnder?.(camUnder); this.renderer.setClearColor(camUnder ? 0x0a2a30 : 0x000000); }
      $('btn-dive').classList.toggle('hidden', !(isTouch && this.player.swimming));
      this.sky.update(dt, this.camera, p);
      this.sky.applyToWater(this.waterMat);
      const tu = this.world.terrainMat?.userData.uniforms; if (tu) { tu.uWetness.value = this.sky.wetness; tu.uSnowCover.value = this.sky.snowCover; tu.uCaustT.value += dt; tu.uCaust.value = this.sky.dayFactor * this.sky.w.light; }
      const wu = this.waterMat.uniforms;
      wu.uTime.value += dt; wu.uWind.value = this.sky.w.wind;
      const gd = this.world.gen.dir; if (gd) wu.uWaveDir.value.set(-gd.x, -gd.z); else wu.uWaveDir.value.set(0, 1);
      // wading leaves a wake; rain rings the water
      const dHere = this.world.depthAt(p.x, p.z);
      if (dHere > 0.05 && this.player.speed > 0.4) { this.wakeT = (this.wakeT || 0) - dt; if (this.wakeT < 0) { this.wakeT = 0.1; this.ripples.drop(p.x, p.z, 0.7, Math.min(0.12, 0.025 * this.player.speed)); } }
      const waterNearR = dHere > -6 || this.world.depthAt(p.x + 20, p.z) > 0 || this.world.depthAt(p.x - 20, p.z) > 0 || this.world.depthAt(p.x, p.z + 20) > 0 || this.world.depthAt(p.x, p.z - 20) > 0;
      this.ripples.update(dt, p, this.sky.w.snow > 0.3 ? 0 : Math.min(1, this.sky.w.rain), waterNearR);
      this.ripples.bind(wu);
      windUniforms.uTime.value += dt; windUniforms.uWind.value = this.sky.w.wind;
      const fm = KIND_INFO.materials; if (fm) { fm.firMat.emissiveIntensity = 0.55 * this.sky.dayFactor * this.sky.w.light; fm.leafMat.emissiveIntensity = 0.5 * this.sky.dayFactor * this.sky.w.light; }
      const night = this.sky.dayFactor < 0.3;
      this.world.update(dt, { player: this.player, night, day: this.sky.dayFactor, wind: this.sky.w.wind, onDiscover: (poi) => this.onDiscover(poi) });
      // audio
      const s = this.world.gen.sample(p.x, p.z);
      let water = 0; for (let a = 0; a < 6.28; a += 0.785) { const d = this.world.depthAt(p.x + Math.cos(a) * 9, p.z + Math.sin(a) * 9); if (d > 0) water += 0.125; }
      this.audio.listener = this.player; this.audio.world = this.world;
      // the wind sound swells as the same rolling gusts that move the grass pass over you
      const wave = 0.5 + 0.5 * Math.sin(p.x * 0.045 + p.z * 0.026 - windUniforms.uTime.value * 0.85);
      this.audio.update(dt, { wind: this.sky.w.wind * (0.6 + 0.9 * wave * wave * wave), forest: s.forest, water: water + Math.max(0, this.world.depthAt(p.x, p.z)), rain: Math.min(1.4, this.sky.w.rain), day: this.sky.dayFactor, bees: this.world.ambience?.beeNear, home: this.world.kind === 'village',
        sea: this.seaNear(p), waves: this.sky.w.waves, region: this.expedition && s.biome > 0.5 ? this.expedition.region : 'temperate', scenario: this.expedition && s.biome > 0.5 ? this.expedition.scenario : null });
      if (this.state === 'play') this.updateCompass();
      if (this.expedition && this.state === 'play') this.expeditionTick(dt, s);
      if (this.state === 'title') { this.player.yaw += dt * 0.03; this.player.syncCamera(); }
    }
    // body effects on the camera: nausea sway, staggering, collapse
    const fx = this.body.fx;
    if (fx.sick > 0.01 || fx.trip > 0.01) {
      const t = this.gameTime;
      this.camera.rotation.z = Math.sin(t * 0.7) * 0.05 * fx.sick + Math.sin(t * 0.33) * 0.03 * fx.trip;
      this.camera.position.y -= fx.collapse * 1.1;
      this.camera.fov = 70 + Math.sin(t * 0.5) * 4 * fx.trip; this.camera.updateProjectionMatrix(); this.fovTouched = true;
    } else if (this.fovTouched) { this.fovTouched = false; this.camera.fov = 70; this.camera.updateProjectionMatrix(); }
    input.endFrame();
    if (render) {
      if (this.world && this.reflection.enabled && this.reflection.waterVisible(this.camera, this.world.chunks?.chunks)) this.reflection.render(this.scene, this.camera, this.world.gen.p.water, [this.sky.rain].filter(Boolean), this.waterMat);
      else this.reflection.active = false;
      this.reflection.bind(this.waterMat.uniforms);
      if (this.postfx.active(fx)) this.postfx.render(this.scene, this.camera, fx, dt);
      else this.renderer.render(this.scene, this.camera);
    }
    if (this.debug) this.debugHud();
  }

  // the run toggle and auto-run
  setRun(on, auto) {
    const i = this.input; i.runMode = on && !auto; i.autoRun = on && auto;
    if (on && this.body.winded) this.ui.toast('You\'re still winded — catch your breath first.');
    else if (auto && on) this.ui.toast('Auto-run: steer by looking. Pull back (or tap Run) to stop.');
  }
  runTick(dt) {
    const i = this.input, b = $('btn-run');
    if (!i.autoRun && b.classList.contains('auto')) i.runMode = false; // auto-run cancelled by pulling back
    b.classList.toggle('on', i.runMode || i.autoRun); b.classList.toggle('auto', i.autoRun); b.textContent = i.autoRun ? 'Auto' : 'Run';
    // breathing: hard when tired, panting when winded
    const f = this.body.stamina / this.body.maxStamina, pl = this.player;
    this.breathT = (this.breathT || 0) - dt;
    if (this.breathT < 0) {
      if (this.body.winded || (pl.running && f < 0.4)) { this.breathT = this.body.winded ? 0.8 : 1.1 - (0.4 - f); this.audio.breath?.(this.body.winded ? 1 : 0.4 + (0.4 - f)); }
      else this.breathT = 0.5;
    }
    // a wider view at a run gives a sense of speed
    if (!this.fovTouched) { const target = 70 + Math.max(0, Math.min(1, (pl.speed - 3) / 3.5)) * 6; if (Math.abs(this.camera.fov - target) > 0.05) { this.camera.fov += (target - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix(); } }
  }

  updateBodyHud() {
    const b = this.body, el = this.hudEls || (this.hudEls = { st: $('stamina'), fill: $('stamina-fill'), chips: $('status-chips') });
    const full = b.stamina >= b.maxStamina - 0.5;
    el.st.classList.toggle('hidden', full);
    el.fill.style.width = `${(b.stamina / b.maxStamina) * 100}%`;
    el.fill.classList.toggle('fed', b.has('fed') && !b.winded); el.fill.classList.toggle('winded', !!b.winded);
    const br = el.br || (el.br = $('breath')), bf = el.bf || (el.bf = $('breath-fill'));
    br.classList.toggle('hidden', !(this.player.swimming && (this.player.underwater || b.breath < 0.99)));
    bf.style.width = `${b.breath * 100}%`; bf.classList.toggle('low', b.breath < 0.3);
    const chips = b.chips().map((c) => `<span style="border-color:${CONDITIONS[c].color};color:${CONDITIONS[c].color}">${CONDITIONS[c].label}</span>`).join('');
    if (chips !== this.lastChips) { el.chips.innerHTML = chips; this.lastChips = chips; }
  }

  // dynamic resolution: trade pixels for frame rate on slower GPUs (e.g. older iPads)
  adaptResolution(dt) {
    if (this.state !== 'play' || this.transitioning || this.params?.has('fixedres')) return;
    this.resT = (this.resT || 0) + dt;
    if (this.resT < 2.5) return;
    this.resT = 0;
    const cur = this.renderer.getPixelRatio(), max = this.quality.pixelRatio;
    let next = cur;
    if (this.fps < 27) next = Math.max(0.6, cur - 0.15);
    else if (this.fps > 52 && cur < max) next = Math.min(max, cur + 0.1);
    if (Math.abs(next - cur) > 0.01) { this.renderer.setPixelRatio(next); this.renderer.setSize(innerWidth, innerHeight); }
  }

  updateCompass() {
    const f = this.player.forward(new THREE.Vector3());
    const heading = Math.atan2(f.x, -f.z);
    const marks = [];
    const p = this.player.pos;
    for (const poi of this.world.pois || []) {
      if (!poi.known && !poi.discovered) continue;
      const dx = poi.pos.x - p.x, dz = poi.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d < 6) continue;
      marks.push({ bearing: Math.atan2(dx, -dz), label: poi.discovered || d < 60 ? poi.name : '?', cls: poi.type === 'camp' ? 'camp' : poi.discovered ? '' : 'rumor', dist: Math.round(d) });
    }
    for (const t of this.traps) { const dx = t.pos.x - p.x, dz = t.pos.z - p.z; marks.push({ bearing: Math.atan2(dx, -dz), label: TRAPS[t.trap].name, cls: 'rumor', dist: Math.round(Math.hypot(dx, dz)) }); }
    if (this.world.kind === 'village') { const dx = this.world.gatePos.x - p.x, dz = this.world.gatePos.z - p.z; marks.push({ bearing: Math.atan2(dx, -dz), label: 'North Gate', cls: 'camp' }); }
    this.ui.compass(heading, marks);
  }

  debugHud() {
    if (!this.dbgEl) { this.dbgEl = document.createElement('div'); Object.assign(this.dbgEl.style, { position: 'fixed', left: '8px', bottom: '8px', zIndex: 50, font: '11px monospace', color: '#cfc', background: 'rgba(0,0,0,.5)', padding: '4px 6px', pointerEvents: 'none' }); document.body.appendChild(this.dbgEl); }
    const st = this.pools.stats(), r = this.renderer.info.render;
    this.dbgEl.textContent = `fps ${this.fps.toFixed(0)} · draws ${r.calls} · tris ${(r.triangles / 1000).toFixed(0)}k · inst ${st.inst} · chunks ${this.world?.chunks.chunks.size} · t ${this.sky.time.toFixed(2)} · ${this.player.pos.x.toFixed(0)},${this.player.pos.z.toFixed(0)}`;
  }
}

const game = new Game();
game.init().catch((e) => { console.error(e); $('loadtext').textContent = 'Something went wrong while loading: ' + e.message; });
