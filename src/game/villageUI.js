// Panels for the village: managing a plot (build, upgrade, restyle, convert), using what each
// building makes, the garden beds, and provisions (eaten or used from your pack anywhere).
import { PLOTS, STRUCTS, BUILDABLE, CRAFTS, PROVISIONS, CROPS, STYLE_COSTS, plotRy, levelCost, styleCost, addCost, cropDays } from './villagePlan.js';
import { canAfford, costText, payCost } from './building.js';
import { STYLES, SIZES } from '../world/houses.js';
import { itemInfo, parseKey } from './inventory.js';
import { PLANTS, MUSHROOMS } from '../data/species.js';
import { writeSave } from './save.js';
import { openCooking } from './cooking.js';

const half = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.ceil(v / 2)]));
const styleName = (s) => STYLES[s === 'plank0' ? 'plank' : s]?.name || s;

function refresh(game) { const v = game.world; if (v?.kind !== 'village') return; v.buildPlots(); v.buildDynamic(); v.buildPlaced(); }
function done(game, msg) { writeSave(game.save); game.audio.craft(); refresh(game); game.ui.toast(msg, true); }

// does anything you built freehand stand where this building would go?
function blocked(game, P, level) {
  const { w, d } = SIZES[level], ry = plotRy(P), c = Math.cos(ry), s = Math.sin(ry);
  return (game.save.builds || []).some((b) => { const dx = b.x - P.x, dz = b.z - P.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < w / 2 + 0.6 && Math.abs(lz) < d / 2 + 0.6; });
}

export function openPlot(game, plotId, opts = {}) {
  const save = game.save, store = save.store, P = PLOTS.find((p) => p.id === plotId); if (!P) return;
  const st = save.village.plots[plotId], e = (t) => game.ui.esc(t);
  const style = game.plotStyle || (st ? (st.style === 'plank0' ? 'plank' : st.style) : 'timber');
  const styleChips = (lvl) => Object.entries(STYLES).map(([k, S]) => `<button class="chip ${style === k ? 'on' : ''}" data-act="style" data-s="${k}" title="${e(S.desc)}">${e(S.name)}</button>`).join('');
  let html = '', handler;
  if (!st) {
    const built = new Set(Object.values(save.village.plots).map((q) => q.type));
    const rows = BUILDABLE.map((t) => {
      const S = STRUCTS[t], cost = addCost(levelCost(t, 1), styleCost(style, 1)), ok = canAfford(store, cost) && !built.has(t);
      return `<div class="row"><div><div>${e(S.name)}</div><div class="need">${e(S.desc)}<br>${built.has(t) ? 'You already have one.' : costText(cost, store)}</div></div><button class="btn" data-act="build" data-t="${t}" ${ok ? '' : 'disabled'}>Build</button></div>`;
    }).join('');
    html = `<h2>An empty plot</h2><div class="sub">Choose what to build. Pick an architecture first — it changes how it looks and adds to the cost.</div>
      <div class="chips">${styleChips(1)}</div><div class="kv">${e(STYLES[style].desc)}</div>${rows}`;
    handler = (act, d) => {
      if (act === 'style') { game.plotStyle = d.s; openPlot(game, plotId); return; }
      if (act !== 'build') return;
      const cost = addCost(levelCost(d.t, 1), styleCost(style, 1));
      if (blocked(game, P, 1)) { game.ui.toast('Something you built stands on this plot — take it down first (Build → Take things down).'); return; }
      if (!canAfford(store, cost)) return;
      payCost(store, cost); save.village.plots[plotId] = { type: d.t, level: 1, style };
      game.plotStyle = null; game.ui.closePanel(); done(game, `<b>${STRUCTS[d.t].name}</b> built. Walk in through the door to use it.`);
    };
  } else {
    const S = STRUCTS[st.type], L = st.level, next = L < S.max ? L + 1 : null;
    const cur = st.style === 'plank0' ? 'plank' : st.style;
    const upCost = next ? addCost(levelCost(st.type, next), half(styleCost(cur, next))) : null;
    const restyle = style !== cur ? styleCost(style, L) : null;
    const conv = S.fixed ? '' : BUILDABLE.filter((t) => t !== st.type && !Object.values(save.village.plots).some((q) => q.type === t)).map((t) => {
      const cost = levelCost(t, 1), ok = canAfford(store, cost);
      return `<div class="row"><div><div>${e(STRUCTS[t].name)}</div><div class="need">${costText(cost, store)}</div></div><button class="btn ghost" data-act="convert" data-t="${t}" ${ok ? '' : 'disabled'}>Convert</button></div>`;
    }).join('');
    const use = { house: 'Rest, cook, bake', store: 'Open the storehouse', workshop: 'Workshop', forge: 'Work the forge', mill: 'Grind flour', smokehouse: 'Smoke food', kiln: 'Fire pottery', loom: 'Weave', apothecary: 'Prepare remedies' }[st.type];
    html = `<h2>${e(S.name)}</h2><div class="sub">${e(S.desc)} Level ${L} of ${S.max} · ${e(styleName(st.style))}.</div>
      <div class="kv">${e(S.levels[L].gives)}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn primary" data-act="use">${use}</button><button class="btn ghost" data-act="decorate">Decorate…</button></div>
      ${next ? `<h3>Upgrade to level ${next}</h3><div class="row"><div><div>${e(S.levels[next].gives)}</div><div class="need">${costText(upCost, store)}</div></div><button class="btn" data-act="upgrade" ${canAfford(store, upCost) && !blocked(game, P, next) ? '' : 'disabled'}>Upgrade</button></div>${blocked(game, P, next) ? '<div class="sub">Something you built is in the way of the bigger building — take it down first.</div>' : ''}` : '<div class="sub">Fully upgraded.</div>'}
      <h3>Architecture</h3><div class="chips">${styleChips(L)}</div><div class="kv">${e(STYLES[style].desc)}</div>
      ${restyle ? `<div class="row"><div><div>Rebuild in ${e(STYLES[style].name)}</div><div class="need">${Object.keys(restyle).length ? costText(restyle, store) : 'No extra materials.'}</div></div><button class="btn" data-act="restyle" ${canAfford(store, restyle) ? '' : 'disabled'}>Rebuild</button></div>` : ''}
      ${conv ? `<h3>Convert into…</h3><div class="sub">Half of what this building cost comes back to the storehouse.</div>${conv}` : ''}`;
    handler = (act, d) => {
      if (act === 'style') { game.plotStyle = d.s; openPlot(game, plotId); return; }
      if (act === 'use') { game.ui.closePanel(); openStation(game, { house: 'rest', store: 'store', workshop: 'craft' }[st.type] || st.type, plotId); return; }
      if (act === 'decorate') { game.ui.closePanel(); game.buildMode.open(); return; }
      if (act === 'upgrade') { payCost(store, upCost); st.level = next; game.plotStyle = null; game.ui.closePanel(); done(game, `<b>${S.name}</b> upgraded to level ${next}.`); }
      if (act === 'restyle') { payCost(store, restyle); st.style = style; game.plotStyle = null; game.ui.closePanel(); done(game, `<b>${S.name}</b> rebuilt in ${STYLES[style].name.toLowerCase()}.`); }
      if (act === 'convert') {
        const back = half(levelCost(st.type, 1)); for (const [k, v] of Object.entries(back)) store[k] = (store[k] || 0) + v;
        payCost(store, levelCost(d.t, 1)); save.village.plots[plotId] = { type: d.t, level: 1, style: st.style };
        game.ui.closePanel(); done(game, `Converted into a <b>${STRUCTS[d.t].name.toLowerCase()}</b>.`);
      }
    };
  }
  game.ui.showPanel(`<button class="close" data-act="close">Close</button>${html}<div class="actions"><button class="btn ghost" data-act="close">Done</button></div>`, (act, d) => { if (act === 'close') game.plotStyle = null; handler(act, d); });
}

// what a building is for
export function openStation(game, type, plotId) {
  if (type === 'rest') return game.openRest();
  if (type === 'store') return game.openStore();
  if (type === 'craft') return game.openWorkshop();
  if (type === 'hearth') return openHearth(game);
  const save = game.save, store = save.store, st = save.village.plots[plotId] || Object.values(save.village.plots).find((q) => q.type === type);
  const L = st?.level || 1, list = (CRAFTS[type] || []).filter((c) => !c.level || c.level <= L), e = (t) => game.ui.esc(t);
  const rows = list.map((c) => {
    const have = c.upgrade && save.upgrades[c.upgrade];
    return `<div class="row"><div><div>${e(c.name)}</div><div class="need">${e(c.desc)}<br>${costText(c.needs, store)}</div></div>${have ? '<span class="q" style="color:var(--good)">Done ✓</span>' : `<button class="btn" data-act="make" data-id="${c.id}" ${canAfford(store, c.needs) ? '' : 'disabled'}>Make</button>`}</div>`;
  }).join('');
  const locked = (CRAFTS[type] || []).filter((c) => c.level > L).map((c) => `<div class="sub">${e(c.name)} — upgrade this building to make it.</div>`).join('');
  const S = STRUCTS[type];
  game.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>${e(S.name)}</h2><div class="sub">${e(S.desc)} Materials come from the storehouse.</div>${rows}${locked}${provisionsLine(game)}`, (act, d) => {
    if (act !== 'make') return;
    const c = list.find((x) => x.id === d.id); if (!c || !canAfford(store, c.needs)) return;
    payCost(store, c.needs);
    const gives = L >= 2 && c.gives2 ? c.gives2 : c.gives;
    if (gives) for (const [k, v] of Object.entries(gives)) store[k] = (store[k] || 0) + v;
    if (c.prov) for (const [k, v] of Object.entries(c.prov)) save.provisions[k] = (save.provisions[k] || 0) + v;
    if (c.upgrade) save.upgrades[c.upgrade] = true;
    writeSave(save); game.audio.craft(); game.world.buildDynamic?.();
    game.ui.toast(`Made: <b>${e(c.name.toLowerCase())}</b>${c.prov ? ' — in your provisions' : ''}.`);
    openStation(game, type, plotId);
  });
}

export function openHearth(game) {
  const store = game.save.store, e = (t) => game.ui.esc(t);
  const rows = CRAFTS.hearth.map((c) => `<div class="row"><div><div>${e(c.name)}</div><div class="need">${e(c.desc)}<br>${costText(c.needs, store)}</div></div><button class="btn" data-act="make" data-id="${c.id}" ${canAfford(store, c.needs) ? '' : 'disabled'}>Bake</button></div>`).join('');
  game.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>The hearth</h2><div class="sub">Cook a meal from your stores, or bake bread to take with you.</div><div class="actions" style="justify-content:flex-start"><button class="btn primary" data-act="cook">Cook a meal…</button></div>${rows}${provisionsLine(game)}`, (act, d) => {
    if (act === 'cook') { openCooking(game, 'hearth'); return; }
    if (act !== 'make') return;
    const c = CRAFTS.hearth.find((x) => x.id === d.id); payCost(store, c.needs);
    for (const [k, v] of Object.entries(c.prov)) game.save.provisions[k] = (game.save.provisions[k] || 0) + v;
    writeSave(game.save); game.audio.cook?.(); game.ui.toast('Two warm loaves — in your provisions.'); openHearth(game);
  });
}

function provisionsLine(game) {
  const p = Object.entries(game.save.provisions || {}).filter(([, v]) => v > 0);
  return p.length ? `<h3>Your provisions</h3><div class="pills">${p.map(([k, v]) => `<span class="pill">${PROVISIONS[k].name}: <b>${v}</b></span>`).join('')}</div>` : '';
}

// ---------------------------------------------------------------- provisions in the pack
export function provisionsHtml(game) {
  const p = Object.entries(game.save.provisions || {}).filter(([, v]) => v > 0);
  if (!p.length) return '';
  return `<h3>Provisions</h3>${p.map(([k, v]) => { const P = PROVISIONS[k]; return `<div class="row"><div><div>${P.name} <span class="q">×${v}</span></div><div class="need">${P.desc}</div></div><button class="btn" data-act="prov" data-k="${k}">${P.food ? 'Eat' : 'Use'}</button></div>`; }).join('')}`;
}
export function useProvision(game, k) {
  const P = PROVISIONS[k], save = game.save, body = game.body; if (!P || !(save.provisions[k] > 0)) return;
  if (P.food) { body.eat(P.food); body.add('fed', { dur: k === 'bread' ? 900 : 600, msg: false }); game.audio.eat?.(); game.ui.toast(`You eat the ${P.name.toLowerCase()}. <b>Well fed</b> for a long while.`); }
  else if (P.use === 'bandage') {
    const v = body.active('envenomed');
    if (!v) { game.ui.toast('Keep it for a snakebite.'); return; }
    v.dur += 420; v.t = Math.max(0, v.t - 60); game.ui.toast('You wrap the bandage firmly from the bite up the whole limb and keep it still. The venom spreads far more slowly now — but you still need to get home.', true);
  } else if (P.use === 'salve') {
    const had = ['bruised', 'bitten', 'stung'].filter((c) => body.has(c));
    if (!had.length) { game.ui.toast('Nothing to soothe right now.'); return; }
    body.conds = body.conds.filter((c) => !['bruised', 'bitten', 'stung'].includes(c.type)); game.ui.toast('The salve cools and soothes. You feel much better.');
  } else if (P.use === 'tonic') { body.add('tonic', { dur: 600, msg: false }); game.ui.toast('Warmth spreads through your chest. You can hold your breath much longer for a while.'); }
  save.provisions[k]--; if (!save.provisions[k]) delete save.provisions[k];
  writeSave(save);
}

// ---------------------------------------------------------------- the garden
const plantable = (k) => k === 'barley' || (k.startsWith('v:') && PLANTS[k.slice(2)] && PLANTS[k.slice(2)].kind !== 'shellfish') || (k.startsWith('f:') && MUSHROOMS[k.split(':')[1]]);
export function openBed(game, i) {
  const save = game.save, store = save.store, G = save.village.garden, bed = G[i], day = save.village.day, e = (t) => game.ui.esc(t);
  if (bed) {
    const days = cropDays(bed.key), age = day - bed.day;
    if (age < days) { game.ui.toast(`Still growing — ready in ${days - age} more day${days - age > 1 ? 's' : ''}. (A day passes each time you sleep through the night or come home from an expedition.)`); return; }
    const n = bed.key === 'barley' ? 5 + Math.floor(Math.random() * 3) : bed.key.startsWith('f:') ? 2 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
    store[bed.key] = (store[bed.key] || 0) + n; delete G[i];
    writeSave(save); game.audio.pickup(); game.world.buildGarden?.(); game.world.buildDynamic?.();
    game.ui.toast(`Harvested <b>${n} ${e(itemInfo(bed.key).name.toLowerCase())}</b> — in the storehouse.`, true);
    return;
  }
  const keys = Object.keys(store).filter((k) => store[k] > 0 && plantable(k));
  const rows = keys.map((k) => `<div class="row"><div><div>${e(itemInfo(k).name)} <span class="q">×${store[k]}</span></div><div class="need">${k === 'barley' ? 'Ready in 2 days; grind at a mill.' : k.startsWith('f:') ? 'Grown on a log; ready in 3 days.' : 'Ready in 2 days.'}</div></div><button class="btn" data-act="plant" data-k="${e(k)}">Plant</button></div>`).join('') || '<div class="sub">Nothing to plant. Bring back berries, greens or mushrooms alive from an expedition — anything you gather will grow here.</div>';
  game.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>Garden bed</h2><div class="sub">Plant one of something and it grows into more. A day passes each time you sleep through the night or come home from an expedition. What you plant grows true — a mistaken identification stays mistaken.</div>${rows}`, (act, d) => {
    if (act !== 'plant') return;
    const k = d.k; if (!(store[k] > 0)) return;
    store[k]--; if (!store[k]) delete store[k];
    G[i] = { key: k, day, label: k.startsWith('f:') ? itemInfo(k).name.toLowerCase() : null };
    writeSave(save); game.audio.dig?.(); game.ui.closePanel(); game.world.buildGarden?.(); game.world.buildDynamic?.();
    game.ui.toast(`Planted: ${e(itemInfo(k).name.toLowerCase())}.`);
  });
}
// a day passes in the village (sleeping through the night, or coming home)
export function villageDay(game) { const v = game.save.village; v.day = (v.day || 0) + 1; game.world?.buildGarden?.(); }
