// Persistence (localStorage). The village, its stores, artifacts and journal are permanent.
// The pack is saved continuously during an expedition so a reload never loses what was found.
const KEY = 'appearium.save.v1';

export function newSave() {
  return {
    version: 1,
    created: new Date().toISOString(),
    expeditionCount: 0,
    store: { wood: 4, fibre: 2 },
    artifacts: [],
    journal: { expeditions: [], wildlife: {}, fish: {}, places: [] },
    upgrades: { rod: 1, pack: 30, lantern: false, tower: false, garden: false, hall: false },
    tools: { snare: 2 },
    time: 9.5,
    settings: { quality: null, lookSens: 1, invertY: false, volume: 0.8 },
    pendingPack: null,  // pack contents of an expedition interrupted by a reload
    tutorial: { welcome: false, gate: false, firstExpedition: false },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newSave();
    const s = JSON.parse(raw);
    const base = newSave();
    // shallow-merge so new fields from later versions get defaults
    for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
    for (const k of ['upgrades', 'settings', 'journal', 'tutorial', 'tools']) s[k] = { ...base[k], ...s[k] };
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
