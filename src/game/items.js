// Item & artifact definitions. Resources stack; artifacts are unique and remember where they came from.
import { RNG } from '../core/rng.js';

export const CATS = {
  material: { label: 'Materials', color: '#9c8a6e' },
  mineral: { label: 'Minerals', color: '#8fa3b0' },
  forage: { label: 'Forage', color: '#a7a35a' },
  fish: { label: 'Fish', color: '#6f95a8' },
  game: { label: 'Game', color: '#a37a5c' },
  tool: { label: 'Tools', color: '#b9b2a4' },
};

export const ITEMS = {
  wood:        { name: 'Wood', cat: 'material', value: 1, desc: 'Seasoned deadwood and fallen branches.' },
  stone:       { name: 'Stone', cat: 'material', value: 1, desc: 'Fist-sized stones, good for building and tools.' },
  fibre:       { name: 'Plant fibre', cat: 'material', value: 1, desc: 'Stripped nettle stems, twisted into cord.' },
  clay:        { name: 'River clay', cat: 'material', value: 2, desc: 'Fine grey clay from a stream bank.' },
  quartz:      { name: 'Quartz', cat: 'mineral', value: 4, desc: 'Clear quartz points from a rock seam.' },
  copper:      { name: 'Copper ore', cat: 'mineral', value: 5, desc: 'Green-veined malachite and copper ore.' },
  amethyst:    { name: 'Amethyst', cat: 'mineral', value: 8, desc: 'Violet crystals, rare in these lands.' },
  iron:        { name: 'Iron ore', cat: 'mineral', value: 4, desc: 'Heavy rust-red bog iron.' },
  chanterelle: { name: 'Chanterelle', cat: 'forage', value: 2, desc: 'Apricot-scented golden mushrooms.' },
  porcini:     { name: 'Porcini', cat: 'forage', value: 3, desc: 'Fat brown-capped boletes.' },
  ghostcap:    { name: 'Ghostcap', cat: 'forage', value: 9, desc: 'A pale mushroom that glows faintly in the dark.' },
  bilberry:    { name: 'Bilberries', cat: 'forage', value: 1, desc: 'Small dark-blue forest berries.' },
  lingonberry: { name: 'Lingonberries', cat: 'forage', value: 1, desc: 'Tart red berries of the heath.' },
  cloudberry:  { name: 'Cloudberries', cat: 'forage', value: 3, desc: 'Amber berries from boggy ground.' },
  nettle:      { name: 'Nettle', cat: 'forage', value: 1, desc: 'Stinging nettle — food, medicine and fibre.' },
  celandine:   { name: 'Celandine', cat: 'forage', value: 2, desc: 'Glossy yellow spring flowers, an old remedy.' },
  dandelion:   { name: 'Dandelion', cat: 'forage', value: 1, desc: 'Leaves and roots for tea and salad.' },
  trout:       { name: 'Brown trout', cat: 'fish', value: 4, desc: 'Speckled river fish.' },
  grayling:    { name: 'Grayling', cat: 'fish', value: 4, desc: 'A fish of cold, clear running water.' },
  perch:       { name: 'Perch', cat: 'fish', value: 3, desc: 'Striped lake fish.' },
  pike:        { name: 'Pike', cat: 'fish', value: 6, desc: 'A long, toothy lake predator.' },
  char:        { name: 'Arctic char', cat: 'fish', value: 6, desc: 'Red-bellied fish of deep highland lakes.' },
  tench:       { name: 'Tench', cat: 'fish', value: 3, desc: 'Olive fish of still, weedy water.' },
  hare:        { name: 'Hare', cat: 'game', value: 4, desc: 'Caught in a snare.' },
  pelt:        { name: 'Hare pelt', cat: 'game', value: 4, desc: 'Soft fur, useful for packs and clothing.' },
  snare:       { name: 'Snare', cat: 'tool', value: 1, desc: 'A simple cord snare. Set it where hares run.' },
};

export const FISH_SIZES = { trout: [22, 58], grayling: [20, 45], perch: [15, 40], pike: [45, 110], char: [25, 65], tench: [20, 50] };

export const RECIPES = [
  { id: 'snare', name: 'Two snares', needs: { wood: 2, fibre: 1 }, gives: { snare: 2 }, desc: 'Cord snares for catching hares.' },
  { id: 'rod2', name: 'Sturdy fishing rod', needs: { wood: 3, fibre: 2, copper: 1 }, upgrade: ['rod', 2], desc: 'Bites come faster and the line holds better.' },
  { id: 'pack2', name: 'Larger pack', needs: { fibre: 3, pelt: 2 }, upgrade: ['pack', 50], desc: 'Carry 50 instead of 30.' },
  { id: 'lantern', name: 'Lantern', needs: { copper: 1, quartz: 1, wood: 2 }, upgrade: ['lantern', true], desc: 'Light your way on night expeditions (press L).' },
  { id: 'tower', name: 'Raise a watchtower', needs: { wood: 12, stone: 6 }, upgrade: ['tower', true], desc: 'A lookout over the village palisade.' },
  { id: 'garden', name: 'Herb garden', needs: { wood: 4, stone: 4, nettle: 2, celandine: 1 }, upgrade: ['garden', true], desc: 'Raised beds beside your home.' },
  { id: 'hall', name: 'Extend the Hall of Discoveries', needs: { wood: 10, stone: 10, clay: 2 }, upgrade: ['hall', true], desc: 'Room for eight more artifacts.' },
];

// ---------------------------------------------------------------- artifacts
const ADJ = ['Weathered', 'Ash-glazed', 'Smoke-dark', 'Lichen-stained', 'Finely made', 'Cracked', 'Salt-white', 'Ochre-painted', 'Time-worn', 'Delicate'];
const ANIMALS = ['fox', 'hare', 'heron', 'elk', 'owl', 'salmon', 'wolf', 'lynx', 'crow'];
const KINDS = {
  vessel: { model: 'ceramic_vase_01', nouns: ['jar', 'vessel', 'urn', 'water pot'] },
  amphora: { model: 'antique_ceramic_vase_01', nouns: ['amphora', 'oil jar', 'flask'] },
  brass: { model: 'brass_vase_01', nouns: ['brass ewer', 'brass vase', 'temple vessel'] },
  tool: { model: 'wooden_axe', nouns: ['hand-axe', 'hatchet', 'woodsman\'s axe'] },
  rune: { model: null, nouns: ['rune stone', 'carved waystone', 'marker stone'] },
  figurine: { model: null, nouns: ['figurine'] },
  geode: { model: null, nouns: ['geode', 'crystal cluster'] },
  amulet: { model: null, nouns: ['amulet', 'pendant', 'talisman'] },
  flute: { model: null, nouns: ['bone flute', 'reed pipe'] },
  compass: { model: null, nouns: ['brass compass', 'sun-dial'] },
};
const STORIES = {
  ruins: ['Found beneath fallen masonry in {place}.', 'Recovered from a collapsed chamber in {place}.', 'Half-buried in the floor of {place}, untouched for centuries.'],
  stones: ['Left as an offering at the foot of {place}.', 'Found at the centre of {place}, where the grass will not grow.'],
  grotto: ['Prised from the wall of {place}.', 'Glittering in the back of {place}, where little light reaches.'],
  cabin: ['Left behind in {place}, along with a cold hearth.', 'Hanging on a peg inside {place}.'],
  trade: ['Traded for at {place}. The keeper\'s mark is pressed into it.', 'Made by the folk of {place}, who asked for a fair exchange.'],
  find: ['Glinting in the undergrowth of {region}.', 'Lying where someone dropped it, long ago, in {region}.'],
};
const TINTS = { vessel: ['#c9b9a3', '#8f6a52', '#5b6b70', '#b59a74', '#6e5948'], amphora: ['#c8a47a', '#a07050', '#7c6a5a'], brass: ['#ffffff', '#d8c8a0', '#b8a888'] };

export function generateArtifact(seed, ctx) {
  const rng = new RNG(seed);
  const source = ctx.source || 'find';
  const pool = {
    ruins: ['vessel', 'amphora', 'brass', 'amulet', 'compass', 'figurine'],
    stones: ['rune', 'amulet', 'figurine'],
    grotto: ['geode', 'geode', 'rune'],
    cabin: ['tool', 'flute', 'vessel', 'compass'],
    trade: ctx.specialty === 'potters' ? ['vessel', 'amphora'] : ctx.specialty === 'smiths' ? ['brass', 'tool', 'compass'] : ctx.specialty === 'carvers' ? ['figurine', 'flute', 'amulet'] : ['vessel', 'figurine'],
    find: ['amulet', 'flute', 'compass', 'figurine', 'tool'],
  }[source];
  const type = rng.pick(pool);
  const K = KINDS[type];
  let noun = rng.pick(K.nouns), name;
  const animal = rng.pick(ANIMALS);
  const mineral = rng.pick(['Quartz', 'Amethyst', 'Smoky quartz', 'Citrine', 'Agate']);
  if (type === 'figurine') name = `Carved ${animal} figurine`;
  else if (type === 'geode') name = `${mineral} ${noun}`;
  else if (type === 'rune') name = `${rng.pick(['Spiral', 'Sun', 'Serpent', 'Antler', 'Wave'])}-carved ${noun}`;
  else name = `${rng.pick(ADJ)} ${noun}`;
  if (ctx.place && rng.chance(0.6)) name += ` of ${ctx.place}`;
  const story = rng.pick(STORIES[source]).replace('{place}', ctx.place || ctx.region).replace('{region}', ctx.region);
  const tintList = TINTS[type] || ['#ffffff'];
  return {
    uid: `a${seed.toString(36)}${Date.now().toString(36).slice(-4)}`,
    type, name, story,
    tint: rng.pick(tintList), hue: rng.range(0, 1), scale: rng.range(0.9, 1.15), animal,
    mineral,
    origin: { expedition: ctx.expedition, region: ctx.region, scenario: ctx.scenario, place: ctx.place || null, date: new Date().toISOString() },
  };
}
