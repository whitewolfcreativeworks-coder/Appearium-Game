// Item keys & player knowledge.
//   plain ids          materials, minerals, game, fish (e.g. 'wood', 'trout')
//   'f:<true>:<label>' foraged, NOT yet verified. label is what the player identified it as ('?' = unknown)
//   'v:<id>'           foraged and verified (by the herbalist, or recognised from experience)
// The true species decides what happens when you eat it; the label is all the player sees.
import { ITEMS, CATS } from './items.js';
import { MUSHROOMS, PLANTS, FISH, KNOWLEDGE_TO_RECOGNISE } from '../data/species.js';

export const speciesOf = (id) => MUSHROOMS[id] || PLANTS[id] || null;
export const isMushroom = (id) => !!MUSHROOMS[id];

export function forageKey(trueId, label, verified = false) { return verified ? `v:${trueId}` : `f:${trueId}:${label || '?'}`; }

export function parseKey(key) {
  if (key.startsWith('v:')) { const id = key.slice(2); return { kind: 'forage', trueId: id, label: id, verified: true }; }
  if (key.startsWith('f:')) { const [, t, l] = key.split(':'); return { kind: 'forage', trueId: t, label: l, verified: false }; }
  if (FISH[key]) return { kind: 'fish', id: key };
  return { kind: 'item', id: key };
}

// short neutral description for an unidentified find
export function unknownName(trueId) {
  const s = speciesOf(trueId);
  if (MUSHROOMS[trueId]) {
    const cap = s.look.cap.split(/[,(—]/)[0].toLowerCase().replace(/^a /, '');
    return `Unknown mushroom (${cap.length > 34 ? cap.slice(0, 32) + '…' : cap})`;
  }
  return `Unknown ${s.kind === 'berry' ? 'berries' : 'plant'} (${s.look.fruit.split(/[,;]/)[0].toLowerCase().slice(0, 32)})`;
}

export function itemInfo(key) {
  const p = parseKey(key);
  if (p.kind === 'forage') {
    const tr = speciesOf(p.trueId);
    const lab = p.label === '?' ? null : speciesOf(p.label);
    const mush = isMushroom(p.trueId);
    const cat = 'forage';
    let name;
    if (p.verified) name = tr.name;
    else if (!lab) name = unknownName(p.trueId);
    else name = `${lab.name} ?`;
    return { name, cat, value: p.verified ? tr.value : 0, desc: p.verified ? tr.facts : (lab ? 'Your identification — not yet checked by the herbalist.' : 'You have not identified this.'), forage: true, mushroom: mush, ...p };
  }
  if (p.kind === 'fish') { const f = FISH[p.id]; return { name: f.name, cat: 'fish', value: f.value, desc: f.look, fish: true, id: p.id, food: f.food }; }
  const it = ITEMS[key];
  if (!it) return { name: key, cat: 'material', value: 0, desc: '' };
  return { ...it, id: key };
}

export function catOf(key) { return itemInfo(key).cat; }
export { CATS };

// ---------------------------------------------------------------- knowledge
export function know(save, id) {
  const k = save.knowledge || (save.knowledge = {});
  return k[id] || (k[id] = { seen: 0, confirmed: 0, wrong: 0, eaten: 0, caught: 0, released: 0, best: 0 });
}
export function recognised(save, id) { return (save.knowledge?.[id]?.confirmed || 0) >= KNOWLEDGE_TO_RECOGNISE; }

// migrate saves from the first release (plain forage ids, fictional ghostcap)
const OLD_FORAGE = { chanterelle: 'chanterelle', porcini: 'porcini', bilberry: 'bilberry', lingonberry: 'lingonberry', cloudberry: 'cloudberry', nettle: 'nettle', celandine: 'celandine', dandelion: 'dandelion' };
export function migrateItems(bag) {
  if (!bag) return bag;
  for (const k of Object.keys(bag)) {
    if (OLD_FORAGE[k]) { bag[`v:${OLD_FORAGE[k]}`] = (bag[`v:${OLD_FORAGE[k]}`] || 0) + bag[k]; delete bag[k]; }
    else if (k === 'ghostcap') delete bag[k];
  }
  return bag;
}
