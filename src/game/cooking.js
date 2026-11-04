// Cooking at a campfire (from your pack) or the hearth at home (from your stores).
// Choose ingredients; the dish is named from what went in. What actually happens to you depends
// on the TRUE species in the pot — cooking does not destroy most mushroom toxins.
import { MUSHROOMS, PLANTS, FISH, STATUS } from '../data/species.js';
import { ITEMS } from './items.js';
import { itemInfo, parseKey, speciesOf, know } from './inventory.js';
import { applyEffect } from './body.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cookable(key) {
  const p = parseKey(key);
  if (p.kind === 'forage') return true;
  if (p.kind === 'fish') return true;
  return !!ITEMS[key]?.cook;
}

function dishName(sel) {
  const keys = Object.keys(sel).filter((k) => sel[k] > 0);
  const info = keys.map((k) => ({ k, i: itemInfo(k), p: parseKey(k) }));
  const lab = (x) => (x.p.kind === 'forage' ? (x.p.label === '?' ? null : x.p.label) : x.p.id || x.k);
  const fish = info.filter((x) => x.i.fish), mush = info.filter((x) => x.i.forage && MUSHROOMS[x.p.trueId]);
  const plants = info.filter((x) => x.i.forage && PLANTS[x.p.trueId]);
  const berries = plants.filter((x) => PLANTS[x.p.trueId].kind === 'berry'), greens = plants.filter((x) => PLANTS[x.p.trueId].kind === 'green');
  const game = info.filter((x) => ['hare', 'squirrel', 'crayfish'].includes(x.k));
  const garlic = greens.some((x) => lab(x) === 'ramsons');
  if (!keys.length) return '';
  if (game.length) return { hare: 'Hare stew', squirrel: 'Roast squirrel', crayfish: 'Boiled crayfish' }[game[0].k] + (mush.length ? ' with mushrooms' : garlic ? ' with wild garlic' : '');
  if (fish.length && mush.length) return `Pan-fried ${fish[0].i.name.toLowerCase()} with mushrooms`;
  if (fish.length) return `Grilled ${fish[0].i.name.toLowerCase()}${garlic ? ' with wild garlic' : ''}`;
  if (mush.length && garlic) return 'Wild mushrooms fried with wild garlic';
  if (mush.length) return mush.length > 1 || sel[mush[0].k] > 1 ? 'Fried wild mushrooms' : 'A fried mushroom';
  if (greens.some((x) => lab(x) === 'nettle')) return 'Nettle soup';
  if (berries.length && !greens.length) return 'Berry compote';
  return 'Forager\'s pottage';
}

export function openCooking(game, where) {
  const bag = where === 'hearth' ? game.save.store : game.pack.items;
  const sel = {};
  const total = () => Object.values(sel).reduce((a, b) => a + b, 0);
  const render = () => {
    const keys = Object.keys(bag).filter((k) => bag[k] > 0 && cookable(k));
    const rows = keys.map((k) => {
      const i = itemInfo(k), n = sel[k] || 0;
      return `<div class="row"><div>${esc(i.name)}<div class="need">${bag[k] - n} left</div></div><div class="qty"><button class="btn ghost" data-act="minus" data-k="${esc(k)}" ${n ? '' : 'disabled'}>−</button><span class="q">${n}</span><button class="btn ghost" data-act="plus" data-k="${esc(k)}" ${bag[k] - n > 0 && total() < 5 ? '' : 'disabled'}>+</button></div></div>`;
    }).join('') || `<div class="sub">${where === 'hearth' ? 'Your stores hold nothing to cook.' : 'You have nothing to cook. Fish, game, mushrooms, berries and greens can all go in the pot.'}</div>`;
    const name = dishName(sel);
    game.ui.showPanel(`<button class="close" data-act="close">Close</button><h2>${where === 'hearth' ? 'The hearth' : 'Cook at the campfire'}</h2>
      <div class="sub">Choose up to five ingredients. ${where === 'hearth' ? 'Cooking from your stores.' : 'Cooking from your pack.'} Mushrooms, fish and game should always be cooked.</div>
      ${rows}<div class="dish">${name ? `<span>${esc(name)}</span>` : '<span class="dim">An empty pot</span>'}</div>
      <div class="actions"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="cook" ${name ? '' : 'disabled'}>Cook and eat</button></div>`, (act, d) => {
      if (act === 'plus') { sel[d.k] = (sel[d.k] || 0) + 1; render(); }
      if (act === 'minus') { sel[d.k] = Math.max(0, (sel[d.k] || 0) - 1); render(); }
      if (act === 'cook') { cook(game, bag, sel, dishName(sel)); }
    });
  };
  render();
}

function cook(game, bag, sel, name) {
  let food = 0, bitter = false, effects = [], kinds = new Set(), delicious = false;
  for (const [k, n] of Object.entries(sel)) {
    if (!n) continue;
    bag[k] -= n; if (!bag[k]) delete bag[k];
    const p = parseKey(k);
    if (p.kind === 'forage') {
      const sp = speciesOf(p.trueId); know(game.save, p.trueId).eaten += n;
      kinds.add(MUSHROOMS[p.trueId] ? 'mushroom' : PLANTS[p.trueId].kind);
      if (sp.effect?.bitter) bitter = true;
      else if (sp.effect) effects.push(sp);
      else food += (sp.food || 1) * n;
      if (p.trueId === 'ramsons' || p.trueId === 'wood_sorrel') delicious = true;
    } else if (p.kind === 'fish') { food += FISH[p.id].food * n; kinds.add('fish'); }
    else { food += (ITEMS[k].food || 1) * n; kinds.add('game'); }
  }
  game.ui.closePanel(); game.audio.cook?.();
  if (bitter) {
    game.ui.showPanel(`<h2>${esc(name)}</h2><div class="sub">You take one bite — and spit it out. The whole pan is unbearably bitter. One bad mushroom has ruined everything in it.</div><div class="tell">A bitter bolete looks almost exactly like a porcini. Check for pink pores and a dark net on the stem.</div><div class="actions"><button class="btn" data-act="close">Throw it away</button></div>`, null);
    game.persist(); game.updatePackMeter(); return;
  }
  if (kinds.size >= 3) food += 2;
  if (delicious && food) food += 2;
  for (const sp of effects) applyEffect(game.body, sp, { cooked: true });
  game.body.eat(food);
  const taste = food >= 9 ? 'A feast. You feel strong and warm.' : food >= 5 ? (delicious ? 'Delicious — the wild garlic brings it all together.' : 'A good, filling meal.') : food > 0 ? 'A simple meal, but it helps.' : 'It does not taste of much.';
  game.ui.showPanel(`<h2>${esc(name)}</h2><div class="sub">${taste}</div>${game.body.has('fed') ? '<div class="kv"><b style="color:#9fc27a">Well fed</b> — you can run further for a while.</div>' : ''}<div class="actions"><button class="btn" data-act="close">Done</button></div>`, null);
  game.persist(); game.updatePackMeter();
}

export const isCookable = cookable;
