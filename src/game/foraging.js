// Foraging: examine a find up close, compare it with the handbook, decide what it is.
// What you pick is labelled with YOUR identification; the herbalist at home checks it.
import { MUSHROOMS, PLANTS, STATUS, SAFETY_NOTE } from '../data/species.js';
import { forageKey, know, recognised, speciesOf, itemInfo, parseKey } from './inventory.js';
import { viewer, isBall } from './specimen.js';
import { applyEffect } from './body.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstSentence = (t) => t.split(/\. |\.$/)[0];

const BASE_NOTE = {
  death_cap: 'A white, sac-like cup (volva) wraps the base of the stem.',
  fly_agaric: 'A bulbous base ringed with white scales.',
  parasol: 'A bulbous base — no sac.',
  porcini: 'A fat, swollen base.', bitter_bolete: 'A swollen base.',
};

function observations(id, seen) {
  const sp = speciesOf(id), L = sp.look, out = [];
  if (MUSHROOMS[id]) {
    out.push(['Cap', L.cap]);
    out.push(['Growing', firstSentence(L.grows)]);
    if (seen.under) out.push(['Underneath', L.under]);
    if (seen.side) out.push(['Stem', L.stem]);
    if (seen.dig) out.push(['Base', BASE_NOTE[id] || 'Nothing unusual at the base.']);
    if (seen.cut) out.push(['Inside', L.flesh]);
    if (seen.smell) out.push(['Smell', L.smell]);
    if (seen.spore) out.push(['Spore print', L.spore]);
  } else {
    out.push(['Plant', L.plant]);
    out.push(['Fruit / flowers', L.fruit]);
    out.push(['Growing', L.grows]);
    if (seen.smell) out.push(['Crushed leaf', id === 'ramsons' ? 'Smells strongly of garlic.' : id === 'wood_sorrel' ? 'Sharp and lemony.' : id === 'nettle' ? 'Grassy — and it stings!' : 'No garlic smell at all.']);
  }
  return out;
}

export function startExamine(game, inter) {
  const id = inter.species, isM = !!MUSHROOMS[id];
  const seen = { under: false, side: false, dig: false, cut: false, smell: false, spore: false };
  let selected = null;
  const k = know(game.save, id); k.seen++;
  const list = isM ? MUSHROOMS : PLANTS;
  const v = viewer();

  const render = () => {
    const obs = observations(id, seen).map(([a, b]) => `<li><b>${a}:</b> ${esc(b)}</li>`).join('');
    const cands = Object.entries(list).map(([cid, c]) => `<button class="chip ${selected === cid ? 'on' : ''}" data-act="sel" data-id="${cid}">${esc(c.name)}</button>`).join('');
    let cmp = '';
    if (selected) {
      const c = list[selected], st = STATUS[c.status];
      const rows = Object.entries(c.look).map(([kk, vv]) => `<li><b>${({ cap: 'Cap', under: 'Underneath', stem: 'Stem', flesh: 'Flesh', smell: 'Smell', spore: 'Spore print', grows: 'Grows', plant: 'Plant', fruit: 'Fruit', } )[kk] || kk}:</b> ${esc(vv)}</li>`).join('');
      cmp = `<div class="hb"><div class="hb-h"><span class="n">${esc(c.name)}</span> <i>${esc(c.latin)}</i> <span class="st" style="color:${st.color}">${st.label}</span></div><ul>${rows}</ul>${c.tell ? `<div class="tell">Tell apart: ${esc(c.tell)}</div>` : ''}</div>`;
    }
    const btn = (act, label, done) => `<button class="btn ${done ? 'ghost' : ''}" data-act="${act}">${label}${done ? ' ✓' : ''}</button>`;
    const tools = isM
      ? [btn('under', 'Look underneath', seen.under), btn('side', 'Look at the stem', seen.side), MUSHROOMS[id].habitat === 'ground' && !isBall(id) ? btn('dig', 'Dig around the base', seen.dig) : '', isBall(id) ? btn('cut', 'Slice it open', seen.cut) : '', btn('smell', 'Smell it', seen.smell), btn('spore', 'Take a spore print', seen.spore)].join('')
      : [btn('side', 'Look closely', seen.side), PLANTS[id].kind === 'green' ? btn('smell', 'Crush a leaf and smell', seen.smell) : ''].join('');
    const html = `<button class="close" data-act="close">Leave it</button><h2>${isM ? 'Examine the mushrooms' : 'Examine the plant'}</h2>
      <div class="examine"><div class="viewwrap"><div id="spec-view"></div><div class="hint">Drag to turn it</div></div>
      <div class="notes"><h3>Your observations</h3><ul class="obs">${obs}</ul><div class="tools">${tools}</div></div></div>
      <h3>Compare with your handbook</h3><div class="chips">${cands}</div>${cmp}
      <div class="actions"><button class="btn ghost" data-act="close">Leave it</button><button class="btn ghost" data-act="pick-unknown">Pick — not sure what it is</button>${selected ? `<button class="btn primary" data-act="pick">Pick as ${esc(list[selected].name)}</button>` : ''}</div>
      <div class="safety">${esc(SAFETY_NOTE)}</div>`;
    const keepScroll = document.getElementById('panel').scrollTop;
    game.ui.showPanel(html, onAct);
    document.getElementById('panel').scrollTop = keepScroll;
    v.mount(document.getElementById('spec-view'));
  };

  const onAct = (act, d) => {
    switch (act) {
      case 'under': seen.under = true; v.view('under'); break;
      case 'side': seen.side = true; v.view('side'); break;
      case 'dig': seen.dig = true; v.dig(); v.view('side'); game.audio.dig?.(); break;
      case 'cut': seen.cut = true; v.show('mushroom', id, { cut: true }); v.view('side'); break;
      case 'smell': seen.smell = true; break;
      case 'spore': seen.spore = true; game.sky.time = (game.sky.time + 0.5) % 24; game.ui.toast('You leave the cap gills-down on paper for a while, then lift it…'); break;
      case 'sel': selected = d.id; break;
      case 'pick': pick(game, inter, selected); return;
      case 'pick-unknown': pick(game, inter, '?'); return;
    }
    render();
  };
  v.show(isM ? 'mushroom' : 'plant', id, { seed: 7 });
  render();
}

function pick(game, inter, label) {
  const verified = label === inter.species && recognised(game.save, inter.species);
  const key = forageKey(inter.species, label, verified);
  const got = game.addToPack(key, inter.qty, true);
  if (!got) { game.ui.toast('Your pack is full.'); return; }
  game.world.removeGatherable(inter);
  game.ui.closePanel();
  game.audio.pickup();
  game.ui.toast(`Picked ${got} × ${esc(itemInfo(key).name)}`);
  if (inter.species === 'nettle') { const f = game.addToPack('fibre', 1, true); if (f) game.ui.toast('+1 plant fibre from the stems'); }
  game.current = null;
}

// recognised species are picked straight away; otherwise open the examine view
export function interactForage(game, inter) {
  if (recognised(game.save, inter.species)) {
    const key = forageKey(inter.species, inter.species, true);
    const got = game.addToPack(key, inter.qty, true);
    if (!got) { game.ui.toast('Your pack is full.'); return; }
    game.world.removeGatherable(inter); game.audio.pickup();
    game.ui.toast(`You recognise them at once — <b>${esc(speciesOf(inter.species).name)}</b>. +${got}`);
    if (inter.species === 'nettle') game.addToPack('fibre', 1, true);
    game.current = null;
    return;
  }
  startExamine(game, inter);
}
export function forageLabel(game, inter) {
  if (recognised(game.save, inter.species)) return `Pick ${speciesOf(inter.species).name.toLowerCase()}`;
  return inter.mushroom ? 'Examine the mushrooms' : 'Examine the plant';
}

// ---------------------------------------------------------------- eating raw
export function eatRaw(game, key) {
  const info = itemInfo(key); const bag = game.expedition ? game.pack.items : game.save.store;
  if (!bag[key]) return;
  const p = parseKey(key);
  if (!info.forage) { game.ui.toast(info.fish ? 'Fish must be cooked at a fire first.' : 'That needs cooking first.'); return; }
  bag[key]--; if (!bag[key]) delete bag[key];
  const sp = speciesOf(p.trueId); know(game.save, p.trueId).eaten++;
  const isM = !!MUSHROOMS[p.trueId];
  let res = null;
  if (sp.effect || (sp.raw && isM) || sp.raw) res = applyEffect(game.body, sp, { raw: true });
  else if (isM) game.body.add('queasy', { onset: 10, dur: 40 });
  if (res === 'bitter') { game.ui.toast('Unbearably bitter — you spit it out.'); }
  else if (res === 'stung') { game.ui.toast('Raw nettle stings your mouth! Cook nettles first.'); }
  else {
    const food = sp.status === 'edible' || sp.status === 'caution' ? (sp.rawFood ?? (isM ? Math.ceil((sp.food || 1) / 2) : 1)) : 0;
    game.body.eat(food);
    game.ui.toast(`You eat the ${esc(info.name.replace(/ \?$/, '').toLowerCase())}.`);
  }
  game.audio.eat?.();
  game.updatePackMeter(); game.persist();
}

// ---------------------------------------------------------------- the herbalist
export function herbalist(game) {
  const store = game.save.store;
  const pending = Object.keys(store).filter((k) => k.startsWith('f:') && store[k] > 0);
  const intro = `<button class="close" data-act="close">Close</button><h2>Maren the herbalist</h2>`;
  if (!pending.length) {
    game.ui.showPanel(`${intro}<div class="sub">"Nothing for me to look at. Bring me what you pick out there — I'll tell you what's what before it ends up in your pot. And remember: when in doubt, leave it out."</div>
      <div class="kv">Species you recognise at a glance: <b>${Object.entries(game.save.knowledge || {}).filter(([id]) => recognised(game.save, id)).map(([id]) => speciesOf(id)?.name).filter(Boolean).join(', ') || 'none yet'}</b></div>`, null);
    return;
  }
  const results = [];
  for (const k of pending) {
    const n = store[k]; delete store[k];
    const p = parseKey(k), tr = speciesOf(p.trueId), kn = know(game.save, p.trueId);
    const safe = ['edible', 'caution'].includes(tr.status);
    let verdict, cls;
    if (p.label === p.trueId) {
      kn.confirmed++; cls = 'ok';
      verdict = `<b>Yes — ${esc(tr.name)}.</b> Well found.${recognised(game.save, p.trueId) && kn.confirmed === 2 ? ' <i>You will recognise these at a glance from now on.</i>' : ''}`;
    } else if (p.label === '?') {
      cls = safe ? 'ok' : 'bad';
      verdict = `<b>This is ${esc(tr.name)}</b> <i>(${esc(tr.latin)})</i> — ${STATUS[tr.status].label.toLowerCase()}. ${esc(firstSentence(tr.facts))}.`;
    } else {
      kn.wrong++; cls = 'bad';
      const lab = speciesOf(p.label);
      verdict = `<b>Not ${esc(lab.name)} — this is ${esc(tr.name)}</b>, ${STATUS[tr.status].label.toLowerCase()}. ${tr.tell ? esc(tr.tell) : (lab.tell ? esc(lab.tell) : '')}`;
    }
    if (safe) { store[`v:${p.trueId}`] = (store[`v:${p.trueId}`] || 0) + n; }
    else verdict += ` <span class="bad">She throws ${n > 1 ? 'them' : 'it'} on the compost heap.</span>`;
    results.push(`<div class="art ${cls}"><div class="n">${n} × ${esc(itemInfo(k).name)}</div><div class="s">${verdict}</div></div>`);
  }
  game.persist(); game.world.buildDynamic?.();
  game.ui.showPanel(`${intro}<div class="sub">Maren tips out your basket on her table and turns each find over in her fingers.</div>${results.join('')}
    <div class="safety">${esc(SAFETY_NOTE)}</div>`, null);
}
