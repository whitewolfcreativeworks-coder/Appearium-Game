// Build mode: choose a piece, see a ghost of it where you look, turn it, place it; or take
// things down again (everything is refunded). Works with mouse/keyboard and with touch buttons.
import * as THREE from 'three';
import { BUILD, BUILD_CATS, snapPose, canAfford, costText, buildPiece, aimPoint } from './building.js';
import { Builder } from '../world/structures.js';
import { FISH } from '../data/species.js';
import { writeSave } from './save.js';

const $ = (id) => document.getElementById(id);

export class BuildMode {
  constructor(game) {
    this.game = game; this.active = false; this.piece = null; this.rot = 0; this.removing = false;
    this.ghostMat = { ok: new THREE.MeshBasicMaterial({ color: 0x9fe08a, transparent: true, opacity: 0.45, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: 0xe0705a, transparent: true, opacity: 0.45, depthWrite: false }) };
    this.cat = 'house';
    const bar = $('build-bar');
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('[data-b]')?.dataset.b; if (!a) return;
      if (a === 'place') this.commit(); if (a === 'rotate') this.turn(); if (a === 'done') this.stop(); if (a === 'menu') this.open();
    });
  }

  get village() { return this.game.world?.kind === 'village' ? this.game.world : null; }

  // ---------------------------------------------------------------- catalogue panel
  open() {
    const g = this.game, v = this.village; if (!v) return;
    this.stop(true);
    const st = g.save.store, e = (t) => g.ui.esc(t);
    const tabs = BUILD_CATS.map(([k, l]) => `<button class="chip ${this.cat === k ? 'on' : ''}" data-act="cat" data-c="${k}">${l}</button>`).join('');
    let items = '';
    if (this.cat === 'display') {
      const placed = new Set(g.save.builds.filter((b) => b.t === 'artifact').map((b) => b.uid));
      const arts = g.save.artifacts.filter((a) => !placed.has(a.uid));
      items = arts.map((a) => `<button class="bitem ${st.wood >= 2 ? '' : 'off'}" data-act="pick" data-id="artifact" data-uid="${a.uid}"><b>${e(a.name)}</b><span>on a stand · 2 wood</span></button>`).join('') || '<div class="sub">Artifacts you bring home can be displayed in your house. (Ones on display here leave the Hall.)</div>';
      const fishHave = Object.keys(st).filter((k) => FISH[k] && st[k] > 0);
      items += fishHave.length ? `<h3>Mount a fish</h3>${fishHave.map((f) => `<button class="bitem ${st.wood >= 1 ? '' : 'off'}" data-act="pick" data-id="fish_trophy" data-fish="${f}"><b>${e(FISH[f].name)}</b><span>1 wood · uses one ${e(FISH[f].name.toLowerCase())}</span></button>`).join('')}` : '';
    } else {
      items = Object.entries(BUILD).filter(([, d]) => d.cat === this.cat && !d.fish).map(([id, d]) => {
        const ok = canAfford(st, d.cost);
        return `<button class="bitem ${ok ? '' : 'off'}" data-act="pick" data-id="${id}"><b>${e(d.name)}</b><span>${e(costText(d.cost))}</span></button>`;
      }).join('');
    }
    const n = g.save.builds.length;
    g.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Build &amp; decorate</h2>
      <div class="sub">Make this place your own with what you bring home. Walls and floors snap to a 2 m grid; turn a roof panel to choose which way it slopes. Everything you take down is refunded.</div>
      <div class="chips">${tabs}</div><div class="bgrid">${items}</div>
      <div class="actions"><button class="btn ghost" data-act="remove">Take things down${n ? ` (${n} built)` : ''}</button><button class="btn ghost" data-act="close">Done</button></div>`,
    (act, d) => {
      if (act === 'cat') { this.cat = d.c; this.open(); }
      if (act === 'pick') { const def = BUILD[d.id]; if (d.id !== 'artifact' && !canAfford(st, def.cost)) { g.ui.toast(`You need ${costText(def.cost)}.`); return; } g.ui.closePanel(); this.start({ t: d.id, uid: d.uid, fish: d.fish }); }
      if (act === 'remove') { g.ui.closePanel(); this.start(null, true); }
    });
  }

  // ---------------------------------------------------------------- placing
  start(piece, removing = false) {
    this.active = true; this.piece = piece; this.removing = removing;
    $('build-bar').classList.remove('hidden');
    $('build-name').textContent = removing ? 'Take down: look at something you built' : piece.t === 'artifact' ? 'Place your artifact' : BUILD[piece.t].name;
    $('build-place').textContent = removing ? 'Take down' : 'Place';
    $('build-rot').classList.toggle('hidden', removing);
    this.makeGhost();
  }
  stop(silent = false) {
    if (!this.active) return;
    this.active = false; this.piece = null; this.removing = false;
    $('build-bar').classList.add('hidden');
    if (this.ghost) { this.game.scene.remove(this.ghost); this.ghost = null; }
    this.highlight(null);
  }
  turn() { this.rot += this.piece && BUILD[this.piece.t]?.snap !== 'free' ? Math.PI / 2 : Math.PI / 8; }

  makeGhost() {
    if (this.ghost) { this.game.scene.remove(this.ghost); this.ghost = null; }
    if (this.removing || !this.piece) return;
    const b = new Builder(); const v = this.village;
    buildPiece(b, { ...this.piece, x: 0, z: 0, rot: 0 }, 0, this.game.save);
    const grp = b.finish('ghost');
    grp.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat.ok; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 5; } });
    this.ghost = grp; this.game.scene.add(grp); void v;
  }

  // the pose the current piece would take where the player is looking
  pose() {
    const v = this.village; if (!v || !this.piece) return null;
    const p = aimPoint(this.game.camera, v.h0); if (!p) return null;
    const def = BUILD[this.piece.t] || { snap: 'free' };
    const s = snapPose(def, p.x, p.z, this.rot);
    if (def.snap === 'cell' || def.snap === 'free') s.rot = def.snap === 'cell' ? Math.round(this.rot / (Math.PI / 2)) * (Math.PI / 2) : s.rot;
    // inside one of the village's buildings things stand on its floor; hanging things go up on the beams
    const inside = v.structAt?.(s.x, s.z);
    s.y = inside ? (def.hang ? 0.12 + inside.H - 0.12 : 0.12) : 0;
    return { ...this.piece, ...s, inside: inside?.id || null };
  }
  valid(pc) {
    const v = this.village, g = this.game, def = BUILD[pc.t];
    if (Math.hypot(pc.x, pc.z) > v.R - 2.2) return 'Too close to the palisade.';
    if (def && !canAfford(g.save.store, pc.t === 'fish_trophy' ? { wood: 1 } : def.cost)) return `You need ${costText(def.cost)}.`;
    if (pc.t === 'artifact' && (g.save.store.wood || 0) < 2) return 'You need 2 wood for the stand.';
    // the same slot can hold one floor, one wall and one roof
    const kind = (t) => (BUILD[t]?.snap === 'cell' ? (BUILD[t].roof ? 'roof' : 'floor') : BUILD[t]?.snap === 'edge' ? 'wall' : 'free');
    for (const b of g.save.builds) {
      if (kind(b.t) !== 'free' && kind(b.t) === kind(pc.t) && Math.abs(b.x - pc.x) < 0.1 && Math.abs(b.z - pc.z) < 0.1) return 'Something is already built there.';
      if (kind(pc.t) === 'free' && kind(b.t) === 'free' && Math.hypot(b.x - pc.x, b.z - pc.z) < 0.4) return 'Too close to something else.';
    }
    // inside the village's buildings: furniture and decorations only, and hanging things need a ceiling
    if (def?.hang && !pc.inside) return 'Hang it from the beams inside a building.';
    if (def && def.snap !== 'free' && v.structAt?.(pc.x, pc.z, -0.8)) return 'That would be inside one of the village buildings.';
    for (const c of def?.hang ? [] : v.structColliders || []) {
      const r = 0.25;
      if (c.r !== undefined ? Math.hypot(c.x - pc.x, c.z - pc.z) < c.r + r : (() => { const cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0)), dx = pc.x - c.x, dz = pc.z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r; })()) return 'Something is in the way there.';
    }
    // don't build into the village's own buildings
    for (const c of v.baseColliders || []) {
      const r = def?.snap === 'free' ? 0.3 : 0.6;
      if (c.r !== undefined ? Math.hypot(c.x - pc.x, c.z - pc.z) < c.r + r : Math.abs(c.x - pc.x) < c.hw + r + 0.4 && Math.abs(c.z - pc.z) < c.hd + r + 0.4) return 'That spot is taken by the village.';
    }
    return null;
  }

  update() {
    if (!this.active) return;
    const g = this.game, input = g.input;
    if (input.wasPressed('KeyR')) this.turn();
    if (input.wasPressed('Escape') || input.wasPressed('KeyB')) { this.stop(); return; }
    if (input.wasPressed('KeyE')) this.commit();
    if (this.removing) { const t = this.target(); this.highlight(t); $('build-cost').textContent = t ? `${BUILD[t.t]?.name || 'Artifact stand'} — refund in full` : ''; return; }
    const pc = this.pose();
    if (!pc) { if (this.ghost) this.ghost.visible = false; $('build-cost').textContent = 'Look at the ground where you want to build'; return; }
    const bad = this.valid(pc);
    this.ghost.visible = true;
    this.ghost.position.set(pc.x, this.village.h0 + 0.01 + (pc.y || 0), pc.z); this.ghost.rotation.y = pc.rot;
    this.ghost.traverse((o) => { if (o.isMesh) o.material = bad ? this.ghostMat.bad : this.ghostMat.ok; });
    $('build-cost').textContent = bad || (pc.t === 'artifact' ? 'Costs 2 wood' : pc.t === 'fish_trophy' ? 'Costs 1 wood and the fish' : costText(BUILD[pc.t].cost));
  }

  commit() {
    const g = this.game, v = this.village; if (!v || !this.active) return;
    if (this.removing) {
      const t = this.target(); if (!t) return;
      g.save.builds = g.save.builds.filter((b) => b !== t);
      const refund = t.t === 'artifact' ? { wood: 2 } : t.t === 'fish_trophy' ? { wood: 1, [t.fish]: 1 } : BUILD[t.t].cost;
      for (const [k, n] of Object.entries(refund)) g.save.store[k] = (g.save.store[k] || 0) + n;
      writeSave(g.save); v.buildPlaced(); v.buildDynamic(); g.audio.craft?.(); this.highlight(null);
      return;
    }
    const pc = this.pose(); if (!pc) return;
    const bad = this.valid(pc); if (bad) { g.ui.toast(bad); return; }
    const cost = pc.t === 'artifact' ? { wood: 2 } : pc.t === 'fish_trophy' ? { wood: 1, [pc.fish]: 1 } : BUILD[pc.t].cost;
    for (const [k, n] of Object.entries(cost)) { g.save.store[k] -= n; if (g.save.store[k] <= 0) delete g.save.store[k]; }
    const rec = { t: pc.t, x: pc.x, z: pc.z, rot: +pc.rot.toFixed(4) }; if (pc.uid) rec.uid = pc.uid; if (pc.fish) rec.fish = pc.fish; if (pc.y) rec.y = +pc.y.toFixed(3);
    g.save.builds.push(rec); writeSave(g.save);
    v.buildPlaced(); if (pc.t === 'artifact') v.buildDynamic();
    g.audio.craft?.();
    if (pc.t === 'artifact' || pc.t === 'fish_trophy' || !canAfford(g.save.store, BUILD[pc.t].cost)) this.stop();
  }

  // a placed piece near where the player is looking
  target() {
    const v = this.village; const p = aimPoint(this.game.camera, v.h0, 10); if (!p) return null;
    let best = null, bd = 1.3;
    for (const b of this.game.save.builds) { const d = Math.hypot(b.x - p.x, b.z - p.z) - (BUILD[b.t]?.roof ? 0.3 : 0); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  highlight(b) {
    if (this.hl && this.hl.b === b) return;
    if (this.hl) { this.game.scene.remove(this.hl.obj); this.hl = null; }
    if (!b) return;
    const v = this.village, def = BUILD[b.t];
    const w = def?.snap === 'edge' ? 2.1 : def?.snap === 'cell' ? 2.1 : 1.0, d = def?.snap === 'edge' ? 0.4 : w;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, def?.snap === 'edge' || def?.roof ? 2.9 : 1.2, d), this.ghostMat.bad);
    box.position.set(b.x, v.h0 + (def?.roof ? 2.9 : def?.snap === 'edge' ? 1.45 : 0.6), b.z); box.rotation.y = b.rot || 0;
    this.game.scene.add(box); this.hl = { b, obj: box };
  }
}
