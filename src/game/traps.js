// Trapping: learn a trap step by step, build it from materials, set it where animals actually go.
import * as THREE from 'three';
import { TRAPS, ANIMALS } from '../data/species.js';
import { nearestTrail } from '../world/trails.js';
import { know } from './inventory.js';
import { tex } from '../core/assets.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const QUIZ = {
  snare: { q: 'How high should the bottom of the loop sit above the run?', a: ['On the ground', 'About a hand\'s width (10 cm)', 'Knee height (50 cm)'], ok: 1, why: 'A running hare\'s head passes about a hand\'s width above the ground.' },
  deadfall: { q: 'What holds a figure-4 deadfall set?', a: ['The weight of the stone pressing on the notched sticks', 'A cord tied to a tree', 'Glue made from resin'], ok: 0, why: 'The stone\'s weight locks the three notched sticks together until the trigger is disturbed.' },
  fishtrap: { q: 'Which way should the mouth of the basket face in a stream?', a: ['Upstream', 'Downstream', 'Straight up'], ok: 1, why: 'Fish moving upstream swim into the funnel; the current pushes them deeper into the basket.' },
};

export function lessonPanel(game, id, onDone) {
  const T = TRAPS[id]; let step = 0;
  const render = () => {
    if (step < T.steps.length) {
      const [h, b] = T.steps[step];
      game.ui.showPanel(`<button class="close" data-act="close">Later</button><h2>Lesson: ${esc(T.name)}</h2><div class="sub">Step ${step + 1} of ${T.steps.length}</div>
        <div class="lesson">${diagram(id, step)}<div><h3>${esc(h)}</h3><p>${esc(b)}</p></div></div>
        <div class="actions">${step ? '<button class="btn ghost" data-act="back">Back</button>' : ''}<button class="btn primary" data-act="next">${step === T.steps.length - 1 ? 'Test yourself' : 'Next'}</button></div>
        <div class="safety">${esc(T.note)}</div>`, (act) => { if (act === 'next') step++; if (act === 'back') step--; render(); });
      return;
    }
    const Q = QUIZ[id];
    game.ui.showPanel(`<h2>${esc(T.name)} — check</h2><div class="sub">${esc(Q.q)}</div>${Q.a.map((a, i) => `<button class="btn ghost wide" data-act="ans" data-i="${i}">${esc(a)}</button>`).join('')}`, (act, d) => {
      if (act !== 'ans') return;
      if (+d.i === Q.ok) {
        game.save.lessons[id] = true; game.persist(); game.audio.discover();
        game.ui.showPanel(`<h2>You've learned the ${esc(T.name.toLowerCase())}</h2><div class="sub">${esc(Q.why)}</div><div class="kv">Set it ${esc(T.where.charAt(0).toLowerCase() + T.where.slice(1))} You can now make it at the workshop, or in the field from your pack.</div><div class="actions"><button class="btn primary" data-act="close">Good</button></div>`, null);
        onDone && onDone();
      } else { game.ui.toast('Not quite — go through it once more.'); step = 0; render(); }
    });
  };
  render();
}

// simple SVG diagrams for each step
function diagram(id, step) {
  const S = (inner) => `<svg viewBox="0 0 120 90" class="diag">${inner}</svg>`;
  const ground = '<line x1="5" y1="80" x2="115" y2="80" stroke="#8a7a5a" stroke-width="2"/>';
  if (id === 'snare') {
    const loop = '<ellipse cx="60" cy="56" rx="13" ry="14" fill="none" stroke="#d8c8a0" stroke-width="2"/>';
    const stake = '<line x1="95" y1="84" x2="95" y2="30" stroke="#8a6a4a" stroke-width="5"/><line x1="95" y1="38" x2="72" y2="46" stroke="#d8c8a0" stroke-width="1.5"/>';
    const run = '<path d="M5 80 Q60 76 115 80" stroke="#5a4a30" stroke-width="6" fill="none" opacity=".6"/>';
    return S([run + ground, ground + '<path d="M30 45 q10 -10 20 0 t20 0" stroke="#d8c8a0" fill="none" stroke-width="2"/>', ground + loop, ground + loop + '<line x1="20" y1="80" x2="20" y2="66" stroke="#9fc27a"/><text x="10" y="64" font-size="7" fill="#9fc27a">10 cm</text>', ground + loop + stake, run + ground + loop + stake][Math.min(step, 5)]);
  }
  if (id === 'deadfall') {
    const up = '<line x1="50" y1="80" x2="50" y2="45" stroke="#c8a070" stroke-width="4"/>', diag = '<line x1="32" y1="62" x2="78" y2="30" stroke="#c8a070" stroke-width="4"/>', trig = '<line x1="30" y1="62" x2="88" y2="62" stroke="#c8a070" stroke-width="4"/>';
    const stone = '<polygon points="70,20 112,45 110,55 60,38" fill="#8a8a84"/>', bait = '<circle cx="86" cy="58" r="3" fill="#b4202a"/>';
    return S(ground + [up + diag + trig, up + diag + trig + '<circle cx="50" cy="45" r="3" fill="#e8d8a0"/>', up + diag + trig, up + diag + trig + stone, up + diag + trig + stone + bait][Math.min(step, 4)]);
  }
  const water = '<rect x="0" y="45" width="120" height="45" fill="#2a4a5a" opacity=".6"/><path d="M10 52 h20 M50 60 h25 M85 55 h20" stroke="#a8c8d8" stroke-width="1"/>';
  const basket = '<path d="M30 70 L95 62 L95 80 L30 82 Z" fill="none" stroke="#c8a070" stroke-width="2"/><path d="M40 70 v12 M55 68 v13 M70 66 v15 M85 64 v16" stroke="#c8a070"/>', funnel = '<path d="M30 70 L48 74 L30 82" fill="none" stroke="#e8d0a0" stroke-width="2"/>';
  return S(water + [basket, basket + funnel, basket + funnel + '<circle cx="80" cy="74" r="2.5" fill="#d88"/>', basket + funnel + '<text x="4" y="40" font-size="7" fill="#a8c8d8">current →</text><circle cx="60" cy="86" r="4" fill="#8a8a84"/>', basket + funnel + '<path d="M60 74 q4 -3 8 0 q-4 3 -8 0" fill="#b8a060"/>'][Math.min(step, 4)]);
}

// ---------------------------------------------------------------- models
function trapModel(id, sprung = false) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.9 }), cord = new THREE.MeshStandardMaterial({ color: 0xc8b88a, roughness: 0.8 });
  const stick = (L, r, x, y, z, rx, rz, ry = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 5), wood); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  if (id === 'snare') {
    stick(0.6, 0.02, 0.3, 0.25, 0, 0, 0.1);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(sprung ? 0.03 : 0.065, 0.004, 5, 18), cord); loop.position.set(0, 0.17, 0); loop.rotation.y = Math.PI / 2; g.add(loop);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4), cord); c.position.set(0.15, 0.3, 0); c.rotation.z = 1.2; g.add(c);
  } else if (id === 'deadfall') {
    stick(0.3, 0.012, 0, 0.15, 0, 0, 0);
    if (!sprung) { stick(0.38, 0.012, 0.06, 0.25, 0, 0, -0.95); stick(0.34, 0.012, 0.04, 0.08, 0, 0, Math.PI / 2); }
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0).scale(1.4, 0.35, 1), new THREE.MeshStandardMaterial({ map: tex('terrain/rock_face_diff.jpg'), roughness: 0.95 }));
    stone.position.set(0.18, sprung ? 0.06 : 0.33, 0); stone.rotation.z = sprung ? 0 : -0.55; g.add(stone);
  } else {
    const lat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.9, wireframe: true });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.8, 10, 4, true).rotateZ(Math.PI / 2), lat); b.position.y = 0.1; g.add(b);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.25, 10, 1, true).rotateZ(-Math.PI / 2), lat); f.position.set(-0.3, 0.1, 0); g.add(f);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- placing & checking
export function setTrap(game, id) {
  const p = game.player.pos, w = game.world, f = game.player.forward(new THREE.Vector3());
  if (!game.expedition) return;
  if ((game.save.tools[id] || 0) <= 0) { game.ui.toast(`You have no ${TRAPS[id].name.toLowerCase()}s.`); return; }
  if (game.traps.some((t) => t.pos.distanceTo(p) < 5)) { game.ui.toast('You already set a trap close by.'); return; }
  let x = p.x + f.x * 1.2, z = p.z + f.z * 1.2, q = 0.05, note = '';
  if (id === 'fishtrap') {
    let found = false;
    for (let d = 1; d < 6; d += 0.5) { const tx = p.x + f.x * d, tz = p.z + f.z * d, dep = w.depthAt(tx, tz); if (dep > 0.25 && dep < 1.3) { x = tx; z = tz; found = true; break; } }
    if (!found) { game.ui.toast('Face shallow water (knee-deep) to set the basket.'); return; }
    const s = w.gen.sample(x, z);
    q = s.river > 0.2 ? 0.95 : 0.6;
    note = s.river > 0.2 ? 'You wedge the basket in the current, mouth downstream, and weigh it with stones.' : 'Still water — it may catch something, but flowing water is better.';
  } else {
    if (w.depthAt(x, z) > -0.25) { game.ui.toast('The ground here is too wet.'); return; }
    const nt = nearestTrail(w, x, z, 6);
    if (id === 'snare') {
      if (nt && nt.trail.species === 'hare' && nt.dist < 1.3) { q = 0.9; note = 'You set the noose across the hare run, a hand\'s width above the ground.'; }
      else if (nt && nt.dist < 1.3) { q = 0.15; note = `These are ${ANIMALS[nt.trail.species].name.toLowerCase()} tracks, not a hare run. Unlikely to work.`; }
      else { q = 0.05; note = 'There is no run here. A snare in open ground almost never catches anything — look for a hare trail.'; }
    } else {
      const s = w.gen.sample(x, z);
      const bait = Object.keys(game.pack.items).find((k) => /^(v|f):(bilberry|lingonberry|raspberry|cloudberry)/.test(k)) || (game.save.bait.grub > 0 ? 'grub' : null);
      if (!bait) { game.ui.toast('A deadfall needs bait — berries or a grub.'); return; }
      if (bait === 'grub') game.save.bait.grub--; else { game.pack.items[bait]--; if (!game.pack.items[bait]) delete game.pack.items[bait]; }
      q = (s.forest > 0.4 ? 0.6 : 0.2) * (s.conifer < 0.7 ? 1.2 : 0.8) + (nt?.trail.species === 'squirrel' && nt.dist < 2 ? 0.25 : 0);
      note = q > 0.6 ? 'Good spot — squirrels feed under these trees.' : 'Few squirrels here; it might take a while.';
    }
  }
  game.save.tools[id]--;
  const y = id === 'fishtrap' ? w.gen.p.water - 0.15 : w.heightAt(x, z);
  const model = trapModel(id); model.position.set(x, y, z); model.rotation.y = Math.atan2(f.x, f.z) + (id === 'snare' ? Math.PI / 2 : 0);
  game.scene.add(model); w.objects.push(model);
  game.traps.push({ type: 'trap', trap: id, pos: new THREE.Vector3(x, y + 0.3, z), radius: 1.8, mesh: model, setAt: game.clockNow(), readyAfter: 75 + Math.random() * 60, q, label: `Check the ${TRAPS[id].name.toLowerCase()}` });
  game.audio.dig?.();
  game.ui.toast(note || `${TRAPS[id].name} set.`);
  game.persist();
}

export function checkTrap(game, t) {
  const left = t.setAt + t.readyAfter - game.clockNow();
  if (left > 0) { game.ui.toast(`Nothing yet. Give it about ${Math.ceil(left / 15) * 15} more seconds.`); return; }
  game.scene.remove(t.mesh); game.traps = game.traps.filter((x) => x !== t);
  game.save.tools[t.trap] = (game.save.tools[t.trap] || 0) + 1;
  const night = game.sky.dayFactor < 0.3;
  const p = Math.min(0.95, t.q * (night && t.trap === 'snare' ? 1.25 : 1));
  if (Math.random() > p) { game.ui.toast(`The ${TRAPS[t.trap].name.toLowerCase()} is empty. You take it back.`); game.persist(); return; }
  let msg = '';
  if (t.trap === 'snare') { const a = game.addToPack('hare', 1, true), b = game.addToPack('pelt', 1, true); know(game.save, 'hare').caught++; msg = a || b ? 'A hare in the snare. <b>+1 hare, +1 pelt</b>' : 'A hare — but your pack is full.'; }
  else if (t.trap === 'deadfall') { const a = game.addToPack('squirrel', 1, true); know(game.save, 'squirrel').caught++; msg = a ? 'The stone has fallen. <b>+1 squirrel</b>' : 'A squirrel — but your pack is full.'; }
  else {
    const parts = []; const cf = 1 + Math.floor(Math.random() * 3); if (game.addToPack('crayfish', cf, true)) parts.push(`${cf} crayfish`);
    const mn = 2 + Math.floor(Math.random() * 3); game.save.bait.minnow = (game.save.bait.minnow || 0) + mn; parts.push(`${mn} minnows (bait)`);
    if (night && Math.random() < 0.4 && game.addToPack('eel', 1, true)) { parts.push('an eel'); know(game.save, 'eel').caught++; }
    msg = `You haul up the basket: <b>${parts.join(', ')}</b>.`;
  }
  game.audio.pickup(); game.ui.toast(msg + ' (trap recovered)', true); game.persist();
}

export function trapsPanelHtml(game) {
  const L = game.save.lessons, tools = game.save.tools;
  return Object.entries(TRAPS).map(([id, T]) => {
    const learned = L[id];
    const need = Object.entries(T.needs).map(([k, v]) => `${v} ${k}`).join(', ');
    return `<div class="row"><div>${esc(T.name)} <span class="q">×${tools[id] || 0}</span><div class="need">${learned ? `Makes from ${need}. ${esc(T.where)}` : 'Not learned yet — ask at the workshop.'}</div></div>
      <div>${learned && game.expedition ? `<button class="btn ghost" data-act="trapmake" data-id="${id}">Make</button> <button class="btn" data-act="trapset" data-id="${id}" ${tools[id] ? '' : 'disabled'}>Set here</button>` : ''}</div></div>`;
  }).join('');
}
