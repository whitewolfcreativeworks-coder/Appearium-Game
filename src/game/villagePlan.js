// The village as a set of plots. Each plot holds a building (or is empty, waiting for one); each
// building has a level, an architecture, and a purpose. Everything is paid for with what you
// bring home — wood and stone, clay and fibre, ore, shells and driftwood, crops from the garden —
// and many buildings turn raw finds into better materials (ingots, tiles, rope, cloth, flour…)
// that the bigger upgrades need. Outside the south gate is a garden where what you forage grows.
import { canAfford, costText } from './building.js';

// where the plots are (yard coordinates) — the first three start with buildings on them
export const PLOTS = [
  { id: 'home', x: -15, z: 5, start: { type: 'house', level: 1, style: 'timber' } },
  { id: 'store', x: 15, z: 6, start: { type: 'store', level: 1, style: 'plank0' } },
  { id: 'workshop', x: -14, z: -11, start: { type: 'workshop', level: 1, style: 'timber' } },
  { id: 'plotA', x: -6, z: -21 },
  { id: 'plotB', x: 9.5, z: -21.5 },
  { id: 'plotC', x: -25, z: -1.5 },
  { id: 'plotD', x: -12, z: 22.5 },
  { id: 'plotE', x: 13, z: 23 },
];
export const plotRy = (p) => Math.atan2(-p.x, -p.z); // door towards the village square

// ---------------------------------------------------------------- buildings
// cost: to build (level 1) and to reach each further level. size grows with level.
export const STRUCTS = {
  house: { name: 'Your home', short: 'Home', max: 3, fixed: true, desc: 'Where you sleep, keep your things and cook.', levels: [
    null, { cost: {} , gives: 'A bed, a table and a chest for your things.' },
    { cost: { wood: 20, stone: 10, fibre: 6 }, gives: 'A bigger house with a stone hearth to cook and bake at.' },
    { cost: { wood: 28, stone: 18, rope: 4, iron_bar: 2 }, gives: 'A fine house: more room, a second bed, a window seat. Rest here and you wake well fed.' }] },
  store: { name: 'Storehouse', short: 'Storehouse', max: 2, fixed: true, desc: 'Everything you bring home is kept here — the piles outside grow with it.', levels: [
    null, { cost: {}, gives: 'Shelves, barrels and sacks.' },
    { cost: { wood: 18, stone: 8, rope: 2 }, gives: 'A bigger storehouse, more barrels and shelves.' }] },
  workshop: { name: 'Workshop', short: 'Workshop', max: 2, fixed: true, desc: 'Craft equipment and traps, and build and decorate your place.', levels: [
    null, { cost: {}, gives: 'An open shed with a workbench.' },
    { cost: { wood: 16, stone: 6, rope: 2 }, gives: 'An enclosed workshop with walls, windows and a tool wall — warm and dry to work in.' }] },
  forge: { name: 'Forge', short: 'Forge', max: 2, desc: 'Smelt ore into metal and make iron tools.', levels: [
    null, { cost: { stone: 14, clay: 6, wood: 8 }, gives: 'Smelt copper and iron ore into ingots and bars.' },
    { cost: { stone: 10, iron_bar: 3, clay: 4 }, gives: 'A bigger forge: make an iron axe and a pick (gather twice the wood, half again the stone and ore).' }] },
  mill: { name: 'Mill', short: 'Mill', max: 2, desc: 'Grind barley from your garden into flour; bake bread at your hearth.', levels: [
    null, { cost: { wood: 16, stone: 12, rope: 2 }, gives: 'Millstones to grind barley into flour.' },
    { cost: { wood: 12, stone: 8, iron_bar: 1 }, gives: 'Bigger stones: three barley make three flour instead of two.' }] },
  smokehouse: { name: 'Smokehouse', short: 'Smokehouse', max: 1, desc: 'Smoke fish and meat into provisions that keep — and keep you going.', levels: [
    null, { cost: { wood: 12, stone: 6, clay: 2 }, gives: 'Smoke your catch into provisions you can carry on expeditions.' }] },
  kiln: { name: 'Pottery kiln', short: 'Kiln', max: 1, desc: 'Fire clay into pots and roof tiles.', levels: [
    null, { cost: { stone: 12, clay: 8, wood: 6 }, gives: 'Pottery and roof tiles (for tiled roofs and many decorations).' }] },
  loom: { name: 'Weaver\'s hut', short: 'Loom', max: 1, desc: 'Spin plant fibre into rope and weave cloth.', levels: [
    null, { cost: { wood: 12, fibre: 8 }, gives: 'Rope and cloth — needed for bigger buildings, rugs and hangings.' }] },
  apothecary: { name: 'Apothecary', short: 'Apothecary', max: 1, desc: 'Prepare dressings and remedies to carry with you.', levels: [
    null, { cost: { wood: 10, stone: 6, pottery: 2, sea_glass: 1 }, gives: 'Pressure bandages for snakebite, herbal salve for bruises and stings, and a breathing tonic for divers.' }] },
};
export const BUILDABLE = ['forge', 'mill', 'smokehouse', 'kiln', 'loom', 'apothecary'];
export const START_STYLES = { plank0: 'plank' };

// ---------------------------------------------------------------- what the buildings make
// needs may use 'anyfish', 'anymeat' and 'anygreen' (any edible green you've identified)
export const CRAFTS = {
  forge: [
    { id: 'copper_ingot', name: 'Smelt copper', needs: { copper: 2, wood: 2 }, gives: { copper_ingot: 1 }, desc: 'Ore and charcoal in the coals until the copper runs.' },
    { id: 'iron_bar', name: 'Smelt iron', needs: { iron: 2, wood: 3 }, gives: { iron_bar: 1 }, desc: 'A bloom of iron, hammered into a bar.' },
    { id: 'axe', name: 'Iron axe', needs: { iron_bar: 2, wood: 2 }, upgrade: 'axe', level: 2, desc: 'Twice the wood from every deadfall.' },
    { id: 'pick', name: 'Iron pick', needs: { iron_bar: 2, wood: 2 }, upgrade: 'pick', level: 2, desc: 'Half again the stone and ore from every outcrop.' },
  ],
  mill: [
    { id: 'flour', name: 'Grind flour', needs: { barley: 3 }, gives: { flour: 2 }, gives2: { flour: 3 }, desc: 'Barley from your garden, ground between the stones.' },
  ],
  hearth: [
    { id: 'bread', name: 'Bake bread', needs: { flour: 2, wood: 1 }, prov: { bread: 2 }, desc: 'Two loaves to carry. Bread keeps you well fed for a long time.' },
  ],
  smokehouse: [
    { id: 'smoked_fish', name: 'Smoke fish', needs: { anyfish: 1, wood: 1 }, prov: { smoked_fish: 1 }, desc: 'Any fish, split and smoked.' },
    { id: 'smoked_meat', name: 'Smoke meat', needs: { anymeat: 1, wood: 1 }, prov: { smoked_meat: 1 }, desc: 'Hare, squirrel, crab or crayfish.' },
  ],
  kiln: [
    { id: 'pottery', name: 'Fire pottery', needs: { clay: 2, wood: 1 }, gives: { pottery: 1 }, desc: 'A pot, glazed with ash.' },
    { id: 'tile', name: 'Fire roof tiles', needs: { clay: 3, wood: 1 }, gives: { tile: 4 }, desc: 'For tiled roofs.' },
  ],
  loom: [
    { id: 'rope', name: 'Twist rope', needs: { fibre: 3 }, gives: { rope: 1 }, desc: 'Three-strand rope.' },
    { id: 'cloth', name: 'Weave cloth', needs: { fibre: 4 }, gives: { cloth: 1 }, desc: 'A length of rough cloth.' },
  ],
  apothecary: [
    { id: 'bandage', name: 'Pressure bandage', needs: { cloth: 1 }, prov: { bandage: 2 }, desc: 'For snakebite: wrap the whole limb firmly and keep still — it slows the venom and buys time to get home.' },
    { id: 'salve', name: 'Herbal salve', needs: { pottery: 1, anygreen: 2 }, prov: { salve: 2 }, desc: 'Soothes bruises, bites and nettle stings.' },
    { id: 'tonic', name: 'Diver\'s tonic', needs: { anygreen: 1, shell: 2 }, prov: { tonic: 1 }, desc: 'Warming, steadying — hold your breath half as long again on your next dives.' },
  ],
};

// provisions: carried with you everywhere (like bait), eaten or used from your pack
export const PROVISIONS = {
  bread: { name: 'Bread', food: 7, desc: 'A dense, chewy loaf. Keeps you well fed for a long time.' },
  smoked_fish: { name: 'Smoked fish', food: 5, desc: 'Keeps for weeks. Salty and filling.' },
  smoked_meat: { name: 'Smoked meat', food: 5, desc: 'Dark and chewy, and very welcome on the trail.' },
  bandage: { name: 'Pressure bandage', use: 'bandage', desc: 'For snakebite: slows the venom a great deal.' },
  salve: { name: 'Herbal salve', use: 'salve', desc: 'Cures bruises, bites and stings.' },
  tonic: { name: 'Diver\'s tonic', use: 'tonic', desc: 'Hold your breath half as long again for a while.' },
};

// ---------------------------------------------------------------- the garden (outside the south gate)
export const GARDEN = { gateAngle: Math.PI / 2, half: 0.5, depth: 9, beds: 8 };
export const CROPS = { // what grows from what you plant — anything gathered alive will grow
  barley: { name: 'Barley', days: 2, yield: [5, 7], color: 0xd8c070 },
};
export const cropDays = (key) => (key === 'barley' ? 2 : key.startsWith('f:') ? 3 : 2);

// ---------------------------------------------------------------- helpers
export function structAt(save, plotId) { return save.village?.plots?.[plotId] || null; }
export function levelCost(type, level) { return STRUCTS[type]?.levels[level]?.cost || {}; }
export function styleCost(style, level) { const c = {}; for (const [k, v] of Object.entries(STYLE_COSTS[style] || {})) c[k] = Math.ceil(v * (0.6 + 0.4 * level)); return c; }
export const STYLE_COSTS = { timber: {}, whitewash: { clay: 4, stone: 4 }, plank: { wood: 6, tile: 6 }, stone: { stone: 14, tile: 6 }, sandstone: { sandstone: 12 }, driftwood: { driftwood: 10 }, tropical: { frond: 12, wood: 4 } };
export function addCost(a, b) { const c = { ...a }; for (const [k, v] of Object.entries(b)) c[k] = (c[k] || 0) + v; return c; }
export { canAfford, costText };
