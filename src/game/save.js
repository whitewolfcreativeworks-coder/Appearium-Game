// Persistence (localStorage). The village, its stores, artifacts and journal are permanent.
// The pack is saved continuously during an expedition so a reload never loses what was found.
import { migrateItems } from './inventory.js';
const KEY = 'appearium.save.v1';

export function newSave() {
  return {
    version: 2,
    created: new Date().toISOString(),
    expeditionCount: 0,
    store: { wood: 4, fibre: 2, barley: 6 },
    artifacts: [],
    builds: [],       // pieces you have built and decorations you have placed in the village
    journal: { expeditions: [], wildlife: {}, fish: {}, places: [] },
    upgrades: { rod: 1, pack: 30, lantern: false, tower: false, garden: false, hall: false },
    tools: { snare: 1, deadfall: 0, fishtrap: 0 },
    bait: { worm: 12, grub: 0, minnow: 0, fly: 0, spinner: 0 },
    lessons: { snare: false, deadfall: false, fishtrap: false },
    knowledge: {},
    body: null,
    time: 9.5,
    settings: { quality: null, lookSens: 1, invertY: false, volume: 0.8 },
    pendingPack: null,  // pack contents of an expedition interrupted by a reload
    tutorial: { welcome: false, gate: false, firstExpedition: false },
    // plots & buildings (your home, storehouse and workshop already stand), the garden, and the village's day count
    village: { plots: { home: { type: 'house', level: 1, style: 'timber' }, store: { type: 'store', level: 1, style: 'plank0' }, workshop: { type: 'workshop', level: 1, style: 'timber' } }, garden: {}, day: 0 },
    provisions: {},    // bread, smoked food, bandages, salves — carried everywhere, like bait
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const s = JSON.parse(raw);
    const base = newSave(), hadVillage = !!s.village;
    // shallow-merge so new fields from later versions get defaults
    for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
    for (const k of ['upgrades', 'settings', 'journal', 'tutorial', 'tools', 'bait', 'lessons', 'knowledge']) s[k] = { ...base[k], ...s[k] };
    migrateItems(s.store); if (s.pendingPack) migrateItems(s.pendingPack.items);
    if (s.version < 2) { s.lessons.snare = (s.tools.snare || 0) > 0; s.version = 2; }
    if (!hadVillage) s.store.barley = (s.store.barley || 0) + 6; // version 3: plots and a garden — here's some barley seed
    return s;
  } catch (e) {
    console.warn('save unreadable, starting fresh', e);
    return newSave();
  }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { console.warn('save failed', e); return false; }
}

export function resetSave() { localStorage.removeItem(KEY); }
