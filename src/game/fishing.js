// Fishing: read the water, choose your bait, cast, wait for a bite, strike, then play the fish.
// Which fish bites depends on the water (river / lake / pond), the spot (riffle, pool, weed bed,
// lily pads, deep water, open shore), the time of day, the weather and your bait — as it would.
import * as THREE from 'three';
import { FISH, BAIT } from '../data/species.js';
import { know } from './inventory.js';
import { RNG } from '../core/rng.js';
import { viewer } from './specimen.js';
import { buildFish } from '../world/fishModel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPOT_NAMES = { riffle: 'a fast, shallow riffle', pool: 'a deep river pool', weeds: 'the edge of a reed bed', lilies: 'among lily pads', deep: 'deep open water', shore: 'open shallows' };
const WATER_NAMES = { river: 'flowing water', lake: 'a lake', pond: 'a still pond' };

export function timeOfDay(t) { return t >= 4.5 && t < 8 ? 'dawn' : t >= 8 && t < 17 ? 'day' : t >= 17 && t < 21 ? 'dusk' : 'night'; }

export class Fishing {
  constructor(game) {
    this.game = game; this.state = 'idle'; this.rng = new RNG(Date.now() & 0xffffff);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.6 });
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 1.5, 6).translate(0, 0.75, 0), rodMat);
    this.rod.position.set(0.28, -0.32, -0.45); this.rod.rotation.set(-0.95, 0.15, -0.25);
    this.rod.visible = false; game.camera.add(this.rod);
    this.tip = new THREE.Object3D(); this.tip.position.set(0, 1.5, 0); this.rod.add(this.tip);
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.5 }));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }));
    this.bobber.add(top, bot); this.bobber.visible = false; game.scene.add(this.bobber);
    this.lineGeo = new THREE.BufferGeometry(); this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.6 }));
    this.line.frustumCulled = false; this.line.visible = false; game.scene.add(this.line);
    this.ui = { wrap: document.getElementById('fish-ui'), status: document.getElementById('fish-status'), tension: document.getElementById('fish-tension'), progress: document.getElementById('fish-progress'), reel: document.getElementById('btn-reel'), bars: document.getElementById('fish-bars') };
    this.held = false;
    const down = (e) => { e.preventDefault(); this.held = true; if (this.state === 'bite') this.strike(); else if (this.state === 'wait' && this.t > 0.5) this.cancel('You reel in your line.'); };
    const up = () => { this.held = false; };
    this.ui.reel.addEventListener('pointerdown', down); this.ui.reel.addEventListener('pointerup', up); this.ui.reel.addEventListener('pointercancel', up); this.ui.reel.addEventListener('pointerleave', up);
    window.addEventListener('mousedown', (e) => { if (this.state === 'fight' && e.button === 0) this.held = true; });
    window.addEventListener('mouseup', () => { this.held = false; });
    this.jumper = null;
  }

  get active() { return this.state !== 'idle'; }

  // locate fishable water in front of the player and read it
  findSpot(player, world) {
    if (world.kind !== 'wild') return null;
    const gen = world.gen, water = gen.p.water;
    if (water - world.heightAt(player.pos.x, player.pos.z) > 0.8) return null;
    const f = player.forward(new THREE.Vector3());
    for (let d = 2.5; d <= 11; d += 0.75) {
      const x = player.pos.x + f.x * d, z = player.pos.z + f.z * d;
      const depth = water - world.heightAt(x, z);
      if (depth > 0.5) {
        // cast a little further out if there is room
        let cx = x, cz = z, cd = depth;
        for (let e = 1; e <= 4; e++) { const x2 = x + f.x * e, z2 = z + f.z * e, d2 = water - world.heightAt(x2, z2); if (d2 > 0.5) { cx = x2; cz = z2; cd = d2; } else break; }
        const s = gen.sample(cx, cz);
        const flowing = s.river > 0.2;
        const type = flowing ? 'river' : (s.pond > 0.15 || world.eco.fungi > 1.5) ? 'pond' : 'lake';
        let spot;
        if (flowing) spot = cd < 1.3 ? 'riffle' : 'pool';
        else {
          spot = cd > 3.4 ? 'deep' : 'shore';
          const near = this.nearbyFeature(world, cx, cz, 8);
          if (near) spot = near;
        }
        return { pos: new THREE.Vector3(cx, water, cz), type, spot, depth: cd };
      }
    }
    return null;
  }
  nearbyFeature(world, x, z, r) {
    const cs = world.chunks.size, cx = Math.floor(x / cs), cz = Math.floor(z / cs);
    let best = null, bd = r * r;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = world.chunks.chunks.get(`${cx + dx},${cz + dz}`); if (!c?.spots) continue;
      for (const s of c.spots) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s.type; } }
    }
    return best;
  }

  weights(spot, bait) {
    const g = this.game, exp = g.expedition;
    const tod = timeOfDay(g.sky.time), weather = g.sky.weatherName;
    const out = [];
    for (const [id, f] of Object.entries(FISH)) {
      const wW = f.water[spot.type] || 0; if (!wW) continue;
      const anySpot = Object.keys(f.spots).length;
      let w = wW * (anySpot ? (f.spots[spot.spot] ?? 0.45) : 1) * (f.time[tod] ?? 1) * (f.weather[weather] ?? 1) * (f.bait[bait] ?? 0.08);
      if (f.rare) w *= 0.35;
      if (f.cold) w *= exp?.scenario === 'highlands' ? 1.6 : 0.3;
      if (exp?.fishBias?.[id]) w *= exp.fishBias[id];
      if (w > 0.001) out.push([id, w]);
    }
    return out;
  }

  // choose bait, then cast
  prepare(spot) {
    const g = this.game, b = g.save.bait;
    const opts = Object.entries(BAIT).map(([id, bt]) => {
      const n = b[id] || 0, ok = n > 0;
      return `<button class="bait ${ok ? '' : 'off'} ${g.lastBait === id ? 'on' : ''}" data-act="${ok ? 'bait' : ''}" data-id="${id}"><b>${bt.name}</b><span>${bt.consumable ? `${n} left` : n ? 'reusable' : 'none'}</span><i>${bt.desc}</i></button>`;
    }).join('');
    const tod = timeOfDay(g.sky.time);
    g.ui.showPanel(`<button class="close" data-act="close">Not now</button><h2>Fishing</h2>
      <div class="sub">You are looking at <b>${SPOT_NAMES[spot.spot]}</b> in ${WATER_NAMES[spot.type]}, about ${spot.depth.toFixed(1)} m deep. It is ${tod === 'day' ? 'the middle of the day' : tod}${g.sky.weatherName !== 'clear' ? `, ${g.sky.weatherName}` : ''}.</div>
      <div class="kv">${this.hint(spot, tod)}</div>
      <h3>Choose your bait</h3><div class="baits">${opts}</div>
      <div class="kv" style="margin-top:10px">${!Object.values(b).some((n) => n > 0) ? 'You have no bait. Dig for worms in damp soil (from your pack), break open rotten logs for grubs, or tie flies at the workshop.' : ''}</div>`,
    (act, d) => { if (act === 'bait') { g.lastBait = d.id; g.ui.closePanel(); this.start(spot, d.id); } });
  }
  hint(spot, tod) {
    const tips = {
      riffle: 'Trout and grayling hold in fast, oxygen-rich riffles, facing upstream to catch drifting insects.',
      pool: 'Big fish rest in deep pools out of the current. Salmon lie here when the river is up.',
      weeds: 'Reed beds give cover: perch hunt the edges and pike wait in ambush.',
      lilies: 'Lily pads shade the water — tench, rudd and carp feed beneath them.',
      deep: 'Deep, cold water holds char, bream and, at dusk, zander.',
      shore: 'Open shallows: roach and perch, and bream moving in at dawn and dusk.',
    }[spot.spot];
    const t = tod === 'night' ? ' At night, eels and burbot hunt.' : tod === 'dawn' || tod === 'dusk' ? ' Dawn and dusk are prime feeding times.' : ' Midday is slow for many fish.';
    return tips + t;
  }

  start(spot, bait) {
    const g = this.game;
    this.spot = spot; this.bait = bait; this.state = 'cast'; this.t = 0;
    this.rod.visible = true; this.bobber.visible = true; this.line.visible = true;
    this.ui.wrap.classList.remove('hidden'); this.ui.bars.classList.add('hidden'); this.ui.reel.classList.add('hidden');
    this.setStatus(`Casting with ${BAIT[bait].name.toLowerCase()}…`);
    g.player.frozen = true;
    this.castFrom = new THREE.Vector3(); this.tip.getWorldPosition(this.castFrom);
    const W = this.weights(spot, bait); this.W = W;
    const total = W.reduce((a, [, w]) => a + w, 0);
    const rise = g.world.ambience?.risesNear?.(spot.pos, 6) ? 2 : 1;
    const rate = Math.min(2.4, Math.max(0.25, (total / 2.2) * rise));
    this.wait = (this.rng.range(5, 13) / rate);
    this.nibbles = this.rng.int(0, 2);
    this.dead = total < 0.08;
    if (rise > 1) g.ui.toast('You cast near where a fish just rose.');
  }

  setStatus(t, alert = false) { this.ui.status.textContent = t; this.ui.status.classList.toggle('alert', alert); }

  cancel(msg) {
    this.state = 'idle';
    this.rod.visible = false; this.bobber.visible = false; this.line.visible = false;
    this.ui.wrap.classList.add('hidden');
    this.game.player.frozen = false; this.held = false;
    if (this.jumper) { this.game.scene.remove(this.jumper); this.jumper = null; }
    if (msg) this.game.ui.toast(msg);
  }

  useBait(lostReusable = false) {
    const b = this.game.save.bait, bt = BAIT[this.bait];
    if (bt.consumable || lostReusable) b[this.bait] = Math.max(0, (b[this.bait] || 0) - 1);
  }

  strike() {
    if (this.state !== 'bite') return;
    const g = this.game;
    let r = this.rng.next() * this.W.reduce((a, [, w]) => a + w, 0), id = this.W[0][0];
    for (const [s, w] of this.W) { r -= w; if (r <= 0) { id = s; break; } }
    const f = FISH[id]; this.species = id;
    const [a, b] = f.size;
    this.size = Math.round(a + (b - a) * Math.pow(this.rng.next(), 1.7));
    this.strength = f.strength * (0.7 + (this.size - a) / (b - a) * 0.6);
    this.state = 'fight'; this.T = 0.25; this.P = 0.15; this.pull = 0; this.pullT = 1; this.lowT = 0;
    this.ui.bars.classList.remove('hidden'); this.ui.reel.textContent = 'Hold to reel';
    this.setStatus('Fish on! Reel steadily — ease off when the line strains.');
    g.audio.splash(0.6);
  }

  update(dt, input) {
    if (this.state === 'idle') return;
    const g = this.game, water = g.world.gen.p.water;
    const tipW = new THREE.Vector3(); this.tip.getWorldPosition(tipW);
    const mv = input.moveVector();
    if ((input.wasPressed('Escape') || mv.y !== 0 || mv.x !== 0) && this.state !== 'cast') { this.cancel('You reel in your line.'); return; }
    const pressE = input.wasPressed('KeyE'), holdE = input.keys.has('KeyE');
    this.t += dt;
    const bp = this.bobber.position;
    if (this.state === 'cast') {
      const k = Math.min(1, this.t / 0.8);
      bp.lerpVectors(this.castFrom, this.spot.pos, k); bp.y += Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) { this.state = 'wait'; this.t = 0; g.audio.plop(); this.setStatus('Waiting for a bite…'); this.ui.reel.classList.remove('hidden'); this.ui.reel.textContent = 'Reel in'; }
    } else if (this.state === 'wait') {
      bp.copy(this.spot.pos); bp.y = water + Math.sin(this.t * 2.2) * 0.012;
      if (this.dead) { if (this.t > 16) { this.setStatus('Nothing at all. Perhaps the wrong bait, wrong water, or wrong hour.'); } return this.drawLine(tipW, bp); }
      if (this.nibbles > 0 && this.t > this.wait * (0.3 + 0.25 * this.nibbles)) { this.nibbles--; this.dip = 0.25; g.audio.plop(); this.setStatus('A nibble… wait for it…'); }
      if (this.dip > 0) { this.dip -= dt; bp.y -= 0.03; }
      if (pressE && this.t > 0.3) { this.cancel('You reel in your line.'); return; }
      if (this.t > this.wait) { this.state = 'bite'; this.t = 0; this.window = g.save.upgrades.rod >= 2 ? 1.5 : 1.1; this.setStatus('A bite! Strike now!', true); this.ui.reel.textContent = 'Strike!'; g.audio.splash(0.35); }
    } else if (this.state === 'bite') {
      bp.copy(this.spot.pos); bp.y = water - 0.06 - Math.abs(Math.sin(this.t * 18)) * 0.04;
      if (pressE) this.strike();
      else if (this.t > this.window) {
        this.state = 'wait'; this.t = 0; this.wait = this.rng.range(4, 9);
        if (BAIT[this.bait].consumable && this.rng.chance(0.5)) { this.useBait(); this.setStatus(`Too slow — the fish stole your ${BAIT[this.bait].name.toLowerCase()}.`); if ((g.save.bait[this.bait] || 0) <= 0) { this.cancel('You have run out of that bait.'); return; } }
        else this.setStatus('Too slow — it let go. Waiting…');
        this.ui.reel.textContent = 'Reel in';
      }
    } else if (this.state === 'fight') {
      const f = FISH[this.species];
      const hold = this.held || holdE;
      this.pullT -= dt;
      if (this.pullT < 0) {
        this.pull = this.rng.range(0.35, 1.0) * this.strength; this.pullT = this.rng.range(0.8, 2.2) / (this.species === 'pike' ? 1.4 : 1);
        if (f.jumps && this.rng.chance(0.4)) this.leap();
      }
      const surge = this.pullT < 0.6 ? this.pull : 0;
      const rodK = g.save.upgrades.rod >= 2 ? 0.75 : 1;
      if (hold) { this.T += (0.36 + surge * 1.05) * rodK * dt; this.P += 0.2 * dt / (0.55 + this.strength * 0.45); if (Math.random() < dt * 12) g.audio.reel(); }
      else { this.T -= 0.6 * dt; this.T += surge * 0.25 * dt; this.P -= (0.03 + surge * 0.06) * dt; }
      if (this.species === 'eel') this.P -= 0.02 * dt; // eels pull steadily backwards
      this.T = Math.max(0, this.T);
      bp.copy(this.spot.pos).lerp(new THREE.Vector3(g.player.pos.x, water, g.player.pos.z), Math.max(0, this.P) * 0.8);
      bp.x += Math.sin(this.t * 7) * 0.15 * surge; bp.y = water - 0.05;
      if (this.T >= 1) { const reusable = !BAIT[this.bait].consumable; this.useBait(reusable); this.cancel(`Snap! The line broke${reusable ? ` — your ${BAIT[this.bait].name.toLowerCase()} is gone too` : ''}.`); g.audio.splash(1); return; }
      if (this.P <= 0) { this.lowT += dt; if (this.lowT > 1.6) { this.useBait(); this.cancel('The fish shook free.'); return; } } else this.lowT = 0;
      if (this.P >= 1) { this.useBait(); this.land(); return; }
      this.ui.tension.style.width = `${Math.min(100, this.T * 100)}%`;
      this.ui.tension.style.background = this.T > 0.82 ? '#d27b62' : '';
      this.ui.progress.style.width = `${Math.max(0, this.P) * 100}%`;
      this.setStatus(surge ? ({ pike: 'It shakes its head violently!', carp: 'A long, powerful run!', eel: 'It twists and pulls backwards!', salmon: 'It tears line off the reel!' }[this.species] || 'It\'s pulling hard!') : 'Reel it in…', !!surge);
    }
    this.updateJumper(dt);
    this.drawLine(tipW, bp);
  }

  leap() { // trout and salmon jump clear of the water when hooked
    const g = this.game;
    if (this.jumper) g.scene.remove(this.jumper);
    const m = buildFish(this.species); m.scale.setScalar(this.size / 100);
    m.position.copy(this.bobber.position); m.userData.t = 0; m.userData.dir = Math.random() * 6.28;
    g.scene.add(m); this.jumper = m; g.audio.splash(0.9);
  }
  updateJumper(dt) {
    const m = this.jumper; if (!m) return;
    m.userData.t += dt; const t = m.userData.t / 0.7;
    if (t > 1) { this.game.scene.remove(m); this.jumper = null; this.game.audio.splash(0.7); return; }
    m.position.x = this.bobber.position.x + Math.cos(m.userData.dir) * t * 0.8; m.position.z = this.bobber.position.z + Math.sin(m.userData.dir) * t * 0.8;
    m.position.y = this.game.world.gen.p.water + Math.sin(t * Math.PI) * 0.9;
    m.rotation.set(0, -m.userData.dir, Math.cos(t * Math.PI) * 0.9);
  }
  drawLine(tipW, bp) {
    const a = this.lineGeo.attributes.position.array;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      a[i * 3] = tipW.x + (bp.x - tipW.x) * t; a[i * 3 + 2] = tipW.z + (bp.z - tipW.z) * t;
      a[i * 3 + 1] = tipW.y + (bp.y - tipW.y) * t - Math.sin(t * Math.PI) * (this.state === 'fight' ? 0.05 : 0.35);
    }
    this.lineGeo.attributes.position.needsUpdate = true;
  }

  land() {
    const g = this.game, id = this.species, size = this.size, f = FISH[id];
    this.cancel(); g.audio.splash(0.8);
    const k = know(g.save, id); k.caught++;
    const best = size > k.best; if (best) k.best = size;
    const kg = Math.max(0.05, 0.0105 * Math.pow(size, 3) / 1000 * (id === 'eel' ? 0.35 : id === 'bream' || id === 'carp' ? 1.3 : id === 'pike' ? 0.75 : 1));
    const v = viewer();
    const small = f.small;
    g.ui.showPanel(`<h2>${esc(f.name)} <i style="font-size:15px;color:var(--dim)">${esc(f.latin)}</i></h2>
      <div class="sub">${size} cm · about ${kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(1) + ' kg'}${best ? ' · <b style="color:var(--accent)">your best yet</b>' : ''}</div>
      <div class="examine"><div class="viewwrap"><div id="spec-view"></div><div class="hint">Drag to turn it</div></div>
      <div class="notes"><ul class="obs"><li><b>Look:</b> ${esc(f.look)}</li><li>${esc(f.facts)}</li></ul>
      ${f.endangered ? '<div class="tell">Critically endangered. Anglers are asked to return every eel to the water.</div>' : ''}</div></div>
      <div class="actions"><button class="btn ghost" data-act="release">Release it</button>${small ? '<button class="btn ghost" data-act="bait">Keep as bait</button>' : ''}<button class="btn primary" data-act="keep">Keep it</button></div>`,
    (act) => {
      if (act === 'release') { k.released++; g.ui.closePanel(); g.audio.splash(0.5); g.ui.toast(f.endangered ? 'You slip the eel back into the water. A small kindness to a long journey.' : `You release the ${f.name.toLowerCase()}.`); }
      if (act === 'bait') { g.save.bait.minnow = (g.save.bait.minnow || 0) + 2; g.ui.closePanel(); g.ui.toast('+2 minnow-sized baits'); }
      if (act === 'keep') { const ok = g.addToPack(id, 1, true); g.ui.closePanel(); g.ui.toast(ok ? `${f.name} added to your pack.` : 'Your pack is full — you let it go.'); }
      g.persist();
    });
    v.show('fish', id); v.mount(document.getElementById('spec-view'));
  }
}
