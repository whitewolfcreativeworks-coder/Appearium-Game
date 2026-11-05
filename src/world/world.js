// Base class shared by the permanent village and each expedition's wilderness.
import * as THREE from 'three';
import { WorldGen } from './generator.js';
import { ChunkManager, Colliders } from './chunks.js';
import { createTerrainMaterial } from './terrainMaterial.js';
import { makePopulator, GrassField } from './scatter.js';
import { Emitters } from './effects.js';

export class World {
  constructor(game, cfg) {
    this.game = game; this.scene = game.scene; this.cfg = cfg;
    this.gen = cfg.gen || new WorldGen(cfg.seed, cfg.terrain);
    this.eco = cfg.eco; this.autumn = cfg.autumn || 0; this.dryGrass = cfg.dryGrass || 0;
    this.collected = new Set(cfg.collected || []);
    this.colliders = new Colliders();
    this.emitters = new Emitters(this.scene);
    this.statics = [];       // static interactables
    this.objects = [];       // scene objects owned by this world
    this.lights = [];
    this.noGrass = [];       // {x,z,r}
    this.pois = [];
  }

  initStreaming() {
    const g = this.game;
    this.terrainMat = createTerrainMaterial(this.cfg.layers, { water: this.gen.p.water, snowLine: this.gen.p.snowLine, mode: this.cfg.mode, hasDest: !!this.gen.homeGen, strata: this.cfg.strata, tints: this.cfg.tints });
    const populate = makePopulator(this);
    this.chunks = new ChunkManager({ scene: this.scene, gen: this.gen, pools: g.pools, terrainMat: this.terrainMat, waterMat: g.waterMat, radius: g.quality.chunkRadius, colliders: this.colliders,
      populate: (c) => this.populate(c, populate) });
    this.grass = new GrassField(this, g.pools, g.quality);
    this.placedNoGrass = this.placedNoGrass || [];
    this.grassBlocked = (x, z) => this.noGrass.some((n) => (x - n.x) ** 2 + (z - n.z) ** 2 < n.r * n.r) || this.placedNoGrass.some((n) => Math.abs(x - n.x) < n.r && Math.abs(z - n.z) < n.r);
  }

  populate(c, base) { return base(c); }

  add(obj) { this.scene.add(obj); this.objects.push(obj); return obj; }
  addStatic(i) { this.statics.push(i); return i; }
  addColliders(list, ox = 0, oz = 0) { for (const c of list) this.colliders.add({ ...c, x: c.x + ox, z: c.z + oz }); }

  heightAt(x, z) { return this.gen.height(x, z); }
  depthAt(x, z) { return this.gen.p.water - this.gen.height(x, z); }

  // stream everything needed around p; when force, load synchronously (used behind the loading screen)
  stream(p, force = false) {
    const left = this.chunks.update(p, force ? 1e9 : this.game.quality.streamBudget, force);
    this.grass.update(p);
    return left;
  }

  interactablesNear(p, r = 6) {
    const out = [];
    for (const i of this.statics) if (!i.disabled && i.pos.distanceToSquared(p) < (r + (i.radius || 2)) ** 2) out.push(i);
    const cs = this.chunks.size, cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.chunks.chunks.get(`${cx + dx},${cz + dz}`); if (!c) continue;
      for (const i of c.interactables) if (i.pos.distanceToSquared(p) < (r + 2) ** 2) out.push(i);
    }
    return out;
  }

  removeGatherable(i) {
    const c = i.chunk;
    if (c) { c.interactables = c.interactables.filter((x) => x !== i); if (i.poolKey) this.game.pools.hide(i.poolKey, i.owner, i.index); }
    if (i.mesh) { this.scene.remove(i.mesh); }
    if (!c) { i.disabled = true; this.statics = this.statics.filter((x) => x !== i); }
    if (i.id) this.collected.add(i.id);
  }

  update(dt, ctx) { this.emitters.update(dt, ctx); this.ambience?.update(dt, ctx); }

  dispose() {
    this.ambience?.dispose();
    this.chunks?.dispose(); this.grass?.clear(); this.game.pools.clearAll();
    this.emitters.clear();
    for (const o of this.objects) {
      this.scene.remove(o);
      o.traverse?.((m) => { if (m.isMesh && m.userData.disposable) m.geometry.dispose(); });
    }
    this.objects = []; this.statics = []; this.colliders.clear();
  }
}
