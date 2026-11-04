// Appearium — entry point and game orchestration.
// Loop: Village → New wilderness → Explore → Gather & discover → Return home → Preserve → New expedition.
import * as THREE from 'three';
import { setAnisotropy, setProgressHandler, preloadTextures, loadModel } from './core/assets.js';
import { PoolManager } from './world/pools.js';
import { defineKinds, windUniforms, KIND_INFO } from './world/vegetation.js';
import { createWaterMaterial } from './world/water.js';
import { SkySystem } from './world/sky.js';
import { loadProps } from './world/structures.js';
import { Village } from './world/village.js';
import { Wilderness } from './world/wilderness.js';
import { generateExpedition, SCENARIOS } from './world/scenarios.js';
import { Input, Player } from './game/player.js';
import { Fishing } from './game/fishing.js';
import { ITEMS, CATS, RECIPES } from './game/items.js';
import { loadSave, writeSave, resetSave } from './game/save.js';
import { SoundScape } from './audio/audio.js';
import { UI } from './ui/ui.js';

const QUALITY = {
  low: { pixelRatio: 1, chunkRadius: 2, shadows: 1024, shadowRange: 38, grassRadius: 18, grassDensity: 1.5, grassBlades: 12, capacity: { trees: { near: 2000, far: 3000 }, grass: 2200, small: 1200 }, rainDrops: 350, fogScale: 1.5, streamBudget: 4, antialias: false },
  medium: { pixelRatio: 1.25, chunkRadius: 3, shadows: 1536, shadowRange: 50, grassRadius: 24, grassDensity: 2.3, grassBlades: 16, capacity: { trees: { near: 2600, far: 5000 }, grass: 4800, small: 2200 }, rainDrops: 650, fogScale: 1.15, streamBudget: 5, antialias: false },
  high: { pixelRatio: 2, chunkRadius: 4, shadows: 2048, shadowRange: 68, grassRadius: 34, grassDensity: 3.0, grassBlades: 22, capacity: { trees: { near: 3200, far: 7000 }, grass: 11000, small: 3200 }, rainDrops: 1100, fogScale: 0.95, streamBudget: 6, antialias: true },
};

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

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
    this.audio = new SoundScape(); this.audio.vol = this.save.settings.volume;
    this.player.onStep = (k, wet) => this.audio.step(k, wet ? 'water' : this.surface());
    this.pools = new PoolManager(this.scene);
    this.waterMat = createWaterMaterial();
    this.sky = new SkySystem(renderer, this.scene, this.quality);
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
    $('btn-journal').onclick = () => this.openJournal();
    $('btn-menu').onclick = () => this.openMenu();
    $('btn-light').onclick = () => this.toggleLantern();
    $('btn-jump').onpointerdown = (e) => { e.preventDefault(); this.input.pressed.add('Space'); };
    $('btn-interact').onpointerdown = (e) => { e.preventDefault(); this.interact(); };
    this.input.dom.addEventListener('mousedown', (e) => { if (this.input.locked && e.button === 0 && !this.fishing.active) this.interact(); });
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
    this.sky.setWeather(Math.random() < 0.75 ? 'clear' : 'hazy', true);
    this.sky.time = this.save.time;
    this.ui.region('Home', `Your village · ${this.save.expeditionCount} expedition${this.save.expeditionCount === 1 ? '' : 's'} so far`);
    $('btn-home').classList.add('hidden');
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
      <div class="kv">Pack capacity <b>${this.save.upgrades.pack}</b> · Rod <b>${this.save.upgrades.rod >= 2 ? 'sturdy' : 'simple'}</b> · Snares <b>${this.save.tools.snare || 0}</b>${this.save.upgrades.lantern ? ' · Lantern' : ''}</div>
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
      await this.ui.fade(true, { kicker: `Expedition ${no} · ${exp.title}`, title: exp.name, sub: exp.blurb, rumor: exp.rumor });
      const w = new Wilderness(this, exp);
      await this.loadWorld(w);
      this.sky.time = exp.time; this.sky.setWeather(exp.weather, true);
      this.ui.region(exp.name, `Expedition ${no} · ${exp.title}`);
      $('btn-home').classList.remove('hidden');
      $('packmeter').classList.remove('hidden');
      this.updatePackMeter();
      await new Promise((r) => setTimeout(r, 2200));
      await this.ui.fade(false);
      if (!this.save.tutorial.firstExpedition) {
        this.save.tutorial.firstExpedition = true; writeSave(this.save);
        setTimeout(() => this.ui.toast('Look for fallen wood, stones, mushrooms and berries. Approach water and face it to fish.', true), 800);
        setTimeout(() => this.ui.toast('The compass shows your camp and anything you have heard of.'), 5000);
      }
    } finally { this.transitioning = false; }
  }

  confirmReturnHome() {
    if (!this.expedition || this.transitioning) return;
    const n = this.packCount(), a = this.pack.artifacts.length, traps = this.traps.length;
    this.ui.showPanel(`<button class="close" data-act="close">Stay</button><h2>Return home?</h2>
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
      writeSave(this.save);
      await this.enterVillage({ fromExpedition: true });
      const parts = Object.entries(brought).map(([k, v]) => `${v} ${ITEMS[k]?.name.toLowerCase() || k}`);
      if (parts.length || arts.length) setTimeout(() => this.ui.toast(`Brought home: ${[...parts, ...arts].slice(0, 6).join(', ')}${parts.length + arts.length > 6 ? '…' : ''}`, true), 400);
      if (arts.length) setTimeout(() => this.ui.toast('Your new discoveries are on display in the <b>Hall of Discoveries</b>.'), 3800);
    } finally { this.transitioning = false; }
  }

  storePack(p) {
    let n = 0;
    for (const [k, v] of Object.entries(p.items || {})) { this.save.store[k] = (this.save.store[k] || 0) + v; n += v; }
    for (const a of p.artifacts || []) { this.save.artifacts.push(a); n++; }
    return n;
  }

  // ------------------------------------------------------------------ pack
  packCount() { return Object.values(this.pack.items).reduce((a, b) => a + b, 0) + this.pack.artifacts.length * 2; }
  updatePackMeter() { this.ui.pack(this.packCount(), this.save.upgrades.pack); }
  addToPack(item, qty, partial = false) {
    const room = this.save.upgrades.pack - this.packCount();
    if (room <= 0 || (!partial && room < qty)) return 0;
    const n = Math.min(qty, room);
    this.pack.items[item] = (this.pack.items[item] || 0) + n;
    this.updatePackMeter(); this.persist();
    return n;
  }
  persist() {
    if (this.expedition) this.save.pendingPack = this.pack;
    this.save.time = this.sky.time;
    clearTimeout(this.persistT); this.persistT = setTimeout(() => writeSave(this.save), 400);
  }

  // ------------------------------------------------------------------ interactions
  surface() {
    if (!this.world) return 'grass';
    if (this.world.kind === 'village' && Math.hypot(this.player.pos.x, this.player.pos.z) < 7.2) return 'stone';
    const s = this.world.gen.sample(this.player.pos.x, this.player.pos.z);
    return s.forest > 0.5 ? 'forest' : 'grass';
  }

  findInteraction() {
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
    const spot = this.fishing.findSpot(this.player, this.world);
    if (spot) return { type: 'fish', spot, label: `Cast your line (${spot.type === 'river' ? 'river' : 'still water'})` };
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
        w.removeGatherable(i);
        this.audio.pickup();
        this.ui.toast(`+${got} ${ITEMS[i.item].name}${bonusTxt}`);
        this.current = null; break;
      }
      case 'artifact': {
        const a = i.artifact;
        this.ui.showPanel(`<div class="k" style="color:var(--accent);letter-spacing:.16em;font-size:12px;text-transform:uppercase">Discovery</div><h2>${this.ui.esc(a.name)}</h2>
          <div class="sub" style="font-style:italic">${this.ui.esc(a.story)}</div><div class="kv">Takes 2 spaces in your pack. Once home, it will be displayed in the Hall of Discoveries.</div>
          <div class="actions"><button class="btn ghost" data-act="close">Leave it</button><button class="btn primary" data-act="take">Take it home</button></div>`,
        (act) => {
          if (act !== 'take') return;
          if (this.save.upgrades.pack - this.packCount() < 2) { this.ui.toast('Not enough room in your pack (needs 2).'); return; }
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
      case 'trap': this.checkTrap(i); break;
      case 'observe': this.observing = { fox: i.fox, t: 0 }; break;
      case 'fish': this.fishing.start(i.spot); break;
    }
  }

  showArtifactCard(a) {
    const o = a.origin, d = new Date(o.date);
    this.showCard(`<div class="k">Hall of Discoveries</div><div class="n">${this.ui.esc(a.name)}</div><div class="s">${this.ui.esc(a.story)}</div>
      <div class="o">Expedition ${o.expedition} · ${this.ui.esc(o.region)} (${this.ui.esc(o.scenario)})<br>${d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} — that land is gone now.</div>`, 6000);
  }
  showCard(html, ms) { this.ui.card(html, ms); }

  // ------------------------------------------------------------------ snares
  setSnare() {
    if (!this.expedition) return;
    if ((this.save.tools.snare || 0) <= 0) { this.ui.toast('You have no snares. Make some at the workshop.'); return; }
    const p = this.player.pos, w = this.world;
    if (w.depthAt(p.x, p.z) > -0.3) { this.ui.toast('The ground here is too wet for a snare.'); return; }
    if (this.traps.some((t) => t.pos.distanceTo(p) < 6)) { this.ui.toast('You already set a snare close by.'); return; }
    this.save.tools.snare--;
    const f = this.player.forward(new THREE.Vector3());
    const x = p.x + f.x * 1.2, z = p.z + f.z * 1.2, y = w.heightAt(x, z);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.9 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 5), mat); stick.position.y = 0.25; stick.rotation.z = 0.2;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 5, 16), new THREE.MeshStandardMaterial({ color: 0xb8a98a })); loop.position.set(0.1, 0.13, 0); loop.rotation.y = Math.PI / 2;
    g.add(stick, loop); g.position.set(x, y, z); g.traverse((o) => { o.castShadow = true; });
    this.scene.add(g); this.world.objects.push(g);
    const s = w.gen.sample(x, z);
    const habitat = 0.35 + (1 - Math.abs(s.forest - 0.4)) * 0.45;
    this.traps.push({ type: 'trap', pos: new THREE.Vector3(x, y + 0.3, z), radius: 1.6, mesh: g, setAt: performance.now(), readyAfter: 60000 + Math.random() * 45000, chance: habitat, label: 'Check the snare' });
    this.ui.toast('Snare set. Check back in a little while.');
    writeSave(this.save);
  }
  checkTrap(t) {
    const left = t.setAt + t.readyAfter - performance.now();
    if (left > 0) { this.ui.toast(`Nothing yet — give it about ${Math.ceil(left / 1000 / 15) * 15} more seconds.`); return; }
    this.scene.remove(t.mesh); this.traps = this.traps.filter((x) => x !== t);
    this.save.tools.snare = (this.save.tools.snare || 0) + 1;
    if (Math.random() < t.chance) {
      const a = this.addToPack('hare', 1, true), b = this.addToPack('pelt', 1, true);
      this.audio.pickup();
      this.ui.toast(a || b ? 'A hare in the snare. <b>+1 hare, +1 pelt</b> (snare recovered)' : 'A hare — but your pack is full. You let it go.', true);
      const j = this.save.journal.wildlife; j.hare = j.hare || { seen: 0, first: this.expedition.no }; j.hare.seen++;
    } else this.ui.toast('The snare is empty. You take it back.');
    this.persist();
  }

  // ------------------------------------------------------------------ panels
  itemGrid(items, empty = 'Nothing yet.') {
    const ents = Object.entries(items).filter(([, v]) => v > 0);
    if (!ents.length) return `<div class="sub">${empty}</div>`;
    const by = {};
    for (const [k, v] of ents) { const c = ITEMS[k]?.cat || 'material'; (by[c] = by[c] || []).push([k, v]); }
    return Object.entries(by).map(([c, list]) => `<h3>${CATS[c].label}</h3><div class="grid">${list.map(([k, v]) => `<div class="item" title="${this.ui.esc(ITEMS[k]?.desc || '')}"><span><span class="sw" style="background:${CATS[c].color}"></span>${ITEMS[k]?.name || k}</span><span class="q">${v}</span></div>`).join('')}</div>`).join('');
  }

  openPack() {
    if (this.ui.panelOpen) { this.ui.closePanel(); return; }
    const inExp = !!this.expedition;
    const arts = this.pack.artifacts.map((a) => `<div class="art"><div class="n">${this.ui.esc(a.name)}</div><div class="s">${this.ui.esc(a.story)}</div></div>`).join('');
    const html = `<button class="close" data-act="close">Close</button><h2>Pack</h2>
      <div class="sub">${inExp ? `${this.packCount()} of ${this.save.upgrades.pack} spaces used. Everything here is kept once you return home.` : 'You are at home. Your belongings are in the storehouse.'}</div>
      ${inExp ? this.itemGrid(this.pack.items, 'Your pack is empty. Look around for things to gather.') : ''}
      ${arts ? `<h3>Artifacts</h3>${arts}` : ''}
      <h3>Equipment</h3><div class="kv">${this.save.upgrades.rod >= 2 ? 'Sturdy' : 'Simple'} fishing rod · ${this.save.tools.snare || 0} snare${this.save.tools.snare === 1 ? '' : 's'}${this.save.upgrades.lantern ? ' · Lantern (L)' : ''}</div>
      <div class="actions">${inExp ? `<button class="btn" data-act="snare" ${this.save.tools.snare > 0 ? '' : 'disabled'}>Set a snare here</button>` : ''}<button class="btn ghost" data-act="close">Close</button></div>`;
    this.ui.showPanel(html, (act) => { if (act === 'snare') { this.ui.closePanel(); this.setSnare(); } });
  }

  openStore() {
    const s = this.save.store;
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Storehouse</h2>
      <div class="sub">Everything you have carried home. The workshop draws on these stores.</div>${this.itemGrid(s, 'The shelves are bare. Bring something home from an expedition.')}
      <h3>Discoveries</h3><div class="kv">${this.save.artifacts.length} artifact${this.save.artifacts.length === 1 ? '' : 's'} in the Hall of Discoveries.</div>`, null);
  }

  openWorkshop() {
    const s = this.save.store, u = this.save.upgrades;
    const done = (r) => r.upgrade && (r.upgrade[0] === 'rod' ? u.rod >= 2 : r.upgrade[0] === 'pack' ? u.pack >= 50 : !!u[r.upgrade[0]]);
    const rows = RECIPES.map((r) => {
      const can = Object.entries(r.needs).every(([k, v]) => (s[k] || 0) >= v);
      const needs = Object.entries(r.needs).map(([k, v]) => `<span class="${(s[k] || 0) >= v ? 'ok' : 'no'}">${v} ${ITEMS[k].name.toLowerCase()} (${s[k] || 0})</span>`).join(' · ');
      return `<div class="row"><div><div>${r.name}</div><div class="need">${r.desc}<br>${needs}</div></div>${done(r) ? '<span class="q" style="color:var(--good)">Done ✓</span>' : `<button class="btn" data-act="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>Make</button>`}</div>`;
    }).join('');
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Workshop</h2><div class="sub">Craft equipment and improve the village with what you have stored.</div>${rows}`, (act, d) => {
      if (act !== 'craft') return;
      const r = RECIPES.find((x) => x.id === d.id);
      for (const [k, v] of Object.entries(r.needs)) s[k] -= v;
      if (r.gives) for (const [k, v] of Object.entries(r.gives)) { if (k === 'snare') this.save.tools.snare = (this.save.tools.snare || 0) + v; else s[k] = (s[k] || 0) + v; }
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
      <div class="actions"><button class="btn" data-act="morning">Sleep until morning</button><button class="btn" data-act="evening">Rest until evening</button></div>`, async (act) => {
      this.ui.closePanel();
      await this.ui.fade(true, { title: act === 'morning' ? 'Morning' : 'Evening' });
      this.sky.time = act === 'morning' ? 7.2 : 18.3; this.sky.refreshEnv(); this.persist();
      await this.ui.fade(false);
    });
  }

  openCamp() {
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Campfire</h2><div class="sub">Your camp at the edge of ${this.ui.esc(this.expedition.name)}. ${this.ui.esc(this.expedition.rumor)}</div>
      <div class="actions"><button class="btn" data-act="wait">Rest an hour</button><button class="btn primary" data-act="home">⌂ Return home</button></div>`, (act) => {
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
      const fish = Object.entries(j.fish).map(([k, v]) => `<div class="item"><span>${ITEMS[k].name}</span><span class="q">${v.count} · best ${v.best} cm</span></div>`).join('');
      const wild = Object.entries(j.wildlife).map(([k, v]) => `<div class="item"><span>${{ fox: 'Red fox', hare: 'Hare' }[k] || k}</span><span class="q">${v.seen}×</span></div>`).join('');
      body = `<h3>Fish caught</h3><div class="grid">${fish || '<div class="sub">None yet.</div>'}</div><h3>Wildlife observed</h3><div class="grid">${wild || '<div class="sub">None yet. Approach animals slowly and watch them.</div>'}</div>`;
    } else if (tab === 'places') {
      body = j.places.slice().reverse().map((p) => `<div class="item"><span>${this.ui.esc(p.name)}</span><span class="q">Exp. ${p.exp}</span></div>`).join('') || '<div class="sub">No landmarks discovered yet.</div>';
      body = `<div class="grid" style="grid-template-columns:1fr">${body}</div>`;
    }
    this.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Journal</h2>
      <div class="tabs"><button data-act="tab" data-t="exp" class="${tab === 'exp' ? 'on' : ''}">Expeditions</button><button data-act="tab" data-t="nature" class="${tab === 'nature' ? 'on' : ''}">Nature</button><button data-act="tab" data-t="places" class="${tab === 'places' ? 'on' : ''}">Places</button></div>${body}`,
    (act, d) => { if (act === 'tab') this.openJournal(d.t); });
  }

  takeFromPack(req) {
    const items = this.pack.items;
    if (req.item) { if ((items[req.item] || 0) < req.qty) return false; items[req.item] -= req.qty; if (!items[req.item]) delete items[req.item]; return true; }
    const cands = Object.entries(items).filter(([k]) => ITEMS[k]?.cat === req.cat).sort((a, b) => b[1] - a[1]);
    if (cands.reduce((a, [, v]) => a + v, 0) < req.qty) return false;
    let need = req.qty;
    for (const [k, v] of cands) { const t = Math.min(v, need); items[k] -= t; if (!items[k]) delete items[k]; need -= t; if (!need) break; }
    return true;
  }
  hasInPack(req) { return req.item ? (this.pack.items[req.item] || 0) >= req.qty : Object.entries(this.pack.items).filter(([k]) => ITEMS[k]?.cat === req.cat).reduce((a, [, v]) => a + v, 0) >= req.qty; }
  reqText(req) { return req.item ? `${req.qty} ${ITEMS[req.item].name.toLowerCase()}` : `${req.qty} ${CATS[req.cat].label.toLowerCase()} (any)`; }

  openTrade(i) {
    const poi = i.poi;
    const rows = i.offers.map((o, idx) => {
      if (o.done) return '';
      const can = this.hasInPack(o.give);
      const get = o.artifact ? `<b>${this.ui.esc(o.artifact.name)}</b> <span style="color:var(--dim)">(unique)</span>` : Object.entries(o.get).map(([k, v]) => `${v} ${ITEMS[k].name.toLowerCase()}`).join(', ');
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
      <label class="set">Volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
      <h3>Controls</h3><div class="kv">${isTouch ? 'Left thumb moves (push fully to run) · right thumb looks · ✋ interacts · ⤒ jumps' : 'WASD move · mouse look (click to capture, Esc to release) · Shift run · Space jump · E or click interact · I pack · J journal · H return home · L lantern'}</div>
      <div class="actions"><button class="btn ghost" data-act="reset">Erase all progress</button><button class="btn ghost" data-act="credits">Credits</button><button class="btn primary" data-act="close">Resume</button></div>`, (act, d, el) => {
      if (act === 'q') { s.quality = d.q; writeSave(this.save); location.reload(); }
      if (act === 'set') {
        if (d.set === 'invertY') s.invertY = el.checked; else s[d.set] = parseFloat(el.value);
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
    this.adaptResolution(dt);
    const input = this.input;
    if (this.state === 'play' && !this.transitioning) {
      if (!this.ui.panelOpen) {
        if (input.wasPressed('KeyE') && !this.fishing.active) this.interact();
        if (input.wasPressed('KeyI') || input.wasPressed('Tab')) this.openPack();
        if (input.wasPressed('KeyJ')) this.openJournal();
        if (input.wasPressed('KeyH') && this.expedition) this.confirmReturnHome();
        if (input.wasPressed('KeyL')) this.toggleLantern();
        if (input.wasPressed('Escape') && !this.fishing.active && !input.locked) this.openMenu();
      } else if (input.wasPressed('Escape')) this.ui.closePanel();
      this.player.update(dt, input, this.world, this.save.settings);
      this.fishing.update(dt, input);
      // wildlife observation
      if (this.observing) {
        const o = this.observing, d = o.fox.pos.distanceTo(this.player.pos);
        if (o.fox.state === 'flee' || d > 26 || this.player.speed > 0.6) { this.ui.observe(null); this.observing = null; if (o.fox.state === 'flee') this.ui.toast('The fox noticed you and bolted.'); }
        else {
          o.t += dt; this.ui.observe(Math.min(1, o.t / 2.6), 'Watching…');
          if (o.t > 2.6) {
            this.ui.observe(null); this.observing = null;
            const j = this.save.journal.wildlife; const first = !j.fox; j.fox = j.fox || { seen: 0, first: this.expedition?.no }; j.fox.seen++;
            const notes = ['It pauses, ears swivelling towards some sound you cannot hear.', 'It noses through the leaf litter, hunting voles.', 'Its coat is thick — winter is coming early to this land.', 'It glances your way, unbothered, then trots on.'];
            this.showCard(`<div class="k">Field note${first ? ' — new species' : ''}</div><div class="n">Red fox</div><div class="s">${notes[Math.floor(Math.random() * notes.length)]}</div><div class="o">Observed ${j.fox.seen} time${j.fox.seen > 1 ? 's' : ''}.</div>`, 3600);
            this.persist();
          }
        }
      }
      this.current = this.findInteraction();
      this.ui.prompt(this.current ? (this.current.type === 'trap' && performance.now() < this.current.setAt + this.current.readyAfter ? 'Snare set — check back later' : this.current.label) : null);
    }
    if (this.world) {
      const p = this.player.pos;
      this.world.stream(p);
      this.pools.flush();
      this.sky.time = (this.sky.time + dt / 120) % 24;
      this.sky.update(dt, this.camera, p);
      this.sky.applyToWater(this.waterMat);
      this.waterMat.uniforms.uTime.value += dt;
      windUniforms.uTime.value += dt; windUniforms.uWind.value = this.sky.w.wind;
      const fm = KIND_INFO.materials; if (fm) { fm.firMat.emissiveIntensity = 0.55 * this.sky.dayFactor * this.sky.w.light; fm.leafMat.emissiveIntensity = 0.5 * this.sky.dayFactor * this.sky.w.light; }
      const night = this.sky.dayFactor < 0.3;
      this.world.update(dt, { player: this.player, night, day: this.sky.dayFactor, wind: this.sky.w.wind, onDiscover: (poi) => this.onDiscover(poi) });
      // audio
      const s = this.world.gen.sample(p.x, p.z);
      let water = 0; for (let a = 0; a < 6.28; a += 0.785) { const d = this.world.depthAt(p.x + Math.cos(a) * 9, p.z + Math.sin(a) * 9); if (d > 0) water += 0.125; }
      this.audio.update(dt, { wind: this.sky.w.wind, forest: s.forest, water: water + Math.max(0, this.world.depthAt(p.x, p.z)), rain: this.sky.w.rain, day: this.sky.dayFactor });
      if (this.state === 'play') this.updateCompass();
      if (this.state === 'title') { this.player.yaw += dt * 0.03; this.player.syncCamera(); }
    }
    input.endFrame();
    if (render) this.renderer.render(this.scene, this.camera);
    if (this.debug) this.debugHud();
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
    for (const t of this.traps) { const dx = t.pos.x - p.x, dz = t.pos.z - p.z; marks.push({ bearing: Math.atan2(dx, -dz), label: 'Snare', cls: 'rumor', dist: Math.round(Math.hypot(dx, dz)) }); }
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
